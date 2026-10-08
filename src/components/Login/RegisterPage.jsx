import RegisterForm from "./RegisterForm";
import AuthSplitLayout from "../Shared/AuthSplitLayout";
import BrandMark from "../Shared/BrandMark";

// First screen the app shows. Students register once here before they can
// ever reach the login page (see App.jsx — initial stage is "register").
// The two-dot tracker below is a real sequence — register, then sign in —
// so it earns a step indicator rather than decorating one on.
export default function RegisterPage({ onRegistered, onGoToLogin }) {
  return (
    <AuthSplitLayout
      title="Set up your exam access"
      subtitle="Register once with your Employee ID, then sign in whenever you're ready to begin."
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-brand-600 to-brand-300 dark:from-brand-400 dark:to-brand-600" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-2 mb-6">
            <BrandMark className="h-7 lg:hidden" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-1 rounded-full bg-brand-600 dark:bg-brand-500" />
              <span className="w-5 h-1 rounded-full bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">Step 1 of 2</span>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Set up your exam access</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Register once with your Employee ID — then sign in whenever you're ready to begin.
          </p>

          <RegisterForm onRegistered={onRegistered} onGoToLogin={onGoToLogin} />
        </div>
      </div>
    </AuthSplitLayout>
  );
}
