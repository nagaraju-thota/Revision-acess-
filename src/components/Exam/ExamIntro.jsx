import { useState } from "react";
import ThemeToggle from "../Shared/ThemeToggle";
import { MAX_VIOLATIONS } from "../../hooks/useAntiCheat";

export default function ExamIntro({ exam, onStart, onBack }) {
  const [entering, setEntering] = useState(false);

  const handleStart = async () => {
    setEntering(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen isn't available in this environment (e.g. an embedded
      // iframe without the fullscreen permission, or the browser blocked
      // it). The exam still proceeds — violation tracking for tab
      // switches, window blur, and minimize applies regardless.
    }
    onStart();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <ThemeToggle />
      <div className="w-full max-w-md sm:max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Assessment</p>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-4">{exam.title}</h1>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <p>
            {exam.questions.length} question{exam.questions.length === 1 ? "" : "s"}, {Math.round(exam.duration / 60)} minutes.
          </p>
          <p>Answer each question — multiple choice, fill in the blank, or coding — as it appears.</p>
          <p>The exam auto-submits when the timer reaches zero.</p>
          <p>You'll see your score right after submitting, with an option to download a PDF of your results.</p>
          <p>The exam runs in fullscreen. Right-click and copy/paste are disabled for the duration.</p>
          <p className="text-red-600 dark:text-red-400">
            Switching tabs, losing window focus, minimizing the browser, or leaving fullscreen is logged as a
            violation. You get {MAX_VIOLATIONS} — on the {MAX_VIOLATIONS}rd, the exam is automatically submitted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStart}
            disabled={entering}
            className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-60"
          >
            {entering ? "Starting…" : "Start exam"}
          </button>
          <button
            onClick={onBack}
            className="h-9 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Choose a different domain
          </button>
        </div>
      </div>
    </div>
  );
}
