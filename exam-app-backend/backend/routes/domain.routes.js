const express = require("express");
const router = express.Router();
const db = require("../data/db");

// GET /api/domains  -> list of domains the student can pick from
router.get("/", async (req, res, next) => {
  try {
    res.json({ domains: await db.getDomains() });
  } catch (err) {
    next(err);
  }
});

// GET /api/domains/:domainId/exam -> question paper for that domain (no answers)
router.get("/:domainId/exam", async (req, res, next) => {
  try {
    const exam = await db.getExamForStudent(req.params.domainId);
    if (!exam) return res.status(404).json({ message: "Domain not found." });
    res.json({ exam });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
