/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#26312f',
        paper: '#fbfaf6',
        linen: '#f3efe6',
        sage: '#6f8378',
        clay: '#b6785b',
        wheat: '#d8c7a5',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(74, 69, 58, 0.08)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
