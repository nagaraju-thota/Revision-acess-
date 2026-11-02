import { vi } from "vitest";
import { api } from "../../src/api/client";

function mockFetch(body, { ok = true, status = 200, json } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: json || (() => Promise.resolve(body)),
  });
}

const lastCall = () => global.fetch.mock.calls.at(-1);

afterEach(() => vi.restoreAllMocks());

describe("request wrapper", () => {
  it("sends JSON headers including the ngrok bypass header", async () => {
    mockFetch({ ok: true });
    await api.getDomains();
    const [url, opts] = lastCall();
    expect(url).toMatch(/\/domains$/);
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.headers["ngrok-skip-browser-warning"]).toBe("true");
  });

  it("throws the backend message on a non-ok response", async () => {
    mockFetch({ message: "Invalid credentials." }, { ok: false, status: 401 });
    await expect(api.studentLogin("s1", "bad")).rejects.toThrow("Invalid credentials.");
  });

  it("falls back to a generic message when the error body has none", async () => {
    mockFetch({}, { ok: false, status: 500 });
    await expect(api.getDomains()).rejects.toThrow(/Something went wrong/);
  });

  it("copes with a non-JSON error body", async () => {
    mockFetch(null, { ok: false, status: 502, json: () => Promise.reject(new Error("not json")) });
    await expect(api.getDomains()).rejects.toThrow(/Something went wrong/);
  });
});

describe("auth + exam endpoints", () => {
  it("registerStudent POSTs the registration body", async () => {
    mockFetch({ ok: true });
    await api.registerStudent({ id: "s1", email: "a@b.c", name: "A", password: "pw" });
    const [url, opts] = lastCall();
    expect(url).toMatch(/\/auth\/student\/register$/);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ id: "s1", email: "a@b.c", name: "A", password: "pw" });
  });

  it("studentLogin and adminLogin hit their own routes", async () => {
    mockFetch({});
    await api.studentLogin("s1", "pw");
    expect(lastCall()[0]).toMatch(/\/auth\/student\/login$/);
    await api.adminLogin("admin", "pw");
    expect(lastCall()[0]).toMatch(/\/auth\/admin\/login$/);
  });

  it("getExam adds an encoded studentId only when given", async () => {
    mockFetch({});
    await api.getExam("frontend");
    expect(lastCall()[0]).toMatch(/\/domains\/frontend\/exam$/);
    await api.getExam("frontend", "a b");
    expect(lastCall()[0]).toMatch(/\/domains\/frontend\/exam\?studentId=a%20b$/);
  });

  it("submitExam, results and run-code endpoints", async () => {
    mockFetch({});
    await api.submitExam({ a: 1 });
    expect(lastCall()[0]).toMatch(/\/exam\/submit$/);
    await api.getMyResults("s1");
    expect(lastCall()[0]).toMatch(/\/exam\/results\/s1$/);
    await api.getMyResultDetail("s1", 9);
    expect(lastCall()[0]).toMatch(/\/exam\/results\/s1\/9$/);
    await api.runCode("python", "print(1)", "");
    expect(JSON.parse(lastCall()[1].body)).toEqual({ language: "python", code: "print(1)", stdin: "" });
  });
});

