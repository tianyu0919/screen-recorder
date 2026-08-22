/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 色板定义在 index.css 的 CSS 变量（:root / [data-theme]），此处只做映射以支持主题切换
        base: 'var(--base)',
        surface: { 1: 'var(--surface-1)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: { 1: 'var(--ink-1)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          border: 'var(--accent-border)'
        },
        'on-accent': 'var(--on-accent)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        canvas: { DEFAULT: 'var(--canvas)', raised: 'var(--canvas-raised)' }
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)'
      }
    }
  },
  plugins: []
}
