import type { Book } from '../types';
import { BookCover } from './ui';
import { useWindowWidth } from '../hooks';

interface Props {
  books: Book[];
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
 * estados ni contadores junto a los libros. Solo las portadas, apoyadas en
 * las baldas de un mueble con fondo, laterales, coronación y zócalo.
 */
export function Bookshelf({ books, onOpen }: Props) {
  const width = useWindowWidth();
  const perShelf = width < 380 ? 3 : width < 640 ? 4 : width < 900 ? 5 : width < 1200 ? 6 : 7;
  const shelves = chunk(books, perShelf);
  const visibleShelves: (Book | null)[][] = shelves.length
    ? shelves.map((shelf) => [
      ...shelf,
      ...Array.from({ length: Math.max(0, perShelf - shelf.length) }, () => null),
    ])
    : Array.from({ length: 4 }, () => Array.from({ length: perShelf }, () => null));

  return (
    <div className="bookcase" aria-label={books.length ? 'Estantería' : 'Estantería vacía'}>
      <span className="sr-only">
        {books.length
          ? 'Estantería visual. Cada portada abre la ficha del libro.'
          : 'La estantería está vacía.'}
      </span>

      <div className="bookcase-top" aria-hidden />

      <div className="bookcase-body">
        <div className="bookcase-side" aria-hidden />

        <div className="bookcase-back">
          <div className="relative space-y-7 sm:space-y-9">
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

                <div className="shelf-board mt-1 h-4 rounded-[5px] sm:h-[18px]" aria-hidden />
                <div className="flex justify-between px-7 sm:px-10" aria-hidden>
                  <span className="h-3.5 w-3 rounded-b bg-black/25 shadow-sm" />
                  <span className="h-3.5 w-3 rounded-b bg-black/25 shadow-sm" />
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="bookcase-side bookcase-side--right" aria-hidden />
      </div>

      <div className="bookcase-plinth" aria-hidden />
    </div>
  );
}
