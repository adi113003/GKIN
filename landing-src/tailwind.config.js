/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./login.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F2ECDD",
        "paper-2": "#EAE2CE",
        ink: {
          DEFAULT: "#1A1714",
          soft: "#403A33",
        },
        navy: {
          DEFAULT: "#1C2E4A",
          soft: "#3A4D6E",
        },
        "rule-soft": "#B9AE93",
        supported: "#15633A",
        contradicted: "#9B1C2E",
        insufficient: "#5B6472",
      },
      fontFamily: {
        slab: ["Zilla Slab", "Georgia", "serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "Menlo", "monospace"],
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
