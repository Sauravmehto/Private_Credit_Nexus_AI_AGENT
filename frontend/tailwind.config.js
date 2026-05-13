/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        nb: {
          DEFAULT: '#050d1a',
          9: '#0a1628',
          8: '#0f2044',
          7: '#162d5e',
          6: '#1e3f7a',
          5: '#2756a3',
          4: '#3d72c8',
          3: '#6696db',
          2: '#9bbae8',
          1: '#cddaf4',
          0: '#eaf0fb',
        },
        acc: '#4f9cf9',
      },
    },
  },
  plugins: [],
}
