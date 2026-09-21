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

export const STATUS_META: Record<BookStatus, { label: string; badge: string; badgeDark: string; dot: string; activeBtn: string; activeBtnDark: string }> = {
  pending: {
    label: 'Pendiente',
    badge: 'bg-amber-50 text-amber-700',
    badgeDark: 'dark:bg-amber-500/10 dark:text-amber-400',
    dot: 'bg-amber-400',
    activeBtn: 'bg-amber-100 text-amber-700',
    activeBtnDark: 'dark:bg-amber-500/20 dark:text-amber-300',
  },
  reading: {
    label: 'Leyendo',
    badge: 'bg-blue-50 text-blue-700',
    badgeDark: 'dark:bg-blue-500/10 dark:text-blue-400',
    dot: 'bg-blue-400',
    activeBtn: 'bg-blue-100 text-blue-700',
    activeBtnDark: 'dark:bg-blue-500/20 dark:text-blue-300',
  },
  read: {
    label: 'Leído',
    badge: 'bg-emerald-50 text-emerald-700',
    badgeDark: 'dark:bg-emerald-500/10 dark:text-emerald-400',
    dot: 'bg-emerald-400',
    activeBtn: 'bg-emerald-100 text-emerald-700',
    activeBtnDark: 'dark:bg-emerald-500/20 dark:text-emerald-300',
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
