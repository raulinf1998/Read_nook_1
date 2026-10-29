import { useState, type CSSProperties } from 'react';
import { Palette } from 'lucide-react';
import { DEFAULT_SHELF_COLORS, type ShelfColors } from '../shelfColors';
import type { Book } from '../types';
import { BookCover } from './ui';
import { useWindowWidth } from '../hooks';
import { sortBooksForBookshelf } from '../series';

interface Props {
  books: Book[];
  colors: ShelfColors;
  onSetColor: (key: keyof ShelfColors, color: string) => void;
  onOpen: (book: Book) => void;
}

function hashBook(book: Book): number {
  const value = `${book.id || ''}${book.title || ''}${book.author || ''}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Estantería pura: en esta pestaña no se muestran títulos, autores, notas,
 * estados ni contadores junto a los libros. Solo aparecen las portadas,
 * ordenadas siempre por autor y saga, dentro de una librería clásica frontal
 * de madera lacada en crema con tapa y baldas de pino.
 */
export function Bookshelf({ books, onOpen, colors, onSetColor }: Props) {
  const [showColors, setShowColors] = useState(false);
  const width = useWindowWidth();
  const perShelf = width < 380 ? 3 : width < 640 ? 4 : width < 900 ? 5 : width < 1200 ? 6 : 7;
  const sortedBooks = sortBooksForBookshelf(books);
  const shelves = chunk(sortedBooks, perShelf);
  const visibleShelves: (Book | null)[][] = shelves.length
    ? shelves.map((shelf) => [
      ...shelf,
      ...Array.from({ length: Math.max(0, perShelf - shelf.length) }, () => null),
    ])
    : Array.from({ length: 4 }, () => Array.from({ length: perShelf }, () => null));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setShowColors(!showColors)} aria-expanded={showColors} aria-controls="shelf-colors" className="inline-flex items-center gap-2 rounded-btn border border-line bg-surface px-4 py-2 text-sm font-bold text-ink hover:text-accent">
          <Palette size={16} /> Colores de la estantería
        </button>
      </div>
      {showColors && <div id="shelf-colors" className="mb-5 flex flex-wrap items-end gap-4 rounded-card border border-line bg-surface p-4">
        {([['frame', 'Bordes'], ['wood', 'Madera'], ['background', 'Fondo']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="color" value={colors[key]} onChange={(event) => onSetColor(key, event.target.value)} aria-label={`Color de ${label.toLowerCase()}`} className="h-10 w-12 cursor-pointer rounded border border-line bg-surface p-1" /> {label}
        </label>)}
        <button type="button" onClick={() => (Object.keys(DEFAULT_SHELF_COLORS) as (keyof ShelfColors)[]).forEach((key) => onSetColor(key, DEFAULT_SHELF_COLORS[key]))} className="rounded-btn border border-line px-3 py-2 text-sm font-bold text-ink2 hover:text-accent">Restablecer colores</button>
      </div>}
    <div className="bookcase" style={{ '--bookcase-paint': colors.frame, '--bookcase-pine': colors.wood, '--bookcase-background': colors.background } as CSSProperties} aria-label={books.length ? 'Estantería' : 'Estantería vacía'}>
      <span className="sr-only">
        {books.length
          ? 'Estantería visual ordenada por autor y saga. Cada portada abre la ficha del libro.'
          : 'La estantería está vacía.'}
      </span>

      <div className="bookcase-cap" aria-hidden />

      <div className="bookcase-frame">
        <div className="bookcase-rail bookcase-rail--top" aria-hidden />

        <div className="bookcase-body">
          <div className="bookcase-side" aria-hidden />

          <div className="bookcase-back">
            <div className="relative space-y-8 sm:space-y-10">
              {visibleShelves.map((shelf, shelfIndex) => (
                <section key={shelfIndex} aria-label={`Balda ${shelfIndex + 1}`}>
                  <div
                    className="grid items-end gap-x-2.5 px-0.5 min-[420px]:gap-x-3.5 sm:gap-x-5 sm:px-2"
                    style={{ gridTemplateColumns: `repeat(${perShelf}, minmax(0, 1fr))` }}
                  >
                    {shelf.map((book, bookIndex) => {
                      if (!book) {
                        return <span key={`empty-${bookIndex}`} className="block aspect-[2/3] w-full" aria-hidden />;
                      }

                      // Pequeñas diferencias de tamaño para que la fila parezca
                      // una balda real y no una rejilla de tarjetas idénticas.
                      const coverWidth = 87 + (hashBook(book) % 14);
                      return (
                        <div key={book.id} className="flex min-w-0 items-end justify-center self-end">
                          <button
                            type="button"
                            onClick={() => onOpen(book)}
                            className="group relative block shrink-0"
                            style={{ width: `${coverWidth}%`, maxWidth: 132 }}
                            aria-label={`Abrir ficha de ${book.title}${book.author ? `, de ${book.author}` : ''}`}
                          >
                            <BookCover
                              title={book.title}
                              author={book.author}
                              coverUrl={book.coverUrl}
                              detail="md"
                              className="aspect-[2/3] w-full shadow-book transition-all duration-300 group-hover:-translate-y-2 group-hover:-rotate-1 group-focus-visible:-translate-y-2"
                            />
                            <span
                              className="pointer-events-none absolute -bottom-1 left-[7%] right-[7%] h-2 rounded-full bg-black/30 blur-[3px]"
                              aria-hidden
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bookcase-shelf" aria-hidden />
                </section>
              ))}
            </div>
          </div>

          <div className="bookcase-side bookcase-side--right" aria-hidden />
        </div>

        <div className="bookcase-rail bookcase-rail--bottom" aria-hidden />
      </div>

      <div className="bookcase-feet" aria-hidden>
        <span />
        <span />
      </div>
    </div>
    </div>
  );
}
