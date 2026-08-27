/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          500: '#3457d5',
          600: '#2945b3',
          700: '#213791',
          900: '#152362',
        },
      },
    },
  },
  plugins: [],
};
