/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      // "brand" replaces the old hardcoded `sky` palette everywhere in the
      // app. Each shade reads its RGB triplet from a CSS custom property
      // (see src/index.css for the defaults, and src/context/BrandContext
      // + src/utils/brandTheme.js for how they get overwritten at runtime
      // when someone uploads a new logo) instead of a fixed hex value.
      // `rgb(var(...) / <alpha-value>)` is Tailwind's documented pattern for
      // CSS-variable-backed colors that still support opacity modifiers
      // (e.g. `bg-brand-950/40`, already used in ExamRunner.jsx).
      colors: {
        brand: {
          50: "rgb(var(--color-brand-50) / <alpha-value>)",
          100: "rgb(var(--color-brand-100) / <alpha-value>)",
          200: "rgb(var(--color-brand-200) / <alpha-value>)",
          300: "rgb(var(--color-brand-300) / <alpha-value>)",
          400: "rgb(var(--color-brand-400) / <alpha-value>)",
          500: "rgb(var(--color-brand-500) / <alpha-value>)",
          600: "rgb(var(--color-brand-600) / <alpha-value>)",
          700: "rgb(var(--color-brand-700) / <alpha-value>)",
          800: "rgb(var(--color-brand-800) / <alpha-value>)",
          900: "rgb(var(--color-brand-900) / <alpha-value>)",
          950: "rgb(var(--color-brand-950) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
