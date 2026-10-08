import { useEffect, useState } from "react";
import { PieChart, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import QuestionPieChart from "./QuestionPieChart";

// Lets an admin pick any question from any domain and see, across every
// student who's attempted it so far, how many got it right, how many got
// it wrong, and how many skipped it — aggregated server-side (see
// db.getQuestionStats) rather than something computed by walking every
// individual result client-side.
export default function QuestionInsightsTab({ domains }) {
  const toast = useToast();
  const [domainId, setDomainId] = useState(domains[0]?.id || "");
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionId, setQuestionId] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!domainId) return;
    setQuestionsLoading(true);
    setQuestionId("");
    setStats(null);
    api
      .getDomainQuestions(domainId)
      .then((data) => setQuestions(data.questions || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setQuestionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId]);

  useEffect(() => {
    if (!domainId || !questionId) {
      setStats(null);
      return;
    }
    setStatsLoading(true);
    api
      .getQuestionStats(domainId, questionId)
      .then((data) => setStats(data.stats))
      .catch((err) => toast.error(err.message))
      .finally(() => setStatsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId, questionId]);

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Pick a domain and a question to see how everyone who's attempted it so far did — correct, wrong, or skipped.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="w-full h-9 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
          >
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Question</label>
          <select
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value)}
            disabled={questionsLoading || questions.length === 0}
            className="w-full h-9 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 disabled:opacity-50"
          >
            <option value="">
              {questionsLoading ? "Loading…" : questions.length === 0 ? "No questions in this domain" : "Select a question"}
            </option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.id}. {q.text.length > 60 ? `${q.text.slice(0, 60)}…` : q.text}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-10 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading stats…
        </div>
      ) : stats ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{stats.text}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
            {stats.totalAttempts} {stats.totalAttempts === 1 ? "attempt" : "attempts"} so far
          </p>

          {stats.type === "coding" ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Correct/wrong breakdowns aren't tracked for coding questions — they aren't auto-graded.
            </p>
          ) : stats.totalAttempts === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No one has attempted this question yet.</p>
          ) : (
            <QuestionPieChart correct={stats.correct} wrong={stats.wrong} unanswered={stats.unanswered} />
          )}

          {(stats.options || []).length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
              {stats.options.map((opt, i) => (
                <p
                  key={i}
                  className={`text-sm flex items-center gap-1.5 ${
                    i === stats.correctIndex ? "text-brand-700 dark:text-brand-400 font-medium" : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {i === stats.correctIndex && <CheckCircle2 size={13} className="shrink-0" />}
                  {opt}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center">
          <PieChart size={22} className="text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Select a question above to see its results breakdown.</p>
        </div>
      )}
    </div>
  );
}
