/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,jsx}",
    "./src/renderer/src/**/*.{js,jsx,ts,tsx}",
    "./src/renderer/components/ui/**/*.{js,jsx,ts,tsx}",
  
  ],
  theme: {
    extend: {},
  },
  plugins: [ require("tailwind-variants"),],
}

