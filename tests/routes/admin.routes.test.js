jest.mock("../../data/db");
const request = require("supertest");
const db = require("../../data/db");
const { appWith } = require("../helpers/app");

const app = appWith("/api/admin", require("../../routes/admin.routes"));

beforeEach(() => jest.resetAllMocks());

const MCQ = "Q: 1+1?\nA) 1\nB) 2*";
const FILL = "Q: Sky is ___\nA: blue";

describe("results", () => {
  it("GET /results lists all results", async () => {
    db.getAllResults.mockResolvedValue([{ resultId: "R1" }]);
    const res = await request(app).get("/api/admin/results");
    expect(res.body).toEqual({ results: [{ resultId: "R1" }] });
  });

  it("GET /results/:id returns the result or 404", async () => {
    db.getResultById.mockResolvedValueOnce({ resultId: "R1" });
    expect((await request(app).get("/api/admin/results/R1")).body).toEqual({ result: { resultId: "R1" } });
    db.getResultById.mockResolvedValueOnce(null);
    expect((await request(app).get("/api/admin/results/R2")).status).toBe(404);
  });

  it("500s when the db throws", async () => {
    db.getAllResults.mockRejectedValue(new Error("x"));
    expect((await request(app).get("/api/admin/results")).status).toBe(500);
  });
});

describe("question bank reads", () => {
  it("GET /domains/:id/questions returns questions with answers", async () => {
    db.getQuestionsWithAnswers.mockResolvedValue([{ id: 1 }]);
    const res = await request(app).get("/api/admin/domains/java/questions");
    expect(db.getQuestionsWithAnswers).toHaveBeenCalledWith("java");
    expect(res.body).toEqual({ questions: [{ id: 1 }] });
  });

  describe("GET /domains/:id/questions/:qid/stats", () => {
    it("400 when questionId is not an integer", async () => {
      for (const bad of ["abc", "1.5"]) {
        expect((await request(app).get(`/api/admin/domains/java/questions/${bad}/stats`)).status).toBe(400);
      }
      expect(db.getQuestionStats).not.toHaveBeenCalled();
    });

    it("404 when the question is not found", async () => {
      db.getQuestionStats.mockResolvedValue(null);
      expect((await request(app).get("/api/admin/domains/java/questions/1/stats")).status).toBe(404);
    });

    it("returns stats and passes the id as a Number", async () => {
      db.getQuestionStats.mockResolvedValue({ correct: 2 });
      const res = await request(app).get("/api/admin/domains/java/questions/3/stats");
      expect(db.getQuestionStats).toHaveBeenCalledWith("java", 3);
      expect(res.body).toEqual({ stats: { correct: 2 } });
    });
  });
});

describe("MCQ", () => {
  it("POST preview parses without saving", async () => {
    const res = await request(app).post("/api/admin/domains/java/questions/preview").send({ text: MCQ });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.errors).toEqual([]);
    expect(db.addQuestions).not.toHaveBeenCalled();
  });

  it("POST preview tolerates a missing text field", async () => {
    const res = await request(app).post("/api/admin/domains/java/questions/preview").send({});
    expect(res.body).toEqual({ questions: [], errors: [] });
  });

  it("POST publish 404s for an unknown domain", async () => {
    db.getDomainMeta.mockResolvedValue(null);
    expect((await request(app).post("/api/admin/domains/x/questions").send({ text: MCQ })).status).toBe(404);
  });

  it("POST publish 400s with parse errors when nothing is valid", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    const res = await request(app).post("/api/admin/domains/java/questions").send({ text: "Q: bad\nA) a\nB) b" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("No valid questions to publish.");
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(db.addQuestions).not.toHaveBeenCalled();
  });

  it("POST publish saves valid questions", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.addQuestions.mockResolvedValue([{ id: 1 }]);
    const res = await request(app).post("/api/admin/domains/java/questions").send({ text: MCQ });
    expect(res.body).toEqual({ published: 1, questions: [{ id: 1 }] });
    expect(db.addQuestions).toHaveBeenCalledWith("java", [{ text: "1+1?", options: ["1", "2"], correctIndex: 1 }]);
  });
});

describe("fill in the blank", () => {
  it("POST preview parses without saving", async () => {
    const res = await request(app).post("/api/admin/domains/java/questions/fill-blank/preview").send({ text: FILL });
    expect(res.body.questions).toEqual([{ text: "Sky is ___", acceptedAnswers: ["blue"] }]);
  });

  it("POST publish 404s for an unknown domain", async () => {
    db.getDomainMeta.mockResolvedValue(null);
    expect((await request(app).post("/api/admin/domains/x/questions/fill-blank").send({ text: FILL })).status).toBe(404);
  });

  it("POST publish 400s when nothing valid", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    const res = await request(app).post("/api/admin/domains/java/questions/fill-blank").send({ text: "Q: no blank\nA: x" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(1);
  });

  it("POST publish saves valid questions", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.addFillBlankQuestions.mockResolvedValue([{ id: 1 }]);
    const res = await request(app).post("/api/admin/domains/java/questions/fill-blank").send({ text: FILL });
    expect(res.body).toEqual({ published: 1, questions: [{ id: 1 }] });
  });
});

