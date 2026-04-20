import assert from 'node:assert/strict';
import test, { after, before, beforeEach } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request, { SuperAgentTest } from 'supertest';
import { createApp } from '../app.js';
import connectDB from '../db.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Log from '../models/Log.js';
import User from '../models/User.js';
import { ensureSeedData } from '../seed.js';

const app = createApp({ sessionSecret: 'test-secret' });
let mongoServer: MongoMemoryServer;

async function loginAs(agent: SuperAgentTest, tenant: 'uvu' | 'uofu', username: string, password: string) {
  const response = await agent
    .post(`/api/${tenant}/auth/login`)
    .send({ username, password });

  assert.equal(response.status, 200);
  return response;
}

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db?.dropDatabase();
  await ensureSeedData();
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('seeded admins can log into their own tenant only', async () => {
  const uvuResponse = await request(app)
    .post('/api/uvu/auth/login')
    .send({ username: 'root_uvu', password: 'willy' });

  assert.equal(uvuResponse.status, 200);
  assert.equal(uvuResponse.body.user.role, 'admin');
  assert.equal(uvuResponse.body.tenant.slug, 'uvu');

  const wrongTenantResponse = await request(app)
    .post('/api/uofu/auth/login')
    .send({ username: 'root_uvu', password: 'willy' });

  assert.equal(wrongTenantResponse.status, 401);
});

test('session check returns no content instead of 401 when not logged in', async () => {
  const response = await request(app).get('/api/uofu/auth/session');

  assert.equal(response.status, 204);
  assert.equal(response.text, '');
});

test('global session endpoint reports the currently signed-in tenant session', async () => {
  const agent = request.agent(app);

  await loginAs(agent, 'uvu', 'root_uvu', 'willy');

  const response = await agent.get('/api/auth/session');

  assert.equal(response.status, 200);
  assert.equal(response.body.tenant.slug, 'uvu');
  assert.equal(response.body.user.username, 'root_uvu');
  assert.equal(response.body.route, '/uvu/admin');
});

test('tenant admins cannot see each others users, courses, or logs', async () => {
  const uvuAdmin = request.agent(app);
  const uofuAdmin = request.agent(app);

  await loginAs(uvuAdmin, 'uvu', 'root_uvu', 'willy');
  await loginAs(uofuAdmin, 'uofu', 'root_uofu', 'swoopy');

  const createTeacherResponse = await uvuAdmin
    .post('/api/uvu/users')
    .send({
      displayName: 'Taylor Teacher',
      username: 'taylor_teacher',
      password: 'password123',
      role: 'teacher'
    });

  assert.equal(createTeacherResponse.status, 201);

  const teacher = await User.findOne({ tenant: 'uvu', username: 'taylor_teacher' }).lean();
  assert.ok(teacher);

  const createCourseResponse = await uvuAdmin
    .post('/api/uvu/courses')
    .send({
      code: 'CS 4690',
      title: 'Applied Systems Design',
      teacherId: String(teacher._id)
    });

  assert.equal(createCourseResponse.status, 201);

  const uvuDashboard = await uvuAdmin.get('/api/uvu/dashboard');
  const uofuDashboard = await uofuAdmin.get('/api/uofu/dashboard');

  assert.equal(uvuDashboard.status, 200);
  assert.equal(uofuDashboard.status, 200);
  assert.equal(uvuDashboard.body.users.some((user: { username: string }) => user.username === 'taylor_teacher'), true);
  assert.equal(uofuDashboard.body.users.some((user: { username: string }) => user.username === 'taylor_teacher'), false);
  assert.equal(uvuDashboard.body.courses.length, 1);
  assert.equal(uofuDashboard.body.courses.length, 0);
});

