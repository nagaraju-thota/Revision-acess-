import { useEffect, useRef, useState } from "react";
import { Clock, CheckCircle2, ShieldAlert, UserRound, Maximize, Minimize, Code2, Play, Loader2, TerminalSquare, Flag } from "lucide-react";
import { formatTime } from "../../utils/format";
import { watermarkStyle } from "../../utils/watermark";
import { useAntiCheat, MAX_VIOLATIONS, VIOLATION_TYPE_LABELS } from "../../hooks/useAntiCheat";
import ViolationWarningModal from "./ViolationWarningModal";
import SubmitConfirmModal from "./SubmitConfirmModal";
import ExamQuestionPalette from "./ExamQuestionPalette";
import ThemeToggle from "../Shared/ThemeToggle";
import CodeEditor from "../Shared/CodeEditor";
import { useTheme } from "../../context/ThemeContext";
import { useBrand } from "../../context/BrandContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../api/client";

// Same 4 languages the admin's CodingPanel.jsx offers when creating a
// question, and the same ids the backend's PISTON_LANGUAGES (exam.routes.js)
// knows how to execute. A coding question is authored with ONE of these as
// its "default" language + starter code, but the student can switch to any
// of the four during the exam -- Run always executes whichever is currently
// selected.
const CODING_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
];

// Shown when a student switches to a language the admin didn't author
// starter code for. Java/C++ need a minimal valid program shape to compile
// at all (Piston's Java runtime specifically needs a `public class Main` --
// see PISTON_LANGUAGES's comment in exam.routes.js) so an empty file isn't
// a fair starting point the way it is for JS/Python.
const CODE_BOILERPLATE = {
  javascript: "// your code here\n",
  python: "# your code here\n",
  java: "public class Main {\n  public static void main(String[] args) {\n    // your code here\n  }\n}\n",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n  // your code here\n  return 0;\n}\n",
};

// Whether a question currently has an answer recorded, per type -- mcq
// stores the picked option index (0 counts, so this can't just be a
// truthiness check), fill_blank stores the typed string, coding stores
// { language, code } (only counts once there's actual non-whitespace code).
function isAnswered(q, answers) {
  const a = answers[q.id];
  if (q.type === "coding") {
    return !!a && typeof a.code === "string" && a.code.trim() !== "";
  }
  if (q.type === "fill_blank") {
    return typeof a === "string" && a.trim() !== "";
  }
  return a !== undefined;
}