describe("coding", () => {
  const body = { title: "  Sum  ", language: " python ", problemStatement: " Add numbers ", starterCode: " def f(): ", sampleOutput: " 3 " };

  it("404 for an unknown domain", async () => {
    db.getDomainMeta.mockResolvedValue(null);
    expect((await request(app).post("/api/admin/domains/x/questions/coding").send(body)).status).toBe(404);
  });

  it("400 when title or problem statement is blank", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    const res = await request(app).post("/api/admin/domains/java/questions/coding").send({ title: " ", problemStatement: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(["Title is required.", "Problem statement is required."]);
    expect(res.body.message).toBe("Title is required.");
  });

  it("trims inputs before saving", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.addCodingQuestion.mockResolvedValue([]);
    const res = await request(app).post("/api/admin/domains/java/questions/coding").send(body);
    expect(res.body.published).toBe(1);
    expect(db.addCodingQuestion).toHaveBeenCalledWith("java", {
      title: "Sum",
      language: "python",
      problemStatement: "Add numbers",
      starterCode: "def f():",
      sampleOutput: "3",
    });
  });

  it("defaults the language to JavaScript and optional fields to empty strings", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.addCodingQuestion.mockResolvedValue([]);
    await request(app).post("/api/admin/domains/java/questions/coding").send({ title: "T", problemStatement: "P" });
    expect(db.addCodingQuestion).toHaveBeenCalledWith("java", {
      title: "T",
      language: "JavaScript",
      problemStatement: "P",
      starterCode: "",
      sampleOutput: "",
    });
  });
});

describe("DELETE /domains/:id/questions/:qid", () => {
  it("400 for a non-integer id", async () => {
    expect((await request(app).delete("/api/admin/domains/java/questions/abc")).status).toBe(400);
  });

  it("404 when the question does not exist", async () => {
    db.deleteQuestion.mockResolvedValue({ error: "Question not found." });
    const res = await request(app).delete("/api/admin/domains/java/questions/9");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found.");
  });

  it("deletes and returns the remaining questions", async () => {
    db.deleteQuestion.mockResolvedValue({ questions: [{ id: 1 }] });
    const res = await request(app).delete("/api/admin/domains/java/questions/2");
    expect(db.deleteQuestion).toHaveBeenCalledWith("java", 2);
    expect(res.body).toEqual({ deleted: true, questions: [{ id: 1 }] });
  });
});

describe("domains", () => {
  it("POST /domains creates a domain with questionCount 0", async () => {
    db.addDomain.mockResolvedValue({ domain: { id: "java", name: "Java" } });
    const res = await request(app).post("/api/admin/domains").send({ name: "Java", duration: 60 });
    expect(res.body).toEqual({ domain: { id: "java", name: "Java", questionCount: 0 } });
  });

  it("POST /domains 400s on a db validation error", async () => {
    db.addDomain.mockResolvedValue({ error: "Domain name is required." });
    const res = await request(app).post("/api/admin/domains").send({});
    expect(res.status).toBe(400);
  });

  describe("PUT /domains/:id/duration", () => {
    it.each([[0], [-1], ["abc"], [null], [undefined]])("400 for duration %p", async (duration) => {
      const res = await request(app).put("/api/admin/domains/java/duration").send({ duration });
      expect(res.status).toBe(400);
    });

    it("404 when the domain does not exist", async () => {
      db.updateDomainDuration.mockResolvedValue(null);
      expect((await request(app).put("/api/admin/domains/x/duration").send({ duration: 60 })).status).toBe(404);
    });

    it("rounds the duration and updates", async () => {
      db.updateDomainDuration.mockResolvedValue({ id: "java", duration: 61 });
      const res = await request(app).put("/api/admin/domains/java/duration").send({ duration: "60.6" });
      expect(db.updateDomainDuration).toHaveBeenCalledWith("java", 61);
      expect(res.body).toEqual({ domain: { id: "java", duration: 61 } });
    });
  });

  describe("PUT /domains/:id", () => {
    it("404 when the domain does not exist", async () => {
      db.updateDomain.mockResolvedValue({ error: "Domain not found." });
      expect((await request(app).put("/api/admin/domains/x").send({ name: "N" })).status).toBe(404);
    });

    it("400 for other validation errors", async () => {
      db.updateDomain.mockResolvedValue({ error: "Domain name is required." });
      expect((await request(app).put("/api/admin/domains/java").send({ name: " " })).status).toBe(400);
    });

    it("returns the updated domain with its question count", async () => {
      db.updateDomain.mockResolvedValue({ domain: { id: "java", name: "New" } });
      db.getQuestionsWithAnswers.mockResolvedValue([{}, {}, {}]);
      const res = await request(app).put("/api/admin/domains/java").send({ name: "New" });
      expect(res.body).toEqual({ domain: { id: "java", name: "New", questionCount: 3 } });
    });
  });

  it("DELETE /domains/:id deletes or 404s", async () => {
    db.deleteDomain.mockResolvedValueOnce({ deleted: true });
    expect((await request(app).delete("/api/admin/domains/java")).body).toEqual({ deleted: true });
    db.deleteDomain.mockResolvedValueOnce({ error: "Domain not found." });
    expect((await request(app).delete("/api/admin/domains/x")).status).toBe(404);
  });

  it("500s when the db throws", async () => {
    db.deleteDomain.mockRejectedValue(new Error("x"));
    expect((await request(app).delete("/api/admin/domains/java")).status).toBe(500);
  });
});
