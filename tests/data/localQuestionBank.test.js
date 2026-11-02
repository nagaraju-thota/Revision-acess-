import {
  addCodingQuestion,
  deleteCodingQuestion,
  deleteFillBlankQuestion,
  getCodingQuestions,
  getFillBlankQuestions,
  parseFillBlankText,
  publishFillBlankQuestions,
} from "../../src/data/localQuestionBank";
import { vi } from "vitest";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// every function resolves after a 250ms simulated delay
const resolved = async (promise) => {
  await vi.advanceTimersByTimeAsync(300);
  return promise;
};

describe("parseFillBlankText (local copy)", () => {
  it("parses valid questions", () => {
    expect(parseFillBlankText("Q: x ___\nA: y | z").questions).toEqual([{ text: "x ___", answers: ["y", "z"] }]);
  });
  it("collects every kind of error", () => {
    const raw = ["Q: one line", "Q: no blank\nA: x", "just text\nmore text", "Q: ok ___\nA: |"].join("\n\n");
    const { questions, errors } = parseFillBlankText(raw);
    expect(questions).toEqual([]);
    expect(errors).toHaveLength(4);
  });
  it("handles empty input", () => {
    expect(parseFillBlankText(undefined)).toEqual({ questions: [], errors: [] });
  });
});

describe("fill in the blank bank", () => {
  it("returns seeded questions and [] for unknown domains", async () => {
    expect((await resolved(getFillBlankQuestions("frontend"))).length).toBeGreaterThan(0);
    expect(await resolved(getFillBlankQuestions("nope"))).toEqual([]);
  });

  it("publishes, assigns ids and deletes", async () => {
    const out = await resolved(publishFillBlankQuestions("fb-test", "Q: a ___\nA: b\n\nQ: c ___\nA: d"));
    expect(out.published).toBe(2);
    const [first] = out.questions;
    const after = await resolved(deleteFillBlankQuestion("fb-test", first.id));
    expect(after.questions).toHaveLength(1);
  });

  it("returns an error when nothing valid is pasted", async () => {
    const out = await resolved(publishFillBlankQuestions("fb-test", "garbage"));
    expect(out.error).toMatch(/No valid/);
  });
});

describe("coding bank", () => {
  it("returns seeded questions and [] for unknown domains", async () => {
    expect((await resolved(getCodingQuestions("backend"))).length).toBeGreaterThan(0);
    expect(await resolved(getCodingQuestions("nope"))).toEqual([]);
  });

  it("validates title and prompt", async () => {
    expect((await resolved(addCodingQuestion("c-test", { title: " ", prompt: "p" }))).error).toMatch(/title/i);
    expect((await resolved(addCodingQuestion("c-test", { title: "t", prompt: " " }))).error).toMatch(/problem statement/i);
  });

  it("adds with defaults and deletes", async () => {
    const added = await resolved(addCodingQuestion("c-test", { title: " T ", prompt: " P " }));
    expect(added.question).toMatchObject({ title: "T", prompt: "P", language: "javascript", starterCode: "", sampleOutput: "" });
    const after = await resolved(deleteCodingQuestion("c-test", added.question.id));
    expect(after.questions).toEqual([]);
  });
});
