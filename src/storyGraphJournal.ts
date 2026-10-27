import type { Book, JournalEntry, JournalEntryKind } from './types';

/**
 * Formato intermedio producido por public/tools/storygraph-journal-exporter.user.js.
 * El importador acepta el JSON generado por el script y también su CSV gemelo.
 */
export interface StoryGraphJournalEntry {
  sourceEntryId: string;
  storyGraphBookId: string;
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  date: string; // YYYY-MM-DD
  pagesRead: number | null;
  pagesTotal: number | null;
  bookPages: number | null;
  percent: number | null;
  minutesListened: number | null;
  minutesTotal: number | null;
  kind: JournalEntryKind;
  note: string;
}

export interface StoryGraphBookMetadata {
  storyGraphBookId: string;
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
}

export interface StoryGraphJournalExport {
  entries: StoryGraphJournalEntry[];
  books: StoryGraphBookMetadata[];
}

export interface StoryGraphUnmatchedBook {
  storyGraphBookId: string;
  isbn: string;
  title: string;
  author: string;
  entries: number;
}

export interface StoryGraphJournalMergeReport {
  totalEntries: number;
  matchedEntries: number;
  unmatchedEntries: number;
  matchedBooks: number;
  addedEntries: number;
  updatedEntries: number;
  unchangedEntries: number;
  importedPages: number;
  importedMinutes: number;
  updatedCovers: number;
  unmatchedBooks: StoryGraphUnmatchedBook[];
}

export interface StoryGraphJournalPatch {
  index: number;
  patch: Partial<Book>;
}

export interface JournalMergeBookLike {
  title: string;
  author: string;
  isbn: string;
  coverUrl?: string;
  storyGraphId?: string;
  pages: number;
  currentPage: number;
  status: Book['status'];
  startedAt: number | null;
  finishedAt: number | null;
  journal: JournalEntry[];
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, enero: 1, ene: 1,
  february: 2, feb: 2, febrero: 2,
  march: 3, mar: 3, marzo: 3,
  april: 4, apr: 4, abril: 4, abr: 4,
  may: 5, mayo: 5,
  june: 6, jun: 6, junio: 6,
  july: 7, jul: 7, julio: 7,
  august: 8, aug: 8, agosto: 8, ago: 8,
  september: 9, sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  october: 10, oct: 10, octubre: 10,
  november: 11, nov: 11, noviembre: 11,
  december: 12, dec: 12, diciembre: 12, dic: 12,
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function firstValue(record: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
}

function pickString(record: UnknownRecord, keys: string[]): string {
  return cleanString(firstValue(record, keys));
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/%$/, '').replace(/\s/g, '');
  if (!text) return null;
  // 1.234 / 1,234 como separador de miles; 42,5 / 42.5 como decimal.
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) text = text.replace(/[.,]/g, '');
  else if (text.includes(',') && !text.includes('.')) text = text.replace(',', '.');
  else text = text.replace(/,/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickNumber(record: UnknownRecord, keys: string[]): number | null {
  return parseNumber(firstValue(record, keys));
}

function normalizeKind(value: unknown): JournalEntryKind {
  const text = cleanString(value).toLowerCase().replace(/[\s-]+/g, '_');
  // DNF va primero: "did_not_finish" también contiene "finish".
  if (/dnf|did_not_finish|stopped|abandon/.test(text)) return 'dnf';
  if (/start|begin/.test(text)) return 'started';
  if (/finish|finished|complete/.test(text)) return 'finished';
  if (/pause/.test(text)) return 'paused';
  if (/resume/.test(text)) return 'resumed';
  if (/to_read|want_to_read/.test(text)) return 'to_read';
  if (/note|quote|comment/.test(text)) return 'note';
  return 'progress';
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseStoryGraphJournalDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const d = new Date(value);
    return toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  const text = cleanString(value);
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));

  match = text.match(/(\d{1,2})(?:\s+de)?\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)(?:\s+de)?\s+(\d{4})/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase().replace(/\.$/, '')];
    if (month) return toIsoDate(Number(match[3]), month, Number(match[1]));
  }

  match = text.match(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase().replace(/\.$/, '')];
    if (month) return toIsoDate(Number(match[3]), month, Number(match[2]));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function dateToTimestamp(isoDate: string, order = 0): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, order % 1000).getTime();
}

