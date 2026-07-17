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

        // The physical naipe (Naipes Heraclio Fournier, 1995). Sampled off the
        // scans in docs/rulebook/scans — these are print colours, not app chrome,
        // and are only ever used inside the card. See docs/rulebook/pages/page-02.md.
        naipe: {
          // The card stock and the two-tone grey of the name/data bands.
          white: '#fdfdfb',
          band: '#55524f',
          'band-dark': '#211f1e',
        },
        // Demarcación: «la zona del jugador en rojo» (page 2). Red marks where the
        // player's factors are usable; green is everywhere else.
        demarc: {
          red: '#d92b1f',
          green: '#7ac143',
        },
        // The factor strip prints its abbreviation in black and its value in blue.
        factor: '#1c4fa1',
        // The ficha numeral, «en rojo si es extranjero» (page 2).
        ficha: '#cc2222',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      aspectRatio: {
        // Spanish naipe, 62 × 95 mm.
        naipe: '62 / 95',
      },
      spacing: {
        // The TopBar's height, defined once as --topbar-h in index.css. Gives
        // `h-topbar` for the bar itself and `top-topbar` for everything that
        // sticks below it, so the coupling is legible instead of a magic number.
        topbar: 'var(--topbar-h)',
      },
    },
  },
  plugins: [],
}
