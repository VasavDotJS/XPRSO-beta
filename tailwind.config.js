/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#F2F3F5',
          dark: '#0A0A0C',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#16161A',
          well: {
            light: '#EAEBED',
            dark: '#101014',
          },
          elevated: {
            light: '#FFFFFF',
            dark: '#1E1E24',
          },
          glass: {
            light: 'rgba(20, 20, 26, 0.82)',
            dark: 'rgba(18, 18, 24, 0.85)',
          },
        },
        obsidian: {
          DEFAULT: '#121214',
          surface: '#1A1A1E',
          active: '#09090B',
        },
        brand: {
          DEFAULT: '#0066FF',
          hover: '#0052CC',
          active: '#0040A8',
          soft: '#EBF3FF',
          dark: '#2563EB',
        },
      },
      borderRadius: {
        'card-sm': '18px',
        'card': '24px',
        'card-lg': '32px',
        'pill': '9999px',
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'soft-md': '0 8px 20px -4px rgba(0, 0, 0, 0.06)',
        'soft-xl': '0 16px 36px -8px rgba(0, 0, 0, 0.08)',
        'obsidian': '0 8px 18px -4px rgba(18, 18, 20, 0.35)',
        'brand-glow': '0 10px 25px -4px rgba(0, 102, 255, 0.40)',
        'well-inset': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06), inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'neumorphic-raised': '-6px -6px 14px rgba(255, 255, 255, 0.8), 6px 6px 14px rgba(166, 171, 189, 0.35)',
        'neumorphic-inset': 'inset 3px 3px 6px rgba(166, 171, 189, 0.4), inset -3px -3px 6px rgba(255, 255, 255, 0.8)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Outfit', 'Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
