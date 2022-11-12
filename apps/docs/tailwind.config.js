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
        sans: ['Gilroy', ...defaultTheme.fontFamily.sans],
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
  plugins: [],
};
