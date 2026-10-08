import { useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

export default function RegisterForm({ onRegistered, onGoToLogin }) {
  const toast = useToast();
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!id || !email || !name || !password) {
      setError("Fill in every field to register.");
      return;
    }
    setLoading(true);
    try {
      const { student } = await api.registerStudent({ id, email, name, password });
      toast.success("Account created — sign in to continue");
      onRegistered(student.id);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employee / Student ID</label>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="EMP1005"
        className="w-full h-9 px-3 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />

      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="w-full h-9 px-3 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />

      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        className="w-full h-9 px-3 mb-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />

      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 6 characters"
        className="w-full h-9 px-3 mb-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
      />

      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        One registration per Employee ID, and one login for your exam attempt — double check your details before submitting.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-9 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <button
        type="button"
        onClick={onGoToLogin}
        className="w-full h-9 mt-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Already registered? Sign in
      </button>
    </form>
  );
}
