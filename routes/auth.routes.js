const express = require("express");
const router = express.Router();
const db = require("../data/db");

// POST /api/auth/student/register
// body: { id, email, name, password } -> one account per Employee ID, ever.
router.post("/student/register", async (req, res, next) => {
  try {
    const { id, email, name, password } = req.body;
    const result = await db.registerStudent({ id, email, name, password });
    if (result.error) {
      const status = result.error.includes("already registered") ? 409 : 400;
      return res.status(status).json({ success: false, message: result.error });
    }
    return res.json({ success: true, student: { id: result.student.id, name: result.student.name } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/student/login
router.post("/student/login", async (req, res, next) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) {
      return res.status(400).json({ success: false, message: "Employee/Student ID and password are required." });
    }
    const student = await db.findStudent(id.trim().toUpperCase(), password);
    if (!student) {
      return res.status(401).json({ success: false, message: "Invalid student ID or password." });
    }
    // Still one exam ATTEMPT per Employee ID, ever -- but that's now enforced
    // at submission time (see the guard in routes/exam.routes.js POST
    // /submit), not at login. A student who's already completed their exam
    // can sign back in any time to reach their dashboard and re-download
    // their score/PDF -- they just can't start a second attempt from it.
    // hasAttempted is passed through so the frontend can land them straight
    // on the Completed tab instead of the exam picker.
    return res.json({
      success: true,
      student: { id: student.id, name: student.name, hasAttempted: student.hasAttempted },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin/login
router.post("/admin/login", async (req, res, next) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) {
      return res.status(400).json({ success: false, message: "Admin ID and password are required." });
    }
    const admin = await db.findAdmin(id.trim().toUpperCase(), password);
    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid admin ID or password." });
    }
    return res.json({ success: true, admin: { id: admin.id, name: admin.name } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