function stableId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `generated-${(hash >>> 0).toString(36)}`;
}

function normalizeEntry(raw: UnknownRecord, bookMeta = new Map<string, UnknownRecord>()): StoryGraphJournalEntry | null {
  const storyGraphBookId = pickString(raw, [
    'storyGraphBookId', 'storygraphBookId', 'storygraph_book_id', 'storyGraphId', 'bookId', 'book_id',
  ]);
  const meta = storyGraphBookId ? bookMeta.get(storyGraphBookId) : undefined;
  const merged: UnknownRecord = meta ? { ...meta, ...raw } : raw;

  const date = parseStoryGraphJournalDate(firstValue(merged, ['date', 'entryDate', 'entry_date', 'readDate', 'read_date']));
  if (!date) return null;

  const title = pickString(merged, ['title', 'bookTitle', 'book_title']);
  const author = pickString(merged, ['author', 'authors', 'authorName', 'author_name']);
  const coverKeys = ['coverUrl', 'cover_url', 'cover', 'imageUrl', 'image_url', 'image'];
  const coverUrl = pickString(raw, coverKeys) || (meta ? pickString(meta, coverKeys) : '');
  const isbn = pickString(merged, ['isbn', 'ISBN', 'isbnUid', 'isbn_uid', 'uid']).replace(/[-\s]/g, '');
  let sourceEntryId = pickString(raw, [
    'sourceEntryId', 'source_entry_id', 'entryId', 'entry_id', 'journalEntryId', 'journal_entry_id', 'id',
  ]);

  const entry: StoryGraphJournalEntry = {
    sourceEntryId,
    storyGraphBookId,
    isbn,
    title,
    author,
    coverUrl,
    date,
    pagesRead: pickNumber(raw, ['pagesRead', 'pages_read', 'pagesReadInSession', 'pages_read_in_last_sitting', 'pagesInSession', 'pages']),
    pagesTotal: pickNumber(raw, ['pagesTotal', 'pages_total', 'pagesReadTotal', 'pages_read_total', 'cumulativePages', 'cumulative_pages', 'currentPage', 'current_page']),
    bookPages: pickNumber(merged, ['bookPages', 'book_pages', 'totalPages', 'pageCount', 'page_count', 'numberOfPages', 'number_of_pages']),
    percent: pickNumber(raw, ['percent', 'percentReached', 'percent_reached', 'percentage', 'percentageReached']),
    minutesListened: pickNumber(raw, ['minutesListened', 'minutes_listened', 'minutesRead', 'minutes_read', 'minutesInSession', 'minutes']),
    minutesTotal: pickNumber(raw, ['minutesTotal', 'minutes_total', 'totalMinutesListened', 'total_minutes_listened', 'cumulativeMinutes']),
    kind: normalizeKind(firstValue(raw, ['kind', 'entryType', 'entry_type', 'event', 'type'])),
    note: pickString(raw, ['note', 'notes', 'entry', 'comment']),
  };

  if (!entry.sourceEntryId) {
    entry.sourceEntryId = stableId(JSON.stringify([
      entry.storyGraphBookId, entry.isbn, entry.title, entry.date,
      entry.pagesRead, entry.pagesTotal, entry.percent, entry.minutesListened, entry.kind, entry.note,
    ]));
  }
  sourceEntryId = entry.sourceEntryId;
  void sourceEntryId;

  // Sin ninguna identidad de libro no podemos vincular la entrada de forma segura.
  if (!entry.storyGraphBookId && !entry.isbn && !entry.title) return null;
  return entry;
}

