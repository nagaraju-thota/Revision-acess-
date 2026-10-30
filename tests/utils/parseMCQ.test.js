const { parseMCQText } = require("../../utils/parseMCQ");

describe("parseMCQText", () => {
  it("parses a single question with the correct option marked by *", () => {
    const raw = "Q: Capital of France?\nA) London\nB) Paris *\nC) Rome\nD) Madrid";
    const { questions, errors } = parseMCQText(raw);
    expect(errors).toEqual([]);
    expect(questions).toEqual([
      { text: "Capital of France?", options: ["London", "Paris", "Rome", "Madrid"], correctIndex: 1 },
    ]);
  });

  it("parses multiple blocks separated by blank lines", () => {
    const raw = "Q: 1+1?\nA) 1\nB) 2*\n\n\nQ: 2+2?\nA) 4*\nB) 5";
    const { questions, errors } = parseMCQText(raw);
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0].correctIndex).toBe(1);
    expect(questions[1].correctIndex).toBe(0);
  });

  it("accepts Q./Q) prefixes, lowercase, and A. / a) option prefixes", () => {
    const raw = "q. Pick one\na. first\nb) second*";
    const { questions } = parseMCQText(raw);
    expect(questions[0]).toEqual({ text: "Pick one", options: ["first", "second"], correctIndex: 1 });
  });

  it("allows whitespace between the option text and the trailing *", () => {
    const { questions } = parseMCQText("Q: x\nA) one\nB) two   *   ");
    expect(questions[0].options).toEqual(["one", "two"]);
    expect(questions[0].correctIndex).toBe(1);
  });

  it("works with Windows (CRLF) line endings", () => {
    const { questions, errors } = parseMCQText("Q: x\r\nA) one\r\nB) two*");
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(1);
  });

  it("returns nothing for empty input", () => {
    expect(parseMCQText("")).toEqual({ questions: [], errors: [] });
    expect(parseMCQText("   \n\n  ")).toEqual({ questions: [], errors: [] });
  });

  it("errors when a block has fewer than 3 lines", () => {
    const { questions, errors } = parseMCQText("Q: Only question\nA) one*");
    expect(questions).toEqual([]);
    expect(errors).toEqual(["Question 1: needs a question line and at least 2 options."]);
  });

  it("errors when no option is marked correct", () => {
    const { questions, errors } = parseMCQText("Q: x\nA) one\nB) two");
    expect(questions).toEqual([]);
    expect(errors[0]).toMatch(/no option marked with \*/);
  });

  it("uses the last * when several options are marked", () => {
    const { questions } = parseMCQText("Q: x\nA) one*\nB) two*");
    expect(questions[0].correctIndex).toBe(1);
  });

  it("keeps valid questions and numbers errors by block position", () => {
    const raw = "Q: ok\nA) a*\nB) b\n\nQ: bad\nA) a\nB) b";
    const { questions, errors } = parseMCQText(raw);
    expect(questions).toHaveLength(1);
    expect(errors).toEqual(["Question 2: no option marked with * as the correct answer."]);
  });
});
