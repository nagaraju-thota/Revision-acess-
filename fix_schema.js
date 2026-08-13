require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await pool.query(`ALTER TABLE public.domains RENAME COLUMN minutes TO duration;`);
  console.log("Renamed 'minutes' column to 'duration' successfully.");
  await pool.end();
})();
