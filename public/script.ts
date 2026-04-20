type TenantSlug = 'uvu' | 'uofu';
type UserRole = 'admin' | 'teacher' | 'ta' | 'student';
type MembershipRole = 'teacher' | 'ta' | 'student';
type FlashTone = 'success' | 'error' | 'info';

interface TenantMeta {
  slug: TenantSlug;
  shortName: string;
  name: string;
  themeName: string;
}

interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

interface CourseLog {
  id: string;
  text: string;
  createdAt: string;
  author: UserSummary;
  student: UserSummary;
}

interface CourseSummary {
  id: string;
  code: string;
  title: string;
  membershipRole: MembershipRole | null;
  teacher: UserSummary | null;
  teachers: UserSummary[];
  tas: UserSummary[];
  students: UserSummary[];
  logs: CourseLog[];
}

interface DashboardData {
  user: UserSummary;
  tenant: TenantMeta;
  courses: CourseSummary[];
  availableCourses: Array<{
    id: string;
    code: string;
    title: string;
  }>;
  users: UserSummary[];
}

interface CourseDetailPayload {
  course: CourseSummary;
}

interface StudentDetailPayload {
  student: UserSummary;
  courses: Array<{
    id: string;
    code: string;
    title: string;
  }>;
  logs: Array<CourseLog & {
    course: {
      id: string;
      code: string;
      title: string;
    };
  }>;
}

interface LogDetailPayload {
  log: CourseLog & {
    course: {
      id: string;
      code: string;
      title: string;
      membershipRole: MembershipRole | null;
    };
  };
}

interface SessionPayload {
  user: UserSummary;
  tenant: TenantMeta;
  route: string;
}

interface FlashMessage {
  tone: FlashTone;
  text: string;
}

interface RouteState {
  tenant: TenantSlug | null;
  page: string;
  segments: string[];
  pathname: string;
}

const TENANT_THEMES: Record<TenantSlug, {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  background: string;
  panel: string;
  panelAlt: string;
  text: string;
  muted: string;
  hero: string;
  ring: string;
  badge: string;
}> = {
  uvu: {
    accent: '#2f6b3f',
    accentSoft: '#dff3df',
    accentStrong: '#193f26',
    background: '#f5fbf4',
    panel: '#ffffff',
    panelAlt: '#eef7ef',
    text: '#15311f',
    muted: '#5a7260',
    hero: 'linear-gradient(135deg, rgba(47,107,63,0.96), rgba(22,55,31,0.96))',
    ring: 'rgba(47,107,63,0.22)',
    badge: '#bfe3c0'
  },
  uofu: {
    accent: '#b60019',
    accentSoft: '#ffe5e9',
    accentStrong: '#5f0010',
    background: '#fcf7f7',
    panel: '#ffffff',
    panelAlt: '#f8eeee',
    text: '#2e1518',
    muted: '#7b5a60',
    hero: 'linear-gradient(135deg, rgba(182,0,25,0.96), rgba(70,0,10,0.95))',
    ring: 'rgba(182,0,25,0.2)',
    badge: '#ffd3da'
  }
};

const state: {
  flash: FlashMessage | null;
  session: SessionPayload | null;
  dashboard: DashboardData | null;
  route: RouteState;
} = {
  flash: null,
  session: null,
  dashboard: null,
  route: { tenant: null, page: 'landing', segments: [], pathname: window.location.pathname }
};

// Parse the current browser path into a lightweight route object so the SPA can
// decide which screen to render without a client-side router library.
function getRouteState(): RouteState {
  const segments = window.location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { tenant: null, page: 'landing', segments: [], pathname: window.location.pathname };
  }

  const [tenantSegment, ...tenantSegments] = segments;

  if (tenantSegment === 'uvu' || tenantSegment === 'uofu') {
    return {
      tenant: tenantSegment,
      page: tenantSegments[0] || 'login',
      segments: tenantSegments,
      pathname: window.location.pathname
    };
  }

  return { tenant: null, page: 'landing', segments: [], pathname: window.location.pathname };
}

// Move within the SPA using History API updates, then re-render the matching view.
function navigate(path: string, replace = false): void {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  void renderRoute();
}

// Store a transient message that the next render can surface to the user.
function setFlash(tone: FlashTone, text: string): void {
  state.flash = { tone, text };
}

// Clear the current flash message once a view no longer needs to show it.
function clearFlash(): void {
  state.flash = null;
}

// Escape user-controlled text before inserting it into HTML templates to prevent
// markup injection in the client-rendered views.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Wrap fetch with the app's shared JSON defaults and consistent error handling so
// every page can call the API the same way.
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message: string }).message)
      : 'Request failed';
    throw new Error(message);
  }

  return body as T;
}

// Request the session scoped to the school currently shown in the URL.
async function fetchSession(tenant: TenantSlug): Promise<SessionPayload | null> {
  return (await apiRequest<SessionPayload | null>(`/api/${tenant}/auth/session`)) ?? null;
}

// Request whichever school session is currently active so cross-school redirects
// can detect and clear the wrong login.
async function fetchCurrentSession(): Promise<SessionPayload | null> {
  return (await apiRequest<SessionPayload | null>('/api/auth/session')) ?? null;
}

// Load the dashboard payload that powers each role's main workspace.
async function fetchDashboard(tenant: TenantSlug): Promise<DashboardData> {
  return await apiRequest<DashboardData>(`/api/${tenant}/dashboard`);
}

// Load one course detail view when the user opens a course-specific route.
async function fetchCourseDetail(tenant: TenantSlug, courseId: string): Promise<CourseDetailPayload> {
  return await apiRequest<CourseDetailPayload>(`/api/${tenant}/courses/${courseId}`);
}

// Load the visible course and log history for a single student detail page.
async function fetchStudentDetail(tenant: TenantSlug, studentId: string): Promise<StudentDetailPayload> {
  return await apiRequest<StudentDetailPayload>(`/api/${tenant}/students/${studentId}`);
}

// Load one log record plus its linked course/student context for the log detail view.
async function fetchLogDetail(tenant: TenantSlug, logId: string): Promise<LogDetailPayload> {
  return await apiRequest<LogDetailPayload>(`/api/${tenant}/logs/${logId}`);
}

// Toggle the page-level school theme so Bootstrap variables and custom CSS switch
// between neutral, UVU, and UofU branding.
function applyTheme(tenant: TenantSlug | null): void {
  const body = document.body;

  if (!tenant) {
    body.removeAttribute('data-tenant');
    return;
  }

  // Set data-tenant so [data-tenant="uvu"] / [data-tenant="uofu"] CSS rules
  // in styles.css override Bootstrap's --bs-primary and related variables.
  body.setAttribute('data-tenant', tenant);
}

// Resolve the app mount point once and fail loudly if the page shell is incomplete.
function getAppRoot(): HTMLElement {
  const app = document.getElementById('app');

  if (!app) {
    throw new Error('App root not found');
  }

  return app;
}

