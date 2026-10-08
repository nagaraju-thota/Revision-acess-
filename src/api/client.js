// Single place that knows how to talk to the backend. Swapping the base URL
// (e.g. for a deployed API) only ever needs to happen here.
const BASE_URL = import.meta.env.VITE_API_URL || "https://pebble-proofs-enlarging.ngrok-free.dev/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      // Skips the ngrok interstitial "visit site" warning page, which
      // otherwise returns HTML instead of JSON on the first request from a
      // new browser/machine and breaks res.json() below.
      "ngrok-skip-browser-warning": "true",
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Something went wrong. Please try again.");
  }
  return data;
}

// The backend stores fill-blank/coding questions as rows of the same
// `questions` table as MCQ (see backend data/db.js), keyed by `type`, so
// GET .../questions returns all three types mixed together with backend
// field names (acceptedAnswers, problemStatement, ...). These two mappers
// translate a backend row into the exact shape FillBlankPanel/CodingPanel
// were already written against (answers, title, prompt, ...), so those
// components don't need to change their render logic.
function toFillBlankShape(q) {
  return { id: q.id, text: q.text, answers: q.acceptedAnswers || [] };
}
function toCodingShape(q) {
  return {
    id: q.id,
    title: q.text,
    language: q.language || "javascript",
    prompt: q.problemStatement || "",
    starterCode: q.starterCode || "",
    sampleOutput: q.sampleOutput || "",
  };
}

