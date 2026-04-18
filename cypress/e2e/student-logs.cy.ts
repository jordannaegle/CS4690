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
    cy.get('[data-cy="enter_uvu_button"]').click();
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

  it('lets a UVU admin create a teacher and course while keeping them out of UofU', (): void => {
    const suffix = uniqueSuffix();
    const teacherDisplayName = `Teacher ${suffix}`;
    const teacherUsername = `teacher_${suffix}`;
    const courseCode = `CYP${suffix}`;
    const courseTitle = `Course ${suffix}`;

    cy.uiLogin('uvu', 'root_uvu', 'willy');
    cy.location('pathname').should('eq', '/uvu/admin');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-role', 'admin');

    cy.get('[data-cy="create_user_form"]').within((): void => {
      cy.get('[data-cy="create_user_display_name_input"]').type(teacherDisplayName);
      cy.get('[data-cy="create_user_username_input"]').type(teacherUsername);
      cy.get('[data-cy="create_user_password_input"]').type('teacherpass');
      cy.get('[data-cy="create_user_role_select"]').select('teacher');
      cy.get('[data-cy="create_user_submit"]').click();
    });

    cy.get('[data-cy="flash_message"]').should('contain', 'User created.');

    cy.get('[data-cy="create_course_form"]').within((): void => {
      cy.get('[data-cy="course_code_input"]').type(courseCode);
      cy.get('[data-cy="course_title_input"]').type(courseTitle);
      cy.get('[data-cy="course_teacher_select"]').select(teacherDisplayName);
      cy.get('[data-cy="create_course_submit"]').click();
    });

    cy.get('[data-cy="flash_message"]').should('contain', 'Course created.');
    cy.get(`[data-cy="course_card"][data-course-code="${courseCode}"]`).should('be.visible');
    cy.get('[data-cy="tenant_directory"]').should('contain', teacherDisplayName);

    cy.get('[data-cy="logout_button"]').click();
    cy.location('pathname').should('eq', '/uvu/login');

    cy.uiLogin('uofu', 'root_uofu', 'swoopy');
    cy.location('pathname').should('eq', '/uofu/admin');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-tenant', 'uofu');
    cy.get(`[data-cy="course_card"][data-course-code="${courseCode}"]`).should('not.exist');
    cy.get('[data-cy="tenant_directory"]').should('not.contain', teacherDisplayName);
  });
});
