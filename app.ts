import path from 'path';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import { Types } from 'mongoose';
import Course from './models/Course.js';
import Enrollment from './models/Enrollment.js';
import Log from './models/Log.js';
import User from './models/User.js';
import { isMembershipRole, isTenantKey, isUserRole, MembershipRole, TenantKey, TENANTS, UserRole } from './domain.js';

interface SessionAuth {
  userId: string;
  tenant: TenantKey;
}

interface AuthedRequest extends Request {
  currentTenant?: TenantKey;
  currentUser?: {
    id: string;
    tenant: TenantKey;
    username: string;
    displayName: string;
    role: UserRole;
  };
}

interface AppOptions {
  sessionSecret?: string;
}

function toObjectId(value: string, label = 'ID'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    const err = new Error(`Invalid ${label}: "${value}" is not a valid ObjectId`);
    (err as NodeJS.ErrnoException).code = 'ERR_INVALID_OBJECT_ID';
    throw err;
  }
  return new Types.ObjectId(value);
}

function toUserSummary(user: {
  _id: Types.ObjectId | string;
  username: string;
  displayName: string;
  role: UserRole;
}): { id: string; username: string; displayName: string; role: UserRole } {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
}

function getSessionAuth(req: Request): SessionAuth | undefined {
  const maybeSession = req.session as session.Session & Partial<session.SessionData> & { auth?: SessionAuth };
  return maybeSession.auth;
}

function setSessionAuth(req: Request, auth: SessionAuth): void {
  const maybeSession = req.session as session.Session & Partial<session.SessionData> & { auth?: SessionAuth };
  maybeSession.auth = auth;
}

function clearSessionAuth(req: Request): void {
  const maybeSession = req.session as session.Session & Partial<session.SessionData> & { auth?: SessionAuth };
  delete maybeSession.auth;
}

function sendAuthPayload(res: Response, user: { _id: Types.ObjectId | string; username: string; displayName: string; role: UserRole }, tenant: TenantKey): void {
  res.json({
    user: toUserSummary(user),
    tenant: TENANTS[tenant],
    route: `/${tenant}/${user.role}`
  });
}

function normalizeTenant(req: AuthedRequest, res: Response, next: NextFunction): void {
  const tenantParam = req.params.tenant;
  const rawTenant = Array.isArray(tenantParam) ? tenantParam[0] : tenantParam;

  if (!rawTenant || !isTenantKey(rawTenant)) {
    res.status(404).json({ message: 'Unknown tenant' });
    return;
  }

  req.currentTenant = rawTenant;
  next();
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const tenant = req.currentTenant;
  const auth = getSessionAuth(req);

  if (!tenant || !auth || auth.tenant !== tenant) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const user = await User.findById(auth.userId).lean();

  if (!user || user.tenant !== tenant) {
    clearSessionAuth(req);
    res.status(401).json({ message: 'Session expired' });
    return;
  }

  req.currentUser = {
    id: String(user._id),
    tenant: user.tenant,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const user = req.currentUser;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: 'You do not have permission for this action' });
      return;
    }

    next();
  };
}

async function getMembershipRole(tenant: TenantKey, courseId: string, userId: string): Promise<MembershipRole | null> {
  if (!Types.ObjectId.isValid(courseId) || !Types.ObjectId.isValid(userId)) {
    return null;
  }
  const membership = await Enrollment.findOne({
    tenant,
    courseId: new Types.ObjectId(courseId),
    userId: new Types.ObjectId(userId)
  }).lean();

  return membership ? membership.role : null;
}

async function canManageCourse(user: NonNullable<AuthedRequest['currentUser']>, tenant: TenantKey, courseId: string): Promise<boolean> {
  if (user.role === 'admin') {
    return true;
  }

  const membershipRole = await getMembershipRole(tenant, courseId, user.id);

  if (user.role === 'teacher') {
    return membershipRole === 'teacher';
  }

  if (user.role === 'ta') {
    return membershipRole === 'teacher' || membershipRole === 'ta';
  }

  return false;
}

async function deleteCourseRecords(tenant: TenantKey, courseId: Types.ObjectId): Promise<void> {
  await Promise.all([
    Log.deleteMany({ tenant, courseId }),
    Enrollment.deleteMany({ tenant, courseId }),
    Course.deleteOne({ tenant, _id: courseId })
  ]);
}