export const api = {
  registerStudent: ({ id, email, name, password }) =>
    request("/auth/student/register", { method: "POST", body: JSON.stringify({ id, email, name, password }) }),

  studentLogin: (id, password) =>
    request("/auth/student/login", { method: "POST", body: JSON.stringify({ id, password }) }),

  adminLogin: (id, password) =>
    request("/auth/admin/login", { method: "POST", body: JSON.stringify({ id, password }) }),

  getDomains: () => request("/domains"),

  // studentId is optional but should be passed once a student is logged in
  // -- it's what lets the backend check that specific student's exam_override
  // once the global exam window's grace period has closed for everyone else
  // (see backend routes/domain.routes.js). Throws with the backend's
  // message (e.g. "This exam opens at ..." / "The window to start this exam
  // has closed...") when the window isn't open, which the caller already
  // surfaces via toast.error(err.message).
  getExam: (domainId, studentId) =>
    request(`/domains/${domainId}/exam${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`),

  // Response contract (used by ExamSubmitted.jsx for the post-exam score +
  // PDF download): { result: { resultId, studentId, name, domainId,
  // domainName, score, total, timeTaken, reason, submittedAt,
  // questions: [{ id, text, options, correctIndex, studentAnswer }],
  // violationCount, violations } } — the same shape /admin/results/:id
  // already returns. If the backend doesn't send a `result` yet, the UI
  // degrades gracefully to its old plain "submitted" confirmation.
  submitExam: (payload) =>
    request("/exam/submit", { method: "POST", body: JSON.stringify(payload) }),

  // This student's own completed attempts — powers the post-login dashboard's
  // "Completed" tab. Summary shape only (no per-question detail).
  getMyResults: (studentId) => request(`/exam/results/${studentId}`),

  // Full detail for one of this student's own attempts (score, per-question
  // correct/incorrect, violations) — used to (re)build the downloadable PDF
  // from the dashboard without needing to re-submit.
  getMyResultDetail: (studentId, resultId) => request(`/exam/results/${studentId}/${resultId}`),

  getAllResults: () => request("/admin/results"),

  getResultDetail: (resultId) => request(`/admin/results/${resultId}`),

  previewQuestions: (domainId, text) =>
    request(`/admin/domains/${domainId}/questions/preview`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  publishQuestions: (domainId, text) =>
    request(`/admin/domains/${domainId}/questions`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  // ---- Fill in the blank ----
  // Same paste-and-parse flow as MCQ, against /questions/fill-blank instead.
  getFillBlankQuestions: (domainId) =>
    request(`/admin/domains/${domainId}/questions`).then((data) =>
      (data.questions || []).filter((q) => q.type === "fill_blank").map(toFillBlankShape)
    ),

  publishFillBlankQuestions: (domainId, text) =>
    request(`/admin/domains/${domainId}/questions/fill-blank`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }).then((data) => ({
      published: data.published,
      questions: (data.questions || []).filter((q) => q.type === "fill_blank").map(toFillBlankShape),
    })),

  deleteFillBlankQuestion: (domainId, questionId) =>
    request(`/admin/domains/${domainId}/questions/${questionId}`, { method: "DELETE" }).then((data) => ({
      questions: (data.questions || []).filter((q) => q.type === "fill_blank").map(toFillBlankShape),
    })),

  // ---- Coding ----
  // Structured, one question at a time, against /questions/coding.
  getCodingQuestions: (domainId) =>
    request(`/admin/domains/${domainId}/questions`).then((data) =>
      (data.questions || []).filter((q) => q.type === "coding").map(toCodingShape)
    ),

  addCodingQuestion: (domainId, { title, language, prompt, starterCode, sampleOutput }) =>
    request(`/admin/domains/${domainId}/questions/coding`, {
      method: "POST",
      body: JSON.stringify({ title, language, problemStatement: prompt, starterCode, sampleOutput }),
    }).then((data) => ({
      questions: (data.questions || []).filter((q) => q.type === "coding").map(toCodingShape),
    })),

  deleteCodingQuestion: (domainId, questionId) =>
    request(`/admin/domains/${domainId}/questions/${questionId}`, { method: "DELETE" }).then((data) => ({
      questions: (data.questions || []).filter((q) => q.type === "coding").map(toCodingShape),
    })),

  // Runs a student's code through the backend's /exam/run-code endpoint
  // (which forwards to Piston, a sandboxed code-execution API) and returns
  // { stdout, stderr, exitCode }. Powers the "Run" button on coding
  // questions — output only, not used for grading.
  runCode: (language, code, stdin) =>
    request(`/exam/run-code`, {
      method: "POST",
      body: JSON.stringify({ language, code, stdin }),
    }),

  // durationSeconds: new exam timer for that domain, in seconds.
  updateDomainDuration: (domainId, durationSeconds) =>
    request(`/admin/domains/${domainId}/duration`, {
      method: "PUT",
      body: JSON.stringify({ duration: durationSeconds }),
    }),

  // durationSeconds: exam timer for the new domain, in seconds. id is
  // optional — auto-slugified from name on the backend if omitted.
  addDomain: ({ id, name, description, duration }) =>
    request("/admin/domains", {
      method: "POST",
      body: JSON.stringify({ id, name, description, duration }),
    }),

  // Partial update — pass only the fields that changed. duration is in
  // seconds. The domain's id never changes.
  updateDomain: (domainId, { name, description, duration }) =>
    request(`/admin/domains/${domainId}`, {
      method: "PUT",
      body: JSON.stringify({ name, description, duration }),
    }),

  deleteDomain: (domainId) => request(`/admin/domains/${domainId}`, { method: "DELETE" }),

  // That domain's full saved question bank (with correct answers) — used
  // to populate the Insights tab's question picker. Includes mcq, fill_blank
  // and coding rows, distinguished by q.type.
  getDomainQuestions: (domainId) => request(`/admin/domains/${domainId}/questions`),

  // Correct/wrong/unanswered counts for one question across every result
  // ever submitted for its domain — powers the Insights tab's pie chart.
  // Meaningful for mcq and fill_blank questions; coding stays unclassified
  // (not auto-gradable) — see backend db.getQuestionStats.
  getQuestionStats: (domainId, questionId) =>
    request(`/admin/domains/${domainId}/questions/${questionId}/stats`),

  // ---- Exam schedule ----
  // Global window: { startTime: ISO string | null, graceMinutes: number }.
  // startTime null means no schedule set -- exams are always open.
  getExamSchedule: () => request("/admin/exam-schedule"),

  // startTime: ISO string (already converted to the browser's local time --
  // see ExamScheduleTab.jsx) or null to clear the schedule and reopen exams
  // immediately for everyone. graceMinutes: minutes after startTime that
  // late logins are still let in.
  setExamSchedule: ({ startTime, graceMinutes }) =>
    request("/admin/exam-schedule", {
      method: "PUT",
      body: JSON.stringify({ startTime, graceMinutes }),
    }),

  // Grants (override: true) or revokes (override: false) one student's
  // ability to start an exam even after the grace period above has closed.
  setStudentOverride: (studentId, override) =>
    request(`/admin/students/${encodeURIComponent(studentId)}/override`, {
      method: "PUT",
      body: JSON.stringify({ override }),
    }),
};
