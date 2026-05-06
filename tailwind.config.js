export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
      },
      // Mejorar líneas para mejor contrast
      borderColor: {
        DEFAULT: '#d1d5db', // Gris medio (mejor contrast que antes)
      },
      // Animaciones para UX mejorado
      keyframes: {
        in: {
          'from': { opacity: '0', transform: 'translateY(4px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        in: 'in 0.2s ease-out',
      }
    },
  },
  plugins: [],
}