test('students can self-enroll and only see their own course logs', async () => {
  const adminAgent = request.agent(app);
  const studentAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Terry Teacher',
    username: 'terry_teacher',
    password: 'teacherpass',
    role: 'teacher'
  });

  const teacher = await User.findOne({ tenant: 'uvu', username: 'terry_teacher' }).lean();
  assert.ok(teacher);

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 2550',
    title: 'Web Development',
    teacherId: String(teacher._id)
  });

  const course = await Course.findOne({ tenant: 'uvu', code: 'CS 2550' }).lean();
  assert.ok(course);

  const signupResponse = await studentAgent.post('/api/uvu/auth/signup').send({
    displayName: 'Casey Student',
    username: 'casey_student',
    password: 'studentpass'
  });

  assert.equal(signupResponse.status, 200);
  assert.equal(signupResponse.body.user.role, 'student');

  const selfEnrollResponse = await studentAgent.post(`/api/uvu/courses/${String(course._id)}/self-enroll`);
  assert.equal(selfEnrollResponse.status, 201);

  const student = await User.findOne({ tenant: 'uvu', username: 'casey_student' }).lean();
  assert.ok(student);

  const enrollment = await Enrollment.findOne({
    tenant: 'uvu',
    courseId: course._id,
    userId: student._id,
    role: 'student'
  }).lean();

  assert.ok(enrollment);

  const addLogResponse = await studentAgent.post('/api/uvu/logs').send({
    courseId: String(course._id),
    text: 'Finished the routing and tenant isolation work.'
  });

  assert.equal(addLogResponse.status, 201);

  const dashboardResponse = await studentAgent.get('/api/uvu/dashboard');
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.courses.length, 1);
  assert.equal(dashboardResponse.body.courses[0].logs.length, 1);
  assert.equal(dashboardResponse.body.courses[0].logs[0].student.username, 'casey_student');

  const storedLogs = await Log.find({ tenant: 'uvu' }).lean();
  assert.equal(storedLogs.length, 1);
});

test('TAs can create students but cannot create another TA', async () => {
  const adminAgent = request.agent(app);
  const teacherAgent = request.agent(app);
  const taAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Jordan Teacher',
    username: 'jordan_teacher',
    password: 'teacherpass',
    role: 'teacher'
  });

  const teacher = await User.findOne({ tenant: 'uvu', username: 'jordan_teacher' }).lean();
  assert.ok(teacher);

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 4600',
    title: 'Secure App Studio',
    teacherId: String(teacher._id)
  });

  const course = await Course.findOne({ tenant: 'uvu', code: 'CS 4600' }).lean();
  assert.ok(course);

  await loginAs(teacherAgent, 'uvu', 'jordan_teacher', 'teacherpass');

  const createTaResponse = await teacherAgent.post('/api/uvu/users').send({
    displayName: 'Robin Assistant',
    username: 'robin_ta',
    password: 'tapass',
    role: 'ta',
    courseId: String(course._id)
  });

  assert.equal(createTaResponse.status, 201);

  await loginAs(taAgent, 'uvu', 'robin_ta', 'tapass');

  const createStudentResponse = await taAgent.post('/api/uvu/users').send({
    displayName: 'New Student',
    username: 'new_student',
    password: 'studentpass',
    role: 'student',
    courseId: String(course._id)
  });

  assert.equal(createStudentResponse.status, 201);

  const createTaAsTaResponse = await taAgent.post('/api/uvu/users').send({
    displayName: 'Forbidden TA',
    username: 'forbidden_ta',
    password: 'tapass',
    role: 'ta',
    courseId: String(course._id)
  });

  assert.equal(createTaAsTaResponse.status, 403);
});

