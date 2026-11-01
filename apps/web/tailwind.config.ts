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
          bg: '#080c14',
          surface: '#0e1424',
          'surface-alt': '#131b2e',
          'surface-hover': '#172138',
          border: '#1a243b',
          'border-bright': '#273554',
          text: '#f1f5f9',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          accent: '#10b981',
          'accent-muted': '#059669',
          lime: '#10b981',
          emerald: '#10b981',
          'emerald-bright': '#34d399',
          steel: '#64748b',
          amber: '#f59e0b',
          'amber-warm': '#fbbf24',
          rose: '#f43f5e',
          'rose-dim': '#be123c',
        },
      },
      fontFamily: {
        display: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'monospace',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'subtle-grid':
          'linear-gradient(to right, rgba(26, 36, 59, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(26, 36, 59, 0.25) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};

export default config;
