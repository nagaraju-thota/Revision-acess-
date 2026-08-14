const express = require("express");
const router = express.Router();
const db = require("../data/db");

// POST /api/exam/submit
// body: { studentId, name, domainId, answers: { [questionId]: optionIndex },
//         timeTaken, reason, violationCount, violations }
// violations is the anti-cheat log: [{ type, timestamp, violationNumber, action }]
router.post("/submit", async (req, res, next) => {
  try {
    const { studentId, name, domainId, answers, timeTaken, reason, violationCount, violations } = req.body;
    if (!studentId || !domainId || !answers) {
      return res.status(400).json({ message: "studentId, domainId and answers are required." });
    }
    const domain = await db.getDomainMeta(domainId);
    if (!domain) return res.status(404).json({ message: "Domain not found." });

    // Server-side backstop for the one-attempt-per-Employee-ID rule. Login no
    // longer blocks a returning student (see routes/auth.routes.js), and the
    // dashboard's UI already hides the "start exam" option once completed --
    // this just makes sure a second submission can't be recorded even if
    // someone calls the API directly.
    const priorAttempts = await db.getResultsByStudent(studentId);
    if (priorAttempts.length > 0) {
      return res.status(409).json({ message: "This Employee ID has already completed its one exam attempt." });
    }

    const result = await db.submitExam({ studentId, name, domainId, answers, timeTaken, reason, violationCount, violations });
    // Students now get their own score + full answer breakdown back immediately
    // (previously only the admin could see this). Reuses the exact same
    // db.getResultById the admin /results/:resultId route already calls, so the
    // shape is identical -- { resultId, studentId, name, domainId, domainName,
    // score, total, timeTaken, reason, submittedAt, questions: [{ id, text,
    // options, correctIndex, studentAnswer }], violationCount, violations } --
    // which is what the frontend ExamSubmitted screen and PDF download expect.
    const fullResult = await db.getResultById(result.resultId);
    res.json({ submitted: true, resultId: result.resultId, result: fullResult });
  } catch (err) {
    next(err);
  }
});

// Language ids the frontend's coding panel already uses (see
// CodingPanel.jsx's LANGUAGES list) mapped to JDoodle's language code +
// versionIndex (https://www.jdoodle.com/docs/compiler-apis/supported-languages-versions,
// checked when this was written). JDoodle adds new runtime versions over
// time without bumping these indices for you, so if a language starts
// erroring with something like "invalid version index", check that page and
// update the number here -- it won't happen often.
const JDOODLE_LANGUAGES = {
  javascript: { language: "nodejs", versionIndex: "7" }, // Node.js 25.x
  python: { language: "python3", versionIndex: "6" }, // Python 3.14.x
  java: { language: "java", versionIndex: "6" }, // JDK 25.x
  cpp: { language: "cpp", versionIndex: "7" }, // GCC 15.x
};