// Render the shared shell used by every screen, including the header, flash
// message area, and school-aware logout behavior.
function renderShell(content: string, tenant: TenantSlug | null): void {
  const app = getAppRoot();
  const tenantMeta = state.session?.tenant;
  const canSwitchTenant = state.route.tenant !== null;

  const flashClass = state.flash
    ? state.flash.tone === 'error' ? 'alert-danger' : `alert-${state.flash.tone}`
    : null;

  app.innerHTML = `
    <div class="container py-3" data-cy="app_shell">
      <header class="d-flex align-items-center justify-content-between py-2 mb-4 border-bottom" data-cy="app_header">
        <button class="btn btn-link text-decoration-none p-0 d-inline-flex align-items-center gap-2 text-body"
                data-link="/" data-cy="home_link" aria-label="Go to campus selector">
          <span class="brand-mark">
            ${tenant === 'uvu'
              ? `<img src="/uvu-seal.jpg" alt="UVU seal" class="brand-seal brand-seal-round">`
              : tenant === 'uofu'
              ? `<img src="/BlockU_RGB.jpg" alt="University of Utah Block U" class="brand-seal brand-seal-square">`
              : `<span class="switch-mark">C</span>`}
          </span>
          <span class="text-start">
            <span class="eyebrow">${tenantMeta ? tenantMeta.shortName : 'Campus Logs'}</span>
            <span class="d-block fw-bold fs-6">${tenantMeta ? tenantMeta.name : 'Choose your campus workspace'}</span>
          </span>
        </button>
        <nav class="d-flex gap-2" data-cy="top_nav">
          ${canSwitchTenant
            ? `<button class="btn btn-outline-secondary btn-sm" data-link="/${tenant === 'uvu' ? 'uofu' : 'uvu'}/login" data-cy="switch_tenant_button">Switch Campus</button>`
            : ''}
          ${state.session
            ? `<button class="btn btn-primary btn-sm" id="logoutButton" data-cy="logout_button">Log Out</button>`
            : ''}
        </nav>
      </header>
      ${flashClass
        ? `<div class="alert ${flashClass} rounded-3" role="alert" data-cy="flash_message">${escapeHtml(state.flash!.text)}</div>`
        : ''}
      <main data-cy="app_main">
        ${content}
      </main>
    </div>
  `;

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton && tenant) {
    logoutButton.addEventListener('click', async () => {
      await apiRequest(`/api/${tenant}/auth/logout`, { method: 'POST' });
      state.session = null;
      state.dashboard = null;
      setFlash('info', 'You have been signed out.');
      navigate(`/${tenant}/login`, true);
    });
  }
}

// Render the landing page that lets people choose between the two school workspaces.
function renderLandingPage(): void {
  renderShell(
    `
      <section class="row g-4 py-4" data-cy="landing_page">
        <div class="col-md-6" data-cy="uvu_tenant_card">
          <article class="card h-100 shadow-sm">
            <div class="card-header d-flex align-items-center gap-3 py-3">
              <img src="/uvu-seal.jpg" alt="Utah Valley University seal" class="campus-seal campus-seal-round">
              <div>
                <p class="eyebrow mb-0">Utah Valley University</p>
                <h2 class="mb-0 fs-5 fw-bold">UVU Workspace</h2>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <p class="card-text flex-grow-1">Green-first workspace for Utah Valley University with isolated admins, teachers, TAs, students, and courses.</p>
              <button class="btn btn-primary w-100 mt-3" data-link="/uvu/login" data-cy="open_uvu_button"
                      style="background:linear-gradient(135deg,rgba(47,107,63,0.96),rgba(22,55,31,0.96));border:none">
                Open UVU
              </button>
            </div>
          </article>
        </div>
        <div class="col-md-6" data-cy="uofu_tenant_card">
          <article class="card h-100 shadow-sm">
            <div class="card-header d-flex align-items-center gap-3 py-3">
              <img src="/BlockU_RGB.jpg" alt="University of Utah Block U" class="campus-seal campus-seal-square">
              <div>
                <p class="eyebrow mb-0">University of Utah</p>
                <h2 class="mb-0 fs-5 fw-bold">UofU Workspace</h2>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <p class="card-text flex-grow-1">Crimson-themed workspace for the University of Utah with data boundaries enforced by school-aware APIs.</p>
              <button class="btn btn-danger w-100 mt-3" data-link="/uofu/login" data-cy="open_uofu_button"
                      style="background:linear-gradient(135deg,rgba(182,0,25,0.96),rgba(70,0,10,0.95));border:none">
                Open UofU
              </button>
            </div>
          </article>
        </div>
      </section>
    `,
    null
  );
}

// Convert stored role keys into the labels shown throughout the UI.
function getRoleLabel(role: string): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'teacher':
      return 'Teacher';
    case 'ta':
      return 'TA';
    default:
      return 'Student';
  }
}

// Build the canonical home route for a given school and role.
function getRoleHomePath(tenant: TenantSlug, role: UserRole): string {
  return `/${tenant}/${role}`;
}

// Read the second segment of a protected route to identify subpages like detail or
// create screens.
function getSubpage(route: RouteState): string | null {
  return route.segments[1] || null;
}

// Read the third route segment when the current screen points at a specific record.
function getResourceId(route: RouteState): string | null {
  return route.segments[2] || null;
}

// Identify which routes require an authenticated school session before rendering.
function isProtectedRoute(route: RouteState): boolean {
  return route.tenant !== null && route.page !== 'login' && route.page !== 'signup';
}

// Force a clean logout when someone manually enters a protected or cross-school URL
// they should not be able to keep using.
async function forceLogoutForProtectedRoute(targetTenant: TenantSlug, logoutTenant: TenantSlug, reason: string): Promise<void> {
  console.warn(reason);

  try {
    await apiRequest(`/api/${logoutTenant}/auth/logout`, { method: 'POST' });
  } catch {
    // Best effort; we still want to redirect to a clean login page.
  }

  state.session = null;
  state.dashboard = null;
  setFlash('error', 'Protected route access was denied. Please sign in again.');
  navigate(`/${targetTenant}/login`, true);
}

// Handle detail-page fetch failures by distinguishing true permission problems from
// normal load errors so the app can either log the user out or return them home.
async function handleProtectedResourceError(error: unknown, tenant: TenantSlug, role: UserRole): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unable to load the requested page';

  if (message.toLowerCase().includes('permission')) {
    await forceLogoutForProtectedRoute(
      tenant,
      tenant,
      `${tenant.toUpperCase()} ${role} attempted to access a restricted URL: ${state.route.pathname}`
    );
    return;
  }

  setFlash('error', message);
  navigate(getRoleHomePath(tenant, role), true);
}

// Return the role-specific action-page shortcuts that appear in each dashboard.
function getActionLinks(tenant: TenantSlug, role: UserRole): Array<{ label: string; path: string; description: string; dataCy: string }> {
  if (role === 'admin') {
    return [
      { label: 'Create Course', path: `/${tenant}/admin/create-course`, description: 'Set up a new course for this school.', dataCy: 'open_create_course_page_button' },
      { label: 'Create Teacher', path: `/${tenant}/admin/create-teacher`, description: 'Add a teacher account and manage current teachers.', dataCy: 'open_create_teacher_page_button' },
      { label: 'Create TA', path: `/${tenant}/admin/create-ta`, description: 'Add a teaching assistant and assign them to a course if needed.', dataCy: 'open_create_ta_page_button' },
      { label: 'Create Student', path: `/${tenant}/admin/create-student`, description: 'Add a student account and optionally place them in a course.', dataCy: 'open_create_student_page_button' },
      { label: 'Create Admin', path: `/${tenant}/admin/create-admin`, description: 'Manage school administrators for this campus workspace.', dataCy: 'open_create_admin_page_button' }
    ];
  }

  if (role === 'teacher') {
    return [
      { label: 'Create Course', path: `/${tenant}/teacher/create-course`, description: 'Create a new course that you will teach.', dataCy: 'open_create_course_page_button' },
      { label: 'Create TA', path: `/${tenant}/teacher/create-ta`, description: 'Create a TA and connect them to one of your courses.', dataCy: 'open_create_ta_page_button' },
      { label: 'Create Student', path: `/${tenant}/teacher/create-student`, description: 'Create a student and add them to one of your courses.', dataCy: 'open_create_student_page_button' }
    ];
  }

  if (role === 'ta') {
    return [
      { label: 'Create Student', path: `/${tenant}/ta/create-student`, description: 'Create a student and add them to one of your assigned courses.', dataCy: 'open_create_student_page_button' }
    ];
  }

  return [];
}

