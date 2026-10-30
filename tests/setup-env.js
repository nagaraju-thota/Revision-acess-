// data/pool.js throws at require-time if DATABASE_URL is missing. pg's Pool
// connects lazily, so a dummy URL is enough -- no test ever opens a real
// connection (data/pool.js is mocked in db.test.js, data/db.js everywhere else).
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
