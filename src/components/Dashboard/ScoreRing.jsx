// A small circular percentage ring — used on the dashboard's Completed tab
// so a score reads at a glance instead of just as "3 / 5" text. Pure SVG,
// no charting library needed. The gradient stops read the same
// --color-brand-400 / --color-brand-600 CSS variables every Tailwind
// `brand-*` class in the app reads from (see context/BrandContext.jsx), so
// this ring re-colors itself along with everything else when the logo
// changes, instead of staying stuck on a hardcoded blue.
export default function ScoreRing({ score, total, size = 64, strokeWidth = 6 }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  // Unique-enough per instance so multiple rings on one page don't share a
  // gradient id (SVG <defs> ids are global to the document).
  const gradientId = `score-ring-${score}-${total}-${size}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--color-brand-400))" />
            <stop offset="100%" stopColor="rgb(var(--color-brand-600))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct}%</span>
      </div>
    </div>
  );
}
