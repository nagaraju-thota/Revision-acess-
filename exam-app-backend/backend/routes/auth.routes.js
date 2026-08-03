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
    // One login-and-attempt per Employee ID, ever.
    if (student.hasAttempted) {
      return res.status(403).json({
        success: false,
        message: "This Employee ID has already completed its one exam attempt and can't sign in again.",
      });
    }
    return res.json({ success: true, student: { id: student.id, name: student.name } });
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
