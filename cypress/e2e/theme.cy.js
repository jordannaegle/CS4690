describe('Theme Light/Dark Mode', () => {
    // Helper function to mock matchMedia with specific preference
    const mockMatchMedia = (win, prefersDark) => {
        cy.stub(win, 'matchMedia').callsFake((query) => {
            if (query === '(prefers-color-scheme: dark)') {
                return {
                    matches: prefersDark,
                    addEventListener: () => { },
                    removeEventListener: () => { }
                };
            }
            if (query === '(prefers-color-scheme: light)') {
                return {
                    matches: !prefersDark,
                    addEventListener: () => { },
                    removeEventListener: () => { }
                };
            }
            return { matches: false, addEventListener: () => { }, removeEventListener: () => { } };
        });
    };

    beforeEach(() => {
        // Clear all browser data before each test
        cy.clearLocalStorage();
        cy.clearCookies();
    });

    describe('Default behavior (no user preference, OS light)', () => {
        it('defaults to light mode when no user preference and OS prefers light', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.clear();
                    mockMatchMedia(win, false); // OS prefers light
                }
            });
            cy.get('body').should('not.have.class', 'dark-mode');
            cy.get('#themeToggle').should('contain', '🌙');
        });

        it('defaults to dark mode when no user preference and OS prefers dark', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.clear();
                    mockMatchMedia(win, true); // OS prefers dark
                }
            });
            cy.get('body').should('have.class', 'dark-mode');
            cy.get('#themeToggle').should('contain', '☀️');
        });
    });

    describe('User manual toggle', () => {
        beforeEach(() => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.clear();
                    mockMatchMedia(win, false); // Start with OS light
                }
            });
        });

        it('toggles to dark mode when button clicked', () => {
            cy.get('#themeToggle').click();
            cy.get('body').should('have.class', 'dark-mode');
            cy.get('#themeToggle').should('contain', '☀️');
        });

        it('toggles back to light mode on second click', () => {
            cy.get('#themeToggle').click(); // to dark
            cy.get('#themeToggle').click(); // back to light
            cy.get('body').should('not.have.class', 'dark-mode');
            cy.get('#themeToggle').should('contain', '🌙');
        });

        it('saves user preference to localStorage', () => {
            cy.get('#themeToggle').click();
            cy.window().then((win) => {
                expect(win.localStorage.getItem('theme')).to.equal('dark');
            });
        });
    });

    describe('User preference persistence', () => {
        it('persists dark preference across page reloads', () => {
            // First visit - set to dark
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.setItem('theme', 'dark');
                    mockMatchMedia(win, false);
                }
            });
            cy.get('body').should('have.class', 'dark-mode');
        });

        it('persists light preference across page reloads', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.setItem('theme', 'light');
                    mockMatchMedia(win, true); // OS wants dark, but user set light
                }
            });
            cy.get('body').should('not.have.class', 'dark-mode');
        });
    });

    describe('User preference overrides OS preference', () => {
        it('user light preference overrides OS dark preference', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.setItem('theme', 'light');
                    mockMatchMedia(win, true); // OS prefers dark
                }
            });
            cy.get('body').should('not.have.class', 'dark-mode');
        });

        it('user dark preference overrides OS light preference', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.setItem('theme', 'dark');
                    mockMatchMedia(win, false); // OS prefers light
                }
            });
            cy.get('body').should('have.class', 'dark-mode');
        });
    });

    describe('Logo switching', () => {
        it('uses light seal in dark mode', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.clear();
                    mockMatchMedia(win, false);
                }
            });
            cy.get('#themeToggle').click();
            cy.get('#uvuLogo').should('have.attr', 'src', 'uvu-seal-light.jpg');
        });

        it('uses dark seal in light mode', () => {
            cy.visit('/', {
                onBeforeLoad(win) {
                    win.localStorage.clear();
                    mockMatchMedia(win, false);
                }
            });
            cy.get('#uvuLogo').should('have.attr', 'src', 'uvu-seal.jpg');
        });
    });
});
