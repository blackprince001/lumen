/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        // DESIGN.md typography scale
        'micro': ['0.6875rem', { lineHeight: '1.4em', fontWeight: '500' }],
        'caption': ['0.8125rem', { lineHeight: '1.4em', fontWeight: '500', letterSpacing: '0.02em' }],
        'body': ['0.9375rem', { lineHeight: '1.4em', fontWeight: '500' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.5em', fontWeight: '400' }],
        'btn-sm': ['0.9375rem', { lineHeight: '1.4em', fontWeight: '500' }],
        'btn': ['1rem', { lineHeight: '1.75em', fontWeight: '500' }],
        'btn-lg': ['1.3125rem', { lineHeight: '1.4em', fontWeight: '500' }],
        'subsection': ['1.3125rem', { lineHeight: '1.4em', fontWeight: '500' }],
        'page-title': ['1.625rem', { lineHeight: '1.4em', fontWeight: '700', letterSpacing: '-0.01em' }],
        'section-title': ['2rem', { lineHeight: '1.3em', fontWeight: '700', letterSpacing: '-0.01em' }],
        'display': ['2.5rem', { lineHeight: '1.3em', fontWeight: '700', letterSpacing: '-0.02em' }],
        'code': ['0.875rem', { lineHeight: '1.5em', fontWeight: '400' }],
        'subheading': ['1.1875rem', { lineHeight: '1.4em', fontWeight: '600' }],
        'stat': ['1.8125rem', { lineHeight: '1.2em', fontWeight: '700' }],
      },
      colors: {
        // All theme-aware via CSS variables
        'forest-black': 'var(--forest-black)',
        'true-black': 'var(--true-black)',
        'deep-forest': 'var(--deep-forest)',

        'mint': 'var(--mint-green)',
        'sky': 'var(--sky-blue)',
        'sky-hover': 'var(--light-blue)',
        'coral': 'var(--coral-red)',

        'near-black': 'var(--near-black)',
        'charcoal': 'var(--charcoal)',
        'dark-gray': 'var(--dark-gray)',
        'mid-gray': 'var(--mid-gray)',
        'cool-gray': 'var(--cool-gray)',

        'off-white': 'var(--off-white)',
        'light-gray': 'var(--light-gray)',
        'border-gray': 'var(--border-gray)',
        'card-surface': 'var(--card-surface)',

        'error': 'var(--error-red)',
        'success': 'var(--success-green)',



        'banner': 'var(--banner-bg)',
        'banner-border': 'var(--banner-border)',

        // Tailwind semantic
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      borderRadius: {
        // DESIGN.md radius scale
        'badge': '4px',
        'button': '6px',
        'interactive': '8px',
        'banner': '12px',
        'card': '16px',
        'pill': '9999px',
      },
      spacing: {
        // DESIGN.md spacing system (base: 4px)
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
      },
      width: {
        'sidebar': '220px',
        'sidebar-collapsed': '60px',
        'content-max': '1160px',
        'main-content': '940px',
      },
      maxWidth: {
        'content': '1160px',
        'main': '940px',
      },
      boxShadow: {
        'inset-btn': 'var(--shadow-inset)',
        'inset-btn-hover': 'var(--shadow-inset-hover)',
        'subtle': 'var(--shadow-subtle)',
        'elevated': 'var(--shadow-elevated)',
        'modal': 'var(--shadow-modal)',
        'focus-ring': 'var(--shadow-focus)',
      },
      keyframes: {
        'slide-in-from-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-to-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        'slide-in-left': 'slide-in-from-left 300ms ease-out',
        'slide-out-left': 'slide-out-to-left 300ms ease-out',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 200ms ease-out',
      },
    },
  },
  plugins: [],
};
