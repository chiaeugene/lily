import type { Config } from "tailwindcss";

// Design system v2 ("Geist SaaS", 2026 refresh): warm-neutral surfaces, one
// confident indigo accent (not desaturated, not rainbow), semantic profit/loss/
// warn kept separate from the accent hue, soft layered shadows over flat borders.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAF9",
        surface: { DEFAULT: "#FFFFFF", 2: "#F6F6F5" },
        ink: "#1A1A18",
        muted: "#6F6E68",
        faint: "#A6A49C",
        line: { DEFAULT: "#EAE9E5", strong: "#DDDBD5" },
        primary: { DEFAULT: "#4F46E5", light: "#7C74F0", hover: "#3730A3", soft: "#F0EFFE" }, // indigo accent
        brand: { DEFAULT: "#7C3AED", soft: "#F5F3FF" }, // violet (Lily wordmark only)
        sidebar: { DEFAULT: "#0B1220", hover: "#161F32", active: "#1E293B" }, // kept for any residual dark-panel use
        profit: { DEFAULT: "#0E8A5F", soft: "#E9F7F0" },
        loss: { DEFAULT: "#E23F44", soft: "#FDECED" },
        warn: { DEFAULT: "#C2760C", soft: "#FDF3E3" },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,24,0.04), 0 1px 1px rgba(26,26,24,0.03)",
        lift: "0 2px 5px rgba(26,26,24,0.05), 0 12px 28px -10px rgba(26,26,24,0.12)",
        pop: "0 4px 10px rgba(26,26,24,0.06), 0 24px 48px -14px rgba(26,26,24,0.18)",
      },
      borderRadius: { xl: "14px", "2xl": "18px" },
    },
  },
  plugins: [],
};
export default config;
