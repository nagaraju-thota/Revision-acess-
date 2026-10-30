// All Postgres access goes through data/pool.js, so mocking it lets us unit
// test every db.js function without a real database.
jest.mock("../../data/pool", () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const pool = require("../../data/pool");
const db = require("../../data/db");

const rows = (...r) => ({ rows: r, rowCount: r.length });

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

describe("init", () => {
  it("creates tables and seeds the admin when the admins table is empty", async () => {
    pool.query
      .mockResolvedValueOnce({}) // CREATE TABLE ...
      .mockResolvedValueOnce({}) // ALTER TABLE ...
      .mockResolvedValueOnce(rows({ count: 0 })) // SELECT COUNT
      .mockResolvedValueOnce({}); // INSERT admin
    await db.init();
    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(pool.query.mock.calls[3][0]).toMatch(/INSERT INTO admins/);
    expect(pool.query.mock.calls[3][1]).toEqual(["ADMIN1", "admin123", "Portal Admin"]);
  });

  it("does not reseed when an admin already exists", async () => {
    pool.query.mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce(rows({ count: 1 }));
    await db.init();
    expect(pool.query).toHaveBeenCalledTimes(3);
  });
});

describe("findStudent / findAdmin", () => {
  it("returns the matching student row", async () => {
    pool.query.mockResolvedValue(rows({ id: "S1", name: "A", hasAttempted: false }));
    await expect(db.findStudent("S1", "pw")).resolves.toEqual({ id: "S1", name: "A", hasAttempted: false });
    expect(pool.query.mock.calls[0][1]).toEqual(["S1", "pw"]);
  });

  it("returns null when no student matches", async () => {
    pool.query.mockResolvedValue(rows());
    await expect(db.findStudent("S1", "bad")).resolves.toBeNull();
  });

  it("returns the matching admin, or null", async () => {
    pool.query.mockResolvedValueOnce(rows({ id: "ADMIN1", name: "Admin" }));
    await expect(db.findAdmin("ADMIN1", "pw")).resolves.toEqual({ id: "ADMIN1", name: "Admin" });
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.findAdmin("X", "pw")).resolves.toBeNull();
  });
});

