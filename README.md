# CS4690 – Campus Course Logs

A multi-tenant course log application for **Utah Valley University** and the **University of Utah**. The app now supports authentication, role-based dashboards, tenant-specific themes, and MongoDB-backed course/log management.

---

## Overview

**Campus Course Logs** is a TypeScript web application featuring a Node.js/Express backend, session-based authentication, tenant-aware routing, and a MongoDB database. It allows users to:

- Sign in through tenant URLs at `/uvu/login` and `/uofu/login`
- Use role-based dashboards for `admin`, `teacher`, `ta`, and `student`
- Create courses, add members, and write course logs with tenant isolation
- Let students self-enroll into courses inside their own tenant
- Keep UVU and UofU data, users, and themes fully separated

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | TypeScript, HTML5, Bootstrap 5, custom CSS      |
| Backend    | Node.js, Express 5, TypeScript (ESM), sessions  |
| Database   | MongoDB (via Mongoose 9)                        |
| Runtime    | [tsx](https://github.com/privatenumber/tsx) (for development) |
| Testing    | Node test runner + Supertest + Mongo Memory Server |
| Styling    | Tenant-themed Bootstrap 5 + custom CSS          |

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

You can also use:

```bash
npm run server
```

Then open your browser to: [http://localhost:3000](http://localhost:3000)

Tenant entry points:

- `http://localhost:3000/uvu/login`
- `http://localhost:3000/uofu/login`

Seeded admin credentials:

- `root_uvu / willy`
- `root_uofu / swoopy`

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
├── server.ts             # Express server configuration
├── db.ts                 # MongoDB connection logic
├── cypress/              # End-to-end tests
├── tsconfig.json         # TypeScript configuration
└── package.json
```

---

## Tenant Routing

Each campus uses a separate URL space and visual theme:

- `/uvu/*` → Utah Valley University
- `/uofu/*` → University of Utah

All API access is tenant-scoped under:

- `/api/uvu/*`
- `/api/uofu/*`

---

## Features

- **Role-aware authentication** – Separate login and signup pages with session-backed auth
- **Admin page** – View all tenant users/courses/logs, create teachers/TAs/students, and create courses
- **Teacher page** – Create courses, create TAs/students, add members, and review course logs
- **TA page** – View assigned courses/logs, create students, and add students to a course
- **Student page** – View only personal courses/logs and self-enroll into available courses
- **Tenant isolation** – UVU and UofU data never mix in API responses or dashboards
- **Tenant-specific GUI** – Green UVU theme and crimson UofU theme
- **SPA routing** – Frontend routes for landing, login, signup, and role dashboards

---

## Development Notes

- The project uses **ESM (ECMAScript Modules)**. All relative imports in `.ts` files must include the `.js` extension (e.g., `import { x } from './y.js'`).
- Use `npm run build` to compile the TypeScript files for production.
- Use `npm run start` or `npm run server` during development to run the Express server with `tsx` (no manual compile step needed).
- Use `npm test` to run the automated integration tests against an in-memory MongoDB instance.
