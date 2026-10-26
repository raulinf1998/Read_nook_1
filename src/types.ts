export type BookStatus = 'pending' | 'reading' | 'read';
export type BookFormat = 'hardcover' | 'paperback' | 'ebook';
export type BookLanguage = 'es' | 'en';

export interface JournalEntry {
  id: string;
  date: number; // timestamp
  pages: number; // pages read in this session
  note: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  status: BookStatus;
  rating: number; // 0-5, supports halves (e.g. 3.5)
  notes: string;
  createdAt: number;
  pages: number;
  currentPage: number;
  format: BookFormat;
  language: BookLanguage;
  publishDate: string;
  description: string;
  tags: string[];
  isbn: string;
  startedAt: number | null;
  finishedAt: number | null;
  journal: JournalEntry[];
}

/** Clases basadas en tokens del tema (ver index.css): funcionan en los 4 temas y en modo oscuro. */
export const STATUS_META: Record<
  BookStatus,
  { label: string; badge: string; dot: string; activeBtn: string }
> = {
  pending: {
    label: 'Pendiente',
    badge: 'bg-stpending/10 text-stpending',
    dot: 'bg-stpending',
    activeBtn: 'bg-stpending/15 text-stpending ring-1 ring-stpending/30',
  },
  reading: {
    label: 'Leyendo',
    badge: 'bg-streading/10 text-streading',
    dot: 'bg-streading',
    activeBtn: 'bg-streading/15 text-streading ring-1 ring-streading/30',
  },
  read: {
    label: 'Leído',
    badge: 'bg-stread/10 text-stread',
    dot: 'bg-stread',
    activeBtn: 'bg-stread/15 text-stread ring-1 ring-stread/30',
  },
};

export const FORMAT_META: Record<BookFormat, { label: string }> = {
  hardcover: { label: 'Tapa dura' },
  paperback: { label: 'Tapa blanda' },
  ebook: { label: 'Ebook' },
};

export const LANGUAGE_META: Record<BookLanguage, { label: string }> = {
  es: { label: 'Español' },
  en: { label: 'Inglés' },
};

export const DEFAULT_TAGS = [
  'Fantasía', 'Ciencia ficción', 'Thriller', 'Romance', 'Histórica',
  'Misterio', 'Aventura', 'Terror', 'Drama', 'Poesía',
  'Biografía', 'Ensayo', 'Juvenil', 'Clásico', 'Contemporánea',
];

/* ---------- Temas de apariencia ---------- */

export type ThemeId = 'calido' | 'minimal' | 'nocturno' | 'vibrante';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  tagline: string;
  darkOnly?: boolean;
  /** Colores fijos (hex) solo para dibujar la mini-vista previa en el selector. */
  preview: {
    bg: string;
    surface: string;
    line: string;
    ink: string;
    ink2: string;
    primary: string;
    onPrimary: string;
    accent2: string;
    radius: number;
    fontDisplay: string;
  };
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'calido',
    label: 'Rincón cálido',
    tagline: 'Papel, terracota y serif editorial. Como una librería con luz de tarde.',
    preview: {
      bg: '#FAF6EF', surface: '#FFFCF7', line: '#E7DBC7', ink: '#3A2D24', ink2: '#7A6656',
      primary: '#BF5B37', onPrimary: '#FFFAF2', accent2: '#6B865A', radius: 14, fontDisplay: 'Fraunces, Georgia, serif',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    tagline: 'Neutros limpios, acento índigo y mucho aire. Sobrio y profesional.',
    preview: {
      bg: '#FAFAFA', surface: '#FFFFFF', line: '#E5E5E7', ink: '#18181B', ink2: '#52525B',
      primary: '#18181B', onPrimary: '#FAFAFA', accent2: '#4F46E5', radius: 9, fontDisplay: 'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'nocturno',
    label: 'Nocturno',
    tagline: 'Tinta y dorado para leer de noche. Siempre en modo oscuro.',
    darkOnly: true,
    preview: {
      bg: '#0C0E19', surface: '#151828', line: '#2B3049', ink: '#EEEADE', ink2: '#B2B0BF',
      primary: '#C9A24B', onPrimary: '#1D1607', accent2: '#8E9EE0', radius: 12, fontDisplay: 'Fraunces, Georgia, serif',
    },
  },
  {
    id: 'vibrante',
    label: 'Vibrante',
    tagline: 'Violeta, rosa y formas redondeadas. Colorido y con energía.',
    preview: {
      bg: '#F7F5FF', surface: '#FFFFFF', line: '#E2DBFF', ink: '#2E2254', ink2: '#685C8C',
      primary: '#7C3AED', onPrimary: '#FFFFFF', accent2: '#DB2777', radius: 18, fontDisplay: 'Nunito, system-ui, sans-serif',
    },
  },
];
