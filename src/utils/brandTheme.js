// Turns a logo image into a full 11-step color ramp (the same 50..950
// shape Tailwind's own palettes use), so the rest of the app can keep
// writing ordinary `bg-brand-600` / `dark:text-brand-400` classes and just
// have them mean "whatever the current logo's color is" — see
// tailwind.config.js (the `brand` palette reads these from CSS vars) and
// context/BrandContext.jsx (which calls this and writes the result).

const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Target lightness (0-100) per step. Modeled on how Tailwind's own palettes
// are shaped for a mid-saturation hue: very light tints down to a near-black
// shade, with 500 sitting close to "the color you'd actually point at".
const STEP_LIGHTNESS = {
  50: 97, 100: 94, 200: 87, 300: 76, 400: 63,
  500: 50, 600: 41, 700: 33, 800: 27, 900: 22, 950: 15,
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Samples the image on an offscreen canvas and picks the most "on-brand"
// color in it — i.e. the most saturated pixel among the reasonably common
// ones, which for a wordmark/logo is almost always the actual brand color
// rather than the white/transparent background or near-black outline
// strokes. Returns { h, s, l }.
export function extractDominantHsl(imgEl) {
  const canvas = document.createElement("canvas");
  // Downsampling keeps this fast regardless of the source image's real size.
  const SIZE = 80;
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, 0, 0, SIZE, SIZE);

  let data;
  try {
    data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  } catch (err) {
    // Cross-origin canvas read blocked — caller falls back to the default
    // palette rather than throwing.
    throw new Error("Couldn't read this image's pixels (it may be cross-origin).");
  }

  let bestScore = -1;
  let best = null;
  const seenHues = new Map(); // rough hue bucket -> {count, sample}

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue; // transparent
    const [h, s, l] = rgbToHsl(r, g, b);
    // Skip near-white, near-black, and washed-out (low-saturation) pixels —
    // these are almost always background/outline, not the brand color.
    if (l > 92 || l < 8 || s < 25) continue;

    const bucket = Math.round(h / 10) * 10;
    const entry = seenHues.get(bucket) || { count: 0, hSum: 0, sSum: 0, lSum: 0 };
    entry.count += 1;
    entry.hSum += h;
    entry.sSum += s;
    entry.lSum += l;
    seenHues.set(bucket, entry);
  }

  for (const entry of seenHues.values()) {
    // Favor hue buckets that are both common AND saturated — a few stray
    // vivid pixels shouldn't outrank the logo's actual dominant color.
    const avgS = entry.sSum / entry.count;
    const score = entry.count * (avgS / 100);
    if (score > bestScore) {
      bestScore = score;
      best = { h: entry.hSum / entry.count, s: avgS, l: entry.lSum / entry.count };
    }
  }

  if (!best) {
    throw new Error("Couldn't find a clear brand color in this image — try a more colorful logo.");
  }
  return best;
}

// Builds the { 50: "r g b", 100: "r g b", ... } ramp from one extracted
// hue/saturation, at the fixed lightness curve above. Saturation is nudged
// up slightly at the light/dark extremes so those shades don't look washed
// out or muddy — the same effect Tailwind's hand-tuned palettes have.
// Green/yellow hues read as noticeably brighter than blue/red/purple at
// the exact same HSL lightness — human luminance perception weights green
// about 3x more heavily than blue (the same math behind WCAG contrast
// ratios). Left uncorrected, a yellow, lime, or orange logo produces
// "brand-600" buttons where white button/badge text is nearly unreadable,
// even though the identical lightness value looks perfectly fine for a
// blue or purple logo. This nudges just the mid-range shades — the ones
// actually used as button/badge/active-state fills — darker for hues in
// that yellow-green band, and tapers smoothly to zero for hues that don't
// have the problem (blue, red, purple stay essentially untouched) and for
// the ramp's very light/very dark ends (used as backgrounds, not fills,
// so they were never a contrast concern).
function brightnessCompensation(hue, lightness) {
  const distanceFromYellowGreen = Math.min(Math.abs(hue - 95), 360 - Math.abs(hue - 95));
  const hueWeight = Math.max(0, 1 - distanceFromYellowGreen / 110);
  const rangeWeight = Math.max(0, 1 - Math.abs(lightness - 45) / 25);
  return hueWeight * rangeWeight * 20; // up to 20 percentage points darker at the worst case
}

export function buildShadeRamp({ h, s }) {
  // Logos are often more saturated than looks good at UI-chrome scale —
  // many brand marks sit at 80-95% saturation for print/on-screen punch,
  // while a considered UI palette usually reads best closer to 55-72%.
  // Capping here keeps buttons/badges/links looking like a designed
  // palette instead of a neon sign, without needing per-hue tuning.
  const cappedSaturation = Math.min(s, 72);
  const ramp = {};
  for (const step of RAMP_STEPS) {
    const targetLightness = STEP_LIGHTNESS[step];
    const lightness = Math.max(8, targetLightness - brightnessCompensation(h, targetLightness));
    const distanceFromMid = Math.abs(lightness - 50) / 50; // 0 at 500, 1 at extremes
    const adjustedS = Math.min(100, cappedSaturation + distanceFromMid * 12);
    const [r, g, b] = hslToRgb(h, adjustedS, lightness);
    ramp[step] = `${r} ${g} ${b}`;
  }
  return ramp;
}

// Loads the logo image from a URL/path (e.g. the LOGO_PATH configured in
// src/config/brand.js) into an <img>, ready for extractDominantHsl. Used
// once on app load — there's no upload step anymore, the path itself is
// the only thing that ever changes, and only by editing that file.
export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Harmless for a same-origin asset (the normal case — a file placed in
    // /public); only matters if LOGO_PATH is ever pointed at another
    // origin, in which case that origin also needs to allow CORS for pixel
    // reads to work at all.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the logo image at " + url));
    img.src = url;
  });
}
