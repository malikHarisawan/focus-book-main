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
        heading: ['Orbitron', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Retro-Futuristic Neon Colors
        neon: {
          cyan: {
            50: '#e0ffff',
            100: '#b3ffff',
            200: '#80ffff',
            300: '#4dffff',
            400: '#1affff',
            500: '#00ffff', // Primary neon cyan
            600: '#00e6e6',
            700: '#00cccc',
            800: '#00b3b3',
            900: '#009999',
          },
          pink: {
            50: '#ffe0ff',
            100: '#ffb3ff',
            200: '#ff80ff',
            300: '#ff4dff',
            400: '#ff1aff',
            500: '#ff00ff', // Primary neon magenta
            600: '#e600e6',
            700: '#cc00cc',
            800: '#b300b3',
            900: '#990099',
          },
          purple: {
            50: '#f3e5ff',
            100: '#d9b3ff',
            200: '#bf80ff',
            300: '#a64dff',
            400: '#8c1aff',
            500: '#7700ff', // Neon purple
            600: '#6b00e6',
            700: '#6000cc',
            800: '#5400b3',
            900: '#490099',
          },
          green: {
            50: '#ccffe0',
            100: '#99ffb3',
            200: '#66ff80',
            300: '#33ff4d',
            400: '#00ff1a',
            500: '#00ff00', // Neon green
            600: '#00e600',
            700: '#00cc00',
            800: '#00b300',
            900: '#009900',
          },
          orange: {
            50: '#fff5e0',
            100: '#ffe6b3',
            200: '#ffd480',
            300: '#ffc24d',
            400: '#ffb01a',
            500: '#ff9900', // Neon orange
            600: '#e68a00',
            700: '#cc7a00',
            800: '#b36b00',
            900: '#995c00',
          }
        },
        // Dark theme colors (retro-futuristic update)
        dark: {
          bg: {
            primary: '#000000', // Pure black for retro terminal feel
            secondary: '#0a0a0f', // Near black with blue tint
            tertiary: '#141420', // Dark purple-blue
            card: '#0f0f1a', // Dark card background
            hover: '#1a1a2e', // Hover state
          },
          text: {
            primary: '#ffffff', // Pure white for terminal feel
            secondary: '#00ffff', // Neon cyan
            tertiary: '#b3b3ff', // Light purple
          },
          border: {
            primary: '#00ffff33', // Cyan with transparency
            secondary: '#ff00ff33', // Magenta with transparency
          }
        },
        // Light theme colors (retro-futuristic update)
        light: {
          bg: {
            primary: '#ffffff',
            secondary: '#f0f0ff',
            tertiary: '#e6e6ff',
            card: '#fafafa',
            hover: '#f5f5ff',
          },
          text: {
            primary: '#1a1a2e',
            secondary: '#0099cc',
            tertiary: '#6666cc',
          },
          border: {
            primary: '#00ccff',
            secondary: '#cc00cc',
          }
        }
      }
    }
  },
  plugins: [require('tailwind-variants')]
}
