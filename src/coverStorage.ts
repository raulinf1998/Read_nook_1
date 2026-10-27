import { apiClient } from './api';
import type { StoredCover } from './api';

export interface LocalizableCover {
  coverUrl: string;
  coverSourceUrl?: string;
}

export interface CoverLocalizationResult<T extends LocalizableCover> {
  books: T[];
  localizedBooks: number;
  localizedUrls: number;
  failures: number;
}

export function isLocalCoverUrl(value: string | undefined): boolean {
  return Boolean(value?.trim().startsWith('/covers/'));
}

export function isExternalCoverUrl(value: string | undefined): boolean {
  const raw = (value || '').trim();
  if (!raw || isLocalCoverUrl(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return false;
  try {
    const url = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://bilibook.local');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (typeof window !== 'undefined' && url.origin === window.location.origin && url.pathname.startsWith('/covers/')) {
      return false;
    }
    return /^https?:\/\//i.test(raw);
  } catch {
    return false;
  }
}

export async function storeCoverFromUrl(url: string): Promise<StoredCover> {
  return apiClient.storeCoverFromUrl(url.trim());
}

/**
 * Descarga al servidor las portadas externas de una lista de libros.
 * Si una URL falla se conserva como respaldo para no bloquear una importación
 * completa por una sola imagen caída.
 */
export async function localizeBookCovers<T extends LocalizableCover>(
  input: T[],
  onProgress?: (done: number, total: number) => void,
): Promise<CoverLocalizationResult<T>> {
  const books = input.map((book) => ({ ...book }));
  const uniqueUrls = [...new Set(
    books.map((book) => book.coverUrl.trim()).filter((url) => isExternalCoverUrl(url)),
  )];
  if (!uniqueUrls.length) {
    onProgress?.(0, 0);
    return { books, localizedBooks: 0, localizedUrls: 0, failures: 0 };
  }

  const storedByUrl = new Map<string, StoredCover>();
  let failures = 0;
  let completed = 0;
  let cursor = 0;

  const workers = Array.from({ length: Math.min(4, uniqueUrls.length) }, async () => {
    while (cursor < uniqueUrls.length) {
      const url = uniqueUrls[cursor];
      cursor += 1;
      try {
        storedByUrl.set(url, await apiClient.storeCoverFromUrl(url));
      } catch {
        failures += 1;
      } finally {
        completed += 1;
        onProgress?.(completed, uniqueUrls.length);
      }
    }
  });
  await Promise.all(workers);

  let localizedBooks = 0;
  for (const book of books) {
    const sourceUrl = book.coverUrl.trim();
    const stored = storedByUrl.get(sourceUrl);
    if (!stored) continue;
    book.coverUrl = stored.coverUrl;
    book.coverSourceUrl = sourceUrl;
    localizedBooks += 1;
  }

  return {
    books,
    localizedBooks,
    localizedUrls: storedByUrl.size,
    failures,
  };
}

export async function localizeBookCover<T extends LocalizableCover>(book: T): Promise<T> {
  if (!isExternalCoverUrl(book.coverUrl)) return book;
  const result = await localizeBookCovers([book]);
  return result.books[0] || book;
}
