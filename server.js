module.exports = app;

if (require.main === module) {
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
}
