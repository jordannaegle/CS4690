describe('Student Logs Application', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('loads courses in dropdown', () => {
        cy.get('[data-cy="course_select"]')
            .find('option')
            .should('have.length.greaterThan', 1);
    });

    it('shows UVU ID input after course selection', () => {
        cy.get('#uvuIdContainer').should('not.be.visible');
        cy.get('[data-cy="course_select"]').select(1);
        cy.get('#uvuIdContainer').should('be.visible');
    });

    it('fetches logs when valid 8-digit ID entered', () => {
        cy.get('[data-cy="course_select"]').select(1);
        cy.get('[data-cy="uvuId_input"]').type('10111111');
        cy.get('[data-cy="uvuIdDisplay"]').should('contain', '10111111');
        cy.get('[data-cy="logs"]').should('be.visible');
    });

    it('toggles log visibility on click', () => {
        cy.get('[data-cy="course_select"]').select(1);
        cy.get('[data-cy="uvuId_input"]').type('10111111');
        cy.get('[data-cy="logs"] li').first().click();
        cy.get('[data-cy="logs"] li').first().find('pre')
            .should('have.css', 'display', 'none');
    });

    it('enables Add Log button when valid', () => {
        cy.get('[data-cy="course_select"]').select(1);
        cy.get('[data-cy="uvuId_input"]').type('10111111');
        cy.get('[data-cy="add_log_btn"]').should('be.disabled');
        cy.get('[data-cy="log_textarea"]').type('Test log entry');
        cy.get('[data-cy="add_log_btn"]').should('not.be.disabled');
    });

    it('posts new log and appends to list', () => {
        cy.get('[data-cy="course_select"]').select(1);
        cy.get('[data-cy="uvuId_input"]').type('10111111');
        cy.get('[data-cy="log_textarea"]').type('Cypress test log');
        cy.get('[data-cy="add_log_btn"]').click();
        cy.get('[data-cy="logs"] li').last().should('contain', 'Cypress test log');
    });
});
