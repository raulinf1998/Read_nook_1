import type { Book } from './types';

export type ReadingDatePrecision = 'year' | 'month' | 'day';

/** Convierte una fecha parcial a una marca interna sin dar por conocida su precisión. */
export function parseReadingDate(value: string): { timestamp: number; precision: ReadingDatePrecision } | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { timestamp: date.getTime(), precision: match[3] ? 'day' : match[2] ? 'month' : 'year' };
}

export function readingDateInput(timestamp: number | null | undefined, precision?: ReadingDatePrecision | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return precision === 'year' ? year : precision === 'month' ? `${year}-${month}` : `${year}-${month}-${day}`;
}

export function formatReadingDate(book: Pick<Book, 'finishedAt' | 'finishedAtPrecision'>): string {
  if (!book.finishedAt) return '—';
  const date = new Date(book.finishedAt);
  return date.toLocaleDateString('es', book.finishedAtPrecision === 'year' ? { year: 'numeric' } : book.finishedAtPrecision === 'month' ? { month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' });
}
