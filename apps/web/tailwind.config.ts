import type { Config } from 'tailwindcss';

/**
 * ApexTrade design tokens — dark fintech theme with gold accent.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0b0d',
          soft: '#111317',
          card: '#15181d',
          hover: '#1c2026',
        },
        border: '#23272f',
        gold: {
          DEFAULT: '#f0b90b', // Binance-like accent (distinct brand: warmer)
          soft: '#fcd535',
          dark: '#c99400',
        },
        up: '#16c784',
        down: '#ea3943',
        muted: '#7d8693',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #fcd535 0%, #f0b90b 100%)',
        'hero-glow': 'radial-gradient(ellipse at top, rgba(240,185,11,0.12), transparent 60%)',
      },
      boxShadow: {
        glow: '0 0 40px rgba(240,185,11,0.15)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
