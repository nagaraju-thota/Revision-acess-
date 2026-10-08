import { useEffect, useState } from "react";
import { AlertCircle, Check, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { parseFillBlankText } from "../../utils/parseFillBlank";

const PLACEHOLDER = `Q: The capital of France is ___.
A: Paris

Q: HTML stands for HyperText ___ Language.
A: Markup`;

// Now wired to the real backend (/admin/domains/:id/questions/fill-blank),
// same pattern as McqPanel: parse locally for the instant preview as you
// type, publish/list/delete all go through api/client.js.
export default function FillBlankPanel({ domainId, domainName }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [questions, setQuestions] = useState([]);
  const [errors, setErrors] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [existing, setExisting] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setQuestions([]);
      setErrors([]);
      return;
    }
    const t = setTimeout(() => {
      const result = parseFillBlankText(text);
      setQuestions(result.questions);
      setErrors(result.errors);
    }, 200);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (!domainId) return;
    setLoadingExisting(true);
    api
      .getFillBlankQuestions(domainId)
      .then(setExisting)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId]);

  const publish = async () => {
    setPublishing(true);
    try {
      const result = await api.publishFillBlankQuestions(domainId, text);
      toast.success(`Published ${result.published} fill-in-the-blank question${result.published === 1 ? "" : "s"} to ${domainName}`);
      setExisting(result.questions);
      setText("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const remove = async (id) => {
    try {
      const result = await api.deleteFillBlankQuestion(domainId, id);
      setExisting(result.questions);
      toast.success("Question deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Paste questions below. Mark the blank with{" "}
        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">___</code>, then give the accepted
        answer on an <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">A:</code> line
        (separate multiple accepted answers with{" "}
        <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">|</code>).
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={14}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
          />
          <button
            disabled={!text.trim() || questions.length === 0 || publishing}
            onClick={publish}
            className="mt-3 h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
          >
            {publishing ? "Publishing…" : `Publish ${questions.length > 0 ? `${questions.length} question${questions.length > 1 ? "s" : ""}` : "questions"}`}
          </button>

          {!loadingExisting && existing.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Already added to {domainName} ({existing.length})
              </p>
              <div className="space-y-2">
                {existing.map((q, i) => (
                  <div key={q.id} className="flex items-start justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {i + 1}. {q.text} <span className="text-gray-400 dark:text-gray-500">({q.answers.join(", ")})</span>
                    </p>
                    <button
                      onClick={() => remove(q.id)}
                      className="shrink-0 w-7 h-7 rounded-md border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                      aria-label="Delete question"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
          {text.trim() === "" && <p className="text-sm text-gray-400 dark:text-gray-500">Parsed questions will appear here as you type.</p>}
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
                <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">{i + 1}. {q.text}</p>
                <p className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium inline-flex items-center gap-1 w-fit">
                  <Check size={11} /> {q.answers.join(" / ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
