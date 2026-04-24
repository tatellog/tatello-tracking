/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    fontSize: {
      xs: '11px',
      sm: '13px',
      base: '15px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '4xl': '36px',
      '6xl': '56px',
    },
    extend: {
      backgroundColor: {
        primary: 'rgb(var(--bg-primary) / <alpha-value>)',
        secondary: 'rgb(var(--bg-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--bg-tertiary) / <alpha-value>)',
      },
      textColor: {
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
      },
      borderColor: {
        DEFAULT: 'rgb(var(--border-default) / <alpha-value>)',
        muted: 'rgb(var(--border-muted) / <alpha-value>)',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
