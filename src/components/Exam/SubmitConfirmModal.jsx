import { Send, AlertTriangle } from "lucide-react";

// Shown when the student clicks "Submit exam" — a deliberate action should
// get a confirmation step before it's irreversible, same reasoning as any
// "are you sure?" pattern. This only gates the MANUAL submit button;
// timeout and the 3rd-violation auto-submit in ExamRunner.jsx call finish()
// directly and skip this entirely, since those aren't something the
// student is choosing to do in the moment — there's nothing to confirm.
export default function SubmitConfirmModal({ answeredCount, total, onConfirm, onCancel }) {
  const unanswered = total - answeredCount;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-xl p-6 text-center">
        <div className="w-11 h-11 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center mx-auto mb-4">
          <Send size={18} className="text-white" />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Submit your exam?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          You've answered {answeredCount} of {total} questions.
        </p>

        {unanswered > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 mt-3 flex items-center gap-1.5 text-left">
            <AlertTriangle size={13} className="shrink-0" />
            {unanswered} question{unanswered === 1 ? "" : "s"} still unanswered — {unanswered === 1 ? "it" : "they"} will be
            marked as not answered.
          </p>
        )}

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 mb-5">This can't be undone once submitted.</p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-10 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Continue exam
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400"
          >
            Submit exam
          </button>
        </div>
      </div>
    </div>
  );
}
