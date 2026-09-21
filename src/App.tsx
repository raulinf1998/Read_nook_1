import { useState, useEffect } from 'react';
import { Plus, Moon, Sun, Upload, Tag, BookOpen, Loader2 } from 'lucide-react';
import type { Book } from './types';
import { DEFAULT_TAGS } from './types';
import { useBooks, useServerSettings, useServerTags } from './hooks';
import { Navigation } from './components/Navigation';
import type { TabId } from './components/Navigation';
import { BookForm } from './components/BookForm';
import { ImportModal } from './components/ImportModal';
import { TagManager } from './components/TagManager';
import { ReadingNow } from './components/ReadingNow';
import { Statistics } from './components/Statistics';
import { ReadingChallenge } from './components/ReadingChallenge';
import { Library } from './components/Library';
import { Bookshelf } from './components/Bookshelf';

const TAB_TITLES: Record<TabId, string> = {
  reading: 'Leyendo y Pendientes',
  stats: 'Estadísticas',
  challenge: 'Retos de Lectura',
  library: 'Biblioteca',
  shelf: 'Librería',
};

export default function App() {
  const { books, loading, addBook, updateBook, deleteBook, importBooks } = useBooks();
  const { tags, addTag, removeTag } = useServerTags();
  const { goal, setGoal, dark, setDark } = useServerSettings();

  const [tab, setTab] = useState<TabId>('reading');
  const [showForm, setShowForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingBook(null);
    setShowForm(true);
  };

  const handleSubmit = async (data: Omit<Book, 'id' | 'createdAt'>) => {
    if (editingBook) {
      await updateBook(editingBook.id, data);
    } else {
      await addBook(data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center">
              <BookOpen size={18} className="text-white dark:text-gray-900" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-none text-gray-900 dark:text-white">Biblioteca</h1>
              <p className="text-[11px] text-gray-400 mt-0.5">{TAB_TITLES[tab]}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowTagManager(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Gestionar tags"
            >
              <Tag size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Importar CSV"
            >
              <Upload size={18} className="text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Cambiar tema"
            >
              {dark ? <Sun size={18} className="text-gray-500 dark:text-gray-400" /> : <Moon size={18} className="text-gray-500" />}
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Añadir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-5 py-5">
        {tab === 'reading' && (
          <ReadingNow books={books} onUpdate={updateBook} onEdit={handleEdit} />
        )}
        {tab === 'stats' && <Statistics books={books} />}
        {tab === 'challenge' && (
          <ReadingChallenge books={books} goal={goal} onSetGoal={setGoal} />
        )}
        {tab === 'library' && (
          <Library books={books} onUpdate={updateBook} onDelete={deleteBook} onEdit={handleEdit} />
        )}
        {tab === 'shelf' && <Bookshelf books={books} onEdit={handleEdit} />}
      </main>

      {/* Bottom nav */}
      <Navigation active={tab} onChange={setTab} />

      {/* Modals */}
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
          onImport={importBooks}
          onClose={() => setShowImport(false)}
        />
      )}
      {showTagManager && (
        <TagManager
          tags={tags}
          onAdd={addTag}
          onRemove={removeTag}
          onClose={() => setShowTagManager(false)}
        />
      )}
    </div>
  );
}