// Detect route names reserved for the dedicated create pages.
function isActionSubpage(subpage: string | null): boolean {
  return subpage !== null && subpage.startsWith('create-');
}

// Provide copy for the shared account-creation page so one renderer can support
// admins, teachers, TAs, and students.
function getUserPageMeta(targetRole: UserRole): {
  eyebrow: string;
  title: string;
  submitLabel: string;
  listTitle: string;
} {
  switch (targetRole) {
    case 'teacher':
      return {
        eyebrow: 'Teacher Setup',
        title: 'Create a teacher account',
        submitLabel: 'Create Teacher',
        listTitle: 'Current teachers'
      };
    case 'ta':
      return {
        eyebrow: 'TA Setup',
        title: 'Create a TA account',
        submitLabel: 'Create TA',
        listTitle: 'Current TAs'
      };
    case 'admin':
      return {
        eyebrow: 'Admin Setup',
        title: 'Create an admin account',
        submitLabel: 'Create Admin',
        listTitle: 'Current admins'
      };
    default:
      return {
        eyebrow: 'Student Setup',
        title: 'Create a student account',
        submitLabel: 'Create Student',
        listTitle: 'Current students'
      };
  }
}

// Decide whether the current actor must attach the new account to a course. Teachers
// still must place new TAs and students into one of their courses, while admins and
// TAs may leave student assignment empty during creation.
function requiresCourseAssignment(actorRole: UserRole, targetRole: UserRole): boolean {
  return actorRole === 'teacher' && (targetRole === 'ta' || targetRole === 'student');
}

