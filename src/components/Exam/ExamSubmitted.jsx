import { useState } from "react";
import { CheckCircle2, ShieldAlert, Download, Loader2, LayoutDashboard } from "lucide-react";
import ThemeToggle from "../Shared/ThemeToggle";
import { MAX_VIOLATIONS } from "../../hooks/useAntiCheat";
import { downloadResultPdf } from "../../utils/pdfReport";
import { useToast } from "../../context/ToastContext";

// `result` is the payload App.jsx got back from api.submitExam — see the
// comment above that call. It's only present once the backend has scored
// the attempt and sent back score/total/answer-key/etc., so every score-
// and-PDF bit below is guarded on it being there. If it's missing (backend
// hasn't returned it yet, or the submit request failed) this screen falls
// back to exactly the plain confirmation it always showed.
export default function ExamSubmitted({ reason, violationCount = 0, result, onDone, onViewDashboard }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const terminated = reason === "violations" || reason === "left-tab";
  const hasScore = result && typeof result.score === "number" && typeof result.total === "number";

  let title = "Exam submitted";
  let message = "Your responses have been recorded. Your manager will share results.";
  if (reason === "violations") {
    title = "Exam terminated — repeated violations";
    message = `Your exam was automatically submitted after reaching ${violationCount || MAX_VIOLATIONS} anti-cheating violations (tab switches, window changes, minimizing, or leaving fullscreen). Your answers up to that point were recorded and sent to your manager, along with the full violation report.`;
  } else if (reason === "left-tab") {
    title = "Exam ended — left the tab";
    message =
      "Switching tabs or windows during the exam ends it automatically. Your answers up to that point were recorded and sent to your manager.";
  } else if (hasScore) {
    message = "Your responses have been recorded. Here's how you did — you can also download a PDF copy below.";
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      downloadResultPdf(result);
    } catch (err) {
      toast.error("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <ThemeToggle />
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 ${
            terminated ? "bg-red-600" : "bg-brand-600 dark:bg-brand-500"
          }`}
        >
          {terminated ? (
            <ShieldAlert size={18} className="text-white" />
          ) : (
            <CheckCircle2 size={18} className="text-white" />
          )}
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

        {hasScore && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              Your score
            </p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
              {result.score} / {result.total}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {hasScore && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {downloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              {downloading ? "Preparing PDF…" : "Download my results (PDF)"}
            </button>
          )}
          {hasScore && onViewDashboard && (
            <button
              onClick={onViewDashboard}
              className="h-9 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-center gap-1.5"
            >
              <LayoutDashboard size={14} /> View my dashboard
            </button>
          )}
          <button
            onClick={onDone}
            className="h-9 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}
