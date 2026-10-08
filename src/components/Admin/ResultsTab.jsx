import { useEffect, useState } from "react";
import { ChevronRight, Download, ShieldAlert } from "lucide-react";
import { api } from "../../api/client";
import AnswerModal from "./AnswerModal";
import { downloadResultPdf } from "../../utils/pdfReport";
import { SkeletonTable } from "../Shared/Skeleton";
import { MAX_VIOLATIONS } from "../../hooks/useAntiCheat";
import { useToast } from "../../context/ToastContext";

const STATUS_LABEL = { violations: "Terminated", "left-tab": "Left tab" };

export default function ResultsTab() {
  const toast = useToast();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [domainFilter, setDomainFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    api
      .getAllResults()
      .then((data) => setResults(data.results))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadPdf = async (resultId) => {
    setDownloadingId(resultId);
    try {
      const { result } = await api.getResultDetail(resultId);
      downloadResultPdf(result);
    } catch (err) {
      toast.error(err.message || "Couldn't generate the PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const domainNames = ["all", ...new Set(results.map((r) => r.domainName))];
  const visible = domainFilter === "all" ? results : results.filter((r) => r.domainName === domainFilter);
  const submittedCount = visible.length;
  const avgScore = (visible.reduce((a, r) => a + r.score, 0) / (submittedCount || 1)).toFixed(1);
  const avgTotal = visible[0]?.total ?? "—";

  if (loading) return <SkeletonTable rows={4} cols={6} />;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 gap-3 flex-1 mr-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Submissions</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-100">{submittedCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Average score</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-gray-900 dark:text-gray-100">
              {avgScore} / {avgTotal}
            </p>
          </div>
        </div>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="h-9 px-3 border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900"
        >
          {domainNames.map((d) => (
            <option key={d} value={d}>
              {d === "all" ? "All domains" : d}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium">Employee ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Domain</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Time taken</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Violations</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                  No submissions yet.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const violationCount = r.violationCount || 0;
              const terminated = violationCount >= MAX_VIOLATIONS;
              return (
                <tr key={r.resultId} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.studentId}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.domainName}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                    {r.score} / {r.total}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.timeTaken}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        terminated || r.reason === "left-tab"
                          ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {STATUS_LABEL[r.reason] || "Submitted"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {violationCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          terminated
                            ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                            : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <ShieldAlert size={11} /> {violationCount}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        disabled={downloadingId === r.resultId}
                        onClick={() => downloadPdf(r.resultId)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-0.5 disabled:opacity-40"
                      >
                        <Download size={12} /> {downloadingId === r.resultId ? "…" : "PDF"}
                      </button>
                      <button
                        onClick={() => setSelectedId(r.resultId)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-0.5"
                      >
                        View <ChevronRight size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {selectedId && <AnswerModal resultId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