test('admins can delete non-admin users and clean up related student records', async () => {
  const adminAgent = request.agent(app);
  const studentAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');

  const createTeacherResponse = await adminAgent.post('/api/uvu/users').send({
    displayName: 'Delete Me Teacher',
    username: 'delete_teacher',
    password: 'teacherpass',
    role: 'teacher'
  });

  assert.equal(createTeacherResponse.status, 201);

  const deleteTeacher = await User.findOne({ tenant: 'uvu', username: 'delete_teacher' }).lean();
  assert.ok(deleteTeacher);

  const deleteTeacherResponse = await adminAgent.delete(`/api/uvu/users/${String(deleteTeacher._id)}`);
  assert.equal(deleteTeacherResponse.status, 200);

  const teacherAfterDelete = await User.findOne({ tenant: 'uvu', username: 'delete_teacher' }).lean();
  assert.equal(teacherAfterDelete, null);

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Course Teacher',
    username: 'course_teacher',
    password: 'teacherpass',
    role: 'teacher'
  });

  const courseTeacher = await User.findOne({ tenant: 'uvu', username: 'course_teacher' }).lean();
  assert.ok(courseTeacher);

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 4810',
    title: 'Deletion Workflows',
    teacherId: String(courseTeacher._id)
  });

  const course = await Course.findOne({ tenant: 'uvu', code: 'CS 4810' }).lean();
  assert.ok(course);

  const signupResponse = await studentAgent.post('/api/uvu/auth/signup').send({
    displayName: 'Delete Student',
    username: 'delete_student',
    password: 'studentpass'
  });

  assert.equal(signupResponse.status, 200);

  const selfEnrollResponse = await studentAgent.post(`/api/uvu/courses/${String(course._id)}/self-enroll`);
  assert.equal(selfEnrollResponse.status, 201);

  const addLogResponse = await studentAgent.post('/api/uvu/logs').send({
    courseId: String(course._id),
    text: 'This log should be cleaned up when the student is deleted.'
  });

  assert.equal(addLogResponse.status, 201);

  const student = await User.findOne({ tenant: 'uvu', username: 'delete_student' }).lean();
  assert.ok(student);

  const deleteStudentResponse = await adminAgent.delete(`/api/uvu/users/${String(student._id)}`);
  assert.equal(deleteStudentResponse.status, 200);

  const studentAfterDelete = await User.findOne({ tenant: 'uvu', username: 'delete_student' }).lean();
  assert.equal(studentAfterDelete, null);

  const remainingStudentEnrollments = await Enrollment.find({
    tenant: 'uvu',
    userId: student._id
  }).lean();
  assert.equal(remainingStudentEnrollments.length, 0);

  const remainingStudentLogs = await Log.find({
    tenant: 'uvu',
    $or: [{ studentId: student._id }, { authorId: student._id }]
  }).lean();
  assert.equal(remainingStudentLogs.length, 0);
});

test('admins can delete courses and cascade enrollments and logs', async () => {
  const adminAgent = request.agent(app);
  const studentAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Cascade Teacher',
    username: 'cascade_teacher',
    password: 'teacherpass',
    role: 'teacher'
  });

  const teacher = await User.findOne({ tenant: 'uvu', username: 'cascade_teacher' }).lean();
  assert.ok(teacher);

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 4820',
    title: 'Cascade Course',
    teacherId: String(teacher._id)
  });

  const course = await Course.findOne({ tenant: 'uvu', code: 'CS 4820' }).lean();
  assert.ok(course);

  const signupResponse = await studentAgent.post('/api/uvu/auth/signup').send({
    displayName: 'Cascade Student',
    username: 'cascade_student',
    password: 'studentpass'
  });

  assert.equal(signupResponse.status, 200);

  const selfEnrollResponse = await studentAgent.post(`/api/uvu/courses/${String(course._id)}/self-enroll`);
  assert.equal(selfEnrollResponse.status, 201);

  const addLogResponse = await studentAgent.post('/api/uvu/logs').send({
    courseId: String(course._id),
    text: 'This log should disappear when the course is deleted.'
  });

  assert.equal(addLogResponse.status, 201);

  const deleteCourseResponse = await adminAgent.delete(`/api/uvu/courses/${String(course._id)}`);
  assert.equal(deleteCourseResponse.status, 200);

  const courseAfterDelete = await Course.findById(course._id).lean();
  assert.equal(courseAfterDelete, null);

  const remainingEnrollments = await Enrollment.find({
    tenant: 'uvu',
    courseId: course._id
  }).lean();
  assert.equal(remainingEnrollments.length, 0);

  const remainingLogs = await Log.find({
    tenant: 'uvu',
    courseId: course._id
  }).lean();
  assert.equal(remainingLogs.length, 0);
});

test('admins can create and delete another admin while preserving at least one admin', async () => {
  const adminAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');
  const rootAdmin = await User.findOne({ tenant: 'uvu', username: 'root_uvu' }).lean();
  assert.ok(rootAdmin);

  const createAdminResponse = await adminAgent.post('/api/uvu/users').send({
    displayName: 'Second Admin',
    username: 'second_admin',
    password: 'adminpass',
    role: 'admin'
  });

  assert.equal(createAdminResponse.status, 201);

  const secondAdmin = await User.findOne({ tenant: 'uvu', username: 'second_admin' }).lean();
  assert.ok(secondAdmin);

  const deleteAdminResponse = await adminAgent.delete(`/api/uvu/users/${String(secondAdmin._id)}`);
  assert.equal(deleteAdminResponse.status, 200);

  const deletedAdmin = await User.findOne({ tenant: 'uvu', username: 'second_admin' }).lean();
  assert.equal(deletedAdmin, null);

  const selfDeleteResponse = await adminAgent.delete(`/api/uvu/users/${String(rootAdmin._id)}`);
  assert.equal(selfDeleteResponse.status, 400);
});

