"use strict";
// Wait for DOM to be fully ready before running any jQuery selectors or logic
$(document).ready(() => {
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
    // Theme Toggle Logic
    function setTheme(isDark) {
        if (isDark) {
            $('html').attr('data-bs-theme', 'dark');
            $themeToggle.text('☀️');
            $uvuLogo.attr('src', 'uvu-seal-light.jpg');
            localStorage.setItem('theme', 'dark');
        }
        else {
            $('html').attr('data-bs-theme', 'light');
            $themeToggle.text('🌙');
            $uvuLogo.attr('src', 'uvu-seal.jpg');
            localStorage.setItem('theme', 'light');
        }
    }
    // Detect theme preferences from various sources
    function detectThemePreferences() {
        // 1. User stored preference (localStorage)
        const userPref = localStorage.getItem('theme');
        const userPrefDisplay = userPref === 'dark' ? 'dark' : (userPref === 'light' ? 'light' : 'unknown');
        // 2. Browser/OS preference (via prefers-color-scheme media query)
        // Note: Browser preference reflects OS setting in most cases
        let browserPref = 'unknown';
        let osPref = 'unknown';
        if (window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                browserPref = 'dark';
                osPref = 'dark';
            }
            else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                browserPref = 'light';
                osPref = 'light';
            }
        }
        // Log preferences to console
        console.log('User Pref:', userPrefDisplay);
        console.log('Browser Pref:', browserPref);
        console.log('OS Pref:', osPref);
        // Determine which theme to use (cascade: user → browser/OS → light default)
        let useDark = false;
        if (userPref === 'dark') {
            useDark = true;
        }
        else if (userPref === 'light') {
            useDark = false;
        }
        else if (browserPref === 'dark') {
            useDark = true;
        }
        else if (browserPref === 'light') {
            useDark = false;
        }
        else {
            // Default to light
            useDark = false;
        }
        return useDark;
    }
    // Initialize theme on page load
    const shouldUseDark = detectThemePreferences();
    setTheme(shouldUseDark);
    // Toggle theme on button click
    $themeToggle.on('click', () => {
        const isDark = $('html').attr('data-bs-theme') === 'dark';
        setTheme(!isDark);
    });
    // Listen for OS color scheme changes and auto-adjust
    // Only applies if user hasn't manually set a preference
    if (window.matchMedia) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', (e) => {
            const userPref = localStorage.getItem('theme');
            // Only auto-switch if user hasn't set a manual preference
            if (!userPref) {
                console.log('OS preference changed to:', e.matches ? 'dark' : 'light');
                setTheme(e.matches);
                // Clear the localStorage so it doesn't override future OS changes
                localStorage.removeItem('theme');
            }
            else {
                console.log('OS preference changed, but user has manual preference set. Ignoring.');
            }
        });
    }
    // 1. Fetch courses using jQuery (GET)
    $.get('http://localhost:3000/api/v1/courses')
        .done((data) => {
        data.forEach((course) => {
            $('<option>')
                .val(course.id)
                .text(course.display)
                .appendTo($courseSelect);
        });
    })
        .fail((_jqXHR, _status, error) => {
        console.error('Error fetching courses:', error);
    });
    // UI Logic: Show/Hide ID container and reset logs on course change
    $courseSelect.on('change', () => {
        const hasCourse = !!$courseSelect.val();
        $uvuIdContainer.toggle(hasCourse);
        // Clear logs display whenever course changes
        $logList.empty();
        $logsSection.hide();
        $uvuIdDisplay.text('');
        // If we already have a valid UVU ID, re-fetch logs for the new course
        const uvuId = $uvuIdInput.val().trim();
        if (hasCourse && uvuId.length === 8) {
            fetchLogs(uvuId);
        }
        updateButtonState();
    });
    // Guard flag to prevent concurrent fetchLogs requests (race condition fix)
    let fetchInFlight = false;
    // Block non-numeric keypress on UVU ID input (jQuery replacement for inline onkeypress)
    $uvuIdInput.on('keypress', (e) => {
        if (!/[0-9]/.test(e.key)) {
            e.preventDefault();
        }
    });
    // ID Input Validation
    $uvuIdInput.on('input', function () {
        const cleaned = $(this).val().replace(/[^0-9]/g, '');
        $(this).val(cleaned);
        if (cleaned.length === 8) {
            fetchLogs(cleaned);
        }
        updateButtonState();
    });
    // 2. Fetch logs using jQuery (GET with Query Params)
    function fetchLogs(uvuId) {
        // Prevent concurrent requests from rapid input
        if (fetchInFlight) {
            return;
        }
        fetchInFlight = true;
        const courseId = $courseSelect.val();
        // Construct the URL with query parameters
        const url = `http://localhost:3000/api/v1/logs?courseId=${courseId}&uvuId=${uvuId}`;
        $.get(url)
            .done((data) => {
            renderLogs(data, uvuId);
        })
            .fail((_jqXHR, _status, error) => {
            console.error('Error fetching logs:', error);
            handleLogError(uvuId);
        })
            .always(() => {
            fetchInFlight = false;
        });
    }
    function renderLogs(data, uvuId) {
        $uvuIdDisplay.text(`Student Logs for ${uvuId}`);
        $logList.empty();
        $logsSection.show();
        data.forEach((log) => {
            appendLogItem(log);
        });
        updateButtonState();
    }
    // Helper function to create and append a single log item
    function appendLogItem(log) {
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
            .on('click', () => {
            $pre.toggle();
        });
        $logList.append($li);
    }
    function handleLogError(uvuId) {
        $uvuIdDisplay.text(`Student Logs for ${uvuId} (Error fetching logs)`);
        $logList.empty();
        updateButtonState();
    }
    // 3. Post a new log using jQuery (POST)
    // Guard flag to prevent double-click submissions (race condition fix)
    let postInFlight = false;
    $addLogBtn.on('click', (e) => {
        e.preventDefault();
        // Prevent double-click submissions
        if (postInFlight) {
            return;
        }
        postInFlight = true;
        $addLogBtn.prop('disabled', true);
        const newLog = {
            courseId: $courseSelect.val(),
            uvuId: $uvuIdInput.val(),
            date: new Date().toLocaleString(),
            text: $addLogTextarea.val()
        };
        $.ajax({
            url: 'http://localhost:3000/api/v1/logs',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(newLog)
        })
            .done((_response) => {
            // Append the new log directly instead of re-fetching all logs
            // This preserves the collapsed/expanded state of existing logs
            appendLogItem(newLog);
            $addLogTextarea.val('');
            $addLogBtn.prop('disabled', true);
        })
            .fail((_jqXHR, _status, error) => {
            console.error('Error adding log:', error);
            alert('Failed to add log');
            // Re-enable button on failure so user can retry
            updateButtonState();
        })
            .always(() => {
            postInFlight = false;
        });
    });
    // Button State Management
    function updateButtonState() {
        const isUvuIdValid = $uvuIdInput.val().length === 8;
        const hasText = $addLogTextarea.val().trim() !== '';
        $addLogBtn.prop('disabled', !($courseSelect.val() && isUvuIdValid && hasText));
    }
    $addLogTextarea.on('input', updateButtonState);
    // 4. Add or Update a course using jQuery (POST or PUT)
    $addCourseBtn.on('click', () => {
        const id = $newCourseId.val().trim();
        const display = $newCourseDisplay.val().trim();
        if (!id || !display) {
            $courseStatusMsg.text('Error: Course ID and Name are required').css('color', 'red');
            return;
        }
        const courseData = { id, display };
        // Check if course already exists in the dropdown
        const exists = $courseSelect.find(`option[value="${id}"]`).length > 0;
        if (exists) {
            // Update existing course (PUT)
            $.ajax({
                url: `http://localhost:3000/api/v1/courses/${id}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(courseData)
            })
                .done((_response) => {
                $courseSelect.find(`option[value="${id}"]`).text(display);
                $courseStatusMsg.text('Course updated successfully!').css('color', 'green');
                $newCourseId.val('');
                $newCourseDisplay.val('');
            })
                .fail((_jqXHR, _status, error) => {
                console.error('Error updating course:', error);
                $courseStatusMsg.text('Error updating course').css('color', 'red');
            });
        }
        else {
            // Add new course (POST)
            $.ajax({
                url: 'http://localhost:3000/api/v1/courses',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(courseData)
            })
                .done((response) => {
                $('<option>')
                    .val(response.id)
                    .text(response.display)
                    .appendTo($courseSelect);
                $courseStatusMsg.text('Course added successfully!').css('color', 'green');
                $newCourseId.val('');
                $newCourseDisplay.val('');
            })
                .fail((_jqXHR, _status, error) => {
                console.error('Error adding course:', error);
                $courseStatusMsg.text('Error adding course').css('color', 'red');
            });
        }
    });
});
//# sourceMappingURL=script.js.map