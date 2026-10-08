import { useState } from "react";
import { User, ShieldCheck } from "lucide-react";
import StudentLoginForm from "./StudentLoginForm";
import AdminLoginForm from "./AdminLoginForm";
import AuthSplitLayout from "../Shared/AuthSplitLayout";
import BrandMark from "../Shared/BrandMark";

export default function LoginPage({ onStudentLogin, onAdminLogin, onGoToRegister, prefillStudentId }) {
  const [tab, setTab] = useState("student"); // student | admin

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in to continue your assessment, or manage the portal as an admin."
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <BrandMark className="h-8 lg:hidden" />
          {tab === "student" && (
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-1 rounded-full bg-gray-200 dark:bg-gray-800" />
              <span className="w-5 h-1 rounded-full bg-brand-600 dark:bg-brand-500" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">Step 2 of 2</span>
            </div>
          )}
        </div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Sign in to the assessment portal</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose your role, then sign in with your credentials.</p>

        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTab("student")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "student"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <User size={14} /> Student
          </button>
          <button
            onClick={() => setTab("admin")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "admin"
                ? "border-brand-600 dark:border-brand-400 text-brand-700 dark:text-brand-400"
                : "border-transparent text-gray-500 dark:text-gray-400"
            }`}
          >
            <ShieldCheck size={14} /> Admin
          </button>
        </div>

        {tab === "student" ? (
          <StudentLoginForm onLogin={onStudentLogin} onGoToRegister={onGoToRegister} initialId={prefillStudentId} />
        ) : (
          <AdminLoginForm onLogin={onAdminLogin} />
        )}
      </div>
    </AuthSplitLayout>
  );
}