// Render the school-specific login or signup page and wire it to the matching auth
// endpoint so authentication stays inside the selected school.
function renderAuthPage(tenant: TenantSlug, page: 'login' | 'signup'): void {
  const tenantMeta = {
    name: tenant === 'uvu' ? 'Utah Valley University' : 'University of Utah',
    shortName: tenant === 'uvu' ? 'UVU' : 'UofU',
    tagline: tenant === 'uvu' ? 'Course logs across the Wolverine campus' : 'Course logs across the U campus'
  };

  renderShell(
    `
      <section class="row g-4 align-items-start py-4" data-cy="auth_page" data-page="${page}" data-tenant="${tenant}">
        <article class="col-md-7 rounded-4 p-4 tenant-hero" data-cy="auth_hero_panel">
          <p class="eyebrow">${tenantMeta.shortName} School</p>
          <h1 class="display-6 fw-bold mb-3">${page === 'login' ? 'Welcome back to your course log workspace.' : 'Create your student account.'}</h1>
          <p class="opacity-90 mb-0">${tenantMeta.tagline}. Data stays inside the ${tenantMeta.shortName} school only.</p>
        </article>
        <article class="col-md-5" data-cy="${page}_card">
          <div class="card shadow-sm p-4">
            <p class="eyebrow">${page === 'login' ? 'Sign In' : 'Student Signup'}</p>
            <h2 class="fs-4 fw-bold mb-4">${page === 'login' ? 'Log into your school' : 'Join this campus workspace'}</h2>
            <form id="${page}Form" class="d-grid gap-3" data-cy="${page}_form">
              ${page === 'signup'
                ? `<div>
                    <label class="form-label fw-bold" for="displayName">Display Name</label>
                    <input id="displayName" name="displayName" type="text" class="form-control" required placeholder="Display name" data-cy="display_name_input">
                  </div>`
                : ''}
              <div>
                <label class="form-label fw-bold" for="username">Username</label>
                <input id="username" name="username" type="text" class="form-control" required placeholder="Username" data-cy="username_input">
              </div>
              <div>
                <label class="form-label fw-bold" for="password">Password</label>
                <input id="password" name="password" type="password" class="form-control" required placeholder="Password" data-cy="password_input">
              </div>
              <button class="btn btn-primary w-100" type="submit" data-cy="${page}_submit">${page === 'login' ? 'Sign In' : 'Create Student Account'}</button>
            </form>
            <div class="text-muted small mt-3" data-cy="auth_footer">
              ${page === 'login'
                ? `<span>Need a student account?</span> <button class="btn btn-link p-0 fw-bold small" data-link="/${tenant}/signup" data-cy="signup_link">Sign up</button>`
                : `<span>Already have an account?</span> <button class="btn btn-link p-0 fw-bold small" data-link="/${tenant}/login" data-cy="login_link">Sign in</button>`}
            </div>
            ${page === 'login'
              ? `<div class="credential-hint mt-2" data-cy="seeded_admin_hint">
                  <strong>Seeded admins:</strong>
                  <span>${tenant === 'uvu' ? 'root_uvu / willy' : 'root_uofu / swoopy'}</span>
                </div>`
              : ''}
          </div>
        </article>
      </section>
    `,
    tenant
  );

  const form = document.getElementById(`${page}Form`) as HTMLFormElement | null;

  form?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    clearFlash();
    const formData = new FormData(form);

    try {
      const payload = page === 'login'
        ? {
          username: String(formData.get('username') || '').trim(),
          password: String(formData.get('password') || '')
        }
        : {
          displayName: String(formData.get('displayName') || '').trim(),
          username: String(formData.get('username') || '').trim(),
          password: String(formData.get('password') || '')
        };

      const session = await apiRequest<SessionPayload>(`/api/${tenant}/auth/${page}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      state.session = session;
      setFlash('success', page === 'login' ? 'Welcome back.' : 'Student account created.');
      navigate(session.route, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setFlash('error', message);
      void renderRoute();
    }
  });
}

// Attach delete handlers to any user-management buttons on the current screen so
// admin pages can remove accounts and refresh the visible data immediately.
function bindDeleteUserButtons(tenant: TenantSlug): void {
  document.querySelectorAll<HTMLElement>('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.deleteUser;
      const userName = button.dataset.userName || 'this user';

      if (!userId || !window.confirm(`Delete ${userName}? This removes the user and their related logs.`)) {
        return;
      }

      try {
        await apiRequest(`/api/${tenant}/users/${userId}`, {
          method: 'DELETE'
        });
        setFlash('success', 'User deleted.');
        await refreshDashboard(tenant);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete user';
        setFlash('error', message);
        void renderRoute();
      }
    });
  });
}

// Attach delete handlers to course-management buttons so admin course deletions
// also update the current view after the API succeeds.
function bindDeleteCourseButtons(tenant: TenantSlug): void {
  document.querySelectorAll<HTMLElement>('[data-delete-course]').forEach((button) => {
    button.addEventListener('click', async () => {
      const courseId = button.dataset.deleteCourse;
      const courseTitle = button.dataset.courseTitle || 'this course';

      if (!courseId || !window.confirm(`Delete ${courseTitle}? This will also remove all course logs.`)) {
        return;
      }

      try {
        await apiRequest(`/api/${tenant}/courses/${courseId}`, {
          method: 'DELETE'
        });
        setFlash('success', 'Course deleted.');
        await refreshDashboard(tenant);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete course';
        setFlash('error', message);
        void renderRoute();
      }
    });
  });
}

// Render the dedicated course-creation page and pair it with the visible course
// list so admins and teachers can manage course setup from one place.
function renderCreateCoursePage(tenant: TenantSlug, dashboard: DashboardData): void {
  const role = dashboard.user.role;
  const teacherUsers = dashboard.users.filter((user) => user.role === 'teacher');

  renderShell(
    `
      <section class="card p-4 mb-4" data-cy="create_course_page">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p class="eyebrow mb-1">Action Page</p>
            <h1 class="fs-3 fw-bold mb-2">Create Course</h1>
            <p class="text-muted mb-0">${role === 'admin'
              ? 'Create a course for this school and assign the lead teacher right away.'
              : 'Create a course that will appear on your teacher dashboard.'}</p>
          </div>
          <button class="btn btn-outline-secondary" data-link="${getRoleHomePath(tenant, role)}" data-cy="back_to_role_home_button">Back to ${getRoleLabel(role)} Page</button>
        </div>
      </section>

      <section class="row g-4">
        <div class="col-lg-6">
          <article class="card p-4">
            <p class="eyebrow">Course Setup</p>
            <h2 class="fs-4 fw-bold mb-3">New course shell</h2>
            <form id="createCoursePageForm" class="d-grid gap-3" data-cy="create_course_form">
              <div>
                <label class="form-label fw-bold small">Course Code</label>
                <input name="code" type="text" class="form-control" required placeholder="Course code" data-cy="course_code_input">
              </div>
              <div>
                <label class="form-label fw-bold small">Course Title</label>
                <input name="title" type="text" class="form-control" required placeholder="Course title" data-cy="course_title_input">
              </div>
              ${role === 'admin'
                ? `<div>
                    <label class="form-label fw-bold small">Teacher</label>
                    <select name="teacherId" class="form-select" required data-cy="course_teacher_select">
                      <option value="">Select teacher</option>
                      ${teacherUsers.map((teacher) => `<option value="${teacher.id}">${escapeHtml(teacher.displayName)}</option>`).join('')}
                    </select>
                  </div>`
                : ''}
              <button class="btn btn-primary" type="submit" data-cy="create_course_submit">Create Course</button>
            </form>
          </article>
        </div>
        <div class="col-lg-6">
          <article class="card p-4 h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <p class="eyebrow mb-1">Current Courses</p>
                <h2 class="fs-5 fw-bold mb-0">Visible courses</h2>
              </div>
              <span class="badge bg-secondary" data-cy="current_course_count">${dashboard.courses.length}</span>
            </div>
            <ul class="list-group list-group-flush" data-cy="current_courses_list">
              ${dashboard.courses.map((course) => `
                <li class="list-group-item px-0 d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <strong class="d-block">${escapeHtml(course.code)} · ${escapeHtml(course.title)}</strong>
                    <small class="text-muted">Lead instructor: ${course.teacher ? escapeHtml(course.teacher.displayName) : 'Unassigned'}</small>
                  </div>
                  <div class="d-flex flex-column align-items-end gap-2">
                    <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/courses/${course.id}" data-cy="open_course_detail_button">Open Course</button>
                    ${role === 'admin'
                      ? `<button class="btn btn-outline-danger btn-sm" type="button" data-delete-course="${course.id}" data-course-title="${escapeHtml(course.title)}" data-cy="delete_course_button">Delete</button>`
                      : ''}
                  </div>
                </li>
              `).join('') || '<li class="list-group-item px-0 text-muted small">No visible courses yet.</li>'}
            </ul>
          </article>
        </div>
      </section>
    `,
    tenant
  );

  const form = document.getElementById('createCoursePageForm') as HTMLFormElement | null;

  form?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(form);

    try {
      await apiRequest(`/api/${tenant}/courses`, {
        method: 'POST',
        body: JSON.stringify({
          code: String(formData.get('code') || '').trim(),
          title: String(formData.get('title') || '').trim(),
          teacherId: String(formData.get('teacherId') || '').trim() || undefined
        })
      });
      setFlash('success', 'Course created.');
      await refreshDashboard(tenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create course';
      setFlash('error', message);
      void renderRoute();
    }
  });

  bindDeleteCourseButtons(tenant);
}

// Render the shared user-creation page for the selected target role, including the
// optional side list admins use to review and delete existing accounts.
function renderCreateUserPage(tenant: TenantSlug, dashboard: DashboardData, targetRole: UserRole): void {
  const actorRole = dashboard.user.role;
  const meta = getUserPageMeta(targetRole);
  const filteredUsers = dashboard.users.filter((user) => user.role === targetRole);
  const showRoleList = actorRole === 'admin';
  const requireCourse = requiresCourseAssignment(actorRole, targetRole);
  const canAssignCourse = targetRole === 'ta' || targetRole === 'student';
  const pageKey = targetRole === 'admin' ? 'admin' : targetRole;

  renderShell(
    `
      <section class="card p-4 mb-4" data-cy="create_${pageKey}_page">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p class="eyebrow mb-1">Action Page</p>
            <h1 class="fs-3 fw-bold mb-2">${meta.title}</h1>
            <p class="text-muted mb-0">${actorRole === 'admin'
              ? `Create a ${getRoleLabel(targetRole).toLowerCase()} account and manage everyone in that role for this school.`
              : actorRole === 'ta' && targetRole === 'student'
                ? 'Create a student account now and optionally connect the student to one of your assigned courses.'
                : `Create a ${getRoleLabel(targetRole).toLowerCase()} account for one of your available courses.`}</p>
          </div>
          <button class="btn btn-outline-secondary" data-link="${getRoleHomePath(tenant, actorRole)}" data-cy="back_to_role_home_button">Back to ${getRoleLabel(actorRole)} Page</button>
        </div>
      </section>

      <section class="row g-4">
        <div class="${showRoleList ? 'col-lg-6' : 'col-12'}">
          <article class="card p-4 h-100">
            <p class="eyebrow">${meta.eyebrow}</p>
            <h2 class="fs-4 fw-bold mb-3">${meta.title}</h2>
            <form id="create${getRoleLabel(targetRole).replace(/\s+/g, '')}Form" class="d-grid gap-3" data-cy="create_${pageKey}_form">
              <div>
                <label class="form-label fw-bold small">Display Name</label>
                <input name="displayName" type="text" class="form-control" required placeholder="Display name" data-cy="${pageKey}_display_name_input">
              </div>
              <div>
                <label class="form-label fw-bold small">Username</label>
                <input name="username" type="text" class="form-control" required placeholder="Username" data-cy="${pageKey}_username_input">
              </div>
              <div>
                <label class="form-label fw-bold small">Password</label>
                <input name="password" type="password" class="form-control" required placeholder="Password" data-cy="${pageKey}_password_input">
              </div>
              ${canAssignCourse
                ? `<div>
                    <label class="form-label fw-bold small">Assign to course${requireCourse ? '' : ' (optional)'}</label>
                    <select name="courseId" class="form-select" ${requireCourse ? 'required' : ''} data-cy="${pageKey}_course_select">
                      <option value="">${requireCourse ? 'Select course' : 'No course assignment'}</option>
                      ${dashboard.courses.map((course) => `<option value="${course.id}">${escapeHtml(course.code)} · ${escapeHtml(course.title)}</option>`).join('')}
                    </select>
                  </div>`
                : ''}
              <button class="btn btn-primary" type="submit" data-cy="create_${pageKey}_submit">${meta.submitLabel}</button>
            </form>
          </article>
        </div>
        ${showRoleList
          ? `<div class="col-lg-6">
              <article class="card p-4 h-100">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <p class="eyebrow mb-1">Current Accounts</p>
                    <h2 class="fs-5 fw-bold mb-0">${meta.listTitle}</h2>
                  </div>
                  <span class="badge bg-secondary" data-cy="${pageKey}_list_count">${filteredUsers.length}</span>
                </div>
                <ul class="list-group list-group-flush" data-cy="${pageKey}_list">
                  ${filteredUsers.map((user) => `
                    <li class="list-group-item px-0 d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <strong class="d-block">${escapeHtml(user.displayName)}</strong>
                        <small class="text-muted">${escapeHtml(user.username)}</small>
                      </div>
                      ${targetRole === 'admin' && user.id === dashboard.user.id
                        ? '<span class="badge text-bg-secondary">Current you</span>'
                        : `<button class="btn btn-outline-danger btn-sm" type="button" data-delete-user="${user.id}" data-user-name="${escapeHtml(user.displayName)}" data-cy="delete_user_button">Delete</button>`}
                    </li>
                  `).join('') || '<li class="list-group-item px-0 text-muted small">No accounts in this role yet.</li>'}
                </ul>
              </article>
            </div>`
          : ''}
      </section>
    `,
    tenant
  );

  const formId = `create${getRoleLabel(targetRole).replace(/\s+/g, '')}Form`;
  const form = document.getElementById(formId) as HTMLFormElement | null;

  form?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(form);

    try {
      await apiRequest(`/api/${tenant}/users`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: String(formData.get('displayName') || '').trim(),
          username: String(formData.get('username') || '').trim(),
          password: String(formData.get('password') || ''),
          role: targetRole,
          courseId: canAssignCourse ? (String(formData.get('courseId') || '').trim() || undefined) : undefined
        })
      });
      setFlash('success', `${getRoleLabel(targetRole)} created.`);
      await refreshDashboard(tenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to create ${getRoleLabel(targetRole).toLowerCase()}`;
      setFlash('error', message);
      void renderRoute();
    }
  });

  if (showRoleList) {
    bindDeleteUserButtons(tenant);
  }
}

