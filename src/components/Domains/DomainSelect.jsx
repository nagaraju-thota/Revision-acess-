import { useEffect, useState } from "react";
import { ChevronRight, LogOut, Code2, Layers, Server, Database, Loader2 } from "lucide-react";
import { api } from "../../api/client";
import { SkeletonCardGrid } from "../Shared/Skeleton";
import ThemeToggle from "../Shared/ThemeToggle";
import BrandMark from "../Shared/BrandMark";
import Footer from "../Shared/Footer";
import { useToast } from "../../context/ToastContext";

const ICONS = {
  "python-fullstack": Code2,
  frontend: Layers,
  backend: Server,
  database: Database,
};

export default function DomainSelect({ student, onLogout, onSelect, selecting }) {
  const toast = useToast();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    api
      .getDomains()
      .then((data) => setDomains(data.domains))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (d) => {
    setPendingId(d.id);
    onSelect(d);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
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

      <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Welcome, {student.name}</p>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-1">Choose your assessment</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Pick the domain your manager assigned to you.</p>

        {loading ? (
          <SkeletonCardGrid count={4} />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {domains.map((d) => {
              const Icon = ICONS[d.id] || Layers;
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
        )}
      </div>
      <Footer />
    </div>
  );
}
