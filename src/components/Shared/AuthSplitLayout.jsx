import ThemeToggle from "./ThemeToggle";
import BrandMark from "./BrandMark";
import Footer from "./Footer";

// Shared shell for the Register and Login pages. Below the `lg` breakpoint
// (1024px) this renders as just the form, full-width and centered — the
// original mobile layout, unchanged. From `lg` up, a branding panel takes
// roughly 40% of the screen so the form isn't sitting alone in a sea of
// empty background on a wide desktop monitor, which was the actual
// complaint: a fixed narrow card centered in acres of white space.
//
// The panel is deliberately built from the LIGHT end of the brand ramp
// (50/100/200) rather than the dark end (600/800) — it still re-derives
// from whatever hue the current logo produces (see config/brand.js +
// utils/brandTheme.js), it just expresses that hue as a soft tint instead
// of a saturated, dark block. Text/icons flip to dark-on-light to match.
export default function AuthSplitLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-950">
      <ThemeToggle />

      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] relative overflow-hidden bg-gradient-to-br from-brand-50 via-brand-100 to-brand-200 dark:from-brand-900 dark:via-brand-900 dark:to-gray-950 flex-col justify-center px-12 xl:px-16 py-16 shrink-0 border-r border-brand-100 dark:border-brand-900">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-brand-300/30 dark:bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-brand-300/30 dark:bg-brand-500/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex bg-white dark:bg-gray-900 rounded-xl px-4 py-3 mb-10 shadow-sm border border-brand-100 dark:border-gray-800">
            <BrandMark className="h-8" />
          </div>
          <h2 className="text-3xl xl:text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-4 leading-tight">{title}</h2>
          <p className="text-base text-gray-600 dark:text-gray-400 max-w-sm">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-10 py-10">
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">{children}</div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
