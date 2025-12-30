import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#DC143C',
          light: '#FF1744',
          dark: '#8B0000',
          50: '#FFF0F3',
          100: '#FFD6DE',
          200: '#FFADB8',
          300: '#FF8493',
          400: '#FF5B6D',
          500: '#DC143C',
          600: '#B01030',
          700: '#8B0000',
          800: '#5C0000',
          900: '#2D0000',
        },
        accent: {
          DEFAULT: '#FFD700',
          light: '#FFE44D',
          dark: '#B8860B',
          50: '#FFFDF0',
          100: '#FFF9CC',
          200: '#FFF399',
          300: '#FFEC66',
          400: '#FFE533',
          500: '#FFD700',
          600: '#CCAC00',
          700: '#B8860B',
          800: '#665400',
          900: '#332A00',
        },
        dark: {
          DEFAULT: '#0a0a0a',
          50: '#2a2a2a',
          100: '#1f1f1f',
          200: '#1a1a1a',
          300: '#151515',
          400: '#121212',
          500: '#0f0f0f',
          600: '#0a0a0a',
          700: '#080808',
          800: '#050505',
          900: '#000000',
          card: '#141414',
          elevated: '#1c1c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #DC143C 0%, #FFD700 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%)',
        'hero-gradient': 'linear-gradient(to right, rgba(10,10,10,1) 0%, rgba(10,10,10,0.8) 50%, rgba(10,10,10,0.2) 100%)',
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(220, 20, 60, 0.3)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.3)',
        'glow-red-lg': '0 0 40px rgba(220, 20, 60, 0.4)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 30px rgba(220, 20, 60, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(220, 20, 60, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(220, 20, 60, 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
