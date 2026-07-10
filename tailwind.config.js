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
        heading: ['Space Grotesk', 'Manrope', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Manrope', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'SF Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // --- New design-system tokens (read the CSS variables in main.css) ---
        // Use as bg-fb-surface, text-fb-muted, border-fb-border, etc.
        fb: {
          bg: 'var(--fb-bg)',
          surface: 'var(--fb-surface)',
          surface2: 'var(--fb-surface2)',
          text: 'var(--fb-text)',
          muted: 'var(--fb-muted)',
          border: 'var(--fb-border)',
          track: 'var(--fb-track)',
          accent: 'var(--fb-accent)',
          accentsoft: 'var(--fb-accentsoft)',
          tip: 'var(--fb-tip)',
        },
        // Category / productivity colors (theme-aware via CSS vars)
        cat: {
          deep: 'var(--c-deep)',
          create: 'var(--c-create)',
          comms: 'var(--c-comms)',
          break: 'var(--c-break)',
          distract: 'var(--c-distract)',
        },
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
            // Repointed to the redesign's violet accent so badge.jsx tracks the new palette.
            50: '#EDEDFB',
            100: '#DEDEF8',
            200: '#C4C4F1',
            300: '#A3A3E8',
            400: '#8383DE',
            500: '#5B5BD6',
            600: '#4A4AC0',
            700: '#3C3C9E',
            800: '#31317E',
            900: '#26265F',
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
            // Break / warning — repointed to the reference amber.
            50: '#fdf1e0',
            100: '#fbe1bd',
            200: '#f7cd8f',
            300: '#f4ba62',
            400: '#F0A93B',
            500: '#e2951f',
            600: '#c47d18',
            700: '#9e6413',
            800: '#7c4e0f',
            900: '#5c3a0b',
          },
          red: {
            // Distraction — repointed to the reference salmon-red.
            50: '#fdeaed',
            100: '#fbd2d8',
            200: '#f7abb6',
            300: '#f48494',
            400: '#F26B7E',
            500: '#F0596E',
            600: '#d94257',
            700: '#b83447',
            800: '#932a39',
            900: '#71212d',
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
