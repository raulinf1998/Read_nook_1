import { useState, useEffect, useRef } from 'react';
import { Plus, Moon, Sun, Upload, Tag, BookOpen, Palette } from 'lucide-react';
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
import { buildDemoBooks } from './demo';
import { iconBtn } from './components/ui';

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  reading: { title: 'Inicio', subtitle: 'Tu lectura de hoy, de un vistazo' },
  library: { title: 'Biblioteca', subtitle: 'Todos tus libros: busca, filtra y ordena' },
  shelf: { title: 'Estantería', subtitle: 'Tu colección, balda a balda' },
  challenge: { title: 'Reto anual', subtitle: 'Tu objetivo de lectura, día a día' },
  stats: { title: 'Estadísticas', subtitle: 'Páginas, géneros, autores y ritmos' },
};

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
  const { goal, setGoal, dark, setDark, theme, setTheme } = useServerSettings();

  const [tab, setTab] = useState<TabId>('reading');
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showThemes, setShowThemes] = useState(false);

  // Aplicar tema + modo, con transición suave solo durante el cambio
  const firstRun = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (!firstRun.current) {
      root.classList.add('theme-anim');
      const t = setTimeout(() => root.classList.remove('theme-anim'), 420);
      root.dataset.theme = theme;
      root.classList.toggle('dark', dark || theme === 'nocturno');
      return () => clearTimeout(t);
    }
    firstRun.current = false;
    root.dataset.theme = theme;
    root.classList.toggle('dark', dark || theme === 'nocturno');
  }, [dark, theme]);

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
  };

  if (loading) return <LoadingShell />;

  const isDark = dark || theme === 'nocturno';

  return (
    <div className="min-h-dvh text-ink">
      <Sidebar
        active={tab}
        onChange={setTab}
        counts={counts}
        onAdd={handleAdd}
        onImport={() => setShowImport(true)}
        onTags={() => setShowTagManager(true)}
        onAppearance={() => setShowThemes(true)}
        theme={theme}
        onSetTheme={setTheme}
        dark={isDark}
        onToggleDark={() => setDark(!isDark)}
      />

      <div className="lg:pl-[272px] flex flex-col min-h-dvh">
        {/* Cabecera móvil / tablet */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-line">
          <div className="px-4 py-3 flex items-center justify-between max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-btn bg-grad-primary text-ongrad flex items-center justify-center shadow-card shrink-0">
                <BookOpen size={17} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-semibold text-base leading-none text-ink truncate">Read Nook</h1>
                <p className="text-[11px] text-ink3 mt-0.5 truncate">{TAB_TITLES[tab].title}</p>
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
          {/* Encabezado de página */}
          <div className="mb-6 animate-fade-up" key={`head-${tab}`}>
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
          </div>

          <div key={tab} className="animate-fade-up">
            {tab === 'reading' && (
              <ReadingNow
                books={books}
                goal={goal}
                onUpdate={updateBook}
                onEdit={handleEdit}
                onAdd={handleAdd}
                onLoadDemo={handleLoadDemo}
                onGoChallenge={() => setTab('challenge')}
              />
            )}
            {tab === 'stats' && <Statistics books={books} />}
            {tab === 'challenge' && <ReadingChallenge books={books} goal={goal} onSetGoal={setGoal} />}
            {tab === 'library' && <Library books={books} onUpdate={updateBook} onDelete={deleteBook} onEdit={handleEdit} />}
            {tab === 'shelf' && <Bookshelf books={books} onEdit={handleEdit} />}
          </div>
        </main>

        <footer className="hidden lg:block pb-8 text-center text-[11px] text-ink3">
          Read Nook · hecho para leer un poco más cada día
        </footer>
      </div>

      <MobileNav active={tab} onChange={setTab} />

      {/* Modales */}
      {showForm && (
        <BookForm
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditingBook(null); }}
          editingBook={editingBook}
          availableTags={tags.length ? tags : DEFAULT_TAGS}
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
          <p className="text-center text-sm font-medium text-ink3 mt-10">Abriendo tu rincón de lectura…</p>
        </div>
      </div>
    </div>
  );
}
