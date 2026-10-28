import { useEffect, useId, useMemo, useState } from 'react';
import { Clock3, NotebookPen, Plus, Trash2 } from 'lucide-react';
import type { Book, JournalEntry, JournalEntryKind } from '../types';
import { makeJournalEntry } from '../lib';
import {
  buildJournalProgressTimeline,
  calculateJournalCurrentPage,
  planManualProgress,
} from '../storyGraphJournal';
import { BookCover, Modal, ProgressBar, btnGhost, btnPrimary, cx, iconBtn, inputCls } from './ui';

const KIND_LABELS: Record<JournalEntryKind, string> = {
  progress: 'Avance',
  started: 'Inicio',
  finished: 'Terminado',
  paused: 'Pausa',
  resumed: 'Reanudado',
  dnf: 'Abandonado',
  to_read: 'Por leer',
  note: 'Nota',
};

const VISIBLE_ENTRIES = 80;

type ProgressMode = 'page' | 'percent';

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')}%`;
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateParts(value: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { year, month, day }
    : null;
}

function endOfLocalDay(value: string): number {
  const parts = dateParts(value);
  if (!parts) return Number.NaN;
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
}

function manualEntryTimestamp(value: string): number {
  if (value === localDateValue()) return Date.now();
  // Para una fecha pasada, «voy por esta página» se interpreta al final de
  // ese día: así queda tras los demás registros de la misma fecha y antes
  // del siguiente avance, igual que en el cálculo de `planManualProgress`.
  const end = endOfLocalDay(value);
  return Number.isFinite(end) ? end : Date.now();
}

function byDateDesc(entries: JournalEntry[]) {
  return [...entries].sort((a, b) => b.date - a.date);
}

function resolveCurrentPage(book: Pick<Book, 'currentPage' | 'pages'>, entries: JournalEntry[]): number {
  const saved = Math.max(0, Math.round(book.currentPage || 0));
  const current = saved > 0 ? saved : calculateJournalCurrentPage(entries, book.pages);
  return book.pages > 0 ? Math.min(current, book.pages) : current;
}

interface ManualProgressUpdate {
  entry: JournalEntry;
  entries: JournalEntry[];
  patch: Partial<Book>;
  nextCurrentPage: number;
  deltaPages: number;
}

function buildManualProgressUpdate(
  book: Book,
  entries: JournalEntry[],
  currentPage: number,
  targetPage: number,
  dateValue: string,
  note = '',
): ManualProgressUpdate | null {
  const planDate = endOfLocalDay(dateValue);
  if (!Number.isFinite(planDate)) return null;

  const plan = planManualProgress(entries, book.pages, currentPage, targetPage, planDate);
  if (plan.invalidReason || plan.deltaPages <= 0) return null;

  const entryDate = manualEntryTimestamp(dateValue);
  const boundedTarget = book.pages > 0 ? Math.min(targetPage, book.pages) : targetPage;
  const entry: JournalEntry = {
    ...makeJournalEntry(plan.deltaPages, note.trim()),
    date: entryDate,
    kind: book.pages > 0 && boundedTarget >= book.pages ? 'finished' : 'progress',
    cumulativePages: boundedTarget,
    percent: book.pages > 0 ? Math.round((boundedTarget / book.pages) * 1000) / 10 : null,
  };
  const adjustedEntries = plan.nextEntryId && plan.nextEntryPages !== null
    ? entries.map((item) => (
      item.id === plan.nextEntryId ? { ...item, pages: plan.nextEntryPages as number } : item
    ))
    : entries;
  const newEntries = byDateDesc([entry, ...adjustedEntries]);
  const patch: Partial<Book> = {
    journal: newEntries,
    currentPage: plan.nextCurrentPage,
  };

  if (plan.affectsCurrent) {
    if (book.pages > 0 && plan.nextCurrentPage >= book.pages) {
      patch.status = 'read';
      patch.finishedAt = entryDate;
    } else if (plan.nextCurrentPage > 0) {
      patch.status = 'reading';
      if (!book.startedAt) patch.startedAt = entryDate;
    }
  }

  return {
    entry,
    entries: newEntries,
    patch,
    nextCurrentPage: plan.nextCurrentPage,
    deltaPages: plan.deltaPages,
  };
}

interface ProgressEntryFormProps {
  book: Book;
  entries: JournalEntry[];
  currentPage: number;
  onSubmit: (targetPage: number, dateValue: string, note: string) => void;
  autoFocus?: boolean;
  /** El popup rápido solo pide fecha y posición; en el diario completo se puede añadir nota. */
  showNote?: boolean;
}

