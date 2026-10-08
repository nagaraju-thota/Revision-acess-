import { useCallback, useEffect, useState } from "react";
import { LogOut, BarChart3, ClipboardList, Timer, FolderPlus, PieChart, CalendarClock } from "lucide-react";
import { api } from "../../api/client";
import ResultsTab from "./ResultsTab";
import AddQuestionsTab from "./AddQuestionsTab";
import ExamTimerTab from "./ExamTimerTab";
import AddDomainTab from "./AddDomainTab";
import QuestionInsightsTab from "./QuestionInsightsTab";
import ExamScheduleTab from "./ExamScheduleTab";
import ThemeToggle from "../Shared/ThemeToggle";
import BrandMark from "../Shared/BrandMark";
import Footer from "../Shared/Footer";

export default function AdminDashboard({ admin, onLogout }) {
  const [tab, setTab] = useState("results"); // results | add | timer | domain | insights | schedule
  const [domains, setDomains] = useState([]);

  const loadDomains = useCallback(() => {
    return api.getDomains().then((data) => setDomains(data.domains)).catch(() => {});
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-6" />
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Admin ({admin.name})</p>
          </div>
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

      <div className="max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Overview</p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-6">All domains &amp; submissions</h1>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTab("results")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "results"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <BarChart3 size={14} /> Results
          </button>
          <button
            onClick={() => setTab("add")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "add"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <ClipboardList size={14} /> Add questions
          </button>
          <button
            onClick={() => setTab("timer")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "timer"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <Timer size={14} /> Exam timer
          </button>
          <button
            onClick={() => setTab("domain")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "domain"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <FolderPlus size={14} /> Domains
          </button>
          <button
            onClick={() => setTab("insights")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "insights"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <PieChart size={14} /> Insights
          </button>
          <button
            onClick={() => setTab("schedule")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "schedule"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <CalendarClock size={14} /> Schedule
          </button>
        </div>

        {tab === "add" ? (
          domains.length > 0 ? (
            <AddQuestionsTab domains={domains} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading domains…</p>
          )
        ) : tab === "timer" ? (
          domains.length > 0 ? (
            <ExamTimerTab domains={domains} onUpdated={loadDomains} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading domains…</p>
          )
        ) : tab === "domain" ? (
          <AddDomainTab domains={domains} onAdded={loadDomains} />
        ) : tab === "insights" ? (
          domains.length > 0 ? (
            <QuestionInsightsTab domains={domains} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading domains…</p>
          )
        ) : tab === "schedule" ? (
          <ExamScheduleTab />
        ) : (
          <ResultsTab />
        )}
      </div>
      <Footer />
    </div>
  );
}
