// A CSS background-image is, by definition, painted behind an element's own
// children — there's no z-index or stacking-context ambiguity to get wrong.
// That's why this builds the watermark as an actual background layer
// (applied via inline style on the exam page's root div) instead of a
// separately positioned overlay element, which is what caused it to render
// invisibly behind the page's own background color before.
const TILE_WIDTH = 280;
const TILE_HEIGHT = 150;

// Common legal suffixes stripped before splitting a company name into
// watermark lines, so "Acme Corp" reads as "ACME" rather than "ACME CORP"
// wrapping awkwardly, and the original default ("Koundinyasa Technology
// Services Pvt. Ltd.") still comes out exactly as it always has:
// "KOUNDINYASA" / "TECHNOLOGY SERVICES".
const LEGAL_SUFFIXES = /\b(pvt\.?|private|ltd\.?|limited|inc\.?|llc|co\.?|corp\.?|corporation)\b\.?/gi;

// Turns whatever company name is currently branded (see BrandContext) into
// one or two watermark lines: the first word stands alone (it's usually the
// actual brand name), everything else after it becomes the second line. A
// single-word name just gets one line.
export function watermarkLinesFromName(name) {
  const cleaned = (name || "").replace(LEGAL_SUFFIXES, "").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= 1) return [(cleaned || "PORTAL").toUpperCase()];
  return [words[0].toUpperCase(), words.slice(1).join(" ").toUpperCase()];
}

function buildSvg(lines, color, opacity) {
  const centerY = TILE_HEIGHT / 2;
  // Stack lines symmetrically around the tile's vertical center, however
  // many there are (1 or 2 in practice).
  const lineHeight = 18;
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  const textEls = lines
    .map(
      (line, i) => `
        <text x="${TILE_WIDTH / 2}" y="${startY + i * lineHeight + 4}" text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="600"
          letter-spacing="1.5" fill="${color}" fill-opacity="${opacity}">${line}</text>`
    )
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${TILE_WIDTH}" height="${TILE_HEIGHT}">
      <g transform="rotate(-24 ${TILE_WIDTH / 2} ${TILE_HEIGHT / 2})">${textEls}</g>
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Reads the live --color-brand-* CSS variable (set by BrandContext, either
// still the default palette or a re-derived one from an uploaded logo) so
// the watermark ink is always "on brand" instead of a fixed neutral gray.
// Falls back to a sane dark neutral if read outside a browser (shouldn't
// happen in this SPA, but keeps this function safe to call from anywhere).
function readBrandRgb(step) {
  if (typeof document === "undefined") return "15 23 42";
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--color-brand-${step}`).trim();
  return value || "15 23 42";
}

// dark = the boolean from useTheme() (`theme === "dark"`). companyName
// comes from useBrand() — pass it through so a rebranded portal gets a
// watermark that matches both its logo's color and its actual name, not
// just a repaint of "KOUNDINYASA TECHNOLOGY SERVICES" in a new color.
// Darker ink reads on the light page background; lighter ink reads on the
// dark one — same reasoning as before, just sourced from the brand ramp's
// 900 (light mode) / 100 (dark mode) shades instead of fixed slate hexes.
// Opacity sits at 0.09/0.11 — visible enough to read as an intentional
// deterrent under a phone camera, still soft enough to never compete with
// the actual question/option text sitting on top of it.
export function watermarkStyle(dark, companyName) {
  const lines = watermarkLinesFromName(companyName);
  const rgb = dark ? readBrandRgb(100) : readBrandRgb(900);
  const color = `rgb(${rgb.trim().split(/\s+/).join(",")})`;
  const opacity = dark ? 0.11 : 0.09;
  const dataUri = buildSvg(lines, color, opacity);
  return {
    backgroundImage: `url("${dataUri}")`,
    backgroundRepeat: "repeat",
    backgroundSize: `${TILE_WIDTH}px ${TILE_HEIGHT}px`,
  };
}
