import { useEffect, useRef, useState } from 'react';
import { BookOpen, Search, Loader2, NotebookPen, AlertCircle, ScanBarcode, Upload, Link2, HardDriveDownload, ImagePlus, X } from 'lucide-react';
import type { Book, BookFormat, BookLanguage, BookStatus } from '../types';
import { STATUS_META, FORMAT_META, languageOptions } from '../types';
import { StarRating } from './StarRating';
import { JournalModal } from './JournalModal';
import { fetchByIsbn } from '../lib';
import { parseReadingDate, readingDateInput } from '../readingDate';
import { apiClient } from '../api';
import { isExternalCoverUrl, isLocalCoverUrl } from '../coverStorage';
import { BookCover, Modal, btnGhost, btnPrimary, btnSoft, cx, inputCls, labelCls, selectCls } from './ui';

interface Props {
  onSubmit: (book: Omit<Book, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  editingBook?: Book | null;
  availableTags: string[];
  availableSeries?: string[];
  onUpdateBook?: (id: string, patch: Partial<Book>) => void;
}

const MAX_COVER_FILE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BookForm({ onSubmit, onClose, editingBook, availableTags, availableSeries = [], onUpdateBook }: Props) {
  const [title, setTitle] = useState(editingBook?.title ?? '');
  const [author, setAuthor] = useState(editingBook?.author ?? '');
  const [coverUrl, setCoverUrl] = useState(editingBook?.coverUrl ?? '');
  const [coverSourceUrl, setCoverSourceUrl] = useState(editingBook?.coverSourceUrl ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverFilePreview, setCoverFilePreview] = useState('');
  const [coverDirty, setCoverDirty] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [coverNotice, setCoverNotice] = useState('');
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<BookStatus>(editingBook?.status ?? 'pending');
  const [finishDate, setFinishDate] = useState(() => readingDateInput(editingBook?.finishedAt, editingBook?.finishedAtPrecision));
  const [finishDateDirty, setFinishDateDirty] = useState(false);
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
  const [seriesEnabled, setSeriesEnabled] = useState(Boolean(editingBook?.series?.trim()));
  const [series, setSeries] = useState(editingBook?.series ?? '');
  const [seriesPosition, setSeriesPosition] = useState(editingBook?.seriesPosition ?? '');
  const [isbnInput, setIsbnInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isbnError, setIsbnError] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => () => {
    if (coverFilePreview) URL.revokeObjectURL(coverFilePreview);
  }, [coverFilePreview]);

  const clearCoverFile = () => {
    setCoverFile(null);
    setCoverFilePreview('');
    if (coverFileRef.current) coverFileRef.current.value = '';
  };

  const handleCoverUrlChange = (value: string) => {
    clearCoverFile();
    setCoverUrl(value);
    setCoverSourceUrl(isExternalCoverUrl(value) ? value.trim() : '');
    setCoverDirty(true);
    setCoverError('');
    setCoverNotice('');
  };

  const handleCoverFile = (file: File | undefined) => {
    setCoverError('');
    setCoverNotice('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCoverError('Elige un archivo de imagen (JPG, PNG, WebP, GIF o AVIF).');
      return;
    }
    if (file.size > MAX_COVER_FILE_BYTES) {
      setCoverError('La imagen supera el máximo de 10 MB.');
      return;
    }
    setCoverFile(file);
    setCoverFilePreview(URL.createObjectURL(file));
    setCoverUrl('');
    setCoverSourceUrl('');
    setCoverDirty(true);
  };

  const removeCover = () => {
    clearCoverFile();
    setCoverUrl('');
    setCoverSourceUrl('');
    setCoverDirty(true);
    setCoverError('');
    setCoverNotice('');
  };

  const prepareCoverForSave = async (): Promise<{ coverUrl: string; coverSourceUrl: string }> => {
    if (coverFile) {
      const stored = await apiClient.uploadCover(coverFile);
      clearCoverFile();
      setCoverUrl(stored.coverUrl);
      setCoverSourceUrl('');
      setCoverDirty(false);
      setCoverNotice('Imagen subida y guardada en el servidor de Bilibook.');
      return { coverUrl: stored.coverUrl, coverSourceUrl: '' };
    }

    const trimmed = coverUrl.trim();
    if (!trimmed) return { coverUrl: '', coverSourceUrl: '' };
    if (isLocalCoverUrl(trimmed)) {
      return { coverUrl: trimmed, coverSourceUrl: coverSourceUrl.trim() };
    }
    if (isExternalCoverUrl(trimmed)) {
      // Una URL antigua sin tocar no debe bloquear la edición de otros datos si
      // ya caducó; las URL nuevas o modificadas sí se copian antes de guardar.
      if (!coverDirty && editingBook) return { coverUrl: trimmed, coverSourceUrl: trimmed };
      const stored = await apiClient.storeCoverFromUrl(trimmed);
      setCoverUrl(stored.coverUrl);
      setCoverSourceUrl(trimmed);
      setCoverDirty(false);
      setCoverNotice('Copia de la portada guardada en el servidor de Bilibook.');
      return { coverUrl: stored.coverUrl, coverSourceUrl: trimmed };
    }
    return { coverUrl: trimmed, coverSourceUrl: coverSourceUrl.trim() };
  };

