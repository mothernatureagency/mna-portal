import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        brand: {
          deep: '#0c6da4',
          mid: '#2e8fc0',
          aqua: '#4ab8ce',
          light: '#86d6e1',
          pale: '#e8f7fa',
          mist: '#f0fafd',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0c6da4 0%, #4ab8ce 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(12,109,164,0.08) 0%, rgba(74,184,206,0.08) 100%)',
        'mesh-light': 'radial-gradient(at 40% 20%, rgba(12,109,164,0.04) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(134,214,225,0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(74,184,206,0.03) 0px, transparent 50%)',
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(74, 184, 206, 0.25)',
        'glow': '0 0 24px rgba(74, 184, 206, 0.3)',
        'glow-deep': '0 0 32px rgba(12, 109, 164, 0.22)',
        'glow-lg': '0 0 48px rgba(12, 109, 164, 0.18)',
        'card': '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 12px 32px rgba(12,109,164,0.05)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06), 0 20px 48px rgba(12,109,164,0.08)',
        'sidebar': '1px 0 0 rgba(0,0,0,0.04)',
        'header': '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)',
        'dropdown': '0 4px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2.5xl': '20px',
        '3xl': '24px',
        '4xl': '32px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
export default config
