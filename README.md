# CS4690 - Campus Course Logs

Campus Course Logs is a school-separated course log application for **Utah Valley University** and the **University of Utah**. It uses a TypeScript Express backend, a TypeScript single-page frontend, MongoDB with Mongoose, and role-based access for admins, teachers, TAs, and students.

## Overview

The application supports:

- Separate school URLs at `/uvu/*` and `/uofu/*`
- School-specific themes for UVU and UofU
- Session-backed login and signup
- Role-based dashboards for `admin`, `teacher`, `ta`, and `student`
- Dedicated pages for creating courses and user accounts
- Student self-enrollment into available courses
- Course-specific logs with school isolation
- Protection against cross-school and unauthorized manual URL access

## Current Roles

- `admin` can view all school data, create courses, create admins, teachers, TAs, and students, and delete users or courses
- `teacher` can create courses, create TAs, create students, manage their courses, and review logs in their courses
- `ta` can view assigned courses and logs, create students, and add students to assigned courses
- `student` can view only personal courses and logs, self-enroll in available courses, and add personal logs

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | TypeScript, HTML5, Bootstrap 5, custom CSS |
| Backend | Node.js, Express 5, TypeScript, `express-session` |
| Database | MongoDB with Mongoose |
| Runtime | `tsx` for local server execution |
| Automated tests | Node test runner, Supertest, Mongo Memory Server |
| End-to-end tests | Cypress |

## Getting Started

### Prerequisites

- Node.js
- npm
- A MongoDB instance running locally or in the cloud

### Environment Variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_connection_string
PORT=3000
```

`MONGO_URI` is required. If it is missing, the app will not start.

### Install Dependencies

```bash
npm install
```

### Start the App

```bash
npm run start
```

You can also use:

```bash
npm run server
```

Then open [http://localhost:3000](http://localhost:3000).

## School Entry Points

- UVU login: `http://localhost:3000/uvu/login`
- UofU login: `http://localhost:3000/uofu/login`

Seeded admin accounts:

- `root_uvu / willy`
- `root_uofu / swoopy`

## Available Scripts

- `npm run start` starts the server with `tsx`
- `npm run server` starts the same server command
- `npm run build` compiles TypeScript files to JavaScript
- `npm test` runs the automated Node test suite
- `npm run cy:open` opens Cypress
- `npm run cy:run` runs Cypress headlessly

## Important Build Note

Server-side TypeScript files such as `app.ts` and `server.ts` run through `tsx`, so they are used when the server starts.

Frontend code in `public/script.ts` is compiled to `public/script.js`. If you change frontend TypeScript, run:

```bash
npm run build
```

before expecting those browser changes to appear.

## Testing

### Automated Tests

Run the Node test suite:

```bash
npm test
```

This covers API behavior and unit-level logic, including role rules and school isolation.

### Cypress Tests

Start the app first, then run:

```bash
npm run cy:run
```

or open the Cypress UI with:

```bash
npm run cy:open
```

The Cypress config uses `http://localhost:3000` as the base URL.

## Routing and Isolation

School routes:

- `/uvu/*` for Utah Valley University
- `/uofu/*` for University of Utah

API routes:

- `/api/uvu/*`
- `/api/uofu/*`
- `/api/auth/session` for the current active session, regardless of school

The app enforces school separation so users from UVU cannot view or manage UofU data, and users from UofU cannot view or manage UVU data.

If a signed-in user manually navigates to a protected route they should not access, the frontend logs the attempt, signs the user out, and redirects them to the correct login page.

## Current Features

- Landing page with separate UVU and UofU entry cards
- Login and signup pages for each school
- School-themed dashboards for admins, teachers, TAs, and students
- Dedicated create pages for courses, admins, teachers, TAs, and students
- Directory views for current users
- Admin delete controls for users and courses
- Course deletion that also deletes associated logs and enrollments
- Detail pages for courses, students, and logs
- Student self-enrollment into available courses
- Course membership management
- Course log creation and review

## Project Structure

```text
CS4690/
├── app.ts                  # Main Express app and API routes
├── server.ts               # Server entry point
├── db.ts                   # MongoDB connection helper
├── seed.ts                 # Seed helpers for default data
├── public/
│   ├── index.html          # SPA host page
│   ├── script.ts           # Frontend TypeScript source
│   ├── script.js           # Compiled frontend bundle served by the browser
│   ├── styles.css          # Bootstrap overrides and custom styling
│   ├── uvu-seal.jpg        # UVU image asset
│   └── BlockU_RGB.jpg      # UofU image asset
├── models/
│   ├── Course.ts           # Course schema
│   ├── Enrollment.ts       # Course membership schema
│   ├── Log.ts              # Log schema
│   └── User.ts             # User schema
├── tests/
│   ├── api.test.ts         # API and authorization tests
│   └── domain.unit.test.ts # Unit tests
├── cypress/
│   ├── e2e/                # End-to-end specs
│   └── support/            # Cypress support files
├── cypress.config.ts
├── tsconfig.json
└── package.json
```

## Notes

- The project uses ESM-style imports in TypeScript.
- The app uses MongoDB through Mongoose for the current application flow.
- If frontend changes do not show up, rebuild with `npm run build` and refresh the browser.
