/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#01A5A5',
          50: '#e6f7f7',
          100: '#ccefef',
          500: '#01A5A5',
          600: '#018f8f',
          700: '#017070',
        },
        orange: {
          DEFAULT: '#E85F00',
          50: '#fdefe6',
          100: '#fbdfcc',
          500: '#E85F00',
          600: '#cc5400',
          700: '#a84500',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
