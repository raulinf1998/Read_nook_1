import type { Book, BookFormat, BookLanguage, BookStatus, JournalEntry } from './types';

export interface IsbnResult {
  title: string;
  author: string;
  coverUrl: string;
  pages: number;
  publishDate: string;
  language: BookLanguage;
  description: string;
  isbn: string;
}

// --- Multi-source ISBN lookup ---

async function tryGoogleBooks(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;
    const info = data.items[0].volumeInfo;
    const lang: BookLanguage = info.language === 'es' ? 'es' : 'en';
    const coverUrl =
      info.imageLinks?.extraLarge ||
      info.imageLinks?.large ||
      info.imageLinks?.medium ||
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail ||
      '';
    return {
      title: info.title || '',
      author: (info.authors || []).join(', '),
      coverUrl,
      pages: info.pageCount || 0,
      publishDate: info.publishedDate || '',
      language: lang,
      description: info.description || '',
      isbn,
    };
  } catch {
    return null;
  }
}

async function tryOpenLibrary(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    if (!res.ok) return null;
    const data = await res.json();
    const key = `ISBN:${isbn}`;
    if (!data[key]) return null;
    const info = data[key];
    const coverUrl = info.cover?.large || info.cover?.medium || info.cover?.small || '';
    const lang: BookLanguage = (info.languages || []).some((l: { key: string }) => l.key === '/languages/spa') ? 'es' : 'en';
    return {
      title: info.title || '',
      author: (info.authors || []).map((a: { name: string }) => a.name).join(', '),
      coverUrl,
      pages: info.number_of_pages || 0,
      publishDate: info.publish_date || '',
      language: lang,
      description: info.notes || (info.subjects ? info.subjects.map((s: { name: string }) => s.name).join(', ') : '') || '',
      isbn,
    };
  } catch {
    return null;
  }
}

