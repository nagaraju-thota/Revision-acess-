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

    const result = await db.submitExam({ studentId, name, domainId, answers, timeTaken, reason, violationCount, violations });
    // Student never gets the score back — only admin sees it (matches product rule
    // that results go to the manager, not the employee).
    res.json({ submitted: true, resultId: result.resultId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
