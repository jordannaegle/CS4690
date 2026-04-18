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
  route: { tenant: null, page: 'landing' }
};

function getRouteState(): RouteState {
  const segments = window.location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { tenant: null, page: 'landing' };
  }

  const [tenantSegment, pageSegment] = segments;

  if (tenantSegment === 'uvu' || tenantSegment === 'uofu') {
    return {
      tenant: tenantSegment,
      page: pageSegment || 'login'
    };
  }

  return { tenant: null, page: 'landing' };
}

function navigate(path: string, replace = false): void {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  void renderRoute();
}

function setFlash(tone: FlashTone, text: string): void {
  state.flash = { tone, text };
}

function clearFlash(): void {
  state.flash = null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

async function fetchSession(tenant: TenantSlug): Promise<SessionPayload | null> {
  return (await apiRequest<SessionPayload | null>(`/api/${tenant}/auth/session`)) ?? null;
}

async function fetchDashboard(tenant: TenantSlug): Promise<DashboardData> {
  return await apiRequest<DashboardData>(`/api/${tenant}/dashboard`);
}

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

function getAppRoot(): HTMLElement {
  const app = document.getElementById('app');

  if (!app) {
    throw new Error('App root not found');
  }

  return app;
}

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

function renderLandingPage(): void {
  renderShell(
    `
      <section class="row g-4 py-4" data-cy="landing_page">
        <div class="col-md-6" data-cy="uvu_tenant_card">
          <article class="card h-100 shadow-sm">
            <div class="card-header d-flex align-items-center gap-3 py-3">
              <img src="/uvu-seal.jpg" alt="Utah Valley University seal" class="campus-seal campus-seal-round">
              <div>
                <p class="eyebrow mb-0">UVU URL</p>
                <h2 class="mb-0 fs-5 fw-bold">/uvu/login</h2>
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
                <p class="eyebrow mb-0">UofU URL</p>
                <h2 class="mb-0 fs-5 fw-bold">/uofu/login</h2>
              </div>
            </div>
            <div class="card-body d-flex flex-column">
              <p class="card-text flex-grow-1">Crimson-themed workspace for the University of Utah with data boundaries enforced by tenant-aware APIs.</p>
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
          <p class="eyebrow">${tenantMeta.shortName} Tenant</p>
          <h1 class="display-6 fw-bold mb-3">${page === 'login' ? 'Welcome back to your course log workspace.' : 'Create your student account.'}</h1>
          <p class="opacity-90 mb-4">${tenantMeta.tagline}. Data stays inside the ${tenantMeta.shortName} tenant only.</p>
          <ul class="list-unstyled d-grid gap-2 mb-0">
            <li class="d-flex align-items-center gap-2"><span class="badge bg-white text-dark">✓</span> Separate URLs and themes for each campus</li>
            <li class="d-flex align-items-center gap-2"><span class="badge bg-white text-dark">✓</span> Role-based dashboards for admins, teachers, TAs, and students</li>
            <li class="d-flex align-items-center gap-2"><span class="badge bg-white text-dark">✓</span> Student self-enrollment plus course-specific logs</li>
          </ul>
        </article>
        <article class="col-md-5" data-cy="${page}_card">
          <div class="card shadow-sm p-4">
            <p class="eyebrow">${page === 'login' ? 'Sign In' : 'Student Signup'}</p>
            <h2 class="fs-4 fw-bold mb-4">${page === 'login' ? 'Log into your tenant' : 'Join this campus workspace'}</h2>
            <form id="${page}Form" class="d-grid gap-3" data-cy="${page}_form">
              ${page === 'signup'
                ? `<div>
                    <label class="form-label fw-bold" for="displayName">Display Name</label>
                    <input id="displayName" name="displayName" type="text" class="form-control" required placeholder="Jamie Student" data-cy="display_name_input">
                  </div>`
                : ''}
              <div>
                <label class="form-label fw-bold" for="username">Username</label>
                <input id="username" name="username" type="text" class="form-control" required placeholder="${tenant === 'uvu' ? 'root_uvu' : 'root_uofu'}" data-cy="username_input">
              </div>
              <div>
                <label class="form-label fw-bold" for="password">Password</label>
                <input id="password" name="password" type="password" class="form-control" required placeholder="Enter password" data-cy="password_input">
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



function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

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
                <ul class="list-unstyled mb-0 small text-muted">${course.students.map((s) => `<li>${escapeHtml(s.displayName)}</li>`).join('') || '<li>None</li>'}</ul>
              </div>
            </div>
          </div>

          ${role !== 'student'
            ? `<form class="mb-3" data-add-member-form data-course-id="${course.id}" data-cy="add_member_form">
                <div class="input-group input-group-sm">
                  <input name="username" type="text" class="form-control" placeholder="Existing username" required data-cy="member_username_input">
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
                      <div class="d-flex justify-content-between align-items-center">
                        <strong class="small" data-cy="log_student">${escapeHtml(log.student.displayName)}</strong>
                        <span class="text-muted small" data-cy="log_date">${formatDate(log.createdAt)}</span>
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
                        placeholder="${role === 'student' ? 'Share what you completed, blocked on, or learned.' : 'Record a progress note for the selected student.'}"></textarea>
            </div>
            <button class="btn btn-primary btn-sm w-100" type="submit" data-cy="save_log_button">Save Log</button>
          </form>

          ${role === 'student' ? '' : `<p class="text-muted small mt-2 mb-0">Tenant URL: /${tenant}/${role}</p>`}
        </div>
      </article>
    </div>
  `).join('');
}

function renderDashboardPage(tenant: TenantSlug, dashboard: DashboardData): void {
  const role = dashboard.user.role;
  const teacherUsers = dashboard.users.filter((user) => user.role === 'teacher');
  const creatableRoleOptions = role === 'admin'
    ? '<option value="teacher">Teacher</option><option value="ta">TA</option><option value="student" selected>Student</option>'
    : role === 'teacher'
      ? '<option value="ta">TA</option><option value="student" selected>Student</option>'
      : '<option value="student" selected>Student</option>';

  renderShell(
    `
      <section class="card tenant-hero rounded-4 p-4 mb-4" data-cy="dashboard_page" data-role="${role}" data-tenant="${tenant}">
        <div class="row align-items-start g-4">
          <div class="col-md-7">
            <p class="eyebrow" data-cy="dashboard_eyebrow">${dashboard.tenant.shortName} ${getRoleLabel(role)} Page</p>
            <h1 class="display-6 fw-bold mb-3" data-cy="dashboard_user_name">${escapeHtml(dashboard.user.displayName)}</h1>
            <p class="opacity-90 mb-0">
              ${role === 'admin'
                ? 'You can oversee every course, log, and non-admin account inside this tenant.'
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
        ${(role === 'admin' || role === 'teacher') ? `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="create_course_panel">
              <p class="eyebrow">Create Course</p>
              <h2 class="fs-5 fw-bold mb-3">New course shell</h2>
              <form id="createCourseForm" class="d-grid gap-3" data-cy="create_course_form">
                <div>
                  <label class="form-label fw-bold small">Course Code</label>
                  <input name="code" type="text" class="form-control" required placeholder="CS 4690" data-cy="course_code_input">
                </div>
                <div>
                  <label class="form-label fw-bold small">Course Title</label>
                  <input name="title" type="text" class="form-control" required placeholder="Advanced Practicum" data-cy="course_title_input">
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
                <button class="btn btn-primary w-100" type="submit" data-cy="create_course_submit">Create Course</button>
              </form>
            </article>
          </div>` : ''}

        ${role !== 'student' ? `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="create_user_panel">
              <p class="eyebrow">Create User</p>
              <h2 class="fs-5 fw-bold mb-3">${role === 'admin' ? 'Create teacher, TA, or student accounts' : role === 'teacher' ? 'Create a TA or student' : 'Create a student'}</h2>
              <form id="createUserForm" class="d-grid gap-3" data-cy="create_user_form">
                <div>
                  <label class="form-label fw-bold small">Display Name</label>
                  <input name="displayName" type="text" class="form-control" required placeholder="Morgan Helper" data-cy="create_user_display_name_input">
                </div>
                <div>
                  <label class="form-label fw-bold small">Username</label>
                  <input name="username" type="text" class="form-control" required placeholder="morgan_helper" data-cy="create_user_username_input">
                </div>
                <div>
                  <label class="form-label fw-bold small">Password</label>
                  <input name="password" type="password" class="form-control" required placeholder="Temporary password" data-cy="create_user_password_input">
                </div>
                <div>
                  <label class="form-label fw-bold small">Role</label>
                  <select name="role" class="form-select" data-cy="create_user_role_select">${creatableRoleOptions}</select>
                </div>
                <div>
                  <label class="form-label fw-bold small">Assign to course (optional)</label>
                  <select name="courseId" class="form-select" data-cy="create_user_course_select">
                    <option value="">No course assignment</option>
                    ${dashboard.courses.map((course) => `<option value="${course.id}">${escapeHtml(course.code)} · ${escapeHtml(course.title)}</option>`).join('')}
                  </select>
                </div>
                <button class="btn btn-primary w-100" type="submit" data-cy="create_user_submit">Create User</button>
              </form>
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
                : '<p class="text-muted small" data-cy="no_available_courses">You are already enrolled in every course visible to this tenant.</p>'}
            </article>
          </div>`}

        ${role === 'admin' ? `
          <div class="col-md-4">
            <article class="card h-100 p-4" data-cy="tenant_directory_panel">
              <p class="eyebrow">Tenant Directory</p>
              <h2 class="fs-5 fw-bold mb-3">Everyone in this campus</h2>
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

  const createCourseForm = document.getElementById('createCourseForm') as HTMLFormElement | null;
  createCourseForm?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(createCourseForm);

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

  const createUserForm = document.getElementById('createUserForm') as HTMLFormElement | null;
  createUserForm?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(createUserForm);

    try {
      await apiRequest(`/api/${tenant}/users`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: String(formData.get('displayName') || '').trim(),
          username: String(formData.get('username') || '').trim(),
          password: String(formData.get('password') || ''),
          role: String(formData.get('role') || ''),
          courseId: String(formData.get('courseId') || '').trim() || undefined
        })
      });
      setFlash('success', 'User created.');
      await refreshDashboard(tenant);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create user';
      setFlash('error', message);
      void renderRoute();
    }
  });

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

async function refreshDashboard(tenant: TenantSlug): Promise<void> {
  state.dashboard = await fetchDashboard(tenant);
  await renderRoute();
}

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
  const session = await fetchSession(tenant);
  state.session = session;

  if (!session) {
    state.dashboard = null;
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
    navigate(session.route, true);
    return;
  }

  state.dashboard = await fetchDashboard(tenant);
  renderDashboardPage(tenant, state.dashboard);
}

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

window.addEventListener('popstate', () => {
  void renderRoute();
});

void renderRoute();
