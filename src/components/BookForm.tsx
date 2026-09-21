import { useState } from 'react';
import { X, BookOpen, Search, Loader2, NotebookPen, AlertCircle } from 'lucide-react';
import type { Book, BookFormat, BookLanguage, BookStatus } from '../types';
import { STATUS_META, FORMAT_META, LANGUAGE_META } from '../types';
import { StarRating } from './StarRating';
import { JournalModal } from './JournalModal';
import { fetchByIsbn } from '../lib';

interface Props {
  onSubmit: (book: Omit<Book, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  editingBook?: Book | null;
  availableTags: string[];
  onUpdateBook?: (id: string, patch: Partial<Book>) => void;
}

export function BookForm({ onSubmit, onClose, editingBook, availableTags, onUpdateBook }: Props) {
  const [title, setTitle] = useState(editingBook?.title ?? '');
  const [author, setAuthor] = useState(editingBook?.author ?? '');
  const [coverUrl, setCoverUrl] = useState(editingBook?.coverUrl ?? '');
  const [status, setStatus] = useState<BookStatus>(editingBook?.status ?? 'pending');
  const [rating, setRating] = useState(editingBook?.rating ?? 0);
  const [notes, setNotes] = useState(editingBook?.notes ?? '');
  const [pages, setPages] = useState(editingBook?.pages ?? 0);
  const [currentPage, setCurrentPage] = useState(editingBook?.currentPage ?? 0);
  const [format, setFormat] = useState<BookFormat>(editingBook?.format ?? 'paperback');
  const [language, setLanguage] = useState<BookLanguage>(editingBook?.language ?? 'es');
  const [publishDate, setPublishDate] = useState(editingBook?.publishDate ?? '');
  const [description, setDescription] = useState(editingBook?.description ?? '');
  const [tags, setTags] = useState<string[]>(editingBook?.tags ?? []);
  const [isbn, setIsbn] = useState(editingBook?.isbn ?? '');
  const [isbnInput, setIsbnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isbnError, setIsbnError] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleIsbnLookup = async () => {
    if (!isbnInput.trim()) return;
    setLoading(true);
    setIsbnError('');
    const result = await fetchByIsbn(isbnInput);
    setLoading(false);
    if (!result) {
      setIsbnError('No se encontró el libro. Verifica el ISBN.');
      return;
    }
    setTitle(result.title);
    setAuthor(result.author);
    setCoverUrl(result.coverUrl);
    setPages(result.pages);
    setPublishDate(result.publishDate);
    setLanguage(result.language);
    setDescription(result.description);
    setIsbn(result.isbn);
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        title: title.trim(),
        author: author.trim(),
        coverUrl: coverUrl.trim(),
        status,
        rating,
        notes: notes.trim(),
        pages,
        currentPage: status === 'read' ? pages : currentPage,
        format,
        language,
        publishDate,
        description: description.trim(),
        tags,
        isbn: isbn.trim(),
        startedAt: editingBook?.startedAt ?? (status === 'reading' ? Date.now() : null),
        finishedAt: editingBook?.finishedAt ?? (status === 'read' ? Date.now() : null),
        journal: editingBook?.journal ?? [],
      });
      onClose();
    } catch {
      setSubmitError('No se pudo guardar el libro. Revisa la conexión con el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen size={20} className="text-gray-700 dark:text-gray-300" />
            {editingBook ? 'Editar libro' : 'Añadir libro'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* ISBN lookup */}
          {!editingBook && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Buscar por ISBN</label>
              <div className="flex gap-2">
                <input
                  value={isbnInput}
                  onChange={(e) => setIsbnInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="9788408..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={handleIsbnLookup}
                  disabled={loading || !isbnInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  {loading ? 'Buscando' : 'Buscar'}
                </button>
              </div>
              {isbnError && <p className="text-xs text-red-500">{isbnError}</p>}
              <p className="text-xs text-gray-400">Consulta la API de Google Books para autocompletar los datos.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="El nombre del viento"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
              autoFocus={!loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Autor</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Patrick Rothfuss"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">URL de la portada</label>
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Páginas</label>
              <input
                type="number"
                value={pages || ''}
                onChange={(e) => setPages(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fecha publicación</label>
              <input
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                placeholder="2007-03-01"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Estado</label>
            <div className="flex gap-2">
              {(Object.keys(STATUS_META) as BookStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    status === s
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {status === 'reading' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Página actual: {currentPage} / {pages || '?'}
              </label>
              <input
                type="range"
                min={0}
                max={pages || 100}
                value={currentPage}
                onChange={(e) => setCurrentPage(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Formato</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as BookFormat)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 outline-none transition-all text-sm"
              >
                {(Object.keys(FORMAT_META) as BookFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_META[f].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as BookLanguage)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 outline-none transition-all text-sm"
              >
                {(Object.keys(LANGUAGE_META) as BookLanguage[]).map((l) => (
                  <option key={l} value={l}>{LANGUAGE_META[l].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Puntuación</label>
            <StarRating value={rating} onChange={setRating} size={24} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tags / Géneros</label>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    tags.includes(tag)
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notas personales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Impresiones, citas favoritas..."
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 outline-none transition-all text-sm resize-none"
            />
          </div>

          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
            </div>
          )}

          {/* Journal button (only when editing) */}
          {editingBook && onUpdateBook && (
            <button
              type="button"
              onClick={() => setShowJournal(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium text-sm hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
            >
              <NotebookPen size={16} />
              Diario lector
              {editingBook.journal && editingBook.journal.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                  {editingBook.journal.length}
                </span>
              )}
            </button>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando...' : editingBook ? 'Guardar cambios' : 'Añadir libro'}
            </button>
          </div>
        </form>
      </div>
      {showJournal && editingBook && onUpdateBook && (
        <JournalModal
          book={editingBook}
          onUpdate={onUpdateBook}
          onClose={() => setShowJournal(false)}
        />
      )}
    </div>
  );
}
