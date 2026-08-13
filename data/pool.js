// Single shared Postgres connection pool (AWS RDS). Every query in data/db.js
// goes through this pool instead of the old in-memory/JSON-file store.
require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to backend/.env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // RDS's pg_hba.conf rejects unencrypted connections; its cert chain isn't
  // in Node's default trust store, so full verification is skipped.
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
