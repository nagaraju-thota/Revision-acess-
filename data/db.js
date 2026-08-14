// ---------------------------------------------------------------------------
// Postgres-backed "database" (Neon). Same exported function names/shapes as
// the old JSON-file store, but every function is now async and talks to
// Postgres via the shared pool in data/pool.js. Every route already awaits
// these calls, so nothing about the route contracts changed.
//
// Questions now come in three flavors, distinguished by the `type` column:
//   - "mcq"        (original): options + correct_index
//   - "fill_blank": text with a ___ blank + accepted_answers (array, any
//                   one of them counts as correct, case/whitespace-insensitive)
//   - "coding":     problem_statement + optional starter_code/sample_output.
//                   There's no safe way to auto-execute/grade arbitrary
//                   submitted code here, so coding answers are stored as-is
//                   for manual review and excluded from the automatic score.
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
      options JSONB,
      correct_index INTEGER,
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

  // Additive migration for fill-in-the-blank + coding question types. Runs
  // every boot; every statement is IF NOT EXISTS / idempotent, so it's a
  // no-op once applied. options/correct_index used to be NOT NULL back when
  // "questions" only meant MCQ -- relaxed here since fill_blank/coding rows
  // don't use them.
  await pool.query(`
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'mcq';
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS accepted_answers JSONB;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS problem_statement TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS language TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS starter_code TEXT;
    ALTER TABLE questions ADD COLUMN IF NOT EXISTS sample_output TEXT;
    ALTER TABLE questions ALTER COLUMN options DROP NOT NULL;
    ALTER TABLE questions ALTER COLUMN correct_index DROP NOT NULL;
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
// addQuestions/addFillBlankQuestions/addCodingQuestion afterward to build it
// up. Returns { domain } on success or { error } — never throws, so routes
// can turn `error` into an HTTP response.
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

// Exam paper WITHOUT correct answers (safe to send to a student). correct_index
// and accepted_answers are intentionally left out of the SELECT below --
// never just stripped client-side -- so a correct answer can never leak over
// the wire to a student.
async function getExamForStudent(domainId) {
  const meta = await getDomainMeta(domainId);
  if (!meta) return null;
  const { rows } = await pool.query(
    `SELECT local_id AS id, type, text, options,
            problem_statement AS "problemStatement",
            language, starter_code AS "starterCode", sample_output AS "sampleOutput"
     FROM questions WHERE domain_id = $1 ORDER BY local_id`,
    [domainId]
  );
  return { domainId: meta.id, title: meta.name, duration: meta.duration, questions: rows };
}

// Full question bank INCLUDING answers -- admin-only (Insights tab question
// picker, post-update question counts, etc).
async function getQuestionsWithAnswers(domainId) {
  const { rows } = await pool.query(
    `SELECT local_id AS id, type, text, options, correct_index AS "correctIndex",
            accepted_answers AS "acceptedAnswers",
            problem_statement AS "problemStatement",
            language, starter_code AS "starterCode", sample_output AS "sampleOutput"
     FROM questions WHERE domain_id = $1 ORDER BY local_id`,
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
        "INSERT INTO questions (domain_id, local_id, type, text, options, correct_index) VALUES ($1,$2,'mcq',$3,$4,$5)",
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

// Same append pattern as addQuestions, but for fill-in-the-blank questions:
// text carries the ___ blank inline, accepted_answers is the array of
// strings that count as correct (any one match, matched case/whitespace-
// insensitively at grading time in submitExam).
async function addFillBlankQuestions(domainId, newQuestions) {
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
        "INSERT INTO questions (domain_id, local_id, type, text, accepted_answers) VALUES ($1,$2,'fill_blank',$3,$4)",
        [domainId, startId + i, q.text, JSON.stringify(q.acceptedAnswers)]
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

// Coding questions are added one at a time from a form (title, language,
// problem statement, optional starter code / sample output), not parsed
// from pasted text like MCQ/fill-blank. `text` doubles as the question
// title so it lines up with how mcq/fill_blank use that column.
async function addCodingQuestion(domainId, { title, language, problemStatement, starterCode, sampleOutput }) {
  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(local_id), 0) AS max_id FROM questions WHERE domain_id = $1",
    [domainId]
  );
  const localId = rows[0].max_id + 1;

  await pool.query(
    `INSERT INTO questions (domain_id, local_id, type, text, language, problem_statement, starter_code, sample_output)
     VALUES ($1,$2,'coding',$3,$4,$5,$6,$7)`,
    [domainId, localId, title, language || null, problemStatement || null, starterCode || null, sampleOutput || null]
  );

  return getQuestionsWithAnswers(domainId);
}

// Removes one question (any type) from a domain's bank, addressed by its
// local_id (the same id the frontend already renders/keys questions by --
// see local_id's UNIQUE(domain_id, local_id) constraint). Used by the
// fill-blank and coding panels' delete buttons. Returns { error } if no such
// question exists, else the domain's remaining question list so the caller
// can update its UI without a second round trip.
async function deleteQuestion(domainId, localId) {
  const { rowCount } = await pool.query(
    "DELETE FROM questions WHERE domain_id = $1 AND local_id = $2",
    [domainId, localId]
  );
  if (rowCount === 0) return { error: "Question not found." };
  return { questions: await getQuestionsWithAnswers(domainId) };
}

async function submitExam({ studentId, name, domainId, answers, timeTaken, reason, violationCount, violations }) {
  const questions = await getQuestionsWithAnswers(domainId);

  // score/total only reflect auto-gradable questions (mcq + fill_blank).
  // Coding answers are stored verbatim below for manual review -- there's
  // no safe way to execute arbitrary submitted code here to check it -- so
  // they're excluded from both the numerator and the denominator rather
  // than silently counted wrong.
  let score = 0;
  let total = 0;
  questions.forEach((q) => {
    const studentAnswer = answers[q.id];
    if (q.type === "fill_blank") {
      total += 1;
      const accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
      const normalized = studentAnswer === undefined || studentAnswer === null ? "" : String(studentAnswer).trim().toLowerCase();
      if (normalized && accepted.some((a) => String(a).trim().toLowerCase() === normalized)) {
        score += 1;
      }
    } else if (q.type === "coding") {
      // not auto-graded -- intentionally left out of score/total
    } else {
      total += 1;
      if (studentAnswer === q.correctIndex) score += 1;
    }
  });

  const { rows } = await pool.query("SELECT 'R' || nextval('result_id_seq') AS result_id");
  const resultId = rows[0].result_id;
  const submittedAt = new Date().toISOString();
  const cleanViolationCount = Number.isFinite(violationCount) ? violationCount : 0;
  const cleanViolations = Array.isArray(violations) ? violations : [];

  await pool.query(
    `INSERT INTO results (result_id, student_id, name, domain_id, score, total, time_taken, reason, submitted_at, answers, violation_count, violations)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [resultId, studentId, name, domainId, score, total, timeTaken || "—", reason || "manual", submittedAt, JSON.stringify(answers), cleanViolationCount, JSON.stringify(cleanViolations)]
  );

  // One attempt per Employee ID: locks this account out of future logins.
  await pool.query("UPDATE students SET has_attempted = true WHERE id = $1", [studentId]);

  return {
    resultId,
    studentId,
    name,
    domainId,
    score,
    total,
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
// chart. Meaningful for both mcq and fill_blank questions; coding stays
// unclassified (see the loop below) since there's no safe way to
// auto-grade arbitrary submitted code here.
//
// The grading itself happens in JS rather than SQL because fill_blank
// answers need the same case/whitespace-insensitive "any accepted answer
// matches" comparison used at submit time (see submitExam above) -- that's
// awkward to express as a single SQL predicate, especially against a JSONB
// array of accepted answers. answers is stored as JSONB keyed by the
// question's local_id (as a string, since JSON object keys always are).
//
// $2 is bound to `q.local_id` with an explicit ::int cast (its natural
// type, since it's a JS Number) to match how it's used in the WHERE clause.
async function getQuestionStats(domainId, questionLocalId) {
  const { rows } = await pool.query(
    `SELECT q.type, q.text, q.options, q.correct_index AS "correctIndex",
            q.accepted_answers AS "acceptedAnswers",
            r.result_id AS "resultId", r.answers
     FROM questions q
     LEFT JOIN results r ON r.domain_id = q.domain_id
     WHERE q.domain_id = $1 AND q.local_id = $2::int`,
    [domainId, questionLocalId]
  );
  if (rows.length === 0) return null;

  const { type, text, options, correctIndex, acceptedAnswers } = rows[0];
  const acceptedNormalized = (Array.isArray(acceptedAnswers) ? acceptedAnswers : []).map((a) =>
    String(a).trim().toLowerCase()
  );
  const key = String(questionLocalId);

  let totalAttempts = 0;
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  for (const row of rows) {
    if (!row.resultId) continue; // LEFT JOIN found no results at all for this domain
    totalAttempts += 1;

    const answers = row.answers || {};
    if (!(key in answers)) {
      unanswered += 1;
      continue;
    }

    if (type === "coding") {
      // Not auto-gradable -- deliberately left uncounted (matches the prior
      // SQL's behavior for coding rows) rather than guessed at.
      continue;
    }

    const studentAnswer = answers[key];
    let isCorrect;
    if (type === "fill_blank") {
      const normalized =
        studentAnswer === undefined || studentAnswer === null ? "" : String(studentAnswer).trim().toLowerCase();
      isCorrect = normalized !== "" && acceptedNormalized.includes(normalized);
    } else {
      isCorrect = studentAnswer === correctIndex;
    }

    if (isCorrect) correct += 1;
    else wrong += 1;
  }

  return { type, text, options, correctIndex, totalAttempts, correct, wrong, unanswered };
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

  const questions = await getQuestionsWithAnswers(r.domainId);

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
  addFillBlankQuestions,
  addCodingQuestion,
  deleteQuestion,
  submitExam,
  getAllResults,
  getResultById,
  getResultsByStudent,
  getQuestionStats,
};
