import type { Book } from './types.ts';
import { completedReadings } from './rereads.ts';

export type WrapPeriod = { year: number; month: number | null };

function inPeriod(timestamp: number | null | undefined, precision: string | null | undefined, period: WrapPeriod): boolean {
  if (!timestamp || !Number.isFinite(timestamp) || precision === 'unknown') return false;
  const date = new Date(timestamp);
  return date.getFullYear() === period.year && (period.month === null || (precision !== 'year' && date.getMonth() === period.month));
}

/** Finalizaciones y actividad del diario son métricas distintas: no se inventan páginas leídas. */
export function buildWrapUp(books: Book[], period: WrapPeriod) {
  const readings = books.flatMap(completedReadings).filter(book => inPeriod(book.finishedAt, book.finishedAtPrecision, period));
  const sorted = [...readings].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0) || a.title.localeCompare(b.title, 'es'));
  const covers = Array.from(new Map(sorted.map(reading => [reading.id, reading])).values());
  const ratings = readings.map(book => book.rating).filter(rating => Number.isFinite(rating) && rating > 0);
  const authors = new Set(readings.map(book => book.author?.trim().toLocaleLowerCase('es')).filter(Boolean));
  let journalPages = 0;
  for (const book of books) for (const entry of book.journal || []) {
    if (inPeriod(entry.date, entry.datePrecision, period) && Number.isFinite(entry.pages)) journalPages += Math.max(0, entry.pages);
  }
  return { readings, covers, journalPages, authors: authors.size, averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null };
}

export function wrapUpYears(books: Book[], currentYear = new Date().getFullYear()): number[] {
  const years = new Set([currentYear]);
  for (const book of books) {
    for (const reading of completedReadings(book)) if (reading.finishedAt && Number.isFinite(reading.finishedAt)) years.add(new Date(reading.finishedAt).getFullYear());
    for (const entry of book.journal || []) if (entry.datePrecision !== 'unknown' && entry.date > 0 && Number.isFinite(entry.date)) years.add(new Date(entry.date).getFullYear());
  }
  return [...years].sort((a, b) => b - a);
}
