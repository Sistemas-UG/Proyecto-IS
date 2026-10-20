/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "'Sora'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        navyDeep: "#0A0C14",
        navy: "#12141F",
        navyCard: "#1E2130",
        bg: "#F7F7FB",
        border: "#E5E7F0",
        ink: "#15171F",
        muted: "#686E85",
        faint: "#9BA0B5",
        blue: "#5B5FEF",
        blueSoft: "#EDEDFD",
        green: "#0E9F6E",
        greenSoft: "#E7F8F0",
        amber: "#B45309",
        amberSoft: "#FCF1DC",
        red: "#DC2626",
        redSoft: "#FDE8E8",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(10,12,20,0.04), 0 10px 30px -14px rgba(10,12,20,0.14)",
      },
    },
  },
  plugins: [],
}