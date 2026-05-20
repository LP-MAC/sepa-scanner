/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2d3348', // intermediate shade for active states
          850: '#1a1f2e', // slightly lighter than 900 for card details
        }
      }
    },
  },
  plugins: [],
};
