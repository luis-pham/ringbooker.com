import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#8B5CF6',
        },
        ink: '#111827',
        muted: '#6B7280',
        lavender: '#8B5CF6',
        lilac: '#EDE9FE',
        pearl: '#F9FAFB',
        rosewash: '#FDF2F8',
        mint: '#10B981',
        danger: '#EF4444',
        skywash: '#EEF2FF',
      },
      borderRadius: {
        xl2: '1.5rem',
        xl3: '2rem',
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Mona Sans Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 16px 48px rgba(17, 24, 39, 0.08)',
        card: '0 20px 60px rgba(17, 24, 39, 0.08)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(ellipse 80% 55% at 50% 0%, #ede9fe 0%, #fdf2f8 45%, #ffffff 72%)',
      },
    },
  },
  plugins: [typography],
};

export default config;
