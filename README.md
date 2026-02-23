# MyUniSched

MyUniSched is a web app for generating conflict‑free university timetables. You define lecturers, programmes and courses, then let the scheduler build a weekly timetable that respects lecturer and programme constraints.

## Features

- **Entity management (My Entities)**
  - Add, edit, delete **Lecturers**, **Programmes**, and **Courses**
  - Colour‑coded cards by programme
  - Detail view for each entity

- **Timetable generation**
  - Generates a weekly timetable (Mon–Fri) using:
    - 1‑hour time slots, 2‑hour classes
    - Lecturer continuity rules (max consecutive classes with gaps)
    - Per‑programme/day constraints (max classes per day)
    - Per‑slot constraints (min/max courses per time slot)
    - Per‑course constraints (max slots per course per day)
  - Prioritises filling central daytime blocks (10–4) before 8–10 and 4–6
  - Displays a **Programme Legend** and **Timetable Statistics**
  - Includes drag‑and‑drop timetable editing (visual rescheduling within the current generated timetable)

- **Filtering**
  - Filter timetable by **Course** or **Lecturer**
  - Programme options and legend are sorted consistently (level → name → year)

- **Backend**
  - Node.js + Express server
  - Firestore (via Firebase Admin SDK) for data storage

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JS
- **Backend:** Node.js, Express
- **Database:** Firestore (Firebase Admin SDK)

Main folders:

- `html/` – pages (`index.html`, `generate.html`, `myEntities.html`, `mySchedule.html`)
- `css/` – styling (`style.css`, `generate.css`, `myEntities.css`, etc.)
- `js/` – frontend logic (`generate.js`, `scheduler.js`, `generate_ui.js`, `course.js`, `lecturer.js`, `programme.js`, `addEntities.js`, `filters.js`, `config.js`)
- `node/` – backend (`server.js`, `db.js`)

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- A Firebase project with Firestore
- A Firebase service account (for Admin SDK)

### 1. Install dependencies

From the project root:

```bash
cd node
npm install
```

### 2. Configure Firebase credentials (local)

Set these environment variables in your shell before running the server:

```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-service-account@your-project-id.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...key...\n-----END PRIVATE KEY-----\n"
```

Note: `FIREBASE_PRIVATE_KEY` must keep `\n` as literal `\n` sequences.

### 3. Start the server

From the `node/` directory:

```bash
node server.js
```

By default this serves on `http://localhost:3000`.

### 4. Open the app

In your browser:

- Generate timetable: `http://localhost:3000/html/generate.html`
- Manage entities: `http://localhost:3000/html/myEntities.html`
- Home: `http://localhost:3000/index.html`

## Live Deployment

MyUniSched is also deployed on Render:

- Live site: `https://myunisched.onrender.com`

When served from Render, the frontend uses the same API base (`API_BASE` in `js/config.js`) pointing at this URL.

## Key Files

- `node/server.js`
  - REST API:
    - `GET /api/lecturers`, `POST /api/lecturers`, `PUT /api/lecturers/:id`, `DELETE /api/lecturers/:id`
    - `GET /api/programmes`, `POST /api/programmes`, `PUT /api/programmes/:id`, `DELETE /api/programmes/:id`
    - `GET /api/courses`, `POST /api/courses`, `PUT /api/courses/:id`, `DELETE /api/courses/:id`
  - Serves static assets (`/css`, `/js`, `/img`, `/html`)

- `js/scheduler.js`
  - Core timetable generation algorithm
  - Enforces:
    - Lecturer availability and max continuous classes
    - Programme/year conflicts
    - Per‑day class limits per programme
    - Slot capacity (min/max courses per slot)

- `js/generate.js`
  - Wires constraints UI to `generateSchedule` (min/max courses per slot, max slots per course per day)
  - Manages filter type/value and applies `filterTimetable` (by course or lecturer)
  - Listens for course edits and re‑patches the in‑memory timetable with the latest course data from `/api/courses`

- `js/generate_ui.js`
  - Renders the timetable table
  - Enables drag‑and‑drop movement of course blocks within a day’s lane (visual only; does not persist back to the API)
  - Programme legend + statistics

- `js/course.js`, `js/lecturer.js`, `js/programme.js`
  - CRUD interaction for My Entities modals and lists
  - Edit flows reuse the same modals and now support delete via red trash icons

- `js/config.js`
  - Shared config (time slots, days, default constraints, API base)
  - `getProgrammeColor` for consistent programme colours

## Development Notes

- **SQL vs Firestore:**  
  The current Node server uses Firestore only (`db.collection(...)`). Any `.sql` files are legacy and not used by `server.js`.

- **Colours / theme:**  
  The app uses a modern minimalist theme:
  - Light background, white cards, subtle shadows
  - Gold as the main accent colour for primary buttons
  - Programme colours are generated consistently via `getProgrammeColor`.

- **Delete behaviour:**  
  Deleting a lecturer or programme does not currently cascade or validate existing course references beyond Firestore’s document existence. You may want to add safeguards before deleting entities used by courses.

## Scripts

If you add npm scripts later, document them here, e.g.:

```jsonc
// node/package.json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

Then run:

```bash
npm run start
# or
npm run dev
```

## License

Add your chosen license here (e.g. MIT, proprietary, etc.).
