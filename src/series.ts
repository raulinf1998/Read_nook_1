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

function publishSortValue(book: Book): number {
  return publicationDateValue(book.publishDate);
}

const PUBLICATION_MONTHS: Record<string, number> = {
  enero: 1,
  january: 1,
  jan: 1,
  febrero: 2,
  february: 2,
  feb: 2,
  marzo: 3,
  march: 3,
  mar: 3,
  abril: 4,
  april: 4,
  apr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  june: 6,
  jun: 6,
  julio: 7,
  july: 7,
  jul: 7,
  agosto: 8,
  august: 8,
  aug: 8,
  septiembre: 9,
  setiembre: 9,
  september: 9,
  sep: 9,
  sept: 9,
  octubre: 10,
  october: 10,
  oct: 10,
  noviembre: 11,
  november: 11,
  nov: 11,
  diciembre: 12,
  december: 12,
  dec: 12,
};

function utcDateValue(year: number, month = 1, day = 1): number {
  const safeMonth = month >= 1 && month <= 12 ? month : 1;
  const safeDay = day >= 1 && day <= 31 ? day : 1;
  return Date.UTC(year, safeMonth - 1, safeDay);
}

/**
 * Valor ordenable de una fecha de publicación guardada como año, fecha ISO o
 * texto («2007», «2007-05-01», «1 de mayo de 2007», «May 1, 2007»…). Las
 * fechas desconocidas van al final.
 */
export function publicationDateValue(value: string | undefined | null): number {
  const raw = (value || '').trim();
  if (!raw) return Number.MAX_SAFE_INTEGER;

  const yearFirst = raw.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/);
  if (yearFirst) {
    return utcDateValue(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      yearFirst[3] ? Number(yearFirst[3]) : 1,
    );
  }

  const dayFirst = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dayFirst) {
    return utcDateValue(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  }

  const yearMatch = raw.match(/\b(\d{4})\b/);
  if (!yearMatch) return Number.MAX_SAFE_INTEGER;
  const year = Number(yearMatch[1]);
  const normalized = normalizeSeriesKey(raw);
  const monthEntry = Object.entries(PUBLICATION_MONTHS)
    .find(([name]) => new RegExp(`\\b${name}\\b`).test(normalized));
  if (!monthEntry) return utcDateValue(year);

  const day = (normalized.match(/\b\d{1,2}\b/g) || [])
    .map(Number)
    .find((candidate) => candidate >= 1 && candidate <= 31) || 1;
  return utcDateValue(year, monthEntry[1], day);
}

