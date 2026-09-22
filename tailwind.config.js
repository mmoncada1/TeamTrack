/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          DEFAULT: '#2e7d4f',
          dark: '#255f3f',
        },
      },
    },
  },
  plugins: [],
};
