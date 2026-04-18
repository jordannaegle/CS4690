type TenantSlug = 'uvu' | 'uofu';

declare global {
  namespace Cypress {
    interface Chainable {
      apiLogin(tenant: TenantSlug, username: string, password: string): Chainable<Response<any>>;
      uiLogin(tenant: TenantSlug, username: string, password: string): Chainable<void>;
      apiLogout(tenant: TenantSlug): Chainable<Response<any>>;
    }
  }
}

Cypress.Commands.add('apiLogin', (tenant: TenantSlug, username: string, password: string) => {
  return cy.request('POST', `/api/${tenant}/auth/login`, { username, password });
});

Cypress.Commands.add('uiLogin', (tenant: TenantSlug, username: string, password: string) => {
  cy.visit(`/${tenant}/login`);
  cy.get('[data-cy="login_form"]').should('be.visible');
  cy.get('[data-cy="username_input"]').clear().type(username);
  cy.get('[data-cy="password_input"]').clear().type(password);
  cy.get('[data-cy="login_submit"]').click();
});

Cypress.Commands.add('apiLogout', (tenant: TenantSlug) => {
  return cy.request('POST', `/api/${tenant}/auth/logout`);
});

export { };
