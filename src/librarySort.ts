import type { Book } from './types';

/** Fecha de la última lectura terminada, también durante una relectura en curso. */
export function latestFinishedAt(book: Book): number | null {
  const dates = [book.finishedAt, ...(book.previousReadings || []).map((reading) => reading.finishedAt)]
    .filter((date): date is number => typeof date === 'number' && Number.isFinite(date) && date > 0);
  return dates.length ? Math.max(...dates) : null;
}

export function compareRecentlyFinished(a: Book, b: Book): number {
  const aFinished = latestFinishedAt(a);
  const bFinished = latestFinishedAt(b);
  if (aFinished === null && bFinished !== null) return 1;
  if (aFinished !== null && bFinished === null) return -1;
  if (aFinished !== null && bFinished !== null && aFinished !== bFinished) return bFinished - aFinished;
  return (b.createdAt || 0) - (a.createdAt || 0);
}
