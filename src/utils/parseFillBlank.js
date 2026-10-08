// Client-side mirror of the backend's utils/parseFillBlank.js (parseFillBlankText),
// used only for FillBlankPanel's live preview as the admin types -- the
// actual publish still goes through the server (api.publishFillBlankQuestions),
// which re-parses server-side so the rules always match what gets saved,
// exactly like McqPanel already does for MCQ.
//
// Format, one question per block, blank line between:
//   Q: The capital of France is ___.
//   A: Paris | paris
// Multiple accepted answers are separated by "|" on the A: line.
export function parseFillBlankText(raw) {
  const blocks = (raw || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  const errors = [];

  blocks.forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      errors.push(`Question ${i + 1}: needs a "Q:" line and an "A:" line.`);
      return;
    }

    const qLine = lines[0];
    if (!/^Q[:.)]?\s*/i.test(qLine)) {
      errors.push(`Question ${i + 1}: needs a "Q:" line and an "A:" line.`);
      return;
    }
    const text = qLine.replace(/^Q[:.)]?\s*/i, "").trim();
    if (!text) {
      errors.push(`Question ${i + 1}: question text is empty.`);
      return;
    }
    if (!/_{2,}/.test(text)) {
      errors.push(`Question ${i + 1}: the question needs a blank, shown as "___".`);
      return;
    }

    const aLine = lines.slice(1).find((l) => /^A[:.)]?\s*/i.test(l));
    if (!aLine) {
      errors.push(`Question ${i + 1}: needs both a "Q:" line and an "A:" line.`);
      return;
    }
    const answers = aLine
      .replace(/^A[:.)]?\s*/i, "")
      .split("|")
      .map((a) => a.trim())
      .filter(Boolean);
    if (answers.length === 0) {
      errors.push(`Question ${i + 1}: at least one accepted answer is required.`);
      return;
    }

    questions.push({ text, answers });
  });

  return { questions, errors };
}
