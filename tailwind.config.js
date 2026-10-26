/** @type {import('tailwindcss').Config} */
// Los colores son tokens semánticos respaldados por variables CSS.
// Cada tema (data-theme en <html>) redefine las variables en src/index.css,
// así toda la UI cambia de aspecto sin tocar los componentes.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        sunken: token('sunken'),
        line: token('line'),
        line2: token('line-2'),
        ink: token('ink'),
        ink2: token('ink-2'),
        ink3: token('ink-3'),
        primary: token('primary'),
        primaryhover: token('primary-hover'),
        onprimary: token('on-primary'),
        ongrad: token('on-grad'),
        accent: token('accent'),
        accent2: token('accent-2'),
        gold: token('gold'),
        stpending: token('st-pending'),
        streading: token('st-reading'),
        stread: token('st-read'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        card: 'var(--r-card)',
        btn: 'var(--r-btn)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        pop: 'var(--shadow-pop)',
        book: 'var(--shadow-book)',
      },
    },
  },
  plugins: [],
};
