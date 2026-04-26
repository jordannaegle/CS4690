type TenantSlug = 'uvu' | 'uofu';

const uniqueSuffix = (): string => `${Date.now()}_${Cypress._.random(1000, 9999)}`;

describe('Tenant routing and admin workflows', (): void => {
  beforeEach((): void => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('routes from the landing page into each tenant login page', (): void => {
    cy.visit('/');

    cy.get('[data-cy="landing_page"]').should('be.visible');
    cy.get('[data-cy="open_uvu_button"]').click();
    cy.location('pathname').should('eq', '/uvu/login');
    cy.get('[data-cy="auth_page"]').should('have.attr', 'data-tenant', 'uvu');
    cy.get('body').should('have.attr', 'data-tenant', 'uvu');
    cy.get('[data-cy="seeded_admin_hint"]').should('contain', 'root_uvu / willy');

    cy.get('[data-cy="switch_tenant_button"]').click();
    cy.location('pathname').should('eq', '/uofu/login');
    cy.get('[data-cy="auth_page"]').should('have.attr', 'data-tenant', 'uofu');
    cy.get('body').should('have.attr', 'data-tenant', 'uofu');
    cy.get('[data-cy="seeded_admin_hint"]').should('contain', 'root_uofu / swoopy');
  });

  it('lets a UVU admin use the dedicated create-teacher route and forces re-authentication on UofU URLs', (): void => {
    const suffix = uniqueSuffix();
    const teacherDisplayName = `Teacher ${suffix}`;
    const teacherUsername = `teacher_${suffix}`;

    cy.uiLogin('uvu', 'root_uvu', 'willy');
    cy.location('pathname').should('eq', '/uvu/admin');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-role', 'admin');

    cy.get('[data-cy="open_create_teacher_page_button"]').click();
    cy.location('pathname').should('eq', '/uvu/admin/create-teacher');
    cy.get('[data-cy="create_teacher_page"]').should('be.visible');

    cy.get('[data-cy="create_teacher_form"]').within((): void => {
      cy.get('[data-cy="teacher_display_name_input"]').type(teacherDisplayName);
      cy.get('[data-cy="teacher_username_input"]').type(teacherUsername);
      cy.get('[data-cy="teacher_password_input"]').type('teacherpass');
      cy.get('[data-cy="create_teacher_submit"]').click();
    });

    cy.location('pathname').should('eq', '/uvu/admin/create-teacher');
    cy.get('[data-cy="flash_message"]').should('contain', 'Teacher created.');
    cy.get('[data-cy="teacher_list"]').should('contain', teacherDisplayName);
    cy.get('[data-cy="back_to_role_home_button"]').click();
    cy.location('pathname').should('eq', '/uvu/admin');
    cy.get('[data-cy="tenant_directory"]').should('contain', teacherDisplayName);

    cy.visit('/uofu/admin');
    cy.location('pathname').should('eq', '/uofu/login');
    cy.get('[data-cy="seeded_admin_hint"]').should('contain', 'root_uofu / swoopy');

    cy.visit('/uvu/admin');
    cy.location('pathname').should('eq', '/uvu/admin');
    cy.get('[data-cy="auth_page"]').should('have.attr', 'data-tenant', 'uvu');
    cy.get('[data-cy="seeded_admin_hint"]').should('contain', 'root_uvu / willy');
    cy.get('[data-cy="flash_message"]').should('contain', 'Please sign in to continue.');
  });

  it('logs out non-admin users who manually visit the admin create-teacher route', (): void => {
    const suffix = uniqueSuffix();
    const teacherDisplayName = `Teacher ${suffix}`;
    const teacherUsername = `teacher_${suffix}`;

    cy.apiLogin('uvu', 'root_uvu', 'willy');
    cy.request('POST', '/api/uvu/users', {
      displayName: teacherDisplayName,
      username: teacherUsername,
      password: 'teacherpass',
      role: 'teacher'
    }).its('status').should('eq', 201);
    cy.apiLogout('uvu');

    cy.on('window:before:load', (win): void => {
      cy.stub(win.console, 'warn').as('consoleWarn');
    });

    cy.uiLogin('uvu', teacherUsername, 'teacherpass');
    cy.location('pathname').should('eq', '/uvu/teacher');

    cy.visit('/uvu/admin/create-teacher');
    cy.location('pathname').should('eq', '/uvu/login');
    cy.get('[data-cy="flash_message"]').should('contain', 'Protected route access was denied');
    cy.get('@consoleWarn').should('have.been.called');
  });

  it('logs out a teacher who manually visits another teachers course detail URL', (): void => {
    const suffix = uniqueSuffix();
    const teacherOneName = `Teacher One ${suffix}`;
    const teacherOneUsername = `teacher_one_${suffix}`;
    const teacherTwoName = `Teacher Two ${suffix}`;
    const teacherTwoUsername = `teacher_two_${suffix}`;
    const courseOneCode = `C1${suffix}`;
    const courseTwoCode = `C2${suffix}`;
    let courseTwoId = '';

    cy.apiLogin('uvu', 'root_uvu', 'willy');

    cy.request('POST', '/api/uvu/users', {
      displayName: teacherOneName,
      username: teacherOneUsername,
      password: 'teacherpass',
      role: 'teacher'
    }).then((teacherOneResponse): void => {
      cy.request('POST', '/api/uvu/users', {
        displayName: teacherTwoName,
        username: teacherTwoUsername,
        password: 'teacherpass',
        role: 'teacher'
      }).then((teacherTwoResponse): void => {
        cy.request('POST', '/api/uvu/courses', {
          code: courseOneCode,
          title: `Course One ${suffix}`,
          teacherId: teacherOneResponse.body.user.id
        }).its('status').should('eq', 201);

        cy.request('POST', '/api/uvu/courses', {
          code: courseTwoCode,
          title: `Course Two ${suffix}`,
          teacherId: teacherTwoResponse.body.user.id
        }).then((courseTwoResponse): void => {
          courseTwoId = courseTwoResponse.body.course.id;
        });
      });
    });

    cy.apiLogout('uvu');

    cy.on('window:before:load', (win): void => {
      cy.stub(win.console, 'warn').as('consoleWarn');
    });

    cy.uiLogin('uvu', teacherOneUsername, 'teacherpass');
    cy.location('pathname').should('eq', '/uvu/teacher');

    cy.then(() => {
      cy.visit(`/uvu/teacher/courses/${courseTwoId}`);
      cy.location('pathname').should('eq', '/uvu/login');
      cy.get('[data-cy="flash_message"]').should('contain', 'Protected route access was denied');
      cy.get('@consoleWarn').should('have.been.called');
    });
  });
});
