/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: {
          base: '#0d0d0f',
          raised: '#1a1a1e',
          overlay: '#242428',
        },
        // Glass
        glass: {
          bg: 'rgba(26, 26, 30, 0.7)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        // Borders
        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          focus: 'rgba(255, 255, 255, 0.2)',
        },
        // Status (desaturated pastels)
        status: {
          pending: '#7a7a80',
          searching: '#6b8cae',
          matched: '#7a9e7a',
          missing: '#b89070',
          downloading: '#6b8cae',
          complete: '#8fb88f',
          failed: '#b87070',
        },
        // Source badges
        badge: {
          soulseek: '#6b8cae',
          beatport: '#8fb88f',
          bandcamp: '#7ab8c0',
          ytdlp: '#b89070',
        },
        // Text
        txt: {
          primary: '#ffffff',
          secondary: '#a0a0a6',
          muted: '#6b6b70',
          disabled: '#44444a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'xs': '11px',
        'sm': '12px',
        'base': '13px',
        'lg': '14px',
        'xl': '16px',
      },
      spacing: {
        'sidebar': '200px',
        'row': '64px',
        'thumb': '50px',
        'header': '48px',
      },
      backdropBlur: {
        'glass': '20px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
}
