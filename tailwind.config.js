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
        heading: ['Plus Jakarta Sans', 'Inter', 'SF Pro Display', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'Inter', 'SF Pro Text', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand Colors - Design System
        brand: {
          // Primary Purple-Blue
          primary: {
            light: '#4318FF',  // Light mode - Vivid Purple-Blue
            DEFAULT: '#4318FF',
            dark: '#7551FF',   // Dark mode - Lighter Purple
          },
          // Secondary Cyan
          secondary: {
            light: '#39B8FF',  // Light mode - Cyan Blue
            DEFAULT: '#39B8FF',
            dark: '#33C3FF',   // Dark mode - Neon Cyan
          },
          // Tertiary Orange
          tertiary: {
            light: '#FF5630',  // Light mode - Soft Red/Orange
            DEFAULT: '#FF5630',
            dark: '#FF6B6B',   // Dark mode - Salmon Orange
          }
        },
        // Background Colors
        surface: {
          // Light Mode
          main: '#F4F7FE',       // Very light blue-grey
          card: '#FFFFFF',       // Pure White
          // Dark Mode
          'dark-main': '#0B1437',    // Deep Midnight Blue
          'dark-card': '#111C44',    // Lighter Navy Blue
          'dark-input': '#1B254B',   // Dark Navy
        },
        // Typography Colors
        content: {
          // Light Mode
          primary: '#2B3674',    // Deep Navy
          secondary: '#A3AED0',  // Cool Grey
          // Dark Mode (same secondary for consistency)
          'dark-primary': '#FFFFFF',
          'dark-secondary': '#A3AED0',
        },
        // Legacy color mappings for compatibility
        meta: {
          blue: {
            50: '#EEF4FF',
            100: '#E0EAFF',
            200: '#C7D7FE',
            300: '#A4BCFD',
            400: '#39B8FF',
            500: '#4318FF',
            600: '#3B0FE8',
            700: '#2E0BBF',
            800: '#25099C',
            900: '#1C0778',
          },
          gray: {
            50: '#F4F7FE',
            100: '#EDF2F7',
            200: '#E2E8F0',
            300: '#CBD5E1',
            400: '#A3AED0',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
          green: {
            50: '#e6f7f0',
            100: '#c2ebd9',
            200: '#9bdfc2',
            300: '#73d3ab',
            400: '#4bc793',
            500: '#31a24c',
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
            400: '#FF6B6B',
            500: '#FF5630',
            600: '#e04520',
            700: '#c7341c',
            800: '#ad2418',
            900: '#941014',
          },
          red: {
            50: '#ffebe9',
            100: '#ffd0cc',
            200: '#ffb2ab',
            300: '#ff9489',
            400: '#ff7567',
            500: '#fa383e',
            600: '#e52e34',
            700: '#cc242a',
            800: '#b31a20',
            900: '#991016',
          }
        },
        // Dark theme specific colors
        dark: {
          bg: {
            primary: '#0B1437',    // Deep Midnight Blue
            secondary: '#111C44',  // Lighter Navy Blue
            tertiary: '#1B254B',   // Dark Navy (input)
            card: '#111C44',
            hover: '#1B254B',
          },
          text: {
            primary: '#FFFFFF',
            secondary: '#A3AED0',
            tertiary: '#64748b',
          },
          border: {
            primary: 'rgba(163, 174, 208, 0.2)',
            secondary: 'rgba(163, 174, 208, 0.3)',
          }
        },
        // Light theme specific colors
        light: {
          bg: {
            primary: '#F4F7FE',
            secondary: '#FFFFFF',
            tertiary: '#EDF2F7',
            card: '#FFFFFF',
            hover: '#EDF2F7',
          },
          text: {
            primary: '#2B3674',
            secondary: '#A3AED0',
            tertiary: '#64748b',
          },
          border: {
            primary: '#E2E8F0',
            secondary: '#CBD5E1',
          }
        }
      }
    }
  },
  plugins: [require('tailwind-variants')]
}