// POST /api/exam/run-code
// body: { language, code, stdin? } -> runs the student's code through
// JDoodle's Compiler API (https://www.jdoodle.com/compiler-api) and returns
// its output. This is what powers the "Run" button on coding questions --
// lets a student execute their code without ever leaving the exam tab (an
// <iframe> to a real online-compiler site wouldn't work here: most block
// being framed, and sending the student to an external site would trip the
// anti-cheat tab/blur detection anyway). Output is just shown to the
// student, exactly like Programiz -- it's not compared against the
// question's sampleOutput or used for grading (that field is a loose,
// human-readable string like `reverseString("hello") → "olleh"`, not a
// strict expected value).
//
// Previously this called Piston's free public API, which went
// whitelist-only in Feb 2026 (https://github.com/engineer-man/piston#public-api)
// and now 401s every request. JDoodle's free tier needs credentials --
// sign up at https://www.jdoodle.com, then add JDOODLE_CLIENT_ID and
// JDOODLE_CLIENT_SECRET to this backend's .env. Its free plan has a daily
// execution cap (check your JDoodle dashboard for the current number) --
// once that's exhausted for the day, Run will start failing with the
// "not configured" message below until it resets.
router.post("/run-code", async (req, res, next) => {
  try {
    const { language, code, stdin } = req.body;
    const runtime = JDOODLE_LANGUAGES[language];
    if (!runtime) {
      return res.status(400).json({ message: `Unsupported language: ${language}` });
    }
    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ message: "Code is required." });
    }
    if (code.length > 20000) {
      return res.status(400).json({ message: "Code is too long to run (20,000 character limit)." });
    }

    const clientId = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[run-code] JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET are not set in .env");
      return res.status(500).json({
        message: "The code runner isn't configured yet -- add JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET to the backend's .env (free signup at jdoodle.com).",
      });
    }

    let jdoodleRes;
    try {
      // No official uptime guarantee -- an AbortController timeout keeps a
      // slow/hung upstream from tying up this request indefinitely.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      jdoodleRes = await fetch("https://api.jdoodle.com/v1/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          clientSecret,
          script: code,
          stdin: typeof stdin === "string" ? stdin : "",
          language: runtime.language,
          versionIndex: runtime.versionIndex,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch (fetchErr) {
      // Logged server-side (not just returned to the browser) so whoever's
      // running this backend can see the real cause -- DNS failure, TLS
      // error, network firewall blocking api.jdoodle.com, etc. -- in their
      // own terminal without needing browser devtools.
      console.error("[run-code] fetch to JDoodle failed:", fetchErr);
      return res.status(502).json({
        message: `The code runner didn't respond (${fetchErr.name === "AbortError" ? "timed out after 15s" : fetchErr.message}). Try again.`,
      });
    }

    if (!jdoodleRes.ok) {
      const bodyText = await jdoodleRes.text().catch(() => "");
      console.error("[run-code] JDoodle returned", jdoodleRes.status, bodyText.slice(0, 500));
      // 401 here almost always means clientId/clientSecret are wrong;
      // JDoodle also 429s once the day's free-tier execution cap is used up.
      return res.status(502).json({
        message: `The code runner returned an error (HTTP ${jdoodleRes.status}). ${bodyText.slice(0, 200) || "Try again in a moment."}`,
      });
    }

    const data = await jdoodleRes.json();
    // JDoodle merges stdout and compiler/runtime errors into one `output`
    // string rather than splitting them like Piston did -- `error` is only
    // populated for request-level failures (bad credentials/language), and
    // isCompiled/isExecutionSuccess (when present) flag a real failed run.
    const failed = !!data.error || data.isCompiled === false || data.isExecutionSuccess === false;
    res.json({
      stdout: failed ? "" : (data.output || ""),
      stderr: failed ? (data.error || data.output || "Execution failed.") : "",
      exitCode: data.statusCode ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/exam/results/:studentId
// Summary list of this student's own completed attempts, for the post-login
// dashboard's "Completed" tab. Same shape as db.getAllResults, just scoped
// to one student -- no per-question detail here (that's the next route).
router.get("/results/:studentId", async (req, res, next) => {
  try {
    const results = await db.getResultsByStudent(req.params.studentId);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// GET /api/exam/results/:studentId/:resultId
// Full detail (score, per-question correct/incorrect, violations) for one of
// this student's own attempts -- lets the dashboard regenerate the PDF on
// demand without needing to re-submit. Reuses db.getResultById (the same
// function the admin dashboard already uses) and just checks the result
// actually belongs to the requesting studentId before returning it, since
// this app has no session/auth-token layer to enforce that automatically.
router.get("/results/:studentId/:resultId", async (req, res, next) => {
  try {
    const result = await db.getResultById(req.params.resultId);
    if (!result || result.studentId !== req.params.studentId) {
      return res.status(404).json({ message: "Result not found." });
    }
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