/** Orden de lectura: número dentro de la saga y, si falta, publicación/título. */
export function sortSeriesBooks(books: Book[]): Book[] {
  return [...books].sort((a, b) => (
    bookSeriesPositionValue(a) - bookSeriesPositionValue(b)
    || publishSortValue(a) - publishSortValue(b)
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

interface AuthorSeriesSortInfo {
  authorKey: string;
  authorName: string;
  authorDate: number;
  isSeries: boolean;
  seriesKey: string;
  seriesName: string;
  seriesDate: number;
}

/**
 * Orden para la opción «Autor · saga · fecha» de Biblioteca.
 *
 * Las sagas de un mismo autor permanecen juntas. Los bloques de autor se
 * ordenan por la primera publicación de sus sagas; dentro de cada autor, las
 * sagas van por su fecha de publicación más antigua y los volúmenes por su
 * número. Los libros sueltos de ese autor quedan después de sus sagas y el
 * autor desconocido va al final. Si se pasa la colección completa como
 * `metadataSource`, la fecha de una saga no cambia aunque el filtro actual
 * oculte su volumen más antiguo.
 */
export function sortBooksByAuthorAndSeries(
  booksToSort: Book[],
  metadataSource: Book[] = booksToSort,
): Book[] {
  const metadataById = new Map<string, Book>();
  for (const book of [...metadataSource, ...booksToSort]) {
    if (book?.id) metadataById.set(book.id, book);
  }
  const metadataBooks = [...metadataById.values()];

  const seriesMeta = new Map<string, {
    name: string;
    primaryAuthorKey: string;
    primaryAuthorName: string;
    earliestDate: number;
  }>();

  for (const group of groupBooksBySeries(metadataBooks)) {
    const authorCounts = new Map<string, { name: string; count: number; firstIndex: number }>();
    group.books.forEach((book, index) => {
      const authorKey = normalizeSeriesKey(book.author);
      if (!authorKey) return;
      const current = authorCounts.get(authorKey);
      authorCounts.set(authorKey, {
        name: current?.name || (book.author || '').trim().replace(/\s+/g, ' '),
        count: (current?.count || 0) + 1,
        firstIndex: current?.firstIndex ?? index,
      });
    });
    const [primaryAuthorKey, primaryAuthor] = [...authorCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].firstIndex - b[1].firstIndex)[0]
      || ['', undefined];

    seriesMeta.set(group.key, {
      name: group.name,
      primaryAuthorKey,
      primaryAuthorName: primaryAuthor?.name || '',
      earliestDate: Math.min(...group.books.map((book) => publicationDateValue(book.publishDate))),
    });
  }

  const authorAnyDate = new Map<string, number>();
  for (const book of metadataBooks) {
    const authorKey = normalizeSeriesKey(book.author);
    if (!authorKey) continue;
    authorAnyDate.set(
      authorKey,
      Math.min(authorAnyDate.get(authorKey) ?? Number.MAX_SAFE_INTEGER, publicationDateValue(book.publishDate)),
    );
  }

  const authorSagaDate = new Map<string, number>();
  for (const meta of seriesMeta.values()) {
    if (!meta.primaryAuthorKey) continue;
    authorSagaDate.set(
      meta.primaryAuthorKey,
      Math.min(authorSagaDate.get(meta.primaryAuthorKey) ?? Number.MAX_SAFE_INTEGER, meta.earliestDate),
    );
  }

  const infoFor = (book: Book): AuthorSeriesSortInfo => {
    const seriesKey = normalizeSeriesKey(book.series);
    const meta = seriesKey ? seriesMeta.get(seriesKey) : undefined;
    const authorKey = meta?.primaryAuthorKey ?? normalizeSeriesKey(book.author);
    return {
      authorKey,
      authorName: meta?.primaryAuthorName || (book.author || '').trim(),
      authorDate: authorSagaDate.get(authorKey)
        ?? authorAnyDate.get(authorKey)
        ?? publicationDateValue(book.publishDate),
      isSeries: Boolean(meta),
      seriesKey,
      seriesName: meta?.name || (book.series || '').trim(),
      seriesDate: meta?.earliestDate ?? publicationDateValue(book.publishDate),
    };
  };

  const infoByBook = new Map(booksToSort.map((book) => [book, infoFor(book)]));

  return [...booksToSort].sort((a, b) => {
    const ai = infoByBook.get(a)!;
    const bi = infoByBook.get(b)!;

    const unknownAuthor = Number(!ai.authorKey) - Number(!bi.authorKey);
    if (unknownAuthor) return unknownAuthor;
    if (ai.authorDate !== bi.authorDate) return ai.authorDate - bi.authorDate;

    if (ai.authorKey !== bi.authorKey) {
      return ai.authorName.localeCompare(bi.authorName, 'es')
        || ai.authorKey.localeCompare(bi.authorKey, 'es');
    }

    const seriesRank = Number(!ai.isSeries) - Number(!bi.isSeries);
    if (seriesRank) return seriesRank;
    if (ai.seriesDate !== bi.seriesDate) return ai.seriesDate - bi.seriesDate;

    const seriesNameOrder = ai.seriesName.localeCompare(bi.seriesName, 'es');
    if (seriesNameOrder) return seriesNameOrder;
    if (ai.seriesKey !== bi.seriesKey) return ai.seriesKey.localeCompare(bi.seriesKey, 'es');

    if (ai.isSeries && bi.isSeries && ai.seriesKey) {
      return bookSeriesPositionValue(a) - bookSeriesPositionValue(b)
        || publicationDateValue(a.publishDate) - publicationDateValue(b.publishDate)
        || (a.startedAt || a.createdAt) - (b.startedAt || b.createdAt)
        || a.title.localeCompare(b.title, 'es');
    }

    return publicationDateValue(a.publishDate) - publicationDateValue(b.publishDate)
      || a.title.localeCompare(b.title, 'es')
      || (a.createdAt || 0) - (b.createdAt || 0);
  });
}
