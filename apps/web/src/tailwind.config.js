module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cera Pro'],
        cera: ['Cera Pro'],
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
    // ...
    require('@tailwindcss/forms'),
  ],
};
