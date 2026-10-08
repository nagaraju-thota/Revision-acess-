import { createContext, useContext, useEffect, useState } from "react";
import { extractDominantHsl, buildShadeRamp, loadImageFromUrl } from "../utils/brandTheme";
import { LOGO_PATH, COMPANY_NAME } from "../config/brand";

const BrandContext = createContext(null);

// Writes a { 50: "r g b", ... } ramp onto :root as the --color-brand-*
// custom properties tailwind.config.js's `brand` palette reads from. Every
// `bg-brand-600`, `dark:text-brand-400`, `border-brand-600/40`, etc.
// anywhere in the app updates the instant this runs — no component needs
// to know the logo changed.
function applyRamp(ramp) {
  const root = document.documentElement;
  Object.entries(ramp).forEach(([step, rgb]) => {
    root.style.setProperty(`--color-brand-${step}`, rgb);
  });
}

// Wraps the whole app once (see App.jsx, alongside ThemeProvider). There is
// no admin UI and no backend involved in branding at all — LOGO_PATH and
// COMPANY_NAME in src/config/brand.js are the single source of truth,
// edited directly in code. On mount, this loads whatever image LOGO_PATH
// currently points to and re-derives the portal's whole accent color from
// it automatically. If that fails for any reason (missing file, a logo
// with no clear dominant color), the defaults already seeded in
// index.css stand as-is — a bad LOGO_PATH never crashes the app, it just
// falls back to the original look.
export function BrandProvider({ children }) {
  // Bumped once the logo's color has actually been extracted and applied.
  // Every useBrand() consumer re-renders when this changes (it's part of
  // the context value), which matters specifically for the exam
  // watermark: watermarkStyle() bakes the current --color-brand-900/100
  // into an embedded SVG string at the moment it's called, so it can't
  // react to a CSS variable changing on its own the way a plain
  // `bg-brand-600` class does. Without this, a component that rendered
  // before extraction finished could keep showing the old watermark color
  // indefinitely instead of picking up the new one.
  const [paletteVersion, setPaletteVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadImageFromUrl(LOGO_PATH)
      .then((imgEl) => {
        if (cancelled) return;
        const hsl = extractDominantHsl(imgEl);
        applyRamp(buildShadeRamp(hsl));
        setPaletteVersion((v) => v + 1);
      })
      .catch(() => {
        // Missing/unreadable image, or no clear brand color in it — keep
        // the default palette rather than leaving the app broken.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Favicon isn't a JSX-rendered element (it lives in <head>, outside
  // anything React touches), so it can't just import BrandMark like every
  // other logo spot does. This is the one place that would otherwise stay
  // a second hardcoded path — instead it's set here, in JS, straight from
  // the same LOGO_PATH constant, so index.html never needs editing and
  // there's still only one place to change the logo.
  useEffect(() => {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = LOGO_PATH;
  }, []);

  return (
    <BrandContext.Provider value={{ logoSrc: LOGO_PATH, companyName: COMPANY_NAME, paletteVersion }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used inside <BrandProvider>");
  return ctx;
}
