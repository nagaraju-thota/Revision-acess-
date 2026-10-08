import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

// Lets the admin set how long students get on each domain's exam. Keeps its
// own draft-minutes state per domain so typing in one row never touches the
// others, and only calls the API when that row's Save is pressed.
export default function ExamTimerTab({ domains, onUpdated }) {
  const toast = useToast();
  const [minutesByDomain, setMinutesByDomain] = useState(
    Object.fromEntries(domains.map((d) => [d.id, Math.round(d.duration / 60)]))
  );
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [errorByDomain, setErrorByDomain] = useState({});

  const setMinutes = (domainId, value) => {
    setSavedId(null);
    setMinutesByDomain((m) => ({ ...m, [domainId]: value }));
  };

  const save = async (domainId) => {
    const minutes = Number(minutesByDomain[domainId]);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setErrorByDomain((e) => ({ ...e, [domainId]: "Enter a whole number of minutes greater than 0." }));
      return;
    }
    setSavingId(domainId);
    setSavedId(null);
    setErrorByDomain((e) => ({ ...e, [domainId]: "" }));
    try {
      await api.updateDomainDuration(domainId, minutes * 60);
      setSavedId(domainId);
      toast.success(`Timer updated to ${minutes} min for ${domains.find((d) => d.id === domainId)?.name}`);
      onUpdated?.();
    } catch (err) {
      setErrorByDomain((e) => ({ ...e, [domainId]: err.message }));
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Set how many minutes students get for each domain's exam. Applies to every exam started after you save.
      </p>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
        {domains.map((d) => (
          <div key={d.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{d.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{d.questionCount} questions</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min={1}
                  value={minutesByDomain[d.id]}
                  onChange={(e) => setMinutes(d.id, e.target.value)}
                  className="w-16 h-9 px-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
                <button
                  disabled={savingId === d.id}
                  onClick={() => save(d.id)}
                  className="h-9 px-3 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
                >
                  {savingId === d.id ? "Saving…" : "Save"}
                </button>
                {savedId === d.id && <Check size={16} className="text-green-600 dark:text-green-500" />}
              </div>
            </div>
            {errorByDomain[d.id] && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> {errorByDomain[d.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