function ProgressEntryForm({ book, entries, currentPage, onSubmit, autoFocus = false, showNote = false }: ProgressEntryFormProps) {
  const fieldId = useId().replace(/:/g, '');
  const today = localDateValue();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<ProgressMode>('page');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const parsedValue = value.trim() ? Number(value.replace(',', '.')) : Number.NaN;
  const targetPage = Number.isFinite(parsedValue)
    ? (mode === 'page' ? Math.round(parsedValue) : (book.pages > 0 ? Math.round((parsedValue / 100) * book.pages) : Number.NaN))
    : Number.NaN;
  const planDate = endOfLocalDay(date);
  const baselinePlan = Number.isFinite(planDate)
    ? planManualProgress(entries, book.pages, currentPage, currentPage, planDate)
    : null;
  const plan = Number.isFinite(planDate) && Number.isFinite(targetPage)
    ? planManualProgress(entries, book.pages, currentPage, targetPage, planDate)
    : null;

  let error = '';
  if (date && !dateParts(date)) error = 'La fecha no es válida.';
  else if (date > today) error = 'La fecha no puede ser futura.';
  else if (value.trim() && !Number.isFinite(parsedValue)) error = 'Introduce un número válido.';
  else if (mode === 'percent' && Number.isFinite(parsedValue) && (parsedValue <= 0 || parsedValue > 100)) {
    error = 'El porcentaje debe estar entre 0 y 100.';
  } else if (mode === 'page' && Number.isFinite(targetPage) && targetPage < 1) {
    error = 'Introduce la página por la que vas.';
  } else if (mode === 'page' && book.pages > 0 && Number.isFinite(targetPage) && targetPage > book.pages) {
    error = `El libro tiene ${book.pages.toLocaleString('es')} páginas.`;
  } else if (plan?.invalidReason === 'next-progress') {
    error = `En el siguiente registro ya constaba la página ${(plan.nextPage ?? 0).toLocaleString('es')}; para esta fecha anterior introduce una página menor.`;
  } else if (plan?.invalidReason === 'between-readings') {
    error = 'Esa fecha queda entre dos lecturas del libro. Elige una fecha dentro de la lectura actual.';
  } else if (plan && plan.deltaPages <= 0) {
    error = baselinePlan && book.pages > 0 && baselinePlan.baselinePage >= book.pages
      ? 'Este libro ya consta como terminado.'
      : `En esa fecha ya ibas por la página ${plan.baselinePage.toLocaleString('es')}; introduce una página mayor.`;
  }

  const valid = Boolean(plan && !error && plan.deltaPages > 0);
  const targetPercent = book.pages > 0 && Number.isFinite(targetPage)
    ? Math.round((targetPage / book.pages) * 1000) / 10
    : null;

  const switchMode = (nextMode: ProgressMode) => {
    if (nextMode === mode) return;
    if (Number.isFinite(parsedValue) && book.pages > 0) {
      if (nextMode === 'percent') {
        const converted = Math.round((parsedValue / book.pages) * 1000) / 10;
        setValue(String(converted));
      } else {
        setValue(String(Math.round((parsedValue / 100) * book.pages)));
      }
    }
    setMode(nextMode);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !plan) return;
    onSubmit(targetPage, date, note);
    setValue('');
    setNote('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-xs font-bold text-ink2 mb-1" htmlFor={`${fieldId}-date`}>Fecha</label>
          <input
            id={`${fieldId}-date`}
            type="date"
            required
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={cx(inputCls, 'py-2 bg-raised')}
          />
        </div>
        <div>
          <span className="block text-xs font-bold text-ink2 mb-1">Voy por…</span>
          <div className="grid grid-cols-2 gap-1 rounded-btn bg-surface/70 p-1 ring-1 ring-line" role="group" aria-label="Registrar por página o porcentaje">
            <button
              type="button"
              onClick={() => switchMode('page')}
              aria-pressed={mode === 'page'}
              className={cx(
                'rounded-[calc(var(--r-btn)_-_4px)] px-2 py-1.5 text-xs font-extrabold transition-all',
                mode === 'page' ? 'bg-primary text-onprimary shadow-card' : 'text-ink3 hover:text-ink',
              )}
            >
              Página
            </button>
            <button
              type="button"
              onClick={() => switchMode('percent')}
              aria-pressed={mode === 'percent'}
              disabled={book.pages <= 0}
              title={book.pages <= 0 ? 'Primero indica cuántas páginas tiene el libro' : undefined}
              className={cx(
                'rounded-[calc(var(--r-btn)_-_4px)] px-2 py-1.5 text-xs font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-40',
                mode === 'percent' ? 'bg-primary text-onprimary shadow-card' : 'text-ink3 hover:text-ink',
              )}
            >
              %
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-ink2 mb-1" htmlFor={`${fieldId}-value`}>
          {mode === 'page'
            ? `Página actual${book.pages > 0 ? ` (de ${book.pages.toLocaleString('es')})` : ''}`
            : 'Porcentaje actual'}
        </label>
        <input
          id={`${fieldId}-value`}
          type="number"
          required
          min={mode === 'page' ? 1 : 0}
          max={mode === 'page' ? (book.pages || undefined) : 100}
          step={mode === 'page' ? 1 : 0.1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={mode === 'page'
            ? String(Math.min(currentPage + 20, book.pages || currentPage + 20))
            : String(Math.min(100, Math.round((book.pages > 0 ? (currentPage / book.pages) * 100 : 0) + 5)))}
          inputMode="decimal"
          autoFocus={autoFocus}
          className={cx(inputCls, 'py-2 bg-raised')}
        />
        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-ink3">
          {date === today
            ? <>Ahora constas en la página <strong className="text-ink2">{currentPage.toLocaleString('es')}</strong>.</>
            : <>El último punto en esa fecha era la página <strong className="text-ink2">{(baselinePlan?.baselinePage ?? currentPage).toLocaleString('es')}</strong>.</>}
          {' '}Bilibook calculará las páginas leídas en esta sesión.
        </p>
      </div>

      {showNote && (
        <div>
          <label className="block text-xs font-bold text-ink2 mb-1" htmlFor={`${fieldId}-note`}>
            Nota <span className="font-medium text-ink3">(opcional)</span>
          </label>
          <input
            id={`${fieldId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Capítulo 5… ¡qué giro!"
            className={cx(inputCls, 'py-2 bg-raised')}
          />
        </div>
      )}

      {valid && plan && (
        <p className="rounded-btn bg-accent/10 px-3 py-2 text-xs leading-relaxed text-ink2" role="status">
          {mode === 'percent' && <>Equivale a la página <strong>{targetPage.toLocaleString('es')}</strong>. </>}
          Se registrarán <strong>+{plan.deltaPages.toLocaleString('es')} páginas</strong>
          {' '}(de la {plan.baselinePage.toLocaleString('es')} a la {targetPage.toLocaleString('es')}
          {targetPercent !== null && <> · {formatPercent(targetPercent)}</>}).
          {book.pages > 0 && targetPage >= book.pages && plan.affectsCurrent && ' El libro quedará marcado como leído.'}
          {!plan.affectsCurrent && plan.nextEntryId && ' Es un punto intermedio: tu página actual no cambiará y la sesión siguiente se ajustará para no contar páginas dos veces.'}
        </p>
      )}
      {error && value.trim() && (
        <p className="text-xs font-semibold leading-relaxed text-danger" role="alert">{error}</p>
      )}

      <button type="submit" disabled={!valid} className={cx(btnPrimary, 'w-full')}>
        <Plus size={16} strokeWidth={2.5} /> Registrar avance
      </button>
    </form>
  );
}

interface Props {
  book: Book;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onClose: () => void;
}

/** Popup breve para registrar «voy por esta página/% en esta fecha». */
export function ProgressLogModal({ book, onUpdate, onClose }: Props) {
  const entries = byDateDesc(book.journal || []);
  const currentPage = resolveCurrentPage(book, entries);
  const pct = book.pages > 0 ? Math.min((currentPage / book.pages) * 100, 100) : 0;

  const handleSubmit = (targetPage: number, dateValue: string) => {
    const result = buildManualProgressUpdate(book, entries, currentPage, targetPage, dateValue);
    if (!result) return;
    onUpdate(book.id, result.patch);
    onClose();
  };

  return (
    <Modal title="Registrar avance" icon={<NotebookPen size={17} />} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="flex items-center gap-3.5">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-12 h-[72px] shadow-book" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-ink truncate">{book.title}</p>
            <p className="text-xs text-ink3 truncate">{book.author}</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-ink2 tabular-nums">
                Página {currentPage.toLocaleString('es')} de {book.pages ? book.pages.toLocaleString('es') : '?'}
              </span>
              {book.pages > 0 && <span className="font-extrabold text-accent tabular-nums">{formatPercent(Math.round(pct * 10) / 10)}</span>}
            </div>
            <ProgressBar pct={pct} className="h-2 mt-1.5" />
          </div>
        </div>

        <div className="bg-sunken/70 rounded-card p-4">
          <ProgressEntryForm book={book} entries={entries} currentPage={currentPage} onSubmit={handleSubmit} autoFocus />
        </div>
      </div>
    </Modal>
  );
}

export function JournalModal({ book, onUpdate, onClose }: Props) {
  return (
    <Modal title="Diario lector" icon={<NotebookPen size={17} />} onClose={onClose} maxWidth="max-w-md">
      <JournalPanel book={book} onUpdate={onUpdate} />
    </Modal>
  );
}

interface JournalPanelProps {
  book: Book;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  /** En la ficha completa el resumen del libro ya está en la cabecera. */
  embedded?: boolean;
}

/**
 * Diario completo sin envoltura de modal. Se usa tanto dentro del popup
 * clásico como abierto de forma permanente en la ficha del libro.
 */
export function JournalPanel({ book, onUpdate, embedded = false }: JournalPanelProps) {
  const [entries, setEntries] = useState<JournalEntry[]>(byDateDesc(book.journal || []));
  const [knownCurrentPage, setKnownCurrentPage] = useState(() => resolveCurrentPage(book, book.journal || []));
  const [showAllEntries, setShowAllEntries] = useState(false);

  // La ficha permanece montada mientras el libro cambia (avances desde el
  // popup rápido, edición de páginas, etc.); el diario debe reflejarlo.
  useEffect(() => {
    setEntries(byDateDesc(book.journal || []));
    setKnownCurrentPage(resolveCurrentPage(
      { currentPage: book.currentPage, pages: book.pages },
      book.journal || [],
    ));
    setShowAllEntries(false);
  }, [book.id, book.journal, book.currentPage, book.pages]);

  const timeline = useMemo(
    () => buildJournalProgressTimeline(entries, book.pages, knownCurrentPage),
    [entries, book.pages, knownCurrentPage],
  );
  const pointsByEntryId = useMemo(
    () => new Map(timeline.points.map((point) => [point.entry.id, point])),
    [timeline],
  );

  const pushUpdate = (newEntries: JournalEntry[], nextCurrentPage: number, extraPatch: Partial<Book> = {}) => {
    const patch: Partial<Book> = {
      journal: newEntries,
      currentPage: nextCurrentPage,
      ...extraPatch,
    };
    if (book.pages > 0 && nextCurrentPage >= book.pages && patch.status === undefined) {
      patch.status = 'read';
      patch.finishedAt = newEntries.length ? Math.max(...newEntries.map((entry) => entry.date)) : Date.now();
    }
    onUpdate(book.id, patch);
  };

  const handleAddProgress = (targetPage: number, dateValue: string, note: string) => {
    const result = buildManualProgressUpdate(book, entries, knownCurrentPage, targetPage, dateValue, note);
    if (!result) return;
    setEntries(result.entries);
    setKnownCurrentPage(result.nextCurrentPage);
    onUpdate(book.id, result.patch);
  };

  const handleDelete = (entryId: string) => {
    const newEntries = entries.filter((entry) => entry.id !== entryId);
    let nextCurrentPage = knownCurrentPage;

    // Si la página guardada coincide con la línea temporal, se recalcula
    // desde las entradas restantes. Así, borrar un punto intermedio no mueve
    // la página actual si un avance posterior ya fijó hasta dónde se llegó,
    // y borrar el último avance sí retrocede al punto anterior. Si el libro
    // se ajustó fuera del diario (p. ej. con el slider), se respeta su página.
    const timelineAligned = Math.abs(timeline.currentPage - knownCurrentPage) <= 1;
    if (timelineAligned) {
      nextCurrentPage = buildJournalProgressTimeline(
        newEntries,
        book.pages,
        knownCurrentPage,
      ).currentPage;
    }

    setEntries(newEntries);
    setKnownCurrentPage(nextCurrentPage);
    pushUpdate(newEntries, nextCurrentPage);
  };

  const currentPage = knownCurrentPage;
  const recordedPages = entries.reduce((sum, entry) => sum + Math.max(0, entry.pages || 0), 0);
  const recordedMinutes = entries.reduce((sum, entry) => sum + Math.max(0, entry.minutes || 0), 0);
  const latestPercent = [...timeline.points].reverse().find((point) => point.percent !== null)?.percent;
  const pct = book.pages > 0
    ? Math.min((currentPage / book.pages) * 100, 100)
    : Math.min(Math.max(latestPercent || 0, 0), 100);
  const visibleEntries = showAllEntries ? entries : entries.slice(0, VISIBLE_ENTRIES);

  return (
    <div className="space-y-5">
        {/* Libro + progreso (en la ficha este resumen ya va en la cabecera) */}
        {!embedded && (
        <div className="flex items-center gap-3.5">
          <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-12 h-[72px] shadow-book" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-ink truncate">{book.title}</p>
            <p className="text-xs text-ink3 truncate">{book.author}</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-semibold text-ink2 tabular-nums">
                Página {currentPage.toLocaleString('es')} de {book.pages ? book.pages.toLocaleString('es') : '?'}
              </span>
              <span className="font-extrabold text-accent tabular-nums">{formatPercent(Math.round(pct * 10) / 10)}</span>
            </div>
            <ProgressBar pct={pct} className="h-2 mt-1.5" />
            {entries.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink3">
                <span>{entries.length} {entries.length === 1 ? 'sesión registrada' : 'sesiones registradas'}</span>
                <span aria-hidden>·</span>
                <span>{recordedPages.toLocaleString('es')} págs. en sesiones</span>
                {recordedMinutes > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {recordedMinutes.toLocaleString('es')} min</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
        )}

        {/* Nuevo registro: solo fecha y página/% alcanzado */}
        <div className="bg-sunken/70 rounded-card p-4">
          <h3 className="mb-3 text-sm font-bold text-ink2">Nuevo registro</h3>
          <ProgressEntryForm book={book} entries={entries} currentPage={currentPage} onSubmit={handleAddProgress} showNote />
        </div>

        {/* Historial en línea temporal */}
        <div>
          <h3 className="text-sm font-bold text-ink2 mb-3">Historial de avances</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-ink3 text-center py-5">Aún no has registrado avances. Tu próxima sesión empieza arriba.</p>
          ) : (
            <>
              <ol className={cx(
                'relative space-y-2.5 pr-1 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-line',
                embedded ? '' : 'max-h-72 overflow-y-auto',
              )}>
                {visibleEntries.map((entry) => {
                  const point = pointsByEntryId.get(entry.id);
                  const cumulativePages = point?.isProgressPoint ? point.cumulativePages : null;
                  const percent = point?.isProgressPoint ? point.percent : null;
                  return (
                    <li key={entry.id} className="relative flex items-start gap-3 group">
                      <span className="relative z-10 shrink-0 w-[35px] h-[35px] rounded-full bg-accent/10 ring-4 ring-surface flex flex-col items-center justify-center text-accent">
                        <span className="text-[11px] font-extrabold leading-none tabular-nums">{new Date(entry.date).getDate()}</span>
                        <span className="text-[7px] font-bold uppercase leading-none mt-px">
                          {new Date(entry.date).toLocaleDateString('es', { month: 'short' }).replace('.', '')}
                        </span>
                      </span>
                      <div className="flex-1 min-w-0 bg-sunken/60 rounded-btn px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-ink capitalize">
                            {new Date(entry.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {entry.pages > 0 && (
                            <span className="text-[10px] font-extrabold bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">+{entry.pages} págs</span>
                          )}
                          {entry.kind && (entry.kind !== 'progress' || entry.pages === 0) && (
                            <span className="text-[10px] font-extrabold bg-surface text-ink2 px-1.5 py-0.5 rounded-full ring-1 ring-line">
                              {KIND_LABELS[entry.kind]}
                            </span>
                          )}
                          {entry.source === 'storygraph' && (
                            <span className="text-[10px] font-extrabold bg-streading/10 text-streading px-1.5 py-0.5 rounded-full">
                              StoryGraph
                            </span>
                          )}
                        </div>

                        {(cumulativePages != null || percent != null || entry.minutes) && (
                          <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-medium text-ink3">
                            {cumulativePages != null && <span>Hasta la pág. {cumulativePages.toLocaleString('es')}</span>}
                            {percent != null && <span>{formatPercent(percent)} del libro</span>}
                            {entry.minutes ? (
                              <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {entry.minutes.toLocaleString('es')} min</span>
                            ) : null}
                          </div>
                        )}
                        {entry.note && <p className="text-xs text-ink2 mt-1.5 leading-relaxed whitespace-pre-line break-words">{entry.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className={cx(iconBtn, 'p-1.5 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!text-danger hover:!bg-danger/10 shrink-0 mt-1')}
                        aria-label="Eliminar avance"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  );
                })}
              </ol>
              {entries.length > VISIBLE_ENTRIES && !showAllEntries && (
                <button type="button" onClick={() => setShowAllEntries(true)} className={cx(btnGhost, 'mt-3 w-full')}>
                  Mostrar las {entries.length.toLocaleString('es')} sesiones
                </button>
              )}
            </>
          )}
        </div>
    </div>
  );
}
