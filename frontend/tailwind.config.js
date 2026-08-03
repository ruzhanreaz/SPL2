const tokenScale = (name) => ({
  50: `rgb(var(--color-${name}-50) / <alpha-value>)`,
  100: `rgb(var(--color-${name}-100) / <alpha-value>)`,
  200: `rgb(var(--color-${name}-200) / <alpha-value>)`,
  300: `rgb(var(--color-${name}-300) / <alpha-value>)`,
  400: `rgb(var(--color-${name}-400) / <alpha-value>)`,
  500: `rgb(var(--color-${name}-500) / <alpha-value>)`,
  600: `rgb(var(--color-${name}-600) / <alpha-value>)`,
  700: `rgb(var(--color-${name}-700) / <alpha-value>)`,
  800: `rgb(var(--color-${name}-800) / <alpha-value>)`,
  900: `rgb(var(--color-${name}-900) / <alpha-value>)`,
  950: `rgb(var(--color-${name}-950) / <alpha-value>)`,
});

const primaryScale = tokenScale("primary");
const accentScale = tokenScale("accent");
const grayScale = tokenScale("gray");
const successScale = tokenScale("success");
const warningScale = tokenScale("warning");
const errorScale = tokenScale("error");
const infoScale = tokenScale("info");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: primaryScale,
        accent: accentScale,
        neutral: grayScale,
        success: successScale,
        warning: warningScale,
        error: errorScale,
        info: infoScale,
        gray: grayScale,
        slate: grayScale,
        blue: primaryScale,
        indigo: primaryScale,
        teal: primaryScale,
        cyan: infoScale,
        sky: infoScale,
        green: successScale,
        emerald: successScale,
        lime: successScale,
        yellow: warningScale,
        amber: warningScale,
        orange: warningScale,
        red: errorScale,
        rose: errorScale,
      },
    },
  },
  plugins: [],
};
