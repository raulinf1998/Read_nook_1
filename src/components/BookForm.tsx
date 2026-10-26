import { useState } from 'react';
import { BookOpen, Search, Loader2, NotebookPen, AlertCircle, ScanBarcode } from 'lucide-react';
import type { Book, BookFormat, BookLanguage, BookStatus } from '../types';
import { STATUS_META, FORMAT_META, LANGUAGE_META } from '../types';
import { StarRating } from './StarRating';
import { JournalModal } from './JournalModal';
import { fetchByIsbn } from '../lib';
import { BookCover, Modal, btnGhost, btnPrimary, btnSoft, cx, inputCls, labelCls, selectCls } from './ui';

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
      setIsbnError('No se encontró el libro. Revisa el ISBN e inténtalo de nuevo.');
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
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
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

  const sliderPct = pages > 0 ? Math.min((currentPage / pages) * 100, 100) : 0;

  return (
    <>
      <Modal
        title={editingBook ? 'Editar libro' : 'Añadir libro'}
        icon={<BookOpen size={17} />}
        onClose={onClose}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} className={cx(btnGhost, 'flex-1 bg-surface border border-line')}>
              Cancelar
            </button>
            <button type="submit" form="book-form" disabled={!title.trim() || submitting} className={cx(btnPrimary, 'flex-1')}>
              {submitting ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Guardando…</span>
              ) : editingBook ? 'Guardar cambios' : 'Añadir libro'}
            </button>
          </div>
        }
      >
        <form id="book-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Búsqueda por ISBN */}
          {!editingBook && (
            <div className="rounded-card bg-accent/[0.07] border border-accent/20 p-4">
              <label className={cx(labelCls, 'flex items-center gap-1.5')} htmlFor="isbn-input">
                <ScanBarcode size={15} className="text-accent" /> ¿Tienes el ISBN? Lo rellenamos por ti
              </label>
              <div className="flex gap-2">
                <input
                  id="isbn-input"
                  value={isbnInput}
                  onChange={(e) => setIsbnInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleIsbnLookup(); }
                  }}
                  placeholder="978-84-…"
                  inputMode="numeric"
                  className={cx(inputCls, 'flex-1 bg-surface')}
                />
                <button type="button" onClick={handleIsbnLookup} disabled={loading || !isbnInput.trim()} className={btnPrimary}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  {loading ? 'Buscando' : 'Buscar'}
                </button>
              </div>
              {isbnError && <p className="text-xs font-semibold text-danger mt-2">{isbnError}</p>}
              <p className="text-xs text-ink3 mt-2">Consultamos Google Books y Open Library para traer portada, páginas y sinopsis.</p>
            </div>
          )}

          {/* Portada + datos esenciales */}
          <div className="flex gap-4">
            <div className="shrink-0 hidden sm:block">
              <BookCover
                title={title || 'Tu libro'}
                author={author}
                coverUrl={coverUrl}
                detail="lg"
                className="w-24 h-36 shadow-book"
              />
              <p className="text-[10px] text-ink3 text-center mt-1.5 w-24">Vista previa</p>
            </div>
            <div className="flex-1 min-w-0 space-y-3.5">
              <div>
                <label className={labelCls} htmlFor="f-title">Título *</label>
                <input id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="El nombre del viento" className={inputCls} autoFocus={Boolean(editingBook)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-author">Autor</label>
                <input id="f-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Patrick Rothfuss" className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="f-cover">URL de la portada</label>
                <input id="f-cover" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className={inputCls} />
                <p className="text-[11px] text-ink3 mt-1">Si la dejas vacía, generaremos una portada tipográfica con el título.</p>
              </div>
            </div>
          </div>

          {/* Estado segmentado */}
          <div>
            <span className={labelCls}>Estado</span>
            <div className="flex gap-1 bg-sunken rounded-btn p-1" role="group" aria-label="Estado de lectura">
              {(Object.keys(STATUS_META) as BookStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={cx(
                    'flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-[calc(var(--r-btn)_-_4px)] text-sm font-bold transition-all active:scale-[0.97]',
                    status === s ? cx('bg-surface shadow-card', STATUS_META[s].activeBtn) : 'text-ink3 hover:text-ink'
                  )}
                >
                  <span className={cx('w-2 h-2 rounded-full', STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {status === 'reading' && (
            <div className="rounded-card bg-sunken/70 p-4">
              <label className={cx(labelCls, 'flex justify-between')} htmlFor="f-page">
                <span>Página actual</span>
                <span className="text-ink tabular-nums">{currentPage} / {pages || '?'}{pages > 0 ? ` · ${sliderPct.toFixed(0)}%` : ''}</span>
              </label>
              <input
                id="f-page"
                type="range"
                min={0}
                max={pages || 100}
                value={currentPage}
                onChange={(e) => setCurrentPage(parseInt(e.target.value))}
                className="book-slider w-full"
                style={{ background: `linear-gradient(to right, rgb(var(--primary)) ${sliderPct}%, rgb(var(--line)) ${sliderPct}%)` }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="f-pages">Páginas totales</label>
              <input id="f-pages" type="number" min={0} value={pages || ''} onChange={(e) => setPages(parseInt(e.target.value) || 0)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-date">Fecha de publicación</label>
              <input id="f-date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} placeholder="2007" className={inputCls} />
            </div>
            <div>
              <label className={labelCls} htmlFor="f-format">Formato</label>
              <select id="f-format" value={format} onChange={(e) => setFormat(e.target.value as BookFormat)} className={cx(selectCls, 'w-full')}>
                {(Object.keys(FORMAT_META) as BookFormat[]).map((f) => (
                  <option key={f} value={f}>{FORMAT_META[f].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="f-lang">Idioma</label>
              <select id="f-lang" value={language} onChange={(e) => setLanguage(e.target.value as BookLanguage)} className={cx(selectCls, 'w-full')}>
                {(Object.keys(LANGUAGE_META) as BookLanguage[]).map((l) => (
                  <option key={l} value={l}>{LANGUAGE_META[l].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={labelCls}>Tu puntuación</span>
            <StarRating value={rating} onChange={setRating} size={26} />
            <p className="text-[11px] text-ink3 mt-1">Toca una estrella; toca otra vez para medias estrellas.</p>
          </div>

          <div>
            <span className={labelCls}>Tags / géneros</span>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={tags.includes(tag)}
                  className={cx(
                    'px-2.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95',
                    tags.includes(tag)
                      ? 'bg-primary text-onprimary shadow-card'
                      : 'bg-sunken text-ink2 hover:bg-line/60 hover:text-ink'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="f-desc">Sinopsis</label>
            <textarea
              id="f-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="De qué va el libro…"
              rows={3}
              className={cx(inputCls, 'resize-none')}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="f-notes">Notas personales</label>
            <textarea
              id="f-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Impresiones, citas favoritas, a quién se lo prestaste…"
              rows={2}
              className={cx(inputCls, 'resize-none')}
            />
          </div>

          {/* Diario lector */}
          {editingBook && onUpdateBook && (
            <button
              type="button"
              onClick={() => setShowJournal(true)}
              className={cx(btnSoft, 'w-full py-3 text-sm')}
            >
              <NotebookPen size={16} />
              Abrir diario lector
              {editingBook.journal && editingBook.journal.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent/20 text-[10px] font-extrabold">
                  {editingBook.journal.length} {editingBook.journal.length === 1 ? 'avance' : 'avances'}
                </span>
              )}
            </button>
          )}

          {submitError && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/25 rounded-btn p-3">
              <AlertCircle size={18} className="text-danger shrink-0" />
              <p className="text-sm font-semibold text-danger">{submitError}</p>
            </div>
          )}
        </form>
      </Modal>

      {showJournal && editingBook && onUpdateBook && (
        <JournalModal book={editingBook} onUpdate={onUpdateBook} onClose={() => setShowJournal(false)} />
      )}
    </>
  );
}
