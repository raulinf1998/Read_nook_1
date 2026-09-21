import { useState } from 'react';
import { X, NotebookPen, Plus, Trash2, Calendar } from 'lucide-react';
import type { Book, JournalEntry } from '../types';
import { makeJournalEntry } from '../lib';

interface Props {
  book: Book;
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onClose: () => void;
}

export function JournalModal({ book, onUpdate, onClose }: Props) {
  const [pages, setPages] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<JournalEntry[]>(book.journal || []);

  const handleAdd = () => {
    const p = parseInt(pages) || 0;
    if (p <= 0 && !note.trim()) return;
    const entry = makeJournalEntry(p, note.trim());
    const newEntries = [entry, ...entries];
    setEntries(newEntries);

    // Update currentPage and progress
    const totalRead = newEntries.reduce((s, e) => s + e.pages, 0);
    const newCurrentPage = Math.min(totalRead, book.pages || totalRead);
    const patch: Partial<Book> = {
      journal: newEntries,
      currentPage: newCurrentPage,
    };
    if (book.pages > 0 && newCurrentPage >= book.pages && book.status !== 'read') {
      patch.status = 'read';
      patch.finishedAt = new Date(date).getTime();
    }
    onUpdate(book.id, patch);

    setPages('');
    setNote('');
  };

  const handleDelete = (entryId: string) => {
    const newEntries = entries.filter((e) => e.id !== entryId);
    setEntries(newEntries);
    const totalRead = newEntries.reduce((s, e) => s + e.pages, 0);
    const newCurrentPage = Math.min(totalRead, book.pages || totalRead);
    onUpdate(book.id, { journal: newEntries, currentPage: newCurrentPage });
  };

  const totalPagesRead = entries.reduce((s, e) => s + e.pages, 0);
  const pct = book.pages > 0 ? Math.min((totalPagesRead / book.pages) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <NotebookPen size={20} className="text-gray-700 dark:text-gray-300" />
            Diario lector
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Book info */}
          <div className="flex items-center gap-3">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-12 h-16 object-cover rounded-md flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-12 h-16 rounded-md bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{book.title}</p>
              <p className="text-xs text-gray-400 truncate">{book.author}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{totalPagesRead} / {book.pages || '?'} págs</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Add entry */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3.5 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:border-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Páginas</label>
                <input
                  type="number"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="40"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:border-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nota (opcional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Capítulo 5, gran giro..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:border-gray-400"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!pages && !note.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Registrar avance
            </button>
          </div>

          {/* History */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Historial de avances</h3>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Aún no has registrado avances.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {entries.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 group">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                      <Calendar size={16} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {new Date(entry.date).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {entry.pages > 0 && (
                          <span className="text-xs text-blue-500 font-medium">{entry.pages} págs</span>
                        )}
                      </div>
                      {entry.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry.note}</p>}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