// Render a course detail page that brings roster information and visible logs into
// one route-specific view.
function renderCourseDetailPage(tenant: TenantSlug, role: UserRole, detail: CourseDetailPayload): void {
  const { course } = detail;

  renderShell(
    `
      <section class="card p-4 mb-4" data-cy="course_detail_page" data-course-id="${course.id}">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p class="eyebrow mb-1">Course Detail</p>
            <h1 class="fs-3 fw-bold mb-2">${escapeHtml(course.code)} · ${escapeHtml(course.title)}</h1>
            <p class="text-muted mb-0">Lead instructor: ${course.teacher ? escapeHtml(course.teacher.displayName) : 'Unassigned'}</p>
          </div>
          <button class="btn btn-outline-secondary" data-link="${getRoleHomePath(tenant, role)}" data-cy="back_to_role_home_button">Back to ${getRoleLabel(role)} Page</button>
        </div>
      </section>

      <section class="row g-4">
        <div class="col-lg-5">
          <article class="card p-4 h-100">
            <p class="eyebrow">People</p>
            <h2 class="fs-5 fw-bold mb-3">Course roster</h2>
            <div class="mb-3">
              <h3 class="fs-6 fw-bold">Teachers</h3>
              <ul class="list-group list-group-flush">
                ${course.teachers.map((teacher) => `<li class="list-group-item px-0 small">${escapeHtml(teacher.displayName)}</li>`).join('') || '<li class="list-group-item px-0 small text-muted">None</li>'}
              </ul>
            </div>
            <div class="mb-3">
              <h3 class="fs-6 fw-bold">TAs</h3>
              <ul class="list-group list-group-flush">
                ${course.tas.map((ta) => `<li class="list-group-item px-0 small">${escapeHtml(ta.displayName)}</li>`).join('') || '<li class="list-group-item px-0 small text-muted">None</li>'}
              </ul>
            </div>
            <div>
              <h3 class="fs-6 fw-bold">Students</h3>
              <ul class="list-group list-group-flush" data-cy="course_detail_students">
                ${course.students.map((student) => `
                  <li class="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
                    <span class="small">${escapeHtml(student.displayName)}</span>
                    <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/students/${student.id}" data-cy="open_student_detail_button">Open Student</button>
                  </li>
                `).join('') || '<li class="list-group-item px-0 small text-muted">None</li>'}
              </ul>
            </div>
          </article>
        </div>
        <div class="col-lg-7">
          <article class="card p-4 h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <p class="eyebrow mb-1">Logs</p>
                <h2 class="fs-5 fw-bold mb-0">Visible course activity</h2>
              </div>
              <span class="badge bg-secondary" data-cy="course_detail_log_count">${course.logs.length}</span>
            </div>
            ${course.logs.length > 0
              ? `<ul class="list-group list-group-flush" data-cy="course_detail_logs">
                  ${course.logs.map((log) => `
                    <li class="list-group-item px-0">
                      <div class="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <strong class="d-block small">${escapeHtml(log.student.displayName)}</strong>
                          <span class="d-block text-muted small">${formatDate(log.createdAt)}</span>
                          <p class="mb-1 mt-2 small">${escapeHtml(log.text)}</p>
                          <small class="text-muted">Added by ${escapeHtml(log.author.displayName)}</small>
                        </div>
                        <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/logs/${log.id}" data-cy="open_log_detail_button">Open Log</button>
                      </div>
                    </li>
                  `).join('')}
                </ul>`
              : '<p class="text-muted small mb-0">No logs are visible for this course.</p>'}
          </article>
        </div>
      </section>
    `,
    tenant
  );
}

