/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        'canvas-white':   '#FFFFFF',
        'brand-blue':     '#2563EB',
        'blue-highlight': '#EFF6FF',
        'blue-tint-medium': '#BFDBFE',
        'blue-tint-light':  '#DBEAFE',
        'deep-blue':      '#1D4ED8',
        'darkest-blue':   '#1E3A8A',
        'dark-zinc':      '#52525B',
        'mist-grey':      '#F4F4F5',
        'medium-grey':    '#A1A1AA',
        'light-border':   '#E4E4E7',
        'border-grey':    '#D4D4D8',
      },
    },
  },
  plugins: [],
};