test('detail endpoints block non-visible course, student, and log URLs', async () => {
  const adminAgent = request.agent(app);
  const teacherOneAgent = request.agent(app);
  const studentOneAgent = request.agent(app);
  const studentTwoAgent = request.agent(app);

  await loginAs(adminAgent, 'uvu', 'root_uvu', 'willy');

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Teacher One',
    username: 'teacher_one',
    password: 'teacherpass',
    role: 'teacher'
  });

  await adminAgent.post('/api/uvu/users').send({
    displayName: 'Teacher Two',
    username: 'teacher_two',
    password: 'teacherpass',
    role: 'teacher'
  });

  const teacherOne = await User.findOne({ tenant: 'uvu', username: 'teacher_one' }).lean();
  const teacherTwo = await User.findOne({ tenant: 'uvu', username: 'teacher_two' }).lean();
  assert.ok(teacherOne);
  assert.ok(teacherTwo);

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 4701',
    title: 'Course One',
    teacherId: String(teacherOne._id)
  });

  await adminAgent.post('/api/uvu/courses').send({
    code: 'CS 4702',
    title: 'Course Two',
    teacherId: String(teacherTwo._id)
  });

  const courseOne = await Course.findOne({ tenant: 'uvu', code: 'CS 4701' }).lean();
  const courseTwo = await Course.findOne({ tenant: 'uvu', code: 'CS 4702' }).lean();
  assert.ok(courseOne);
  assert.ok(courseTwo);

  await studentOneAgent.post('/api/uvu/auth/signup').send({
    displayName: 'Student One',
    username: 'student_one',
    password: 'studentpass'
  });

  await studentTwoAgent.post('/api/uvu/auth/signup').send({
    displayName: 'Student Two',
    username: 'student_two',
    password: 'studentpass'
  });

  const studentOne = await User.findOne({ tenant: 'uvu', username: 'student_one' }).lean();
  const studentTwo = await User.findOne({ tenant: 'uvu', username: 'student_two' }).lean();
  assert.ok(studentOne);
  assert.ok(studentTwo);

  await studentOneAgent.post(`/api/uvu/courses/${String(courseOne._id)}/self-enroll`);
  await studentTwoAgent.post(`/api/uvu/courses/${String(courseTwo._id)}/self-enroll`);

  await studentOneAgent.post('/api/uvu/logs').send({
    courseId: String(courseOne._id),
    text: 'Student one log'
  });

  await studentTwoAgent.post('/api/uvu/logs').send({
    courseId: String(courseTwo._id),
    text: 'Student two log'
  });

  const logOne = await Log.findOne({ tenant: 'uvu', courseId: courseOne._id }).lean();
  const logTwo = await Log.findOne({ tenant: 'uvu', courseId: courseTwo._id }).lean();
  assert.ok(logOne);
  assert.ok(logTwo);

  await loginAs(teacherOneAgent, 'uvu', 'teacher_one', 'teacherpass');

  const ownCourseResponse = await teacherOneAgent.get(`/api/uvu/courses/${String(courseOne._id)}`);
  assert.equal(ownCourseResponse.status, 200);
  assert.equal(ownCourseResponse.body.course.code, 'CS 4701');

  const blockedCourseResponse = await teacherOneAgent.get(`/api/uvu/courses/${String(courseTwo._id)}`);
  assert.equal(blockedCourseResponse.status, 403);

  const ownStudentResponse = await teacherOneAgent.get(`/api/uvu/students/${String(studentOne._id)}`);
  assert.equal(ownStudentResponse.status, 200);
  assert.equal(ownStudentResponse.body.student.username, 'student_one');

  const blockedStudentResponse = await teacherOneAgent.get(`/api/uvu/students/${String(studentTwo._id)}`);
  assert.equal(blockedStudentResponse.status, 403);

  const ownLogResponse = await teacherOneAgent.get(`/api/uvu/logs/${String(logOne._id)}`);
  assert.equal(ownLogResponse.status, 200);
  assert.equal(ownLogResponse.body.log.text, 'Student one log');

  const blockedLogResponse = await teacherOneAgent.get(`/api/uvu/logs/${String(logTwo._id)}`);
  assert.equal(blockedLogResponse.status, 403);
});
