// ---------------------------------------------------------------------------
// Postgres-backed "database" (Neon). Same exported function names/shapes as
// the old JSON-file store, but every function is now async and talks to
// Postgres via the shared pool in data/pool.js. Every route already awaits
// these calls, so nothing about the route contracts changed.
// ---------------------------------------------------------------------------

const pool = require("./pool");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---- Schema + one-time seed (only runs the INSERTs if the tables are empty,
// so it's safe to call on every boot) -----------------------------------
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      has_attempted BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domains (
      seq SERIAL,
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      local_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      options JSONB NOT NULL,
      correct_index INTEGER NOT NULL,
      UNIQUE (domain_id, local_id)
    );

    CREATE TABLE IF NOT EXISTS results (
      result_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      name TEXT,
      domain_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      time_taken TEXT,
      reason TEXT,
      submitted_at TIMESTAMPTZ NOT NULL,
      answers JSONB NOT NULL,
      violation_count INTEGER NOT NULL DEFAULT 0,
      violations JSONB NOT NULL DEFAULT '[]'
    );

    CREATE SEQUENCE IF NOT EXISTS result_id_seq START 1004;
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM students");
  if (rows[0].count > 0) return; // already seeded

  await seed();
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const students = [
      { id: "EMP1001", password: "pass1001", name: "Ravi Kumar", email: "ravi.kumar@example.com", hasAttempted: true },
      { id: "EMP1002", password: "pass1002", name: "Ananya Rao", email: "ananya.rao@example.com", hasAttempted: true },
      { id: "EMP1003", password: "pass1003", name: "Divya Shah", email: "divya.shah@example.com", hasAttempted: true },
      { id: "EMP1004", password: "pass1004", name: "Karthik Iyer", email: "karthik.iyer@example.com", hasAttempted: false },
      { id: "STUDENT1", password: "student123", name: "Test Student", email: "test.student@example.com", hasAttempted: false },
    ];
    for (const s of students) {
      await client.query(
        "INSERT INTO students (id, password, name, email, has_attempted) VALUES ($1,$2,$3,$4,$5)",
        [s.id, s.password, s.name, s.email, s.hasAttempted]
      );
    }

    await client.query(
      "INSERT INTO admins (id, password, name) VALUES ($1,$2,$3)",
      ["ADMIN1", "admin123", "Portal Admin"]
    );

    const domains = [
      { id: "python-fullstack", name: "Python Full Stack", description: "Python, Django/Flask basics, REST APIs and full-stack fundamentals.", duration: 20 * 60 },
      { id: "frontend", name: "Frontend Development", description: "HTML, CSS, JavaScript, React and general UI fundamentals.", duration: 15 * 60 },
      { id: "backend", name: "Backend Development", description: "APIs, servers, HTTP, authentication and system design basics.", duration: 20 * 60 },
      { id: "database", name: "Database", description: "SQL, NoSQL, indexing, transactions and schema design.", duration: 15 * 60 },
    ];
    for (const d of domains) {
      await client.query(
        "INSERT INTO domains (id, name, description, duration) VALUES ($1,$2,$3,$4)",
        [d.id, d.name, d.description, d.duration]
      );
    }

    const questionsByDomain = {
      "python-fullstack": [
        { id: 1, text: "Which keyword is used to define a function in Python?", options: ["func", "def", "function", "lambda"], correctIndex: 1 },
        { id: 2, text: "Which of these is a Python web framework?", options: ["Django", "Laravel", "Spring", "Rails"], correctIndex: 0 },
        { id: 3, text: "What does 'pip' stand for/refer to in Python?", options: ["Python Installer Package", "Pip Installs Packages", "Python Internal Program", "Package Index Python"], correctIndex: 1 },
        { id: 4, text: "Which data type is immutable in Python?", options: ["List", "Dictionary", "Tuple", "Set"], correctIndex: 2 },
        { id: 5, text: "Which HTTP method is typically used to fetch data in a REST API?", options: ["GET", "SET", "FETCH", "PULL"], correctIndex: 0 },
      ],
      frontend: [
        { id: 1, text: "Which HTML tag is used to link an external CSS file?", options: ["<style>", "<script>", "<link>", "<css>"], correctIndex: 2 },
        { id: 2, text: "In React, what is used to pass data to a component from outside?", options: ["State", "Props", "Refs", "Context only"], correctIndex: 1 },
        { id: 3, text: "Which CSS property controls the space between flex items?", options: ["gap", "margin-flex", "space-between-items", "flex-space"], correctIndex: 0 },
        { id: 4, text: "Which array method creates a new array with transformed elements?", options: ["forEach", "map", "filter", "reduce"], correctIndex: 1 },
        { id: 5, text: "What does the React useEffect hook let you do?", options: ["Declare component state", "Run side effects after render", "Style a component", "Define routes"], correctIndex: 1 },
      ],
      backend: [
        { id: 1, text: "Which HTTP status code indicates a successful resource creation?", options: ["200 OK", "201 Created", "204 No Content", "301 Moved Permanently"], correctIndex: 1 },
        { id: 2, text: "In a relational database, what does a foreign key enforce?", options: ["Uniqueness of a column", "A link between two tables", "Encryption of stored data", "Automatic indexing"], correctIndex: 1 },
        { id: 3, text: "Which of these is NOT a valid HTTP method?", options: ["PATCH", "DELETE", "FETCH", "PUT"], correctIndex: 2 },
        { id: 4, text: "What is the primary purpose of a load balancer?", options: ["Store session data", "Distribute traffic across servers", "Compress API responses", "Validate user input"], correctIndex: 1 },
        { id: 5, text: "Which data structure does a typical message queue use?", options: ["Stack (LIFO)", "Queue (FIFO)", "Binary tree", "Hash map"], correctIndex: 1 },
      ],
      database: [
        { id: 1, text: "Which SQL clause is used to filter rows before grouping?", options: ["HAVING", "WHERE", "GROUP", "FILTER"], correctIndex: 1 },
        { id: 2, text: "What does ACID stand for in database transactions?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Index, Data", "Atomic, Cached, Indexed, Durable", "Asynchronous, Concurrent, Isolated, Distributed"], correctIndex: 0 },
        { id: 3, text: "Which type of database is MongoDB?", options: ["Relational", "Document-oriented NoSQL", "Graph", "Columnar"], correctIndex: 1 },
        { id: 4, text: "What is the purpose of an index in a database table?", options: ["Encrypt the table", "Speed up data retrieval", "Enforce foreign keys", "Reduce storage size"], correctIndex: 1 },
        { id: 5, text: "Which SQL join returns only matching rows from both tables?", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"], correctIndex: 2 },
      ],
    };
    for (const [domainId, qs] of Object.entries(questionsByDomain)) {
      for (const q of qs) {
        await client.query(
          "INSERT INTO questions (domain_id, local_id, text, options, correct_index) VALUES ($1,$2,$3,$4,$5)",
          [domainId, q.id, q.text, JSON.stringify(q.options), q.correctIndex]
        );
      }
    }

    const results = [
      {
        resultId: "R1001", studentId: "EMP1001", name: "Ravi Kumar", domainId: "backend",
        score: 4, total: 5, timeTaken: "12m 40s", reason: "manual",
        submittedAt: "2026-07-28T10:22:00Z",
        answers: { 1: 1, 2: 1, 3: 2, 4: 0, 5: 1 },
        violationCount: 0, violations: [],
      },
      {
        resultId: "R1002", studentId: "EMP1002", name: "Ananya Rao", domainId: "frontend",
        score: 3, total: 5, timeTaken: "10m 02s", reason: "manual",
        submittedAt: "2026-07-29T09:10:00Z",
        answers: { 1: 2, 2: 1, 3: 0, 4: 1, 5: 0 },
        violationCount: 2,
        violations: [
          { type: "tab-switch", timestamp: "2026-07-29T09:02:14Z", violationNumber: 1, action: "Warning Issued" },
          { type: "fullscreen-exit", timestamp: "2026-07-29T09:06:47Z", violationNumber: 2, action: "Warning Issued" },
        ],
      },
      {
        resultId: "R1003", studentId: "EMP1003", name: "Divya Shah", domainId: "python-fullstack",
        score: 5, total: 5, timeTaken: "9m 15s", reason: "manual",
        submittedAt: "2026-07-30T11:45:00Z",
        answers: { 1: 1, 2: 0, 3: 1, 4: 2, 5: 0 },
        violationCount: 0, violations: [],
      },
    ];
    for (const r of results) {
      await client.query(
        `INSERT INTO results (result_id, student_id, name, domain_id, score, total, time_taken, reason, submitted_at, answers, violation_count, violations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [r.resultId, r.studentId, r.name, r.domainId, r.score, r.total, r.timeTaken, r.reason, r.submittedAt, JSON.stringify(r.answers), r.violationCount, JSON.stringify(r.violations)]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---- Accessors ---------------------------------------------------------------
async function findStudent(id, password) {
  const { rows } = await pool.query(
    "SELECT id, password, name, email, has_attempted AS \"hasAttempted\" FROM students WHERE id = $1 AND password = $2",
    [id, password]
  );
  return rows[0] || null;
}

async function findAdmin(id, password) {
  const { rows } = await pool.query(
    "SELECT id, password, name FROM admins WHERE id = $1 AND password = $2",
    [id, password]
  );
  return rows[0] || null;
}

// Self-registration. Returns { student } on success or { error } — never
// throws, so routes can turn `error` straight into an HTTP response.
async function registerStudent({ id, email, name, password }) {
  const cleanId = (id || "").trim().toUpperCase();
  const cleanEmail = (email || "").trim();
  const cleanName = (name || "").trim();

  if (!cleanId || !cleanEmail || !cleanName || !password) {
    return { error: "Employee ID, email, name and password are all required." };
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const existing = await pool.query("SELECT 1 FROM students WHERE id = $1", [cleanId]);
  if (existing.rows.length > 0) {
    return { error: "This Employee ID is already registered. Sign in instead." };
  }

  await pool.query(
    "INSERT INTO students (id, password, name, email, has_attempted) VALUES ($1,$2,$3,$4,false)",
    [cleanId, password, cleanName, cleanEmail]
  );
  return { student: { id: cleanId, email: cleanEmail, name: cleanName, password, hasAttempted: false } };
}

async function getDomains() {
  const { rows } = await pool.query(`
    SELECT d.id, d.name, d.description, d.duration,
           COUNT(q.id)::int AS "questionCount"
    FROM domains d
    LEFT JOIN questions q ON q.domain_id = d.id
    GROUP BY d.id
    ORDER BY d.seq
  `);
  return rows;
}

async function getDomainMeta(domainId) {
  const { rows } = await pool.query("SELECT id, name, description, duration FROM domains WHERE id = $1", [domainId]);
  return rows[0] || null;
}

// Admin-editable exam timer. durationSeconds applies to every student who
// starts this domain's exam from now on (in-progress attempts keep whatever
// timeLeft they already loaded).
async function updateDomainDuration(domainId, durationSeconds) {
  const { rows } = await pool.query(
    "UPDATE domains SET duration = $2 WHERE id = $1 RETURNING id, name, description, duration",
    [domainId, durationSeconds]
  );
  return rows[0] || null;
}

// Admin-created domain. Starts with an empty question bank — use
// addQuestions afterward to build it up. Returns { domain } on success or
// { error } — never throws, so routes can turn `error` into an HTTP response.
async function addDomain({ id, name, description, duration }) {
  const cleanName = (name || "").trim();
  if (!cleanName) return { error: "Domain name is required." };

  const seconds = Number(duration);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { error: "duration must be a positive number of seconds." };
  }

  const cleanId = slugify(id) || slugify(cleanName);
  if (!cleanId) return { error: "Could not generate a valid ID for this domain." };

  const existing = await pool.query("SELECT 1 FROM domains WHERE id = $1", [cleanId]);
  if (existing.rows.length > 0) {
    return { error: `A domain with ID "${cleanId}" already exists.` };
  }

  const cleanDescription = (description || "").trim();
  const roundedDuration = Math.round(seconds);
  await pool.query(
    "INSERT INTO domains (id, name, description, duration) VALUES ($1,$2,$3,$4)",
    [cleanId, cleanName, cleanDescription, roundedDuration]
  );
  return { domain: { id: cleanId, name: cleanName, description: cleanDescription, duration: roundedDuration } };
}

// Partial update — name/description/duration. The domain's id never changes
// (results and question banks are keyed by it). Any field left undefined in
// the payload is untouched. Returns { domain } on success or { error }.
async function updateDomain(domainId, { name, description, duration }) {
  const domain = await getDomainMeta(domainId);
  if (!domain) return { error: "Domain not found." };

  const next = { name: domain.name, description: domain.description, duration: domain.duration };

  if (name !== undefined) {
    const cleanName = name.trim();
    if (!cleanName) return { error: "Domain name is required." };
    next.name = cleanName;
  }
  if (description !== undefined) {
    next.description = description.trim();
  }
  if (duration !== undefined) {
    const seconds = Number(duration);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return { error: "duration must be a positive number of seconds." };
    }
    next.duration = Math.round(seconds);
  }

  const { rows } = await pool.query(
    "UPDATE domains SET name = $2, description = $3, duration = $4 WHERE id = $1 RETURNING id, name, description, duration",
    [domainId, next.name, next.description, next.duration]
  );
  return { domain: rows[0] };
}

// Removes the domain and its question bank. Past results that reference this
// domainId are left alone (getAllResults/getResultById already fall back to
// showing the raw id when the domain meta is gone), so history isn't erased.
async function deleteDomain(domainId) {
  const { rowCount } = await pool.query("DELETE FROM domains WHERE id = $1", [domainId]);
  if (rowCount === 0) return { error: "Domain not found." };
  return { deleted: true };
}

// Exam paper WITHOUT correct answers (safe to send to a student).
async function getExamForStudent(domainId) {
  const meta = await getDomainMeta(domainId);
  if (!meta) return null;
  const { rows } = await pool.query(
    "SELECT local_id AS id, text, options FROM questions WHERE domain_id = $1 ORDER BY local_id",
    [domainId]
  );
  return { domainId: meta.id, title: meta.name, duration: meta.duration, questions: rows };
}

async function getQuestionsWithAnswers(domainId) {
  const { rows } = await pool.query(
    "SELECT local_id AS id, text, options, correct_index AS \"correctIndex\" FROM questions WHERE domain_id = $1 ORDER BY local_id",
    [domainId]
  );
  return rows;
}

async function addQuestions(domainId, newQuestions) {
  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(local_id), 0) AS max_id FROM questions WHERE domain_id = $1",
    [domainId]
  );
  const startId = rows[0].max_id + 1;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < newQuestions.length; i++) {
      const q = newQuestions[i];
      await client.query(
        "INSERT INTO questions (domain_id, local_id, text, options, correct_index) VALUES ($1,$2,$3,$4,$5)",
        [domainId, startId + i, q.text, JSON.stringify(q.options), q.correctIndex]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return getQuestionsWithAnswers(domainId);
}

async function submitExam({ studentId, name, domainId, answers, timeTaken, reason, violationCount, violations }) {
  const questions = await getQuestionsWithAnswers(domainId);
  let score = 0;
  questions.forEach((q) => {
    if (answers[q.id] === q.correctIndex) score += 1;
  });

  const { rows } = await pool.query("SELECT 'R' || nextval('result_id_seq') AS result_id");
  const resultId = rows[0].result_id;
  const submittedAt = new Date().toISOString();
  const cleanViolationCount = Number.isFinite(violationCount) ? violationCount : 0;
  const cleanViolations = Array.isArray(violations) ? violations : [];

  await pool.query(
    `INSERT INTO results (result_id, student_id, name, domain_id, score, total, time_taken, reason, submitted_at, answers, violation_count, violations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [resultId, studentId, name, domainId, score, questions.length, timeTaken || "—", reason || "manual", submittedAt, JSON.stringify(answers), cleanViolationCount, JSON.stringify(cleanViolations)]
  );

  // One attempt per Employee ID: locks this account out of future logins.
  await pool.query("UPDATE students SET has_attempted = true WHERE id = $1", [studentId]);

  return {
    resultId,
    studentId,
    name,
    domainId,
    score,
    total: questions.length,
    timeTaken: timeTaken || "—",
    reason: reason || "manual",
    submittedAt,
    answers,
    violationCount: cleanViolationCount,
    violations: cleanViolations,
  };
}

async function getAllResults() {
  const { rows } = await pool.query(`
    SELECT r.result_id AS "resultId", r.student_id AS "studentId", r.name, r.domain_id AS "domainId",
           COALESCE(d.name, r.domain_id) AS "domainName",
           r.score, r.total, r.time_taken AS "timeTaken", r.reason,
           r.submitted_at AS "submittedAt", r.answers,
           r.violation_count AS "violationCount", r.violations
    FROM results r
    LEFT JOIN domains d ON d.id = r.domain_id
    ORDER BY r.submitted_at
  `);
  return rows;
}

async function getResultById(resultId) {
  const { rows } = await pool.query(
    `SELECT r.result_id AS "resultId", r.student_id AS "studentId", r.name, r.domain_id AS "domainId",
            COALESCE(d.name, r.domain_id) AS "domainName",
            r.score, r.total, r.time_taken AS "timeTaken", r.reason,
            r.submitted_at AS "submittedAt", r.answers,
            r.violation_count AS "violationCount", r.violations
     FROM results r
     LEFT JOIN domains d ON d.id = r.domain_id
     WHERE r.result_id = $1`,
    [resultId]
  );
  const r = rows[0];
  if (!r) return null;

  const { rows: questions } = await pool.query(
    "SELECT local_id AS id, text, options, correct_index AS \"correctIndex\" FROM questions WHERE domain_id = $1 ORDER BY local_id",
    [r.domainId]
  );

  return {
    ...r,
    questions: questions.map((q) => ({ ...q, studentAnswer: r.answers[q.id] })),
  };
}

module.exports = {
  init,
  findStudent,
  findAdmin,
  registerStudent,
  getDomains,
  getDomainMeta,
  updateDomainDuration,
  addDomain,
  updateDomain,
  deleteDomain,
  getExamForStudent,
  getQuestionsWithAnswers,
  addQuestions,
  submitExam,
  getAllResults,
  getResultById,
};
