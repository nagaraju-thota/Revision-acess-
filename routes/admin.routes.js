const express = require("express");
const router = express.Router();
const db = require("../data/db");
const { parseMCQText } = require("../utils/parseMCQ");
const { parseFillBlankText } = require("../utils/parseFillBlank");

// GET /api/admin/results -> every submitted attempt, across all domains
router.get("/results", async (req, res, next) => {
  try {
    res.json({ results: await db.getAllResults() });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/results/:resultId -> full detail incl. correct/incorrect per question
router.get("/results/:resultId", async (req, res, next) => {
  try {
    const result = await db.getResultById(req.params.resultId);
    if (!result) return res.status(404).json({ message: "Result not found." });
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/domains/:domainId/questions -> that domain's full saved
// question bank (with correct answers) -- used to populate the Insights
// tab's question picker. Rows may be mcq, fill_blank or coding (see `type`).
router.get("/domains/:domainId/questions", async (req, res, next) => {
  try {
    const questions = await db.getQuestionsWithAnswers(req.params.domainId);
    res.json({ questions });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/domains/:domainId/questions/:questionId/stats -> how many
// submitted attempts got this specific question right/wrong/unanswered,
// across every result for that domain. Powers the Insights tab's pie
// chart. questionId here is the question's local_id (its position within
// the domain), not the questions table's internal serial id. mcq and
// fill_blank questions both get a meaningful correct/wrong split; coding
// questions don't (not auto-gradable) -- see the comment above
// db.getQuestionStats.
router.get("/domains/:domainId/questions/:questionId/stats", async (req, res, next) => {
  try {
    const localId = Number(req.params.questionId);
    if (!Number.isInteger(localId)) {
      return res.status(400).json({ message: "questionId must be an integer." });
    }
    const stats = await db.getQuestionStats(req.params.domainId, localId);
    if (!stats) return res.status(404).json({ message: "Question not found." });
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// ---- Multiple choice ------------------------------------------------------

// POST /api/admin/domains/:domainId/questions/preview
// body: { text } -> parses only, does not save. Used for the live preview panel.
router.post("/domains/:domainId/questions/preview", (req, res) => {
  const { text } = req.body;
  const { questions, errors } = parseMCQText(text || "");
  res.json({ questions, errors });
});

// POST /api/admin/domains/:domainId/questions
// body: { text } -> parses AND appends to that domain's question bank.
router.post("/domains/:domainId/questions", async (req, res, next) => {
  try {
    const domain = await db.getDomainMeta(req.params.domainId);
    if (!domain) return res.status(404).json({ message: "Domain not found." });

    const { text } = req.body;
    const { questions, errors } = parseMCQText(text || "");
    if (questions.length === 0) {
      return res.status(400).json({ message: "No valid questions to publish.", errors });
    }
    const updated = await db.addQuestions(req.params.domainId, questions);
    res.json({ published: questions.length, questions: updated });
  } catch (err) {
    next(err);
  }
});

// ---- Fill in the blank ------------------------------------------------------

// POST /api/admin/domains/:domainId/questions/fill-blank/preview
// body: { text } -> parses only, does not save. Used for the live preview panel.
router.post("/domains/:domainId/questions/fill-blank/preview", (req, res) => {
  const { text } = req.body;
  const { questions, errors } = parseFillBlankText(text || "");
  res.json({ questions, errors });
});

// POST /api/admin/domains/:domainId/questions/fill-blank
// body: { text } -> parses AND appends fill-in-the-blank questions to that
// domain's question bank.
router.post("/domains/:domainId/questions/fill-blank", async (req, res, next) => {
  try {
    const domain = await db.getDomainMeta(req.params.domainId);
    if (!domain) return res.status(404).json({ message: "Domain not found." });

    const { text } = req.body;
    const { questions, errors } = parseFillBlankText(text || "");
    if (questions.length === 0) {
      return res.status(400).json({ message: "No valid questions to publish.", errors });
    }
    const updated = await db.addFillBlankQuestions(req.params.domainId, questions);
    res.json({ published: questions.length, questions: updated });
  } catch (err) {
    next(err);
  }
});

// ---- Coding ------------------------------------------------------

// POST /api/admin/domains/:domainId/questions/coding
// body: { title, language, problemStatement, starterCode?, sampleOutput? } ->
// adds a single coding question to that domain's question bank. One question
// per call (the "Add coding question" form adds them one at a time).
router.post("/domains/:domainId/questions/coding", async (req, res, next) => {
  try {
    const domain = await db.getDomainMeta(req.params.domainId);
    if (!domain) return res.status(404).json({ message: "Domain not found." });

    const { title, language, problemStatement, starterCode, sampleOutput } = req.body;
    const cleanTitle = (title || "").trim();
    const cleanProblem = (problemStatement || "").trim();
    const errors = [];
    if (!cleanTitle) errors.push("Title is required.");
    if (!cleanProblem) errors.push("Problem statement is required.");
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const updated = await db.addCodingQuestion(req.params.domainId, {
      title: cleanTitle,
      language: (language || "").trim() || "JavaScript",
      problemStatement: cleanProblem,
      starterCode: (starterCode || "").trim(),
      sampleOutput: (sampleOutput || "").trim(),
    });
    res.json({ published: 1, questions: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/domains/:domainId/questions/:questionId
// Removes one question (any type -- mcq, fill_blank, or coding) from that
// domain's bank. questionId is the question's local_id, same as everywhere
// else in this file. Powers the delete button on the fill-blank and coding
// panels.
router.delete("/domains/:domainId/questions/:questionId", async (req, res, next) => {
  try {
    const localId = Number(req.params.questionId);
    if (!Number.isInteger(localId)) {
      return res.status(400).json({ message: "questionId must be an integer." });
    }
    const result = await db.deleteQuestion(req.params.domainId, localId);
    if (result.error) return res.status(404).json({ message: result.error });
    res.json({ deleted: true, questions: result.questions });
  } catch (err) {
    next(err);
  }
});

// ---- Domains ------------------------------------------------------

// POST /api/admin/domains
// body: { id?, name, description, duration } duration in SECONDS -> creates
// a new domain (starts with zero questions). id is optional; auto-slugified
// from name if omitted.
router.post("/domains", async (req, res, next) => {
  try {
    const { id, name, description, duration } = req.body;
    const result = await db.addDomain({ id, name, description, duration });
    if (result.error) return res.status(400).json({ message: result.error });
    res.json({ domain: { ...result.domain, questionCount: 0 } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/domains/:domainId/duration
// body: { duration } -> duration in SECONDS. Sets that domain's exam timer.
router.put("/domains/:domainId/duration", async (req, res, next) => {
  try {
    const seconds = Number(req.body.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return res.status(400).json({ message: "duration must be a positive number of seconds." });
    }
    const domain = await db.updateDomainDuration(req.params.domainId, Math.round(seconds));
    if (!domain) return res.status(404).json({ message: "Domain not found." });
    res.json({ domain });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/domains/:domainId
// body: any of { name, description, duration } (duration in SECONDS) ->
// partial update. The domain's id/URL never changes.
router.put("/domains/:domainId", async (req, res, next) => {
  try {
    const { name, description, duration } = req.body;
    const result = await db.updateDomain(req.params.domainId, { name, description, duration });
    if (result.error) {
      const status = result.error === "Domain not found." ? 404 : 400;
      return res.status(status).json({ message: result.error });
    }
    const questions = await db.getQuestionsWithAnswers(result.domain.id);
    res.json({ domain: { ...result.domain, questionCount: questions.length } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/domains/:domainId
// Removes the domain and its question bank. Past results referencing it are
// kept (shown with the raw domain id once the name is gone).
router.delete("/domains/:domainId", async (req, res, next) => {
  try {
    const result = await db.deleteDomain(req.params.domainId);
    if (result.error) return res.status(404).json({ message: result.error });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