export default function ExamRunner({ exam, student, onSubmit }) {
  const toast = useToast();
  const { theme } = useTheme();
  const { companyName } = useBrand();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  // Per-question "Run" output for coding questions: { [questionId]: { loading, stdout, stderr, exitCode, error } }.
  // Keyed by question so switching questions and coming back doesn't lose
  // the last run's output.
  const [runResults, setRunResults] = useState({});
  // Which language is currently selected per coding question: { [questionId]: languageId }.
  // Defaults to the question's admin-set language until the student switches.
  const [codingLang, setCodingLang] = useState({});
  // Per-question-per-language code drafts, so switching languages and back
  // doesn't lose what was typed: { "<questionId>:<languageId>": code }.
  const [codeDrafts, setCodeDrafts] = useState({});
  const [timeLeft, setTimeLeft] = useState(exam.duration);
  const [submitting, setSubmitting] = useState(false);
  // Gates the manual "Submit exam" button behind a confirmation step — see
  // SubmitConfirmModal.jsx. Timeout and the 3rd-violation auto-submit below
  // both call finish() directly and never touch this.
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  // Purely a student-facing flag, independent of `answers` -- doesn't
  // affect scoring, submission, or anything sent to the backend beyond
  // what already gets sent (this never leaves the component). Lets a
  // student flag a question to double-check before submitting, whether
  // or not they've answered it yet.
  const [markedForReview, setMarkedForReview] = useState({});
  const toggleReview = (questionId) =>
    setMarkedForReview((m) => ({ ...m, [questionId]: !m[questionId] }));
  const startedAt = useState(() => Date.now())[0];
  const finishedRef = useRef(false); // guards against finish() firing twice

  // Tracks tab switches, window blur, minimize, and fullscreen exit; also
  // disables right-click and copy/paste for as long as this screen is
  // mounted. See hooks/useAntiCheat.js for the full detection/logging
  // design.
  const antiCheat = useAntiCheat({ enabled: !submitting });

  // Read-only mirror of document.fullscreenElement, purely for the header
  // badge below — useAntiCheat already reacts to fullscreen exits on its
  // own (that's a real violation check); this is just a second, passive
  // listener so the header can *show* the current state, and never
  // triggers or changes anything itself.
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const finish = (reason) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSubmitting(true);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    onSubmit(answers, reason, formatTime(elapsed), {
      count: antiCheat.violationCount,
      log: antiCheat.violationLog,
    });
  };

  useEffect(() => {
    if (submitting) return undefined;
    if (timeLeft <= 0) {
      finish("timeout");
      return undefined;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, submitting]);

  // Toast the instant any violation is recorded, so it's never silent even
  // if someone's looking away from the modal.
  const lastToastedViolationRef = useRef(0);
  useEffect(() => {
    const w = antiCheat.activeWarning;
    if (!w || w.violationNumber === lastToastedViolationRef.current) return;
    lastToastedViolationRef.current = w.violationNumber;
    const label = VIOLATION_TYPE_LABELS[w.type] || w.type;
    if (w.terminated) {
      toast.error(`Violation ${w.violationNumber}/${MAX_VIOLATIONS} (${label}) — exam terminated.`, 6000);
    } else {
      toast.error(`Violation ${w.violationNumber}/${MAX_VIOLATIONS} recorded: ${label}.`, 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antiCheat.activeWarning]);

  // 3rd violation: give the terminated modal a couple seconds on screen
  // before actually submitting and navigating away.
  useEffect(() => {
    if (submitting || antiCheat.violationCount < MAX_VIOLATIONS) return undefined;
    const t = setTimeout(() => finish("violations"), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [antiCheat.violationCount, submitting]);

  // The ONLY path out of the warning modal (button click or the countdown
  // expiring) — always re-requests fullscreen. There's no way to keep
  // taking the exam outside fullscreen.
  const handleReturn = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    antiCheat.dismissWarning();
  };

  // Currently selected language for a coding question — the admin's
  // original choice (question.language) until the student picks a
  // different one from the dropdown.
  const getSelectedLang = (question) => codingLang[question.id] || question.language || "javascript";

  // The code to show for a given question+language: whatever the student's
  // already typed in that language this session, else the admin's starter
  // code (only for the question's original language — switching to a
  // language the admin didn't author starter code for starts from a
  // generic boilerplate instead of another language's snippet).
  const getCodeFor = (question, lang) => {
    const draft = codeDrafts[`${question.id}:${lang}`];
    if (draft !== undefined) return draft;
    if (lang === question.language && question.starterCode) return question.starterCode;
    return CODE_BOILERPLATE[lang] || "";
  };

  const setCodeFor = (question, lang, code) => {
    setCodeDrafts((d) => ({ ...d, [`${question.id}:${lang}`]: code }));
    setAnswers((a) => ({ ...a, [question.id]: { language: lang, code } }));
  };

  // Switching languages clears any stale Run output (it was for the
  // previous language's code) and makes sure `answers` immediately reflects
  // the newly-selected language + its current draft, even before the
  // student types anything new.
  const switchLang = (question, lang) => {
    setCodingLang((s) => ({ ...s, [question.id]: lang }));
    setRunResults((r) => ({ ...r, [question.id]: undefined }));
    setAnswers((a) => ({ ...a, [question.id]: { language: lang, code: getCodeFor(question, lang) } }));
  };

  // Runs the current coding question's code (in whichever language is
  // currently selected) through the backend's Piston proxy and stores
  // stdout/stderr for display — never touches `answers` beyond what typing
  // already does (Run is purely for the student to check their work, same
  // as Programiz).
  const runCode = async (question) => {
    const lang = getSelectedLang(question);
    const code = getCodeFor(question, lang);
    if (!code.trim()) return;
    setRunResults((r) => ({ ...r, [question.id]: { loading: true } }));
    try {
      const result = await api.runCode(lang, code);
      setRunResults((r) => ({ ...r, [question.id]: { loading: false, ...result } }));
    } catch (err) {
      setRunResults((r) => ({ ...r, [question.id]: { loading: false, error: err.message } }));
    }
  };

  const q = exam.questions[current];
  const answeredCount = exam.questions.filter((qq) => isAnswered(qq, answers)).length;
  const low = timeLeft < 60;

  // Question-card width ramp: full-bleed on phones, growing through
  // tablet/laptop/desktop steps rather than one fixed max-width at every
  // size — matches how HackerRank/Mettl-style assessment UIs scale.
  const contentWidth = "w-full sm:max-w-2xl lg:max-w-[1100px] xl:max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 select-none">
      {/* Solid header bar — consistent with every other screen, and keeps
          this text off the watermark texture so it reads cleanly regardless
          of lighting/photo conditions. Title on the left; profile + status
          badges grouped on the right so nothing crowds together. */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className={`${contentWidth} py-4 lg:py-5 flex items-center justify-between flex-wrap gap-3`}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">{exam.title}</p>
            <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Question {current + 1} of {exam.questions.length}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {student && (
              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-gray-100">
                <UserRound size={13} className="text-gray-500 dark:text-gray-400 shrink-0" />
                <span className="truncate max-w-[140px]">{student.name}</span>
                <span className="text-gray-500 dark:text-gray-400 font-medium shrink-0">· {student.id}</span>
              </div>
            )}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-md border text-xs font-semibold ${
                isFullscreen
                  ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
                  : "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
              }`}
              title={isFullscreen ? "Fullscreen is active" : "Not in fullscreen"}
            >
              {isFullscreen ? <Maximize size={13} /> : <Minimize size={13} />}
              {isFullscreen ? "Fullscreen" : "Not fullscreen"}
            </div>
            {antiCheat.violationCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400 text-xs font-semibold">
                <ShieldAlert size={13} />
                {antiCheat.violationCount}/{MAX_VIOLATIONS} violations
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 px-3 h-8 rounded-md border text-sm font-semibold tabular-nums ${
                low
                  ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                  : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              }`}
            >
              <Clock size={14} />
              {formatTime(timeLeft)}
            </div>
            <ThemeToggle className="" />
          </div>
        </div>
      </div>

      {/* Watermarked content area — the exam card itself, below the solid header. */}
      <div style={watermarkStyle(theme === "dark", companyName)}>
        <div className={`${contentWidth} py-8 sm:py-10`}>
          {/* Main content first in the DOM (order-2 on desktop, so it's
              still first for screen readers) with the palette as a
              genuine right-hand sidebar at lg+ -- below that it stacks
              back into a single column with the palette on top, same as
              before. Reference: a HackerRank/Mettl-style palette sidebar. */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0 w-full order-2 lg:order-1">

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-8 mb-8">
            {/* Uniform across all three question types -- see markedForReview
                above. Purely a display/UX aid, not part of the answer. */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Question {current + 1}
              </span>
              <button
                type="button"
                onClick={() => toggleReview(q.id)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                  markedForReview[q.id]
                    ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Flag size={13} className={markedForReview[q.id] ? "fill-violet-600 dark:fill-violet-400" : ""} />
                {markedForReview[q.id] ? "Marked for review" : "Mark for review"}
              </button>
            </div>
            {q.type === "coding" ? (
              <>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Code2 size={16} className="text-gray-400 shrink-0" />
                  <p className="text-2xl font-semibold leading-normal text-gray-900 dark:text-gray-100">{q.text}</p>
                  {isAnswered(q, answers) && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-500 bg-green-50 dark:bg-green-950/40 px-2 py-1 rounded-md">
                      <CheckCircle2 size={13} /> Answered
                    </span>
                  )}
                  <select
                    value={getSelectedLang(q)}
                    onChange={(e) => switchLang(q, e.target.value)}
                    className="ml-auto h-8 px-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400"
                  >
                    {CODING_LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                </div>
                {q.problemStatement && (
                  <p className="text-base text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{q.problemStatement}</p>
                )}
                {q.sampleOutput && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span className="font-medium">Example:</span> {q.sampleOutput}
                  </p>
                )}
                <CodeEditor
                  value={getCodeFor(q, getSelectedLang(q))}
                  onChange={(value) => setCodeFor(q, getSelectedLang(q), value)}
                  language={getSelectedLang(q)}
                />

                <button
                  type="button"
                  onClick={() => runCode(q)}
                  disabled={runResults[q.id]?.loading || !getCodeFor(q, getSelectedLang(q)).trim()}
                  className="mt-3 h-9 px-4 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-white disabled:opacity-40 flex items-center gap-1.5"
                >
                  {runResults[q.id]?.loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  {runResults[q.id]?.loading ? "Running…" : "Run"}
                </button>

                {runResults[q.id] && !runResults[q.id].loading && (
                  <div className="mt-3 rounded-md border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
                      <TerminalSquare size={12} /> Output
                    </div>
                    <pre className="p-3 bg-gray-950 dark:bg-black text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {runResults[q.id].error ? (
                        <span className="text-red-400">{runResults[q.id].error}</span>
                      ) : (
                        <>
                          {runResults[q.id].stdout && <span className="text-gray-100">{runResults[q.id].stdout}</span>}
                          {runResults[q.id].stderr && <span className="text-red-400">{runResults[q.id].stdout ? "\n" : ""}{runResults[q.id].stderr}</span>}
                          {!runResults[q.id].stdout && !runResults[q.id].stderr && (
                            <span className="text-gray-500">(no output)</span>
                          )}
                        </>
                      )}
                    </pre>
                  </div>
                )}
              </>
            ) : q.type === "fill_blank" ? (
              <>
                <p className="text-2xl font-semibold leading-normal text-gray-900 dark:text-gray-100 mb-6">{q.text}</p>
                <div className="relative">
                  <input
                    type="text"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Type your answer for the blank"
                    className={`w-full px-5 py-4 min-h-[56px] rounded-xl border text-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 ${
                      isAnswered(q, answers)
                        ? "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-950/40 pr-11"
                        : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    }`}
                  />
                  {isAnswered(q, answers) && (
                    <CheckCircle2 size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 dark:text-green-500" />
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold leading-normal text-gray-900 dark:text-gray-100 mb-6">{q.text}</p>
                <div className="space-y-3 sm:space-y-4">
                  {(q.options || []).map((opt, i) => {
                    const selected = answers[q.id] === i;
                    const letter = String.fromCharCode(65 + i); // A, B, C, D...
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                        className={`w-full flex items-center gap-4 text-left px-5 py-4 min-h-[60px] rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                          selected
                            ? "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-950/40 shadow-sm"
                            : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                            selected ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {letter}
                        </span>
                        <span className={`text-base sm:text-lg flex-1 ${selected ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-800 dark:text-gray-200"}`}>
                          {opt}
                        </span>
                        {selected && <CheckCircle2 size={20} className="text-green-600 dark:text-green-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="h-11 min-w-[120px] justify-center px-6 rounded-lg border border-gray-300 dark:border-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
            >
              Previous
            </button>
            {current < exam.questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => c + 1)}
                className="h-11 min-w-[120px] justify-center px-6 rounded-lg bg-brand-600 dark:bg-brand-500 text-white text-base font-medium transition-colors hover:bg-brand-700 dark:hover:bg-brand-400 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="h-11 min-w-[140px] justify-center px-6 rounded-lg bg-brand-600 dark:bg-brand-500 text-white text-base font-medium transition-colors hover:bg-brand-700 dark:hover:bg-brand-400 flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950"
              >
                Submit exam
              </button>
            )}
          </div>

            </div>

            <div className="w-full lg:w-72 xl:w-80 shrink-0 order-1 lg:order-2 lg:sticky lg:top-6">
              <ExamQuestionPalette
                examTitle={exam.title}
                questions={exam.questions}
                current={current}
                answers={answers}
                markedForReview={markedForReview}
                isAnswered={isAnswered}
                onSelect={setCurrent}
              />
            </div>
          </div>
        </div>
      </div>

      {showSubmitConfirm && (
        <SubmitConfirmModal
          answeredCount={answeredCount}
          total={exam.questions.length}
          onCancel={() => setShowSubmitConfirm(false)}
          onConfirm={() => {
            setShowSubmitConfirm(false);
            finish("manual");
          }}
        />
      )}

      {antiCheat.activeWarning && (
        <ViolationWarningModal warning={antiCheat.activeWarning} onReturn={handleReturn} />
      )}
    </div>
  );
}