// Render the student detail page so staff can inspect one student's enrollments and
// log history within the current school.
function renderStudentDetailPage(tenant: TenantSlug, role: UserRole, detail: StudentDetailPayload): void {
  renderShell(
    `
      <section class="card p-4 mb-4" data-cy="student_detail_page" data-student-id="${detail.student.id}">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p class="eyebrow mb-1">Student Detail</p>
            <h1 class="fs-3 fw-bold mb-2">${escapeHtml(detail.student.displayName)}</h1>
            <p class="text-muted mb-0">${escapeHtml(detail.student.username)} · ${getRoleLabel(detail.student.role)}</p>
          </div>
          <button class="btn btn-outline-secondary" data-link="${getRoleHomePath(tenant, role)}" data-cy="back_to_role_home_button">Back to ${getRoleLabel(role)} Page</button>
        </div>
      </section>

      <section class="row g-4">
        <div class="col-lg-4">
          <article class="card p-4 h-100">
            <p class="eyebrow">Courses</p>
            <h2 class="fs-5 fw-bold mb-3">Visible enrollments</h2>
            <ul class="list-group list-group-flush" data-cy="student_detail_courses">
              ${detail.courses.map((course) => `
                <li class="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
                  <span class="small">${escapeHtml(course.code)} · ${escapeHtml(course.title)}</span>
                  <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/courses/${course.id}" data-cy="open_course_detail_button">Open Course</button>
                </li>
              `).join('') || '<li class="list-group-item px-0 small text-muted">No visible courses.</li>'}
            </ul>
          </article>
        </div>
        <div class="col-lg-8">
          <article class="card p-4 h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <div>
                <p class="eyebrow mb-1">Logs</p>
                <h2 class="fs-5 fw-bold mb-0">Visible student log history</h2>
              </div>
              <span class="badge bg-secondary" data-cy="student_detail_log_count">${detail.logs.length}</span>
            </div>
            ${detail.logs.length > 0
              ? `<ul class="list-group list-group-flush" data-cy="student_detail_logs">
                  ${detail.logs.map((log) => `
                    <li class="list-group-item px-0">
                      <div class="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <strong class="d-block small">${escapeHtml(log.course.code)} · ${escapeHtml(log.course.title)}</strong>
                          <span class="d-block text-muted small">${formatDate(log.createdAt)}</span>
                          <p class="mb-1 mt-2 small">${escapeHtml(log.text)}</p>
                          <small class="text-muted">Added by ${escapeHtml(log.author.displayName)}</small>
                        </div>
                        <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/logs/${log.id}" data-cy="open_log_detail_button">Open Log</button>
                      </div>
                    </li>
                  `).join('')}
                </ul>`
              : '<p class="text-muted small mb-0">No visible logs for this student.</p>'}
          </article>
        </div>
      </section>
    `,
    tenant
  );
}

// Render a focused detail page for one log entry along with links back to its
// related course and student pages.
function renderLogDetailPage(tenant: TenantSlug, role: UserRole, detail: LogDetailPayload): void {
  const { log } = detail;

  renderShell(
    `
      <section class="card p-4 mb-4" data-cy="log_detail_page" data-log-id="${log.id}">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p class="eyebrow mb-1">Log Detail</p>
            <h1 class="fs-3 fw-bold mb-2">${escapeHtml(log.course.code)} · ${escapeHtml(log.student.displayName)}</h1>
            <p class="text-muted mb-0">${formatDate(log.createdAt)} · Added by ${escapeHtml(log.author.displayName)}</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary" data-link="/${tenant}/${role}/courses/${log.course.id}" data-cy="back_to_course_detail_button">Back to Course</button>
            <button class="btn btn-outline-secondary" data-link="/${tenant}/${role}/students/${log.student.id}" data-cy="back_to_student_detail_button">Back to Student</button>
          </div>
        </div>
      </section>

      <section class="row g-4">
        <div class="col-lg-4">
          <article class="card p-4 h-100">
            <p class="eyebrow">Context</p>
            <h2 class="fs-5 fw-bold mb-3">Route-linked details</h2>
            <p class="small mb-2"><strong>Course:</strong> ${escapeHtml(log.course.code)} · ${escapeHtml(log.course.title)}</p>
            <p class="small mb-2"><strong>Student:</strong> ${escapeHtml(log.student.displayName)}</p>
            <p class="small mb-0"><strong>Author:</strong> ${escapeHtml(log.author.displayName)}</p>
          </article>
        </div>
        <div class="col-lg-8">
          <article class="card p-4 h-100">
            <p class="eyebrow">Log Body</p>
            <h2 class="fs-5 fw-bold mb-3">Recorded note</h2>
            <p class="mb-0" data-cy="log_detail_text">${escapeHtml(log.text)}</p>
          </article>
        </div>
      </section>
    `,
    tenant
  );
}

// Format timestamps for display using the browser's local date/time settings.
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

// Build the course-card grid used on the dashboard so each role sees the controls,
// roster, and logs appropriate to its permissions.
function renderCourseCards(
  tenant: TenantSlug,
  role: UserRole,
  courses: CourseSummary[]
): string {
  if (courses.length === 0) {
    return `
      <div class="card text-center p-5" data-cy="empty_courses">
        <h3 class="fs-5 fw-bold">No courses yet</h3>
        <p class="text-muted mb-0">${role === 'student'
          ? 'Self-enroll in an available course to start building your timeline.'
          : 'Use the control panel to create a course or add people to one.'}</p>
      </div>
    `;
  }

  return courses.map((course) => `
    <div class="col-md-6 col-xl-4">
      <article class="card h-100" data-cy="course_card" data-course-id="${course.id}" data-course-code="${escapeHtml(course.code)}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2" data-cy="course_header">
            <div>
              <p class="eyebrow mb-0">${escapeHtml(course.code)}</p>
              <h3 class="fs-5 fw-bold mb-0">${escapeHtml(course.title)}</h3>
            </div>
            <div class="d-flex flex-column align-items-end gap-2 ms-2">
              <span class="badge text-bg-primary" data-cy="course_membership">${course.membershipRole ? getRoleLabel(course.membershipRole) : 'Visible'}</span>
              <button class="btn btn-outline-secondary btn-sm" type="button" data-link="/${tenant}/${role}/courses/${course.id}" data-cy="open_course_detail_button">Open Course</button>
              ${role === 'admin'
                ? `<button class="btn btn-outline-danger btn-sm" type="button" data-delete-course="${course.id}" data-course-title="${escapeHtml(course.title)}" data-cy="delete_course_button">Delete Course</button>`
                : ''}
            </div>
          </div>
          <p class="text-muted small mb-3" data-cy="course_teacher">Lead instructor: ${course.teacher ? escapeHtml(course.teacher.displayName) : 'Unassigned'}</p>

          <div class="row g-2 mb-3" data-cy="course_members">
            <div class="col-4" data-cy="teachers_list">
              <div class="card bg-light border-0 p-2 h-100">
                <p class="eyebrow mb-1">Teachers</p>
                <ul class="list-unstyled mb-0 small text-muted">${course.teachers.map((t) => `<li>${escapeHtml(t.displayName)}</li>`).join('') || '<li>None</li>'}</ul>
              </div>
            </div>
            <div class="col-4" data-cy="tas_list">
              <div class="card bg-light border-0 p-2 h-100">
                <p class="eyebrow mb-1">TAs</p>
                <ul class="list-unstyled mb-0 small text-muted">${course.tas.map((m) => `<li>${escapeHtml(m.displayName)}</li>`).join('') || '<li>None</li>'}</ul>
              </div>
            </div>
            <div class="col-4" data-cy="students_list">
              <div class="card bg-light border-0 p-2 h-100">
                <p class="eyebrow mb-1">Students</p>
                <ul class="list-unstyled mb-0 small text-muted">
                  ${course.students.map((student) => `
                    <li>
                      <button class="btn btn-link btn-sm p-0 align-baseline" data-link="/${tenant}/${role}/students/${student.id}" data-cy="student_detail_link">${escapeHtml(student.displayName)}</button>
                    </li>
                  `).join('') || '<li>None</li>'}
                </ul>
              </div>
            </div>
          </div>

          ${role !== 'student'
            ? `<form class="mb-3" data-add-member-form data-course-id="${course.id}" data-cy="add_member_form">
                <div class="input-group input-group-sm">
                  <input name="username" type="text" class="form-control" placeholder="Username" required data-cy="member_username_input">
                  <select name="role" class="form-select" style="max-width:110px" data-cy="member_role_select">
                    ${role === 'admin'
                      ? '<option value="teacher">Teacher</option><option value="ta">TA</option><option value="student" selected>Student</option>'
                      : role === 'teacher'
                        ? '<option value="ta">TA</option><option value="student" selected>Student</option>'
                        : '<option value="student" selected>Student</option>'}
                  </select>
                  <button class="btn btn-outline-secondary btn-sm" type="submit" data-cy="add_member_submit">Add</button>
                </div>
              </form>`
            : ''}

          <div class="mt-2" data-cy="log_section">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h6 class="mb-0 fw-bold">Logs</h6>
              <span class="badge bg-secondary" data-cy="log_count">${course.logs.length}</span>
            </div>
            ${course.logs.length > 0
              ? `<ul class="list-group list-group-flush mb-3" data-cy="log_list">
                  ${course.logs.map((log) => `
                    <li class="list-group-item px-0" data-cy="log_item">
                      <div class="d-flex justify-content-between align-items-start gap-3">
                        <div>
                          <strong class="small" data-cy="log_student">${escapeHtml(log.student.displayName)}</strong>
                          <span class="d-block text-muted small" data-cy="log_date">${formatDate(log.createdAt)}</span>
                        </div>
                        <button class="btn btn-link btn-sm p-0" data-link="/${tenant}/${role}/logs/${log.id}" data-cy="open_log_detail_button">Open Log</button>
                      </div>
                      <p class="mb-1 small" data-cy="log_text">${escapeHtml(log.text)}</p>
                      <small class="text-muted" data-cy="log_author">Added by ${escapeHtml(log.author.displayName)}</small>
                    </li>
                  `).join('')}
                </ul>`
              : '<p class="text-muted small" data-cy="empty_logs">No logs yet for this course.</p>'}
          </div>

          <form data-add-log-form data-course-id="${course.id}" data-cy="add_log_form">
            ${role !== 'student'
              ? `<div class="mb-2">
                  <label class="form-label small fw-bold">Student</label>
                  <select name="studentId" class="form-select form-select-sm" required data-cy="log_student_select">
                    <option value="">Select student</option>
                    ${course.students.map((student) => `<option value="${student.id}">${escapeHtml(student.displayName)}</option>`).join('')}
                  </select>
                </div>`
              : ''}
            <div class="mb-2">
              <label class="form-label small fw-bold">${role === 'student' ? 'Add your progress log' : 'Add a course log'}</label>
              <textarea name="text" rows="2" class="form-control form-control-sm" required data-cy="log_text_input"
                        placeholder="Log text"></textarea>
            </div>
            <button class="btn btn-primary btn-sm w-100" type="submit" data-cy="save_log_button">Save Log</button>
          </form>

          ${role === 'student' ? '' : `<p class="text-muted small mt-2 mb-0">School URL: /${tenant}/${role}</p>`}
        </div>
      </article>
    </div>
  `).join('');
}

