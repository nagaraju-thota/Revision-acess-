import { parseFillBlankText } from "../../src/utils/parseFillBlank";

describe("parseFillBlankText", () => {
  it("parses a valid question with multiple answers", () => {
    const { questions, errors } = parseFillBlankText("Q: The capital of France is ___.\nA: Paris | paris");
    expect(errors).toEqual([]);
    expect(questions).toEqual([{ text: "The capital of France is ___.", answers: ["Paris", "paris"] }]);
  });

  it("parses several blocks separated by blank lines", () => {
    const raw = "Q: A ___\nA: a\n\nQ: B ___\nA: b";
    expect(parseFillBlankText(raw).questions).toHaveLength(2);
  });

  it("returns nothing for empty / null input", () => {
    expect(parseFillBlankText("")).toEqual({ questions: [], errors: [] });
    expect(parseFillBlankText(null)).toEqual({ questions: [], errors: [] });
  });

  it("errors when a block has only one line", () => {
    const { questions, errors } = parseFillBlankText("Q: only ___");
    expect(questions).toEqual([]);
    expect(errors[0]).toMatch(/Question 1/);
  });

  it("errors when the first line is not a Q line", () => {
    const { errors } = parseFillBlankText("What is ___\nA: x");
    expect(errors[0]).toMatch(/needs a "Q:" line/);
  });

  it("errors when question text is empty", () => {
    const { errors } = parseFillBlankText("Q:   \nA: x");
    expect(errors.length).toBe(1);
  });

  it("errors when the question has no blank", () => {
    const { errors } = parseFillBlankText("Q: no blank here\nA: x");
    expect(errors[0]).toMatch(/needs a blank/);
  });

  it("errors when there is no A line", () => {
    const { errors } = parseFillBlankText("Q: fill ___\nsomething else");
    expect(errors[0]).toMatch(/needs both/);
  });

  it("errors when the A line has no answers", () => {
    const { errors } = parseFillBlankText("Q: fill ___\nA: | |");
    expect(errors[0]).toMatch(/at least one accepted answer/);
  });

  it("accepts Q. / A) style prefixes and is case-insensitive", () => {
    const { questions } = parseFillBlankText("q. fill ___\na) yes");
    expect(questions).toEqual([{ text: "fill ___", answers: ["yes"] }]);
  });
});