  const handleStoreCoverNow = async () => {
    if (coverBusy) return;
    setCoverBusy(true);
    setCoverError('');
    setCoverNotice('');
    try {
      // El botón actúa también sobre portadas antiguas todavía externas.
      setCoverDirty(true);
      if (coverFile) {
        const stored = await apiClient.uploadCover(coverFile);
        clearCoverFile();
        setCoverUrl(stored.coverUrl);
        setCoverSourceUrl('');
      } else if (isExternalCoverUrl(coverUrl)) {
        const source = coverUrl.trim();
        const stored = await apiClient.storeCoverFromUrl(source);
        setCoverUrl(stored.coverUrl);
        setCoverSourceUrl(source);
      }
      setCoverDirty(false);
      setCoverNotice('Copia guardada en el servidor de Bilibook.');
    } catch (error) {
      setCoverError(error instanceof Error ? error.message : 'No se pudo guardar la portada en el servidor.');
    } finally {
      setCoverBusy(false);
    }
  };

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
    clearCoverFile();
    setCoverUrl(result.coverUrl);
    setCoverSourceUrl(result.coverUrl);
    setCoverDirty(Boolean(result.coverUrl));
    setCoverError('');
    setCoverNotice(result.coverUrl ? 'Al guardar el libro, esta portada se copiará al servidor.' : '');
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
    const parsedFinishDate = finishDate.trim() ? parseReadingDate(finishDate) : null;
    if (status === 'read' && finishDate.trim() && !parsedFinishDate) {
      setSubmitError('Introduce una fecha válida: AAAA, AAAA-MM o AAAA-MM-DD.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setCoverError('');
    try {
      const preparedCover = await prepareCoverForSave();
      await onSubmit({
        title: title.trim(),
        author: author.trim(),
        coverUrl: preparedCover.coverUrl,
        coverSourceUrl: preparedCover.coverSourceUrl,
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
        series: seriesEnabled ? series.trim() : '',
        seriesPosition: seriesEnabled ? seriesPosition.trim().replace(/^#\s*/, '') : '',
        startedAt: editingBook?.startedAt ?? (status === 'reading' ? Date.now() : null),
        finishedAt: status === 'read' && finishDateDirty ? parsedFinishDate?.timestamp ?? null : editingBook?.finishedAt ?? (status === 'read' ? Date.now() : null),
        finishedAtPrecision: status === 'read' && finishDateDirty ? parsedFinishDate?.precision ?? null : editingBook?.finishedAtPrecision,
        journal: editingBook?.journal ?? [],
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (coverFile || (coverDirty && isExternalCoverUrl(coverUrl))) {
        setCoverError(message || 'No se pudo guardar la portada en el servidor.');
      }
      setSubmitError('No se pudo guardar el libro. Revisa la portada y la conexión con el servidor.');
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
            <button type="submit" form="book-form" disabled={!title.trim() || submitting || coverBusy} className={cx(btnPrimary, 'flex-1')}>
              {submitting || coverBusy ? (
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
                coverUrl={coverFilePreview || coverUrl}
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
                <label className={labelCls} htmlFor="f-cover">Portada</label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Link2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3" />
                    <input
                      id="f-cover"
                      value={coverFile ? '' : coverUrl}
                      onChange={(e) => handleCoverUrlChange(e.target.value)}
                      placeholder="Pega una URL https://…"
                      className={cx(inputCls, 'pl-9')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => coverFileRef.current?.click()}
                    className={cx(btnSoft, 'shrink-0 px-3 py-2.5 text-xs')}
                  >
                    <Upload size={15} /> Subir imagen
                  </button>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
                    className="hidden"
                    onChange={(event) => {
                      handleCoverFile(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>

                {coverFile ? (
                  <div className="mt-2 flex items-start gap-2 rounded-btn bg-accent/[0.07] px-3 py-2 text-[11px] leading-relaxed text-ink2">
                    <ImagePlus size={15} className="mt-0.5 shrink-0 text-accent" />
                    <p className="min-w-0 flex-1">
                      <strong className="break-all">{coverFile.name}</strong> · {formatFileSize(coverFile.size)}.
                      Se subirá y quedará guardada en el servidor al guardar el libro.
                    </p>
                    <button type="button" onClick={removeCover} className="shrink-0 text-ink3 hover:text-danger" aria-label="Quitar imagen seleccionada">
                      <X size={14} />
                    </button>
                  </div>
                ) : isLocalCoverUrl(coverUrl) ? (
                  <div className="mt-2 flex items-start gap-2 rounded-btn bg-stread/10 px-3 py-2 text-[11px] leading-relaxed text-ink2">
                    <HardDriveDownload size={15} className="mt-0.5 shrink-0 text-stread" />
                    <p className="min-w-0 flex-1">
                      Copia guardada en el servidor de Bilibook.
                      {coverSourceUrl && <span className="block break-all text-ink3">Origen: {coverSourceUrl}</span>}
                    </p>
                    <button type="button" onClick={removeCover} className="shrink-0 text-ink3 hover:text-danger" aria-label="Quitar portada">
                      <X size={14} />
                    </button>
                  </div>
                ) : isExternalCoverUrl(coverUrl) ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-btn bg-sunken px-3 py-2 text-[11px] leading-relaxed text-ink2">
                    <p className="min-w-[220px] flex-1">
                      Al guardar, Bilibook descargará esta imagen y conservará su propia copia en el servidor.
                    </p>
                    <button type="button" onClick={() => void handleStoreCoverNow()} disabled={coverBusy} className={cx(btnSoft, 'px-2.5 py-1.5 text-[11px]')}>
                      {coverBusy ? <Loader2 size={13} className="animate-spin" /> : <HardDriveDownload size={13} />}
                      Guardar copia ahora
                    </button>
                    <button type="button" onClick={removeCover} className="text-ink3 hover:text-danger" aria-label="Quitar portada">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-ink3 mt-1">
                    Pega una URL o sube un archivo. En ambos casos la imagen quedará guardada en el servidor; si la dejas vacía, generaremos una portada tipográfica.
                  </p>
                )}
                {coverNotice && <p className="mt-1 text-[11px] font-semibold text-stread">{coverNotice}</p>}
                {coverError && <p className="mt-1 text-[11px] font-semibold text-danger" role="alert">{coverError}</p>}
              </div>
            </div>
          </div>

          {/* Estado segmentado */}
          <div>
            <span className={labelCls}>Estado</span>
            <div className="grid grid-cols-2 gap-1 bg-sunken rounded-btn p-1 sm:grid-cols-4" role="group" aria-label="Estado de lectura">
              {(Object.keys(STATUS_META) as BookStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={cx(
                    'inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-[calc(var(--r-btn)_-_4px)] text-sm font-bold transition-all active:scale-[0.97]',
                    status === s ? cx('bg-surface shadow-card', STATUS_META[s].activeBtn) : 'text-ink3 hover:text-ink'
                  )}
                >
                  <span className={cx('w-2 h-2 rounded-full', STATUS_META[s].dot)} />
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {(status === 'reading' || status === 'dnf') && (
            <div className="rounded-card bg-sunken/70 p-4">
              <label className={cx(labelCls, 'flex justify-between')} htmlFor="f-page">
                <span>{status === 'dnf' ? 'Página en la que lo dejaste' : 'Página actual'}</span>
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

          {status === 'read' && <div>
            <label className={labelCls} htmlFor="f-finished">Fecha de fin de lectura</label>
            <input id="f-finished" value={finishDate} onChange={(e) => { setFinishDate(e.target.value); setFinishDateDirty(true); }} placeholder="AAAA, AAAA-MM o AAAA-MM-DD" className={inputCls} />
            <p className="mt-1 text-xs text-ink3">Indica solo el año, el año y mes o la fecha completa. No se creará una entrada en el diario.</p>
          </div>}

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
                {languageOptions(language).map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-card bg-sunken/60 p-4">
            <label className="flex cursor-pointer items-start gap-2.5" htmlFor="f-series-toggle">
              <input
                id="f-series-toggle"
                type="checkbox"
                checked={seriesEnabled}
                onChange={(event) => setSeriesEnabled(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]"
              />
              <span>
                <span className="block text-sm font-bold text-ink">Forma parte de una saga o serie</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-ink3">
                  El extractor de StoryGraph rellena estos campos automáticamente cuando la ficha los trae.
                </span>
              </span>
            </label>

            {seriesEnabled && (
              <div className="mt-3 grid grid-cols-[1fr_110px] gap-3">
                <div>
                  <label className={labelCls} htmlFor="f-series">Nombre de la saga</label>
                  <input
                    id="f-series"
                    value={series}
                    onChange={(event) => setSeries(event.target.value)}
                    placeholder="The Green Bone Saga"
                    list="series-suggestions"
                    className={cx(inputCls, 'bg-surface')}
                  />
                  <datalist id="series-suggestions">
                    {availableSeries.map((name) => <option key={name} value={name} />)}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls} htmlFor="f-series-position">Nº</label>
                  <input
                    id="f-series-position"
                    value={seriesPosition}
                    onChange={(event) => setSeriesPosition(event.target.value)}
                    placeholder="1"
                    className={cx(inputCls, 'bg-surface')}
                  />
                </div>
              </div>
            )}
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
