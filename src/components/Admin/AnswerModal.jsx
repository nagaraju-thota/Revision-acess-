import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, Download } from "lucide-react";
import { api } from "../../api/client";
import { downloadResultPdf } from "../../utils/pdfReport";
import { SkeletonLines } from "../Shared/Skeleton";
import AntiCheatReport from "./AntiCheatReport";
import { MAX_VIOLATIONS } from "../../hooks/useAntiCheat";

export default function AnswerModal({ resultId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getResultDetail(resultId)
      .then((data) => setDetail(data.result))
      .catch((err) => setError(err.message));
  }, [resultId]);

  // Lock background scroll while open, and always render at the very end of
  // <body> (a portal) rather than wherever this component happens to sit in
  // the tree — that's what guarantees the backdrop paints above every other
  // fixed element on the page (e.g. the theme toggle) with nothing able to
  // peek through its edges.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!detail && !error && <SkeletonLines count={5} />}

        {detail && (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {detail.studentId} · {detail.domainName}
            </p>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">{detail.name}'s answers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Score: {detail.score} / {detail.total}
            </p>
            <div className="space-y-4">
              {detail.questions.map((q, i) => {
                // mcq/fill_blank/coding each grade and display differently --
                // options/correctIndex only exist on mcq questions, so q.type
                // picks the right comparison instead of assuming q.options is
                // always there (it's undefined for fill_blank/coding, which
                // used to crash this modal — see pdfReport.js for the same fix).
                let correct = false;
                let answeredNode = "— not answered";
                let correctNode = null;

                if (q.type === "fill_blank") {
                  const studentText = typeof q.studentAnswer === "string" ? q.studentAnswer.trim() : "";
                  const accepted = q.acceptedAnswers || q.answers || [];
                  correct =
                    studentText !== "" &&
                    accepted.some((a) => a.trim().toLowerCase() === studentText.toLowerCase());
                  answeredNode = studentText || "— not answered";
                  if (!correct) correctNode = accepted.join(", ") || "—";
                } else if (q.type === "coding") {
                  // studentAnswer is { language, code }; older submissions may
                  // have stored a plain code string instead.
                  const isObjectAnswer = q.studentAnswer && typeof q.studentAnswer === "object";
                  const studentCode = isObjectAnswer
                    ? typeof q.studentAnswer.code === "string" ? q.studentAnswer.code.trim() : ""
                    : typeof q.studentAnswer === "string" ? q.studentAnswer.trim() : "";
                  answeredNode = studentCode ? "Code submitted (not auto-graded)" : "— not answered";
                } else {
                  correct = q.studentAnswer === q.correctIndex;
                  const options = q.options || [];
                  answeredNode = q.studentAnswer !== undefined ? options[q.studentAnswer] ?? "—" : "— not answered";
                  if (!correct) correctNode = options[q.correctIndex] ?? "—";
                }

                // Coding isn't auto-gradable, so it gets a neutral marker
                // instead of a green/red check.
                const isCoding = q.type === "coding";

                return (
                  <div key={q.id} className="text-sm">
                    <p className="text-gray-900 dark:text-gray-100 mb-1.5 flex items-start gap-1.5">
                      <span
                        className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                          isCoding
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            : correct
                              ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                              : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {isCoding ? "•" : correct ? <Check size={11} /> : <X size={11} />}
                      </span>
                      {i + 1}. {q.text}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 pl-5">Answered: {answeredNode}</p>
                    {!correct && !isCoding && correctNode !== null && (
                      <p className="text-gray-400 dark:text-gray-500 pl-5">Correct: {correctNode}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <AntiCheatReport
              violationCount={detail.violationCount || 0}
              violations={detail.violations || []}
              terminated={(detail.violationCount || 0) >= MAX_VIOLATIONS}
            />
          </>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300"
          >
            Close
          </button>
          {detail && (
            <button
              onClick={() => downloadResultPdf(detail)}
              className="h-8 px-3 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 flex items-center gap-1.5"
            >
              <Download size={13} /> Download PDF
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
