require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const tables = ["students", "admins", "domains", "questions", "results"];
  for (const t of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${t}`);
    console.log(`${t}: ${rows[0].count} rows`);
  }
  const { rows: resultIds } = await pool.query("SELECT result_id FROM results ORDER BY result_id");
  console.log("Result IDs currently in DB:", resultIds.map(r => r.result_id));
  await pool.end();
})();
