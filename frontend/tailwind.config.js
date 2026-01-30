/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#e6f4e6',
          100: '#ccead9',
          200: '#99d5b3',
          300: '#66c08d',
          400: '#33ab67',
          500: '#008000',
          600: '#006600',
          700: '#004d00',
          800: '#003300',
          900: '#001a00',
        },
      },
    },
  },
  plugins: [],
};