function deduplicateEntries(entries: StoryGraphJournalEntry[]): StoryGraphJournalEntry[] {
  const byId = new Map<string, StoryGraphJournalEntry>();
  for (const entry of entries) {
    const previous = byId.get(entry.sourceEntryId);
    if (!previous) {
      byId.set(entry.sourceEntryId, entry);
      continue;
    }
    byId.set(entry.sourceEntryId, {
      ...previous,
      ...entry,
      storyGraphBookId: entry.storyGraphBookId || previous.storyGraphBookId,
      isbn: entry.isbn || previous.isbn,
      title: entry.title || previous.title,
      author: entry.author || previous.author,
      coverUrl: entry.coverUrl || previous.coverUrl,
      pagesRead: entry.pagesRead ?? previous.pagesRead,
      pagesTotal: entry.pagesTotal ?? previous.pagesTotal,
      bookPages: entry.bookPages ?? previous.bookPages,
      percent: entry.percent ?? previous.percent,
      minutesListened: entry.minutesListened ?? previous.minutesListened,
      minutesTotal: entry.minutesTotal ?? previous.minutesTotal,
      note: entry.note || previous.note,
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeBookMetadata(raw: UnknownRecord): StoryGraphBookMetadata | null {
  const coverUrl = pickString(raw, ['coverUrl', 'cover_url', 'cover', 'imageUrl', 'image_url', 'image']);
  if (!coverUrl) return null;

  const metadata: StoryGraphBookMetadata = {
    storyGraphBookId: pickString(raw, ['storyGraphBookId', 'storygraphBookId', 'storygraph_book_id', 'storyGraphId', 'bookId', 'book_id', 'id']),
    isbn: pickString(raw, ['isbn', 'ISBN', 'isbnUid', 'isbn_uid', 'uid']).replace(/[-\s]/g, ''),
    title: pickString(raw, ['title', 'bookTitle', 'book_title']),
    author: pickString(raw, ['author', 'authors', 'authorName', 'author_name']),
    coverUrl,
  };
  return metadata.storyGraphBookId || metadata.isbn || metadata.title ? metadata : null;
}

function parseJsonExport(text: string): StoryGraphJournalExport {
  const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  const root = isRecord(parsed) ? parsed : null;
  const rawEntries: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root?.entries)
      ? root.entries
      : Array.isArray(root?.journalEntries)
        ? root.journalEntries
        : isRecord(root?.data) && Array.isArray(root.data.entries)
          ? root.data.entries
          : [];

  const bookMeta = new Map<string, UnknownRecord>();
  const rawBooks = root && Array.isArray(root.books) ? root.books : [];
  for (const rawBook of rawBooks) {
    if (!isRecord(rawBook)) continue;
    const id = pickString(rawBook, ['storyGraphBookId', 'storygraphBookId', 'storygraph_book_id', 'storyGraphId', 'bookId', 'book_id', 'id']);
    if (id) bookMeta.set(id, rawBook);
  }

  const entries = rawEntries
    .filter(isRecord)
    .map((entry) => normalizeEntry(entry, bookMeta))
    .filter((entry): entry is StoryGraphJournalEntry => Boolean(entry));
  const books = rawBooks
    .filter(isRecord)
    .map(normalizeBookMetadata)
    .filter((book): book is StoryGraphBookMetadata => Boolean(book));
  return { entries: deduplicateEntries(entries), books };
}

/** Tokenizador CSV completo: soporta comillas, comas y saltos de línea dentro de notas. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.trim() === '') {
      field = '';
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

const CSV_FIELDS: Record<string, string[]> = {
  sourceEntryId: ['sourceentryid', 'entryid', 'journalentryid', 'id'],
  storyGraphBookId: ['storygraphbookid', 'storygraphid', 'bookid', 'sgbookid'],
  isbn: ['isbn', 'isbnuid', 'uid'],
  title: ['title', 'booktitle'],
  author: ['author', 'authors', 'authorname'],
  coverUrl: ['coverurl', 'cover', 'imageurl', 'image'],
  date: ['date', 'entrydate', 'readdate'],
  pagesRead: ['pagesread', 'pagesreadinsession', 'pagesreadinlastsitting', 'pagesinsession', 'pages', 'delta'],
  pagesTotal: ['pagestotal', 'pagesreadtotal', 'cumulativepages', 'currentpage'],
  bookPages: ['bookpages', 'totalpages', 'pagecount', 'numberofpages'],
  percent: ['percent', 'percentreached', 'percentage', 'percentagereached'],
  minutesListened: ['minuteslistened', 'minutesread', 'minutesinsession', 'minutes'],
  minutesTotal: ['minutestotal', 'totalminuteslistened', 'cumulativeminutes'],
  kind: ['kind', 'entrytype', 'type', 'event'],
  note: ['note', 'notes', 'entry', 'comment'],
};

function parseCsvExport(text: string): StoryGraphJournalEntry[] {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const indexFor = (field: string) => {
    for (const candidate of CSV_FIELDS[field] || []) {
      const index = headers.indexOf(candidate);
      if (index >= 0) return index;
    }
    return -1;
  };

  const entries: StoryGraphJournalEntry[] = [];
  for (const row of rows.slice(1)) {
    const record: UnknownRecord = {};
    for (const field of Object.keys(CSV_FIELDS)) {
      const index = indexFor(field);
      if (index >= 0) record[field] = row[index] ?? '';
    }
    const entry = normalizeEntry(record);
    if (entry) entries.push(entry);
  }
  return deduplicateEntries(entries);
}

export function parseStoryGraphJournalExport(text: string, fileName = ''): StoryGraphJournalExport {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('El archivo del diario está vacío.');
  const looksJson = fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  let parsedExport: StoryGraphJournalExport;
  try {
    parsedExport = looksJson
      ? parseJsonExport(trimmed)
      : { entries: parseCsvExport(trimmed), books: [] };
  } catch {
    throw new Error(looksJson
      ? 'No se pudo leer el JSON del diario. Comprueba que es el archivo generado por el extractor.'
      : 'No se pudo leer el CSV del diario. Comprueba que es el archivo generado por el extractor.');
  }
  if (parsedExport.entries.length === 0) {
    throw new Error('No se encontraron avances válidos en el archivo del diario.');
  }
  return parsedExport;
}

export function parseStoryGraphJournalFile(text: string, fileName = ''): StoryGraphJournalEntry[] {
  return parseStoryGraphJournalExport(text, fileName).entries;
}

export function normalizeIsbnKey(value: string): string {
  const clean = (value || '').toUpperCase().replace(/[^0-9X]/g, '');
  if (/^\d{9}[\dX]$/.test(clean)) {
    const base = `978${clean.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
    return `${base}${(10 - (sum % 10)) % 10}`;
  }
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function titleKeys(value: string): string[] {
  const full = normalizeText(value);
  if (!full) return [];
  const keys = new Set<string>([full]);
  const withoutArticle = full.replace(/^(el|la|los|las|un|una|the|a|an)\s+/, '');
  keys.add(withoutArticle);

  for (const separator of [' [', ' (', ' / ', ': ', ' - ']) {
    const marker = value.indexOf(separator.trim() === '[' ? '[' : separator.trim() === '(' ? '(' : separator);
    if (marker > 2) {
      const prefix = normalizeText(value.slice(0, marker));
      if (prefix) keys.add(prefix.replace(/^(el|la|los|las|un|una|the|a|an)\s+/, ''));
    }
  }
  return Array.from(keys).filter(Boolean);
}

function authorKeys(value: string): string[] {
  if (!value) return [];
  const names = value.split(/[,;]|\s+&\s+|\s+and\s+/i).map((name) => name.trim()).filter(Boolean);
  const keys = new Set<string>();
  for (const name of names) {
    const normalized = normalizeText(name.replace(/\(.*?\)/g, ''));
    if (!normalized) continue;
    keys.add(normalized);
    const tokens = normalized.split(' ').filter((token) => token.length > 1);
    if (tokens.length) keys.add(tokens[tokens.length - 1]);
  }
  return Array.from(keys);
}

interface EntryGroup {
  key: string;
  entries: StoryGraphJournalEntry[];
}

function groupEntries(entries: StoryGraphJournalEntry[]): EntryGroup[] {
  const groups = new Map<string, StoryGraphJournalEntry[]>();
  for (const entry of entries) {
    const key = entry.storyGraphBookId
      ? `sg:${entry.storyGraphBookId}`
      : entry.isbn
        ? `isbn:${normalizeIsbnKey(entry.isbn)}`
        : `title:${normalizeText(entry.title)}|${normalizeText(entry.author)}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    entries: [...group].sort((a, b) => a.date.localeCompare(b.date)),
  }));
}

function groupHead(group: EntryGroup): StoryGraphJournalEntry {
  return group.entries.find((entry) => entry.title || entry.isbn || entry.storyGraphBookId) || group.entries[0];
}

function filterByDateOverlap<T extends JournalMergeBookLike>(
  candidateIndexes: number[],
  books: T[],
  group: EntryGroup
): number[] {
  if (candidateIndexes.length <= 1) return candidateIndexes;
  const min = dateToTimestamp(group.entries[0].date);
  const max = dateToTimestamp(group.entries[group.entries.length - 1].date);
  const tolerance = 3 * 24 * 60 * 60 * 1000;

  const overlapping = candidateIndexes.filter((index) => {
    const book = books[index];
    if (book.startedAt && book.finishedAt) {
      return max >= book.startedAt - tolerance && min <= book.finishedAt + tolerance;
    }
    if (book.finishedAt) return Math.abs(book.finishedAt - max) <= tolerance;
    if (book.startedAt) return Math.abs(book.startedAt - min) <= tolerance;
    return false;
  });
  return overlapping.length === 1 ? overlapping : candidateIndexes;
}

function findBookIndex<T extends JournalMergeBookLike>(books: T[], group: EntryGroup): number {
  const head = groupHead(group);

  if (head.storyGraphBookId) {
    const exact = books.map((book, index) => (book.storyGraphId === head.storyGraphBookId ? index : -1)).filter((i) => i >= 0);
    const filtered = filterByDateOverlap(exact, books, group);
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return -1;
  }

  const isbn = normalizeIsbnKey(head.isbn || group.entries.find((entry) => entry.isbn)?.isbn || '');
  if (isbn) {
    const exact = books.map((book, index) => (normalizeIsbnKey(book.isbn) === isbn ? index : -1)).filter((i) => i >= 0);
    const filtered = filterByDateOverlap(exact, books, group);
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return -1;
  }

  const groupTitles = new Set(group.entries.flatMap((entry) => titleKeys(entry.title)));
  const groupAuthors = new Set(group.entries.flatMap((entry) => authorKeys(entry.author)));
  if (groupTitles.size && groupAuthors.size) {
    const exact = books.map((book, index) => {
      const sameTitle = titleKeys(book.title).some((key) => groupTitles.has(key));
      const sameAuthor = authorKeys(book.author).some((key) => groupAuthors.has(key));
      return sameTitle && sameAuthor ? index : -1;
    }).filter((i) => i >= 0);
    const filtered = filterByDateOverlap(exact, books, group);
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return -1;
  }

  if (groupTitles.size) {
    const exact = books.map((book, index) => (
      titleKeys(book.title).some((key) => groupTitles.has(key)) ? index : -1
    )).filter((i) => i >= 0);
    const filtered = filterByDateOverlap(exact, books, group);
    if (filtered.length === 1) return filtered[0];
  }

  return -1;
}

function findBookIndexForMetadata<T extends JournalMergeBookLike>(
  books: T[],
  metadata: StoryGraphBookMetadata
): number {
  const unique = (candidates: number[]) => (candidates.length === 1 ? candidates[0] : -1);

  if (metadata.storyGraphBookId) {
    const exact = books
      .map((book, index) => (book.storyGraphId === metadata.storyGraphBookId ? index : -1))
      .filter((index) => index >= 0);
    if (exact.length) return unique(exact);
  }

  const isbn = normalizeIsbnKey(metadata.isbn);
  if (isbn) {
    const exact = books
      .map((book, index) => (normalizeIsbnKey(book.isbn) === isbn ? index : -1))
      .filter((index) => index >= 0);
    if (exact.length) return unique(exact);
  }

  const metadataTitles = new Set(titleKeys(metadata.title));
  const metadataAuthors = new Set(authorKeys(metadata.author));
  if (metadataTitles.size && metadataAuthors.size) {
    const exact = books.map((book, index) => {
      const sameTitle = titleKeys(book.title).some((key) => metadataTitles.has(key));
      const sameAuthor = authorKeys(book.author).some((key) => metadataAuthors.has(key));
      return sameTitle && sameAuthor ? index : -1;
    }).filter((index) => index >= 0);
    if (exact.length) return unique(exact);
  }

  if (metadataTitles.size) {
    const exact = books
      .map((book, index) => (titleKeys(book.title).some((key) => metadataTitles.has(key)) ? index : -1))
      .filter((index) => index >= 0);
    return unique(exact);
  }

  return -1;
}

function latestSegment(entries: JournalEntry[]): JournalEntry[] {
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  let lastTerminal = -1;
  let previousTerminal = -1;
  sorted.forEach((entry, index) => {
    if (entry.kind === 'finished' || entry.kind === 'dnf') {
      previousTerminal = lastTerminal;
      lastTerminal = index;
    }
  });
  if (lastTerminal < 0) return sorted;
  const afterLast = sorted.slice(lastTerminal + 1);
  if (afterLast.some((entry) => entry.kind === 'started' || entry.kind === 'progress' || entry.pages > 0)) return afterLast;
  return sorted.slice(previousTerminal + 1, lastTerminal + 1);
}

export function calculateJournalCurrentPage(entries: JournalEntry[], totalPages: number): number {
  const segment = latestSegment(entries || []);
  if (!segment.length) return 0;

  // Se recorre en orden cronológico para poder mezclar entradas importadas
  // (con página acumulada) y avances manuales posteriores (solo delta).
  let current = 0;
  for (const entry of segment) {
    if (typeof entry.cumulativePages === 'number') {
      current = entry.cumulativePages;
    } else if (entry.pages > 0) {
      current += entry.pages;
    } else if (typeof entry.percent === 'number' && totalPages > 0) {
      current = Math.round((entry.percent / 100) * totalPages);
    }
    if (entry.kind === 'finished' && totalPages > 0) current = totalPages;
  }

  return totalPages > 0 ? Math.min(Math.max(0, current), totalPages) : Math.max(0, current);
}

function sameJournalEntry(a: JournalEntry, b: JournalEntry): boolean {
  return a.date === b.date
    && a.pages === b.pages
    && (a.minutes || 0) === (b.minutes || 0)
    && (a.percent ?? null) === (b.percent ?? null)
    && (a.cumulativePages ?? null) === (b.cumulativePages ?? null)
    && (a.kind || 'progress') === (b.kind || 'progress')
    && a.note === b.note
    && (a.sourceEntryId || '') === (b.sourceEntryId || '');
}

function convertEntries(book: JournalMergeBookLike, rawEntries: StoryGraphJournalEntry[]): JournalEntry[] {
  const sorted = [...rawEntries].sort((a, b) => a.date.localeCompare(b.date));
  const bookPages = book.pages || Math.max(0, ...sorted.map((entry) => entry.bookPages || 0));
  let previousCumulative = 0;
  let previousMinutesTotal = 0;
  let segmentClosed = false;

  return sorted.map((raw, index) => {
    if (segmentClosed && (raw.kind === 'started' || raw.kind === 'progress' || raw.kind === 'note' || raw.kind === 'resumed')) {
      previousCumulative = 0;
      previousMinutesTotal = 0;
      segmentClosed = false;
    }

    let cumulative = raw.pagesTotal;
    if (cumulative === null && raw.percent !== null && bookPages > 0) {
      cumulative = Math.round((raw.percent / 100) * bookPages);
    }

    let pages = 0;
    if (raw.pagesRead !== null) {
      pages = Math.max(0, Math.round(raw.pagesRead));
    } else if (cumulative !== null) {
      if (cumulative < previousCumulative) {
        // Un acumulado menor suele marcar una relectura o un cambio de edición.
        previousCumulative = 0;
      }
      pages = Math.max(0, Math.round(cumulative - previousCumulative));
    } else if (raw.kind === 'finished' && bookPages > 0 && previousCumulative > 0) {
      pages = Math.max(0, bookPages - previousCumulative);
      cumulative = bookPages;
    }

    if (cumulative !== null) previousCumulative = Math.round(cumulative);
    else if (pages > 0) {
      previousCumulative += pages;
      cumulative = previousCumulative;
    }

    let minutes = 0;
    if (raw.minutesListened !== null) {
      minutes = Math.max(0, Math.round(raw.minutesListened));
      previousMinutesTotal += minutes;
    } else if (raw.minutesTotal !== null) {
      if (raw.minutesTotal < previousMinutesTotal) previousMinutesTotal = 0;
      minutes = Math.max(0, Math.round(raw.minutesTotal - previousMinutesTotal));
      previousMinutesTotal = Math.round(raw.minutesTotal);
    }

    if (raw.kind === 'finished' || raw.kind === 'dnf') segmentClosed = true;

    return {
      id: `sg-${raw.sourceEntryId.replace(/[^A-Za-z0-9_-]/g, '-')}`,
      date: dateToTimestamp(raw.date, index),
      pages,
      note: raw.note || '',
      ...(minutes > 0 ? { minutes } : {}),
      percent: raw.percent,
      cumulativePages: cumulative === null ? null : Math.round(cumulative),
      kind: raw.kind,
      source: 'storygraph' as const,
      sourceEntryId: raw.sourceEntryId,
    };
  });
}

function applyEntriesToBook<T extends JournalMergeBookLike>(
  book: T,
  rawEntries: StoryGraphJournalEntry[]
): { book: T; patch: Partial<Book>; added: number; updated: number; unchanged: number; importedPages: number; importedMinutes: number; updatedCover: number } {
  const converted = convertEntries(book, rawEntries);
  const bySource = new Map<string, JournalEntry>();
  for (const entry of book.journal || []) {
    if (entry.sourceEntryId) bySource.set(entry.sourceEntryId, entry);
    bySource.set(entry.id, entry);
  }

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let importedPages = 0;
  let importedMinutes = 0;
  const convertedByExistingId = new Map<string, JournalEntry>();

  for (const entry of converted) {
    const existing = (entry.sourceEntryId && bySource.get(entry.sourceEntryId)) || bySource.get(entry.id);
    if (!existing) {
      added++;
      importedPages += entry.pages;
      importedMinutes += entry.minutes || 0;
    } else {
      convertedByExistingId.set(existing.id, { ...entry, id: existing.id });
      if (sameJournalEntry(existing, entry)) unchanged++;
      else updated++;
    }
  }

  const existingIds = new Set((book.journal || []).map((entry) => entry.id));
  const merged = [
    ...(book.journal || []).map((entry) => convertedByExistingId.get(entry.id) || entry),
    ...converted.filter((entry) => {
      const existing = (entry.sourceEntryId && bySource.get(entry.sourceEntryId)) || bySource.get(entry.id);
      return !existing && !existingIds.has(entry.id);
    }),
  ].sort((a, b) => b.date - a.date);

  const storyGraphId = book.storyGraphId || rawEntries.find((entry) => entry.storyGraphBookId)?.storyGraphBookId || undefined;
  const isbn = book.isbn || rawEntries.find((entry) => entry.isbn)?.isbn || '';
  // La portada de StoryGraph es prioritaria: sustituye la existente siempre que el diario traiga una.
  const importedCoverUrl = rawEntries.find((entry) => entry.coverUrl)?.coverUrl || '';
  const coverUrl = importedCoverUrl || book.coverUrl || '';
  const updatedCover = importedCoverUrl && importedCoverUrl !== (book.coverUrl || '') ? 1 : 0;
  const pages = book.pages || Math.max(0, ...rawEntries.map((entry) => entry.bookPages || 0));

  const latest = latestSegment(merged);
  const firstProgress = latest.find((entry) => entry.kind === 'started' || entry.kind === 'progress' || entry.pages > 0);
  const finishedEvents = converted.filter((entry) => entry.kind === 'finished');
  const startedAt = book.startedAt ?? (firstProgress ? firstProgress.date : null);
  const finishedAt = book.finishedAt ?? (finishedEvents.length ? finishedEvents[finishedEvents.length - 1].date : null);
  const segmentCurrent = calculateJournalCurrentPage(merged, pages);
  const latestSegmentIsActive = latest.length > 0
    && !latest.some((entry) => entry.kind === 'finished' || entry.kind === 'dnf')
    && merged.some((entry) => (entry.kind === 'finished' || entry.kind === 'dnf') && entry.date < latest[0].date);
  const currentPage = book.status === 'read' && pages > 0 && !latestSegmentIsActive
    ? pages
    : converted.length
      ? segmentCurrent
      : book.currentPage;

  const patch: Partial<Book> = {
    journal: merged,
    ...(storyGraphId ? { storyGraphId } : {}),
    ...(isbn !== book.isbn ? { isbn } : {}),
    ...(coverUrl !== (book.coverUrl || '') ? { coverUrl } : {}),
    ...(pages !== book.pages ? { pages } : {}),
    ...(currentPage !== book.currentPage ? { currentPage } : {}),
    ...(startedAt !== book.startedAt ? { startedAt } : {}),
    ...(finishedAt !== book.finishedAt ? { finishedAt } : {}),
  };

  return {
    book: { ...book, ...patch },
    patch,
    added,
    updated,
    unchanged,
    importedPages,
    importedMinutes,
    updatedCover,
  };
}

export function mergeStoryGraphJournal<T extends JournalMergeBookLike>(
  books: T[],
  entries: StoryGraphJournalEntry[],
  bookMetadata: StoryGraphBookMetadata[] = []
): { books: T[]; patches: StoryGraphJournalPatch[]; report: StoryGraphJournalMergeReport } {
  const result = [...books];
  const patches: StoryGraphJournalPatch[] = [];
  const report: StoryGraphJournalMergeReport = {
    totalEntries: entries.length,
    matchedEntries: 0,
    unmatchedEntries: 0,
    matchedBooks: 0,
    addedEntries: 0,
    updatedEntries: 0,
    unchangedEntries: 0,
    importedPages: 0,
    importedMinutes: 0,
    updatedCovers: 0,
    unmatchedBooks: [],
  };

  const groupsByBook = new Map<number, StoryGraphJournalEntry[]>();
  for (const group of groupEntries(entries)) {
    const index = findBookIndex(result, group);
    if (index < 0) {
      report.unmatchedEntries += group.entries.length;
      const head = groupHead(group);
      report.unmatchedBooks.push({
        storyGraphBookId: head.storyGraphBookId,
        isbn: head.isbn,
        title: head.title || 'Libro sin título',
        author: head.author,
        entries: group.entries.length,
      });
      continue;
    }
    report.matchedEntries += group.entries.length;
    groupsByBook.set(index, [...(groupsByBook.get(index) || []), ...group.entries]);
  }

  for (const [index, rawEntries] of groupsByBook.entries()) {
    const applied = applyEntriesToBook(result[index], deduplicateEntries(rawEntries));
    result[index] = applied.book;
    patches.push({ index, patch: applied.patch });
    report.matchedBooks++;
    report.addedEntries += applied.added;
    report.updatedEntries += applied.updated;
    report.unchangedEntries += applied.unchanged;
    report.importedPages += applied.importedPages;
    report.importedMinutes += applied.importedMinutes;
    report.updatedCovers += applied.updatedCover;
  }

  // El JSON también trae metadatos de libros sin avances exportables. Sus
  // portadas deben sustituir a las actuales aunque no haya diario que fusionar.
  const metadataCoverIndexes = new Set<number>();
  for (const metadata of bookMetadata) {
    if (!metadata.coverUrl) continue;
    const index = findBookIndexForMetadata(result, metadata);
    if (index < 0 || metadataCoverIndexes.has(index)) continue;
    metadataCoverIndexes.add(index);

    const existingPatch = patches.find((item) => item.index === index);
    if (existingPatch?.patch.coverUrl) continue;
    if ((result[index].coverUrl || '') === metadata.coverUrl) continue;

    result[index] = { ...result[index], coverUrl: metadata.coverUrl };
    if (existingPatch) {
      existingPatch.patch = { ...existingPatch.patch, coverUrl: metadata.coverUrl };
    } else {
      patches.push({ index, patch: { coverUrl: metadata.coverUrl } });
    }
    report.updatedCovers++;
  }

  report.unmatchedBooks.sort((a, b) => b.entries - a.entries || a.title.localeCompare(b.title, 'es'));
  return { books: result, patches, report };
}
