/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./login.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Airbnb-style system ───────────────────────────────────────────
        // Single brand voltage — Rausch — carries every primary CTA / link.
        rausch: {
          DEFAULT: "#ff385c",
          active: "#e00b41",
          disabled: "#ffd1da",
        },
        canvas: "#ffffff",
        "surface-soft": "#f7f7f7",
        "surface-strong": "#f2f2f2",
        ink: {
          DEFAULT: "#222222", // headlines + primary text (never pure black)
          soft: "#6a6a6a", // muted secondary text
        },
        "body-text": "#3f3f3f",
        muted: {
          DEFAULT: "#6a6a6a",
          soft: "#929292",
        },
        hairline: {
          DEFAULT: "#dddddd",
          soft: "#ebebeb",
        },
        "border-strong": "#c1c1c1",
        // verdict colors — MEANING ONLY, kept distinct from Rausch.
        supported: "#15633A",
        contradicted: "#9B1C2E",
        insufficient: "#6a6a6a",
        // ── Legacy-name remaps (so any un-migrated class stays on-palette) ──
        paper: "#ffffff",
        "paper-2": "#f7f7f7",
        navy: {
          DEFAULT: "#ff385c", // accent is now Rausch
          soft: "#e00b41",
        },
        "rule-soft": "#dddddd",
      },
      fontFamily: {
        // Full Inter sans — the Airbnb feel. Legacy slab/serif/mono all resolve
        // to Inter so leftover classes render cleanly.
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        slab: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        card: "14px", // {rounded.md} — property/result cards
        pill: "9999px",
      },
      boxShadow: {
        // Airbnb's single elevation tier — used on hover-floated cards & dropdowns.
        card: "rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0",
      },
      keyframes: {
        appear: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        appear: "appear 0.6s cubic-bezier(.2,.7,.3,1) both",
      },
    },
  },
  plugins: [],
};
