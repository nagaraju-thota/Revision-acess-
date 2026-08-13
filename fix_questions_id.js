require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await pool.query(`
    CREATE SEQUENCE IF NOT EXISTS questions_id_seq OWNED BY public.questions.id;
    ALTER TABLE public.questions ALTER COLUMN id SET DEFAULT nextval('questions_id_seq');
    SELECT setval('questions_id_seq', 1, false);
  `);
  console.log("Fixed 'id' column on questions table to auto-increment properly.");
  await pool.end();
})();
