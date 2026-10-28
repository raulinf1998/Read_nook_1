import { useMemo, type ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  FileText,
  Layers,
  Library,
  Pencil,
  Play,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import type { Book } from '../types';
import { formatLabel, languageLabel } from '../types';
import {
  bookSeriesPositionValue,
  missingSeriesPositions,
  nextSeriesBook,
  seriesBookProgress,
  type SeriesGroup,
} from '../series';
import { spineWidthPx } from '../bookSpine';
import { useWindowWidth } from '../hooks';
import { StarRating } from './StarRating';
import {
  BookCover,
  BookSpine,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  btnGhost,
  btnPrimary,
  btnSoft,
  cardCls,
  cx,
  iconBtn,
} from './ui';

interface Props {
  group: SeriesGroup;
  onBack: () => void;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onUpdate: (id: string, patch: Partial<Book>) => void;
}

type TimelineItem =
  | { kind: 'book'; book: Book; position: number; order: number }
  | { kind: 'missing'; position: number; order: number };

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function publishYear(book: Book): string {
  return (book.publishDate || '').match(/\d{4}/)?.[0] || '';
}

function positionLabel(book: Book, fallback: number): string {
  const raw = (book.seriesPosition || '').trim().replace(/^#\s*/, '');
  return raw ? `#${raw}` : `Vol. ${fallback}`;
}

export function SeriesDetail({ group, onBack, onOpen, onEdit, onUpdate }: Props) {
  const books = group.books;
  const windowWidth = useWindowWidth();
  const fanOffset = windowWidth < 640 ? 38 : 58;

  const stats = useMemo(() => {
    const read = books.filter((book) => book.status === 'read');
    const reading = books.filter((book) => book.status === 'reading');
    const pending = books.filter((book) => book.status === 'pending');
    const dnf = books.filter((book) => book.status === 'dnf');
    const rated = books.filter((book) => book.rating > 0);
    const totalPages = books.reduce((sum, book) => sum + Math.max(0, book.pages || 0), 0);
    const advancedPages = books.reduce((sum, book) => {
      if (book.pages <= 0) return sum;
      if (book.status === 'read') return sum + book.pages;
      return sum + Math.min(Math.max(book.currentPage || 0, 0), book.pages);
    }, 0);
    const journalEntries = books.flatMap((book) => book.journal || []);
    const journalPages = journalEntries.reduce((sum, entry) => sum + Math.max(0, entry.pages || 0), 0);
    const journalMinutes = journalEntries.reduce((sum, entry) => sum + Math.max(0, entry.minutes || 0), 0);
    const authors = [...new Set(books.map((book) => book.author.trim()).filter(Boolean))];
    const years = books.map(publishYear).filter(Boolean).sort();
    const tagCounts = new Map<string, number>();
    books.forEach((book) => book.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .slice(0, 6)
      .map(([tag]) => tag);

    return {
      read,
      reading,
      pending,
      dnf,
      rated,
      totalPages,
      advancedPages,
      journalEntries,
      journalPages,
      journalMinutes,
      authors,
      years,
      tags,
      averageRating: rated.length
        ? rated.reduce((sum, book) => sum + book.rating, 0) / rated.length
        : 0,
      readPct: books.length ? (read.length / books.length) * 100 : 0,
      pagePct: totalPages > 0 ? (advancedPages / totalPages) * 100 : 0,
    };
  }, [books]);

  const missing = useMemo(() => missingSeriesPositions(books), [books]);
  const nextBook = useMemo(() => nextSeriesBook(books), [books]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const bookItems: TimelineItem[] = books.map((book, index) => ({
      kind: 'book',
      book,
      position: bookSeriesPositionValue(book),
      order: index,
    }));
    const missingItems: TimelineItem[] = missing.map((position, index) => ({
      kind: 'missing',
      position,
      order: books.length + index,
    }));
    return [...bookItems, ...missingItems].sort((a, b) => (
      a.position - b.position || a.order - b.order
    ));
  }, [books, missing]);

  const fanBooks = books.slice(0, 5);
  const completed = books.length > 0 && stats.read.length === books.length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className={cx(btnGhost, 'px-3 py-2 text-xs')}>
          <ArrowLeft size={15} /> Volver
        </button>
        <span className="ml-auto rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-accent">
          Saga · {books.length} {books.length === 1 ? 'libro' : 'libros'} en tu biblioteca
        </span>
      </div>

      {/* Portada de la saga */}
      <section className={cx(cardCls, 'relative overflow-hidden')}>
        <span className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 right-10 h-72 w-72 rounded-full bg-glow/15 blur-3xl" aria-hidden />

        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-onprimary shadow-card">
              <Layers size={13} /> Saga
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] text-ink sm:text-5xl">
              {group.name}
            </h1>
            {stats.authors.length > 0 && (
              <p className="mt-3 text-base font-semibold text-ink2 sm:text-lg">
                {stats.authors.join(' · ')}
              </p>
            )}
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink2">
              {completed
                ? 'Ya has terminado todos los volúmenes que tienes guardados de esta saga. Aquí queda su ruta completa dentro de tu biblioteca.'
                : 'Tu colección de esta saga, en orden de lectura y con el avance de cada volumen de un vistazo.'}
              {missing.length > 0 && (
                <> He detectado {missing.length === 1 ? 'un hueco' : `${missing.length} huecos`} en la numeración: {missing.map((position) => `#${position}`).join(', ')}.</>
              )}
            </p>

            <div className="mt-6 max-w-xl rounded-card bg-sunken/65 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-extrabold text-ink">
                  {stats.read.length} de {books.length} {books.length === 1 ? 'libro leído' : 'libros leídos'}
                </p>
                <span className="text-lg font-extrabold tabular-nums text-accent">
                  {(stats.pagePct > 0 ? stats.pagePct : stats.readPct).toFixed(0)}%
                </span>
              </div>
              <ProgressBar pct={stats.pagePct > 0 ? stats.pagePct : stats.readPct} className="mt-2.5 h-2.5" />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-ink3">
                <span>{stats.reading.length} en curso</span>
                <span>{stats.pending.length} pendientes</span>
                {stats.dnf.length > 0 && <span>{stats.dnf.length} abandonados</span>}
                {stats.totalPages > 0 && <span>{stats.advancedPages.toLocaleString('es')} de {stats.totalPages.toLocaleString('es')} págs</span>}
                {stats.years.length > 0 && (
                  <span>{stats.years[0]}{stats.years[stats.years.length - 1] !== stats.years[0] ? `–${stats.years[stats.years.length - 1]}` : ''}</span>
                )}
              </div>
            </div>

            {stats.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {stats.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-sunken px-2.5 py-1 text-[11px] font-bold text-ink2">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Abanico de portadas */}
          <div className="relative mx-auto h-60 w-full max-w-[380px] sm:h-72" aria-label="Portadas de la saga">
            {fanBooks.map((book, index) => {
              const center = (fanBooks.length - 1) / 2;
              const offset = index - center;
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onOpen(book)}
                  className="group absolute bottom-3 left-1/2 w-24 origin-bottom transition-all duration-300 hover:z-30 hover:-translate-y-2 sm:w-36"
                  style={{
                    transform: `translateX(calc(-50% + ${offset * fanOffset}px)) rotate(${offset * 6}deg)`,
                    zIndex: 10 + index,
                  }}
                  aria-label={`Abrir ficha de ${book.title}`}
                >
                  <BookCover
                    title={book.title}
                    author={book.author}
                    coverUrl={book.coverUrl}
                    detail="lg"
                    className="aspect-[2/3] w-full shadow-pop ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>
              );
            })}
            <span className="absolute bottom-0 left-1/2 h-3 w-[88%] -translate-x-1/2 rounded-full bg-black/20 blur-md" aria-hidden />
          </div>
        </div>
      </section>

      {/* Siguiente paso */}
      {nextBook ? (
        <section className={cx(cardCls, 'relative overflow-hidden p-4 sm:p-5')}>
          <span className="pointer-events-none absolute right-0 top-0 h-full w-40 bg-gradient-to-l from-accent/10 to-transparent" aria-hidden />
          <div className="relative flex flex-wrap gap-4 sm:flex-nowrap sm:items-center">
            <button type="button" onClick={() => onOpen(nextBook)} className="shrink-0 self-start" aria-label={`Abrir ${nextBook.title}`}>
              <BookCover title={nextBook.title} author={nextBook.author} coverUrl={nextBook.coverUrl} detail="md" className="aspect-[2/3] w-20 shadow-book transition-transform hover:-translate-y-1 hover:-rotate-1" />
            </button>
            <div className="min-w-[180px] flex-1">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">
                <Sparkles size={13} /> {nextBook.status === 'reading' ? 'Continúa por aquí' : 'Siguiente en tu ruta'}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold leading-tight text-ink">
                <button type="button" onClick={() => onOpen(nextBook)} className="text-left hover:text-accent">
                  {positionLabel(nextBook, books.indexOf(nextBook) + 1)} · {nextBook.title}
                </button>
              </h2>
              <p className="mt-1 text-sm text-ink3">{nextBook.author || 'Autor desconocido'}</p>
              {nextBook.status === 'reading' && nextBook.pages > 0 && (
                <div className="mt-3 max-w-md">
                  <div className="mb-1 flex justify-between text-[11px] font-bold text-ink3">
                    <span>Página {nextBook.currentPage.toLocaleString('es')} de {nextBook.pages.toLocaleString('es')}</span>
                    <span>{seriesBookProgress(nextBook).toFixed(0)}%</span>
                  </div>
                  <ProgressBar pct={seriesBookProgress(nextBook)} className="h-2" />
                </div>
              )}
            </div>
            <div className="relative flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
              {nextBook.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => onUpdate(nextBook.id, { status: 'reading', startedAt: nextBook.startedAt ?? Date.now(), finishedAt: null })}
                  className={btnPrimary}
                >
                  <Play size={15} /> Empezar
                </button>
              )}
              <button type="button" onClick={() => onOpen(nextBook)} className={btnSoft}>
                Ver ficha y diario <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>
      ) : completed ? (
        <section className={cx(cardCls, 'flex items-center gap-4 p-5')}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-stread/15 text-stread">
            <Trophy size={22} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Saga completada en tu biblioteca</h2>
            <p className="mt-0.5 text-sm text-ink2">Has leído todos los volúmenes que tienes guardados de «{group.name}».</p>
          </div>
          <CheckCircle2 className="ml-auto shrink-0 text-stread" size={24} />
        </section>
      ) : null}

      {/* Resumen */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de la saga">
        <SeriesStat icon={<Library size={17} />} value={books.length.toLocaleString('es')} label="Volúmenes guardados" />
        <SeriesStat icon={<FileText size={17} />} value={stats.totalPages.toLocaleString('es')} label="Páginas totales" />
        <SeriesStat icon={<Star size={17} />} value={stats.averageRating ? stats.averageRating.toFixed(1) : '—'} label="Nota media" />
        <SeriesStat
          icon={<Clock3 size={17} />}
          value={stats.journalMinutes > 0 ? `${stats.journalMinutes.toLocaleString('es')} min` : stats.journalEntries.length.toLocaleString('es')}
          label={stats.journalMinutes > 0 ? 'Minutos registrados' : 'Entradas de diario'}
        />
      </section>

      {/* La saga como lomos en una balda */}
      <section className={cx(cardCls, 'overflow-hidden p-4 sm:p-5')}>
        <SectionHeader icon={<Library size={17} />} title="La saga en la balda" count={books.length} />
        <div className="overflow-x-auto pb-1 no-scrollbar">
          <div className="min-w-max">
          <div className="flex items-end gap-1 px-2 pt-2">
            {books.map((book) => {
              const width = spineWidthPx(book);
              const height = Math.round(190 + Math.min(62, Math.max(0, book.pages || 320) / 14));
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => onOpen(book)}
                  className="group shrink-0 transition-transform duration-300 hover:-translate-y-2"
                  style={{ width }}
                  aria-label={`Abrir ficha de ${book.title}`}
                  title={`${positionLabel(book, books.indexOf(book) + 1)} · ${book.title}`}
                >
                  <span className="block" style={{ height }}>
                    <BookSpine book={book} className="h-full w-full" />
                  </span>
                  <span className="sr-only">{book.title}</span>
                </button>
              );
            })}
          </div>
          <div className="shelf-board h-4 rounded-[5px]" aria-hidden />
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] font-medium text-ink3">
          Toca un lomo para abrir ese volumen.
        </p>
      </section>

      {/* Orden de lectura */}
      <section className={cx(cardCls, 'p-4 sm:p-6')}>
        <SectionHeader icon={<BookOpen size={17} />} title="Orden de lectura" count={books.length} />
        <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[21px] before:top-4 before:w-px before:bg-line">
          {timeline.map((item) => {
            if (item.kind === 'missing') {
              return (
                <li key={`missing-${item.position}`} className="relative flex gap-3 sm:gap-4">
                  <span className="relative z-10 flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full border border-dashed border-line2 bg-sunken text-ink3">
                    <CircleDashed size={19} />
                  </span>
                  <div className="flex min-h-[92px] flex-1 items-center rounded-card border border-dashed border-line2 bg-sunken/35 px-4 py-3">
                    <div>
                      <p className="text-sm font-extrabold text-ink2">#{item.position} · Hueco en tu colección</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink3">
                        No tienes guardado un volumen con esta posición entre los libros anteriores y posteriores.
                      </p>
                    </div>
                    <Bookmark className="ml-auto shrink-0 text-ink3/60" size={20} />
                  </div>
                </li>
              );
            }

            const book = item.book;
            const progress = seriesBookProgress(book);
            const bookOrder = books.indexOf(book) + 1;
            return (
              <li key={book.id} className="relative flex gap-3 sm:gap-4">
                <span className={cx(
                  'relative z-10 flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold shadow-card ring-4 ring-surface',
                  book.status === 'read'
                    ? 'bg-stread text-white'
                    : book.status === 'reading'
                      ? 'bg-streading text-white'
                      : book.status === 'dnf'
                        ? 'bg-danger text-white'
                        : 'bg-sunken text-ink2',
                )}>
                  {positionLabel(book, bookOrder)}
                </span>

                <article className="min-w-0 flex-1 rounded-card border border-line bg-sunken/35 p-3 transition-all hover:border-accent/35 hover:bg-surface hover:shadow-lift sm:p-4">
                  <div className="flex gap-3.5">
                    <button type="button" onClick={() => onOpen(book)} className="shrink-0" aria-label={`Abrir ficha de ${book.title}`}>
                      <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="md" className="aspect-[2/3] w-16 shadow-book transition-transform hover:-translate-y-1 hover:-rotate-1 sm:w-20" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-semibold leading-snug text-ink sm:text-lg">
                            <button type="button" onClick={() => onOpen(book)} className="text-left hover:text-accent">
                              {book.title}
                            </button>
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-ink3 sm:text-sm">{book.author || 'Autor desconocido'}</p>
                        </div>
                        <StatusBadge status={book.status} />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-ink3">
                        {publishYear(book) && <span>{publishYear(book)}</span>}
                        {book.pages > 0 && <span>{book.pages.toLocaleString('es')} págs</span>}
                        <span>{formatLabel(book.format)}</span>
                        <span>{languageLabel(book.language)}</span>
                        {(book.journal?.length || 0) > 0 && <span>{book.journal.length} entradas de diario</span>}
                        {book.finishedAt && <span>Terminado: {formatDate(book.finishedAt)}</span>}
                      </div>

                      {(book.status === 'reading' || book.status === 'dnf') && book.pages > 0 && (
                        <div className="mt-3 max-w-lg">
                          <div className="mb-1 flex justify-between text-[11px] font-bold text-ink3">
                            <span>Página {book.currentPage.toLocaleString('es')} de {book.pages.toLocaleString('es')}</span>
                            <span className="text-accent">{progress.toFixed(0)}%</span>
                          </div>
                          <ProgressBar pct={progress} className="h-2" />
                        </div>
                      )}

                      {book.description?.trim() && (
                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink2 sm:text-sm">
                          {book.description.trim()}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {book.rating > 0 ? (
                          <span className="inline-flex items-center gap-2 text-xs font-bold text-ink2">
                            <StarRating value={book.rating} size={12} /> {book.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-ink3">Sin nota</span>
                        )}
                        <span className="ml-auto flex items-center gap-1.5">
                          <button type="button" onClick={() => onOpen(book)} className={cx(btnSoft, 'px-2.5 py-1.5 text-[11px]')}>
                            Ficha y diario <ChevronRight size={12} />
                          </button>
                          <button type="button" onClick={() => onEdit(book)} className={cx(iconBtn, 'p-2')} aria-label={`Editar ${book.title}`}>
                            <Pencil size={15} />
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function SeriesStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className={cx(cardCls, 'flex items-center gap-3 p-3.5 sm:p-4')}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-semibold leading-none tabular-nums text-ink">{value}</span>
        <span className="mt-1 block truncate text-[10px] font-extrabold uppercase tracking-wide text-ink3">{label}</span>
      </span>
    </div>
  );
}
