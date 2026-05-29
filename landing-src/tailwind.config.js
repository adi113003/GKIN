/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./login.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#fafafa",
          2: "#d4d4d8",
          3: "#a1a1aa",
          4: "#71717a",
          5: "#52525b",
        },
        brand: {
          blue: "#818cf8",     /* primary */
          cyan: "#38bdf8",     /* secondary accent */
          violet: "#4f46e5",   /* darker primary */
          amber: "#fbbf24",    
          rose: "#f87171",     
          green: "#34d399",    
          red: "#f87171",      
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        appear: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scan: {
          "0%": { top: "22%", opacity: "0" },
          "10%": { opacity: "0.9" },
          "90%": { opacity: "0.9" },
          "100%": { top: "92%", opacity: "0" },
        },
        liveBlink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        pulseSlide: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        appear: "appear 0.8s cubic-bezier(.2,.7,.3,1) both",
        "appear-delay-1": "appear 0.8s cubic-bezier(.2,.7,.3,1) 0.15s both",
        "appear-delay-2": "appear 0.8s cubic-bezier(.2,.7,.3,1) 0.3s both",
        "appear-delay-3": "appear 0.8s cubic-bezier(.2,.7,.3,1) 0.45s both",
        scan: "scan 4.5s ease-in-out infinite",
        liveBlink: "liveBlink 2s ease-in-out infinite",
        pulseSlide: "pulseSlide 3.5s linear infinite",
        spinSlow: "spinSlow 18s linear infinite",
      },
    },
  },
  plugins: [],
};
