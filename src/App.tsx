import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Plus, Settings as SettingsIcon } from 'lucide-react';
import type { Book } from './types';
import { selectedAccount, ACCOUNT_NAMES, selectAccount } from './accounts';
import { apiClient } from './api';
import { DEFAULT_TAGS } from './types';
import { useBooks, useServerSettings, useServerTags } from './hooks';
import { Sidebar, MobileNav, MobileThemeToggle } from './components/Navigation';
import type { TabId } from './components/Navigation';
import { BookForm } from './components/BookForm';
import { ImportModal } from './components/ImportModal';
import { TagManager } from './components/TagManager';
import { ThemePicker } from './components/ThemePicker';
import { SettingsMenu } from './components/SettingsMenu';
import { ReadingNow } from './components/ReadingNow';
import { Statistics } from './components/Statistics';
import { ReadingChallenge } from './components/ReadingChallenge';
import { Library } from './components/Library';
import { Bookshelf } from './components/Bookshelf';
import { Space } from './components/Space';
import { Discover } from './components/Discover';
import { BookDetail } from './components/BookDetail';
import { SeriesDetail } from './components/SeriesDetail';
import { findSeriesGroup } from './series';
import { buildDemoBooks } from './demo';
import { applyCustomPaletteToRoot } from './themePalettes';
import { BrandMark, iconBtn } from './components/ui';

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  reading: { title: 'Inicio', subtitle: 'Tu lectura de hoy, de un vistazo' },
  library: { title: 'Biblioteca', subtitle: 'Todos tus libros: busca, filtra y ordena' },
  space: { title: 'Espacio', subtitle: 'Tu universo de lecturas, órbita a órbita' },
  shelf: { title: 'Estantería', subtitle: 'Tu colección, balda a balda' },
  discover: { title: 'Descubrir', subtitle: 'Ideas para tu próxima lectura, según tus gustos' },
  challenge: { title: 'Reto anual', subtitle: 'Tu objetivo de lectura, día a día' },
  stats: { title: 'Estadísticas', subtitle: 'Páginas, géneros, autores y ritmos' },
};

type HashRoute =
  | { kind: 'book'; id: string }
  | { kind: 'series'; name: string }
  | null;

