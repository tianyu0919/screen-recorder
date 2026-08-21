/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0c',
        surface: { 1: '#121215', 2: '#1a1a1f', 3: '#24242a' },
        line: { DEFAULT: 'rgba(255,255,255,0.08)', strong: 'rgba(255,255,255,0.14)' },
        ink: { 1: '#f5f5f6', 2: '#a3a3ab', 3: '#5d5d66' },
        accent: {
          DEFAULT: '#ff5c38',
          hover: '#ff6f4e',
          soft: 'rgba(255,92,56,0.14)',
          border: 'rgba(255,92,56,0.5)'
        }
      }
    }
  },
  plugins: []
}
