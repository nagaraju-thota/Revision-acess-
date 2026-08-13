require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const students = [
      { id: "EMP1001", password: "pass1001", name: "Ravi Kumar", email: "ravi.kumar@example.com", hasAttempted: true },
      { id: "EMP1002", password: "pass1002", name: "Ananya Rao", email: "ananya.rao@example.com", hasAttempted: true },
      { id: "EMP1003", password: "pass1003", name: "Divya Shah", email: "divya.shah@example.com", hasAttempted: true },
      { id: "EMP1004", password: "pass1004", name: "Karthik Iyer", email: "karthik.iyer@example.com", hasAttempted: false },
      { id: "STUDENT1", password: "student123", name: "Test Student", email: "test.student@example.com", hasAttempted: false },
    ];
    for (const s of students) {
      await client.query(
        "INSERT INTO students (id, password, name, email, has_attempted) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [s.id, s.password, s.name, s.email, s.hasAttempted]
      );
    }

    await client.query(
      "INSERT INTO admins (id, password, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING",
      ["ADMIN1", "admin123", "Portal Admin"]
    );

    const domains = [
      { id: "python-fullstack", name: "Python Full Stack", description: "Python, Django/Flask basics, REST APIs and full-stack fundamentals.", duration: 20 * 60 },
      { id: "frontend", name: "Frontend Development", description: "HTML, CSS, JavaScript, React and general UI fundamentals.", duration: 15 * 60 },
      { id: "backend", name: "Backend Development", description: "APIs, servers, HTTP, authentication and system design basics.", duration: 20 * 60 },
      { id: "database", name: "Database", description: "SQL, NoSQL, indexing, transactions and schema design.", duration: 15 * 60 },
    ];
    for (const d of domains) {
      await client.query(
        "INSERT INTO domains (id, name, description, duration) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING",
        [d.id, d.name, d.description, d.duration]
      );
    }

    const questionsByDomain = {
      "python-fullstack": [
        { id: 1, text: "Which keyword is used to define a function in Python?", options: ["func", "def", "function", "lambda"], correctIndex: 1 },
        { id: 2, text: "Which of these is a Python web framework?", options: ["Django", "Laravel", "Spring", "Rails"], correctIndex: 0 },
        { id: 3, text: "What does 'pip' stand for/refer to in Python?", options: ["Python Installer Package", "Pip Installs Packages", "Python Internal Program", "Package Index Python"], correctIndex: 1 },
        { id: 4, text: "Which data type is immutable in Python?", options: ["List", "Dictionary", "Tuple", "Set"], correctIndex: 2 },
        { id: 5, text: "Which HTTP method is typically used to fetch data in a REST API?", options: ["GET", "SET", "FETCH", "PULL"], correctIndex: 0 },
      ],
      frontend: [
        { id: 1, text: "Which HTML tag is used to link an external CSS file?", options: ["<style>", "<script>", "<link>", "<css>"], correctIndex: 2 },
        { id: 2, text: "In React, what is used to pass data to a component from outside?", options: ["State", "Props", "Refs", "Context only"], correctIndex: 1 },
        { id: 3, text: "Which CSS property controls the space between flex items?", options: ["gap", "margin-flex", "space-between-items", "flex-space"], correctIndex: 0 },
        { id: 4, text: "Which array method creates a new array with transformed elements?", options: ["forEach", "map", "filter", "reduce"], correctIndex: 1 },
        { id: 5, text: "What does the React useEffect hook let you do?", options:["Declare component state", "Run side effects after render", "Style a component","Define routes"], correctIndex: 1 },
      ],
      backend: [
        { id: 1, text: "Which HTTP status code indicates a successful resource creation?", options: ["200 OK", "201 Created", "204 No Content", "301 Moved Permanently"], correctIndex: 1 },
        { id: 2, text: "In a relational database, what does a foreign key enforce?", options: ["Uniqueness of a column", "A link between two tables", "Encryption of stored data", "Automatic indexing"], correctIndex: 1 },
        { id: 3, text: "Which of these is NOT a valid HTTP method?", options: ["PATCH", "DELETE", "FETCH", "PUT"], correctIndex: 2 },
        { id: 4, text: "What is the primary purpose of a load balancer?", options: ["Store session data", "Distribute traffic across servers", "Compress API responses", "Validate user input"], correctIndex: 1 },
        { id: 5, text: "Which data structure does a typical message queue use?", options: ["Stack (LIFO)", "Queue (FIFO)", "Binary tree", "Hash map"], correctIndex: 1 },
      ],
      database: [
        { id: 1, text: "Which SQL clause is used to filter rows before grouping?", options: ["HAVING", "WHERE", "GROUP", "FILTER"], correctIndex: 1 },
        { id: 2, text: "What does ACID stand for in database transactions?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Index, Data", "Atomic, Cached, Indexed, Durable", "Asynchronous, Concurrent, Isolated, Distributed"], correctIndex: 0 },
        { id: 3, text: "Which type of database is MongoDB?", options: ["Relational", "Document-oriented NoSQL", "Graph", "Columnar"], correctIndex: 1 },
        { id: 4, text: "What is the purpose of an index in a database table?", options: ["Encrypt the table", "Speed up data retrieval", "Enforce foreign keys", "Reduce storage size"], correctIndex: 1 },
        { id: 5, text: "Which SQL join returns only matching rows from both tables?", options: ["LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL OUTER JOIN"], correctIndex: 2 },
      ],
    };
    for (const [domainId, qs] of Object.entries(questionsByDomain)) {
      for (const q of qs) {
        await client.query(
          "INSERT INTO questions (domain_id, local_id, text, options, correct_index) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (domain_id, local_id) DO NOTHING",
          [domainId, q.id, q.text, JSON.stringify(q.options), q.correctIndex]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Re-seeded students, admins, domains, questions. Results table left untouched.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed:", err.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
