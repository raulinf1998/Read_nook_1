import { useState } from 'react';
import { BookOpen, Bookmark, ChevronRight, Sparkles, Plus, Library, Target, CheckCircle2, NotebookPen } from 'lucide-react';
import type { Book } from '../types';
import { seriesLabel } from '../types';
import { ProgressLogModal } from './JournalModal';
import { completedReadings } from '../rereads';
import { BookCover, EmptyState, ProgressBar, SectionHeader, bookProgress, btnSoft, cardCls, cx } from './ui';

interface Props {
  books: Book[];
  goal: number;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onEdit: (book: Book) => void;
  onOpen: (book: Book) => void;
  onOpenSeries: (seriesName: string) => void;
  onAdd: () => void;
  onLoadDemo: () => void;
  onGoChallenge: () => void;
}

function setPage(book: Book, page: number, onUpdate: Props['onUpdate']) {
  const clamped = book.pages > 0 ? Math.min(Math.max(page, 0), book.pages) : Math.max(page, 0);
  const patch: Partial<Book> = { currentPage: clamped };
  if (book.pages > 0 && clamped >= book.pages) {
    patch.status = 'read';
    patch.finishedAt = Date.now();
  }
  onUpdate(book.id, patch);
}

export function ReadingNow({ books, goal, onUpdate, onEdit, onOpen, onOpenSeries, onAdd, onLoadDemo, onGoChallenge }: Props) {
  const reading = books.filter((b) => b.status === 'reading');
  const pending = books.filter((b) => b.status === 'pending');
  const year = new Date().getFullYear();
  const readThisYear = books.flatMap(completedReadings).filter(
    (b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === year
  ).length;
  const [progressBookId, setProgressBookId] = useState<string | null>(null);
  const progressBook = progressBookId ? books.find((book) => book.id === progressBookId) || null : null;

  // Biblioteca completamente vacía: bienvenida con atajos
  if (books.length === 0) {
    return (
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-card shadow-lift bg-grad-primary text-ongrad px-6 py-10 sm:px-10">
          <BookOpen size={220} strokeWidth={0.6} className="absolute -right-8 -bottom-10 opacity-[0.13] rotate-[-8deg]" aria-hidden />
          <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">Bienvenido/a a</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mt-1.5">Tu rincón de lectura</h2>
          <p className="text-sm sm:text-base opacity-90 mt-2 max-w-md leading-relaxed">
            Registra lo que lees, sigue tu progreso página a página, ponte un reto anual y mira crecer tu estantería.
          </p>
          <div className="flex flex-wrap gap-2.5 mt-6">
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-btn bg-white/95 text-neutral-900 text-sm font-bold shadow-lift hover:bg-white active:scale-[0.98] transition-all"
            >
              <Plus size={16} strokeWidth={2.5} /> Añadir mi primer libro
            </button>
            <button
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-btn bg-ongrad/10 ring-1 ring-ongrad/35 text-sm font-bold hover:bg-ongrad/20 active:scale-[0.98] transition-all"
            >
              <Sparkles size={16} /> Explorar con libros de ejemplo
            </button>
          </div>
        </div>
        <p className="text-xs text-ink3 text-center">
          ¿Ya tienes biblioteca en TheStoryGraph? Impórtala desde el icono de subida.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <SummaryCard icon={<Library size={17} />} label="En tu biblioteca" value={books.length} />
        <SummaryCard icon={<BookOpen size={17} />} label="Leyendo ahora" value={reading.length} />
        <SummaryCard icon={<Bookmark size={17} />} label="Pendientes" value={pending.length} />
        <button
          onClick={onGoChallenge}
          className={cx(cardCls, 'p-4 text-left hover:shadow-lift hover:-translate-y-0.5 transition-all group')}
        >
          <span className="flex items-center justify-between">
            <span className="w-8 h-8 rounded-btn bg-accent/10 text-accent flex items-center justify-center"><Target size={17} /></span>
            <ChevronRight size={15} className="text-ink3 group-hover:translate-x-0.5 transition-transform" />
          </span>
          <span className="block font-display text-2xl font-semibold text-ink mt-2 leading-none">
            {readThisYear}
            <span className="text-base text-ink3 font-medium"> / {goal}</span>
          </span>
          <span className="block text-[11px] font-medium text-ink3 mt-1.5">Reto {year}</span>
          <ProgressBar pct={goal > 0 ? (readThisYear / goal) * 100 : 0} className="h-1.5 mt-2" />
        </button>
      </div>

      {/* Leyendo ahora */}
      <section>
        <SectionHeader icon={<BookOpen size={16} />} title="Leyendo ahora" count={reading.length} />
        {reading.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={26} />}
            title="Ningún libro entre manos"
            description="Cuando empieces un libro aparecerá aquí con su progreso. Elige uno de tus pendientes o añade uno nuevo."
          >
            <button onClick={onAdd} className={btnSoft}>
              <Plus size={14} strokeWidth={2.5} /> Añadir libro
            </button>
          </EmptyState>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2 stagger">
            {reading.map((book) => (
              <ReadingCard
                key={book.id}
                book={book}
                onUpdate={onUpdate}
                onOpen={onOpen}
                onOpenSeries={onOpenSeries}
                onLogProgress={(item) => setProgressBookId(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pendientes */}
      <section>
        <SectionHeader icon={<Bookmark size={16} />} title="Lecturas pendientes" count={pending.length} />
        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={26} />}
            title="Sin pendientes. ¡Al día!"
            description="Tu pila de «por leer» está vacía. Es el momento perfecto para curiosear novedades o releer un favorito."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 stagger">
            {pending.map((book) => (
              <div
                key={book.id}
                className={cx(cardCls, 'group p-3 flex items-center gap-3.5 hover:shadow-lift hover:-translate-y-0.5 transition-all')}
              >
                <button onClick={() => onOpen(book)} className="shrink-0" aria-label={`Abrir ficha de ${book.title}`}>
                  <BookCover
                    title={book.title}
                    author={book.author}
                    coverUrl={book.coverUrl}
                    detail="sm"
                    className="w-12 h-[72px] shadow-book group-hover:-rotate-2 transition-transform duration-300"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-ink text-[15px] leading-snug line-clamp-2">
                    <button onClick={() => onOpen(book)} className="text-left hover:text-accent transition-colors">{book.title}</button>
                  </h3>
                  <p className="text-xs text-ink3 truncate mt-0.5">{book.author || 'Autor desconocido'}</p>
                  {seriesLabel(book) && book.series?.trim() && (
                    <button type="button" onClick={() => onOpenSeries(book.series!.trim())} className="mt-0.5 block max-w-full truncate text-left text-[10px] font-extrabold uppercase tracking-wide text-accent hover:text-ink hover:underline" aria-label={`Abrir la saga ${book.series}`}>
                      {seriesLabel(book)}
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {book.pages > 0 && <span className="text-[11px] font-medium text-ink3">{book.pages} págs</span>}
                    {book.tags.slice(0, 2).map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sunken text-ink2">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => onUpdate(book.id, { status: 'reading', startedAt: Date.now() })}
                    className={btnSoft}
                  >
                    Empezar
                  </button>
                  <button
                    onClick={() => onEdit(book)}
                    className="text-[11px] font-semibold text-ink3 hover:text-ink inline-flex items-center justify-center gap-0.5 transition-colors py-1"
                  >
                    Editar <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {progressBook && (
        <ProgressLogModal book={progressBook} onUpdate={onUpdate} onClose={() => setProgressBookId(null)} />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={cx(cardCls, 'p-4')}>
      <span className="w-8 h-8 rounded-btn bg-accent/10 text-accent flex items-center justify-center">{icon}</span>
      <span className="block font-display text-2xl font-semibold text-ink mt-2 leading-none tabular-nums">{value}</span>
      <span className="block text-[11px] font-medium text-ink3 mt-1.5">{label}</span>
    </div>
  );
}

function ReadingCard({
  book,
  onUpdate,
  onOpen,
  onOpenSeries,
  onLogProgress,
}: {
  book: Book;
  onUpdate: Props['onUpdate'];
  onOpen: (b: Book) => void;
  onOpenSeries: (seriesName: string) => void;
  onLogProgress: (b: Book) => void;
}) {
  const pct = bookProgress(book);
  const remaining = book.pages > 0 ? Math.max(book.pages - book.currentPage, 0) : null;
  const progressActions = (
    <div className="flex items-center gap-1.5 mt-2">
      <button type="button" onClick={() => onLogProgress(book)} className={cx(btnSoft, 'px-2.5 py-1.5 text-[11px]')}>
        <NotebookPen size={13} /> Registrar avance
      </button>
      <button
        type="button"
        onClick={() => onOpen(book)}
        className="ml-auto text-[11px] font-bold text-accent hover:underline inline-flex items-center gap-0.5 py-1.5"
      >
        Ficha y diario <ChevronRight size={12} />
      </button>
    </div>
  );

  return (
    <article className={cx(cardCls, 'p-4 sm:p-5 hover:shadow-lift transition-shadow')}>
      <div className="flex gap-4">
        <button onClick={() => onOpen(book)} className="shrink-0 self-start" aria-label={`Abrir ficha de ${book.title}`}>
          <BookCover
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl}
            detail="md"
            className="w-[84px] h-[126px] sm:w-24 sm:h-36 shadow-book hover:-translate-y-1 hover:-rotate-1 transition-transform duration-300"
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-ink text-base sm:text-lg leading-snug line-clamp-2">
                <button onClick={() => onOpen(book)} className="text-left hover:text-accent transition-colors">{book.title}</button>
              </h3>
              <p className="text-xs sm:text-sm text-ink3 truncate mt-0.5">{book.author || 'Autor desconocido'}</p>
              {seriesLabel(book) && book.series?.trim() && (
                    <button type="button" onClick={() => onOpenSeries(book.series!.trim())} className="mt-0.5 block max-w-full truncate text-left text-[10px] font-extrabold uppercase tracking-wide text-accent hover:text-ink hover:underline" aria-label={`Abrir la saga ${book.series}`}>
                      {seriesLabel(book)}
                    </button>
                  )}
            </div>
            {/* Anillo de progreso */}
            <div className="relative w-12 h-12 shrink-0" title={`${pct.toFixed(0)}% leído`}>
              <svg width={48} height={48} className="-rotate-90">
                <circle cx={24} cy={24} r={20} fill="none" strokeWidth={5} style={{ stroke: 'rgb(var(--sunken))' }} />
                <circle
                  cx={24} cy={24} r={20} fill="none" strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
                  className="transition-all duration-500"
                  style={{ stroke: 'rgb(var(--primary))' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-ink tabular-nums">
                {pct.toFixed(0)}%
              </span>
            </div>
          </div>

          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {book.tags.slice(0, 3).map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-sunken text-ink2">{t}</span>
              ))}
            </div>
          )}

          <div className="mt-3.5">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-ink2 tabular-nums">
                Página {book.currentPage} <span className="text-ink3 font-medium">de {book.pages || '?'}</span>
              </span>
              {remaining !== null && remaining > 0 && (
                <span className="font-medium text-ink3 tabular-nums">Te quedan {remaining} págs</span>
              )}
              {remaining === 0 && <span className="font-bold text-stread">¡Terminado!</span>}
            </div>
            <ProgressBar pct={pct} className="h-2.5" />
          </div>

          {book.pages > 0 && (
            <div className="mt-3">
              {!(book.previousReadings?.length) && <input
                type="range"
                min={0}
                max={book.pages}
                value={book.currentPage}
                onChange={(e) => setPage(book, parseInt(e.target.value), onUpdate)}
                className="book-slider w-full"
                style={{
                  background: `linear-gradient(to right, rgb(var(--primary)) ${pct}%, rgb(var(--line)) ${pct}%)`,
                }}
                aria-label={`Página actual de ${book.title}`}
              />}
              {Boolean(book.previousReadings?.length) && <p className="text-xs text-ink3">En la relectura, registra el avance para que las páginas se guarden en el diario.</p>}
              {progressActions}
            </div>
          )}
          {book.pages <= 0 && progressActions}
        </div>
      </div>
    </article>
  );
}
