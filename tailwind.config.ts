import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude visual style: warm neutrals + coral/terracotta accent
        cream: "#faf9f5",
        sand: "#f0eee6",
        ink: {
          DEFAULT: "#1f1e1c",
          soft: "#3d3a34",
          muted: "#6b6759",
        },
        clay: {
          50: "#fbf2ee",
          100: "#f6e0d6",
          300: "#e8a98f",
          500: "#d97757",
          600: "#c45c3a",
          700: "#a3492d",
        },
        line: "#e3e0d6",
      },
      borderRadius: {
        card: "1rem",
        xl2: "1.25rem",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(31,30,28,0.06), 0 1px 2px rgba(31,30,28,0.04)",
      },
      keyframes: {
        "border-blink": {
          "0%, 100%": { borderColor: "#facc15" },
          "50%": { borderColor: "transparent" },
        },
      },
      animation: {
        "border-blink": "border-blink 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-react-aria-components"),
    require("tailwindcss-animate"),
  ],
} satisfies Config;