// Render the main role dashboard, including action shortcuts, self-enrollment,
// school directory data, and inline course/log controls.
function renderDashboardPage(tenant: TenantSlug, dashboard: DashboardData): void {
  const role = dashboard.user.role;
  const actionLinks = getActionLinks(tenant, role);

  renderShell(
    `
      <section class="card tenant-hero rounded-4 p-4 mb-4" data-cy="dashboard_page" data-role="${role}" data-tenant="${tenant}">
        <div class="row align-items-start g-4">
          <div class="col-md-7">
            <p class="eyebrow" data-cy="dashboard_eyebrow">${dashboard.tenant.shortName} ${getRoleLabel(role)} Page</p>
            <h1 class="display-6 fw-bold mb-3" data-cy="dashboard_user_name">${escapeHtml(dashboard.user.displayName)}</h1>
            <p class="opacity-90 mb-0">
              ${role === 'admin'
                ? 'You can oversee every course, log, and non-admin account inside this school.'
                : role === 'teacher'
                  ? 'Create courses, spin up TAs, add students, and review every log in your classes.'
                  : role === 'ta'
                    ? 'Support your assigned courses, create students, and keep the log stream moving.'
                    : 'Track your enrolled courses, self-enroll into new ones, and keep your own log history current.'}
            </p>
          </div>
          <div class="col-md-5" data-cy="dashboard_stats">
            <div class="row g-3">
              <div class="col-4">
                <div class="card text-center p-3 bg-white bg-opacity-10 border-0 text-white" data-cy="visible_courses_stat">
                  <small class="d-block opacity-75">Courses</small>
                  <strong class="fs-4">${dashboard.courses.length}</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-3 bg-white bg-opacity-10 border-0 text-white" data-cy="visible_logs_stat">
                  <small class="d-block opacity-75">Logs</small>
                  <strong class="fs-4">${dashboard.courses.reduce((total, course) => total + course.logs.length, 0)}</strong>
                </div>
              </div>
              <div class="col-4">
                <div class="card text-center p-3 bg-white bg-opacity-10 border-0 text-white" data-cy="tenant_theme_stat">
                  <small class="d-block opacity-75">Theme</small>
                  <strong class="fs-6">${escapeHtml(dashboard.tenant.themeName)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="row g-4 mb-4">
        ${role !== 'student' ? `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="action_pages_panel">
              <p class="eyebrow">Action Pages</p>
              <h2 class="fs-5 fw-bold mb-3">Choose what to manage</h2>
              <div class="d-grid gap-3">
                ${actionLinks.map((action) => `
                  <button class="btn btn-outline-secondary text-start p-3" data-link="${action.path}" data-cy="${action.dataCy}">
                    <strong class="d-block">${action.label}</strong>
                    <small class="text-muted">${action.description}</small>
                  </button>
                `).join('')}
              </div>
            </article>
          </div>` : `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="self_enroll_panel">
              <p class="eyebrow">Self Enroll</p>
              <h2 class="fs-5 fw-bold mb-3">Add yourself to a course</h2>
              ${dashboard.availableCourses.length > 0
                ? `<div class="d-grid gap-2" data-cy="available_courses_list">
                    ${dashboard.availableCourses.map((course) => `
                      <button class="btn btn-outline-secondary text-start" data-self-enroll="${course.id}" data-cy="self_enroll_button" data-course-code="${escapeHtml(course.code)}">
                        <small class="d-block text-muted" data-cy="available_course_code">${escapeHtml(course.code)}</small>
                        <strong data-cy="available_course_title">${escapeHtml(course.title)}</strong>
                      </button>
                    `).join('')}
                  </div>`
                : '<p class="text-muted small" data-cy="no_available_courses">You are already enrolled in every course visible to this school.</p>'}
            </article>
          </div>`}

        ${role === 'admin' ? `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="tenant_directory_panel">
              <p class="eyebrow">School Directory</p>
              <h2 class="fs-5 fw-bold mb-3">Everyone in this school</h2>
              <ul class="list-group list-group-flush" data-cy="tenant_directory">
                ${dashboard.users.map((user) => `
                  <li class="list-group-item px-0" data-cy="tenant_directory_user">
                    <div class="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <strong class="d-block" data-cy="tenant_directory_name">${escapeHtml(user.displayName)}</strong>
                        <small class="text-muted" data-cy="tenant_directory_role">${getRoleLabel(user.role)} · ${escapeHtml(user.username)}</small>
                      </div>
                      ${user.role === 'admin'
                        ? ''
                        : `<button class="btn btn-outline-danger btn-sm flex-shrink-0" type="button" data-delete-user="${user.id}" data-user-name="${escapeHtml(user.displayName)}" data-cy="delete_user_button">Delete</button>`}
                    </div>
                  </li>
                `).join('')}
              </ul>
            </article>
          </div>` : ''}
      </section>

      <section class="row g-4">
        ${renderCourseCards(tenant, role, dashboard.courses)}
      </section>
    `,
    tenant
  );

  document.querySelectorAll<HTMLElement>('[data-self-enroll]').forEach((button) => {
    button.addEventListener('click', async () => {
      const courseId = button.dataset.selfEnroll;

      if (!courseId) {
        return;
      }

      try {
        await apiRequest(`/api/${tenant}/courses/${courseId}/self-enroll`, {
          method: 'POST'
        });
        setFlash('success', 'You were added to the course.');
        await refreshDashboard(tenant);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to self-enroll';
        setFlash('error', message);
        void renderRoute();
      }
    });
  });
  bindDeleteCourseButtons(tenant);
  bindDeleteUserButtons(tenant);

  document.querySelectorAll<HTMLFormElement>('[data-add-member-form]').forEach((form) => {
    form.addEventListener('submit', async (event: SubmitEvent) => {
      event.preventDefault();
      const courseId = form.dataset.courseId;

      if (!courseId) {
        return;
      }

      const formData = new FormData(form);

      try {
        await apiRequest(`/api/${tenant}/courses/${courseId}/members`, {
          method: 'POST',
          body: JSON.stringify({
            username: String(formData.get('username') || '').trim(),
            role: String(formData.get('role') || '')
          })
        });
        setFlash('success', 'Member added to the course.');
        await refreshDashboard(tenant);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add course member';
        setFlash('error', message);
        void renderRoute();
      }
    });
  });

  document.querySelectorAll<HTMLFormElement>('[data-add-log-form]').forEach((form) => {
    form.addEventListener('submit', async (event: SubmitEvent) => {
      event.preventDefault();
      const courseId = form.dataset.courseId;

      if (!courseId) {
        return;
      }

      const formData = new FormData(form);

      try {
        await apiRequest(`/api/${tenant}/logs`, {
          method: 'POST',
          body: JSON.stringify({
            courseId,
            studentId: String(formData.get('studentId') || '').trim() || undefined,
            text: String(formData.get('text') || '').trim()
          })
        });
        setFlash('success', 'Log saved.');
        await refreshDashboard(tenant);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save log';
        setFlash('error', message);
        void renderRoute();
      }
    });
  });
}

