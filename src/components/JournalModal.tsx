import { useState } from 'react';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import type { Book, JournalEntry } from '../types';
import { makeJournalEntry } from '../lib';
import { BookCover, Modal, ProgressBar, btnPrimary, cx, iconBtn, inputCls } from './ui';

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

  const pushUpdate = (newEntries: JournalEntry[]) => {
    const totalRead = newEntries.reduce((s, e) => s + e.pages, 0);
    const newCurrentPage = Math.min(totalRead, book.pages || totalRead);
    const patch: Partial<Book> = { journal: newEntries, currentPage: newCurrentPage };
    if (book.pages > 0 && newCurrentPage >= book.pages && book.status !== 'read') {
      patch.status = 'read';
      patch.finishedAt = new Date(date).getTime();
    }
    onUpdate(book.id, patch);
  };

  const handleAdd = () => {
    const p = parseInt(pages) || 0;
    if (p <= 0 && !note.trim()) return;
    // La entrada guarda la fecha elegida en el selector (antes siempre era "hoy")
    const entry: JournalEntry = { ...makeJournalEntry(p, note.trim()), date: new Date(date).getTime() || Date.now() };
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

  const totalPagesRead = entries.reduce((s, e) => s + e.pages, 0);
  const pct = book.pages > 0 ? Math.min((totalPagesRead / book.pages) * 100, 100) : 0;

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
              <span className="font-semibold text-ink2 tabular-nums">{totalPagesRead} / {book.pages || '?'} págs</span>
              <span className="font-extrabold text-accent tabular-nums">{pct.toFixed(0)}%</span>
            </div>
            <ProgressBar pct={pct} className="h-2 mt-1.5" />
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
            <ol className="relative space-y-2.5 max-h-72 overflow-y-auto pr-1 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-line">
              {entries.map((entry) => (
                <li key={entry.id} className="relative flex items-start gap-3 group">
                  <span className="relative z-10 shrink-0 w-[35px] h-[35px] rounded-full bg-accent/10 ring-4 ring-surface flex flex-col items-center justify-center text-accent">
                    <span className="text-[11px] font-extrabold leading-none tabular-nums">{new Date(entry.date).getDate()}</span>
                    <span className="text-[7px] font-bold uppercase leading-none mt-px">
                      {new Date(entry.date).toLocaleDateString('es', { month: 'short' }).replace('.', '')}
                    </span>
                  </span>
                  <div className="flex-1 min-w-0 bg-sunken/60 rounded-btn px-3 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-ink capitalize">
                        {new Date(entry.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {entry.pages > 0 && (
                        <span className="text-[10px] font-extrabold bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">+{entry.pages} págs</span>
                      )}
                    </div>
                    {entry.note && <p className="text-xs text-ink2 mt-1 leading-relaxed">{entry.note}</p>}
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
          )}
        </div>
      </div>
    </Modal>
  );
}
