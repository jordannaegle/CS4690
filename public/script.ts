// Type for a course from the API
interface Course {
    id: string;
    display: string;
}

// Type for a log entry from the API
interface LogEntry {
    courseId: string;
    uvuId: string;
    date: string;
    text: string;
    id?: string;
}

// Wait for DOM to be fully ready before running any jQuery selectors or logic
$(document).ready((): void => {

    // Grab necessary document elements using jQuery
    const $courseSelect = $('#course');
    const $uvuIdContainer = $('#uvuIdContainer');
    const $uvuIdInput = $('#uvuId');
    const $logsSection = $('#logsSection');
    const $uvuIdDisplay = $('#uvuIdDisplay');
    const $logList = $('ul[data-cy="logs"]');
    const $addLogTextarea = $('#addLogTextarea');
    const $addLogBtn = $('#addLogBtn');

    // Theme Toggle Elements
    const $themeToggle = $('#themeToggle');
    const $uvuLogo = $('#uvuLogo');

    // Theme Toggle Logic
    function setTheme(isDark: boolean): void {
        if (isDark) {
            $('html').attr('data-bs-theme', 'dark');
            $themeToggle.text('☀️');
            $uvuLogo.attr('src', 'uvu-seal-light.jpg');
            localStorage.setItem('theme', 'dark');
        } else {
            $('html').attr('data-bs-theme', 'light');
            $themeToggle.text('🌙');
            $uvuLogo.attr('src', 'uvu-seal.jpg');
            localStorage.setItem('theme', 'light');
        }
    }

    // Detect theme preferences from various sources
    function detectThemePreferences(): boolean {
        // 1. User stored preference (localStorage)
        const userPref: string | null = localStorage.getItem('theme');
        const userPrefDisplay: string = userPref === 'dark' ? 'dark' : (userPref === 'light' ? 'light' : 'unknown');

        // 2. Browser/OS preference (via prefers-color-scheme media query)
        // Note: Browser preference reflects OS setting in most cases
        let browserPref: string = 'unknown';
        let osPref: string = 'unknown';

        if (window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                browserPref = 'dark';
                osPref = 'dark';
            } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                browserPref = 'light';
                osPref = 'light';
            }
        }

        // Log preferences to console
        console.log('User Pref:', userPrefDisplay);
        console.log('Browser Pref:', browserPref);
        console.log('OS Pref:', osPref);

        // Determine which theme to use (cascade: user → browser/OS → light default)
        let useDark: boolean = false;

        if (userPref === 'dark') {
            useDark = true;
        } else if (userPref === 'light') {
            useDark = false;
        } else if (browserPref === 'dark') {
            useDark = true;
        } else if (browserPref === 'light') {
            useDark = false;
        } else {
            // Default to light
            useDark = false;
        }

        return useDark;
    }

    // Initialize theme on page load
    const shouldUseDark: boolean = detectThemePreferences();
    setTheme(shouldUseDark);

    // Toggle theme on button click
    $themeToggle.on('click', (): void => {
        const isDark: boolean = $('html').attr('data-bs-theme') === 'dark';
        setTheme(!isDark);
    });

    // Listen for OS color scheme changes and auto-adjust
    // Only applies if user hasn't manually set a preference
    if (window.matchMedia) {
        const darkModeMediaQuery: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

        darkModeMediaQuery.addEventListener('change', (e: MediaQueryListEvent): void => {
            const userPref: string | null = localStorage.getItem('theme');

            // Only auto-switch if user hasn't set a manual preference
            if (!userPref) {
                console.log('OS preference changed to:', e.matches ? 'dark' : 'light');
                setTheme(e.matches);
                // Clear the localStorage so it doesn't override future OS changes
                localStorage.removeItem('theme');
            } else {
                console.log('OS preference changed, but user has manual preference set. Ignoring.');
            }
        });
    }

    // 1. Fetch courses using jQuery (GET)
    $.get('http://localhost:3000/api/v1/courses')
        .done((data: Course[]): void => {
            data.forEach((course: Course): void => {
                $('<option>')
                    .val(course.id)
                    .text(course.display)
                    .appendTo($courseSelect);
            });
        })
        .fail((_jqXHR: any, _status: string, error: string): void => {
            console.error('Error fetching courses:', error);
        });

    // UI Logic: Show/Hide ID container
    $courseSelect.on('change', (): void => {
        $uvuIdContainer.toggle(!!$courseSelect.val());
    });

    // Guard flag to prevent concurrent fetchLogs requests (race condition fix)
    let fetchInFlight: boolean = false;

    // Block non-numeric keypress on UVU ID input (jQuery replacement for inline onkeypress)
    $uvuIdInput.on('keypress', (e: JQuery.KeyPressEvent): void => {
        if (!/[0-9]/.test(e.key)) {
            e.preventDefault();
        }
    });

    // ID Input Validation
    $uvuIdInput.on('input', function (this: HTMLInputElement): void {
        const cleaned: string = ($(this).val() as string).replace(/[^0-9]/g, '');
        $(this).val(cleaned);
        if (cleaned.length === 8) {
            fetchLogs(cleaned);
        }
        updateButtonState();
    });

    // 2. Fetch logs using jQuery (GET with Query Params)
    function fetchLogs(uvuId: string): void {
        // Prevent concurrent requests from rapid input
        if (fetchInFlight) {
            return;
        }
        fetchInFlight = true;

        const courseId: string = $courseSelect.val() as string;

        // Construct the URL with query parameters
        const url: string = `http://localhost:3000/api/v1/logs?courseId=${courseId}&uvuId=${uvuId}`;

        $.get(url)
            .done((data: LogEntry[]): void => {
                renderLogs(data, uvuId);
            })
            .fail((_jqXHR: any, _status: string, error: string): void => {
                console.error('Error fetching logs:', error);
                handleLogError(uvuId);
            })
            .always((): void => {
                fetchInFlight = false;
            });
    }

    function renderLogs(data: LogEntry[], uvuId: string): void {
        $uvuIdDisplay.text(`Student Logs for ${uvuId}`);
        $logList.empty();
        $logsSection.show();

        data.forEach((log: LogEntry): void => {
            appendLogItem(log);
        });
        updateButtonState();
    }

    // Helper function to create and append a single log item
    function appendLogItem(log: LogEntry): void {
        const $dateSmall = $('<small>')
            .addClass('text-muted fw-semibold')
            .text(log.date);

        const $dateDiv = $('<div>').append($dateSmall);

        const $p = $('<p>').addClass('mb-0').text(log.text);

        const $pre = $('<pre>')
            .addClass('mb-0 mt-2 bg-transparent border-0 font-monospace small')
            .append($p);

        const $li = $('<li>')
            .addClass('p-3 mb-2 rounded-end border-start border-success border-4 bg-body-secondary')
            .attr('role', 'button')
            .append($dateDiv)
            .append($pre)
            .on('click', (): void => {
                $pre.toggle();
            });

        $logList.append($li);
    }

    function handleLogError(uvuId: string): void {
        $uvuIdDisplay.text(`Student Logs for ${uvuId} (Error fetching logs)`);
        $logList.empty();
        updateButtonState();
    }

    // 3. Post a new log using jQuery (POST)
    // Guard flag to prevent double-click submissions (race condition fix)
    let postInFlight: boolean = false;

    $addLogBtn.on('click', (e: Event): void => {
        e.preventDefault();

        // Prevent double-click submissions
        if (postInFlight) {
            return;
        }
        postInFlight = true;
        $addLogBtn.prop('disabled', true);

        const newLog: LogEntry = {
            courseId: $courseSelect.val() as string,
            uvuId: $uvuIdInput.val() as string,
            date: new Date().toLocaleString(),
            text: $addLogTextarea.val() as string
        };

        $.ajax({
            url: 'http://localhost:3000/api/v1/logs',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(newLog)
        })
            .done((_response: LogEntry): void => {
                // Append the new log directly instead of re-fetching all logs
                // This preserves the collapsed/expanded state of existing logs
                appendLogItem(newLog);
                $addLogTextarea.val('');
                $addLogBtn.prop('disabled', true);
            })
            .fail((_jqXHR: any, _status: string, error: string): void => {
                console.error('Error adding log:', error);
                alert('Failed to add log');
                // Re-enable button on failure so user can retry
                updateButtonState();
            })
            .always((): void => {
                postInFlight = false;
            });
    });

    // Button State Management
    function updateButtonState(): void {
        const isUvuIdValid: boolean = ($uvuIdInput.val() as string).length === 8;
        const hasText: boolean = ($addLogTextarea.val() as string).trim() !== '';
        $addLogBtn.prop('disabled', !($courseSelect.val() && isUvuIdValid && hasText));
    }

    $addLogTextarea.on('input', updateButtonState);
    $courseSelect.on('change', updateButtonState);

});
