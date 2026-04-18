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

type ThemePreference = 'light' | 'dark';

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

    // Course Management Elements
    const $newCourseId = $('#newCourseId');
    const $newCourseDisplay = $('#newCourseDisplay');
    const $addCourseBtn = $('#addCourseBtn');
    const $courseStatusMsg = $('#courseStatusMsg');

    // Theme Toggle Elements
    const $themeToggle = $('#themeToggle');
    const $uvuLogo = $('#uvuLogo');

    const apiBaseUrl: string = '/api/v1';

    // Theme Toggle Logic
    function applyTheme(theme: ThemePreference): void {
        if (theme === 'dark') {
            $('html').attr('data-bs-theme', 'dark');
            $themeToggle.text('☀️');
            $uvuLogo.attr('src', 'uvu-seal-light.jpg');
        } else {
            $('html').attr('data-bs-theme', 'light');
            $themeToggle.text('🌙');
            $uvuLogo.attr('src', 'uvu-seal.jpg');
        }
    }

    function getStoredThemePreference(): ThemePreference | null {
        const storedTheme: string | null = localStorage.getItem('theme');
        return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
    }

    // Detect theme preferences from various sources
    function detectThemePreferences(): ThemePreference {
        // 1. User stored preference (localStorage)
        const userPref: ThemePreference | null = getStoredThemePreference();
        const userPrefDisplay: string = userPref ?? 'unknown';

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
        if (userPref === 'dark') {
            return 'dark';
        } else if (userPref === 'light') {
            return 'light';
        } else if (browserPref === 'dark') {
            return 'dark';
        } else if (browserPref === 'light') {
            return 'light';
        } else {
            // Default to light
            return 'light';
        }
    }

    // Initialize theme on page load
    applyTheme(detectThemePreferences());

    // Toggle theme on button click
    $themeToggle.on('click', (): void => {
        const nextTheme: ThemePreference = $('html').attr('data-bs-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('theme', nextTheme);
    });

    // Listen for OS color scheme changes and auto-adjust
    // Only applies if user hasn't manually set a preference
    if (window.matchMedia) {
        const darkModeMediaQuery: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

        darkModeMediaQuery.addEventListener('change', (e: MediaQueryListEvent): void => {
            const userPref: ThemePreference | null = getStoredThemePreference();

            // Only auto-switch if user hasn't set a manual preference
            if (!userPref) {
                console.log('OS preference changed to:', e.matches ? 'dark' : 'light');
                applyTheme(e.matches ? 'dark' : 'light');
            } else {
                console.log('OS preference changed, but user has manual preference set. Ignoring.');
            }
        });
    }

    // 1. Fetch courses using jQuery (GET)
    $.get(`${apiBaseUrl}/courses`)
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

    // UI Logic: Show/Hide ID container and reset logs on course change
    $courseSelect.on('change', (): void => {
        const hasCourse: boolean = !!$courseSelect.val();
        $uvuIdContainer.toggle(hasCourse);

        // Clear logs display whenever course changes
        $logList.empty();
        $logsSection.hide();
        $uvuIdDisplay.text('');

        // If we already have a valid UVU ID, re-fetch logs for the new course
        const uvuId: string = ($uvuIdInput.val() as string).trim();
        if (hasCourse && uvuId.length === 8) {
            fetchLogs(uvuId);
        }
        updateButtonState();
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
        const url: string = `${apiBaseUrl}/logs?courseId=${courseId}&uvuId=${uvuId}`;

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
            url: `${apiBaseUrl}/logs`,
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

    // 4. Add or Update a course using jQuery (POST or PUT)
    $addCourseBtn.on('click', (): void => {
        const id: string = ($newCourseId.val() as string).trim();
        const display: string = ($newCourseDisplay.val() as string).trim();

        if (!id || !display) {
            $courseStatusMsg.text('Error: Course ID and Name are required').css('color', 'red');
            return;
        }

        const courseData: Partial<Course> = { id, display };

        // Check if course already exists in the dropdown
        const exists: boolean = $courseSelect.find(`option[value="${id}"]`).length > 0;

        if (exists) {
            // Update existing course (PUT)
            $.ajax({
                url: `${apiBaseUrl}/courses/${id}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(courseData)
            })
                .done((_response: Course): void => {
                    $courseSelect.find(`option[value="${id}"]`).text(display);
                    $courseStatusMsg.text('Course updated successfully!').css('color', 'green');
                    $newCourseId.val('');
                    $newCourseDisplay.val('');
                })
                .fail((_jqXHR: any, _status: string, error: string): void => {
                    console.error('Error updating course:', error);
                    $courseStatusMsg.text('Error updating course').css('color', 'red');
                });
        } else {
            // Add new course (POST)
            $.ajax({
                url: `${apiBaseUrl}/courses`,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(courseData)
            })
                .done((response: Course): void => {
                    $('<option>')
                        .val(response.id)
                        .text(response.display)
                        .appendTo($courseSelect);
                    $courseStatusMsg.text('Course added successfully!').css('color', 'green');
                    $newCourseId.val('');
                    $newCourseDisplay.val('');
                })
                .fail((_jqXHR: any, _status: string, error: string): void => {
                    console.error('Error adding course:', error);
                    $courseStatusMsg.text('Error adding course').css('color', 'red');
                });
        }
    });

});
