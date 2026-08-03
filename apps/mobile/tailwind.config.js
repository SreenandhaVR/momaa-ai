/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',

  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],

  presets: [require('nativewind/preset')],

  theme: {
    extend: {
      colors: {
        primary: '#FFD54F',
        background: '#FFFDF8',
        'background-secondary': '#FFF8E8',
        card: '#FFFFFF',
        section: '#FFF4CC',
        'text-primary': '#2C2C2C',
        'text-secondary': '#6B7280',
        'text-hint': '#9CA3AF',
        success: '#A8D5BA',
        warning: '#FFB84D',
        error: '#F26B6B',
        border: '#ECE7DA',
      },

      borderRadius: {
        card: '24px',
        button: '20px',
        sheet: '32px',
        input: '18px',
      },

      fontFamily: {
        jakarta: ['PlusJakartaSans_400Regular'],
        'jakarta-bold': ['PlusJakartaSans_700Bold'],
      },
    },
  },
};