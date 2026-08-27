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
        sans: ['Inter', 'sans-serif'],
        accent: ['Nimbus Sans', 'sans-serif'],
      },
      colors: {
        'deep-navy': '#020408',
        'dark-navy': '#0F1524',
        'dark-slate': '#0F131F',
        'card-dark': '#1B1F2C',
        'card-dark-alt': '#262A37',
        'light-lavender': '#DFE2F3',
        'pipeline': '#313442',
        'ice-blue': '#7DD3FC',
        'light-ice': '#C5EAFF',
        'coral-red': '#FFB4AB',
        'muted-red': '#93000A',
        'amber': '#FEBC60',
        'cool-gray': '#BEC8CE',
      },
      boxShadow: {
        'hero-text': '0 25px 25px rgba(0,0,0,0.15)',
        'card-dark': '0 4px 30px rgba(0,0,0,0.50)',
        'card-light': '0 4px 30px rgba(0,0,0,0.05)',
        'subtle': '0 1px 1px rgba(0,0,0,0.05)',
        'heading': '0 10px 8px rgba(0,0,0,0.04), 0 4px 3px rgba(0,0,0,0.10)',
        'nav': '0 25px 50px -12px rgba(0,0,0,0.25)',
        'glow-active-icon': '0 0 15px rgba(125,211,252,0.80)',
        'glow-revenue': '0 0 25px rgba(125,211,252,0.60)',
        'glow-revenue-card': '0 0 50px rgba(125,211,252,0.15)',
        'glow-failure': '0 0 20px rgba(255,180,171,0.40)',
        'glow-analysis': '0 0 20px rgba(197,234,255,0.40)',
        'glow-predict': '0 0 20px rgba(125,211,252,0.40)',
        'glow-schedule': '0 0 20px rgba(254,188,96,0.40)',
        'glow-recovered': '0 0 15px rgba(125,211,252,0.80)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(to bottom, rgba(15,21,36,0.40) 0%, rgba(15,21,36,0.80) 50%, rgba(223,226,243,1.00) 100%)',
        'problem-gradient': 'linear-gradient(to bottom, rgba(223,226,243,1.00) 0%, rgba(223,226,243,0.90) 50%, rgba(15,21,36,1.00) 100%)',
        'experience-gradient': 'linear-gradient(to top, rgba(2,4,8,1.00) 0%, rgba(223,226,243,0.80) 50%, rgba(15,19,31,1.00) 100%)',
      },
      backdropBlur: {
        '12': '12px',
        '16': '16px',
        '24': '24px',
      }
    },
  },
  plugins: [],
}

export default config