import { jsPDF } from "jspdf";
import { MAX_VIOLATIONS, VIOLATION_TYPE_LABELS } from "../hooks/useAntiCheat";

const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd" };

// Builds a one-employee exam report PDF and triggers a browser download.
// Runs entirely client-side (no backend endpoint needed), so it works
// whether the app is on mock data or the real API — both resolve
// api.getResultDetail(...) to this same `result` shape (score, total,
// timeTaken, reason, submittedAt, questions[], and violationCount/
// violations[] — the Anti-Cheating Report, included below the answer
// breakdown so the PDF stays the permanent, downloadable audit record).
export function downloadResultPdf(result) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };

  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Assessment Portal — Exam Report", marginX, y);
  y += 28;

  doc.setFontSize(11);
  doc.setTextColor(70);
  const statusLabel =
    result.reason === "violations"
      ? "Terminated — repeated anti-cheating violations"
      : result.reason === "left-tab"
        ? "Ended — left tab during exam"
        : "Submitted";
  const submittedLabel = result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "—";
  [
    `Employee: ${result.name}  (${result.studentId})`,
    `Domain: ${result.domainName}`,
    `Score: ${result.score} / ${result.total}`,
    `Time taken: ${result.timeTaken}`,
    `Status: ${statusLabel}`,
    `Submitted at: ${submittedLabel}`,
  ].forEach((line) => {
    doc.text(line, marginX, y);
    y += 16;
  });

  y += 8;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Answer breakdown", marginX, y);
  y += 20;

  doc.setFontSize(10);
  (result.questions || []).forEach((q, i) => {
    const questionLines = doc.splitTextToSize(`${i + 1}. ${q.text}`, maxWidth);
    ensureSpace(questionLines.length * 13 + 40);

    doc.setTextColor(0);
    doc.text(questionLines, marginX, y);
    y += questionLines.length * 13 + 4;

    // mcq/fill_blank/coding each grade and display differently -- options
    // and acceptedAnswers only exist on the types that use them, so q.type
    // picks the right comparison instead of assuming q.options is always
    // there (it's null for fill_blank/coding, which used to crash this).
    if (q.type === "fill_blank") {
      const studentText = typeof q.studentAnswer === "string" ? q.studentAnswer.trim() : "";
      const accepted = q.acceptedAnswers || [];
      const correct = studentText !== "" && accepted.some((a) => a.trim().toLowerCase() === studentText.toLowerCase());
      const answeredLines = doc.splitTextToSize(`Answered: ${studentText || "— not answered"}${correct ? "  (correct)" : ""}`, maxWidth - 14);
      doc.setTextColor(correct ? 30 : 180, correct ? 120 : 40, correct ? 60 : 40);
      doc.text(answeredLines, marginX + 14, y);
      y += answeredLines.length * 13;
      if (!correct) {
        doc.setTextColor(100);
        const acceptedLines = doc.splitTextToSize(`Accepted answer(s): ${accepted.join(", ") || "—"}`, maxWidth - 14);
        doc.text(acceptedLines, marginX + 14, y);
        y += acceptedLines.length * 13;
      }
    } else if (q.type === "coding") {
      // studentAnswer is { language, code } now that the exam runner lets
      // students switch languages per question (older submissions before
      // that feature stored a plain code string, so both shapes are handled).
      const isObjectAnswer = q.studentAnswer && typeof q.studentAnswer === "object";
      const studentCode = isObjectAnswer
        ? (typeof q.studentAnswer.code === "string" ? q.studentAnswer.code.trim() : "")
        : (typeof q.studentAnswer === "string" ? q.studentAnswer.trim() : "");
      const studentLang = isObjectAnswer ? q.studentAnswer.language : q.language;
      doc.setTextColor(100);
      const submittedLines = doc.splitTextToSize(
        studentCode ? `Submitted code (${studentLang || "?"}):\n${studentCode}` : "Not answered.",
        maxWidth - 14
      );
      ensureSpace(submittedLines.length * 13 + 10);
      doc.text(submittedLines, marginX + 14, y);
      y += submittedLines.length * 13;
      doc.setTextColor(140);
      doc.text("(Coding questions aren't auto-graded — reviewed manually.)", marginX + 14, y);
      y += 14;
    } else {
      const options = q.options || [];
      const correct = q.studentAnswer === q.correctIndex;
      const answeredText = q.studentAnswer !== undefined && q.studentAnswer !== null ? options[q.studentAnswer] : "— not answered";
      if (correct) doc.setTextColor(30, 120, 60);
      else doc.setTextColor(180, 40, 40);
      doc.text(`Answered: ${answeredText ?? "— not answered"}${correct ? "  (correct)" : ""}`, marginX + 14, y);
      y += 14;

      if (!correct) {
        doc.setTextColor(100);
        doc.text(`Correct answer: ${options[q.correctIndex] ?? "—"}`, marginX + 14, y);
        y += 14;
      }
    }
    y += 8;
  });

  // ---- Anti-Cheating Report -------------------------------------------
  const violationCount = result.violationCount || 0;
  const violations = result.violations || [];
  ensureSpace(60);
  y += 10;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Anti-Cheating Report  (${violationCount} / ${MAX_VIOLATIONS} violations)`, marginX, y);
  y += 20;

  if (violationCount >= MAX_VIOLATIONS) {
    ensureSpace(24);
    doc.setFontSize(10);
    doc.setTextColor(180, 40, 40);
    doc.text("Exam automatically terminated and submitted after reaching the violation limit.", marginX, y);
    doc.setTextColor(0);
    y += 20;
  }

  doc.setFontSize(10);
  if (violations.length === 0) {
    doc.setTextColor(100);
    doc.text("No violations recorded during this attempt.", marginX, y);
    doc.setTextColor(0);
    y += 16;
  } else {
    violations.forEach((v) => {
      ensureSpace(16);
      const label = VIOLATION_TYPE_LABELS[v.type] || v.type;
      const when = v.timestamp ? new Date(v.timestamp).toLocaleString() : "—";
      const ordinal = ORDINALS[v.violationNumber] || `${v.violationNumber}`;
      doc.text(`${ordinal} violation — ${label} — ${when} — ${v.action}`, marginX, y);
      y += 15;
    });
  }

  const safeName = (result.name || "student").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`exam-report-${result.studentId}-${safeName}.pdf`);
}
