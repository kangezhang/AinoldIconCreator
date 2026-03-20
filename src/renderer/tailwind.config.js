/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        editor: {
          bg:       '#1e1e1e',
          surface:  '#252525',
          panel:    '#2b2b2b',
          toolbar:  '#323232',
          border:   '#3d3d3d',
          divider:  '#404040',
          hover:    '#3a3a3a',
          active:   '#4a4a4a',
          text:     '#cccccc',
          dim:      '#888888',
          accent:   '#4a9eff',
          danger:   '#e05555',
          success:  '#4ade80',
        },
      },
    },
  },
  plugins: [],
}
