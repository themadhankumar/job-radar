import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#0F766E", // teal-700
          hover: "#115E59",
          soft: "#F0FDFA",
          dark: "#2DD4BF", // teal-400 for dark mode
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      keyframes: {
        "radar-ping": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: { "radar-ping": "radar-ping 1.8s cubic-bezier(0,0,0.2,1) infinite" },
    },
  },
  plugins: [],
};
export default config;
