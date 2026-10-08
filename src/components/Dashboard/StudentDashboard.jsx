import { useEffect, useMemo, useState } from "react";
import {
  LogOut,
  CalendarClock,
  Award,
  ChevronRight,
  Loader2,
  Download,
  ShieldAlert,
  CheckCircle2,
  Code2,
  Layers,
  Server,
  Database,
  Sparkles,
  Clock,
  FileCheck2,
} from "lucide-react";
import { api } from "../../api/client";
import { downloadResultPdf } from "../../utils/pdfReport";
import { SkeletonCardGrid } from "../Shared/Skeleton";
import ThemeToggle from "../Shared/ThemeToggle";
import BrandMark from "../Shared/BrandMark";
import Footer from "../Shared/Footer";
import ScoreRing from "./ScoreRing";
import { MAX_VIOLATIONS } from "../../hooks/useAntiCheat";
import { useToast } from "../../context/ToastContext";

const DOMAIN_ICONS = {
  "python-fullstack": Code2,
  frontend: Layers,
  backend: Server,
  database: Database,
};

const STATUS_LABEL = { violations: "Terminated", "left-tab": "Left tab" };

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// The landing screen right after a student signs in. Two tabs:
//  - Scheduled: pick and start the assigned assessment (same api.getDomains
//    + onSelectDomain flow App.jsx already drives for the intro/exam stages)
//  - Completed: this student's own finished attempt(s), each with a score
//    ring and a "Download PDF" button reusing the same utils/pdfReport.js
//    builder the admin dashboard uses.
//
// `latestResult` is the full result object App.jsx just got back from
// api.submitExam for *this* session (see App.jsx handleSubmit) — passing it
// in lets the Completed tab show that attempt instantly, with zero extra
// network round-trip, the moment the student lands back here after
// finishing. api.getMyResults still runs alongside it so the tab stays
// correct/refreshable on its own too.
export default function StudentDashboard({ student, onLogout, onSelectDomain, selecting, latestResult }) {
  const toast = useToast();
  // Land straight on Completed for anyone we already know is done — either
  // this session's own just-finished attempt (latestResult) or a returning
  // student whose login response said hasAttempted (see auth.routes.js).
  // Avoids a flash of the Scheduled tab while the results fetch is still in
  // flight.
  const [tab, setTab] = useState(latestResult || student.hasAttempted ? "completed" : "scheduled");
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    api
      .getDomains()
      .then((data) => setDomains(data.domains))
      .catch((err) => toast.error(err.message))
      .finally(() => setDomainsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api
      .getMyResults(student.id)
      .then((data) => setResults(data.results || []))
      .catch(() => {})
      .finally(() => setResultsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  // Merge the just-finished attempt (if any) with the fetched history,
  // de-duplicated by resultId — latestResult wins since it also carries the
  // full per-question detail the fetched summary rows don't.
  const completedResults = useMemo(() => {
    const byId = new Map(results.map((r) => [r.resultId, r]));
    if (latestResult) byId.set(latestResult.resultId, latestResult);
    return [...byId.values()].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }, [results, latestResult]);

  const hasCompleted = completedResults.length > 0;
  const loadingEither = domainsLoading || resultsLoading;

  const handleSelect = (d) => {
    setPendingId(d.id);
    onSelectDomain(d);
  };

  const handleDownload = async (row) => {
    setDownloadingId(row.resultId);
    try {
      // Already have full per-question detail (e.g. it's latestResult) —
      // no need to fetch it again.
      const full = row.questions ? row : (await api.getMyResultDetail(student.id, row.resultId)).result;
      downloadResultPdf(full);
    } catch (err) {
      toast.error(err.message || "Couldn't generate the PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <BrandMark className="h-6" />
          <div className="flex items-center gap-2">
            <ThemeToggle className="" />
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {/* Hero / welcome banner — gradient matches the logo's cyan-to-blue,
            with a couple of soft blurred circles for depth rather than a
            flat fill. Pure CSS, no extra image assets. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 dark:from-brand-600 dark:to-brand-800 px-6 py-7 mb-8">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-14 -left-6 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-100 mb-1 flex items-center gap-1.5">
                <Sparkles size={13} /> Assessment portal
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-1">Welcome, {student.name}</h1>
              <p className="text-sm text-brand-100">Employee ID {student.id}</p>
            </div>
            {hasCompleted && (
              <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white">
                <p className="text-[11px] uppercase tracking-wide text-brand-100 mb-0.5">Latest score</p>
                <p className="text-lg font-semibold tabular-nums">
                  {completedResults[0].score} / {completedResults[0].total}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTab("scheduled")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "scheduled"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <CalendarClock size={14} /> Scheduled
          </button>
          <button
            onClick={() => setTab("completed")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "completed"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <Award size={14} /> Completed
            {completedResults.length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-400 text-[10px] font-semibold">
                {completedResults.length}
              </span>
            )}
          </button>
        </div>

        {tab === "scheduled" ? (
          loadingEither ? (
            <SkeletonCardGrid count={4} />
          ) : hasCompleted ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
              <div className="w-11 h-11 rounded-full bg-brand-600 dark:bg-brand-500 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">
                You've completed your assessment
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
                Each Employee ID gets one attempt. Head over to the Completed tab to see your score and download
                your report.
              </p>
              <button
                onClick={() => setTab("completed")}
                className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 inline-flex items-center gap-1.5"
              >
                <Award size={14} /> View my results
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Pick the domain your manager assigned to you to begin.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {domains.map((d) => {
                  const Icon = DOMAIN_ICONS[d.id] || Layers;
                  const isPending = pendingId === d.id && selecting;
                  return (
                    <button
                      key={d.id}
                      onClick={() => handleSelect(d)}
                      disabled={selecting}
                      className="text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-gray-400 dark:hover:border-gray-600 transition-colors group disabled:opacity-60"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 group-hover:bg-brand-600 dark:group-hover:bg-brand-500 transition-colors">
                        {isPending ? (
                          <Loader2 size={16} className="text-gray-700 dark:text-gray-300 animate-spin" />
                        ) : (
                          <Icon size={16} className="text-gray-700 dark:text-gray-300 group-hover:text-white transition-colors" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-1">
                        {d.name} <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{d.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {d.questionCount} questions · {Math.round(d.duration / 60)} min
                      </p>
                    </button>
                  );
                })}
              </div>
            </>
          )
        ) : resultsLoading && !latestResult ? (
          <SkeletonCardGrid count={2} />
        ) : completedResults.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-10 text-center">
            <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FileCheck2 size={18} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No completed exams yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
              Finish your scheduled assessment and it'll show up here with your score and a downloadable report.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0">
                <Award size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {completedResults.length > 1 ? "Your assessments are complete" : "Your assessment is complete"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Thanks for completing it, {student.name.split(" ")[0]} — your official report is ready below.
                </p>
              </div>
            </div>
            {completedResults.map((r) => {
              const violationCount = r.violationCount || 0;
              const terminated = violationCount >= MAX_VIOLATIONS;
              return (
                <div
                  key={r.resultId}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex items-center gap-4 flex-wrap sm:flex-nowrap"
                >
                  <ScoreRing score={r.score} total={r.total} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.domainName}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          terminated || r.reason === "left-tab"
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {STATUS_LABEL[r.reason] || "Submitted"}
                      </span>
                      {violationCount > 0 && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                            terminated
                              ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                              : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          <ShieldAlert size={11} /> {violationCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
                      <span className="tabular-nums">
                        Score: {r.score} / {r.total}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {r.timeTaken}
                      </span>
                      <span>{formatDate(r.submittedAt)}</span>
                    </p>
                  </div>

                  <button
                    disabled={downloadingId === r.resultId}
                    onClick={() => handleDownload(r)}
                    className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    {downloadingId === r.resultId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {downloadingId === r.resultId ? "Preparing…" : "Download PDF"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
