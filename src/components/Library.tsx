import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2, BookMarked, Star, Filter, Calendar } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META, FORMAT_META } from '../types';
import { StarRating } from './StarRating';

interface Props {
  books: Book[];
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
}

export function Library({ books, onDelete, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'title' | 'author' | 'rating'>('recent');

  const filtered = useMemo(() => {
    let result = books;
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      );
    }
    const sorted = [...result];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'author') sorted.sort((a, b) => a.author.localeCompare(b.author));
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [books, statusFilter, search, sort]);

  return (
    <div className="space-y-4">
      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o autor..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 focus:border-gray-300 dark:focus:border-gray-700 focus:ring-2 focus:ring-gray-900/5 dark:focus:ring-white/5 outline-none transition-all text-sm text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-gray-300 dark:focus:border-gray-700"
        >
          <option value="recent">Recientes</option>
          <option value="title">Título</option>
          <option value="author">Autor</option>
          <option value="rating">Puntuación</option>
        </select>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'reading', 'pending', 'read'] as const).map((s) => {
          const label = s === 'all' ? 'Todos' : STATUS_META[s].label;
          const count = s === 'all' ? books.length : books.filter((b) => b.status === s).length;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800'
              }`}
            >
              {label}
              <span className={`text-xs ${active ? 'text-white/60 dark:text-gray-500' : 'text-gray-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
            <Filter size={24} className="text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No se encontraron libros</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Prueba con otro filtro o búsqueda</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
          {/* Desktop table */}
          <table className="hidden sm:table w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Libro</th>
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Estado</th>
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Formato</th>
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Págs</th>
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Terminado</th>
                <th className="text-left text-xs font-medium text-gray-400 dark:text-gray-500 px-4 py-3">Valoración</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((book) => {
                const meta = STATUS_META[book.status];
                return (
                  <tr key={book.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt={book.title} className="w-9 h-12 object-cover rounded-sm flex-shrink-0 bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-9 h-12 rounded-sm bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <BookMarked size={14} className="text-gray-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{book.title}</p>
                          <p className="text-xs text-gray-400 truncate">{book.author || 'Autor desconocido'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge} ${meta.badgeDark}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{FORMAT_META[book.format].label}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{book.pages || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {book.finishedAt ? new Date(book.finishedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {book.rating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          {book.rating}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(book)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <Pencil size={15} className="text-gray-500 dark:text-gray-400" />
                        </button>
                        <button onClick={() => onDelete(book.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                          <Trash2 size={15} className="text-gray-500 dark:text-gray-400 group-hover:text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800/50">
            {filtered.map((book) => {
              const meta = STATUS_META[book.status];
              return (
                <div key={book.id} className="p-3 flex items-center gap-3">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded-sm flex-shrink-0 bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-10 h-14 rounded-sm bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <BookMarked size={14} className="text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{book.title}</p>
                    <p className="text-xs text-gray-400 truncate">{book.author || 'Autor desconocido'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${meta.badge} ${meta.badgeDark}`}>
                        <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      {book.finishedAt && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Calendar size={10} />
                          {new Date(book.finishedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      {book.rating > 0 && <StarRating value={book.rating} size={12} />}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => onEdit(book)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Pencil size={15} className="text-gray-500 dark:text-gray-400" />
                    </button>
                    <button onClick={() => onDelete(book.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 size={15} className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
