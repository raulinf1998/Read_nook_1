import type { Book } from './types.ts';

/** Clave comparable de una saga: sin acentos, mayúsculas ni espacios sobrantes. */
export function normalizeSeriesKey(value: string | undefined | null): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Primer número útil de una posición libre (`#0.5`, `1`, `1-6`…). */
export function seriesPositionValue(value: string | undefined | null): number {
  const match = String(value || '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function bookSeriesPositionValue(book: Pick<Book, 'seriesPosition'>): number {
  return seriesPositionValue(book.seriesPosition);
}

function publishSortValue(book: Book): string {
  return (book.publishDate || '9999').trim();
}

/** Orden de lectura: número dentro de la saga y, si falta, publicación/título. */
export function sortSeriesBooks(books: Book[]): Book[] {
  return [...books].sort((a, b) => (
    bookSeriesPositionValue(a) - bookSeriesPositionValue(b)
    || publishSortValue(a).localeCompare(publishSortValue(b), 'es')
    || (a.startedAt || a.createdAt) - (b.startedAt || b.createdAt)
    || a.title.localeCompare(b.title, 'es')
  ));
}

export interface SeriesGroup {
  key: string;
  name: string;
  books: Book[];
}

/** Agrupa variantes del mismo nombre (`Huesos Verdes`, `huesos verdes`…). */
export function groupBooksBySeries(books: Book[]): SeriesGroup[] {
  const buckets = new Map<string, Book[]>();
  for (const book of books || []) {
    const key = normalizeSeriesKey(book.series);
    if (!key) continue;
    buckets.set(key, [...(buckets.get(key) || []), book]);
  }

  return [...buckets.entries()]
    .map(([key, groupBooks]) => {
      const sortedBooks = sortSeriesBooks(groupBooks);
      const nameCounts = new Map<string, { count: number; firstIndex: number }>();
      sortedBooks.forEach((book, index) => {
        const name = (book.series || '').trim().replace(/\s+/g, ' ');
        if (!name) return;
        const current = nameCounts.get(name);
        nameCounts.set(name, {
          count: (current?.count || 0) + 1,
          firstIndex: current?.firstIndex ?? index,
        });
      });
      const name = [...nameCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex)[0]?.[0]
        || sortedBooks[0]?.series?.trim()
        || '';

      return {
        key,
        name,
        books: sortedBooks,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function findSeriesGroup(books: Book[], requestedName: string | undefined | null): SeriesGroup | null {
  const key = normalizeSeriesKey(requestedName);
  if (!key) return null;
  return groupBooksBySeries(books).find((group) => group.key === key) || null;
}

function integerPositionsCovered(book: Pick<Book, 'seriesPosition'>): number[] {
  const raw = String(book.seriesPosition || '').trim().replace(/^#\s*/, '').replace(',', '.');
  const range = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const start = Number.parseInt(range[1], 10);
    const end = Number.parseInt(range[2], 10);
    if (start >= 1 && end >= start && end - start <= 200) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return [];
  }

  const single = raw.match(/^(\d+)$/);
  return single ? [Number.parseInt(single[1], 10)] : [];
}

/**
 * Huecos enteros detectables a partir de las posiciones que sí tienes.
 * No pretende afirmar cuántos libros tiene la saga en el mundo real.
 */
export function missingSeriesPositions(books: Book[]): number[] {
  const covered = new Set<number>();
  for (const book of books) {
    for (const position of integerPositionsCovered(book)) covered.add(position);
  }
  if (!covered.size) return [];
  const max = Math.max(...covered);
  const missing: number[] = [];
  for (let position = 1; position <= max; position += 1) {
    if (!covered.has(position)) missing.push(position);
  }
  return missing;
}

export function seriesBookProgress(book: Book): number {
  if (book.status === 'read') return 100;
  if (book.pages <= 0) return 0;
  return Math.min(Math.max((book.currentPage / book.pages) * 100, 0), 100);
}

/** Siguiente lectura lógica de la saga dentro de tu biblioteca. */
export function nextSeriesBook(books: Book[]): Book | null {
  const sorted = sortSeriesBooks(books);
  return sorted.find((book) => book.status === 'reading')
    || sorted.find((book) => book.status === 'pending')
    || null;
}
