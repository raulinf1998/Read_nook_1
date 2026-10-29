import type { Book, JournalEntry } from './types.ts';
import { buildJournalProgressTimeline } from './storyGraphJournal.ts';

/** Una fila por lectura completa. Los libros antiguos sin fecha siguen contando una vez. */
export function completedReadings(book: Book): Book[] {
  const previous = Array.isArray(book.previousReadings) ? book.previousReadings : [];
  const readings = previous.map((reading) => ({ ...book, status: 'read' as const, finishedAt: reading.finishedAt, pages: reading.pages }));
  if (book.status === 'read') readings.push({ ...book, status: 'read', finishedAt: book.finishedAt });
  return readings;
}

/** Inicia una nueva lectura sin alterar ni inventar páginas de la anterior. */
export function startReread(book: Book, now: number, makeId: () => string): Partial<Book> | null {
  if (book.status !== 'read' || !Number.isFinite(now)) return null;
  const entries = [...(book.journal || [])];
  const latest = entries.reduce((max, entry) => Math.max(max, entry.date), 0);
  if (latest >= now || (book.finishedAt && book.finishedAt >= now)) return null;
  const previousReadings = [...(book.previousReadings || []), { finishedAt: book.finishedAt || null, pages: Math.max(0, book.pages || 0) }];
  const timeline = buildJournalProgressTimeline(entries, book.pages);
  const last = timeline.points[timeline.points.length - 1];
  // Si no existía evento de fin, se marca el cierre sin registrar páginas
  // ficticias. El progreso real anterior permanece exactamente como estaba.
  if (last?.entry.kind === 'finished') {
    const index = entries.findIndex((entry) => entry.id === last.entry.id);
    if (index >= 0) entries[index] = { ...entries[index], rereadBoundary: true };
  } else {
    const closing: JournalEntry = { id: makeId(), date: Math.max(latest, book.finishedAt || 0, 1), pages: 0, note: '', kind: 'finished', rereadBoundary: true };
    entries.push(closing);
  }
  entries.push({ id: makeId(), date: now, pages: 0, note: '', kind: 'started', rereadBoundary: true });
  return { previousReadings, journal: entries, status: 'reading', currentPage: 0, startedAt: now, finishedAt: null };
}
