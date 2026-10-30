const { parseFillBlankText } = require("../../utils/parseFillBlank");

describe("parseFillBlankText", () => {
  it("parses a valid question with one answer", () => {
    const { questions, errors } = parseFillBlankText("Q: The capital of France is ___.\nA: Paris");
    expect(errors).toEqual([]);
    expect(questions).toEqual([{ text: "The capital of France is ___.", acceptedAnswers: ["Paris"] }]);
  });

  it("splits multiple accepted answers on | and trims them", () => {
    const { questions } = parseFillBlankText("Q: Planet ___\nA:  Jupiter | jupiter |  JUPITER ");
    expect(questions[0].acceptedAnswers).toEqual(["Jupiter", "jupiter", "JUPITER"]);
  });

  it("drops empty answers produced by stray pipes", () => {
    const { questions } = parseFillBlankText("Q: x ___\nA: a || b |");
    expect(questions[0].acceptedAnswers).toEqual(["a", "b"]);
  });

  it("parses multiple blocks", () => {
    const { questions } = parseFillBlankText("Q: a ___\nA: 1\n\nQ: b ___\nA: 2");
    expect(questions.map((q) => q.acceptedAnswers[0])).toEqual(["1", "2"]);
  });

  it("accepts Q./Q) and A./A) prefixes, case-insensitive", () => {
    const { questions } = parseFillBlankText("q) Water is ___\na. wet");
    expect(questions[0]).toEqual({ text: "Water is ___", acceptedAnswers: ["wet"] });
  });

  it("finds the A: line even if it is not the second line", () => {
    const { questions, errors } = parseFillBlankText("Q: x ___\nsome note\nA: yes");
    expect(errors).toEqual([]);
    expect(questions[0].acceptedAnswers).toEqual(["yes"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseFillBlankText("")).toEqual({ questions: [], errors: [] });
  });

  it("errors on a single-line block", () => {
    const { errors } = parseFillBlankText("Q: x ___");
    expect(errors).toEqual(["Question 1: needs a question line (with ___) and an A: line."]);
  });

  it("errors when the question text is empty", () => {
    const { errors } = parseFillBlankText("Q:\nA: x");
    expect(errors).toEqual(["Question 1: question text is empty."]);
  });

  it("errors when there is no ___ blank", () => {
    const { errors } = parseFillBlankText("Q: no blank\nA: x");
    expect(errors).toEqual(["Question 1: mark the blank with ___."]);
  });

  it("errors when the A: line is missing", () => {
    const { errors } = parseFillBlankText("Q: x ___\nnot an answer line");
    expect(errors).toEqual(["Question 1: missing an A: line with the accepted answer."]);
  });

  it("errors when the A: line has no actual answers", () => {
    const { errors } = parseFillBlankText("Q: x ___\nA: | |");
    expect(errors).toEqual(["Question 1: at least one accepted answer is required."]);
  });

  it("keeps valid questions alongside errors", () => {
    const { questions, errors } = parseFillBlankText("Q: ok ___\nA: y\n\nQ: bad\nA: n");
    expect(questions).toHaveLength(1);
    expect(errors[0]).toMatch(/^Question 2/);
  });
});
