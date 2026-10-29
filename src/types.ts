export type BookStatus = 'pending' | 'reading' | 'read' | 'dnf';
export type BookFormat = 'hardcover' | 'paperback' | 'ebook' | 'audiobook' | 'other';
/** Código ISO breve preferido (`es`, `en`, `fr`…); admite nombres no reconocidos. */
export type BookLanguage = string;

export type JournalEntryKind =
  | 'progress'
  | 'started'
  | 'finished'
  | 'paused'
  | 'resumed'
  | 'dnf'
  | 'to_read'
  | 'note';

export interface JournalEntry {
  id: string;
  date: number; // timestamp
  pages: number; // pages read in this session
  note: string;
  minutes?: number;
  percent?: number | null;
  cumulativePages?: number | null;
  kind?: JournalEntryKind;
  /** Marca protegida que separa una relectura manual. */
  rereadBoundary?: boolean;
  /** Precisión del cierre sintético cuando no existe diario histórico. */
  datePrecision?: 'year' | 'month' | 'unknown';
  source?: 'storygraph';
  sourceEntryId?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  /** URL externa de origen cuando `coverUrl` apunta a la copia guardada en el servidor. */
  coverSourceUrl?: string;
  /** Imagen real/generada del lomo, si una importación o edición futura la aporta. */
  spineUrl?: string;
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
  /** Nombre de la saga/serie, si el libro forma parte de una. */
  series?: string;
  /** Posición libre dentro de la saga: `1`, `0.5`, `1-6`, etc. */
  seriesPosition?: string;
  storyGraphId?: string;
  startedAt: number | null;
  finishedAt: number | null;
  /** Precisión conocida de la fecha; ausente equivale a día exacto (datos antiguos). */
  finishedAtPrecision?: 'year' | 'month' | 'day' | null;
  journal: JournalEntry[];
  /** Lecturas anteriores completadas; la lectura actual usa status/finishedAt. */
  previousReadings?: { finishedAt: number | null; pages: number; finishedAtPrecision?: 'year' | 'month' | 'day' | null }[];
}

/** Clases basadas en tokens del tema (ver index.css): funcionan en todas las paletas y en modo oscuro. */
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
  dnf: {
    label: 'Abandonado',
    badge: 'bg-danger/10 text-danger',
    dot: 'bg-danger',
    activeBtn: 'bg-danger/15 text-danger ring-1 ring-danger/30',
  },
};

export const FORMAT_META: Record<BookFormat, { label: string }> = {
  hardcover: { label: 'Tapa dura' },
  paperback: { label: 'Tapa blanda' },
  ebook: { label: 'Ebook' },
  audiobook: { label: 'Audiolibro' },
  other: { label: 'Otro' },
};

export function formatLabel(format: BookFormat | string | undefined): string {
  return FORMAT_META[format as BookFormat]?.label || 'Otro';
}

export const LANGUAGE_META: Record<string, { label: string }> = {
  es: { label: 'Español' },
  en: { label: 'Inglés' },
  ca: { label: 'Catalán' },
  eu: { label: 'Euskera' },
  gl: { label: 'Gallego' },
  pt: { label: 'Portugués' },
  fr: { label: 'Francés' },
  de: { label: 'Alemán' },
  it: { label: 'Italiano' },
  nl: { label: 'Neerlandés' },
  sv: { label: 'Sueco' },
  no: { label: 'Noruego' },
  da: { label: 'Danés' },
  fi: { label: 'Finés' },
  pl: { label: 'Polaco' },
  cs: { label: 'Checo' },
  hu: { label: 'Húngaro' },
  ro: { label: 'Rumano' },
  el: { label: 'Griego' },
  ru: { label: 'Ruso' },
  uk: { label: 'Ucraniano' },
  tr: { label: 'Turco' },
  ar: { label: 'Árabe' },
  he: { label: 'Hebreo' },
  hi: { label: 'Hindi' },
  ja: { label: 'Japonés' },
  zh: { label: 'Chino' },
  ko: { label: 'Coreano' },
  id: { label: 'Indonesio' },
  vi: { label: 'Vietnamita' },
  th: { label: 'Tailandés' },
  other: { label: 'Otro' },
};

