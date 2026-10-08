// Which of the 4 states a palette cell is in. "current" takes visual
// priority (matches the reference design: the question you're on renders
// as a plain white/blue-bordered box regardless of its answered state,
// since you can already see whether it's answered from the question card
// itself -- the palette's job at that point is just "you are here").
function cellState(qq, index, current, answers, markedForReview, isAnswered) {
  if (index === current) return "current";
  const answered = isAnswered(qq, answers);
  const marked = !!markedForReview[qq.id];
  if (answered && marked) return "answered-marked";
  if (marked) return "marked";
  if (answered) return "answered";
  return "not-attempted";
}

const CELL_CLASSES = {
  current: "bg-white dark:bg-gray-900 border-2 border-brand-600 dark:border-brand-400 text-gray-900 dark:text-gray-100",
  answered: "bg-green-500 dark:bg-green-600 text-white",
  "not-attempted": "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  marked: "bg-amber-500 dark:bg-amber-600 text-white",
  "answered-marked": "bg-purple-500 dark:bg-purple-600 text-white",
};

const LEGEND = [
  { state: "answered", label: "Attempted", dot: "bg-green-500 dark:bg-green-600" },
  { state: "not-attempted", label: "Not Attempted", dot: "bg-gray-300 dark:bg-gray-700" },
  { state: "marked", label: "Marked for Review", dot: "bg-amber-500 dark:bg-amber-600" },
  { state: "answered-marked", label: "Answered & Marked", dot: "bg-purple-500 dark:bg-purple-600" },
];

// The right-hand sidebar panel: question palette (grid of numbered cells,
// 4 color states) plus a section-progress summary underneath. Renders as
// a normal block stacked above the question card on narrower screens (see
// ExamRunner.jsx's flex-col lg:flex-row + order utilities) and as a true
// sticky sidebar on desktop -- matching the reference layout the request
// was built from.
export default function ExamQuestionPalette({
  examTitle,
  questions,
  current,
  answers,
  markedForReview,
  isAnswered,
  onSelect,
}) {
  const total = questions.length;
  const answeredCount = questions.filter((qq) => isAnswered(qq, answers)).length;
  const markedNotAnsweredCount = questions.filter(
    (qq) => markedForReview[qq.id] && !isAnswered(qq, answers)
  ).length;
  const answeredPct = (answeredCount / total) * 100;
  const markedPct = (markedNotAnsweredCount / total) * 100;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Question Palette</p>

      <div className="flex flex-col gap-1.5 mb-4">
        {LEGEND.map((l) => (
          <span key={l.state} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${l.dot}`} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2 mb-5">
        {questions.map((qq, i) => {
          const state = cellState(qq, i, current, answers, markedForReview, isAnswered);
          return (
            <button
              key={qq.id}
              onClick={() => onSelect(i)}
              className={`h-9 w-9 rounded-md flex items-center justify-center text-xs font-bold transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${CELL_CLASSES[state]}`}
              aria-label={`Go to question ${i + 1} (${state.replace("-", " ")})`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
        Section progress
      </p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 truncate">{examTitle}</p>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
        <div className="h-full bg-green-500 dark:bg-green-600" style={{ width: `${answeredPct}%` }} />
        <div className="h-full bg-amber-500 dark:bg-amber-600" style={{ width: `${markedPct}%` }} />
      </div>
      <p className="text-xs font-semibold text-green-600 dark:text-green-500 mt-2">
        {answeredCount}/{total} Answered
      </p>
    </div>
  );
}
