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

// ---- Schema + one-time seed (only runs the INSERT if the admins table is
// empty, so it's safe to call on every boot) -----------------------------
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

  // Bootstrap check is on admins (not students), since students now only
  // ever get populated by real self-registration -- an empty students
  // table on boot is the expected steady state, not a signal to reseed.
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM admins");
  if (rows[0].count > 0) return; // already seeded

  await seed();
}

// Only the admin account is seeded. Students, domains, questions and
// results all start empty -- students self-register, and admins create
// domains/questions through the admin UI once logged in.
async function seed() {
  await pool.query(
    "INSERT INTO admins (id, password, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING",
    ["ADMIN1", "admin123", "Portal Admin"]
  );
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

// This student's own completed attempts (dashboard "Completed" tab).
// Same summary shape as getAllResults, just scoped to one student_id, so
// the frontend can reuse identical rendering logic for either list.
async function getResultsByStudent(studentId) {
  const { rows } = await pool.query(
    `SELECT r.result_id AS "resultId", r.student_id AS "studentId", r.name, r.domain_id AS "domainId",
            COALESCE(d.name, r.domain_id) AS "domainName",
            r.score, r.total, r.time_taken AS "timeTaken", r.reason,
            r.submitted_at AS "submittedAt",
            r.violation_count AS "violationCount", r.violations
     FROM results r
     LEFT JOIN domains d ON d.id = r.domain_id
     WHERE r.student_id = $1
     ORDER BY r.submitted_at DESC`,
    [studentId]
  );
  return rows;
}

// Aggregate correct-vs-wrong-vs-unanswered counts for ONE question across
// every result ever submitted for its domain -- powers the admin pie
// chart. answers is stored as JSONB keyed by the question's local_id
// (as a string, since JSON object keys always are), so `?` checks whether
// that question was answered at all and `->>` pulls out which option was
// picked. We compare as TEXT (correct_index::text) rather than casting the
// stored answer to ::int -- any result whose answers blob has a
// non-numeric value at this key (legacy/bad data, a stray null, etc.)
// would otherwise blow up the cast with "invalid input syntax for type
// integer" and 500 the whole endpoint, since Postgres doesn't guarantee
// short-circuit evaluation of the AND inside FILTER (WHERE ...).
//
// $2 is bound to `q.local_id` exactly once, with an explicit ::int cast
// (its natural type, since it's a JS Number) -- everywhere else we derive
// the JSONB key from q.local_id::text instead of re-using $2. Postgres
// infers a single type per parameter across the whole prepared statement,
// so mixing a bare `q.local_id = $2` with `$2::text` elsewhere used to make
// it settle on text and then choke with "operator does not exist: integer
// = text" on the bare comparison.
async function getQuestionStats(domainId, questionLocalId) {
  const { rows } = await pool.query(
    `SELECT q.text, q.options, q.correct_index AS "correctIndex",
            COUNT(r.result_id)::int AS "totalAttempts",
            COUNT(*) FILTER (
              WHERE r.answers ? q.local_id::text AND (r.answers->>q.local_id::text) = q.correct_index::text
            )::int AS correct,
            COUNT(*) FILTER (
              WHERE r.answers ? q.local_id::text AND (r.answers->>q.local_id::text) != q.correct_index::text
            )::int AS wrong,
            COUNT(*) FILTER (WHERE NOT (r.answers ? q.local_id::text))::int AS unanswered
     FROM questions q
     LEFT JOIN results r ON r.domain_id = q.domain_id
     WHERE q.domain_id = $1 AND q.local_id = $2::int
     GROUP BY q.text, q.options, q.correct_index`,
    [domainId, questionLocalId]
  );
  return rows[0] || null;
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
  getResultsByStudent,
  getQuestionStats,
};