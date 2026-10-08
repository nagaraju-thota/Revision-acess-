import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Maximize } from "lucide-react";
import { MAX_VIOLATIONS, WARNING_SECONDS, VIOLATION_TYPE_LABELS } from "../../hooks/useAntiCheat";

// Full-screen overlay shown after every anti-cheat violation. For
// violations 1-2 the ONLY way past this screen — clicking through or
// letting the countdown expire — re-requests fullscreen every time. There
// is no "continue without fullscreen" path: the exam is meant to stay in
// fullscreen for its entire duration. For violation 3 there's nothing to
// return to — the exam has already been auto-submitted and ExamRunner is
// about to navigate away.
export default function ViolationWarningModal({ warning, onReturn }) {
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);

  useEffect(() => {
    setSecondsLeft(WARNING_SECONDS);
  }, [warning.violationNumber]);

  useEffect(() => {
    if (warning.terminated) return undefined;
    if (secondsLeft <= 0) {
      onReturn();
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, warning.terminated]);

  const label = VIOLATION_TYPE_LABELS[warning.type] || warning.type;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl p-6 text-center">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4 ${
            warning.terminated ? "bg-red-600" : "bg-amber-500"
          }`}
        >
          {warning.terminated ? <ShieldAlert size={20} className="text-white" /> : <AlertTriangle size={20} className="text-white" />}
        </div>

        {warning.terminated ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Exam terminated</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Violation {warning.violationNumber} of {MAX_VIOLATIONS} ({label}) was your third anti-cheating violation.
              Your exam has been automatically submitted.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">
              Violation {warning.violationNumber} of {MAX_VIOLATIONS} recorded
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {label} detected. The exam must stay in fullscreen — on your {MAX_VIOLATIONS}rd violation it's
              automatically submitted.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">Returns to fullscreen automatically in {secondsLeft}s.</p>
            <button
              onClick={onReturn}
              className="h-9 px-5 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 flex items-center gap-1.5 mx-auto"
            >
              <Maximize size={14} /> Return to exam
            </button>
          </>
        )}
      </div>
    </div>
  );
}
