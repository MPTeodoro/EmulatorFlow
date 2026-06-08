/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx}',
    './electron/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0d1117',
          secondary: '#161b22',
          tertiary: '#1c2128',
          hover: '#21262d',
        },
        border: {
          DEFAULT: '#30363d',
          light: '#3d444d',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
          muted: '#484f58',
        },
        accent: {
          purple: '#a855f7',
          blue: '#3b82f6',
          green: '#22c55e',
          red: '#ef4444',
          orange: '#f97316',
          yellow: '#eab308',
        },
      },
    },
  },
  plugins: [],
};
