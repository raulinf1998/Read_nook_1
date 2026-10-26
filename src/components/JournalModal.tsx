import { useState } from 'react';
import { Clock3, NotebookPen, Plus, Trash2 } from 'lucide-react';
import type { Book, JournalEntry, JournalEntryKind } from '../types';
import { makeJournalEntry } from '../lib';
import { calculateJournalCurrentPage } from '../storyGraphJournal';
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

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')}%`;
}

function localNoonFromDateInput(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return Date.now();
  return new Date(year, month - 1, day, 12).getTime();
}

interface Props {
  book: Book;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onClose: () => void;
}

function byDateDesc(entries: JournalEntry[]) {
  return [...entries].sort((a, b) => b.date - a.date);
}

export function JournalModal({ book, onUpdate, onClose }: Props) {
  const [pages, setPages] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<JournalEntry[]>(byDateDesc(book.journal || []));
  const [showAllEntries, setShowAllEntries] = useState(false);

  const pushUpdate = (newEntries: JournalEntry[]) => {
    const newCurrentPage = calculateJournalCurrentPage(newEntries, book.pages);
    const patch: Partial<Book> = { journal: newEntries, currentPage: newCurrentPage };
    if (book.pages > 0 && newCurrentPage >= book.pages && book.status !== 'read') {
      patch.status = 'read';
      patch.finishedAt = newEntries.length
        ? Math.max(...newEntries.map((entry) => entry.date))
        : localNoonFromDateInput(date);
    }
    onUpdate(book.id, patch);
  };

  const handleAdd = () => {
    const p = parseInt(pages) || 0;
    if (p <= 0 && !note.trim()) return;
    // La entrada guarda la fecha elegida en el selector (antes siempre era "hoy").
    // Se usa mediodía local para que el día no cambie según la zona horaria.
    const entryDate = localNoonFromDateInput(date);
    const latestEntryDate = entries.length ? Math.max(...entries.map((entry) => entry.date)) : 0;
    const isLatestEntry = entryDate >= latestEntryDate;
    const nextCumulative = isLatestEntry && p > 0
      ? calculateJournalCurrentPage(entries, book.pages) + p
      : null;
    const cumulativePages = nextCumulative === null
      ? undefined
      : book.pages > 0
        ? Math.min(nextCumulative, book.pages)
        : nextCumulative;

    const entry: JournalEntry = {
      ...makeJournalEntry(p, note.trim()),
      date: entryDate,
      kind: p > 0 ? 'progress' : 'note',
      ...(cumulativePages !== undefined ? {
        cumulativePages,
        percent: book.pages > 0 ? Math.round((cumulativePages / book.pages) * 1000) / 10 : null,
      } : {}),
    };
    const newEntries = byDateDesc([entry, ...entries]);
    setEntries(newEntries);
    pushUpdate(newEntries);
    setPages('');
    setNote('');
  };

  const handleDelete = (entryId: string) => {
    const newEntries = entries.filter((e) => e.id !== entryId);
    setEntries(newEntries);
    pushUpdate(newEntries);
  };

  const currentPage = entries.length ? calculateJournalCurrentPage(entries, book.pages) : (book.currentPage || 0);
  const recordedPages = entries.reduce((sum, entry) => sum + Math.max(0, entry.pages || 0), 0);
  const recordedMinutes = entries.reduce((sum, entry) => sum + Math.max(0, entry.minutes || 0), 0);
  const latestPercent = [...entries]
    .sort((a, b) => b.date - a.date)
    .find((entry) => typeof entry.percent === 'number')?.percent;
  const pct = book.pages > 0
    ? Math.min((currentPage / book.pages) * 100, 100)
    : Math.min(Math.max(latestPercent || 0, 0), 100);
  const visibleEntries = showAllEntries ? entries : entries.slice(0, VISIBLE_ENTRIES);

  return (
    <Modal title="Diario lector" icon={<NotebookPen size={17} />} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Libro + progreso */}
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

        {/* Formulario de avance */}
        <div className="bg-sunken/70 rounded-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-ink2 mb-1" htmlFor="j-date">Fecha</label>
              <input id="j-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, 'py-2 bg-raised')} />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink2 mb-1" htmlFor="j-pages">Páginas leídas</label>
              <input
                id="j-pages"
                type="number"
                min={0}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="40"
                inputMode="numeric"
                className={cx(inputCls, 'py-2 bg-raised')}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-ink2 mb-1" htmlFor="j-note">Nota <span className="font-medium text-ink3">(opcional)</span></label>
            <input
              id="j-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Capítulo 5… ¡qué giro!"
              className={cx(inputCls, 'py-2 bg-raised')}
            />
          </div>
          <button onClick={handleAdd} disabled={!pages && !note.trim()} className={cx(btnPrimary, 'w-full')}>
            <Plus size={16} strokeWidth={2.5} /> Registrar avance
          </button>
        </div>

        {/* Historial en línea temporal */}
        <div>
          <h3 className="text-sm font-bold text-ink2 mb-3">Historial de avances</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-ink3 text-center py-5">Aún no has registrado avances. Tu próxima sesión empieza arriba.</p>
          ) : (
            <>
              <ol className="relative space-y-2.5 max-h-72 overflow-y-auto pr-1 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-line">
                {visibleEntries.map((entry) => (
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

                    {(entry.cumulativePages != null || entry.percent != null || entry.minutes) && (
                      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-medium text-ink3">
                        {entry.cumulativePages != null && <span>Hasta la pág. {entry.cumulativePages.toLocaleString('es')}</span>}
                        {entry.percent != null && <span>{formatPercent(entry.percent)} del libro</span>}
                        {entry.minutes ? (
                          <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {entry.minutes.toLocaleString('es')} min</span>
                        ) : null}
                      </div>
                    )}
                    {entry.note && <p className="text-xs text-ink2 mt-1.5 leading-relaxed whitespace-pre-line break-words">{entry.note}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className={cx(iconBtn, 'p-1.5 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!text-danger hover:!bg-danger/10 shrink-0 mt-1')}
                    aria-label="Eliminar avance"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ol>
            {entries.length > VISIBLE_ENTRIES && !showAllEntries && (
              <button onClick={() => setShowAllEntries(true)} className={cx(btnGhost, 'mt-3 w-full')}>
                Mostrar las {entries.length.toLocaleString('es')} sesiones
              </button>
            )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
