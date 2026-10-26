import { useState, useMemo } from 'react';
import { BookMarked } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META } from '../types';
import { BookCover, EmptyState, cardCls, cx, filterChipCls } from './ui';
import { StarRating } from './StarRating';
import { useWindowWidth } from '../hooks';

interface Props {
  books: Book[];
  onEdit: (book: Book) => void;
}

export function Bookshelf({ books, onEdit }: Props) {
  const [shelfFilter, setShelfFilter] = useState<BookStatus | 'all'>('all');
  const width = useWindowWidth();
  // nº de libros por balda según pantalla: 3 móvil · 5 tablet · 7 escritorio
  const perShelf = width < 640 ? 3 : width < 1280 ? 5 : 7;

  const filtered = useMemo(() => {
    if (shelfFilter === 'all') return books;
    return books.filter((b) => b.status === shelfFilter);
  }, [books, shelfFilter]);

  const shelves: Book[][] = [];
  for (let i = 0; i < filtered.length; i += perShelf) {
    shelves.push(filtered.slice(i, i + perShelf));
  }

  return (
    <div className="space-y-5">
      {/* Filtro */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'reading', 'read', 'pending'] as const).map((s) => {
          const label = s === 'all' ? 'Todos' : STATUS_META[s].label;
          const count = s === 'all' ? books.length : books.filter((b) => b.status === s).length;
          const active = shelfFilter === s;
          return (
            <button key={s} onClick={() => setShelfFilter(s)} className={filterChipCls(active)} aria-pressed={active}>
              {s !== 'all' && <span className={cx('w-2 h-2 rounded-full', STATUS_META[s].dot)} />}
              {label}
              <span className={active ? 'text-onprimary/70 text-xs' : 'text-ink3 text-xs'}>{count}</span>
            </button>
          );
        })}
      </div>

      {shelves.length === 0 ? (
        <EmptyState
          icon={<BookMarked size={26} />}
          title="La estantería está vacía"
          description="Los libros que añadas se colocarán aquí, balda a balda, como en una librería de verdad."
        />
      ) : (
        <div className={cx(cardCls, 'px-3 sm:px-6 pt-7 pb-5 space-y-8 bg-gradient-to-b from-sunken/40 to-surface')}>
          {shelves.map((shelf, si) => (
            <div key={si}>
              <div
                className="grid items-end px-1 sm:px-3 gap-x-3 sm:gap-x-5"
                style={{ gridTemplateColumns: `repeat(${perShelf}, minmax(0, 1fr))` }}
              >
                {shelf.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => onEdit(book)}
                    className="group relative text-center min-w-0"
                    aria-label={`Abrir ${book.title}`}
                  >
                    <span className="relative block mx-auto w-full max-w-[110px] transition-all duration-300 group-hover:-translate-y-2.5 group-hover:-rotate-1">
                      <BookCover
                        title={book.title}
                        author={book.author}
                        coverUrl={book.coverUrl}
                        detail="md"
                        className="w-full aspect-[2/3] shadow-book"
                      />
                      <span
                        className={cx('absolute top-1.5 right-1.5 block w-2.5 h-2.5 rounded-full ring-2 ring-white/80 shadow', STATUS_META[book.status].dot)}
                        title={STATUS_META[book.status].label}
                      />
                    </span>
                    <span className="block mt-2 min-h-[2.6em]">
                      <span className="block text-[11px] sm:text-xs font-semibold text-ink leading-tight line-clamp-2">{book.title}</span>
                      <span className="block text-[10px] text-ink3 truncate mt-0.5">{book.author}</span>
                    </span>
                    {book.rating > 0 && (
                      <span className="flex justify-center mt-0.5">
                        <StarRating value={book.rating} size={10} />
                      </span>
                    )}
                  </button>
                ))}
                {/* Huecos vacíos de la última balda */}
                {shelf.length < perShelf &&
                  Array.from({ length: perShelf - shelf.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="hidden sm:flex flex-col items-center opacity-50" aria-hidden>
                      <div className="w-full max-w-[110px] aspect-[2/3] rounded-[3px_8px_8px_3px] border-2 border-dashed border-line2 flex items-center justify-center">
                        <BookMarked size={16} className="text-line2" />
                      </div>
                      <span className="mt-2 min-h-[2.6em] text-[10px] text-ink3 italic">hueco libre</span>
                    </div>
                  ))}
              </div>
              {/* Balda */}
              <div className="shelf-board h-3.5 rounded-[4px] mt-1" aria-hidden />
              <div className="flex justify-between px-6" aria-hidden>
                <span className="w-2.5 h-3 bg-black/15 rounded-b-sm" />
                <span className="w-2.5 h-3 bg-black/15 rounded-b-sm" />
              </div>
            </div>
          ))}
          <p className="text-center text-xs text-ink3 pt-1">
            {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'} en {shelves.length} {shelves.length === 1 ? 'balda' : 'baldas'} · toca un libro para editarlo
          </p>
        </div>
      )}
    </div>
  );
}
