/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0f14',
        panel: '#0f141b',
        accent: '#7aa2f7',
        muted: '#94a3b8',
        danger: '#f7768e',
        success: '#9ece6a',
        border: '#1f2630',
      },
    },
  },
  plugins: [],
};