async function deleteUserRecords(tenant: TenantKey, userId: Types.ObjectId): Promise<void> {
  await Promise.all([
    Enrollment.deleteMany({ tenant, userId }),
    Log.deleteMany({
      tenant,
      $or: [
        { authorId: userId },
        { studentId: userId }
      ]
    }),
    User.deleteOne({ tenant, _id: userId })
  ]);
}

async function buildDashboard(tenant: TenantKey, user: NonNullable<AuthedRequest['currentUser']>) {
  const visibleCourseIds = new Set<string>();
  const membershipMap = new Map<string, MembershipRole>();

  if (user.role === 'admin') {
    const allCourses = await Course.find({ tenant }).lean();
    for (const course of allCourses) {
      visibleCourseIds.add(String(course._id));
    }
  } else {
    const memberships = await Enrollment.find({
      tenant,
      userId: new Types.ObjectId(user.id)
    }).lean();

    for (const membership of memberships) {
      const courseId = String(membership.courseId);
      visibleCourseIds.add(courseId);
      membershipMap.set(courseId, membership.role);
    }
  }

  const courseIds = Array.from(visibleCourseIds).map((courseId) => new Types.ObjectId(courseId));
  const courses = courseIds.length > 0
    ? await Course.find({ _id: { $in: courseIds }, tenant }).sort({ code: 1 }).lean()
    : [];

  const courseIdStrings = courses.map((course) => String(course._id));
  const relatedMemberships = courseIdStrings.length > 0
    ? await Enrollment.find({ tenant, courseId: { $in: courseIds } }).populate('userId').lean()
    : [];

  const relatedLogs = courseIdStrings.length > 0
    ? await Log.find(
      user.role === 'student'
        ? { tenant, courseId: { $in: courseIds }, studentId: new Types.ObjectId(user.id) }
        : { tenant, courseId: { $in: courseIds } }
    )
      .populate('authorId')
      .populate('studentId')
      .sort({ createdAt: -1 })
      .lean()
    : [];

  const teacherIds = Array.from(new Set(courses.map((course) => String(course.teacherId))));
  const teachers = teacherIds.length > 0
    ? await User.find({ _id: { $in: teacherIds.map((teacherId) => new Types.ObjectId(teacherId)) } }).lean()
    : [];
  const teacherMap = new Map(teachers.map((teacher) => [String(teacher._id), teacher]));

  const membersByCourse = new Map<string, { teachers: ReturnType<typeof toUserSummary>[]; tas: ReturnType<typeof toUserSummary>[]; students: ReturnType<typeof toUserSummary>[] }>();

  for (const membership of relatedMemberships) {
    const courseId = String(membership.courseId);
    const userDoc = membership.userId as unknown as {
      _id: Types.ObjectId | string;
      username: string;
      displayName: string;
      role: UserRole;
    };

    if (!userDoc) {
      continue;
    }

    if (!membersByCourse.has(courseId)) {
      membersByCourse.set(courseId, { teachers: [], tas: [], students: [] });
    }

    const courseMembers = membersByCourse.get(courseId);

    if (!courseMembers) {
      continue;
    }

    const summary = toUserSummary(userDoc);

    if (membership.role === 'teacher') {
      courseMembers.teachers.push(summary);
    } else if (membership.role === 'ta') {
      courseMembers.tas.push(summary);
    } else {
      courseMembers.students.push(summary);
    }
  }

  const logsByCourse = new Map<string, Array<{
    id: string;
    text: string;
    createdAt: string;
    author: ReturnType<typeof toUserSummary>;
    student: ReturnType<typeof toUserSummary>;
  }>>();

  for (const log of relatedLogs) {
    const courseId = String(log.courseId);
    const author = log.authorId as unknown as {
      _id: Types.ObjectId | string;
      username: string;
      displayName: string;
      role: UserRole;
    };
    const student = log.studentId as unknown as {
      _id: Types.ObjectId | string;
      username: string;
      displayName: string;
      role: UserRole;
    };

    if (!author || !student) {
      continue;
    }

    const logEntry = {
      id: String(log._id),
      text: log.text,
      createdAt: log.createdAt.toISOString(),
      author: toUserSummary(author),
      student: toUserSummary(student)
    };

    if (!logsByCourse.has(courseId)) {
      logsByCourse.set(courseId, []);
    }

    logsByCourse.get(courseId)?.push(logEntry);
  }

  const availableCourses = user.role === 'student'
    ? await Course.find({
      tenant,
      _id: {
        $nin: courseIds.length > 0 ? courseIds : [new Types.ObjectId()]
      }
    }).sort({ code: 1 }).lean()
    : [];

  const tenantUsers = user.role === 'admin'
    ? await User.find({ tenant }).sort({ role: 1, username: 1 }).lean()
    : [];

  return {
    user,
    tenant: TENANTS[tenant],
    courses: courses.map((course) => {
      const courseId = String(course._id);
      const teacher = teacherMap.get(String(course.teacherId));
      const members = membersByCourse.get(courseId) || { teachers: [], tas: [], students: [] };

      return {
        id: courseId,
        code: course.code,
        title: course.title,
        membershipRole: membershipMap.get(courseId) ?? null,
        teacher: teacher ? toUserSummary(teacher) : null,
        teachers: members.teachers,
        tas: members.tas,
        students: members.students,
        logs: logsByCourse.get(courseId) || []
      };
    }),
    availableCourses: availableCourses.map((course) => ({
      id: String(course._id),
      code: course.code,
      title: course.title
    })),
    users: tenantUsers.map((tenantUser) => toUserSummary(tenantUser))
  };
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const publicDirectory = path.resolve(process.cwd(), 'public');
  const indexFile = path.join(publicDirectory, 'index.html');
  const sessionSecret = options.sessionSecret || randomBytes(32).toString('hex');

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json());
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax'
      }
    })
  );
  app.use(express.static(publicDirectory));

  app.get('/api/auth/session', async (req: Request, res: Response) => {
    const auth = getSessionAuth(req);

    if (!auth || !isTenantKey(auth.tenant)) {
      res.status(204).end();
      return;
    }

    const user = await User.findById(auth.userId).lean();

    if (!user || user.tenant !== auth.tenant) {
      clearSessionAuth(req);
      res.status(204).end();
      return;
    }

    sendAuthPayload(
      res,
      {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      auth.tenant
    );
  });

  app.get('/api/tenants', (_req: Request, res: Response) => {
    res.json({ tenants: Object.values(TENANTS) });
  });

  const tenantRouter = express.Router({ mergeParams: true });
  tenantRouter.use(normalizeTenant);

  tenantRouter.post('/auth/signup', async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant;
    const { username, displayName, password } = req.body as {
      username?: string;
      displayName?: string;
      password?: string;
    };

    if (!tenant || !username || !displayName || !password) {
      res.status(400).json({ message: 'Username, display name, and password are required' });
      return;
    }

    const existingUser = await User.findOne({ tenant, username });

    if (existingUser) {
      res.status(409).json({ message: 'Username already exists for this tenant' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      tenant,
      username,
      displayName,
      role: 'student',
      passwordHash
    });

    setSessionAuth(req, { userId: String(user._id), tenant });
    sendAuthPayload(res, user, tenant);
  });

  tenantRouter.post('/auth/login', async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant;
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!tenant || !username || !password) {
      res.status(400).json({ message: 'Username and password are required' });
      return;
    }

    const user = await User.findOne({ tenant, username });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    setSessionAuth(req, { userId: String(user._id), tenant });
    sendAuthPayload(res, user, tenant);
  });

  tenantRouter.post('/auth/logout', async (req: AuthedRequest, res: Response) => {
    clearSessionAuth(req);

    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  tenantRouter.get('/auth/session', async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const auth = getSessionAuth(req);

    if (!auth || auth.tenant !== tenant) {
      res.status(204).end();
      return;
    }

    const user = await User.findById(auth.userId).lean();

    if (!user || user.tenant !== tenant) {
      clearSessionAuth(req);
      res.status(204).end();
      return;
    }

    sendAuthPayload(
      res,
      {
        _id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      tenant
    );
  });

  tenantRouter.get('/dashboard', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const user = req.currentUser;

    if (!user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    res.json(await buildDashboard(tenant, user));
  });

  tenantRouter.get('/courses/:courseId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser;
    const courseIdParam = req.params.courseId;
    const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;

    if (!actor) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    const dashboard = await buildDashboard(tenant, actor);
    const course = dashboard.courses.find((visibleCourse) => visibleCourse.id === courseId);

    if (!course) {
      const existingCourse = await Course.exists({ tenant, _id: new Types.ObjectId(courseId) });
      res.status(existingCourse ? 403 : 404).json({
        message: existingCourse ? 'You do not have permission to view that course' : 'Course not found for this tenant'
      });
      return;
    }

    res.json({ course });
  });

  tenantRouter.get('/students/:studentId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser;
    const studentIdParam = req.params.studentId;
    const studentId = Array.isArray(studentIdParam) ? studentIdParam[0] : studentIdParam;

    if (!actor) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!studentId || !Types.ObjectId.isValid(studentId)) {
      res.status(400).json({ message: 'Invalid student ID' });
      return;
    }

    const student = await User.findOne({
      tenant,
      _id: new Types.ObjectId(studentId),
      role: 'student'
    }).lean();

    if (!student) {
      res.status(404).json({ message: 'Student not found for this tenant' });
      return;
    }

    const dashboard = await buildDashboard(tenant, actor);
    const visibleCourses = dashboard.courses.filter((course) => (
      course.students.some((courseStudent) => courseStudent.id === studentId) ||
      (actor.role === 'student' && actor.id === studentId && course.membershipRole === 'student')
    ));

    const canViewStudent =
      actor.role === 'admin' ||
      (actor.role === 'student' && actor.id === studentId) ||
      visibleCourses.length > 0;

    if (!canViewStudent) {
      res.status(403).json({ message: 'You do not have permission to view that student' });
      return;
    }

    const logs = visibleCourses.flatMap((course) => (
      course.logs
        .filter((log) => log.student.id === studentId)
        .map((log) => ({
          ...log,
          course: {
            id: course.id,
            code: course.code,
            title: course.title
          }
        }))
    ));

    res.json({
      student: toUserSummary(student),
      courses: visibleCourses.map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title
      })),
      logs
    });
  });

  tenantRouter.get('/logs/:logId', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser;
    const logIdParam = req.params.logId;
    const logId = Array.isArray(logIdParam) ? logIdParam[0] : logIdParam;

    if (!actor) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!logId || !Types.ObjectId.isValid(logId)) {
      res.status(400).json({ message: 'Invalid log ID' });
      return;
    }

    const dashboard = await buildDashboard(tenant, actor);

    for (const course of dashboard.courses) {
      const log = course.logs.find((visibleLog) => visibleLog.id === logId);

      if (log) {
        res.json({
          log: {
            ...log,
            course: {
              id: course.id,
              code: course.code,
              title: course.title,
              membershipRole: course.membershipRole
            }
          }
        });
        return;
      }
    }

    const existingLog = await Log.exists({ tenant, _id: new Types.ObjectId(logId) });
    res.status(existingLog ? 403 : 404).json({
      message: existingLog ? 'You do not have permission to view that log' : 'Log not found for this tenant'
    });
  });

  tenantRouter.post('/users', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser;

    if (!actor) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { username, displayName, password, role, courseId } = req.body as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: string;
      courseId?: string;
    };

    if (!username || !displayName || !password || !role || !isUserRole(role)) {
      res.status(400).json({ message: 'Username, display name, password, and a valid role are required' });
      return;
    }

    if (courseId && !Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    const canCreateRole =
      actor.role === 'admin' ||
      (actor.role === 'teacher' && (role === 'ta' || role === 'student')) ||
      (actor.role === 'ta' && role === 'student');

    if (!canCreateRole) {
      res.status(403).json({ message: 'You do not have permission to create that role' });
      return;
    }

    const existingUser = await User.findOne({ tenant, username });

    if (existingUser) {
      res.status(409).json({ message: 'Username already exists for this tenant' });
      return;
    }

    if (courseId && role !== 'teacher' && !(await canManageCourse(actor, tenant, courseId))) {
      res.status(403).json({ message: 'You cannot add members to that course' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      tenant,
      username,
      displayName,
      role,
      passwordHash
    });

    if (courseId && (role === 'ta' || role === 'student')) {
      await Enrollment.findOneAndUpdate(
        {
          tenant,
          courseId: new Types.ObjectId(courseId),
          userId: newUser._id
        },
        {
          tenant,
          courseId: new Types.ObjectId(courseId),
          userId: newUser._id,
          role
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );
    }

    res.status(201).json({ user: toUserSummary(newUser) });
  });

  tenantRouter.post('/courses', requireAuth, requireRole(['admin', 'teacher']), async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser as NonNullable<AuthedRequest['currentUser']>;
    const { code, title, teacherId } = req.body as {
      code?: string;
      title?: string;
      teacherId?: string;
    };

    if (!code || !title) {
      res.status(400).json({ message: 'Course code and title are required' });
      return;
    }

    const assignedTeacherId = actor.role === 'teacher' ? actor.id : teacherId;

    if (!assignedTeacherId) {
      res.status(400).json({ message: 'A teacher must be assigned to the course' });
      return;
    }

    if (!Types.ObjectId.isValid(assignedTeacherId)) {
      res.status(400).json({ message: 'Invalid teacher ID' });
      return;
    }

    const teacher = await User.findOne({
      _id: new Types.ObjectId(assignedTeacherId),
      tenant,
      role: 'teacher'
    });

    if (!teacher) {
      res.status(404).json({ message: 'Teacher not found for this tenant' });
      return;
    }

    const course = await Course.create({
      tenant,
      code,
      title,
      teacherId: teacher._id,
      createdById: new Types.ObjectId(actor.id)
    });

    await Enrollment.findOneAndUpdate(
      {
        tenant,
        courseId: course._id,
        userId: teacher._id
      },
      {
        tenant,
        courseId: course._id,
        userId: teacher._id,
        role: 'teacher'
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.status(201).json({
      course: {
        id: String(course._id),
        code: course.code,
        title: course.title
      }
    });
  });

  tenantRouter.delete('/courses/:courseId', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const courseIdParam = req.params.courseId;
    const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;

    if (!courseId) {
      res.status(400).json({ message: 'Course is required' });
      return;
    }

    if (!Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    const courseObjectId = new Types.ObjectId(courseId);
    const course = await Course.findOne({ tenant, _id: courseObjectId }).lean();

    if (!course) {
      res.status(404).json({ message: 'Course not found for this tenant' });
      return;
    }

    await deleteCourseRecords(tenant, courseObjectId);
    res.json({ success: true });
  });

  tenantRouter.post('/courses/:courseId/members', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser as NonNullable<AuthedRequest['currentUser']>;
    const courseIdParam = req.params.courseId;
    const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;
    const { username, role } = req.body as {
      username?: string;
      role?: string;
    };

    if (!courseId || !username || !role || !isMembershipRole(role)) {
      res.status(400).json({ message: 'Username and a valid course role are required' });
      return;
    }

    if (!Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    if (!(await canManageCourse(actor, tenant, courseId))) {
      res.status(403).json({ message: 'You cannot manage that course' });
      return;
    }

    if (actor.role === 'ta' && role !== 'student') {
      res.status(403).json({ message: 'TAs can only add students to courses' });
      return;
    }

    const member = await User.findOne({ tenant, username });

    if (!member) {
      res.status(404).json({ message: 'User not found for this tenant' });
      return;
    }

    if (role === 'teacher' && actor.role !== 'admin') {
      res.status(403).json({ message: 'Only admins can assign teachers to courses' });
      return;
    }

    if (role === 'ta' && !(actor.role === 'admin' || actor.role === 'teacher')) {
      res.status(403).json({ message: 'Only admins and teachers can assign TAs to courses' });
      return;
    }

    if (role !== member.role && !(role === 'teacher' && member.role === 'teacher')) {
      res.status(400).json({ message: 'The selected user role does not match the requested course role' });
      return;
    }

    const course = await Course.findOne({ _id: new Types.ObjectId(courseId), tenant });

    if (!course) {
      res.status(404).json({ message: 'Course not found for this tenant' });
      return;
    }

    if (role === 'teacher') {
      course.teacherId = member._id as Types.ObjectId;
      await course.save();
    }

    await Enrollment.findOneAndUpdate(
      {
        tenant,
        courseId: course._id,
        userId: member._id
      },
      {
        tenant,
        courseId: course._id,
        userId: member._id,
        role
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.status(201).json({ user: toUserSummary(member) });
  });

  tenantRouter.post('/courses/:courseId/self-enroll', requireAuth, requireRole(['student']), async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser as NonNullable<AuthedRequest['currentUser']>;
    const courseIdParam = req.params.courseId;
    const courseId = Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;

    if (!courseId) {
      res.status(400).json({ message: 'Course is required' });
      return;
    }

    if (!Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    const course = await Course.findOne({ _id: new Types.ObjectId(courseId), tenant });

    if (!course) {
      res.status(404).json({ message: 'Course not found for this tenant' });
      return;
    }

    await Enrollment.findOneAndUpdate(
      {
        tenant,
        courseId: course._id,
        userId: new Types.ObjectId(actor.id)
      },
      {
        tenant,
        courseId: course._id,
        userId: new Types.ObjectId(actor.id),
        role: 'student'
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.status(201).json({ success: true });
  });

  tenantRouter.delete('/users/:userId', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser as NonNullable<AuthedRequest['currentUser']>;
    const userIdParam = req.params.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;

    if (!userId) {
      res.status(400).json({ message: 'User is required' });
      return;
    }

    if (!Types.ObjectId.isValid(userId)) {
      res.status(400).json({ message: 'Invalid user ID' });
      return;
    }

    if (userId === actor.id) {
      res.status(400).json({ message: 'Admins cannot delete their own account' });
      return;
    }

    const userObjectId = new Types.ObjectId(userId);
    const targetUser = await User.findOne({ tenant, _id: userObjectId });

    if (!targetUser) {
      res.status(404).json({ message: 'User not found for this tenant' });
      return;
    }

    if (targetUser.role === 'admin') {
      const adminCount = await User.countDocuments({ tenant, role: 'admin' });

      if (adminCount <= 1) {
        res.status(409).json({ message: 'At least one admin account must remain for this school' });
        return;
      }
    }

    if (targetUser.role === 'teacher') {
      const assignedCourse = await Course.findOne({
        tenant,
        teacherId: targetUser._id
      }).lean();

      if (assignedCourse) {
        res.status(409).json({ message: 'Delete or reassign this teacher’s courses before deleting the teacher' });
        return;
      }
    }

    await deleteUserRecords(tenant, userObjectId);
    res.json({ success: true });
  });

  tenantRouter.post('/logs', requireAuth, async (req: AuthedRequest, res: Response) => {
    const tenant = req.currentTenant as TenantKey;
    const actor = req.currentUser as NonNullable<AuthedRequest['currentUser']>;
    const { courseId, studentId, text } = req.body as {
      courseId?: string;
      studentId?: string;
      text?: string;
    };

    if (!courseId || !text) {
      res.status(400).json({ message: 'Course and log text are required' });
      return;
    }

    if (!Types.ObjectId.isValid(courseId)) {
      res.status(400).json({ message: 'Invalid course ID' });
      return;
    }

    const course = await Course.findOne({ _id: new Types.ObjectId(courseId), tenant });

    if (!course) {
      res.status(404).json({ message: 'Course not found for this tenant' });
      return;
    }

    let targetStudentId: string | undefined = studentId;

    if (actor.role === 'student') {
      targetStudentId = actor.id;
      const membershipRole = await getMembershipRole(tenant, courseId, actor.id);

      if (membershipRole !== 'student') {
        res.status(403).json({ message: 'You are not enrolled in that course' });
        return;
      }
    } else {
      if (!targetStudentId) {
        res.status(400).json({ message: 'A student must be selected for this log' });
        return;
      }

      if (!(await canManageCourse(actor, tenant, courseId))) {
        res.status(403).json({ message: 'You cannot add logs for that course' });
        return;
      }
    }

    const resolvedTargetStudentId = targetStudentId;

    if (!resolvedTargetStudentId) {
      res.status(400).json({ message: 'A student must be selected for this log' });
      return;
    }

    if (!Types.ObjectId.isValid(resolvedTargetStudentId)) {
      res.status(400).json({ message: 'Invalid student ID' });
      return;
    }

    const targetStudent = await User.findOne({
      _id: new Types.ObjectId(resolvedTargetStudentId),
      tenant,
      role: 'student'
    });

    if (!targetStudent) {
      res.status(404).json({ message: 'Student not found for this tenant' });
      return;
    }

    const studentMembership = await getMembershipRole(tenant, courseId, String(targetStudent._id));

    if (studentMembership !== 'student') {
      res.status(400).json({ message: 'That student is not enrolled in the selected course' });
      return;
    }

    const log = await Log.create({
      tenant,
      courseId: course._id,
      studentId: targetStudent._id,
      authorId: new Types.ObjectId(actor.id),
      text
    });

    res.status(201).json({ id: String(log._id) });
  });

  app.use('/api/:tenant', tenantRouter);

  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(indexFile);
  });

  app.get(/^\/(uvu|uofu)(?:\/.*)?$/, (_req: Request, res: Response) => {
    res.sendFile(indexFile);
  });

  return app;
}
