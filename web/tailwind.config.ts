import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#8B7CFF", // signal violet (dark theme value; CSS vars are the source of truth)
          hover: "#7A69F5",
          soft: "#241D45",
          dark: "#8B7CFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        data: ["var(--font-martian)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        snap: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "radar-ping": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "tick-in": {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "drawer-in": {
          from: { transform: "translateX(24px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "sheet-in": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "radar-ping": "radar-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        "tick-in": "tick-in 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "drawer-in": "drawer-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "sheet-in": "sheet-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 200ms ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
