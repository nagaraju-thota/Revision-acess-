require("dotenv").config();
const express = require("express");
const cors = require("cors");

const db = require("./data/db");
const authRoutes = require("./routes/auth.routes");
const domainRoutes = require("./routes/domain.routes");
const examRoutes = require("./routes/exam.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ message: "Not found." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Exam portal API running on http://localhost:${PORT}`);
      console.log("Connected to Postgres.");
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