async function tryOpenLibrarySearch(isbn: string): Promise<IsbnResult | null> {
  try {
    const res = await fetch(`https://openlibrary.org/search.json?isbn=${isbn}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;
    const doc = data.docs[0];
    const coverId = doc.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
    const lang: BookLanguage = (doc.language || []).includes('spa') || (doc.language || []).includes('Spanish') ? 'es' : 'en';
    return {
      title: doc.title || '',
      author: (doc.author_name || []).join(', '),
      coverUrl,
      pages: doc.number_of_pages_median || 0,
      publishDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
      language: lang,
      description: '',
      isbn,
    };
  } catch {
    return null;
  }
}

function mergeResults(primary: IsbnResult | null, secondary: IsbnResult | null): IsbnResult | null {
  if (!primary && !secondary) return null;
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    title: primary.title || secondary.title,
    author: primary.author || secondary.author,
    coverUrl: primary.coverUrl || secondary.coverUrl,
    pages: primary.pages || secondary.pages,
    publishDate: primary.publishDate || secondary.publishDate,
    language: primary.language || secondary.language,
    description: primary.description || secondary.description,
    isbn: primary.isbn || secondary.isbn,
  };
}

export async function fetchByIsbn(isbn: string): Promise<IsbnResult | null> {
  const clean = isbn.trim().replace(/[-\s]/g, '');
  if (!clean) return null;

  const googleResult = await tryGoogleBooks(clean);
  if (googleResult && googleResult.coverUrl && googleResult.pages && googleResult.language) return googleResult;

  const olResult = await tryOpenLibrary(clean);
  const merged = mergeResults(googleResult, olResult);
  if (merged && merged.coverUrl && merged.pages && merged.language) return merged;

  const olSearchResult = await tryOpenLibrarySearch(clean);
  const final = mergeResults(merged, olSearchResult);
  return final;
}

// --- CSV Parser (TheStoryGraph + similar exports) ---

export function parseStoryGraphCsv(csvText: string, defaultLanguage: BookLanguage = 'es'): Omit<Book, 'id' | 'createdAt'>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const findIdx = (names: string[]): number => {
    for (const name of names) {
      const i = headers.findIndex((h) => h.toLowerCase().trim() === name.toLowerCase().trim());
      if (i >= 0) return i;
    }
    return -1;
  };

  const iTitle = findIdx(['Title', 'Book Title']);
  const iAuthor = findIdx(['Authors', 'Author', 'Author Name']);
  const iIsbn = findIdx(['ISBN/UID', 'ISBN', 'Uid']);
  const iFormat = findIdx(['Format']);
  const iStatus = findIdx(['Read Status', 'Status']);
  const iRating = findIdx(['Star Rating', 'Rating']);
  const iPages = findIdx(['Number of Pages', 'Pages', 'Page Count']);
  const iLastRead = findIdx(['Last Date Read', 'Finished Date', 'Date Finished', 'Last Date Finished', 'Date Read']);
  const iDatesRead = findIdx(['Dates Read']);
  const iStarted = findIdx(['Started Date', 'Date Started', 'Date Added', 'Date Added to Library']);
  const iTags = findIdx(['Tags', 'Genres']);
  const iCover = findIdx(['Cover']);

  const books: Omit<Book, 'id' | 'createdAt'>[] = [];

  for (let line = 1; line < lines.length; line++) {
    const cols = parseCsvLine(lines[line]);
    if (iTitle < 0 || !cols[iTitle]) continue;

    const statusRaw = iStatus >= 0 ? (cols[iStatus] || '').toLowerCase() : '';
    let status: BookStatus = 'pending';
    if (statusRaw.includes('read') || statusRaw.includes('finished')) status = 'read';
    else if (statusRaw.includes('reading') || statusRaw.includes('currently')) status = 'reading';

    const ratingStr = iRating >= 0 ? cols[iRating] : '';
    const rating = ratingStr ? Math.round(parseFloat(ratingStr) * 2) / 2 : 0;

    const pages = iPages >= 0 ? parseInt(cols[iPages] || '0', 10) || 0 : 0;

    const formatRaw = iFormat >= 0 ? (cols[iFormat] || '').toLowerCase() : '';
    let format: BookFormat = 'paperback';
    if (formatRaw.includes('hard')) format = 'hardcover';
    else if (formatRaw.includes('ebook') || formatRaw.includes('electr')) format = 'ebook';

    const tags = iTags >= 0 ? (cols[iTags] || '').split(',').map((t) => t.trim()).filter(Boolean) : [];

    const parseDate = (s: string): number | null => {
      if (!s) return null;
      // Try ISO date first
      let d = new Date(s);
      if (isNaN(d.getTime())) {
        // Try yyyy/mm/dd or dd/mm/yyyy
        d = new Date(s.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
      }
      return isNaN(d.getTime()) ? null : d.getTime();
    };

    // Prefer "Last Date Read" / "Finished Date", fallback to last date in "Dates Read"
    let finishedAt: number | null = null;
    if (iLastRead >= 0) finishedAt = parseDate(cols[iLastRead] || '');
    if (!finishedAt && iDatesRead >= 0) {
      const datesRaw = cols[iDatesRead] || '';
      // StoryGraph "Dates Read" can contain multiple ranges separated by commas
      // e.g. "2023-01-01 to 2023-01-15, 2023-03-01 to 2023-03-10"
      // We want the last finish date
      const ranges = datesRaw.split(/,/).map((s) => s.trim()).filter(Boolean);
      for (let r = ranges.length - 1; r >= 0; r--) {
        const parts = ranges[r].split(/\s+to\s+/i);
        const lastDate = parts[parts.length - 1].trim();
        const parsed = parseDate(lastDate);
        if (parsed) { finishedAt = parsed; break; }
      }
    }

    // Start date: prefer "Started Date", fallback to first date in "Dates Read"
    let startedAt: number | null = null;
    if (iStarted >= 0) startedAt = parseDate(cols[iStarted] || '');
    if (!startedAt && iDatesRead >= 0) {
      const datesRaw = cols[iDatesRead] || '';
      const firstRange = datesRaw.split(/,/)[0]?.trim();
      if (firstRange) {
        const firstDate = firstRange.split(/\s+to\s+/i)[0].trim();
        startedAt = parseDate(firstDate);
      }
    }
    const isbn = iIsbn >= 0 ? (cols[iIsbn] || '').replace(/[-\s]/g, '') : '';

    books.push({
      title: cols[iTitle] || '',
      author: iAuthor >= 0 ? cols[iAuthor] || '' : '',
      coverUrl: iCover >= 0 ? cols[iCover] || '' : '',
      status,
      rating,
      notes: '',
      pages,
      currentPage: status === 'read' ? pages : 0,
      format,
      language: defaultLanguage,
      publishDate: '',
      description: '',
      tags,
      isbn,
      startedAt,
      finishedAt,
      journal: [],
    });
  }

  return books;
}

// Enrich books with covers from ISBN lookups (called during import)
export async function enrichWithCovers(
  books: Omit<Book, 'id' | 'createdAt'>[],
  onProgress?: (done: number, total: number) => void
): Promise<Omit<Book, 'id' | 'createdAt'>[]> {
  const needsCover = books.filter((b) => !b.coverUrl && b.isbn);
  const total = needsCover.length;
  let done = 0;

  // Process in small batches to avoid rate limits
  for (const book of needsCover) {
    const result = await fetchByIsbn(book.isbn);
    if (result?.coverUrl) {
      book.coverUrl = result.coverUrl;
      if (!book.pages && result.pages) book.pages = result.pages;
      if (!book.description && result.description) book.description = result.description;
      if (!book.publishDate && result.publishDate) book.publishDate = result.publishDate;
    }
    done++;
    onProgress?.(done, total);
  }

  return books;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Helper to create a journal entry
export function makeJournalEntry(pages: number, note: string): JournalEntry {
  return { id: crypto.randomUUID(), date: Date.now(), pages, note };
}