export function languageLabel(language: BookLanguage | undefined): string {
  const code = (language || '').trim().toLowerCase();
  if (!code) return 'Sin idioma';
  if (LANGUAGE_META[code]) return LANGUAGE_META[code].label;
  try {
    const label = new Intl.DisplayNames(['es'], { type: 'language' }).of(code);
    if (label && label.toLowerCase() !== code) return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    /* El código puede ser un nombre libre guardado por una importación antigua. */
  }
  return code.charAt(0).toUpperCase() + code.slice(1);
}

export function languageOptions(current?: BookLanguage): { code: string; label: string }[] {
  const options = Object.entries(LANGUAGE_META).map(([code, meta]) => ({ code, label: meta.label }));
  const code = (current || '').trim().toLowerCase();
  if (code && !options.some((option) => option.code === code)) {
    options.push({ code, label: languageLabel(code) });
  }
  return options;
}

export function seriesLabel(book: Pick<Book, 'series' | 'seriesPosition'>): string {
  const series = (book.series || '').trim();
  if (!series) return '';
  const position = (book.seriesPosition || '').trim().replace(/^#\s*/, '');
  return position ? `${series} · #${position}` : series;
}

export const DEFAULT_TAGS = [
  'Fantasía', 'Ciencia ficción', 'Thriller', 'Romance', 'Histórica',
  'Misterio', 'Aventura', 'Terror', 'Drama', 'Poesía',
  'Biografía', 'Ensayo', 'Juvenil', 'Clásico', 'Contemporánea',
];

/* ---------- Temas de apariencia ---------- */

export type ThemeId =
  | 'calido'
  | 'minimal'
  | 'nocturno'
  | 'vibrante'
  | 'oceano'
  | 'bosque'
  | 'atardecer'
  | 'lavanda';

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

/** Colores semilla de una paleta personalizada. El resto de tokens se derivan. */
export interface PaletteColors {
  bg: string;
  surface: string;
  ink: string;
  primary: string;
  accent: string;
  accent2: string;
}

export interface CustomPalette {
  id: string;
  name: string;
  /** Tema integrado que aporta tipografía, radios y sombras. */
  baseTheme: ThemeId;
  light: PaletteColors;
  dark: PaletteColors;
  createdAt: number;
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
  {
    id: 'oceano',
    label: 'Océano',
    tagline: 'Azul claro, espuma y turquesa. Fresco como leer frente al mar.',
    preview: {
      bg: '#EEF8FF', surface: '#FFFFFF', line: '#CBE8F7', ink: '#12324A', ink2: '#527A94',
      primary: '#0284C7', onPrimary: '#FFFFFF', accent2: '#0F766E', radius: 17, fontDisplay: 'Inter, system-ui, sans-serif',
    },
  },
  {
    id: 'bosque',
    label: 'Bosque',
    tagline: 'Verdes botánicos y dorados suaves para perderse entre páginas.',
    preview: {
      bg: '#F2F7ED', surface: '#FCFEF9', line: '#D4E4C3', ink: '#23351F', ink2: '#5F7458',
      primary: '#3F7A3A', onPrimary: '#FFFFFF', accent2: '#B7791F', radius: 16, fontDisplay: 'Fraunces, Georgia, serif',
    },
  },
  {
    id: 'atardecer',
    label: 'Atardecer',
    tagline: 'Coral, ámbar y ciruela. Cálido, expresivo y muy lector.',
    preview: {
      bg: '#FFF4E8', surface: '#FFFBF5', line: '#F6D7C3', ink: '#4A2718', ink2: '#8A6351',
      primary: '#E4572E', onPrimary: '#FFFFFF', accent2: '#D97706', radius: 19, fontDisplay: 'Fraunces, Georgia, serif',
    },
  },
  {
    id: 'lavanda',
    label: 'Lavanda',
    tagline: 'Lilas suaves con rosa y menta. Delicado, luminoso y tranquilo.',
    preview: {
      bg: '#F5F1FF', surface: '#FFFFFF', line: '#DED2FA', ink: '#35245E', ink2: '#74658F',
      primary: '#7C5CDB', onPrimary: '#FFFFFF', accent2: '#DB6FA5', radius: 21, fontDisplay: 'Nunito, system-ui, sans-serif',
    },
  },
];
