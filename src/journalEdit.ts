import type { Book, JournalEntry, JournalOverrideField } from './types.ts';
import { buildJournalProgressTimeline } from './storyGraphJournal.ts';

export interface JournalEditValues {
  date: number;
  dateChanged: boolean;
  pages: number;
  minutes: number;
  note: string;
  /** null si el registro no representa un punto de progreso. */
  reachedPage: number | null;
}

/** Mantiene los IDs, las fronteras de relectura y los datos no editados. */
export function editJournalEntry(book: Book, entries: JournalEntry[], id: string, values: JournalEditValues): { patch?: Partial<Book>; error?: string } {
  const original = entries.find((entry) => entry.id === id);
  if (!original) return { error: 'Este registro ya no existe.' };
  if (!Number.isFinite(values.date) || !Number.isInteger(values.pages) || values.pages < 0 || !Number.isInteger(values.minutes) || values.minutes < 0 || (values.reachedPage !== null && (!Number.isInteger(values.reachedPage) || values.reachedPage < 0 || (book.pages > 0 && values.reachedPage > book.pages)))) return { error: 'Comprueba la fecha y los números introducidos.' };
  const oldTimeline = buildJournalProgressTimeline(entries, book.pages, book.currentPage);
  const point = oldTimeline.points.find((item) => item.entry.id === id);
  if (!point) return { error: 'No se pudo localizar el registro en el diario.' };
  if (original.rereadBoundary && (values.dateChanged || values.pages !== original.pages || values.reachedPage !== (point.isProgressPoint ? point.cumulativePages : null))) return { error: 'Esta entrada separa dos lecturas: solo se pueden editar su nota y minutos para conservar el historial.' };
  if (original.kind === 'finished' && values.reachedPage !== (point.isProgressPoint ? point.cumulativePages : null)) return { error: 'La posición de un registro de fin debe coincidir con el final del libro.' };

  const changed = new Set<JournalOverrideField>(original.manualOverrides || []);
  const updated: JournalEntry = { ...original };
  if (values.dateChanged) { updated.date = values.date; delete updated.datePrecision; changed.add('date'); changed.add('datePrecision'); }
  if (values.pages !== (original.pages || 0)) { updated.pages = values.pages; changed.add('pages'); }
  if (values.minutes !== (original.minutes || 0)) { updated.minutes = values.minutes; changed.add('minutes'); }
  if (values.note !== (original.note || '')) { updated.note = values.note; changed.add('note'); }
  const targetChanged = values.reachedPage !== (point.isProgressPoint ? point.cumulativePages : null);
  // Al corregir páginas de sesión no se inventa una posición distinta a la que
  // ya se mostraba. La posición alcanzada se puede corregir por separado.
  if ((targetChanged || values.pages !== (original.pages || 0)) && point.isProgressPoint && values.reachedPage !== null && original.kind !== 'finished') {
    updated.cumulativePages = values.reachedPage;
    updated.percent = book.pages > 0 ? Math.round(values.reachedPage / book.pages * 1000) / 10 : null;
    changed.add('cumulativePages'); changed.add('percent');
  }
  const isCurrentLast = point.segmentIndex === oldTimeline.currentSegmentIndex
    && !oldTimeline.points.slice(oldTimeline.points.indexOf(point) + 1).some((item) => item.segmentIndex === point.segmentIndex && item.isProgressPoint);
  const finishesCurrent = targetChanged && isCurrentLast && Math.abs(oldTimeline.currentPage - book.currentPage) <= 1
    && book.status === 'reading' && book.pages > 0 && values.reachedPage === book.pages;
  if (finishesCurrent) { updated.kind = 'finished'; changed.add('kind'); }
  if (original.source === 'storygraph' && changed.size) updated.manualOverrides = [...changed];

  const nextEntries = entries.map((entry) => entry.id === id ? updated : entry).sort((a, b) => b.date - a.date);
  const nextTimeline = buildJournalProgressTimeline(nextEntries, book.pages, book.currentPage);
  const segments = new Map(oldTimeline.points.map((item) => [item.entry.id, item.segmentIndex]));
  if (nextTimeline.points.some((item) => segments.get(item.entry.id) !== item.segmentIndex)) return { error: 'Ese cambio alteraría el orden de las lecturas o de los avances. Comprueba la fecha y la página alcanzada.' };
  if (targetChanged) {
    const nextPoint = nextTimeline.points.find((item) => item.entry.id === id);
    if (nextPoint?.cumulativePages !== values.reachedPage) return { error: 'La página alcanzada no es compatible con el historial de avances.' };
  }

  const patch: Partial<Book> = { journal: nextEntries };
  if (targetChanged && Math.abs(oldTimeline.currentPage - book.currentPage) <= 1) patch.currentPage = nextTimeline.currentPage;
  if (finishesCurrent) { patch.status = 'read'; patch.finishedAt = updated.datePrecision === 'unknown' ? null : updated.date; patch.finishedAtPrecision = updated.datePrecision === 'unknown' ? null : updated.datePrecision || 'day'; }
  if (values.dateChanged && original.kind === 'started' && book.startedAt === original.date) patch.startedAt = values.date;
  if (values.dateChanged && original.kind === 'finished') {
    const previous = book.previousReadings || [];
    const indexes = previous.map((reading, index) => reading.finishedAt === original.date ? index : -1).filter((index) => index >= 0);
    const currentMatch = book.status === 'read' && book.finishedAt === original.date;
    if (indexes.length + Number(currentMatch) !== 1) return { error: 'No se puede vincular esta fecha de fin con una lectura concreta. Cambia la fecha de finalización desde la ficha del libro.' };
    if (currentMatch) { patch.finishedAt = values.date; patch.finishedAtPrecision = 'day'; }
    else patch.previousReadings = previous.map((reading, index) => index === indexes[0] ? { ...reading, finishedAt: values.date, finishedAtPrecision: 'day' } : reading);
  }
  return { patch };
}
