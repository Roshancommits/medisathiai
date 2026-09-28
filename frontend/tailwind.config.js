/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        med: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6', // primary teal
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontSize: {
        // Accessibility requirement: base font 18px or larger, headings 24px+
        'base': '1.125rem', // 18px
        'lg': '1.25rem',   // 20px
        'xl': '1.5rem',    // 24px
        '2xl': '1.75rem',  // 28px
        '3xl': '2rem',     // 32px
      },
    },
  },
  plugins: [],
}
