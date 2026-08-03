# Exam App — Backend

Express API that implements exactly the contract expected by
`frontend/src/api/client.js`. No external database required — data is
persisted to a local JSON file (`data/store.json`), which is created
automatically the first time the server runs and updated on every write, so
nothing is lost on restart.

## Setup

```bash
cd backend
npm install
npm run dev     # nodemon, auto-restarts on file changes
# or
npm start       # plain node
```

The server listens on `http://localhost:5000` by default. Copy `.env.example`
to `.env` and change `PORT` if you need a different port.

The frontend already points at `http://localhost:5000/api` via
`VITE_API_URL` (see `frontend/src/api/client.js`). As long as this backend is
running on that port, the frontend's `USE_MOCK = false` real API path works
with zero changes.

## Project layout

```
backend/
├── server.js              # Express app, mounts all routers
├── routes/
│   ├── auth.routes.js      # student register/login, admin login
│   ├── domain.routes.js    # list domains, fetch an exam paper
│   ├── exam.routes.js      # submit an exam attempt
│   └── admin.routes.js     # results, question publishing, domain CRUD
├── utils/
│   └── parseMCQ.js         # parses admin's pasted "Q: ... A) ... *" text
└── data/
    ├── db.js               # data-access layer (the "model")
    └── store.json           # generated on first run — the actual data
```

## How data flows

- **Domains** — subject areas (Python Full Stack, Frontend, Backend,
  Database), each with its own timer (`duration`, in seconds) and question
  bank.
- **Students** register once per Employee ID and get exactly **one** login +
  exam attempt, ever. After they submit, `hasAttempted` flips to `true` and
  further logins are refused (403).
- **Exam papers** sent to students never include `correctIndex` — grading
  happens server-side in `submitExam`, and the student is only ever told
  `{ submitted: true, resultId }`. Scores are visible to admins only, via
  `/api/admin/results`.
- **Anti-cheat log** — `violationCount` and the full `violations[]` array
  (tab-switch/fullscreen-exit events with timestamps) are stored on every
  result for the Admin's "Anti-Cheating Report" view.
- **Admin question publishing** — admin pastes MCQ text in the format:
  ```
  Q: What is 2+2?
  A) 3
  B) 4*
  C) 5
  D) 6
  ```
  (blank line between questions, `*` marks the correct option). `parseMCQ.js`
  parses this; `/preview` parses without saving, `POST /questions` parses and
  appends to that domain's bank.

## API reference

All routes are mounted under `/api`.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Health check |
| POST | `/auth/student/register` | `{ id, email, name, password }` |
| POST | `/auth/student/login` | `{ id, password }` |
| POST | `/auth/admin/login` | `{ id, password }` |
| GET  | `/domains` | List domains with question counts |
| GET  | `/domains/:domainId/exam` | Exam paper (no answers) |
| POST | `/exam/submit` | `{ studentId, name, domainId, answers, timeTaken, reason, violationCount, violations }` |
| GET  | `/admin/results` | All submitted attempts |
| GET  | `/admin/results/:resultId` | Full detail incl. correct/incorrect per question |
| POST | `/admin/domains/:domainId/questions/preview` | `{ text }` → parse only |
| POST | `/admin/domains/:domainId/questions` | `{ text }` → parse + publish |
| POST | `/admin/domains` | `{ id?, name, description, duration }` create domain |
| PUT  | `/admin/domains/:domainId/duration` | `{ duration }` (seconds) |
| PUT  | `/admin/domains/:domainId` | `{ name?, description?, duration? }` partial update |
| DELETE | `/admin/domains/:domainId` | Remove a domain (results referencing it are kept) |

## Seed accounts

| Role | ID | Password | Notes |
|---|---|---|---|
| Student | `STUDENT1` | `student123` | Has not attempted — usable for testing the full exam flow |
| Student | `EMP1004` | `pass1004` | Has not attempted |
| Student | `EMP1001` / `EMP1002` / `EMP1003` | `pass1001` / `pass1002` / `pass1003` | Already attempted — login is refused (403), matches the "one attempt only" rule |
| Admin | `ADMIN1` | `admin123` | |

## Moving to a real database later

`data/db.js` is the only file that touches storage — every route calls its
exported functions (`findStudent`, `submitExam`, `getAllResults`, etc.) and
never touches `store.json` directly. To swap in MongoDB/Postgres/etc., only
`data/db.js` needs to change; routes stay identical.
