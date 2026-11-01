import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0a0e17',
          surface: '#111827',
          'surface-alt': '#151d2e',
          border: '#1e293b',
          'border-bright': '#334155',
          text: '#e8edf5',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          accent: '#c8ff00',
          'accent-muted': '#a3cc00',
          lime: '#c8ff00',
          emerald: '#34d399',
          'emerald-bright': '#6ee7b7',
          steel: '#7c93b8',
          amber: '#f59e0b',
          'amber-warm': '#fbbf24',
          rose: '#f43f5e',
          'rose-dim': '#be123c',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(30, 41, 59, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(30, 41, 59, 0.3) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
    },
  },
  plugins: [],
};

export default config;
