/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: "#0056D2",
        "on-primary": "#FFFFFF",
        "primary-container": "#0f62fe",
        "on-primary-container": "#f3f3ff",
        secondary: "#5e5e67",
        "on-secondary": "#FFFFFF",
        "secondary-container": "#e0dee9",
        "on-secondary-container": "#62626b",
        surface: "#f9f9f9",
        "on-surface": "#1a1c1c",
        "surface-variant": "#e2e2e2",
        "on-surface-variant": "#424656",
        outline: "#737687",
        "outline-variant": "#c3c6d8",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f3f3",
        "surface-container-high": "#e8e8e8",
        "surface-container-highest": "#e2e2e2",
        "surface-dim": "#dadada",
      },
      borderRadius: {
        "DEFAULT": "1rem",
        "lg": "2rem",
        "xl": "3rem",
        "full": "9999px"
      },
      fontFamily: {
        headline: ["Outfit", "sans-serif"],
        display: ["Outfit", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"]
      },
      spacing: {
        'base': '1rem',
        'md': '1.5rem',
        'sm': '0.75rem',
        'margin': '2rem'
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
