/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        foreground: "var(--text)",
        panel: "var(--panel)",
        line: "var(--line)",
        teal: {
          DEFAULT: "var(--teal)",
          light: "var(--teal-light)",
          dark: "var(--teal-dark)",
        },
        sub: "var(--sub)",
        
        // Shadcn UI defaults adapted for our teal theme
        card: {
          DEFAULT: "var(--panel)",
          foreground: "var(--text)",
        },
        popover: {
          DEFAULT: "var(--panel)",
          foreground: "var(--text)",
        },
        primary: {
          DEFAULT: "var(--teal)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--teal-dark)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--sub)",
        },
        accent: {
          DEFAULT: "rgba(38, 166, 149, 0.12)",
          foreground: "var(--teal)",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#fafafa",
        },
        border: "var(--line)",
        input: "var(--line)",
        ring: "var(--teal)",
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: "var(--glow)",
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}
