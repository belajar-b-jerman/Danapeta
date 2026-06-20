import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
        mint: "rgb(var(--color-mint) / <alpha-value>)",
        sky: "rgb(var(--color-sky) / <alpha-value>)",
        lavender: "rgb(var(--color-lavender) / <alpha-value>)",
        peach: "rgb(var(--color-peach) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 16px 40px rgba(31, 41, 51, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
