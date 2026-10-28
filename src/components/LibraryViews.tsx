import type { CSSProperties } from 'react';
import { BookMarked, Info } from 'lucide-react';
import type { Book } from '../types';
import { STATUS_META, formatLabel, seriesLabel } from '../types';
import { spineWidthPx } from '../bookSpine';
import type { LibraryViewMode } from '../libraryViews';
import { useWindowWidth } from '../hooks';
import { StarRating } from './StarRating';
import { BookCover, BookSpine, cardCls, cx } from './ui';

interface LibraryViewsProps {
  books: Book[];
  view: Exclude<LibraryViewMode, 'grid' | 'list'>;
  onOpen: (book: Book) => void;
  onOpenSeries: (seriesName: string) => void;
}

type CommonLibraryViewProps = Omit<LibraryViewsProps, 'view'>;

export function LibraryViews({ books, view, onOpen, onOpenSeries }: LibraryViewsProps) {
  if (view === 'spines') return <SpinesView books={books} onOpen={onOpen} />;
  if (view === 'stacks') return <StacksView books={books} onOpen={onOpen} onOpenSeries={onOpenSeries} />;
  if (view === 'wall') return <CoverWallView books={books} onOpen={onOpen} />;
  if (view === 'showcase') return <ShowcaseView books={books} onOpen={onOpen} onOpenSeries={onOpenSeries} />;
  if (view === 'gallery') return <GalleryView books={books} onOpen={onOpen} onOpenSeries={onOpenSeries} />;
  if (view === 'catalog') return <CatalogView books={books} onOpen={onOpen} onOpenSeries={onOpenSeries} />;
  return <ShelfCoversView books={books} variant={view} onOpen={onOpen} onOpenSeries={onOpenSeries} />;
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function chunk<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size);
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) {
    result.push(items.slice(index, index + safeSize));
  }
  return result;
}

function SeriesButton({ book, onOpenSeries, className = '' }: {
  book: Book;
  onOpenSeries: (seriesName: string) => void;
  className?: string;
}) {
  const label = seriesLabel(book);
  if (!label || !book.series?.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenSeries(book.series!.trim())}
      className={cx('max-w-full truncate font-extrabold uppercase tracking-wide text-accent transition-colors hover:text-ink hover:underline', className)}
      aria-label={`Abrir la saga ${book.series}`}
      title={`Abrir la saga ${book.series}`}
    >
      {label}
    </button>
  );
}

function BookLabel({ book, onOpen, onOpenSeries, align = 'center' }: {
  book: Book;
  onOpen: (book: Book) => void;
  onOpenSeries: (seriesName: string) => void;
  align?: 'center' | 'left';
}) {
  const centered = align === 'center';
  return (
    <div className={cx('min-w-0', centered ? 'text-center' : 'text-left')}>
      <h3 className="line-clamp-2 min-h-[2.45em] font-display text-[12px] font-semibold leading-snug text-ink sm:text-sm">
        <button type="button" onClick={() => onOpen(book)} className={cx('hover:text-accent', centered ? 'text-center' : 'text-left')}>
          {book.title}
        </button>
      </h3>
      <p className="mt-0.5 truncate text-[11px] text-ink3">{book.author || 'Autor desconocido'}</p>
      <div className={cx('mt-0.5 flex min-h-4 items-center gap-1.5', centered && 'justify-center')}>
        <SeriesButton book={book} onOpenSeries={onOpenSeries} className="text-[9px] sm:text-[10px]" />
      </div>
      <div className={cx('mt-1 flex min-h-4 items-center gap-1.5 text-[10px] font-semibold text-ink3', centered && 'justify-center')}>
        <span className={cx('h-1.5 w-1.5 rounded-full', STATUS_META[book.status].dot)} aria-hidden />
        <span>{STATUS_META[book.status].label}</span>
        {book.pages > 0 && <span className="tabular-nums">· {book.pages} págs</span>}
      </div>
      <div className={cx('mt-1 flex min-h-4 items-center', centered && 'justify-center')}>
        {book.rating > 0
          ? <StarRating value={book.rating} size={10} />
          : <span className="text-[9px] font-semibold uppercase tracking-wide text-ink3/80">Sin nota</span>}
      </div>
    </div>
  );
}