// Re-fetch the current dashboard payload after a mutation so the next render uses
// fresh course, user, and log data from the server.
async function refreshDashboard(tenant: TenantSlug): Promise<void> {
  state.dashboard = await fetchDashboard(tenant);
  await renderRoute();
}

// Resolve the current route, session, and permissions, then choose the correct
// screen to render or redirect for this browser location.
async function renderRoute(): Promise<void> {
  state.route = getRouteState();
  applyTheme(state.route.tenant);

  if (!state.route.tenant) {
    state.session = null;
    state.dashboard = null;
    renderLandingPage();
    return;
  }

  const tenant = state.route.tenant;
  const routeIsProtected = isProtectedRoute(state.route);
  const session = await fetchSession(tenant);
  state.session = session;

  if (!session) {
    state.dashboard = null;

    if (routeIsProtected) {
      const activeSession = await fetchCurrentSession();

      if (activeSession && activeSession.tenant.slug !== tenant) {
        await forceLogoutForProtectedRoute(
          tenant,
          activeSession.tenant.slug,
          `${activeSession.tenant.shortName} user attempted to open ${state.route.pathname} across tenants`
        );
        return;
      }
    }

    if (state.route.page === 'signup') {
      renderAuthPage(tenant, 'signup');
    } else {
      if (state.route.page !== 'login') {
        setFlash('info', 'Please sign in to continue.');
      }
      renderAuthPage(tenant, 'login');
    }
    return;
  }

  if (state.route.page === 'login' || state.route.page === 'signup') {
    navigate(session.route, true);
    return;
  }

  if (state.route.page !== session.user.role) {
    await forceLogoutForProtectedRoute(
      tenant,
      tenant,
      `${tenant.toUpperCase()} ${session.user.role} attempted to access ${state.route.pathname}`
    );
    return;
  }

  const subpage = getSubpage(state.route);
  const resourceId = getResourceId(state.route);

  if ((session.user.role === 'admin' || session.user.role === 'teacher') && subpage === 'create-course') {
    state.dashboard = await fetchDashboard(tenant);
    renderCreateCoursePage(tenant, state.dashboard);
    return;
  }

  if (session.user.role === 'admin' && subpage === 'create-teacher') {
    state.dashboard = await fetchDashboard(tenant);
    renderCreateUserPage(tenant, state.dashboard, 'teacher');
    return;
  }

  if ((session.user.role === 'admin' || session.user.role === 'teacher') && subpage === 'create-ta') {
    state.dashboard = await fetchDashboard(tenant);
    renderCreateUserPage(tenant, state.dashboard, 'ta');
    return;
  }

  if ((session.user.role === 'admin' || session.user.role === 'teacher' || session.user.role === 'ta') && subpage === 'create-student') {
    state.dashboard = await fetchDashboard(tenant);
    renderCreateUserPage(tenant, state.dashboard, 'student');
    return;
  }

  if (session.user.role === 'admin' && subpage === 'create-admin') {
    state.dashboard = await fetchDashboard(tenant);
    renderCreateUserPage(tenant, state.dashboard, 'admin');
    return;
  }

  if (subpage === 'courses' && resourceId) {
    state.dashboard = await fetchDashboard(tenant);

    try {
      const detail = await fetchCourseDetail(tenant, resourceId);
      renderCourseDetailPage(tenant, session.user.role, detail);
    } catch (error) {
      await handleProtectedResourceError(error, tenant, session.user.role);
    }
    return;
  }

  if (subpage === 'students' && resourceId) {
    state.dashboard = await fetchDashboard(tenant);

    try {
      const detail = await fetchStudentDetail(tenant, resourceId);
      renderStudentDetailPage(tenant, session.user.role, detail);
    } catch (error) {
      await handleProtectedResourceError(error, tenant, session.user.role);
    }
    return;
  }

  if (subpage === 'logs' && resourceId) {
    state.dashboard = await fetchDashboard(tenant);

    try {
      const detail = await fetchLogDetail(tenant, resourceId);
      renderLogDetailPage(tenant, session.user.role, detail);
    } catch (error) {
      await handleProtectedResourceError(error, tenant, session.user.role);
    }
    return;
  }

  if (isActionSubpage(subpage)) {
    await forceLogoutForProtectedRoute(
      tenant,
      tenant,
      `${tenant.toUpperCase()} ${session.user.role} attempted to access unavailable action page ${state.route.pathname}`
    );
    return;
  }

  if (state.route.segments.length > 1) {
    setFlash('info', 'That page was not found, so we returned you to your workspace.');
    navigate(session.route, true);
    return;
  }

  state.dashboard = await fetchDashboard(tenant);
  renderDashboardPage(tenant, state.dashboard);
}

// Intercept clicks on elements marked with data-link so navigation stays inside the
// single-page app instead of triggering full page reloads.
document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  const linkTarget = target?.closest<HTMLElement>('[data-link]');

  if (!linkTarget) {
    return;
  }

  event.preventDefault();
  const href = linkTarget.dataset.link;

  if (href) {
    navigate(href);
  }
});

// Re-render the SPA when the user navigates with the browser's back/forward buttons.
window.addEventListener('popstate', () => {
  void renderRoute();
});

// Kick off the initial route render as soon as the script finishes loading.
void renderRoute();
