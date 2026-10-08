// Fill-in-the-Blank and Coding questions are NEW question types the backend
// doesn't have endpoints for yet — only MCQ has real API routes
// (previewQuestions/publishQuestions in api/client.js), which this file
// intentionally does not touch. Until the backend team adds matching
// endpoints, these two types are stored in memory here so the admin can
// build and preview them today; swap this module for real api.* calls once
// those routes exist — every function below is written to mirror that same
// shape (domainId -> question[]) so the swap is a drop-in.

let fillBlankByDomain = {
  "python-fullstack": [
    { id: 1, text: "In Python, a function is defined using the ___ keyword.", answers: ["def"] },
    { id: 2, text: "Django follows the Model-View-___ architectural pattern.", answers: ["Template", "template"] },
  ],
  frontend: [
    { id: 3, text: "In React, ___ are used to pass data from a parent component to a child.", answers: ["props", "Props"] },
    { id: 4, text: "The CSS property ___ is used to create space between flex items.", answers: ["gap"] },
  ],
  backend: [
    { id: 5, text: "The HTTP status code ___ means \"Created\".", answers: ["201"] },
    { id: 6, text: "A ___ balancer distributes incoming traffic across multiple servers.", answers: ["load", "Load"] },
  ],
  database: [
    { id: 7, text: "In SQL, the ___ clause filters rows before they are grouped.", answers: ["WHERE", "where"] },
    { id: 8, text: "ACID stands for Atomicity, Consistency, Isolation, and ___.", answers: ["Durability", "durability"] },
  ],
};
let codingByDomain = {
  "python-fullstack": [
    {
      id: 1,
      title: "Sum of a list",
      language: "python",
      prompt: "Write a function that takes a list of integers and returns their sum, without using the built-in sum() function.",
      starterCode: "def sum_list(nums):\n    # your code here\n    pass",
      sampleOutput: 'sum_list([1, 2, 3]) → 6',
    },
  ],
  frontend: [
    {
      id: 2,
      title: "Reverse a string",
      language: "javascript",
      prompt: "Write a function that reverses a string without using the built-in reverse() array method.",
      starterCode: "function reverseString(str) {\n  // your code here\n}",
      sampleOutput: 'reverseString("hello") → "olleh"',
    },
  ],
  backend: [
    {
      id: 3,
      title: "FizzBuzz endpoint",
      language: "javascript",
      prompt: "Write an Express route handler for GET /fizzbuzz/:n that returns \"Fizz\", \"Buzz\", \"FizzBuzz\", or the number as a string, following classic FizzBuzz rules.",
      starterCode: "app.get('/fizzbuzz/:n', (req, res) => {\n  // your code here\n});",
      sampleOutput: "GET /fizzbuzz/15 → \"FizzBuzz\"",
    },
  ],
  database: [
    {
      id: 4,
      title: "Second highest salary",
      language: "python",
      prompt: "Write a SQL query to find the second-highest salary from an `employees` table with columns (id, name, salary).",
      starterCode: "SELECT MAX(salary) AS second_highest\nFROM employees\nWHERE salary < (SELECT MAX(salary) FROM employees);",
      sampleOutput: "second_highest → 85000",
    },
  ],
};

function delay(value, ms = 250) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextFillBlankId = 9;
let nextCodingId = 5;

// ---- Fill in the Blank ----
// Paste format, one question per block, blank line between:
//   Q: The capital of France is ___.
//   A: Paris | paris
// Multiple acceptable answers separated by "|" (case-insensitive match is
// the assumed grading rule until the backend implements real scoring).
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
    const qLine = lines.find((l) => /^Q[:.)]?\s*/i.test(l));
    const aLine = lines.find((l) => /^A[:.)]?\s*/i.test(l));
    if (!qLine || !aLine) {
      errors.push(`Question ${i + 1}: needs both a "Q:" line and an "A:" line.`);
      return;
    }
    const text = qLine.replace(/^Q[:.)]?\s*/i, "").trim();
    if (!/_{2,}/.test(text)) {
      errors.push(`Question ${i + 1}: the question needs a blank, shown as "___".`);
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

export function getFillBlankQuestions(domainId) {
  return delay(fillBlankByDomain[domainId] || []);
}

export function publishFillBlankQuestions(domainId, text) {
  const { questions, errors } = parseFillBlankText(text);
  if (questions.length === 0) return delay({ error: "No valid fill-in-the-blank questions to publish." });
  const withIds = questions.map((q) => ({ id: nextFillBlankId++, ...q }));
  fillBlankByDomain[domainId] = (fillBlankByDomain[domainId] || []).concat(withIds);
  return delay({ published: withIds.length, questions: fillBlankByDomain[domainId] });
}

export function deleteFillBlankQuestion(domainId, questionId) {
  fillBlankByDomain[domainId] = (fillBlankByDomain[domainId] || []).filter((q) => q.id !== questionId);
  return delay({ questions: fillBlankByDomain[domainId] });
}

// ---- Coding ----
// Structured, one question at a time (a coding prompt doesn't paste-parse
// as naturally as short MCQ/fill-blank lines).
export function getCodingQuestions(domainId) {
  return delay(codingByDomain[domainId] || []);
}

export function addCodingQuestion(domainId, { title, language, prompt, starterCode, sampleOutput }) {
  const cleanTitle = (title || "").trim();
  const cleanPrompt = (prompt || "").trim();
  if (!cleanTitle) return delay({ error: "A title is required." });
  if (!cleanPrompt) return delay({ error: "A problem statement is required." });
  const question = {
    id: nextCodingId++,
    title: cleanTitle,
    language: language || "javascript",
    prompt: cleanPrompt,
    starterCode: starterCode || "",
    sampleOutput: (sampleOutput || "").trim(),
  };
  codingByDomain[domainId] = (codingByDomain[domainId] || []).concat(question);
  return delay({ question, questions: codingByDomain[domainId] });
}

export function deleteCodingQuestion(domainId, questionId) {
  codingByDomain[domainId] = (codingByDomain[domainId] || []).filter((q) => q.id !== questionId);
  return delay({ questions: codingByDomain[domainId] });
}
