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
  // Nº de libros por balda: portadas más pequeñas en móvil y más aire en pantallas grandes.
  const perShelf = width < 370 ? 3 : width < 640 ? 4 : width < 1024 ? 5 : width < 1280 ? 6 : 7;

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
        {(['all', 'reading', 'read', 'pending', 'dnf'] as const).map((s) => {
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
        <div className={cx(cardCls, 'relative overflow-hidden px-3 pb-5 pt-6 sm:px-6 sm:pt-7 space-y-8 bg-gradient-to-b from-sunken/50 via-surface to-sunken/25')}>
          <span className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-b-full bg-glow/10 blur-2xl" aria-hidden />
          {shelves.map((shelf, si) => (
            <section key={si} className="relative" aria-label={`Balda ${si + 1}`}>
              <div
                className="grid items-start px-1 sm:px-3 gap-x-2.5 min-[420px]:gap-x-3 sm:gap-x-5"
                style={{ gridTemplateColumns: `repeat(${perShelf}, minmax(0, 1fr))` }}
              >
                {shelf.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => onEdit(book)}
                    className="group relative flex h-full min-w-0 flex-col items-center self-start text-center"
                    aria-label={`Abrir ${book.title}`}
                  >
                    <span className="relative block w-full max-w-[86px] shrink-0 transition-all duration-300 group-hover:-translate-y-2.5 group-hover:-rotate-1 min-[420px]:max-w-[96px] sm:max-w-[104px] xl:max-w-[112px]">
                      <BookCover
                        title={book.title}
                        author={book.author}
                        coverUrl={book.coverUrl}
                        detail="md"
                        className="aspect-[2/3] w-full shadow-book"
                      />
                      <span
                        className={cx('absolute top-1.5 right-1.5 block w-2.5 h-2.5 rounded-full ring-2 ring-white/80 shadow', STATUS_META[book.status].dot)}
                        title={STATUS_META[book.status].label}
                      />
                      <span className="pointer-events-none absolute -bottom-1 left-[8%] right-[8%] h-2 rounded-full bg-black/25 blur-[3px]" aria-hidden />
                    </span>

                    {/* Alturas fijas: ningún título, autor o ausencia de nota desplaza las portadas. */}
                    <span className="mt-2 flex h-[58px] w-full flex-col items-center sm:h-[62px]">
                      <span className="block h-[2.25em] w-full text-[9px] font-semibold leading-[1.12] text-ink line-clamp-2 min-[420px]:text-[11px] sm:text-xs">
                        {book.title}
                      </span>
                      <span className="mt-0.5 block h-4 w-full truncate text-[8px] text-ink3 min-[420px]:text-[10px]">
                        {book.author || 'Autor desconocido'}
                      </span>
                      <span className="mt-0.5 flex h-4 items-center justify-center">
                        {book.rating > 0 ? (
                          <StarRating value={book.rating} size={9} />
                        ) : (
                          <span className="text-[8px] font-semibold uppercase tracking-wide text-ink3/80">Sin nota</span>
                        )}
                      </span>
                    </span>
                  </button>
                ))}
                {/* Huecos vacíos de la última balda */}
                {shelf.length < perShelf &&
                  Array.from({ length: perShelf - shelf.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="hidden sm:flex flex-col items-center self-start opacity-50" aria-hidden>
                      <div className="flex aspect-[2/3] w-full max-w-[104px] items-center justify-center rounded-[3px_8px_8px_3px] border-2 border-dashed border-line2 xl:max-w-[112px]">
                        <BookMarked size={16} className="text-line2" />
                      </div>
                      <span className="mt-2 flex h-[62px] items-start justify-center text-[10px] italic text-ink3">hueco libre</span>
                    </div>
                  ))}
              </div>
              {/* Balda */}
              <div className="shelf-board mt-1.5 h-4 rounded-[5px]" aria-hidden />
              <div className="flex justify-between px-6" aria-hidden>
                <span className="h-3.5 w-3 rounded-b bg-black/20 shadow-sm" />
                <span className="h-3.5 w-3 rounded-b bg-black/20 shadow-sm" />
              </div>
            </section>
          ))}
          <p className="text-center text-xs text-ink3 pt-1">
            {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'} en {shelves.length} {shelves.length === 1 ? 'balda' : 'baldas'} · toca un libro para editarlo
          </p>
        </div>
      )}
    </div>
  );
}
