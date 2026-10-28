import { useState, useEffect, useRef } from 'react';
import { Plus, Moon, Sun, Upload, Tag, Palette } from 'lucide-react';
import type { Book } from './types';
import { DEFAULT_TAGS } from './types';
import { useBooks, useServerSettings, useServerTags } from './hooks';
import { Sidebar, MobileNav } from './components/Navigation';
import type { TabId } from './components/Navigation';
import { BookForm } from './components/BookForm';
import { ImportModal } from './components/ImportModal';
import { TagManager } from './components/TagManager';
import { ThemePicker } from './components/ThemePicker';
import { ReadingNow } from './components/ReadingNow';
import { Statistics } from './components/Statistics';
import { ReadingChallenge } from './components/ReadingChallenge';
import { Library } from './components/Library';
import { Bookshelf } from './components/Bookshelf';
import { Discover } from './components/Discover';
import { BookDetail } from './components/BookDetail';
import { buildDemoBooks } from './demo';
import { applyCustomPaletteToRoot } from './themePalettes';
import { BrandMark, iconBtn } from './components/ui';

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  reading: { title: 'Inicio', subtitle: 'Tu lectura de hoy, de un vistazo' },
  library: { title: 'Biblioteca', subtitle: 'Todos tus libros: busca, filtra y ordena' },
  shelf: { title: 'Estantería', subtitle: 'Tu colección, balda a balda' },
  discover: { title: 'Descubrir', subtitle: 'Ideas para tu próxima lectura, según tus gustos' },
  challenge: { title: 'Reto anual', subtitle: 'Tu objetivo de lectura, día a día' },
  stats: { title: 'Estadísticas', subtitle: 'Páginas, géneros, autores y ritmos' },
};

function bookIdFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#\/libro\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 7) return 'Buenas noches, búho lector';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function App() {
  const { books, loading, addBook, updateBook, deleteBook, importBooks, mergeExistingStoryGraphJournal } = useBooks();
  const { tags, addTag, removeTag } = useServerTags();
  const {
    goal,
    setGoal,
    dark,
    setDark,
    theme,
    setTheme,
    customPalettes,
    activeCustomPalette,
    applyCustomPalette,
    saveCustomPalette,
    deleteCustomPalette,
  } = useServerSettings();

  const [tab, setTab] = useState<TabId>('reading');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => bookIdFromHash());
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  // Aplicar tema + modo + paleta personalizada, con transición suave al cambiar
  const firstRun = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const effectiveDark = dark || theme === 'nocturno';
    let timeout: number | undefined;

    if (!firstRun.current) {
      root.classList.add('theme-anim');
      timeout = window.setTimeout(() => root.classList.remove('theme-anim'), 420);
    }
    firstRun.current = false;
    root.dataset.theme = theme;
    root.classList.toggle('dark', effectiveDark);
    applyCustomPaletteToRoot(activeCustomPalette, effectiveDark);

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [activeCustomPalette, dark, theme]);

  // La ficha de un libro tiene su propia dirección (#/libro/:id), así el
  // botón Atrás del móvil/navegador vuelve a la lista anterior.
  useEffect(() => {
    const syncBookFromHash = () => setSelectedBookId(bookIdFromHash());
    window.addEventListener('hashchange', syncBookFromHash);
    return () => window.removeEventListener('hashchange', syncBookFromHash);
  }, []);

  const selectedBook = selectedBookId
    ? books.find((book) => book.id === selectedBookId) || null
    : null;

  useEffect(() => {
    if (!loading && selectedBookId && !selectedBook) {
      setSelectedBookId(null);
      window.history.replaceState(null, '', '#/');
    }
  }, [loading, selectedBook, selectedBookId]);

  const handleTab = (nextTab: TabId) => {
    setSelectedBookId(null);
    setTab(nextTab);
    if (window.location.hash.startsWith('#/libro/')) window.location.hash = '/';
    window.scrollTo({ top: 0 });
  };

  const handleOpen = (book: Book) => {
    setSelectedBookId(book.id);
    const target = `#/libro/${encodeURIComponent(book.id)}`;
    if (window.location.hash !== target) window.location.hash = target;
    window.scrollTo({ top: 0 });
  };

  const closeBookDetail = () => {
    setSelectedBookId(null);
    if (window.location.hash.startsWith('#/libro/')) window.location.hash = '/';
    window.scrollTo({ top: 0 });
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setShowForm(true);
  };
  const handleAdd = () => {
    setEditingBook(null);
    setShowForm(true);
  };
  const handleSubmit = async (data: Omit<Book, 'id' | 'createdAt'>) => {
    if (editingBook) await updateBook(editingBook.id, data);
    else await addBook(data);
  };
  const handleLoadDemo = async () => {
    try {
      await importBooks(buildDemoBooks());
    } catch {
      /* sin servidor no hay demo que cargar */
    }
  };

  const counts: Partial<Record<TabId, number>> = {
    reading: books.filter((b) => b.status === 'reading').length,
    library: books.length,
    shelf: books.length,
    discover: books.filter((b) => b.status === 'pending').length,
  };

  if (loading) return <LoadingShell />;

  const isDark = dark || theme === 'nocturno';

  return (
    <div className="min-h-dvh text-ink">
      <Sidebar
        active={tab}
        onChange={handleTab}
        counts={counts}
        onAdd={handleAdd}
        onImport={() => setShowImport(true)}
        onTags={() => setShowTagManager(true)}
        onAppearance={() => setShowThemes(true)}
        theme={theme}
        onSetTheme={setTheme}
        activePaletteName={activeCustomPalette?.name || null}
        dark={isDark}
        onToggleDark={() => setDark(!isDark)}
      />

      <div className="lg:pl-[272px] flex flex-col min-h-dvh">
        {/* Cabecera móvil / tablet */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-line">
          <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandMark className="h-9 w-9" />
              <div className="min-w-0">
                <h1 className="font-display font-semibold text-base leading-none text-ink truncate">Bilibook</h1>
                <p className="text-[11px] text-ink3 mt-0.5 truncate">{selectedBook ? selectedBook.title : TAB_TITLES[tab].title}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowTagManager(true)} className={iconBtn} aria-label="Gestionar tags">
                <Tag size={18} />
              </button>
              <button onClick={() => setShowImport(true)} className={iconBtn} aria-label="Importar CSV">
                <Upload size={18} />
              </button>
              <button onClick={() => setShowThemes(true)} className={iconBtn} aria-label="Cambiar apariencia">
                <Palette size={18} />
              </button>
              {theme !== 'nocturno' && (
                <button onClick={() => setDark(!dark)} className={iconBtn} aria-label={dark ? 'Modo claro' : 'Modo oscuro'}>
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}
              <button
                onClick={handleAdd}
                className="ml-1 inline-flex items-center gap-1 px-3 py-2 rounded-btn bg-primary text-onprimary text-sm font-bold shadow-card hover:bg-primaryhover active:scale-95 transition-all"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span className="hidden sm:inline">Añadir</span>
              </button>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 pt-5 sm:pt-7 pb-28 lg:pb-14">
          {/* Encabezado de página (la ficha de un libro lleva el suyo propio) */}
          {!selectedBook && <div className="mb-6 animate-fade-up" key={`head-${tab}`}>
            {tab === 'reading' && books.length > 0 && (
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent mb-1">{greeting()}</p>
            )}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="font-display text-[28px] sm:text-[34px] font-semibold text-ink leading-tight">
                  {TAB_TITLES[tab].title}
                </h2>
                <p className="text-sm text-ink3 mt-1">{TAB_TITLES[tab].subtitle}</p>
              </div>
              {/* Acciones de cabecera en PC */}
              <div className="hidden lg:flex items-center gap-1.5">
                <HeaderTool icon={<Upload size={16} />} label="Importar" onClick={() => setShowImport(true)} />
                <HeaderTool icon={<Tag size={16} />} label="Tags" onClick={() => setShowTagManager(true)} />
                <HeaderTool icon={<Palette size={16} />} label="Apariencia" onClick={() => setShowThemes(true)} />
              </div>
            </div>
          </div>}

          <div key={selectedBook ? `book-${selectedBook.id}` : tab} className="animate-fade-up">
            {selectedBook ? (
              <BookDetail
                key={selectedBook.id}
                book={selectedBook}
                books={books}
                onBack={closeBookDetail}
                onEdit={handleEdit}
                onUpdate={updateBook}
                onDelete={deleteBook}
                onOpen={handleOpen}
              />
            ) : (
              <>
            {tab === 'reading' && (
              <ReadingNow
                books={books}
                goal={goal}
                onUpdate={updateBook}
                onEdit={handleEdit}
                onOpen={handleOpen}
                onAdd={handleAdd}
                onLoadDemo={handleLoadDemo}
                onGoChallenge={() => handleTab('challenge')}
              />
            )}
            {tab === 'stats' && <Statistics books={books} />}
            {tab === 'challenge' && <ReadingChallenge books={books} goal={goal} onSetGoal={setGoal} onOpen={handleOpen} />}
            {tab === 'library' && <Library books={books} onUpdate={updateBook} onDelete={deleteBook} onEdit={handleEdit} onOpen={handleOpen} />}
            {tab === 'shelf' && <Bookshelf books={books} onOpen={handleOpen} />}
            {tab === 'discover' && <Discover books={books} onOpen={handleOpen} onAdd={handleAdd} />}
              </>
            )}
          </div>
        </main>

        <footer className="hidden lg:block pb-8 text-center text-[11px] text-ink3">
          Bilibook · hecho para leer un poco más cada día
        </footer>
      </div>

      <MobileNav active={tab} onChange={handleTab} />

      {/* Modales */}
      {showForm && (
        <BookForm
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingBook(null); }}
          editingBook={editingBook}
          availableTags={tags.length ? tags : DEFAULT_TAGS}
          availableSeries={[...new Set(books.map((book) => book.series?.trim()).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, 'es'))}
          onUpdateBook={updateBook}
        />
      )}
      {showImport && (
        <ImportModal
          existingBooks={books}
          onImport={importBooks}
          onMergeJournal={mergeExistingStoryGraphJournal}
          onClose={() => setShowImport(false)}
        />
      )}
      {showTagManager && (
        <TagManager tags={tags} onAdd={addTag} onRemove={removeTag} onClose={() => setShowTagManager(false)} />
      )}
      {showThemes && (
        <ThemePicker
          theme={theme}
          dark={isDark}
          onSetTheme={setTheme}
          onSetDark={setDark}
          customPalettes={customPalettes}
          activeCustomPalette={activeCustomPalette}
          onApplyCustomPalette={applyCustomPalette}
          onSaveCustomPalette={saveCustomPalette}
          onDeleteCustomPalette={deleteCustomPalette}
          onClose={() => setShowThemes(false)}
        />
      )}
    </div>
  );
}

function HeaderTool({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface border border-line text-xs font-bold text-ink2 shadow-card hover:text-ink hover:border-line2 hover:-translate-y-px active:scale-95 transition-all"
    >
      {icon}
      {label}
    </button>
  );
}

/** Pantalla de carga con esqueleto de la propia interfaz. */
function LoadingShell() {
  return (
    <div className="min-h-dvh text-ink" aria-busy="true" aria-label="Cargando tu biblioteca">
      <div className="lg:pl-[272px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 pt-10 animate-pulse">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-btn bg-sunken" />
            <div>
              <div className="h-5 w-36 rounded bg-sunken" />
              <div className="h-3 w-24 rounded bg-sunken mt-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-card bg-surface border border-line" />
            ))}
          </div>
          <div className="h-4 w-44 rounded bg-sunken mb-4" />
          <div className="grid gap-4 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-44 rounded-card bg-surface border border-line" />
            ))}
          </div>
          <p className="text-center text-sm font-medium text-ink3 mt-10">Abriendo Bilibook…</p>
        </div>
      </div>
    </div>
  );
}
