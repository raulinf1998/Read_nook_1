import { formatReadingDate } from '../readingDate';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  HardDriveDownload,
  Library,
  NotebookPen,
  Pencil,
  Play,
  Tag,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { Book } from '../types';
import { STATUS_META, formatLabel, languageLabel, seriesLabel } from '../types';
import { calculateJournalCurrentPage } from '../storyGraphJournal';
import { startReread } from '../rereads';
import { createClientId } from '../lib';
import { JournalPanel } from './JournalModal';
import { StarRating } from './StarRating';
import {
  BookCover,
  Modal,
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
  book: Book;
  books: Book[];
  onBack: () => void;
  onEdit: (book: Book) => void;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onDelete: (id: string) => void;
  onOpen: (book: Book) => void;
  onOpenSeries: (seriesName: string) => void;
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '—';
  return new Date(timestamp).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPublishDate(value: string): string {
  const raw = (value || '').trim();
  if (!raw) return '—';
  if (/^\d{4}$/.test(raw)) return raw;

  const monthMatch = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (monthMatch) {
    const text = new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1)
      .toLocaleDateString('es', { month: 'long', year: 'numeric' });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  const dayMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dayMatch) {
    return new Date(Number(dayMatch[1]), Number(dayMatch[2]) - 1, Number(dayMatch[3]))
      .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return raw;
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function normalizeKey(value: string | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function seriesPositionValue(book: Book): number {
  const value = Number.parseFloat((book.seriesPosition || '').replace(',', '.'));
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function BookDetail({ book, books, onBack, onEdit, onUpdate, onDelete, onOpen, onOpenSeries }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const journal = useMemo(
    () => [...(book.journal || [])].sort((a, b) => a.date - b.date),
    [book.journal],
  );

  const journalCurrentPage = calculateJournalCurrentPage(journal, book.pages);
  const currentPage = book.status === 'read' && book.pages > 0
    ? book.pages
    : (book.currentPage > 0 ? Math.min(book.currentPage, book.pages || book.currentPage) : journalCurrentPage);
  const pct = book.pages > 0 ? Math.min(Math.max((currentPage / book.pages) * 100, 0), 100) : 0;
  const remaining = book.pages > 0 ? Math.max(book.pages - currentPage, 0) : null;

  const activity = useMemo(() => {
    const activeEntries = journal.filter((entry) => (entry.pages || 0) > 0 || (entry.minutes || 0) > 0);
    const recordedPages = journal.reduce((sum, entry) => sum + Math.max(0, entry.pages || 0), 0);
    const recordedMinutes = journal.reduce((sum, entry) => sum + Math.max(0, entry.minutes || 0), 0);
    const activeDays = new Set(activeEntries.map((entry) => localDayKey(entry.date)));
    const bestEntry = [...journal].sort((a, b) => (b.pages || 0) - (a.pages || 0))[0];
    return {
      sessions: activeEntries.length,
      recordedPages,
      recordedMinutes,
      activeDays: activeDays.size,
      averagePages: activeEntries.length ? recordedPages / activeEntries.length : 0,
      firstEntry: journal[0] || null,
      lastEntry: journal[journal.length - 1] || null,
      bestEntry: bestEntry && (bestEntry.pages || 0) > 0 ? bestEntry : null,
    };
  }, [journal]);

  const related = useMemo(() => {
    const seriesKey = normalizeKey(book.series);
    if (seriesKey) {
      const items = books
        .filter((item) => item.id !== book.id && normalizeKey(item.series) === seriesKey)
        .sort((a, b) => seriesPositionValue(a) - seriesPositionValue(b) || a.title.localeCompare(b.title, 'es'))
        .slice(0, 6);
      if (items.length) return { title: `También en ${book.series}`, items };
    }

    const authorKey = normalizeKey(book.author);
    if (!authorKey) return { title: '', items: [] as Book[] };
    const items = books
      .filter((item) => item.id !== book.id && normalizeKey(item.author) === authorKey)
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title, 'es'))
      .slice(0, 6);
    return { title: items.length ? `Más de ${book.author}` : '', items };
  }, [book.author, book.id, book.series, books]);

  const details: [string, string][] = [
    ['Estado', STATUS_META[book.status].label],
    ['Formato', formatLabel(book.format)],
    ['Idioma', languageLabel(book.language)],
    ['Páginas', book.pages > 0 ? book.pages.toLocaleString('es') : '—'],
    ['Publicación', formatPublishDate(book.publishDate)],
    ['ISBN/UID', book.isbn || '—'],
    ['Saga', book.series?.trim() || '—'],
    ['Posición en la saga', book.seriesPosition?.trim() ? `#${book.seriesPosition.trim().replace(/^#\s*/, '')}` : '—'],
    ['Añadido a Bilibook', formatDate(book.createdAt)],
    ['Empezado', formatDate(book.startedAt)],
    ['Terminado', formatReadingDate(book)],
  ].filter(([, value]) => value && value !== '—') as [string, string][];

  const scrollToJournal = () => {
    document.getElementById('diario-lector')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startReading = () => {
    onUpdate(book.id, {
      status: 'reading',
      startedAt: book.startedAt ?? Date.now(),
      finishedAt: null,
    });
  };

  const storyGraphUrl = book.storyGraphId
    ? `https://app.thestorygraph.com/books/${encodeURIComponent(book.storyGraphId)}`
    : '';
  const isLocalCover = (book.coverUrl || '').trim().startsWith('/covers/');

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Barra de acciones de la ficha */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className={cx(btnGhost, 'px-3 py-2 text-xs')}>
          <ArrowLeft size={15} /> Volver
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => onEdit(book)} className={cx(btnGhost, 'px-3 py-2 text-xs')}>
            <Pencil size={14} /> Editar
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className={cx(iconBtn, 'hover:!text-danger hover:!bg-danger/10')}
            aria-label={`Eliminar ${book.title}`}
            title="Eliminar libro"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      {/* Cabecera principal, al estilo de una ficha completa */}
      <section className={cx(cardCls, 'relative overflow-hidden')}>
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="mx-auto w-40 sm:w-44 md:w-full">
            <BookCover
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              detail="lg"
              className="aspect-[2/3] w-full shadow-pop"
            />
            {isLocalCover && (
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold leading-snug text-stread">
                <HardDriveDownload size={13} className="shrink-0" />
                Copia guardada en tu servidor
              </p>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={book.status} />
              {seriesLabel(book) && book.series?.trim() && (
                <button
                  type="button"
                  onClick={() => onOpenSeries(book.series!.trim())}
                  className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-accent transition-all hover:bg-accent hover:text-onprimary hover:shadow-card"
                  aria-label={`Abrir la saga ${book.series}`}
                  title={`Abrir la saga ${book.series}`}
                >
                  {seriesLabel(book)} <ChevronRight size={12} />
                </button>
              )}
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-bold text-ink2">
                {formatLabel(book.format)}
              </span>
              {book.pages > 0 && (
                <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink2">
                  {book.pages.toLocaleString('es')} págs
                </span>
              )}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-[40px] sm:leading-[1.05]">
              {book.title}
            </h1>
            <p className="mt-2 text-base font-semibold text-ink2 sm:text-lg">
              {book.author || 'Autor desconocido'}
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <StarRating value={book.rating || 0} onChange={(rating) => onUpdate(book.id, { rating })} size={19} />
              <span className="text-xs font-semibold text-ink3">
                {book.rating > 0 ? `Tu nota: ${book.rating.toFixed(1)} de 5 · toca las estrellas para cambiarla` : 'Toca las estrellas para valorarlo'}
              </span>
            </div>

            {book.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {book.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[11px] font-bold text-ink2">
                    <Tag size={11} /> {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-card bg-sunken/65 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-extrabold text-ink">
                  {book.status === 'pending' && 'Todavía no empezado'}
                  {book.status === 'reading' && (
                    <>Vas por la página {currentPage.toLocaleString('es')}{book.pages > 0 && <> de {book.pages.toLocaleString('es')}</>}</>
                  )}
                  {book.status === 'read' && 'Libro terminado'}
                  {book.status === 'dnf' && `Abandonado en la página ${currentPage.toLocaleString('es')}`}
                </p>
                {book.pages > 0 && book.status !== 'pending' && (
                  <span className="text-sm font-extrabold tabular-nums text-accent">{pct.toFixed(pct % 1 ? 1 : 0).replace('.', ',')}%</span>
                )}
              </div>
              {book.pages > 0 && <ProgressBar pct={book.status === 'pending' ? 0 : pct} className="mt-2.5 h-2.5" />}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-ink3">
                {remaining !== null && book.status === 'reading' && <span>Te quedan {remaining.toLocaleString('es')} págs</span>}
                {book.startedAt && <span>Empezado: {formatDate(book.startedAt)}</span>}
                {book.finishedAt && <span>Terminado: {formatReadingDate(book)}</span>}
                <span>Añadido: {formatDate(book.createdAt)}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {book.status === 'pending' ? (
                <button type="button" onClick={startReading} className={btnPrimary}>
                  <Play size={16} /> Empezar a leer
                </button>
              ) : (
                <button type="button" onClick={scrollToJournal} className={btnPrimary}>
                  <NotebookPen size={16} /> {book.status === 'read' ? 'Ver diario lector' : 'Registrar avance'}
                </button>
              )}
              {book.status === 'read' && (
                <button type="button" className={btnSoft} onClick={() => {
                  const patch = startReread(book, Date.now(), createClientId);
                  if (!patch) {
                    window.alert('No se puede iniciar la relectura porque hay fechas futuras en el diario o en la fecha de finalización.');
                    return;
                  }
                  onUpdate(book.id, patch);
                }}><Play size={14} /> Empezar relectura</button>
              )}
              {book.status === 'pending' && (
                <button type="button" onClick={scrollToJournal} className={btnSoft}>
                  <NotebookPen size={14} /> Registrar avance
                </button>
              )}
              {storyGraphUrl && (
                <a href={storyGraphUrl} target="_blank" rel="noreferrer" className={btnGhost}>
                  Abrir en TheStoryGraph <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Actividad registrada */}
      {journal.length > 0 && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de actividad lectora">
          <DetailStat icon={<Activity size={17} />} value={activity.sessions.toLocaleString('es')} label="Sesiones con avance" />
          <DetailStat icon={<FileText size={17} />} value={activity.recordedPages.toLocaleString('es')} label="Páginas en el diario" />
          <DetailStat icon={<CalendarDays size={17} />} value={activity.activeDays.toLocaleString('es')} label="Días activos" />
          <DetailStat
            icon={<Clock3 size={17} />}
            value={activity.recordedMinutes > 0 ? formatMinutes(activity.recordedMinutes) : `${activity.averagePages ? Math.round(activity.averagePages) : 0} págs`}
            label={activity.recordedMinutes > 0 ? 'Tiempo registrado' : 'Media por sesión'}
          />
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* En móvil el diario va justo tras la cabecera; en PC, a la derecha. */}
        <aside id="diario-lector" className={cx(cardCls, 'scroll-mt-24 p-4 sm:p-5 xl:col-start-2 xl:row-start-1')}>
          <SectionHeader icon={<NotebookPen size={17} />} title="Diario lector" count={book.journal?.length || 0} />
          <JournalPanel key={book.id} book={book} onUpdate={onUpdate} embedded />
        </aside>

        <div className="min-w-0 space-y-5 xl:col-start-1 xl:row-start-1">
          <DetailSection icon={<BookOpen size={17} />} title="Sinopsis">
            {book.description?.trim() ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink2">{book.description.trim()}</p>
            ) : (
              <p className="text-sm leading-relaxed text-ink3">
                Todavía no hay sinopsis guardada para este libro. Puedes añadirla desde <button type="button" onClick={() => onEdit(book)} className="font-bold text-accent hover:underline">Editar</button>.
              </p>
            )}
          </DetailSection>

          <DetailSection icon={<Library size={17} />} title="Detalles de la edición">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="border-b border-line/60 pb-3 last:border-0 sm:last:border-b">
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink3">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold leading-snug text-ink">
                    {label === 'Saga' && book.series?.trim() ? (
                      <button type="button" onClick={() => onOpenSeries(book.series!.trim())} className="text-left text-accent hover:text-ink hover:underline">
                        {value}
                      </button>
                    ) : value}
                  </dd>
                </div>
              ))}
            </dl>
          </DetailSection>

          <DetailSection icon={<NotebookPen size={17} />} title="Tu lectura">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <ReadingFact label="Página actual" value={book.pages > 0 ? `${currentPage.toLocaleString('es')} de ${book.pages.toLocaleString('es')}` : currentPage.toLocaleString('es')} />
              <ReadingFact label="Progreso" value={book.pages > 0 ? `${pct.toFixed(pct % 1 ? 1 : 0).replace('.', ',')}%` : 'Sin total de páginas'} />
              <ReadingFact label="Primera sesión" value={activity.firstEntry ? formatDate(activity.firstEntry.date) : '—'} />
              <ReadingFact label="Última sesión" value={activity.lastEntry ? formatDate(activity.lastEntry.date) : '—'} />
              {activity.bestEntry && (
                <ReadingFact
                  label="Tu mejor sesión"
                  value={`+${activity.bestEntry.pages?.toLocaleString('es')} págs · ${formatDate(activity.bestEntry.date)}`}
                />
              )}
              {activity.recordedMinutes > 0 && (
                <ReadingFact label="Tiempo escuchado/leído" value={formatMinutes(activity.recordedMinutes)} />
              )}
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink3">Notas personales</h4>
              {book.notes?.trim() ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink2">{book.notes.trim()}</p>
              ) : (
                <p className="mt-2 text-sm text-ink3">Sin notas personales todavía.</p>
              )}
            </div>
          </DetailSection>

          {(isLocalCover || book.coverSourceUrl || storyGraphUrl) && (
            <DetailSection icon={<HardDriveDownload size={17} />} title="Portada y origen">
              <div className="space-y-3 text-sm leading-relaxed text-ink2">
                {isLocalCover && <p>La imagen que ves es una copia guardada en el servidor de Bilibook, así que seguirá apareciendo aunque desaparezca la URL original.</p>}
                {book.coverSourceUrl && (
                  <p className="break-all">
                    <span className="font-bold text-ink">Origen:</span>{' '}
                    <a href={book.coverSourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                      {book.coverSourceUrl}
                    </a>
                  </p>
                )}
                {storyGraphUrl && (
                  <a href={storyGraphUrl} target="_blank" rel="noreferrer" className={btnSoft}>
                    Ver este libro en TheStoryGraph <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </DetailSection>
          )}

          {related.items.length > 0 && (
            <DetailSection icon={<Library size={17} />} title={related.title}>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
                {related.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpen(item)}
                    className="group min-w-0 text-left"
                    aria-label={`Abrir ficha de ${item.title}`}
                  >
                    <BookCover
                      title={item.title}
                      author={item.author}
                      coverUrl={item.coverUrl}
                      detail="md"
                      className="aspect-[2/3] w-full shadow-book transition-transform duration-300 group-hover:-translate-y-1"
                    />
                    <span className="mt-2 block truncate text-xs font-bold leading-snug text-ink group-hover:text-accent">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] font-semibold text-ink3">
                      {seriesLabel(item) || STATUS_META[item.status].label}
                    </span>
                  </button>
                ))}
              </div>
            </DetailSection>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <Modal
          title="Eliminar libro"
          icon={<TriangleAlert size={17} />}
          onClose={() => setConfirmingDelete(false)}
          maxWidth="max-w-sm"
          footer={(
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setConfirmingDelete(false)} className={cx(btnGhost, 'flex-1 border border-line bg-surface')}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDelete(book.id);
                  onBack();
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-btn bg-danger px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          )}
        >
          <div className="flex items-center gap-3.5">
            <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="h-16 w-11 shadow-book" />
            <div className="min-w-0">
              <p className="line-clamp-2 font-display font-semibold leading-snug text-ink">«{book.title}»</p>
              <p className="mt-0.5 text-xs text-ink3">{book.author || 'Autor desconocido'}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink2">
            Se borrará de tu biblioteca junto con sus notas y su diario lector. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}

function DetailSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className={cx(cardCls, 'p-4 sm:p-5')}>
      <SectionHeader icon={icon} title={title} />
      {children}
    </section>
  );
}

function DetailStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
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

function ReadingFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink3">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-ink">{value}</p>
    </div>
  );
}
