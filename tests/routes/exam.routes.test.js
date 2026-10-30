jest.mock("../../data/db");
const request = require("supertest");
const db = require("../../data/db");
const { appWith } = require("../helpers/app");

const app = appWith("/api/exam", require("../../routes/exam.routes"));

const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...ORIGINAL_ENV };
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/exam/submit", () => {
  const body = { studentId: "S1", name: "Ann", domainId: "java", answers: { 1: 0 }, timeTaken: "10:00" };

  it("400 when studentId / domainId / answers are missing", async () => {
    for (const bad of [{ ...body, studentId: undefined }, { ...body, domainId: undefined }, { ...body, answers: undefined }]) {
      expect((await request(app).post("/api/exam/submit").send(bad)).status).toBe(400);
    }
    expect(db.submitExam).not.toHaveBeenCalled();
  });

  it("404 when the domain does not exist", async () => {
    db.getDomainMeta.mockResolvedValue(null);
    expect((await request(app).post("/api/exam/submit").send(body)).status).toBe(404);
  });

  it("409 when the student already has an attempt (one attempt per ID)", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.getResultsByStudent.mockResolvedValue([{ resultId: "R1" }]);
    const res = await request(app).post("/api/exam/submit").send(body);
    expect(res.status).toBe(409);
    expect(db.submitExam).not.toHaveBeenCalled();
  });

  it("submits and returns the full result", async () => {
    db.getDomainMeta.mockResolvedValue({ id: "java" });
    db.getResultsByStudent.mockResolvedValue([]);
    db.submitExam.mockResolvedValue({ resultId: "R1004" });
    db.getResultById.mockResolvedValue({ resultId: "R1004", score: 1, total: 1 });
    const res = await request(app).post("/api/exam/submit").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ submitted: true, resultId: "R1004", result: { resultId: "R1004", score: 1, total: 1 } });
    expect(db.submitExam).toHaveBeenCalledWith(expect.objectContaining({ studentId: "S1", domainId: "java", answers: { 1: 0 } }));
    expect(db.getResultById).toHaveBeenCalledWith("R1004");
  });

  it("500 when the db throws", async () => {
    db.getDomainMeta.mockRejectedValue(new Error("x"));
    expect((await request(app).post("/api/exam/submit").send(body)).status).toBe(500);
  });
});

describe("POST /api/exam/run-code", () => {
  const ok = { language: "python", code: "print('hi')", stdin: "in" };
  const setCreds = () => {
    process.env.JDOODLE_CLIENT_ID = "id";
    process.env.JDOODLE_CLIENT_SECRET = "secret";
  };

  it("400 for an unsupported language", async () => {
    const res = await request(app).post("/api/exam/run-code").send({ ...ok, language: "cobol" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Unsupported language: cobol");
  });

  it.each([[undefined], [""], ["   "], [123]])("400 for invalid code %p", async (code) => {
    const res = await request(app).post("/api/exam/run-code").send({ ...ok, code });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Code is required.");
  });

  it("400 when code exceeds 20,000 characters", async () => {
    const res = await request(app).post("/api/exam/run-code").send({ ...ok, code: "x".repeat(20001) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/20,000/);
  });

  it("500 when JDoodle credentials are not configured", async () => {
    delete process.env.JDOODLE_CLIENT_ID;
    delete process.env.JDOODLE_CLIENT_SECRET;
    global.fetch = jest.fn();
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/isn't configured/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("forwards the right payload to JDoodle and returns stdout on success", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ output: "hi\n", statusCode: 200 }) });
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ stdout: "hi\n", stderr: "", exitCode: 200 });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.jdoodle.com/v1/execute");
    expect(JSON.parse(opts.body)).toEqual({
      clientId: "id",
      clientSecret: "secret",
      script: ok.code,
      stdin: "in",
      language: "python3",
      versionIndex: "6",
    });
  });

  it("maps each supported language to its JDoodle runtime", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ output: "" }) });
    const expected = { javascript: "nodejs", python: "python3", java: "java", cpp: "cpp" };
    for (const [lang, jd] of Object.entries(expected)) {
      await request(app).post("/api/exam/run-code").send({ ...ok, language: lang });
      expect(JSON.parse(global.fetch.mock.calls.at(-1)[1].body).language).toBe(jd);
    }
  });

  it("defaults stdin to an empty string and exitCode to null", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ output: "x" }) });
    const res = await request(app).post("/api/exam/run-code").send({ language: "java", code: "class A{}" });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).stdin).toBe("");
    expect(res.body.exitCode).toBeNull();
  });

  it("returns stderr (and empty stdout) when the run failed", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output: "SyntaxError", isExecutionSuccess: false, statusCode: 200 }),
    });
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.body).toEqual({ stdout: "", stderr: "SyntaxError", exitCode: 200 });
  });

  it("treats a request-level `error` from JDoodle as a failure", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: "bad creds" }) });
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.body.stderr).toBe("bad creds");
  });

  it("502 when JDoodle returns a non-OK status", async () => {
    setCreds();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "limit reached" });
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/HTTP 429/);
    expect(res.body.message).toMatch(/limit reached/);
  });

  it("502 when the upstream request fails", async () => {
    setCreds();
    global.fetch = jest.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/ENOTFOUND/);
  });

  it("502 with a timeout message when the request is aborted", async () => {
    setCreds();
    const abort = new Error("aborted");
    abort.name = "AbortError";
    global.fetch = jest.fn().mockRejectedValue(abort);
    const res = await request(app).post("/api/exam/run-code").send(ok);
    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/timed out after 15s/);
  });
});

describe("GET /api/exam/results/:studentId", () => {
  it("returns that student's results", async () => {
    db.getResultsByStudent.mockResolvedValue([{ resultId: "R1" }]);
    const res = await request(app).get("/api/exam/results/S1");
    expect(db.getResultsByStudent).toHaveBeenCalledWith("S1");
    expect(res.body).toEqual({ results: [{ resultId: "R1" }] });
  });

  it("500 on db failure", async () => {
    db.getResultsByStudent.mockRejectedValue(new Error("x"));
    expect((await request(app).get("/api/exam/results/S1")).status).toBe(500);
  });
});

describe("GET /api/exam/results/:studentId/:resultId", () => {
  it("returns the result when it belongs to the student", async () => {
    db.getResultById.mockResolvedValue({ resultId: "R1", studentId: "S1" });
    const res = await request(app).get("/api/exam/results/S1/R1");
    expect(res.status).toBe(200);
    expect(res.body.result.resultId).toBe("R1");
  });

  it("404 when the result does not exist", async () => {
    db.getResultById.mockResolvedValue(null);
    expect((await request(app).get("/api/exam/results/S1/R1")).status).toBe(404);
  });

  it("404 (not 403) when the result belongs to a different student", async () => {
    db.getResultById.mockResolvedValue({ resultId: "R1", studentId: "OTHER" });
    const res = await request(app).get("/api/exam/results/S1/R1");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Result not found.");
  });

  it("500 on db failure", async () => {
    db.getResultById.mockRejectedValue(new Error("x"));
    expect((await request(app).get("/api/exam/results/S1/R1")).status).toBe(500);
  });
});
