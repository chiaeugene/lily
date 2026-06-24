import type { Config } from "tailwindcss";

// Deliberate design system (ui-ux-pro-max: data-dense financial admin, light mode):
// neutral slate surfaces, indigo primary, semantic profit/loss, violet Lily brand.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F6F7F9",
        surface: "#FFFFFF",
        ink: "#0F172A", // slate-900, primary text
        muted: "#64748B", // slate-500, secondary text
        faint: "#94A3B8", // slate-400
        line: "#E8EAEE", // hairline borders
        primary: { DEFAULT: "#4F46E5", hover: "#4338CA", soft: "#EEF2FF" }, // indigo
        brand: { DEFAULT: "#7C3AED", soft: "#F5F3FF" }, // violet (Lily)
        sidebar: { DEFAULT: "#0B1220", hover: "#161F32", active: "#1E293B" },
        profit: { DEFAULT: "#16A34A", soft: "#ECFDF5" },
        loss: { DEFAULT: "#DC2626", soft: "#FEF2F2" },
        warn: { DEFAULT: "#D97706", soft: "#FFFBEB" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        pop: "0 10px 30px rgba(16,24,40,0.12), 0 2px 8px rgba(16,24,40,0.08)",
      },
      borderRadius: { xl: "12px", "2xl": "16px" },
    },
  },
  plugins: [],
};
export default config;
