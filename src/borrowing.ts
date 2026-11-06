import type { Book } from './types';
import type { AccountId } from './accounts';

export type SharedBook = Book & { owner: AccountId };

/** Deduplicar solo vínculos explícitos; nunca fusionar libros por título o ISBN. */
export function combinedShelf(books: SharedBook[], viewer: AccountId): SharedBook[] {
  const originals = new Set(books.map((book) => `${book.owner}:${book.id}`));
  const groups = new Map<string, SharedBook[]>();
  for (const book of books) {
    const source = book.borrowedFrom && `${book.borrowedFrom.owner}:${book.borrowedFrom.bookId}`;
    const key = source && originals.has(source) ? source : `${book.owner}:${book.id}`;
    const group = groups.get(key) || [];
    group.push(book);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => group.find((book) => book.owner === viewer) || group[0]);
}
