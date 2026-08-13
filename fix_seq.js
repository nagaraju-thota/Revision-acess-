require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS domains_seq_seq OWNED BY public.domains.seq;
    ALTER TABLE public.domains ALTER COLUMN seq SET DEFAULT nextval('domains_seq_seq');
    SELECT setval('domains_seq_seq', 1, false);
  `);
  console.log("Fixed 'seq' column to auto-increment properly.");
  await pool.end();
})();