describe("admin endpoints", () => {
  it("results, preview and publish", async () => {
    mockFetch({});
    await api.getAllResults();
    expect(lastCall()[0]).toMatch(/\/admin\/results$/);
    await api.getResultDetail(3);
    expect(lastCall()[0]).toMatch(/\/admin\/results\/3$/);
    await api.previewQuestions("d1", "txt");
    expect(lastCall()[0]).toMatch(/\/admin\/domains\/d1\/questions\/preview$/);
    await api.publishQuestions("d1", "txt");
    expect(lastCall()[1].method).toBe("POST");
  });

  it("domain CRUD + duration", async () => {
    mockFetch({});
    await api.updateDomainDuration("d1", 600);
    expect(lastCall()[1].method).toBe("PUT");
    expect(JSON.parse(lastCall()[1].body)).toEqual({ duration: 600 });
    await api.addDomain({ id: "x", name: "X", description: "d", duration: 60 });
    expect(lastCall()[0]).toMatch(/\/admin\/domains$/);
    await api.updateDomain("x", { name: "Y" });
    expect(lastCall()[0]).toMatch(/\/admin\/domains\/x$/);
    await api.deleteDomain("x");
    expect(lastCall()[1].method).toBe("DELETE");
  });

  it("insights, schedule and override endpoints", async () => {
    mockFetch({});
    await api.getDomainQuestions("d1");
    expect(lastCall()[0]).toMatch(/\/admin\/domains\/d1\/questions$/);
    await api.getQuestionStats("d1", 4);
    expect(lastCall()[0]).toMatch(/\/questions\/4\/stats$/);
    await api.getExamSchedule();
    expect(lastCall()[0]).toMatch(/\/admin\/exam-schedule$/);
    await api.setExamSchedule({ startTime: null, graceMinutes: 10 });
    expect(JSON.parse(lastCall()[1].body)).toEqual({ startTime: null, graceMinutes: 10 });
    await api.setStudentOverride("a b", true);
    expect(lastCall()[0]).toMatch(/\/admin\/students\/a%20b\/override$/);
  });
});

describe("question shape mappers", () => {
  const rows = {
    questions: [
      { id: 1, type: "mcq", text: "mcq" },
      { id: 2, type: "fill_blank", text: "fill ___", acceptedAnswers: ["x"] },
      { id: 3, type: "fill_blank", text: "no answers" },
      {
        id: 4,
        type: "coding",
        text: "Sum",
        language: "python",
        problemStatement: "add",
        starterCode: "def f(): pass",
        sampleOutput: "3",
      },
      { id: 5, type: "coding", text: "Bare" },
    ],
  };

  it("getFillBlankQuestions keeps only fill_blank rows, mapped to the panel shape", async () => {
    mockFetch(rows);
    expect(await api.getFillBlankQuestions("d1")).toEqual([
      { id: 2, text: "fill ___", answers: ["x"] },
      { id: 3, text: "no answers", answers: [] },
    ]);
  });

  it("getCodingQuestions maps backend fields and applies defaults", async () => {
    mockFetch(rows);
    const out = await api.getCodingQuestions("d1");
    expect(out[0]).toEqual({
      id: 4,
      title: "Sum",
      language: "python",
      prompt: "add",
      starterCode: "def f(): pass",
      sampleOutput: "3",
    });
    expect(out[1]).toEqual({ id: 5, title: "Bare", language: "javascript", prompt: "", starterCode: "", sampleOutput: "" });
  });

  it("publish / delete fill-blank return mapped questions", async () => {
    mockFetch({ published: 1, ...rows });
    const pub = await api.publishFillBlankQuestions("d1", "txt");
    expect(pub.published).toBe(1);
    expect(pub.questions).toHaveLength(2);
    const del = await api.deleteFillBlankQuestion("d1", 2);
    expect(lastCall()[1].method).toBe("DELETE");
    expect(del.questions).toHaveLength(2);
  });

  it("add / delete coding questions send problemStatement and return mapped questions", async () => {
    mockFetch(rows);
    const added = await api.addCodingQuestion("d1", {
      title: "T",
      language: "python",
      prompt: "P",
      starterCode: "s",
      sampleOutput: "o",
    });
    expect(JSON.parse(lastCall()[1].body).problemStatement).toBe("P");
    expect(added.questions).toHaveLength(2);
    const del = await api.deleteCodingQuestion("d1", 4);
    expect(del.questions).toHaveLength(2);
  });

  it("tolerates responses without a questions array", async () => {
    mockFetch({});
    expect(await api.getFillBlankQuestions("d1")).toEqual([]);
    expect(await api.getCodingQuestions("d1")).toEqual([]);
    expect((await api.publishFillBlankQuestions("d1", "")).questions).toEqual([]);
    expect((await api.addCodingQuestion("d1", {})).questions).toEqual([]);
  });
});
