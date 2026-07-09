/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pitch-inspired palette
        pitch: {
          950: '#08130c',
          900: '#0b1a12',
          800: '#0f2419',
          700: '#12301f',
        },
        grass: {
          400: '#22c55e',
          500: '#16a34a',
          600: '#0b6b3a',
        },
        // Rarity accents
        rare: '#f5b301',
        frequent: '#7dd3fc',
        common: '#cbd5e1',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      safelist: [],
    },
  },
  plugins: [],
}
