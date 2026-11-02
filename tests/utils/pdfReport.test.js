import { vi } from "vitest";

const calls = { text: [], save: [], addPage: 0 };

vi.mock("jspdf", () => {
  class FakeJsPDF {
    constructor() {
      this.internal = { pageSize: { getHeight: () => 200, getWidth: () => 595 } };
    }
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {
      calls.addPage += 1;
    }
    splitTextToSize(text) {
      return String(text).split("\n");
    }
    text(t) {
      calls.text.push(Array.isArray(t) ? t.join("\n") : t);
    }
    save(name) {
      calls.save.push(name);
    }
  }
  return { jsPDF: FakeJsPDF };
});

import { downloadResultPdf } from "../../src/utils/pdfReport";

beforeEach(() => {
  calls.text.length = 0;
  calls.save.length = 0;
  calls.addPage = 0;
});

const base = {
  name: "Asha Rao",
  studentId: "S-1",
  domainName: "Frontend",
  score: 1,
  total: 4,
  timeTaken: "05:00",
  submittedAt: "2026-01-01T10:00:00Z",
  reason: "submitted",
  questions: [],
  violationCount: 0,
  violations: [],
};

const output = () => calls.text.join("\n");

describe("downloadResultPdf", () => {
  it("saves a file named after the student", () => {
    downloadResultPdf(base);
    expect(calls.save).toEqual(["exam-report-S-1-Asha_Rao.pdf"]);
    expect(output()).toContain("Score: 1 / 4");
    expect(output()).toContain("No violations recorded");
  });

  it("falls back to 'student' when there's no name, and prints a dash without submittedAt", () => {
    downloadResultPdf({ ...base, name: undefined, submittedAt: null });
    expect(calls.save[0]).toBe("exam-report-S-1-student.pdf");
    expect(output()).toContain("Submitted at: —");
  });

  it.each([
    ["violations", "Terminated — repeated anti-cheating violations"],
    ["left-tab", "Ended — left tab during exam"],
    ["submitted", "Status: Submitted"],
  ])("labels reason %s", (reason, label) => {
    downloadResultPdf({ ...base, reason });
    expect(output()).toContain(label);
  });

  it("renders MCQ answers: correct, wrong, and unanswered", () => {
    downloadResultPdf({
      ...base,
      questions: [
        { type: "mcq", text: "Q1", options: ["a", "b"], correctIndex: 1, studentAnswer: 1 },
        { type: "mcq", text: "Q2", options: ["a", "b"], correctIndex: 1, studentAnswer: 0 },
        { type: "mcq", text: "Q3", options: ["a", "b"], correctIndex: 1, studentAnswer: null },
        { text: "Q4 no type, no options", correctIndex: 0, studentAnswer: undefined },
      ],
    });
    const out = output();
    expect(out).toContain("Answered: b  (correct)");
    expect(out).toContain("Answered: a");
    expect(out).toContain("Correct answer: b");
    expect(out).toContain("— not answered");
  });

  it("renders fill-in-the-blank answers case-insensitively", () => {
    downloadResultPdf({
      ...base,
      questions: [
        { type: "fill_blank", text: "F1", studentAnswer: " PARIS ", acceptedAnswers: ["paris"] },
        { type: "fill_blank", text: "F2", studentAnswer: "rome", acceptedAnswers: ["paris", "lyon"] },
        { type: "fill_blank", text: "F3", studentAnswer: 5 },
      ],
    });
    const out = output();
    expect(out).toContain("(correct)");
    expect(out).toContain("Accepted answer(s): paris, lyon");
    expect(out).toContain("Accepted answer(s): —");
  });

  it("renders coding answers in both object and legacy string formats", () => {
    downloadResultPdf({
      ...base,
      questions: [
        { type: "coding", text: "C1", studentAnswer: { language: "python", code: " print(1) " } },
        { type: "coding", text: "C2", studentAnswer: { language: "python" } },
        { type: "coding", text: "C3", studentAnswer: "legacy()", language: "javascript" },
        { type: "coding", text: "C4", studentAnswer: 42 },
      ],
    });
    const out = output();
    expect(out).toContain("Submitted code (python):");
    expect(out).toContain("Submitted code (javascript):");
    expect(out).toContain("Not answered.");
    expect(out).toContain("aren't auto-graded");
  });

  it("lists violations with ordinals and notes termination at the limit", () => {
    downloadResultPdf({
      ...base,
      violationCount: 3,
      violations: [
        { type: "tab-switch", violationNumber: 1, timestamp: "2026-01-01T10:01:00Z", action: "Warning Issued" },
        { type: "weird-type", violationNumber: 2, action: "Warning Issued" },
        { type: "fullscreen-exit", violationNumber: 3, timestamp: "2026-01-01T10:03:00Z", action: "Exam Terminated" },
        { type: "window-blur", violationNumber: 4, action: "x" },
      ],
    });
    const out = output();
    expect(out).toContain("3 / 3 violations");
    expect(out).toContain("automatically terminated");
    expect(out).toContain("1st violation — Tab Switch");
    expect(out).toContain("2nd violation — weird-type");
    expect(out).toContain("3rd violation — Fullscreen Exit");
    expect(out).toContain("4 violation — Window Blur");
  });

  it("adds pages when the content is long", () => {
    const questions = Array.from({ length: 30 }, (_, i) => ({
      type: "mcq",
      text: `Question ${i}`,
      options: ["a"],
      correctIndex: 0,
      studentAnswer: 0,
    }));
    downloadResultPdf({ ...base, questions, violations: Array.from({ length: 20 }, (_, i) => ({ type: "tab-switch", violationNumber: i + 1, action: "x" })) });
    expect(calls.addPage).toBeGreaterThan(0);
  });

  it("tolerates a result with no questions array", () => {
    downloadResultPdf({ ...base, questions: undefined, violationCount: undefined, violations: undefined });
    expect(calls.save).toHaveLength(1);
  });
});
