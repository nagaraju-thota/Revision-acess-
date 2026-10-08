import { ShieldAlert, ShieldCheck } from "lucide-react";
import { MAX_VIOLATIONS, VIOLATION_TYPE_LABELS } from "../../hooks/useAntiCheat";

const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd" };

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// Shown inside the admin's exam result details (AnswerModal). Permanently
// reflects whatever violationCount/violations the backend stored at submit
// time — the same real-time log the student's exam session produced, kept
// on the result record for auditing.
export default function AntiCheatReport({ violationCount = 0, violations = [], terminated = false }) {
  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          {violationCount > 0 ? (
            <ShieldAlert size={15} className="text-amber-600 dark:text-amber-500" />
          ) : (
            <ShieldCheck size={15} className="text-green-600 dark:text-green-500" />
          )}
          Anti-Cheating Report
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            violationCount > 0
              ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
              : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
          }`}
        >
          {violationCount} / {MAX_VIOLATIONS} violations
        </span>
      </div>

      {terminated && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md px-3 py-2 mb-3">
          Exam automatically terminated and submitted after reaching {MAX_VIOLATIONS} anti-cheating violations.
        </p>
      )}

      {violations.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No violations recorded during this attempt.</p>
      ) : (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Date &amp; time</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{ORDINALS[v.violationNumber] || v.violationNumber}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{VIOLATION_TYPE_LABELS[v.type] || v.type}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{formatDateTime(v.timestamp)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        v.action === "Exam Terminated"
                          ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                          : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {v.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
