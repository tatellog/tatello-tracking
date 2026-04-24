/** @type {import('tailwindcss').Config} */

/*
 * Tailwind exposes only SEMANTIC tokens as utilities. Primitive tokens live in
 * global.css and must be accessed through a semantic alias. This keeps usage
 * intent-driven (`bg-canvas`, `text-primary`) rather than literal (`bg-ivory-50`).
 *
 * Dark mode is class-based (toggled via NativeWind's colorScheme), driven by
 * the user's explicit preference stored in Zustand (see `design/theme.ts`).
 * The `.dark:root` block in global.css swaps the primitive→semantic mapping;
 * no `dark:` variant classes needed in the JSX.
 *
 * Typography pairs Fraunces (serif, editorial voice) with Geist (sans, UI
 * breath). React Native loads each weight/style as its own family, so
 * `font-serif-italic` maps to Fraunces Italic (not the CSS `italic` property).
 */

const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './design/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    fontSize: {
      xs: '11px',
      sm: '13px',
      base: '15px',
      lg: '18px',
      xl: '22px',
      '2xl': '28px',
      '3xl': '34px',
      '4xl': '44px',
      '5xl': '56px',
      '6xl': '72px',
    },
    fontFamily: {
      sans: ['Geist_400Regular'],
      'sans-medium': ['Geist_500Medium'],
      serif: ['Fraunces_400Regular'],
      'serif-italic': ['Fraunces_400Regular_Italic'],
      'serif-medium': ['Fraunces_500Medium'],
    },
    letterSpacing: {
      tight: '-0.01em',
      normal: '0',
      wide: '0.05em',
      editorial: '0.12em',
    },
    extend: {
      backgroundColor: {
        canvas: rgbVar('--surface-canvas'),
        paper: rgbVar('--surface-paper'),
        raised: rgbVar('--surface-raised'),
        sunken: rgbVar('--surface-sunken'),

        'accent-warm': rgbVar('--accent-warm'),
        'accent-warm-soft': rgbVar('--accent-warm-soft'),
        'accent-cool': rgbVar('--accent-cool'),
        'accent-cool-soft': rgbVar('--accent-cool-soft'),
      },
      textColor: {
        primary: rgbVar('--content-primary'),
        secondary: rgbVar('--content-secondary'),
        tertiary: rgbVar('--content-tertiary'),
        disabled: rgbVar('--content-disabled'),
        'on-accent': rgbVar('--content-on-accent'),

        'accent-warm': rgbVar('--accent-warm'),
        'accent-warm-strong': rgbVar('--accent-warm-strong'),
        'accent-warm-contrast': rgbVar('--accent-warm-contrast'),
        'accent-cool': rgbVar('--accent-cool'),
        'accent-cool-strong': rgbVar('--accent-cool-strong'),
        'accent-cool-contrast': rgbVar('--accent-cool-contrast'),
      },
      borderColor: {
        DEFAULT: rgbVar('--border-subtle'),
        subtle: rgbVar('--border-subtle'),
        muted: rgbVar('--border-muted'),
        strong: rgbVar('--border-strong'),
        'accent-warm': rgbVar('--accent-warm'),
        'accent-cool': rgbVar('--accent-cool'),
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
}
