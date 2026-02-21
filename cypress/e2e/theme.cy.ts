interface MockMediaQueryResult {
    matches: boolean;
    addEventListener: () => void;
    removeEventListener: () => void;
}

describe('Theme Light/Dark Mode', (): void => {
    // Helper function to mock matchMedia with specific preference
    const mockMatchMedia = (win: Cypress.AUTWindow, prefersDark: boolean): void => {
        cy.stub(win, 'matchMedia').callsFake((query: string): MockMediaQueryResult => {
            if (query === '(prefers-color-scheme: dark)') {
                return {
                    matches: prefersDark,
                    addEventListener: (): void => { },
                    removeEventListener: (): void => { }
                };
            }
            if (query === '(prefers-color-scheme: light)') {
                return {
                    matches: !prefersDark,
                    addEventListener: (): void => { },
                    removeEventListener: (): void => { }
                };
            }
            return { matches: false, addEventListener: (): void => { }, removeEventListener: (): void => { } };
        });
    };

    beforeEach((): void => {
        // Clear all browser data before each test
        cy.clearLocalStorage();
        cy.clearCookies();
    });

    describe('Default behavior (no user preference, OS light)', (): void => {
        it('defaults to light mode when no user preference and OS prefers light', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.clear();
                    mockMatchMedia(win, false); // OS prefers light
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'light');
            cy.get('#themeToggle').should('contain', '🌙');
        });

        it('defaults to dark mode when no user preference and OS prefers dark', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.clear();
                    mockMatchMedia(win, true); // OS prefers dark
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
            cy.get('#themeToggle').should('contain', '☀️');
        });
    });

    describe('User manual toggle', (): void => {
        beforeEach((): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.clear();
                    mockMatchMedia(win, false); // Start with OS light
                }
            });
        });

        it('toggles to dark mode when button clicked', (): void => {
            cy.get('#themeToggle').click();
            cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
            cy.get('#themeToggle').should('contain', '☀️');
        });

        it('toggles back to light mode on second click', (): void => {
            cy.get('#themeToggle').click(); // to dark
            cy.get('#themeToggle').click(); // back to light
            cy.get('html').should('have.attr', 'data-bs-theme', 'light');
            cy.get('#themeToggle').should('contain', '🌙');
        });

        it('saves user preference to localStorage', (): void => {
            cy.get('#themeToggle').click();
            cy.window().then((win: Cypress.AUTWindow): void => {
                expect(win.localStorage.getItem('theme')).to.equal('dark');
            });
        });
    });

    describe('User preference persistence', (): void => {
        it('persists dark preference across page reloads', (): void => {
            // First visit - set to dark
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.setItem('theme', 'dark');
                    mockMatchMedia(win, false);
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
        });

        it('persists light preference across page reloads', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.setItem('theme', 'light');
                    mockMatchMedia(win, true); // OS wants dark, but user set light
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'light');
        });
    });

    describe('User preference overrides OS preference', (): void => {
        it('user light preference overrides OS dark preference', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.setItem('theme', 'light');
                    mockMatchMedia(win, true); // OS prefers dark
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'light');
        });

        it('user dark preference overrides OS light preference', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.setItem('theme', 'dark');
                    mockMatchMedia(win, false); // OS prefers light
                }
            });
            cy.get('html').should('have.attr', 'data-bs-theme', 'dark');
        });
    });

    describe('Logo switching', (): void => {
        it('uses light seal in dark mode', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.clear();
                    mockMatchMedia(win, false);
                }
            });
            cy.get('#themeToggle').click();
            cy.get('#uvuLogo').should('have.attr', 'src', 'uvu-seal-light.jpg');
        });

        it('uses dark seal in light mode', (): void => {
            cy.visit('/', {
                onBeforeLoad(win: Cypress.AUTWindow): void {
                    win.localStorage.clear();
                    mockMatchMedia(win, false);
                }
            });
            cy.get('#uvuLogo').should('have.attr', 'src', 'uvu-seal.jpg');
        });
    });
});
