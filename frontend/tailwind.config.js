/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080808",      // Matte black background
        surface: "#111111",         // Dark cards background
        surfaceLight: "#181818",    // Slightly lighter card hover
        borderDark: "#202020",      // Premium subtle borders
        textMuted: "#8e8e93",       // Gray 500 for captions
        brand: "#c51b29",           // Branding deep red
        bullish: "#00b067",         // Emerald green for bullish
        bearish: "#ff3b30",         // Bright red for bearish
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.5)",
        premium: "0 4px 20px 0 rgba(0, 0, 0, 0.7)",
      }
    },
  },
  plugins: [],
}