describe("registerStudent", () => {
  const valid = { id: " emp1 ", email: " a@b.co ", name: " Ann ", password: "secret1" };

  it("requires all fields", async () => {
    for (const bad of [{ ...valid, id: "" }, { ...valid, email: "" }, { ...valid, name: " " }, { ...valid, password: "" }]) {
      await expect(db.registerStudent(bad)).resolves.toEqual({
        error: "Employee ID, email, name and password are all required.",
      });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    await expect(db.registerStudent({ ...valid, email: "not-an-email" })).resolves.toEqual({
      error: "Enter a valid email address.",
    });
  });

  it("rejects passwords shorter than 6 characters", async () => {
    await expect(db.registerStudent({ ...valid, password: "12345" })).resolves.toEqual({
      error: "Password must be at least 6 characters.",
    });
  });

  it("rejects an already-registered ID", async () => {
    pool.query.mockResolvedValueOnce(rows({ "?column?": 1 }));
    const res = await db.registerStudent(valid);
    expect(res.error).toMatch(/already registered/);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it("inserts a trimmed, upper-cased student and returns it", async () => {
    pool.query.mockResolvedValueOnce(rows()).mockResolvedValueOnce({});
    const res = await db.registerStudent(valid);
    expect(res.student).toEqual({ id: "EMP1", email: "a@b.co", name: "Ann", password: "secret1", hasAttempted: false });
    expect(pool.query.mock.calls[1][1]).toEqual(["EMP1", "secret1", "Ann", "a@b.co"]);
  });
});

describe("domains", () => {
  it("getDomains returns rows", async () => {
    pool.query.mockResolvedValue(rows({ id: "java", questionCount: 3 }));
    await expect(db.getDomains()).resolves.toEqual([{ id: "java", questionCount: 3 }]);
  });

  it("getDomainMeta returns the row or null", async () => {
    pool.query.mockResolvedValueOnce(rows({ id: "java" }));
    await expect(db.getDomainMeta("java")).resolves.toEqual({ id: "java" });
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.getDomainMeta("nope")).resolves.toBeNull();
  });

  it("updateDomainDuration returns the updated row or null", async () => {
    pool.query.mockResolvedValueOnce(rows({ id: "java", duration: 900 }));
    await expect(db.updateDomainDuration("java", 900)).resolves.toEqual({ id: "java", duration: 900 });
    expect(pool.query.mock.calls[0][1]).toEqual(["java", 900]);
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.updateDomainDuration("nope", 900)).resolves.toBeNull();
  });

  describe("addDomain", () => {
    it("requires a name", async () => {
      await expect(db.addDomain({ name: "  ", duration: 60 })).resolves.toEqual({ error: "Domain name is required." });
    });

    it.each([[0], [-5], ["abc"], [undefined], [Infinity]])("rejects duration %p", async (duration) => {
      const res = await db.addDomain({ name: "Java", duration });
      expect(res.error).toMatch(/positive number of seconds/);
    });

    it("errors when no valid id can be generated", async () => {
      await expect(db.addDomain({ name: "!!!", duration: 60 })).resolves.toEqual({
        error: "Could not generate a valid ID for this domain.",
      });
    });

    it("errors when the id already exists", async () => {
      pool.query.mockResolvedValueOnce(rows({ x: 1 }));
      const res = await db.addDomain({ name: "Java Basics", duration: 60 });
      expect(res.error).toBe('A domain with ID "java-basics" already exists.');
    });

    it("slugifies the name, trims fields and rounds the duration", async () => {
      pool.query.mockResolvedValueOnce(rows()).mockResolvedValueOnce({});
      const res = await db.addDomain({ name: "  Java & Spring!  ", description: " desc ", duration: 90.6 });
      expect(res).toEqual({ domain: { id: "java-spring", name: "Java & Spring!", description: "desc", duration: 91 } });
      expect(pool.query.mock.calls[1][1]).toEqual(["java-spring", "Java & Spring!", "desc", 91]);
    });

    it("prefers a provided id over the name slug", async () => {
      pool.query.mockResolvedValueOnce(rows()).mockResolvedValueOnce({});
      const res = await db.addDomain({ id: "My ID", name: "Other", duration: 60 });
      expect(res.domain.id).toBe("my-id");
    });
  });

  describe("updateDomain", () => {
    const existing = { id: "java", name: "Java", description: "old", duration: 600 };

    it("errors when the domain does not exist", async () => {
      pool.query.mockResolvedValueOnce(rows());
      await expect(db.updateDomain("x", { name: "N" })).resolves.toEqual({ error: "Domain not found." });
    });

    it("rejects a blank name", async () => {
      pool.query.mockResolvedValueOnce(rows(existing));
      await expect(db.updateDomain("java", { name: "  " })).resolves.toEqual({ error: "Domain name is required." });
    });

    it("rejects an invalid duration", async () => {
      pool.query.mockResolvedValueOnce(rows(existing));
      const res = await db.updateDomain("java", { duration: -1 });
      expect(res.error).toMatch(/positive number/);
    });

    it("leaves undefined fields untouched and rounds duration", async () => {
      pool.query.mockResolvedValueOnce(rows(existing)).mockResolvedValueOnce(rows({ ...existing, duration: 121 }));
      const res = await db.updateDomain("java", { duration: 120.7 });
      expect(pool.query.mock.calls[1][1]).toEqual(["java", "Java", "old", 121]);
      expect(res.domain.duration).toBe(121);
    });

    it("trims name and description", async () => {
      pool.query.mockResolvedValueOnce(rows(existing)).mockResolvedValueOnce(rows(existing));
      await db.updateDomain("java", { name: "  New ", description: "  d " });
      expect(pool.query.mock.calls[1][1]).toEqual(["java", "New", "d", 600]);
    });
  });

  it("deleteDomain reports not-found when nothing was deleted", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(db.deleteDomain("x")).resolves.toEqual({ error: "Domain not found." });
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await expect(db.deleteDomain("java")).resolves.toEqual({ deleted: true });
  });
});

