import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marrow palette — warm neutral surfaces, terracotta accent, with
        // olive / amber / rose for status. Token names match the existing
        // codebase so prior usages (bg-cream, text-ink, border-line, …) keep
        // working but render the Marrow look automatically.
        cream: "#FAFAF7", // --bg
        sand: "#F2F0EA", // --bg-sunken
        ink: {
          DEFAULT: "#161512",
          soft: "#3A3833",
          muted: "#6B675E",
          dim: "#9A958A",
        },
        // Clay = accent. Kept the same name so existing components stay valid.
        clay: {
          50: "#FBF2EE",
          100: "#F6E2D8", // --accent-soft
          300: "#E8A98F",
          500: "#D9542B", // --accent (terracotta)
          600: "#C44A24",
          700: "#A33E1E",
        },
        line: {
          DEFAULT: "#E7E3D9", // --line
          strong: "#D6D1C4", // --line-strong
        },
        olive: {
          DEFAULT: "#2A6F4E",
          soft: "#DEE9D9",
        },
        amber: {
          DEFAULT: "var(--amber)",
          soft: "var(--amber-soft)",
        },
        rose: {
          DEFAULT: "#B83A3A",
          soft: "#F7D9D9",
        },
      },
      borderRadius: {
        // Marrow radius scale: 6 / 10 / 16
        sm: "6px",
        DEFAULT: "10px",
        card: "10px",
        lg: "16px",
        xl2: "1.25rem",
      },
      fontFamily: {
        // Wired to CSS vars set by next/font in layout.tsx
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace",
        ],
      },
      fontSize: {
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        md: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
      },
      fontFeatureSettings: {
        marrow: '"ss01", "cv11"',
      },
      boxShadow: {
        // Marrow shadow tiers
        card: "0 1px 0 rgba(22,21,18,0.04), 0 1px 2px rgba(22,21,18,0.04)",
        elev: "0 8px 24px -8px rgba(22,21,18,0.12), 0 2px 6px rgba(22,21,18,0.04)",
        pop: "0 20px 48px -16px rgba(22,21,18,0.24), 0 4px 12px rgba(22,21,18,0.06)",
      },
      keyframes: {
        "border-blink": {
          "0%, 100%": { borderColor: "#facc15" },
          "50%": { borderColor: "transparent" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(217,84,43,0.55)" },
          "70%": { boxShadow: "0 0 0 14px rgba(217,84,43,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(217,84,43,0)" },
        },
        "marrow-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "border-blink": "border-blink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-ring": "pulse-ring 1.4s ease",
        "marrow-blink": "marrow-blink 1s ease-in-out infinite",
        "slide-up": "slide-up 0.22s cubic-bezier(.2,.7,.2,1)",
        "fade-in": "fade-in 0.18s ease",
      },
    },
  },
  plugins: [
    require("tailwindcss-react-aria-components"),
    require("tailwindcss-animate"),
  ],
} satisfies Config;
