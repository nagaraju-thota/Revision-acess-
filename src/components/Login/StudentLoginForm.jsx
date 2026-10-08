import { useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function StudentLoginForm({ onLogin, onGoToRegister, initialId = "" }) {
  const toast = useToast();
  const [id, setId] = useState(initialId);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!id || !pw) {
      setError("Enter your student/employee ID and password.");
      return;
    }
    setLoading(true);
    try {
      const { student } = await api.studentLogin(id, pw);
      onLogin(student);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Student / Employee ID</label>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="w-full h-9 px-3 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />

      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="w-full h-9 px-3 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {onGoToRegister && (
        <button
          type="button"
          onClick={onGoToRegister}
          className="w-full h-9 mt-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          New here? Create an account
        </button>
      )}
    </form>
  );
}
