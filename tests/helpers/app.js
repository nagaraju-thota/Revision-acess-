const express = require("express");

// Mounts one router on a bare express app (same JSON parsing + error handler
// as server.js) so each route file can be tested in isolation.
function appWith(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => res.status(500).json({ message: "Internal server error." }));
  return app;
}

module.exports = { appWith };
