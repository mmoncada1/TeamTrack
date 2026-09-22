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
      screens: {
        // A wide, landscape viewport is what the multi-column live-match and
        // whiteboard layouts assume (room beside the field for alerts/bench/
        // sidebar). A laptop or tablet turned to portrait can still be wider
        // than `sm`, but there isn't side-by-side room anymore, so those
        // layouts should fall back to the stacked mobile treatment instead.
        wide: { raw: '(min-width: 640px) and (orientation: landscape)' },
      },
    },
  },
  plugins: [],
};
