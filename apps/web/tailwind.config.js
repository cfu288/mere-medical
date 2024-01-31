const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components}/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    aspectRatio: {
      auto: 'auto',
      square: '1 / 1',
      video: '16 / 9',
      1: '1',
      2: '2',
      3: '3',
      4: '4',
      5: '5',
      6: '6',
      7: '7',
      8: '8',
      9: '9',
      10: '10',
      11: '11',
      12: '12',
      13: '13',
      14: '14',
      15: '15',
      16: '16',
    },
    extend: {
      screens: {
        xs: '480px',
      },
      fontFamily: {
        sans: [
          'Avenir',
          'Avenir Next LT Pro',
          'Montserrat',
          'Corbel',
          'URW Gothic',
          'source-sans-pro',
          'sans-serif',
        ],
      },
      colors: {
        primary: {
          DEFAULT: '#006183',
          50: '#8DEAFF',
          100: '#79E6FF',
          200: '#50DCFF',
          300: '#27D1FF',
          400: '#00C5FD',
          500: '#00A2D5',
          600: '#0081AC',
          700: '#006183',
          800: '#00455F',
          900: '#232E50',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/typography'),
  ],
};
