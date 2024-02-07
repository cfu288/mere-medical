const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Source Sans',
          'system-ui',
          'Segoe UI',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
      },
      spacing: {
        128: '32rem',
      },
      colors: {
        primary: {
          DEFAULT: '#006183',
          50: '#E2F1F9',
          100: '#BDE2F4',
          200: '#76C9EF',
          300: '#2AB4EF',
          400: '#0992C8',
          500: '#006183',
          600: '#055270',
          700: '#07455F',
          800: '#09384E',
          900: '#0B2F42',
          950: '#0C2836',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
