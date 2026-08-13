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
