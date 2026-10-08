import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES = {
  success: "border-green-200 dark:border-green-900 text-green-700 dark:text-green-400",
  error: "border-red-200 dark:border-red-900 text-red-700 dark:text-red-400",
  info: "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
};

// Wraps the whole app once (see App.jsx). Call useToast() anywhere to fire a
// toast — no prop drilling needed. Toasts auto-dismiss after `duration`ms
// and stack bottom-right so they never collide with the top-right theme
// toggle or a screen's own header controls.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "info", duration = 3500) => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, message, type }]);
      if (duration > 0) setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  const toast = {
    show: push,
    success: (message, duration) => push(message, "success", duration),
    error: (message, duration) => push(message, "error", duration),
    info: (message, duration) => push(message, "info", duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-xs pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div
              key={t.id}
              className={`animate-toast-in pointer-events-auto flex items-start gap-2 bg-white dark:bg-gray-900 border rounded-lg shadow-lg px-3 py-2.5 text-sm ${STYLES[t.type] || STYLES.info}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-gray-800 dark:text-gray-200">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
