/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        titan: {
          bg:      '#0a0a0f',
          surface: '#111118',
          card:    '#161622',
          border:  '#1e1e2e',
          accent:  '#6c63ff',
          glow:    '#8b83ff',
          text:    '#e2e2f0',
          muted:   '#6b6b8a',
          classic: '#22d3ee',
          ai:      '#a78bfa',
          hybrid:  '#34d399',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body:    ['var(--font-inter)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-in':   'slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':    'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeUp:    { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 20px rgba(108,99,255,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(108,99,255,0.6)' } },
        slideIn:   { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 40L40 0M0 0l40 40' stroke='%231e1e2e' stroke-width='0.5'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