describe("exam + question bank reads", () => {
  it("getExamForStudent returns null for an unknown domain", async () => {
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.getExamForStudent("x")).resolves.toBeNull();
  });

  it("getExamForStudent builds the paper and never selects answer columns", async () => {
    pool.query
      .mockResolvedValueOnce(rows({ id: "java", name: "Java", description: "", duration: 600 }))
      .mockResolvedValueOnce(rows({ id: 1, type: "mcq", text: "Q?", options: ["a", "b"] }));
    const exam = await db.getExamForStudent("java");
    expect(exam).toEqual({
      domainId: "java",
      title: "Java",
      duration: 600,
      questions: [{ id: 1, type: "mcq", text: "Q?", options: ["a", "b"] }],
    });
    const sql = pool.query.mock.calls[1][0];
    expect(sql).not.toMatch(/correct_index/);
    expect(sql).not.toMatch(/accepted_answers/);
  });

  it("getQuestionsWithAnswers returns the rows", async () => {
    pool.query.mockResolvedValueOnce(rows({ id: 1, correctIndex: 0 }));
    await expect(db.getQuestionsWithAnswers("java")).resolves.toEqual([{ id: 1, correctIndex: 0 }]);
  });
});

describe("adding questions (transactional)", () => {
  let client;
  beforeEach(() => {
    client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
  });

  it("addQuestions numbers new MCQs after the current max local_id and commits", async () => {
    pool.query
      .mockResolvedValueOnce(rows({ max_id: 4 })) // max id
      .mockResolvedValueOnce(rows({ id: 5 })); // getQuestionsWithAnswers
    const out = await db.addQuestions("java", [
      { text: "A?", options: ["x", "y"], correctIndex: 1 },
      { text: "B?", options: ["p", "q"], correctIndex: 0 },
    ]);
    const calls = client.query.mock.calls;
    expect(calls[0][0]).toBe("BEGIN");
    expect(calls[1][1]).toEqual(["java", 5, "A?", JSON.stringify(["x", "y"]), 1]);
    expect(calls[2][1]).toEqual(["java", 6, "B?", JSON.stringify(["p", "q"]), 0]);
    expect(calls[3][0]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(out).toEqual([{ id: 5 }]);
  });

  it("addQuestions rolls back, releases the client and rethrows on failure", async () => {
    pool.query.mockResolvedValueOnce(rows({ max_id: 0 }));
    client.query.mockImplementation(async (sql) => {
      if (/INSERT/.test(sql)) throw new Error("insert failed");
    });
    await expect(db.addQuestions("java", [{ text: "A", options: ["x", "y"], correctIndex: 0 }])).rejects.toThrow("insert failed");
    expect(client.query.mock.calls.map((c) => c[0])).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("addFillBlankQuestions stores accepted answers as JSON", async () => {
    pool.query.mockResolvedValueOnce(rows({ max_id: 0 })).mockResolvedValueOnce(rows());
    await db.addFillBlankQuestions("java", [{ text: "x ___", acceptedAnswers: ["a", "b"] }]);
    expect(client.query.mock.calls[1][1]).toEqual(["java", 1, "x ___", JSON.stringify(["a", "b"])]);
    expect(client.query.mock.calls[2][0]).toBe("COMMIT");
  });

  it("addFillBlankQuestions rolls back on failure", async () => {
    pool.query.mockResolvedValueOnce(rows({ max_id: 0 }));
    client.query.mockImplementation(async (sql) => {
      if (/INSERT/.test(sql)) throw new Error("boom");
    });
    await expect(db.addFillBlankQuestions("java", [{ text: "x ___", acceptedAnswers: ["a"] }])).rejects.toThrow("boom");
    expect(client.release).toHaveBeenCalled();
  });

  it("addCodingQuestion inserts with nulls for blank optional fields", async () => {
    pool.query.mockResolvedValueOnce(rows({ max_id: 2 })).mockResolvedValueOnce({}).mockResolvedValueOnce(rows({ id: 3 }));
    const out = await db.addCodingQuestion("java", { title: "T", language: "", problemStatement: "P", starterCode: "", sampleOutput: "" });
    expect(pool.query.mock.calls[1][1]).toEqual(["java", 3, "T", null, "P", null, null]);
    expect(out).toEqual([{ id: 3 }]);
  });

  it("deleteQuestion returns an error when nothing matched", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(db.deleteQuestion("java", 9)).resolves.toEqual({ error: "Question not found." });
  });

  it("deleteQuestion returns the remaining questions", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce(rows({ id: 1 }));
    await expect(db.deleteQuestion("java", 2)).resolves.toEqual({ questions: [{ id: 1 }] });
  });
});

describe("submitExam grading", () => {
  const questions = [
    { id: 1, type: "mcq", correctIndex: 2 },
    { id: 2, type: "mcq", correctIndex: 0 },
    { id: 3, type: "fill_blank", acceptedAnswers: ["Paris", " paris city "] },
    { id: 4, type: "coding" },
  ];

  function setup() {
    pool.query
      .mockResolvedValueOnce(rows(...questions)) // getQuestionsWithAnswers
      .mockResolvedValueOnce(rows({ result_id: "R1004" })) // nextval
      .mockResolvedValueOnce({}) // INSERT result
      .mockResolvedValueOnce({}); // UPDATE student
  }

  it("scores MCQ + fill-blank, excludes coding from score and total", async () => {
    setup();
    const res = await db.submitExam({
      studentId: "S1",
      name: "Ann",
      domainId: "java",
      answers: { 1: 2, 2: 1, 3: "  PARIS ", 4: "code" },
      timeTaken: "10:00",
      reason: "manual",
      violationCount: 2,
      violations: [{ type: "tab-switch" }],
    });
    expect(res).toMatchObject({ resultId: "R1004", score: 2, total: 3, timeTaken: "10:00", violationCount: 2 });
  });

  it("matches fill-blank answers case/whitespace-insensitively against any accepted answer", async () => {
    setup();
    const res = await db.submitExam({ studentId: "S1", domainId: "java", answers: { 3: "PARIS CITY" } });
    expect(res.score).toBe(1);
  });

  it("does not award fill-blank for blank / missing / wrong answers", async () => {
    for (const answers of [{ 3: "   " }, {}, { 3: null }, { 3: "london" }]) {
      pool.query.mockReset();
      setup();
      const res = await db.submitExam({ studentId: "S1", domainId: "java", answers });
      expect(res.score).toBe(0);
    }
  });

  it("applies defaults for missing timeTaken/reason and bad violation data", async () => {
    setup();
    const res = await db.submitExam({
      studentId: "S1",
      domainId: "java",
      answers: {},
      violationCount: "many",
      violations: "nope",
    });
    expect(res).toMatchObject({ timeTaken: "—", reason: "manual", violationCount: 0, violations: [] });
  });

  it("writes the result row and marks the student as having attempted", async () => {
    setup();
    await db.submitExam({ studentId: "S1", name: "Ann", domainId: "java", answers: { 1: 2 } });
    const insert = pool.query.mock.calls[2];
    expect(insert[0]).toMatch(/INSERT INTO results/);
    expect(insert[1][0]).toBe("R1004");
    expect(insert[1][1]).toBe("S1");
    expect(insert[1][9]).toBe(JSON.stringify({ 1: 2 }));
    const update = pool.query.mock.calls[3];
    expect(update[0]).toMatch(/UPDATE students SET has_attempted = true/);
    expect(update[1]).toEqual(["S1"]);
  });
});

describe("results", () => {
  it("getAllResults and getResultsByStudent return rows", async () => {
    pool.query.mockResolvedValueOnce(rows({ resultId: "R1" }));
    await expect(db.getAllResults()).resolves.toEqual([{ resultId: "R1" }]);
    pool.query.mockResolvedValueOnce(rows({ resultId: "R2" }));
    await expect(db.getResultsByStudent("S1")).resolves.toEqual([{ resultId: "R2" }]);
    expect(pool.query.mock.calls[1][1]).toEqual(["S1"]);
  });

  it("getResultById returns null when missing", async () => {
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.getResultById("R9")).resolves.toBeNull();
  });

  it("getResultById attaches each question's studentAnswer", async () => {
    pool.query
      .mockResolvedValueOnce(rows({ resultId: "R1", domainId: "java", answers: { 1: 2 } }))
      .mockResolvedValueOnce(rows({ id: 1, text: "Q1" }, { id: 2, text: "Q2" }));
    const res = await db.getResultById("R1");
    expect(res.questions).toEqual([
      { id: 1, text: "Q1", studentAnswer: 2 },
      { id: 2, text: "Q2", studentAnswer: undefined },
    ]);
    expect(res.resultId).toBe("R1");
  });
});

