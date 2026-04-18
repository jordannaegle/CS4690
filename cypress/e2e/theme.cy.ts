const uniqueSuffix = (): string => `${Date.now()}_${Cypress._.random(1000, 9999)}`;

describe('Role pages and student flows', (): void => {
  beforeEach((): void => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('lets a student sign up, self-enroll, and add a personal log', (): void => {
    const suffix = uniqueSuffix();
    const teacherDisplayName = `Teacher ${suffix}`;
    const teacherUsername = `teacher_${suffix}`;
    const courseCode = `STU${suffix}`;
    const courseTitle = `Student Flow ${suffix}`;
    const studentDisplayName = `Student ${suffix}`;
    const studentUsername = `student_${suffix}`;
    const logText = `Completed self-enrollment flow ${suffix}`;

    cy.apiLogin('uvu', 'root_uvu', 'willy').then((loginResponse): void => {
      expect(loginResponse.status).to.eq(200);
    });

    cy.request('POST', '/api/uvu/users', {
      displayName: teacherDisplayName,
      username: teacherUsername,
      password: 'teacherpass',
      role: 'teacher'
    }).then((userResponse): void => {
      expect(userResponse.status).to.eq(201);
      cy.request('POST', '/api/uvu/courses', {
        code: courseCode,
        title: courseTitle,
        teacherId: userResponse.body.user.id
      }).its('status').should('eq', 201);
    });

    cy.apiLogout('uvu');
    cy.clearCookies();

    cy.visit('/uvu/signup');
    cy.get('[data-cy="signup_form"]').within((): void => {
      cy.get('[data-cy="display_name_input"]').type(studentDisplayName);
      cy.get('[data-cy="username_input"]').type(studentUsername);
      cy.get('[data-cy="password_input"]').type('studentpass');
      cy.get('[data-cy="signup_submit"]').click();
    });

    cy.location('pathname').should('eq', '/uvu/student');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-role', 'student');
    cy.get('[data-cy="available_courses_list"]').within((): void => {
      cy.get(`[data-cy="self_enroll_button"][data-course-code="${courseCode}"]`).click();
    });

    cy.get('[data-cy="flash_message"]').should('contain', 'You were added to the course.');
    cy.get(`[data-cy="course_card"][data-course-code="${courseCode}"]`).within((): void => {
      cy.get('[data-cy="log_text_input"]').type(logText);
      cy.get('[data-cy="save_log_button"]').click();
      cy.get('[data-cy="log_item"]').first().should('contain', logText);
      cy.get('[data-cy="log_student"]').first().should('contain', studentDisplayName);
    });
  });

  it('gives teachers and TAs the correct role-specific controls', (): void => {
    const suffix = uniqueSuffix();
    const teacherDisplayName = `Teacher ${suffix}`;
    const teacherUsername = `teacher_${suffix}`;
    const teacherPassword = 'teacherpass';
    const taDisplayName = `TA ${suffix}`;
    const taUsername = `ta_${suffix}`;
    const taPassword = 'tapass';
    const studentDisplayName = `TA Student ${suffix}`;
    const studentUsername = `ta_student_${suffix}`;
    const courseCode = `ROLE${suffix}`;
    const courseTitle = `Role Course ${suffix}`;

    cy.apiLogin('uvu', 'root_uvu', 'willy');

    cy.request('POST', '/api/uvu/users', {
      displayName: teacherDisplayName,
      username: teacherUsername,
      password: teacherPassword,
      role: 'teacher'
    }).then((teacherResponse): void => {
      expect(teacherResponse.status).to.eq(201);
      cy.request('POST', '/api/uvu/courses', {
        code: courseCode,
        title: courseTitle,
        teacherId: teacherResponse.body.user.id
      }).its('status').should('eq', 201);
    });

    cy.apiLogout('uvu');
    cy.clearCookies();

    cy.uiLogin('uvu', teacherUsername, teacherPassword);
    cy.location('pathname').should('eq', '/uvu/teacher');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-role', 'teacher');

    cy.get('[data-cy="create_user_form"]').within((): void => {
      cy.get('[data-cy="create_user_display_name_input"]').type(taDisplayName);
      cy.get('[data-cy="create_user_username_input"]').type(taUsername);
      cy.get('[data-cy="create_user_password_input"]').type(taPassword);
      cy.get('[data-cy="create_user_role_select"]').select('ta');
      cy.get('[data-cy="create_user_course_select"]').select(`${courseCode} · ${courseTitle}`);
      cy.get('[data-cy="create_user_submit"]').click();
    });

    cy.get('[data-cy="flash_message"]').should('contain', 'User created.');
    cy.get(`[data-cy="course_card"][data-course-code="${courseCode}"] [data-cy="tas_list"]`).should('contain', taDisplayName);
    cy.get('[data-cy="create_course_panel"]').should('be.visible');

    cy.get('[data-cy="logout_button"]').click();
    cy.uiLogin('uvu', taUsername, taPassword);

    cy.location('pathname').should('eq', '/uvu/ta');
    cy.get('[data-cy="dashboard_page"]').should('have.attr', 'data-role', 'ta');
    cy.get('[data-cy="create_course_panel"]').should('not.exist');
    cy.get('[data-cy="create_user_role_select"] option').should('have.length', 1);
    cy.get('[data-cy="create_user_role_select"]').should('have.value', 'student');

    cy.get('[data-cy="create_user_form"]').within((): void => {
      cy.get('[data-cy="create_user_display_name_input"]').type(studentDisplayName);
      cy.get('[data-cy="create_user_username_input"]').type(studentUsername);
      cy.get('[data-cy="create_user_password_input"]').type('studentpass');
      cy.get('[data-cy="create_user_course_select"]').select(`${courseCode} · ${courseTitle}`);
      cy.get('[data-cy="create_user_submit"]').click();
    });

    cy.get('[data-cy="flash_message"]').should('contain', 'User created.');
    cy.get(`[data-cy="course_card"][data-course-code="${courseCode}"] [data-cy="students_list"]`).should('contain', studentDisplayName);
  });
});
