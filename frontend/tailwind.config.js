/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode is opt-in via the `dark` class on <html>. ThemeProvider in
  // src/core/theme/ToggleTheme.jsx is responsible for adding/removing it
  // based on localStorage + system preference.
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // ── Body font ─────────────────────────────────────────────────────
        // Inter for all running text (paragraphs, lists, controls, table
        // cells). Plain, neutral, high legibility at small sizes.
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // ── Display font ──────────────────────────────────────────────────
        // Plus Jakarta Sans for headings + hero copy via `font-display`.
        // Matches the design-system reference pages.
        display: ['Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
        // Numbers, eyebrows, kbd shortcuts.
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── PRIMARY — Orange (buttons + CTAs + active states) ─────────────
        // Anchor 500 (#f97316). Per design-system reference card.
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // ── SECONDARY — Violet (supporting accent, gradients, chips) ──────
        // Anchor 700 (#6d28d9). Same palette as before; renamed from `primary`.
        secondary: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // ── Aliases for clarity in JSX ────────────────────────────────────
        // `accent` keeps working anywhere it's used today (= orange = primary
        // now). `violet` is an explicit name for places that should stay
        // violet regardless of palette flips (logo gradient, etc.).
        accent: {
          50:  '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12',
        },
        violet: {
          50:  '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065',
        },
      },
      backgroundImage: {
        // Brand gradient stays violet→magenta→orange — used only on the logo,
        // hero stages, and accent text. Buttons are now SOLID orange per the
        // design-system reference.
        'brand-gradient':       'linear-gradient(135deg, #6d28d9 0%, #a21caf 45%, #ec4899 70%, #f97316 100%)',
        'brand-gradient-soft':  'linear-gradient(95deg, rgba(109,40,217,.10), rgba(249,115,22,.10))',
      },
      boxShadow: {
        // Orange glow — matches the new primary CTA.
        'brand-glow':  '0 8px 26px -8px rgba(249, 115, 22, .55)',
        // Soft violet glow — for secondary chips that still want the violet feel.
        'violet-glow': '0 8px 26px -8px rgba(109, 40, 217, .35)',
      },
    },
  },
  plugins: [],
};
