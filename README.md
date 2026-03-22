# CS4690 – Student Logs

A UVU-branded web application for viewing and adding student progress logs by course. Built as a practicum project for **CS 4690** at Utah Valley University.

---

## Overview

**Student Logs** is a TypeScript web application featuring a Node.js/Express backend and a MongoDB database. It allows users to:

- Manage courses (Add/Update) via a built-in management interface.
- Select a course from a dynamically loaded dropdown.
- Enter an 8-digit UVU student ID to retrieve their logs for that course.
- View, expand/collapse, and add new log entries.
- Toggle between **light and dark mode** (respects OS preference, with manual override).

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | TypeScript, HTML5, Bootstrap 5, jQuery 3.7      |
| Backend    | Node.js, Express 5, TypeScript (ESM)            |
| Database   | MongoDB (via Mongoose 9)                        |
| Runtime    | [tsx](https://github.com/privatenumber/tsx) (for development) |
| Testing    | [Cypress](https://www.cypress.io/) v15          |
| Styling    | Bootstrap 5 with UVU branding (green/white)     |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm
- A MongoDB instance (local or Atlas)

### Configuration

Create a `.env` file in the root directory and add your MongoDB connection string:

```env
MONGO_URI=your_mongodb_connection_string
PORT=3000
```

### Install Dependencies

```bash
npm install
```

### Run the Application

Start the Express backend (also serves the `public/` frontend):

```bash
npm run start
```

Then open your browser to: [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
CS4690/
├── public/
│   ├── index.html        # Main HTML page
│   ├── script.ts         # Frontend logic (jQuery, AJAX, theme)
│   ├── uvu-seal.jpg      # UVU seal (light mode)
│   └── uvu-seal-light.jpg# UVU seal (dark mode)
├── models/
│   ├── Course.ts         # Mongoose schema for Courses
│   └── Log.ts            # Mongoose schema for Logs
├── repositories/
│   ├── CourseRepository.ts # Database operations for Courses
│   └── LogRepository.ts   # Database operations for Logs
├── server.ts             # Express server configuration
├── db.ts                 # MongoDB connection logic
├── cypress/              # End-to-end tests
├── tsconfig.json         # TypeScript configuration
└── package.json
```

---

## API Endpoints

The Express server exposes the following endpoints at `http://localhost:3000`:

| Method | Endpoint                                      | Description                          |
|--------|-----------------------------------------------|--------------------------------------|
| GET    | `/api/v1/courses`                             | Returns all available courses        |
| POST   | `/api/v1/courses`                             | Adds a new course                    |
| PUT    | `/api/v1/courses/:id`                         | Updates an existing course           |
| GET    | `/api/v1/logs?courseId=<id>&uvuId=<id>`       | Returns logs for a student in a course|
| POST   | `/api/v1/logs`                                | Adds a new log entry                 |

---

## Features

- **Course Management** – Add new courses or update existing ones directly from the UI.
- **Dynamic course dropdown** – Populated via AJAX on page load.
- **UVU ID validation** – Numeric only, max 8 digits; auto-fetches logs on completion.
- **Auto-Refresh** – Switching courses automatically refreshes logs for the currently entered UVU ID.
- **Log toggle** – Click any log entry to collapse/expand the log text.
- **Add Log** – Submit button enabled only when course, valid ID, and textarea are all filled.
- **Light/Dark mode** – Toggled with 🌙/☀️ button; persists across sessions; auto-respects OS preference.
- **UVU Branding** – Official UVU colors, seal, and font styling using Bootstrap 5.

---

## Development Notes

- The project uses **ESM (ECMAScript Modules)**. All relative imports in `.ts` files must include the `.js` extension (e.g., `import { x } from './y.js'`).
- Use `npm run build` to compile the TypeScript files for production.
- Use `npm run start` during development to run the server with `tsx` (no manual compile step needed).
