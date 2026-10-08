import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

const PASTE_PLACEHOLDER = `Q: What is the capital of France?
A) Berlin
B) Madrid
C) Paris *
D) Rome

Q: Which HTTP method is idempotent?
A) POST
B) PUT *
C) PATCH
D) CONNECT`;

// Unchanged from the original AddQuestionsTab — same api.previewQuestions /
// api.publishQuestions calls against the real backend. Only lifted out so
// AddQuestionsTab can switch between question types; the domain picker now
// lives one level up since it's shared across all three types.
export default function McqPanel({ domainId, domainName }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  // Debounced live preview, parsed server-side so the rules always match
  // what actually gets published.
  useEffect(() => {
    setPublishError("");
    if (!text.trim() || !domainId) {
      setQuestions([]);
      setErrors([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .previewQuestions(domainId, text)
        .then((data) => {
          setQuestions(data.questions);
          setErrors(data.errors);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [text, domainId]);

  const publish = async () => {
    setPublishing(true);
    setPublishError("");
    try {
      const count = questions.length;
      await api.publishQuestions(domainId, text);
      toast.success(`Published ${count} question${count === 1 ? "" : "s"} to ${domainName}`);
      setText("");
    } catch (err) {
      setPublishError(err.message);
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Paste your questions below. Mark the correct option with a trailing{" "}
        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">*</code>. Leave a blank line between
        questions.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PASTE_PLACEHOLDER}
            rows={16}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
          />
          <button
            disabled={!text.trim() || questions.length === 0 || publishing}
            onClick={publish}
            className="mt-3 h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
          >
            {publishing
              ? "Publishing…"
              : `Publish ${questions.length > 0 ? `${questions.length} question${questions.length > 1 ? "s" : ""}` : "questions"}`}
          </button>
          {publishError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{publishError}</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
          {text.trim() === "" && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Parsed questions will appear here as you type.</p>
          )}
          {errors.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5 mb-1 last:mb-0">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {questions.map((q, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                  {i + 1}. {q.text}
                </p>
                <div className="space-y-1">
                  {q.options.map((opt, oi) => (
                    <p
                      key={oi}
                      className={`text-xs px-2 py-1 rounded ${
                        oi === q.correctIndex
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {opt} {oi === q.correctIndex && <Check size={11} className="inline" />}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
