# CS4690 – Student Logs

A UVU-branded web application for viewing and adding student progress logs by course. Built as a practicum project for **CS 4690** at Utah Valley University.

---

## Overview

**Student Logs** is a vanilla HTML/CSS/JavaScript front-end application backed by a lightweight [json-server](https://github.com/typicode/json-server) REST API. It allows users to:

- Select a course from a dynamically loaded dropdown
- Enter an 8-digit UVU student ID to retrieve their logs for that course
- View, expand/collapse, and add new log entries
- Toggle between **light and dark mode** (respects OS preference, with manual override)

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | Vanilla HTML5, CSS3, JavaScript (ES6+)          |
| HTTP Client| [Axios](https://axios-http.com/) (via CDN)      |
| Backend    | [json-server](https://github.com/typicode/json-server) v0.17.0 |
| Testing    | [Cypress](https://www.cypress.io/) v15          |
| Styling    | Custom CSS with UVU branding (green/white)      |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm

### Install Dependencies

```bash
npm install
```

### Run the Application

Start the json-server backend (also serves the `public/` frontend):

```bash
npm run server
```

Then open your browser to: [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
CS4690/
├── public/
│   ├── index.html        # Main HTML page
│   ├── script.js         # All frontend logic (Axios AJAX, DOM, theme)
│   ├── style.css         # UVU-branded styles + dark mode
│   ├── uvu-seal.jpg      # UVU seal (light mode)
│   └── uvu-seal-light.jpg# UVU seal (dark mode)
├── cypress/
│   ├── e2e/
│   │   ├── student-logs.cy.js  # Core app e2e tests
│   │   └── theme.cy.js         # Light/dark mode e2e tests
│   └── support/
├── db.json               # json-server database (courses + logs)
├── db.bak.json           # Backup of original database state
├── routes.json           # json-server custom route mappings
├── cypress.config.js     # Cypress configuration
└── package.json
```

---

## API Endpoints

The json-server exposes the following endpoints at `http://localhost:3000`:

| Method | Endpoint                                      | Description                          |
|--------|-----------------------------------------------|--------------------------------------|
| GET    | `/api/v1/courses`                             | Returns all available courses        |
| GET    | `/api/v1/logs?courseId=<id>&uvuId=<id>`       | Returns logs for a student in a course |
| POST   | `/api/v1/logs`                                | Adds a new log entry                 |

---

## Running Tests

Make sure the server is running (`npm run server`) before executing tests.

### Open Cypress Test Runner (interactive)

```bash
npm run cy:open
```

### Run Cypress Tests Headlessly (CI)

```bash
npm run cy:run
```

### Test Coverage

- **`student-logs.cy.js`** – Course dropdown loading, UVU ID input flow, log fetching, log toggle, button state, and posting a new log.
- **`theme.cy.js`** – Light/dark mode toggle behavior and persistence via `localStorage`.

---

## Features

- **Dynamic course dropdown** – Populated via AJAX on page load
- **UVU ID validation** – Numeric only, max 8 digits; auto-fetches logs on completion
- **Log toggle** – Click any log entry to collapse/expand the log text
- **Add Log** – Submit button enabled only when course, valid ID, and textarea are all filled
- **Light/Dark mode** – Toggled with 🌙/☀️ button; persists across sessions; auto-respects OS preference
- **UVU Branding** – Official UVU colors, seal, and font styling

---

## Notes

- The `db.json` file acts as the persistent data store for json-server. It will be modified when new logs are posted.
- `db.bak.json` contains the original seed data for reference or reset purposes.
- All AJAX requests use [Axios](https://axios-http.com/) loaded via CDN.