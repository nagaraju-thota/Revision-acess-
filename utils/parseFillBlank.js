// Parses admin's pasted text into structured fill-in-the-blank questions.
// Format: "Q: <text with ___ marking the blank>" then "A: <answer>" on the
// next line. Multiple accepted answers are separated by "|" on the A: line.
// Blocks are separated by one or more blank lines. Mirrors parseMCQ.js's
// shape ({ questions, errors }) so the admin routes/frontend can treat both
// the same way.

function parseFillBlankText(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, blockIdx) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      errors.push(`Question ${blockIdx + 1}: needs a question line (with ___) and an A: line.`);
      return;
    }

    const qLine = lines[0].replace(/^Q[:.)]?\s*/i, "").trim();
    if (!qLine) {
      errors.push(`Question ${blockIdx + 1}: question text is empty.`);
      return;
    }
    if (!/_{2,}/.test(qLine)) {
      errors.push(`Question ${blockIdx + 1}: mark the blank with ___.`);
      return;
    }

    const aLine = lines.slice(1).find((l) => /^A[:.)]?\s*/i.test(l));
    if (!aLine) {
      errors.push(`Question ${blockIdx + 1}: missing an A: line with the accepted answer.`);
      return;
    }

    const answerText = aLine.replace(/^A[:.)]?\s*/i, "").trim();
    const acceptedAnswers = answerText
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean);

    if (acceptedAnswers.length === 0) {
      errors.push(`Question ${blockIdx + 1}: at least one accepted answer is required.`);
      return;
    }

    questions.push({ text: qLine, acceptedAnswers });
  });

  return { questions, errors };
}

module.exports = { parseFillBlankText };
