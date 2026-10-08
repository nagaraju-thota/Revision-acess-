import { useEffect, useState } from "react";
import { Calendar, AlertCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

// <input type="datetime-local"> gives/takes "YYYY-MM-DDTHH:mm" with no
// timezone suffix -- `new Date(...)` on that string is interpreted as the
// BROWSER'S local time, and .toISOString() converts it to UTC correctly
// from there. This only works out if the admin's browser is set to IST,
// which is the same assumption the rest of the portal already makes (see
// backend data/pool.js, which forces every DB connection to IST).
function isoToLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Lets the admin set the portal-wide exam window (start time + grace
// period) and grant/revoke a per-student exception once that window has
// closed. Mirrors backend routes/admin.routes.js's /exam-schedule and
// /students/:studentId/override endpoints.
export default function ExamScheduleTab() {
  const toast = useToast();
  const [startTimeInput, setStartTimeInput] = useState("");
  const [graceMinutes, setGraceMinutes] = useState(0);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [overrideId, setOverrideId] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState("");
  const [overrideError, setOverrideError] = useState(false);

  useEffect(() => {
    api
      .getExamSchedule()
      .then((data) => {
        setCurrentSchedule(data.schedule);
        setStartTimeInput(isoToLocalInputValue(data.schedule?.startTime));
        setGraceMinutes(data.schedule?.graceMinutes ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async (clear) => {
    setSaving(true);
    setError("");
    try {
      const minutes = Number(graceMinutes) || 0;
      if (minutes < 0) {
        setError("Grace period must be a non-negative number of minutes.");
        return;
      }
      const startTime = clear ? null : startTimeInput ? new Date(startTimeInput).toISOString() : null;
      if (!clear && !startTimeInput) {
        setError("Pick a start time, or use \"Clear\" to reopen exams with no schedule.");
        return;
      }
      const data = await api.setExamSchedule({ startTime, graceMinutes: minutes });
      setCurrentSchedule(data.schedule);
      if (clear) setStartTimeInput("");
      toast.success(startTime ? "Exam schedule saved." : "Exam schedule cleared — exams are open now.");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const grantOverride = async (grant) => {
    const id = overrideId.trim().toUpperCase();
    if (!id) {
      setOverrideError(true);
      setOverrideMessage("Enter an Employee/Student ID first.");
      return;
    }
    setOverrideSaving(true);
    setOverrideError(false);
    setOverrideMessage("");
    try {
      await api.setStudentOverride(id, grant);
      setOverrideMessage(
        grant ? `${id} can now start the exam even after the window closes.` : `${id}'s override access was revoked.`
      );
      toast.success(grant ? `Override granted for ${id}.` : `Override revoked for ${id}.`);
    } catch (err) {
      setOverrideError(true);
      setOverrideMessage(err.message);
      toast.error(err.message);
    } finally {
      setOverrideSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-400 dark:text-gray-500">Loading schedule…</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Set when students are first allowed to start any exam, and how long after that late logins are still let
          in. Leave the start time empty (or use Clear below) to keep exams open with no schedule.
        </p>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Exam start time</label>
              <input
                type="datetime-local"
                value={startTimeInput}
                onChange={(e) => setStartTimeInput(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Grace period (minutes)</label>
              <input
                type="number"
                min={0}
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              disabled={saving}
              onClick={() => save(false)}
              className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save schedule"}
            </button>
            <button
              disabled={saving}
              onClick={() => save(true)}
              className="h-9 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
            >
              Clear (open exams now)
            </button>
          </div>

          {currentSchedule?.startTime ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Calendar size={12} />
              Currently open from {new Date(currentSchedule.startTime).toLocaleString()} for {currentSchedule.graceMinutes} min.
            </p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">No schedule set — exams are open right now.</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Grant one student access to start the exam even after the window above has closed for everyone else —
          useful when someone logs in late for a genuine reason.
        </p>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              placeholder="Employee / Student ID"
              value={overrideId}
              onChange={(e) => setOverrideId(e.target.value)}
              className="flex-1 h-10 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
            />
            <div className="flex gap-2 shrink-0">
              <button
                disabled={overrideSaving}
                onClick={() => grantOverride(true)}
                className="h-10 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40 flex items-center gap-1.5"
              >
                <ShieldCheck size={14} /> Grant access
              </button>
              <button
                disabled={overrideSaving}
                onClick={() => grantOverride(false)}
                className="h-10 px-4 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
              >
                <ShieldOff size={14} /> Revoke
              </button>
            </div>
          </div>
          {overrideMessage && (
            <p className={`text-xs ${overrideError ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
              {overrideMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