function CoverButton({ book, onOpen, className = '', style }: {
  book: Book;
  onOpen: (book: Book) => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(book)}
      className={cx('group relative block shrink-0 text-left', className)}
      style={style}
      aria-label={`Abrir ficha de ${book.title}`}
    >
      <BookCover
        title={book.title}
        author={book.author}
        coverUrl={book.coverUrl}
        detail="md"
        className="aspect-[2/3] w-full shadow-book transition-all duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-1"
      />
      <span
        className={cx('absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full shadow ring-2 ring-white/85', STATUS_META[book.status].dot)}
        title={STATUS_META[book.status].label}
        aria-hidden
      />
      <span className="pointer-events-none absolute -bottom-1 left-[10%] right-[10%] h-2 rounded-full bg-black/25 blur-[3px]" aria-hidden />
    </button>
  );
}

/* ---------- Baldas de madera / flotantes ---------- */

function ShelfCoversView({ books, variant, onOpen, onOpenSeries }: {
  books: Book[];
  variant: 'wood' | 'floating';
  onOpen: (book: Book) => void;
  onOpenSeries: (seriesName: string) => void;
}) {
  const width = useWindowWidth();
  const perShelf = variant === 'wood'
    ? (width < 520 ? 3 : width < 850 ? 4 : width < 1180 ? 5 : 6)
    : (width < 520 ? 2 : width < 850 ? 3 : width < 1180 ? 4 : 5);
  const shelves = chunk(books, perShelf);
  const wood = variant === 'wood';

  return (
    <div className={cx(
      wood
        ? cx(cardCls, 'relative overflow-hidden bg-gradient-to-b from-sunken/55 via-surface to-sunken/30 px-3 py-6 sm:px-6')
        : 'space-y-9 px-1 py-3 sm:px-3',
    )}>
      {wood && (
        <>
          <span className="pointer-events-none absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/15 to-transparent" aria-hidden />
          <span className="pointer-events-none absolute inset-y-0 right-0 w-2.5 bg-gradient-to-l from-black/15 to-transparent" aria-hidden />
          <span className="pointer-events-none absolute inset-x-16 top-0 h-24 rounded-b-full bg-glow/10 blur-2xl" aria-hidden />
        </>
      )}

      <div className="relative space-y-8">
        {shelves.map((shelf, shelfIndex) => (
          <section key={shelfIndex} aria-label={`Balda ${shelfIndex + 1}`}>
            <div
              className="grid items-end gap-x-3 px-1 sm:gap-x-5 sm:px-3"
              style={{ gridTemplateColumns: `repeat(${perShelf}, minmax(0, 1fr))` }}
            >
              {shelf.map((book) => {
                const coverWidth = 82 + (hashText(`${book.title}${book.author}`) % 19);
                return (
                  <div key={book.id} className="flex min-w-0 items-end justify-center">
                    <CoverButton
                      book={book}
                      onOpen={onOpen}
                      style={{ width: `${coverWidth}%`, maxWidth: wood ? 146 : 176 }}
                    />
                  </div>
                );
              })}
              {shelf.length < perShelf && Array.from({ length: perShelf - shelf.length }).map((_, index) => (
                <div key={index} className="hidden min-h-24 items-end justify-center pb-5 opacity-45 sm:flex" aria-hidden>
                  <span className="flex h-20 w-8 rotate-6 items-center justify-center rounded-sm border border-dashed border-line2 text-line2">
                    <BookMarked size={15} />
                  </span>
                </div>
              ))}
            </div>

            {wood ? (
              <>
                <div className="shelf-board mt-1 h-4 rounded-[5px]" aria-hidden />
                <div className="flex justify-between px-8" aria-hidden>
                  <span className="h-3.5 w-3 rounded-b bg-black/20" />
                  <span className="h-3.5 w-3 rounded-b bg-black/20" />
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 h-2 rounded-full bg-raised shadow-lift ring-1 ring-line" aria-hidden />
                <div className="mx-10 h-3 rounded-b-full bg-black/10 blur-[3px]" aria-hidden />
              </>
            )}

            <div
              className="mt-3 grid gap-x-3 px-0.5 sm:gap-x-5 sm:px-2"
              style={{ gridTemplateColumns: `repeat(${perShelf}, minmax(0, 1fr))` }}
            >
              {shelf.map((book) => (
                <BookLabel key={book.id} book={book} onOpen={onOpen} onOpenSeries={onOpenSeries} />
              ))}
              {shelf.length < perShelf && Array.from({ length: perShelf - shelf.length }).map((_, index) => (
                <span key={index} aria-hidden />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ---------- Lomos ---------- */

function spineHeight(book: Book): number {
  const pages = book.pages || 320;
  return Math.round(198 + Math.min(58, Math.max(0, pages - 120) / 16));
}

function chunkSpines(books: Book[], availableWidth: number): Book[][] {
  const rows: Book[][] = [];
  let current: Book[] = [];
  let currentWidth = 0;

  for (const book of books) {
    const width = spineWidthPx(book) + 4;
    if (current.length && currentWidth + width > availableWidth) {
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(book);
    currentWidth += width;
  }
  if (current.length) rows.push(current);
  return rows;
}

function SpinesView({ books, onOpen }: { books: Book[]; onOpen: (book: Book) => void }) {
  const windowWidth = useWindowWidth();
  // El contenido principal tiene ancho máximo y, en escritorio, deja sitio a
  // la barra lateral. Calcular con la ventana entera recortaría las baldas en
  // pantallas muy anchas.
  const pagePadding = windowWidth >= 1280 ? 64 : windowWidth >= 640 ? 48 : 32;
  const cardPadding = windowWidth >= 640 ? 48 : 24;
  const mainWidth = windowWidth >= 1024
    ? Math.min(1152, windowWidth - 272)
    : windowWidth;
  const availableWidth = Math.max(240, mainWidth - pagePadding - cardPadding - 16);
  const rows = chunkSpines(books, availableWidth);

  return (
    <div className="space-y-4">
      <div className={cx(cardCls, 'relative overflow-hidden bg-gradient-to-b from-sunken/50 via-surface to-sunken/25 px-3 py-6 sm:px-6')}>
        <span className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/15 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/15 to-transparent" aria-hidden />
        <div className="relative space-y-8">
          {rows.map((row, rowIndex) => (
            <section key={rowIndex} aria-label={`Balda de lomos ${rowIndex + 1}`}>
              <div className="flex items-end gap-1 px-1 sm:px-3">
                {row.map((book, index) => {
                  const width = spineWidthPx(book);
                  const tilt = index === row.length - 1 && row.length > 3 ? -2.2 : (hashText(book.id || book.title) % 3) - 1;
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => onOpen(book)}
                      className="group relative shrink-0 origin-bottom transition-all duration-300 hover:z-10 hover:-translate-y-2"
                      style={{ width, transform: `rotate(${tilt * 0.45}deg)` }}
                      aria-label={`Abrir ficha de ${book.title}`}
                      title={`${book.title}${book.author ? ` · ${book.author}` : ''}${seriesLabel(book) ? ` · ${seriesLabel(book)}` : ''}`}
                    >
                      <span className="block" style={{ height: spineHeight(book) }}>
                        <BookSpine book={book} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]" />
                      </span>
                      <span
                        className={cx('absolute -top-1.5 right-0 h-2.5 w-2.5 rounded-full shadow ring-2 ring-surface', STATUS_META[book.status].dot)}
                        title={STATUS_META[book.status].label}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
              <div className="shelf-board mt-0.5 h-4 rounded-[5px]" aria-hidden />
              <div className="flex justify-between px-8" aria-hidden>
                <span className="h-3.5 w-3 rounded-b bg-black/20" />
                <span className="h-3.5 w-3 rounded-b bg-black/20" />
              </div>
            </section>
          ))}
        </div>
      </div>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-ink3">
        <Info size={14} className="mt-0.5 shrink-0 text-accent" />
        <span>
          Para cada libro busco primero una imagen de lomo asociada a su ISBN. Cuando no existe una válida —la mayoría de fuentes solo publican la portada frontal—, Bilibook compone el lomo con la portada y los datos de tu edición. El grosor varía según sus páginas.
        </span>
      </p>
    </div>
  );
}

/* ---------- Vitrina ---------- */

function ShowcaseView({ books, onOpen, onOpenSeries }: CommonLibraryViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((book) => (
        <article key={book.id} className={cx(cardCls, 'group relative overflow-hidden')}>
          <span className="pointer-events-none absolute inset-x-8 top-0 h-16 rounded-b-full bg-glow/15 blur-xl" aria-hidden />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/5 opacity-60" aria-hidden />
          <div className="relative px-4 pt-5">
            <div className="flex justify-center">
              <CoverButton book={book} onOpen={onOpen} className="w-[58%] max-w-[132px]" />
            </div>
            <div className="shelf-board mt-1 h-3 rounded" aria-hidden />
          </div>
          <div className="relative px-3 pb-4 pt-3 sm:px-4">
            <BookLabel book={book} onOpen={onOpen} onOpenSeries={onOpenSeries} />
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- Pilas ---------- */

const STACK_COLORS: [string, string, string][] = [
  ['#8C4A32', '#61321F', '#FFF0E2'],
  ['#2E5E4E', '#1E4135', '#E6F4EC'],
  ['#2F4D73', '#1E3450', '#E3EEFA'],
  ['#6B427F', '#482B57', '#F1E7F7'],
  ['#94702E', '#654A1E', '#FFF3D9'],
  ['#7C3049', '#532032', '#FBE7EE'],
  ['#256B6B', '#174949', '#DFF5F2'],
  ['#41414B', '#282832', '#ECECF2'],
];

function StacksView({ books, onOpen, onOpenSeries }: CommonLibraryViewProps) {
  const groups = chunk(books, 5);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group, groupIndex) => (
        <section key={groupIndex} className={cx(cardCls, 'relative overflow-hidden px-4 pb-5 pt-6 sm:px-5')} aria-label={`Pila ${groupIndex + 1}`}>
          <span className="pointer-events-none absolute inset-x-10 top-0 h-16 rounded-b-full bg-glow/10 blur-xl" aria-hidden />
          <div className="relative flex flex-col">
            {group.map((book, index) => {
              const [from, to, ink] = STACK_COLORS[hashText(`${book.title}${book.author}`) % STACK_COLORS.length];
              const offset = ((hashText(book.id || book.title) % 13) - 6);
              const rotation = (((hashText(`${book.title}x`) % 5) - 2) * 0.35);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onOpen(book)}
                  className="group relative -mt-1 flex h-14 w-[calc(100%-14px)] items-center self-center overflow-hidden rounded-l-md rounded-r-[3px] text-left shadow-book ring-1 ring-black/15 transition-all first:mt-0 hover:z-10 hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${to} 0%, ${from} 22%, ${to} 100%)`,
                    color: ink,
                    transform: `translateX(${offset}px) rotate(${rotation}deg)`,
                    zIndex: group.length - index,
                  }}
                  aria-label={`Abrir ficha de ${book.title}`}
                >
                  {book.coverUrl?.trim() && (
                    <img
                      src={book.coverUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-20"
                      style={{ objectPosition: '20% 50%' }}
                      aria-hidden
                    />
                  )}
                  <span className="relative h-full w-2 shrink-0 bg-black/25" aria-hidden />
                  <span className="relative min-w-0 flex-1 px-3">
                    <span className="block truncate font-display text-sm font-semibold leading-tight">{book.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold uppercase tracking-wide opacity-75">
                      {book.author || 'Autor desconocido'}{seriesLabel(book) ? ` · ${seriesLabel(book)}` : ''}
                    </span>
                  </span>
                  <span className={cx('relative mr-2 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/70', STATUS_META[book.status].dot)} aria-hidden />
                  <span
                    className="relative h-full w-9 shrink-0 border-l border-black/15 bg-[#fff8e8]"
                    style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 3px, rgb(92 70 38 / 0.16) 3px 4px)' }}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <div className="relative mx-3 mt-2 h-3 rounded-[50%] bg-black/20 blur-[4px]" aria-hidden />
          <div className="relative mt-3 flex flex-wrap justify-center gap-x-2 gap-y-1">
            {group.map((book) => (
              <SeriesButton key={book.id} book={book} onOpenSeries={onOpenSeries} className="text-[9px]" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------- Muro de portadas ---------- */

function CoverWallView({ books, onOpen }: { books: Book[]; onOpen: (book: Book) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 overflow-hidden rounded-card bg-black/10 p-1 shadow-card ring-1 ring-line min-[420px]:grid-cols-5 sm:grid-cols-6 lg:grid-cols-8">
      {books.map((book) => (
        <button
          key={book.id}
          type="button"
          onClick={() => onOpen(book)}
          className="group relative block aspect-[2/3] overflow-hidden bg-sunken text-left focus-visible:z-10"
          aria-label={`Abrir ficha de ${book.title}`}
          title={`${book.title}${book.author ? ` · ${book.author}` : ''}`}
        >
          <BookCover
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl}
            detail="lg"
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <span className={cx('absolute right-1.5 top-1.5 h-2 w-2 rounded-full shadow ring-1 ring-white/85', STATUS_META[book.status].dot)} aria-hidden />
          <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-2 pt-8 text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <span className="line-clamp-2 text-[10px] font-bold leading-tight">{book.title}</span>
            <span className="mt-0.5 block truncate text-[9px] opacity-75">{book.author || 'Autor desconocido'}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Galería ---------- */

function GalleryView({ books, onOpen, onOpenSeries }: CommonLibraryViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {books.map((book) => (
        <article key={book.id} className="rounded-card bg-raised p-2.5 shadow-card ring-1 ring-line sm:p-3">
          <div className="rounded-[6px] border-[6px] border-line2/80 bg-surface p-1.5 shadow-inner sm:border-[8px]">
            <button type="button" onClick={() => onOpen(book)} className="group relative block w-full" aria-label={`Abrir ficha de ${book.title}`}>
              <BookCover
                title={book.title}
                author={book.author}
                coverUrl={book.coverUrl}
                detail="lg"
                className="aspect-[2/3] w-full transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <span className={cx('absolute right-2 top-2 h-2.5 w-2.5 rounded-full shadow ring-2 ring-white/85', STATUS_META[book.status].dot)} aria-hidden />
            </button>
          </div>
          <div className="px-1 pb-1 pt-3">
            <BookLabel book={book} onOpen={onOpen} onOpenSeries={onOpenSeries} />
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- Fichero / catálogo ---------- */

function CatalogView({ books, onOpen, onOpenSeries }: CommonLibraryViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {books.map((book) => (
        <article
          key={book.id}
          className="relative overflow-hidden rounded-card border border-line bg-raised shadow-card"
          style={{
            backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 27px, rgb(var(--line) / 0.28) 27px 28px)',
          }}
        >
          <span className={cx('absolute right-4 top-0 rounded-b-md px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider', STATUS_META[book.status].badge)}>
            {STATUS_META[book.status].label}
          </span>
          <span className="absolute bottom-3 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-bg ring-1 ring-line" aria-hidden />
          <div className="flex gap-3.5 p-4 pb-8">
            <CoverButton book={book} onOpen={onOpen} className="w-16 sm:w-[72px]" />
            <div className="min-w-0 flex-1 pt-4">
              <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug text-ink">
                <button type="button" onClick={() => onOpen(book)} className="text-left hover:text-accent">{book.title}</button>
              </h3>
              <p className="mt-0.5 truncate text-xs text-ink3">{book.author || 'Autor desconocido'}</p>
              <SeriesButton book={book} onOpenSeries={onOpenSeries} className="mt-1 text-[9px]" />
              <dl className="mt-3 space-y-1 text-[11px] leading-relaxed text-ink2">
                <CatalogLine label="Formato" value={formatLabel(book.format)} />
                <CatalogLine label="Páginas" value={book.pages > 0 ? book.pages.toLocaleString('es') : '—'} />
                <CatalogLine label="ISBN" value={book.isbn || '—'} />
              </dl>
              <div className="mt-2">
                {book.rating > 0
                  ? <StarRating value={book.rating} size={11} />
                  : <span className="text-[10px] font-semibold uppercase tracking-wide text-ink3">Sin nota</span>}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CatalogLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="w-14 shrink-0 font-extrabold uppercase tracking-wide text-ink3">{label}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium">{value}</dd>
    </div>
  );
}