function routeFromHash(): HashRoute {
  if (typeof window === 'undefined') return null;
  const bookMatch = window.location.hash.match(/^#\/libro\/([^/?#]+)/);
  const seriesMatch = window.location.hash.match(/^#\/saga\/([^/?#]+)/);
  const match = bookMatch || seriesMatch;
  if (!match) return null;

  let value = match[1];
  try {
    value = decodeURIComponent(value);
  } catch {
    // Se conserva el valor sin decodificar.
  }
  return bookMatch ? { kind: 'book', id: value } : { kind: 'series', name: value };
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
    libraryView,
    setLibraryView,
    chartPreferences,
    setChartPreference,
    shelfColors,
    setShelfColor,
    planetStyle,
    setPlanetStyle,
    settingsVersion,
    settingsSyncStatus,
    settingsSyncError,
    settingsLastSyncedAt,
    refreshSettings,
  } = useServerSettings();

  const [tab, setTab] = useState<TabId>('reading');
  const account = selectedAccount() || 'raul';
  const [sharedShelf, setSharedShelf] = useState(false);
  const [sharedBooks, setSharedBooks] = useState<(Book & { owner: 'raul' | 'pequenaja' })[]>([]);
  const [sharedError, setSharedError] = useState(false);
  useEffect(() => {
    if (tab !== 'shelf' || !sharedShelf) return;
    let active = true;
    const update = () => { apiClient.getSharedBooks().then((result) => { if (active) { setSharedBooks(result); setSharedError(false); } }).catch(() => { if (active) setSharedError(true); }); };
    update();
    const timer = window.setInterval(update, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab, sharedShelf, books]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => {
    const route = routeFromHash();
    return route?.kind === 'book' ? route.id : null;
  });
  const [selectedSeriesName, setSelectedSeriesName] = useState<string | null>(() => {
    const route = routeFromHash();
    return route?.kind === 'series' ? route.name : null;
  });
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Al abrir Apariencia se piden los ajustes compartidos en ese mismo
  // momento: una paleta creada en el otro dispositivo aparece sin recargar.
  useEffect(() => {
    if (showThemes) void refreshSettings();
  }, [refreshSettings, showThemes]);

  // Aplicar tema + modo + paleta personalizada, con transición suave al cambiar.
  // useLayoutEffect: el DOM queda actualizado antes del siguiente pintado.
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    const root = document.documentElement;
    // Una paleta personalizada con base «Nocturno» sí tiene variante clara:
    // el «siempre oscuro» se aplica únicamente al tema integrado Nocturno.
    const effectiveDark = activeCustomPalette ? dark : dark || theme === 'nocturno';
    let timeout: number | undefined;

    if (!firstRun.current) {
      root.classList.add('theme-anim');
      timeout = window.setTimeout(() => root.classList.remove('theme-anim'), 420);
    }
    firstRun.current = false;
    root.dataset.theme = theme;
    root.dataset.mode = effectiveDark ? 'dark' : 'light';
    root.classList.toggle('dark', effectiveDark);
    // `only light`/`only dark`, no solo `light`/`dark`: es la señal que
    // impide que Chrome Android, Samsung Internet y WebViews con «oscurecer
    // sitios web» vuelvan a pintar el modo claro casi negro por su cuenta.
    root.style.colorScheme = effectiveDark ? 'only dark' : 'only light';
    const colorSchemeMeta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (colorSchemeMeta) colorSchemeMeta.content = effectiveDark ? 'only dark' : 'only light';
    applyCustomPaletteToRoot(activeCustomPalette, effectiveDark);

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [activeCustomPalette, dark, theme]);

  // Libros y sagas tienen su propia dirección (#/libro/:id y #/saga/:nombre),
  // así el botón Atrás del móvil/navegador vuelve a la pantalla anterior.
  useEffect(() => {
    const syncRouteFromHash = () => {
      const route = routeFromHash();
      setSelectedBookId(route?.kind === 'book' ? route.id : null);
      setSelectedSeriesName(route?.kind === 'series' ? route.name : null);
    };
    window.addEventListener('hashchange', syncRouteFromHash);
    return () => window.removeEventListener('hashchange', syncRouteFromHash);
  }, []);

  const selectedBook = selectedBookId
    ? books.find((book) => book.id === selectedBookId) || null
    : null;
  const selectedSeriesGroup = selectedSeriesName
    ? findSeriesGroup(books, selectedSeriesName)
    : null;

  useEffect(() => {
    if (!loading && selectedBookId && !selectedBook) {
      setSelectedBookId(null);
      window.history.replaceState(null, '', '#/');
    }
  }, [loading, selectedBook, selectedBookId]);

  useEffect(() => {
    if (!loading && selectedSeriesName && !selectedSeriesGroup) {
      setSelectedSeriesName(null);
      window.history.replaceState(null, '', '#/');
    }
  }, [loading, selectedSeriesGroup, selectedSeriesName]);

  const handleTab = (nextTab: TabId) => {
    setSelectedBookId(null);
    setSelectedSeriesName(null);
    setTab(nextTab);
    if (window.location.hash.startsWith('#/libro/') || window.location.hash.startsWith('#/saga/')) {
      window.location.hash = '/';
    }
    window.scrollTo({ top: 0 });
  };

  const handleOpen = (book: Book) => {
    setSelectedSeriesName(null);
    setSelectedBookId(book.id);
    const target = `#/libro/${encodeURIComponent(book.id)}`;
    if (window.location.hash !== target) window.location.hash = target;
    window.scrollTo({ top: 0 });
  };

  const handleOpenSeries = (seriesName: string) => {
    const name = seriesName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    setSelectedBookId(null);
    setSelectedSeriesName(name);
    const target = `#/saga/${encodeURIComponent(name)}`;
    if (window.location.hash !== target) window.location.hash = target;
    window.scrollTo({ top: 0 });
  };

  const closeBookDetail = () => {
    setSelectedBookId(null);
    setSelectedSeriesName(null);
    if (window.location.hash.startsWith('#/libro/') || window.location.hash.startsWith('#/saga/')) {
      window.location.hash = '/';
    }
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

  const isDark = activeCustomPalette ? dark : dark || theme === 'nocturno';
  const darkModeLocked = !activeCustomPalette && theme === 'nocturno';
  const openAppearanceFromSettings = () => {
    setShowSettings(false);
    setShowThemes(true);
  };
  const openImportFromSettings = () => {
    setShowSettings(false);
    setShowImport(true);
  };
  const openTagsFromSettings = () => {
    setShowSettings(false);
    setShowTagManager(true);
  };

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
                <p className="text-[11px] text-ink3 mt-0.5 truncate">{selectedBook ? selectedBook.title : selectedSeriesGroup ? selectedSeriesGroup.name : TAB_TITLES[tab].title}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <MobileThemeToggle dark={isDark} locked={darkModeLocked} onToggle={() => setDark(!isDark)} />
              <button onClick={() => setShowSettings(true)} className={iconBtn} aria-label="Abrir ajustes">
                <SettingsIcon size={19} />
              </button>
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
          {!selectedBook && !selectedSeriesGroup && tab !== 'shelf' && <div className="mb-6 animate-fade-up" key={`head-${tab}`}>
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
                <HeaderTool icon={<SettingsIcon size={16} />} label="Ajustes" onClick={() => setShowSettings(true)} />
              </div>
            </div>
          </div>}

          <div key={selectedBook ? `book-${selectedBook.id}` : selectedSeriesGroup ? `series-${selectedSeriesGroup.key}` : tab} className="animate-fade-up">
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
                onOpenSeries={handleOpenSeries}
              />
            ) : selectedSeriesGroup ? (
              <SeriesDetail
                key={selectedSeriesGroup.key}
                group={selectedSeriesGroup}
                onBack={closeBookDetail}
                onOpen={handleOpen}
                onEdit={handleEdit}
                onUpdate={updateBook}
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
                onOpenSeries={handleOpenSeries}
                onAdd={handleAdd}
                onLoadDemo={handleLoadDemo}
                onGoChallenge={() => handleTab('challenge')}
              />
            )}
            {tab === 'stats' && <Statistics books={books} onOpen={handleOpen} chartPreferences={chartPreferences} onSetChartPreference={setChartPreference} />}
            {tab === 'challenge' && <ReadingChallenge books={books} goal={goal} onSetGoal={setGoal} onOpen={handleOpen} />}
            {tab === 'library' && <Library books={books} view={libraryView} onSetView={setLibraryView} onUpdate={updateBook} onDelete={deleteBook} onEdit={handleEdit} onOpen={handleOpen} onOpenSeries={handleOpenSeries} />}
            {tab === 'shelf' && <>
              <Bookshelf
                libraryControls={<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Bibliotecas en la estantería">
                  <button aria-pressed={!sharedShelf} onClick={() => setSharedShelf(false)} className={sharedShelf ? 'px-4 py-2 rounded-btn bg-surface border border-line' : 'px-4 py-2 rounded-btn bg-primary text-onprimary'}>Mi estantería</button>
                  <button aria-pressed={sharedShelf} onClick={() => setSharedShelf(true)} className={sharedShelf ? 'px-4 py-2 rounded-btn bg-primary text-onprimary' : 'px-4 py-2 rounded-btn bg-surface border border-line'}>Las dos bibliotecas</button>
                </div>}
                notice={sharedError && sharedShelf ? <p role="alert" className="mb-4">No se pudo cargar la estantería compartida.</p> : null}
                colors={shelfColors}
                onSetColor={setShelfColor}
                books={sharedShelf ? sharedBooks.map((book) => ({ ...book, id: book.owner === account ? book.id : `shared:${book.owner}:${book.id}` })) : books}
                onOpen={(book) => {
                  const other = sharedBooks.find((item) => item.owner !== account && book.id === `shared:${item.owner}:${item.id}`);
                  if (!other) return handleOpen(book);
                  const pendingWarning = settingsSyncStatus !== 'synced' ? ' Hay ajustes sin confirmar que podrían perderse.' : '';
                  if (window.confirm(`Este libro pertenece a ${ACCOUNT_NAMES[other.owner]}. ¿Quieres cambiar de cuenta para abrirlo?${pendingWarning}`)) {
                    selectAccount(other.owner, `#/libro/${encodeURIComponent(other.id)}`);
                  }
                }}
              />
            </>}
            {tab === 'space' && <Space books={books} onOpen={handleOpen} planetStyle={planetStyle} onSetPlanetStyle={setPlanetStyle} />}
            {tab === 'discover' && <Discover books={books} onOpen={handleOpen} onOpenSeries={handleOpenSeries} onAdd={handleAdd} />}
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
      {showSettings && (
        <SettingsMenu
          theme={theme}
          dark={isDark}
          accountName={ACCOUNT_NAMES[account]}
          onSwitchAccount={() => {
            if (settingsSyncStatus !== 'synced' && !window.confirm('Puede haber cambios de ajustes aún sin confirmar. Al cambiar de cuenta podrían perderse. ¿Quieres continuar?')) return;
            selectAccount(account === 'raul' ? 'pequenaja' : 'raul');
          }}
          darkModeLocked={darkModeLocked}
          activePaletteName={activeCustomPalette?.name || null}
          settingsVersion={settingsVersion}
          syncStatus={settingsSyncStatus}
          syncError={settingsSyncError}
          lastSyncedAt={settingsLastSyncedAt}
          onToggleDark={() => setDark(!isDark)}
          onAppearance={openAppearanceFromSettings}
          onImport={openImportFromSettings}
          onTags={openTagsFromSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showThemes && (
        <ThemePicker
          theme={theme}
          dark={isDark}
          onSetTheme={setTheme}
          onSetDark={setDark}
          customPalettes={customPalettes}
          activeCustomPalette={activeCustomPalette}
          syncStatus={settingsSyncStatus}
          syncError={settingsSyncError}
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
