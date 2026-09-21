import { useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META } from '../types';

interface Props {
  books: Book[];
  onEdit: (book: Book) => void;
}

export function Bookshelf({ books, onEdit }: Props) {
  const [shelfFilter, setShelfFilter] = useState<BookStatus | 'all'>('all');

  const filtered = useMemo(() => {
    if (shelfFilter === 'all') return books;
    return books.filter((b) => b.status === shelfFilter);
  }, [books, shelfFilter]);

  // Group into shelves of 5
  const shelves: Book[][] = [];
  for (let i = 0; i < filtered.length; i += 5) {
    shelves.push(filtered.slice(i, i + 5));
  }

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'reading', 'read', 'pending'] as const).map((s) => {
          const label = s === 'all' ? 'Todos' : STATUS_META[s].label;
          const active = shelfFilter === s;
          return (
            <button
              key={s}
              onClick={() => setShelfFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {shelves.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} className="text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">La estantería está vacía</p>
        </div>
      ) : (
        <div className="space-y-6">
          {shelves.map((shelf, si) => (
            <div key={si}>
              {/* Books on shelf */}
              <div className="flex items-end justify-center gap-2 sm:gap-4 px-2 min-h-[180px]">
                {shelf.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => onEdit(book)}
                    className="group relative flex-shrink-0"
                    style={{ width: '18%', maxWidth: 100 }}
                  >
                    <div className="relative transition-transform duration-300 group-hover:-translate-y-2 group-hover:rotate-1">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-full aspect-[2/3] object-cover rounded-md shadow-lg bg-gray-100"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] rounded-md bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 shadow-lg flex items-center justify-center p-2">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center font-medium leading-tight line-clamp-4">{book.title}</span>
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-1 right-1">
                        <span className={`block w-2.5 h-2.5 rounded-full ${STATUS_META[book.status].dot} ring-2 ring-white/80 dark:ring-gray-900/80`} />
                      </div>
                      {/* Hover tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg">
                          {book.title}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {/* Fill empty slots */}
                {shelf.length < 5 && Array.from({ length: 5 - shelf.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ width: '18%', maxWidth: 100 }} className="flex-shrink-0 aspect-[2/3] rounded-md border-2 border-dashed border-gray-100 dark:border-gray-800 opacity-40" />
                ))}
              </div>
              {/* Shelf board */}
              <div className="shelf-board h-3 rounded-sm shadow-md" />
              <div className="h-1 bg-black/10 dark:bg-black/30 rounded-b-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
