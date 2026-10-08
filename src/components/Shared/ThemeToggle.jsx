import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

// Small icon button that flips light/dark mode. Embed it inline inside a
// screen's existing header row via `className=""`, or drop it in with the
// default `fixed top-4 right-4` positioning on screens that have no header
// bar of their own (Login, Register, ExamIntro, ExamSubmitted).
export default function ThemeToggle({ className = "fixed top-4 right-4 z-40" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`h-9 w-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-600 transition-colors ${className}`}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
