/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,jsx}',
    './src/renderer/src/**/*.{js,jsx,ts,tsx}',
    './src/renderer/components/ui/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Inter', 'SF Pro Display', 'sans-serif'],
        body: ['Inter', 'SF Pro Text', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // Meta/Facebook-inspired Professional Colors
        meta: {
          blue: {
            50: '#e7f3ff',
            100: '#c3e0ff',
            200: '#99caff',
            300: '#6fb4ff',
            400: '#4599ff',
            500: '#1877f2', // Meta primary blue
            600: '#166fe5',
            700: '#1264d1',
            800: '#0d59bf',
            900: '#0a4a9e',
          },
          gray: {
            50: '#f7f8fa',
            100: '#ebedf0',
            200: '#dadde1',
            300: '#bec3c9',
            400: '#8d949e',
            500: '#65676b',
            600: '#4b4f54',
            700: '#3a3b3c',
            800: '#242526',
            900: '#18191a',
          },
          green: {
            50: '#e6f7f0',
            100: '#c2ebd9',
            200: '#9bdfc2',
            300: '#73d3ab',
            400: '#4bc793',
            500: '#31a24c', // Success green
            600: '#2a8f43',
            700: '#237c3a',
            800: '#1c6831',
            900: '#155528',
          },
          orange: {
            50: '#fff4e6',
            100: '#ffe4c2',
            200: '#ffd199',
            300: '#ffbe70',
            400: '#ffab47',
            500: '#f5a623', // Warning orange
            600: '#e09620',
            700: '#c7841c',
            800: '#ad7218',
            900: '#946114',
          },
          red: {
            50: '#ffebe9',
            100: '#ffd0cc',
            200: '#ffb2ab',
            300: '#ff9489',
            400: '#ff7567',
            500: '#fa383e', // Error/destructive red
            600: '#e52e34',
            700: '#cc242a',
            800: '#b31a20',
            900: '#991016',
          }
        },
        // Dark theme colors (Meta-inspired)
        dark: {
          bg: {
            primary: '#18191a',    // Meta dark background
            secondary: '#242526',  // Slightly lighter
            tertiary: '#3a3b3c',   // Card backgrounds
            card: '#242526',       // Card background
            hover: '#3a3b3c',      // Hover state
          },
          text: {
            primary: '#e4e6eb',    // Primary text
            secondary: '#b0b3b8',  // Secondary text
            tertiary: '#8a8d91',   // Muted text
          },
          border: {
            primary: '#3e4042',    // Primary border
            secondary: '#4e4f50',  // Secondary border
          }
        },
        // Light theme colors (Meta-inspired)
        light: {
          bg: {
            primary: '#ffffff',
            secondary: '#f7f8fa',
            tertiary: '#ebedf0',
            card: '#ffffff',
            hover: '#f2f3f5',
          },
          text: {
            primary: '#1c1e21',
            secondary: '#65676b',
            tertiary: '#8a8d91',
          },
          border: {
            primary: '#dadde1',
            secondary: '#ccd0d5',
          }
        }
      }
    }
  },
  plugins: [require('tailwind-variants')]
}
