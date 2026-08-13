// Parses admin's pasted text into structured questions.
// Format: "Q: <text>" then option lines starting with A)/B)/C)/D), correct
// one marked with a trailing "*". Blocks are separated by one or more blank
// lines. Kept here (and mirrored on the frontend for live preview) so both
// sides agree on the exact same format.

function parseMCQText(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  blocks.forEach((block, blockIdx) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) {
      errors.push(`Question ${blockIdx + 1}: needs a question line and at least 2 options.`);
      return;
    }
    const qLine = lines[0].replace(/^Q[:.)]?\s*/i, "");
    const optionLines = lines.slice(1);
    let correctIndex = -1;
    const options = optionLines.map((line, i) => {
      const isCorrect = /\*\s*$/.test(line);
      if (isCorrect) correctIndex = i;
      return line
        .replace(/^[A-D][.)]\s*/i, "")
        .replace(/\*\s*$/, "")
        .trim();
    });

    if (correctIndex === -1) {
      errors.push(`Question ${blockIdx + 1}: no option marked with * as the correct answer.`);
      return;
    }
    if (options.length < 2) {
      errors.push(`Question ${blockIdx + 1}: needs at least 2 options.`);
      return;
    }
    questions.push({ text: qLine, options, correctIndex });
  });

  return { questions, errors };
}

module.exports = { parseMCQText };
