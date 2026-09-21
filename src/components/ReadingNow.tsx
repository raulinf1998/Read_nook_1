import { BookOpen, Bookmark, ChevronRight } from 'lucide-react';
import type { Book } from '../types';

interface Props {
  books: Book[];
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onEdit: (book: Book) => void;
}

export function ReadingNow({ books, onUpdate, onEdit }: Props) {
  const reading = books.filter((b) => b.status === 'reading');
  const pending = books.filter((b) => b.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Currently reading */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <BookOpen size={18} className="text-blue-500" />
          Leyendo ahora
        </h2>

        {reading.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <BookOpen size={32} className="text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No estás leyendo ningún libro ahora mismo.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Cambia el estado de un libro a "Leyendo" para verlo aquí.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reading.map((book) => {
              const pct = book.pages > 0 ? Math.min((book.currentPage / book.pages) * 100, 100) : 0;
              return (
                <div key={book.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm animate-fade-in">
                  <div className="flex gap-4">
                    {/* Cover */}
                    <div className="flex-shrink-0">
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-20 h-28 object-cover rounded-lg shadow-md bg-gray-100"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-20 h-28 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                          <BookOpen size={24} className="text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{book.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{book.author || 'Autor desconocido'}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {book.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{t}</span>
                        ))}
                      </div>

                      {/* Progress */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {book.currentPage} / {book.pages || '?'} págs
                          </span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick slider */}
                      {book.pages > 0 && (
                        <div className="mt-3">
                          <input
                            type="range"
                            min={0}
                            max={book.pages}
                            value={book.currentPage}
                            onChange={(e) => {
                              const page = parseInt(e.target.value);
                              const patch: Partial<Book> = { currentPage: page };
                              if (page >= book.pages) {
                                patch.status = 'read';
                                patch.finishedAt = Date.now();
                              }
                              onUpdate(book.id, patch);
                            }}
                            className="book-slider w-full"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 ${pct}%, #e5e7eb ${pct}%)`,
                            }}
                          />
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-gray-400">Arrastra para actualizar</span>
                            <button
                              onClick={() => onEdit(book)}
                              className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white inline-flex items-center gap-0.5 transition-colors"
                            >
                              Editar <ChevronRight size={10} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Bookmark size={18} className="text-amber-500" />
          Lecturas pendientes
          <span className="text-sm font-normal text-gray-400">({pending.length})</span>
        </h2>

        {pending.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <Bookmark size={32} className="text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No tienes libros pendientes.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pending.map((book) => (
              <div
                key={book.id}
                className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3 hover:shadow-sm transition-all animate-fade-in"
              >
                {book.coverUrl ? (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded-md flex-shrink-0 bg-gray-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-12 h-16 rounded-md bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center flex-shrink-0">
                    <Bookmark size={16} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate">{book.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{book.author || 'Autor desconocido'}</p>
                  {book.pages > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{book.pages} págs</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => onUpdate(book.id, { status: 'reading', startedAt: Date.now() })}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    Empezar
                  </button>
                  <button
                    onClick={() => onEdit(book)}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
