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

// Grab necessary document elements
const courseSelect = document.getElementById('course') as HTMLSelectElement;
const uvuIdContainer = document.getElementById('uvuIdContainer') as HTMLDivElement;
const uvuIdInput = document.getElementById('uvuId') as HTMLInputElement;
const logsSection = document.getElementById('logsSection') as HTMLDivElement;
const uvuIdDisplay = document.getElementById('uvuIdDisplay') as HTMLHeadingElement;
const logList = document.querySelector('ul[data-cy="logs"]') as HTMLUListElement;
const addLogTextarea = document.getElementById('addLogTextarea') as HTMLTextAreaElement;
const addLogBtn = document.getElementById('addLogBtn') as HTMLButtonElement;

// Theme Toggle Elements
const themeToggle = document.getElementById('themeToggle') as HTMLButtonElement;
const uvuLogo = document.getElementById('uvuLogo') as HTMLImageElement;

// Theme Toggle Logic
function setTheme(isDark: boolean): void {
    const htmlEl: HTMLElement = document.documentElement;
    if (isDark) {
        htmlEl.setAttribute('data-bs-theme', 'dark');
        themeToggle.textContent = '☀️';
        uvuLogo.src = 'uvu-seal-light.jpg';
        localStorage.setItem('theme', 'dark');
    } else {
        htmlEl.setAttribute('data-bs-theme', 'light');
        themeToggle.textContent = '🌙';
        uvuLogo.src = 'uvu-seal.jpg';
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
themeToggle.addEventListener('click', (): void => {
    const isDark: boolean = document.documentElement.getAttribute('data-bs-theme') === 'dark';
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

// 1. Fetch courses using axios (GET)
axios.get<Course[]>('http://localhost:3000/api/v1/courses')
    .then((response: AxiosResponse<Course[]>): void => {
        const courses: Course[] = response.data;
        courses.forEach((course: Course): void => {
            const option: HTMLOptionElement = document.createElement('option');
            option.value = course.id;
            option.textContent = course.display;
            courseSelect.appendChild(option);
        });
    })
    .catch((error: Error): void => {
        console.error('Error fetching courses:', error.message);
    });

// UI Logic: Show/Hide ID container
courseSelect.addEventListener('change', (): void => {
    uvuIdContainer.style.display = courseSelect.value ? 'block' : 'none';
});

// ID Input Validation
uvuIdInput.addEventListener('input', function (this: HTMLInputElement): void {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length === 8) {
        sendAjaxRequest(this.value);
    }
    updateButtonState();
});

// 2. Fetch logs using axios (GET with Query Params)
function sendAjaxRequest(uvuId: string): void {
    const courseId: string = courseSelect.value;

    // Construct the URL with query parameters
    const url: string = `http://localhost:3000/api/v1/logs?courseId=${courseId}&uvuId=${uvuId}`;

    axios.get<LogEntry[]>(url)
        .then((response: AxiosResponse<LogEntry[]>): void => {
            renderLogs(response.data, uvuId);
        })
        .catch((_error: Error): void => {
            handleLogError(uvuId);
        });
}

function renderLogs(data: LogEntry[], uvuId: string): void {
    uvuIdDisplay.textContent = `Student Logs for ${uvuId}`;
    logList.innerHTML = '';
    logsSection.style.display = 'block';

    data.forEach((log: LogEntry): void => {
        appendLogItem(log);
    });
    updateButtonState();
}

// Helper function to create and append a single log item
function appendLogItem(log: LogEntry): void {
    const li: HTMLLIElement = document.createElement('li');
    li.className = 'p-3 mb-2 rounded-end border-start border-success border-4 bg-body-secondary';
    li.setAttribute('role', 'button');

    const dateDiv: HTMLDivElement = document.createElement('div');
    const dateSmall: HTMLElement = document.createElement('small');
    dateSmall.className = 'text-muted fw-semibold';
    dateSmall.textContent = log.date;
    dateDiv.appendChild(dateSmall);

    const pre: HTMLPreElement = document.createElement('pre');
    pre.className = 'mb-0 mt-2 bg-transparent border-0 font-monospace small';
    const p: HTMLParagraphElement = document.createElement('p');
    p.className = 'mb-0';
    p.textContent = log.text;
    pre.appendChild(p);

    li.appendChild(dateDiv);
    li.appendChild(pre);

    li.addEventListener('click', (): void => {
        pre.style.display = (pre.style.display === 'none') ? 'block' : 'none';
    });

    logList.appendChild(li);
}

function handleLogError(uvuId: string): void {
    uvuIdDisplay.textContent = `Student Logs for ${uvuId} (Error fetching logs)`;
    logList.innerHTML = '';
    updateButtonState();
}

// 3. Post a new log using axios (POST)
addLogBtn.addEventListener('click', (e: Event): void => {
    e.preventDefault();

    const newLog: LogEntry = {
        courseId: courseSelect.value,
        uvuId: uvuIdInput.value,
        date: new Date().toLocaleString(),
        text: addLogTextarea.value
    };

    axios.post<LogEntry>('http://localhost:3000/api/v1/logs', newLog)
        .then((_response: AxiosResponse<LogEntry>): void => {
            // Append the new log directly instead of re-fetching all logs
            // This preserves the collapsed/expanded state of existing logs
            appendLogItem(newLog);
            addLogTextarea.value = '';
            addLogBtn.disabled = true;
        })
        .catch((_error: Error): void => {
            alert('Failed to add log');
        });
});

// Button State Management
function updateButtonState(): void {
    const isUvuIdValid: boolean = uvuIdInput.value.length === 8;
    const hasText: boolean = addLogTextarea.value.trim() !== '';
    addLogBtn.disabled = !(courseSelect.value && isUvuIdValid && hasText);
}

addLogTextarea.addEventListener('input', updateButtonState);
courseSelect.addEventListener('change', updateButtonState);
