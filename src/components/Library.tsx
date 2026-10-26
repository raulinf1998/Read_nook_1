import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2, LayoutGrid, Rows3, SearchX, TriangleAlert } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META, FORMAT_META } from '../types';
import { StarRating } from './StarRating';
import { BookCover, EmptyState, Modal, StatusBadge, btnGhost, cardCls, cx, filterChipCls, iconBtn, selectCls } from './ui';
import { useLocalStorage } from '../hooks';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  books: Book[];
  onUpdate: (id: string, patch: Partial<Book>) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
}

type ViewMode = 'grid' | 'list';

export function Library({ books, onDelete, onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'title' | 'author' | 'rating'>('recent');
  const [view, setView] = useLocalStorage<ViewMode>('readnook-library-view', 'grid');
  const [confirming, setConfirming] = useState<Book | null>(null);

  const filtered = useMemo(() => {
    let result = books;
    if (statusFilter !== 'all') result = result.filter((b) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...result];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    else if (sort === 'author') sorted.sort((a, b) => a.author.localeCompare(b.author, 'es'));
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [books, statusFilter, search, sort]);

  return (
    <div className="space-y-4">
      {/* Buscador + orden + vista */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, autor o género…"
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-surface border border-line text-ink placeholder:text-ink3 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm shadow-card"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={cx(selectCls, 'rounded-full shadow-card')}
          aria-label="Ordenar por"
        >
          <option value="recent">Más recientes</option>
          <option value="title">Título</option>
          <option value="author">Autor</option>
          <option value="rating">Puntuación</option>
        </select>
        <div className="flex rounded-full border border-line bg-surface shadow-card p-1" role="group" aria-label="Modo de vista">
          <ViewBtn active={view === 'grid'} onClick={() => setView('grid')} icon={<LayoutGrid size={16} />} label="Rejilla" />
          <ViewBtn active={view === 'list'} onClick={() => setView('list')} icon={<Rows3 size={16} />} label="Lista" />
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'reading', 'pending', 'read'] as const).map((s) => {
          const label = s === 'all' ? 'Todos' : STATUS_META[s].label;
          const count = s === 'all' ? books.length : books.filter((b) => b.status === s).length;
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={filterChipCls(active)} aria-pressed={active}>
              {s !== 'all' && <span className={cx('w-2 h-2 rounded-full', STATUS_META[s].dot)} />}
              {label}
              <span className={active ? 'text-onprimary/70 text-xs' : 'text-ink3 text-xs'}>{count}</span>
            </button>
          );
        })}
        <span className="ml-auto text-xs font-medium text-ink3 whitespace-nowrap pl-2">
          {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX size={26} />}
          title="No se encontraron libros"
          description="Prueba con otro filtro o término de búsqueda. La búsqueda también mira autores y géneros."
        >
          {(search || statusFilter !== 'all') && (
            <button
              className={btnGhost}
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
            >
              Limpiar filtros
            </button>
          )}
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 stagger">
          {filtered.map((book) => (
            <GridCard key={book.id} book={book} onEdit={() => onEdit(book)} onAskDelete={() => setConfirming(book)} />
          ))}
        </div>
      ) : (
        <ListView books={filtered} onEdit={onEdit} onAskDelete={setConfirming} />
      )}

      {/* Confirmación de borrado */}
      {confirming && (
        <Modal
          title="Eliminar libro"
          icon={<TriangleAlert size={17} />}
          onClose={() => setConfirming(null)}
          maxWidth="max-w-sm"
          footer={
            <div className="flex gap-2.5">
              <button onClick={() => setConfirming(null)} className={cx(btnGhost, 'flex-1 bg-surface border border-line')}>
                Cancelar
              </button>
              <button
                onClick={() => { onDelete(confirming.id); setConfirming(null); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-btn bg-danger text-white text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          }
        >
          <div className="flex gap-3.5 items-center">
            <BookCover title={confirming.title} author={confirming.author} coverUrl={confirming.coverUrl} detail="sm" className="w-11 h-16 shadow-book" />
            <div className="min-w-0">
              <p className="font-display font-semibold text-ink leading-snug line-clamp-2">«{confirming.title}»</p>
              <p className="text-xs text-ink3 mt-0.5">{confirming.author || 'Autor desconocido'}</p>
            </div>
          </div>
          <p className="text-sm text-ink2 mt-4 leading-relaxed">
            Se borrará de tu biblioteca junto con sus notas y su diario lector. Esta acción no se puede deshacer.
          </p>
        </Modal>
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Vista de ${label}`}
      className={cx(
        'px-3 py-1.5 rounded-full transition-all active:scale-95',
        active ? 'bg-primary text-onprimary shadow-card' : 'text-ink3 hover:text-ink'
      )}
    >
      {icon}
    </button>
  );
}

/* ---------- Vista de rejilla ---------- */

function GridCard({ book, onEdit, onAskDelete }: { book: Book; onEdit: () => void; onAskDelete: () => void }) {
  const pct = book.pages > 0 ? Math.min((book.currentPage / book.pages) * 100, 100) : 0;
  return (
    <article className={cx(cardCls, 'group overflow-hidden hover:shadow-lift hover:-translate-y-1 transition-all duration-300')}>
      <button onClick={onEdit} className="block w-full relative bg-sunken" aria-label={`Abrir ${book.title}`}>
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          detail="lg"
          className="w-full aspect-[2/3] group-hover:scale-[1.03] transition-transform duration-500"
        />
        <StatusBadge status={book.status} className="absolute top-2 left-2 backdrop-blur-md bg-surface/80 shadow-card" />
        {book.status === 'reading' && book.pages > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] font-extrabold bg-surface/85 backdrop-blur-md text-ink px-1.5 py-0.5 rounded-md shadow-card tabular-nums">
            {pct.toFixed(0)}%
          </span>
        )}
      </button>
      <div className="p-3">
        <h3 className="font-display font-semibold text-ink text-sm leading-snug line-clamp-2 min-h-[2.5em]">{book.title}</h3>
        <p className="text-xs text-ink3 truncate mt-1">{book.author || 'Autor desconocido'}</p>
        <div className="flex items-center justify-between mt-2 gap-1">
          {book.rating > 0 ? (
            <StarRating value={book.rating} size={12} />
          ) : (
            <span className="text-[11px] text-ink3">{book.pages ? `${book.pages} págs` : ' '}</span>
          )}
          <span className="flex gap-0.5 -mr-1.5">
            <button onClick={onEdit} className={cx(iconBtn, 'p-1.5')} aria-label={`Editar ${book.title}`}>
              <Pencil size={14} />
            </button>
            <button onClick={onAskDelete} className={cx(iconBtn, 'p-1.5 hover:!text-danger hover:!bg-danger/10')} aria-label={`Eliminar ${book.title}`}>
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

/* ---------- Vista de lista / tabla ---------- */

function ListView({ books, onEdit, onAskDelete }: { books: Book[]; onEdit: (b: Book) => void; onAskDelete: (b: Book) => void }) {
  return (
    <div className={cx(cardCls, 'overflow-hidden')}>
      {/* Tabla escritorio */}
      <table className="hidden md:table w-full">
        <thead>
          <tr className="border-b border-line bg-sunken/50">
            {['Libro', 'Estado', 'Formato', 'Págs', 'Terminado', 'Valoración', ''].map((h, i) => (
              <th key={i} className="text-left text-[11px] font-bold uppercase tracking-wider text-ink3 px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id} className="border-b border-line/60 last:border-0 hover:bg-sunken/60 transition-colors group">
              <td className="px-4 py-2.5">
                <button onClick={() => onEdit(book)} className="flex items-center gap-3 text-left min-w-0">
                  <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-9 h-[52px] shadow-book" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate max-w-[320px]">{book.title}</span>
                    <span className="block text-xs text-ink3 truncate max-w-[320px]">{book.author || 'Autor desconocido'}</span>
                  </span>
                </button>
              </td>
              <td className="px-4 py-2.5"><StatusBadge status={book.status} /></td>
              <td className="px-4 py-2.5 text-xs text-ink2 whitespace-nowrap">{FORMAT_META[book.format].label}</td>
              <td className="px-4 py-2.5 text-xs text-ink2 tabular-nums">{book.pages || '—'}</td>
              <td className="px-4 py-2.5 text-xs text-ink2 whitespace-nowrap">{book.finishedAt ? formatDate(book.finishedAt) : '—'}</td>
              <td className="px-4 py-2.5">
                {book.rating > 0 ? <StarRating value={book.rating} size={12} /> : <span className="text-xs text-ink3">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex gap-0.5 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(book)} className={cx(iconBtn, 'p-1.5')} aria-label={`Editar ${book.title}`}>
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => onAskDelete(book)} className={cx(iconBtn, 'p-1.5 hover:!text-danger hover:!bg-danger/10')} aria-label={`Eliminar ${book.title}`}>
                    <Trash2 size={15} />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Lista móvil */}
      <div className="md:hidden divide-y divide-line/70">
        {books.map((book) => (
          <div key={book.id} className="p-3 flex items-center gap-3">
            <button onClick={() => onEdit(book)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-10 h-[60px] shadow-book" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{book.title}</span>
                <span className="block text-xs text-ink3 truncate">{book.author || 'Autor desconocido'}</span>
                <span className="flex items-center gap-2 mt-1.5">
                  <StatusBadge status={book.status} />
                  {book.rating > 0 && <StarRating value={book.rating} size={11} />}
                </span>
              </span>
            </button>
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => onEdit(book)} className={iconBtn} aria-label={`Editar ${book.title}`}>
                <Pencil size={16} />
              </button>
              <button onClick={() => onAskDelete(book)} className={cx(iconBtn, 'hover:!text-danger hover:!bg-danger/10')} aria-label={`Eliminar ${book.title}`}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
