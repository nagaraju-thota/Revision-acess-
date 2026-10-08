// A correct/wrong/unanswered breakdown as a pie chart. Built with a plain
// CSS conic-gradient rather than a charting library — this app has no
// chart dependency installed, and a 3-slice pie doesn't need one. The
// "correct" slice reads the same --color-brand-600 CSS variable every
// button/badge in the app reads from, so it stays on-brand automatically
// if the logo (and therefore the palette) ever changes — same trick as
// components/Dashboard/ScoreRing.jsx's SVG gradient.
function LegendRow({ colorClass, label, count, pct }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorClass}`} />
      <span className="text-gray-700 dark:text-gray-300 w-24">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums">{count}</span>
      <span className="text-gray-400 dark:text-gray-500 tabular-nums">({pct.toFixed(0)}%)</span>
    </div>
  );
}

export default function QuestionPieChart({ correct, wrong, unanswered = 0, size = 168 }) {
  const total = correct + wrong + unanswered;
  if (total === 0) return null;

  const correctPct = (correct / total) * 100;
  const wrongPct = (wrong / total) * 100;
  const unansweredPct = (unanswered / total) * 100;
  const correctEnd = correctPct;
  const wrongEnd = correctPct + wrongPct;

  const gradient = `conic-gradient(rgb(var(--color-brand-600)) 0% ${correctEnd}%, #ef4444 ${correctEnd}% ${wrongEnd}%, #9ca3af ${wrongEnd}% 100%)`;

  return (
    <div className="flex items-center gap-8 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="rounded-full" style={{ width: size, height: size, background: gradient }} />
        <div className="absolute inset-[20%] rounded-full bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {Math.round(correctPct)}%
          </span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Correct</span>
        </div>
      </div>
      <div className="space-y-2">
        <LegendRow colorClass="bg-brand-600" label="Correct" count={correct} pct={correctPct} />
        <LegendRow colorClass="bg-red-500" label="Wrong" count={wrong} pct={wrongPct} />
        {unanswered > 0 && <LegendRow colorClass="bg-gray-400 dark:bg-gray-600" label="Unanswered" count={unanswered} pct={unansweredPct} />}
      </div>
    </div>
  );
}
