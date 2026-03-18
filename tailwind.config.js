/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // GJS dark theme backgrounds
        'dark-bg-1': '#07090f',
        'dark-bg-2': '#0b0f1a',
        'dark-bg-3': '#0f1526',
        'dark-bg-4': '#141c33',
        // GJS light theme backgrounds
        'light-bg-1': '#f0f2f5',
        'light-bg-2': '#ffffff',
        'light-bg-3': '#f7f8fa',
        'light-bg-4': '#ebeef3',
        // Accent
        'gjs-blue': '#5eb7f1',
        'gjs-blue-light': '#2563eb',
        // VANT brand
        'vant-navy': '#1B2A7B',
        'vant-orange': '#E8652A',
        // Status
        'status-online': '#34d399',
        'status-offline': '#f87171',
        'status-warning': '#fbbf24',
        'status-syncing': '#fb923c',
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }], // internal labels only — prefer 12px min
        xs: ['12px', { lineHeight: '16px' }],    // label minimum
        sm: ['13px', { lineHeight: '20px' }],    // body minimum
        base: ['14px', { lineHeight: '20px' }],  // interactive elements
      },
    },
  },
  plugins: [],
}
