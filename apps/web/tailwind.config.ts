import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(240 11% 9%)",
        foreground: "hsl(210 40% 98%)",
        primary: {
          DEFAULT: "#5B8DEE",
          foreground: "#fff",
        },
        accent: {
          DEFAULT: "#1F2933",
          foreground: "#E2E8F0",
        },
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F87171",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(15, 23, 42, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [animatePlugin],
} satisfies Config;
