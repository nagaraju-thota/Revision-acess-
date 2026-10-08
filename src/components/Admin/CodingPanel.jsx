import { useEffect, useState } from "react";
import { Check, Trash2, Code2 } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../context/ToastContext";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

// Now wired to the real backend (/admin/domains/:id/questions/coding), same
// one-at-a-time add flow as before.
export default function CodingPanel({ domainId, domainName }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [prompt, setPrompt] = useState("");
  const [starterCode, setStarterCode] = useState("");
  const [sampleOutput, setSampleOutput] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (!domainId) return;
    setLoadingExisting(true);
    api
      .getCodingQuestions(domainId)
      .then(setExisting)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainId]);

  const reset = () => {
    setTitle("");
    setPrompt("");
    setStarterCode("");
    setSampleOutput("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.addCodingQuestion(domainId, { title, language, prompt, starterCode, sampleOutput });
      toast.success(`Added coding question to ${domainName}`);
      setExisting(result.questions);
      reset();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const result = await api.deleteCodingQuestion(domainId, id);
      setExisting(result.questions);
      toast.success("Question deleted.");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const inputClass =
    "w-full px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400";
  const codeClass =
    "w-full p-3 border border-gray-300 dark:border-gray-700 bg-gray-950 dark:bg-black text-gray-100 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-500";

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Add one coding question at a time — title, language, problem statement, and optional starter code / sample
        output.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reverse a string" className={`h-9 ${inputClass}`} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`h-9 ${inputClass}`}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Problem statement</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Write a function that reverses a string without using a built-in reverse method."
              className={`p-3 ${inputClass}`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Starter code (optional)</label>
            <textarea
              value={starterCode}
              onChange={(e) => setStarterCode(e.target.value)}
              rows={5}
              placeholder={"function reverseString(str) {\n  // your code here\n}"}
              className={codeClass}
              spellCheck={false}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sample output (optional)</label>
            <input
              value={sampleOutput}
              onChange={(e) => setSampleOutput(e.target.value)}
              placeholder={'reverseString("hello") → "olleh"'}
              className={`h-9 ${inputClass}`}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !title.trim() || !prompt.trim()}
            className="h-9 px-4 rounded-md bg-brand-600 dark:bg-brand-500 text-white text-sm font-medium hover:bg-brand-700 dark:hover:bg-brand-400 disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add coding question"}
          </button>
        </form>

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Added to {domainName} ({existing.length})
          </p>
          {!loadingExisting && existing.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">No coding questions yet.</p>}
          <div className="space-y-3 max-h-[520px] overflow-y-auto">
            {existing.map((q, i) => (
              <div key={q.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Code2 size={13} className="text-gray-400 shrink-0" /> {i + 1}. {q.title}
                  </p>
                  <button
                    onClick={() => remove(q.id)}
                    className="shrink-0 w-7 h-7 rounded-md border border-gray-200 dark:border-gray-800 text-gray-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                    aria-label="Delete question"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{q.prompt}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                  {LANGUAGES.find((l) => l.id === q.language)?.label || q.language}
                </span>
                {q.starterCode && (
                  <pre className="mt-2 p-2 bg-gray-950 dark:bg-black text-gray-100 rounded text-xs overflow-x-auto">{q.starterCode}</pre>
                )}
                {q.sampleOutput && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Check size={11} /> {q.sampleOutput}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
