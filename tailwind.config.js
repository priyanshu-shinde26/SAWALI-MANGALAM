/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: "#fff5f5",
          100: "#ffe6e8",
          200: "#f9c8ce",
          300: "#f097a6",
          400: "#df5e79",
          500: "#cb365a",
          600: "#b02044",
          700: "#8f1736",
          800: "#6f122a",
          900: "#500b1d",
          950: "#2f0510",
        },
        gold: {
          50: "#fff9e8",
          100: "#ffefc2",
          200: "#ffe28a",
          300: "#ffd15a",
          400: "#f4bb2f",
          500: "#dd9e1d",
          600: "#c27f13",
          700: "#9b5d11",
          800: "#7f4914",
          900: "#6a3d14",
        },
      },
      boxShadow: {
        card: "0 6px 24px rgba(80, 11, 29, 0.08)",
      },
      fontFamily: {
        heading: ["Cinzel", "serif"],
        body: ["Poppins", "sans-serif"],
      },
      backgroundImage: {
        "maroon-glow":
          "radial-gradient(circle at top left, rgba(221,158,29,0.15), transparent 35%), radial-gradient(circle at bottom right, rgba(80,11,29,0.2), transparent 40%)",
      },
    },
  },
  plugins: [],
};
