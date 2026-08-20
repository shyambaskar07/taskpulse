/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#090d16',
        darkCard: '#111827',
        darkBorder: '#1f293d',
        accentCyan: '#06b6d4',
        accentViolet: '#8b5cf6',
        accentEmerald: '#10b981',
        accentRose: '#f43f5e',
        accentAmber: '#f59e0b'
      }
    },
  },
  plugins: [],
}