describe("getQuestionStats", () => {
  it("returns null when the question does not exist", async () => {
    pool.query.mockResolvedValueOnce(rows());
    await expect(db.getQuestionStats("java", 1)).resolves.toBeNull();
  });

  it("counts zero attempts when the LEFT JOIN found no results", async () => {
    pool.query.mockResolvedValueOnce(rows({ type: "mcq", text: "Q", options: ["a"], correctIndex: 0, resultId: null, answers: null }));
    const stats = await db.getQuestionStats("java", 1);
    expect(stats).toMatchObject({ totalAttempts: 0, correct: 0, wrong: 0, unanswered: 0 });
  });

  it("classifies MCQ answers as correct / wrong / unanswered", async () => {
    const base = { type: "mcq", text: "Q", options: ["a", "b"], correctIndex: 1 };
    pool.query.mockResolvedValueOnce(
      rows(
        { ...base, resultId: "R1", answers: { 1: 1 } },
        { ...base, resultId: "R2", answers: { 1: 0 } },
        { ...base, resultId: "R3", answers: {} }
      )
    );
    const stats = await db.getQuestionStats("java", 1);
    expect(stats).toMatchObject({ totalAttempts: 3, correct: 1, wrong: 1, unanswered: 1 });
  });

  it("grades fill_blank answers case/whitespace-insensitively", async () => {
    const base = { type: "fill_blank", text: "Q ___", options: null, correctIndex: null, acceptedAnswers: ["Paris"] };
    pool.query.mockResolvedValueOnce(
      rows(
        { ...base, resultId: "R1", answers: { 2: "  paris " } },
        { ...base, resultId: "R2", answers: { 2: "rome" } },
        { ...base, resultId: "R3", answers: { 2: "" } }
      )
    );
    const stats = await db.getQuestionStats("java", 2);
    expect(stats).toMatchObject({ totalAttempts: 3, correct: 1, wrong: 2, unanswered: 0 });
  });

  it("does not classify answered coding questions (only counts attempts / unanswered)", async () => {
    const base = { type: "coding", text: "Q", options: null, correctIndex: null };
    pool.query.mockResolvedValueOnce(
      rows({ ...base, resultId: "R1", answers: { 3: "code" } }, { ...base, resultId: "R2", answers: {} })
    );
    const stats = await db.getQuestionStats("java", 3);
    expect(stats).toMatchObject({ totalAttempts: 2, correct: 0, wrong: 0, unanswered: 1 });
  });
});
