"use strict";
// Grab necessary document elements
const courseSelect = document.getElementById('course');
const uvuIdContainer = document.getElementById('uvuIdContainer');
const uvuIdInput = document.getElementById('uvuId');
const logsSection = document.getElementById('logsSection');
const uvuIdDisplay = document.getElementById('uvuIdDisplay');
const logList = document.querySelector('ul[data-cy="logs"]');
const addLogTextarea = document.getElementById('addLogTextarea');
const addLogBtn = document.getElementById('addLogBtn');
// Theme Toggle Elements
const themeToggle = document.getElementById('themeToggle');
const uvuLogo = document.getElementById('uvuLogo');
// Theme Toggle Logic
function setTheme(isDark) {
    const htmlEl = document.documentElement;
    if (isDark) {
        htmlEl.setAttribute('data-bs-theme', 'dark');
        themeToggle.textContent = '☀️';
        uvuLogo.src = 'uvu-seal-light.jpg';
        localStorage.setItem('theme', 'dark');
    }
    else {
        htmlEl.setAttribute('data-bs-theme', 'light');
        themeToggle.textContent = '🌙';
        uvuLogo.src = 'uvu-seal.jpg';
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
themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
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
// 1. Fetch courses using axios (GET)
axios.get('http://localhost:3000/api/v1/courses')
    .then((response) => {
    const courses = response.data;
    courses.forEach((course) => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.display;
        courseSelect.appendChild(option);
    });
})
    .catch((error) => {
    console.error('Error fetching courses:', error.message);
});
// UI Logic: Show/Hide ID container
courseSelect.addEventListener('change', () => {
    uvuIdContainer.style.display = courseSelect.value ? 'block' : 'none';
});
// ID Input Validation
uvuIdInput.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length === 8) {
        sendAjaxRequest(this.value);
    }
    updateButtonState();
});
// 2. Fetch logs using axios (GET with Query Params)
function sendAjaxRequest(uvuId) {
    const courseId = courseSelect.value;
    // Construct the URL with query parameters
    const url = `http://localhost:3000/api/v1/logs?courseId=${courseId}&uvuId=${uvuId}`;
    axios.get(url)
        .then((response) => {
        renderLogs(response.data, uvuId);
    })
        .catch((_error) => {
        handleLogError(uvuId);
    });
}
function renderLogs(data, uvuId) {
    uvuIdDisplay.textContent = `Student Logs for ${uvuId}`;
    logList.innerHTML = '';
    logsSection.style.display = 'block';
    data.forEach((log) => {
        appendLogItem(log);
    });
    updateButtonState();
}
// Helper function to create and append a single log item
function appendLogItem(log) {
    const li = document.createElement('li');
    li.className = 'p-3 mb-2 rounded-end border-start border-success border-4 bg-body-secondary';
    li.setAttribute('role', 'button');
    const dateDiv = document.createElement('div');
    const dateSmall = document.createElement('small');
    dateSmall.className = 'text-muted fw-semibold';
    dateSmall.textContent = log.date;
    dateDiv.appendChild(dateSmall);
    const pre = document.createElement('pre');
    pre.className = 'mb-0 mt-2 bg-transparent border-0 font-monospace small';
    const p = document.createElement('p');
    p.className = 'mb-0';
    p.textContent = log.text;
    pre.appendChild(p);
    li.appendChild(dateDiv);
    li.appendChild(pre);
    li.addEventListener('click', () => {
        pre.style.display = (pre.style.display === 'none') ? 'block' : 'none';
    });
    logList.appendChild(li);
}
function handleLogError(uvuId) {
    uvuIdDisplay.textContent = `Student Logs for ${uvuId} (Error fetching logs)`;
    logList.innerHTML = '';
    updateButtonState();
}
// 3. Post a new log using axios (POST)
addLogBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const newLog = {
        courseId: courseSelect.value,
        uvuId: uvuIdInput.value,
        date: new Date().toLocaleString(),
        text: addLogTextarea.value
    };
    axios.post('http://localhost:3000/api/v1/logs', newLog)
        .then((_response) => {
        // Append the new log directly instead of re-fetching all logs
        // This preserves the collapsed/expanded state of existing logs
        appendLogItem(newLog);
        addLogTextarea.value = '';
        addLogBtn.disabled = true;
    })
        .catch((_error) => {
        alert('Failed to add log');
    });
});
// Button State Management
function updateButtonState() {
    const isUvuIdValid = uvuIdInput.value.length === 8;
    const hasText = addLogTextarea.value.trim() !== '';
    addLogBtn.disabled = !(courseSelect.value && isUvuIdValid && hasText);
}
addLogTextarea.addEventListener('input', updateButtonState);
courseSelect.addEventListener('change', updateButtonState);
//# sourceMappingURL=script.js.map