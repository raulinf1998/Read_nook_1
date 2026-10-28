import { useState, useMemo } from 'react';
import { BookOpen, FileText, Search, Pencil, Star, Trash2, LayoutGrid, Rows3, SearchX, TriangleAlert } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META, formatLabel, seriesLabel } from '../types';
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
  onOpen: (book: Book) => void;
}

type ViewMode = 'grid' | 'list';

export function Library({ books, onDelete, onEdit, onOpen }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookStatus | 'all'>('all');
  const [sort, setSort] = useState<'recent' | 'title' | 'author' | 'rating' | 'series'>('recent');
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
          (b.series || '').toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...result];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'));
    else if (sort === 'author') sorted.sort((a, b) => a.author.localeCompare(b.author, 'es'));
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === 'series') {
      const position = (book: Book) => {
        const value = Number.parseFloat((book.seriesPosition || '').replace(',', '.'));
        return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
      };
      sorted.sort((a, b) => (a.series || '￿').localeCompare(b.series || '￿', 'es')
        || position(a) - position(b)
        || a.title.localeCompare(b.title, 'es'));
    }
    else sorted.sort((a, b) => b.createdAt - a.createdAt);
    return sorted;
  }, [books, statusFilter, search, sort]);

  const libraryStats = useMemo(() => {
    const rated = books.filter((book) => book.rating > 0);
    return {
      totalPages: books.reduce((sum, book) => sum + (book.pages || 0), 0),
      reading: books.filter((book) => book.status === 'reading').length,
      pending: books.filter((book) => book.status === 'pending').length,
      rated: rated.length,
      averageRating: rated.length
        ? (rated.reduce((sum, book) => sum + book.rating, 0) / rated.length).toFixed(1)
        : '—',
    };
  }, [books]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Resumen rápido de la colección */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 stagger">
        <LibraryStat
          icon={<BookOpen size={16} />}
          value={books.length.toLocaleString('es')}
          label="Libros"
          detail={`${libraryStats.reading} en curso`}
        />
        <LibraryStat
          icon={<FileText size={16} />}
          value={libraryStats.totalPages.toLocaleString('es')}
          label="Páginas"
          detail={`${libraryStats.pending} pendientes`}
        />
        <LibraryStat
          icon={<Star size={16} />}
          value={libraryStats.averageRating}
          label="Nota media"
          detail={`${libraryStats.rated} valorados`}
        />
      </div>

      <section className={cx(cardCls, 'space-y-3 p-3 sm:p-4')}>
      {/* Buscador + orden + vista */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, autor, saga o género…"
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
          <option value="series">Saga y número</option>
        </select>
        <div className="flex rounded-full border border-line bg-surface shadow-card p-1" role="group" aria-label="Modo de vista">
          <ViewBtn active={view === 'grid'} onClick={() => setView('grid')} icon={<LayoutGrid size={16} />} label="Rejilla" />
          <ViewBtn active={view === 'list'} onClick={() => setView('list')} icon={<Rows3 size={16} />} label="Lista" />
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'reading', 'pending', 'read', 'dnf'] as const).map((s) => {
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
      </section>

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
        <div className="grid grid-cols-3 gap-2.5 min-[420px]:gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6 stagger">
          {filtered.map((book) => (
            <GridCard key={book.id} book={book} onOpen={() => onOpen(book)} onEdit={() => onEdit(book)} onAskDelete={() => setConfirming(book)} />
          ))}
        </div>
      ) : (
        <ListView books={filtered} onOpen={onOpen} onEdit={onEdit} onAskDelete={setConfirming} />
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

function GridCard({ book, onOpen, onEdit, onAskDelete }: { book: Book; onOpen: () => void; onEdit: () => void; onAskDelete: () => void }) {
  const pct = book.pages > 0 ? Math.min((book.currentPage / book.pages) * 100, 100) : 0;
  const status = STATUS_META[book.status];
  return (
    <article className={cx(
      cardCls,
      'group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift',
    )}>
      <button
        onClick={onOpen}
        className="relative block aspect-[2/3] w-full shrink-0 overflow-hidden bg-sunken text-left"
        aria-label={`Abrir ficha de ${book.title}`}
      >
        <BookCover
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          detail="lg"
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.035]"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-70" aria-hidden />
        <span
          className={cx('absolute right-2 top-2 h-2.5 w-2.5 rounded-full shadow ring-2 ring-white/80', status.dot)}
          title={status.label}
          aria-hidden
        />
        {book.status === 'reading' && book.pages > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-surface/90 px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums text-ink shadow-card backdrop-blur-md">
            {pct.toFixed(0)}%
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <h3 className="h-[2.65em] font-display text-[12px] font-semibold leading-snug text-ink line-clamp-2 sm:text-sm">
          <button onClick={onOpen} className="text-left hover:text-accent transition-colors">{book.title}</button>
        </h3>
        <p className="mt-1 h-4 truncate text-[11px] text-ink3 sm:text-xs">{book.author || 'Autor desconocido'}</p>
        <p className="mt-0.5 h-4 truncate text-[9px] font-extrabold uppercase tracking-wide text-accent sm:text-[10px]" title={seriesLabel(book) || undefined}>
          {seriesLabel(book) || '\u00a0'}
        </p>

        <div className="mt-1.5 flex h-4 items-center gap-1.5 text-[10px] font-semibold text-ink3">
          <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', status.dot)} aria-hidden />
          <span className="truncate">{status.label}</span>
          <span className="hidden min-[420px]:inline" aria-hidden>·</span>
          <span className="hidden min-[420px]:inline truncate">{formatLabel(book.format)}</span>
          {book.pages > 0 && <span className="ml-auto shrink-0 tabular-nums">{book.pages} págs</span>}
        </div>

        <div className="mt-auto flex min-h-8 items-end justify-between gap-1 pt-2">
          <span className="min-w-0">
            {book.rating > 0 ? (
              <>
                <span className="text-[11px] font-extrabold tabular-nums text-gold sm:hidden">
                  ★ {book.rating.toFixed(1)}
                </span>
                <span className="hidden sm:block">
                  <StarRating value={book.rating} size={11} />
                </span>
              </>
            ) : (
              <span className="text-[10px] font-semibold text-ink3">Sin nota</span>
            )}
          </span>
          <span className="flex shrink-0 gap-0.5 -mr-1.5">
            <button onClick={onEdit} className={cx(iconBtn, 'hidden p-1.5 min-[420px]:inline-flex')} aria-label={`Editar ${book.title}`}>
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

function LibraryStat({ icon, value, label, detail }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className={cx(cardCls, 'flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4')}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent sm:h-9 sm:w-9">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-semibold leading-none tabular-nums text-ink sm:text-xl">
          {value}
        </span>
        <span className="mt-1 block truncate text-[9px] font-extrabold uppercase tracking-wide text-ink3">
          {label} · {detail}
        </span>
      </span>
    </div>
  );
}

/* ---------- Vista de lista / tabla ---------- */

function ListView({ books, onOpen, onEdit, onAskDelete }: { books: Book[]; onOpen: (b: Book) => void; onEdit: (b: Book) => void; onAskDelete: (b: Book) => void }) {
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
                <button onClick={() => onOpen(book)} className="flex items-center gap-3 text-left min-w-0" aria-label={`Abrir ficha de ${book.title}`}>
                  <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-9 h-[52px] shadow-book" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate max-w-[320px]">{book.title}</span>
                    <span className="block text-xs text-ink3 truncate max-w-[320px]">{book.author || 'Autor desconocido'}</span>
                    {seriesLabel(book) && <span className="block text-[10px] font-extrabold uppercase tracking-wide text-accent truncate max-w-[320px]">{seriesLabel(book)}</span>}
                  </span>
                </button>
              </td>
              <td className="px-4 py-2.5"><StatusBadge status={book.status} /></td>
              <td className="px-4 py-2.5 text-xs text-ink2 whitespace-nowrap">{formatLabel(book.format)}</td>
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
            <button onClick={() => onOpen(book)} className="flex items-center gap-3 flex-1 min-w-0 text-left" aria-label={`Abrir ficha de ${book.title}`}>
              <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-9 h-[54px] shadow-book" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{book.title}</span>
                <span className="block text-xs text-ink3 truncate">{book.author || 'Autor desconocido'}</span>
                {seriesLabel(book) && <span className="block text-[10px] font-extrabold uppercase tracking-wide text-accent truncate">{seriesLabel(book)}</span>}
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
