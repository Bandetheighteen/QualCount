/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Archival Book & Ledger Design System tokens
        archival: {
          canvas: '#FAF8F4',
          'canvas-dark': '#121417',
          surface: '#F2EFE9',
          'surface-dark': '#181B20',
          card: '#FFFFFF',
          'card-dark': '#1E2228',
          hairline: '#DDD6C8',
          'hairline-dark': '#2D333B',
          borderStrong: '#BEB5A4',
          'borderStrong-dark': '#4B5563',
          inkPrimary: '#1C1B18',
          'inkPrimary-dark': '#F4F2ED',
          inkSecondary: '#5A554C',
          'inkSecondary-dark': '#9CA3AF',
          inkMuted: '#8A8377',
          'inkMuted-dark': '#6B7280',
        },
        canvas: {
          DEFAULT: '#FAF8F4',
          card: '#FFFFFF',
          surface: '#F2EFE9',
          border: '#DDD6C8',
        },
        neon: {
          green: '#0F6B38',
          yellow: '#B45309',
          white: '#18181B',
          blue: '#2563EB',
        },
        muted: {
          gray: '#8A8377',
          green: '#8FA397',
        }
      },
      fontFamily: {
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '6px',
        btn: '4px',
        pill: '3px',
      }
    },
  },
  plugins: [],
};
