import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Globe,
  Library,
  Loader2,
  NotebookPen,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { enrichWithCovers, parseStoryGraphCsv } from '../lib';
import {
  mergeStoryGraphJournal,
  parseStoryGraphJournalExport,
} from '../storyGraphJournal';
import type {
  StoryGraphBookMetadata,
  StoryGraphJournalCoverStats,
  StoryGraphJournalEntry,
  StoryGraphJournalMergeReport,
  StoryGraphMetadataStats,
} from '../storyGraphJournal';
import type { Book, BookLanguage } from '../types';
import { languageOptions } from '../types';
import { Modal, ProgressBar, btnGhost, btnPrimary, btnSoft, cx, selectCls } from './ui';

type NewBook = Omit<Book, 'id' | 'createdAt'>;
type DropTarget = 'library' | 'journal' | null;

interface ImportResultInfo {
  imported: number;
  localizedCovers?: number;
  coverLocalizationFailures?: number;
}

interface Props {
  existingBooks: Book[];
  onImport: (
    books: NewBook[],
    onCoverProgress?: (done: number, total: number) => void,
  ) => Promise<number | ImportResultInfo | void> | number | ImportResultInfo | void;
  onMergeJournal: (
    entries: StoryGraphJournalEntry[],
    bookMetadata?: StoryGraphBookMetadata[]
  ) => Promise<StoryGraphJournalMergeReport>;
  onClose: () => void;
}

interface SuccessInfo {
  booksImported: number;
  localizedCovers?: number;
  coverLocalizationFailures?: number;
  report?: StoryGraphJournalMergeReport;
}

const USERSCRIPT_URL = `${import.meta.env.BASE_URL}tools/storygraph-journal-exporter.user.js`;

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsText(file);
  });
}

function looksLikeJournalFile(text: string): boolean {
  const sample = text.slice(0, 4000).toLowerCase();
  return sample.includes('read-nook-storygraph-journal')
    || (sample.includes('entry_id') && (sample.includes('pages_read') || sample.includes('pages_total')))
    || (sample.includes('"entries"') && sample.includes('storygraph'));
}

function looksLikeLibraryCsv(text: string): boolean {
  const firstLine = text.slice(0, 2000).split(/\r?\n/)[0]?.toLowerCase() || '';
  return firstLine.includes('read status') && (firstLine.includes('isbn') || firstLine.includes('title'));
}

function formatJournalDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ImportModal({ existingBooks, onImport, onMergeJournal, onClose }: Props) {
  const [libraryPreview, setLibraryPreview] = useState<NewBook[] | null>(null);
  const [journalEntries, setJournalEntries] = useState<StoryGraphJournalEntry[] | null>(null);
  const [journalBooks, setJournalBooks] = useState<StoryGraphBookMetadata[]>([]);
  const [journalCoverStats, setJournalCoverStats] = useState<StoryGraphJournalCoverStats | null>(null);
  const [journalMetadataStats, setJournalMetadataStats] = useState<StoryGraphMetadataStats | null>(null);
  const [libraryFileName, setLibraryFileName] = useState('');
  const [journalFileName, setJournalFileName] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [journalError, setJournalError] = useState('');
  const [actionError, setActionError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [defaultLang, setDefaultLang] = useState<BookLanguage>('es');
  const [rawLibraryText, setRawLibraryText] = useState('');
  const [dragging, setDragging] = useState<DropTarget>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const libraryFileRef = useRef<HTMLInputElement>(null);
  const journalFileRef = useRef<HTMLInputElement>(null);

  const journalPreviewReport = useMemo(() => {
    if (!journalEntries) return null;
    try {
      return libraryPreview
        ? mergeStoryGraphJournal(libraryPreview, journalEntries, journalBooks).report
        : mergeStoryGraphJournal(existingBooks, journalEntries, journalBooks).report;
    } catch {
      return null;
    }
  }, [existingBooks, journalBooks, journalEntries, libraryPreview]);

  const journalSummary = useMemo(() => {
    if (!journalEntries?.length) return null;
    const bookKeys = new Set(
      journalEntries.map((entry) => entry.storyGraphBookId || entry.isbn || `${entry.title}|${entry.author}`),
    );
    const dates = journalEntries.map((entry) => entry.date).sort();
    return {
      books: bookKeys.size,
      from: dates[0],
      to: dates[dates.length - 1],
    };
  }, [journalEntries]);

  const parseLibrary = (text: string, lang: BookLanguage) => {
    if (looksLikeJournalFile(text)) {
      setLibraryError('Este archivo parece el diario de avances. Súbelo en el apartado 2, no como biblioteca.');
      setLibraryPreview(null);
      return;
    }

    try {
      const books = parseStoryGraphCsv(text, lang);
      if (!books.length) {
        setLibraryError('No se encontraron libros. Verifica que es el CSV oficial de StoryGraph (Manage Account → Export).');
        setLibraryPreview(null);
        return;
      }
      setLibraryPreview(books);
      setLibraryError('');
    } catch {
      setLibraryError('Error al procesar el CSV de la biblioteca.');
      setLibraryPreview(null);
    }
  };

  const handleLibraryFile = async (file: File) => {
    setLibraryFileName(file.name);
    setLibraryError('');
    setActionError('');
    try {
      const text = await readFileText(file);
      setRawLibraryText(text);
      parseLibrary(text, defaultLang);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'No se pudo leer el CSV.');
      setLibraryPreview(null);
    }
  };

  const handleJournalFile = async (file: File) => {
    setJournalFileName(file.name);
    setJournalError('');
    setActionError('');
    try {
      const text = await readFileText(file);
      if (looksLikeLibraryCsv(text)) {
        throw new Error('Este CSV parece la biblioteca oficial. Súbelo en el apartado 1; el diario debe ser el JSON/CSV del extractor.');
      }
      const parsedExport = parseStoryGraphJournalExport(text, file.name);
      setJournalEntries(parsedExport.entries);
      setJournalBooks(parsedExport.books);
      setJournalCoverStats(parsedExport.coverStats);
      setJournalMetadataStats(parsedExport.metadataStats);
    } catch (error) {
      setJournalError(error instanceof Error ? error.message : 'No se pudo leer el archivo del diario.');
      setJournalEntries(null);
      setJournalBooks([]);
      setJournalCoverStats(null);
      setJournalMetadataStats(null);
    }
  };

  const handleLangChange = (lang: BookLanguage) => {
    setDefaultLang(lang);
    if (rawLibraryText) parseLibrary(rawLibraryText, lang);
  };

  const clearLibrary = () => {
    setLibraryPreview(null);
    setLibraryFileName('');
    setLibraryError('');
    setRawLibraryText('');
    if (libraryFileRef.current) libraryFileRef.current.value = '';
  };

  const clearJournal = () => {
    setJournalEntries(null);
    setJournalBooks([]);
    setJournalCoverStats(null);
    setJournalMetadataStats(null);
    setJournalFileName('');
    setJournalError('');
    if (journalFileRef.current) journalFileRef.current.value = '';
  };

  const resetAll = () => {
    clearLibrary();
    clearJournal();
    setActionError('');
    setProgress({ done: 0, total: 0 });
    setSuccess(null);
  };

  const handleConfirm = async () => {
    if (success) {
      onClose();
      return;
    }
    if (!libraryPreview?.length && !journalEntries?.length) return;

    setImporting(true);
    setActionError('');
    setProgress({ done: 0, total: 0 });

    try {
      if (libraryPreview?.length) {
        let booksToImport: NewBook[] = libraryPreview.map((book) => ({
          ...book,
          tags: [...book.tags],
          journal: [...(book.journal || [])],
        }));
        let report: StoryGraphJournalMergeReport | undefined;

        if (journalEntries?.length) {
          const merged = mergeStoryGraphJournal(booksToImport, journalEntries, journalBooks);
          booksToImport = merged.books;
          report = merged.report;
        }

        booksToImport = await enrichWithCovers(booksToImport, (done, total) => {
          setProgress({ done, total });
        });
        const imported = await onImport(booksToImport, (done, total) => {
          setProgress({ done, total });
        });
        const importInfo = imported && typeof imported === 'object' ? imported : null;
        setSuccess({
          booksImported: typeof imported === 'number' ? imported : importInfo?.imported ?? booksToImport.length,
          localizedCovers: importInfo?.localizedCovers ?? 0,
          coverLocalizationFailures: importInfo?.coverLocalizationFailures ?? 0,
          report,
        });
      } else if (journalEntries?.length) {
        if (!existingBooks.length) {
          throw new Error('Todavía no hay libros en Bilibook. Importa también el CSV oficial de la biblioteca.');
        }
        const report = await onMergeJournal(journalEntries, journalBooks);
        setSuccess({ booksImported: 0, report });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo completar la importación.');
    } finally {
      setImporting(false);
    }
  };

  const hasSelection = Boolean(libraryPreview?.length || journalEntries?.length);
  const journalOnlyWithoutMatches = !libraryPreview?.length
    && Boolean(journalEntries?.length)
    && (!existingBooks.length
      || (journalPreviewReport?.matchedEntries === 0
        && journalPreviewReport?.updatedCovers === 0
        && journalPreviewReport?.updatedMetadataBooks === 0));
  const confirmDisabled = importing || (!success && (!hasSelection || journalOnlyWithoutMatches));
  const confirmLabel = success
    ? 'Hecho'
    : importing
      ? 'Importando…'
      : libraryPreview?.length && journalEntries?.length
        ? 'Importar biblioteca y diario'
        : libraryPreview?.length
          ? `Importar ${libraryPreview.length} libros`
          : journalEntries?.length
            ? 'Añadir diario a mis libros'
            : 'Importar';
  const progressPct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <Modal
      title="Importar desde StoryGraph"
      icon={<Upload size={17} />}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            disabled={importing}
            className={cx(btnGhost, 'flex-1 bg-surface border border-line')}
          >
            {success ? 'Cerrar' : 'Cancelar'}
          </button>
          <button onClick={handleConfirm} disabled={confirmDisabled} className={cx(btnPrimary, 'flex-1')}>
            {importing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> {confirmLabel}
              </span>
            ) : confirmLabel}
          </button>
        </div>
      }
    >
      {success ? (
        <div className="space-y-4">
          <div className="rounded-card border border-stread/25 bg-stread/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={24} className="text-stread shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">Importación completada</h3>
                {success.booksImported > 0 && (
                  <p className="text-sm text-ink2 mt-1">
                    Se han añadido <strong>{success.booksImported}</strong> libros a Bilibook.
                  </p>
                )}
                {(success.localizedCovers ?? 0) > 0 && (
                  <p className="text-sm text-ink2 mt-1">
                    Copias de portada guardadas en el servidor: <strong>{success.localizedCovers}</strong>.
                  </p>
                )}
                {(success.coverLocalizationFailures ?? 0) > 0 && (
                  <p className="text-sm text-ink2 mt-1">
                    No se pudieron copiar {success.coverLocalizationFailures} portadas externas; se conservó su URL como respaldo.
                  </p>
                )}
                {success.report ? (
                  <p className="text-sm text-ink2 mt-1">
                    El diario se ha fusionado sin borrar tus avances manuales. Puedes consultar las páginas por día
                    en <strong>Estadísticas</strong> y las sesiones dentro del diario de cada libro.
                  </p>
                ) : (
                  <p className="text-sm text-ink2 mt-1">La biblioteca ya está disponible en Bilibook.</p>
                )}
              </div>
            </div>
          </div>

          {success.report && <ReportSummary report={success.report} final />}

          <button onClick={resetAll} className={btnSoft}>
            Importar otro archivo
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-card border border-streading/20 bg-streading/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={20} className="text-streading shrink-0 mt-0.5" />
              <div className="text-xs text-ink2 leading-relaxed space-y-1">
                <p>
                  Puedes importar solo la biblioteca, solo el diario sobre libros que ya tengas, o ambos archivos a
                  la vez. El diario conserva el ID de cada avance de StoryGraph, así que volver a importar el mismo
                  JSON actualiza las entradas y las portadas sin duplicar sesiones.
                </p>
                <p>
                  Bilibook nunca necesita tu contraseña ni tus cookies: el extractor se ejecuta localmente en tu
                  navegador, dentro de tu sesión.
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-3" aria-labelledby="import-library-title">
            <div className="flex items-start gap-3">
              <StepNumber value={1} />
              <div className="min-w-0 flex-1">
                <h3 id="import-library-title" className="font-display text-base font-semibold text-ink">
                  Biblioteca de StoryGraph <span className="text-xs font-sans font-medium text-ink3">(CSV oficial, opcional si ya tienes los libros)</span>
                </h3>
                <p className="text-xs text-ink3 leading-relaxed mt-0.5">
                  En StoryGraph: <strong>Manage Account → Export</strong>. Aporta título, autor, ISBN, estado, fechas,
                  estrellas y número de páginas.
                </p>
              </div>
              <Library size={20} className="text-accent shrink-0 mt-1" />
            </div>

            <div className="flex items-center gap-2.5 pl-11">
              <Globe size={16} className="text-ink3 shrink-0" />
              <label htmlFor="imp-lang" className="text-sm font-semibold text-ink2 shrink-0">
                Idioma por defecto
              </label>
              <select
                id="imp-lang"
                value={defaultLang}
                onChange={(event) => handleLangChange(event.target.value as BookLanguage)}
                className={cx(selectCls, 'ml-auto py-1.5 text-xs')}
              >
                {languageOptions(defaultLang).map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="pl-11 space-y-2.5">
              <FileDropZone
                title="CSV de la biblioteca"
                description="Suelta aquí la exportación oficial de StoryGraph o haz clic para elegirla"
                accept=".csv,text/csv"
                fileName={libraryFileName}
                inputRef={libraryFileRef}
                dragging={dragging === 'library'}
                onDraggingChange={(active) => setDragging(active ? 'library' : null)}
                onFile={(file) => void handleLibraryFile(file)}
                icon={<FileText size={22} />}
              />
              {(libraryPreview || libraryFileName) && (
                <button onClick={clearLibrary} className="inline-flex items-center gap-1 text-xs font-bold text-ink3 hover:text-danger">
                  <X size={13} /> Quitar CSV
                </button>
              )}
              <FieldError message={libraryError} />
              {libraryPreview && libraryPreview.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-stread">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-bold">{libraryPreview.length} libros listos</span>
                  </div>
                  {existingBooks.length > 0 && (
                    <div className="rounded-btn border border-gold/30 bg-gold/10 p-3 text-xs leading-relaxed text-ink2">
                      <strong>Ojo:</strong> este CSV crea libros nuevos. Si esos libros ya están en Bilibook,
                      aparecerán duplicados. Para actualizar únicamente el diario, quita este CSV y sube solo el
                      archivo del apartado 2.
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto divide-y divide-line/70 rounded-btn bg-sunken/60 px-3">
                    {libraryPreview.slice(0, 15).map((book, index) => (
                      <div key={`${book.title}-${index}`} className="flex items-center gap-2 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{book.title}</span>
                        <span className="max-w-[38%] truncate text-ink3">{book.author}</span>
                        {book.isbn && !book.coverUrl && (
                          <span className="shrink-0 rounded bg-streading/15 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-streading">
                            ISBN
                          </span>
                        )}
                      </div>
                    ))}
                    {libraryPreview.length > 15 && (
                      <p className="py-2 text-center text-xs text-ink3">y {libraryPreview.length - 15} más…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="import-journal-title">
            <div className="flex items-start gap-3">
              <StepNumber value={2} />
              <div className="min-w-0 flex-1">
                <h3 id="import-journal-title" className="font-display text-base font-semibold text-ink">
                  Diario de avances <span className="text-xs font-sans font-medium text-ink3">(JSON recomendado o CSV del extractor)</span>
                </h3>
                <p className="text-xs text-ink3 leading-relaxed mt-0.5">
                  Aporta la fecha de cada sesión, páginas leídas, página acumulada, porcentaje, minutos, notas y la
                  portada de StoryGraph, que sustituirá a la existente. Se vincula por ID de StoryGraph, ISBN o título y autor.
                </p>
              </div>
              <NotebookPen size={20} className="text-accent shrink-0 mt-1" />
            </div>

            <div className="pl-11 space-y-3">
              <details className="group rounded-card border border-line bg-sunken/50 p-3.5">
                <summary className="cursor-pointer list-none text-sm font-bold text-ink marker:hidden">
                  <span className="inline-flex items-center gap-2">
                    <Download size={16} className="text-accent" />
                    ¿Aún no tienes el JSON? Prepara el extractor
                  </span>
                </summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-ink2">
                  <li>
                    Instala una extensión de userscripts, como Tampermonkey o Violentmonkey, y abre{' '}
                    <a
                      href={USERSCRIPT_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                    >
                      el extractor de Bilibook
                    </a>{' '}
                    para instalarlo. También puedes{' '}
                    <a href={USERSCRIPT_URL} download className="font-bold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">
                      descargarlo y revisar su código
                    </a>
                    .
                  </li>
                  <li>Abre StoryGraph con tu sesión iniciada. Aparecerá el panel «Bilibook · Exportar diario».</li>
                  <li>
                    Confirma tu usuario, pulsa <strong>Exportar mi diario</strong> y espera sin cerrar la pestaña.
                    El registro debe anunciar la versión <strong>1.0.6</strong> o posterior y mostrar cuántos
                    libros traen portada, idioma, formato, fecha, estado, puntuación y saga.
                  </li>
                  <li>
                    Descarga el <strong>JSON</strong> y súbelo justo debajo. El CSV es una alternativa equivalente.
                    Después puedes desactivar el userscript para que no aparezca en cada visita a StoryGraph.
                  </li>
                  <li>
                    Sin extensión: abre el archivo descargado, copia todo su contenido y pégalo en la consola de las
                    herramientas de desarrollador estando en una página de StoryGraph.
                  </li>
                </ol>
                <p className="mt-3 rounded-btn bg-surface/70 p-2.5 text-[11px] leading-relaxed text-ink3">
                  Solo recupera avances que realmente registraste en StoryGraph. Si un libro se marcó como leído de
                  golpe, puede que solo existan las sesiones de inicio/fin o una única entrada.
                </p>
              </details>

              <FileDropZone
                title="Diario de StoryGraph"
                description="Suelta aquí read-nook-storygraph-journal-*.json o su CSV"
                accept=".json,.csv,application/json,text/csv"
                fileName={journalFileName}
                inputRef={journalFileRef}
                dragging={dragging === 'journal'}
                onDraggingChange={(active) => setDragging(active ? 'journal' : null)}
                onFile={(file) => void handleJournalFile(file)}
                icon={<CalendarDays size={22} />}
              />
              {(journalEntries || journalFileName) && (
                <button onClick={clearJournal} className="inline-flex items-center gap-1 text-xs font-bold text-ink3 hover:text-danger">
                  <X size={13} /> Quitar diario
                </button>
              )}
              <FieldError message={journalError} />

              {journalEntries && journalSummary && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-stread">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">
                        {journalEntries.length.toLocaleString('es')} entradas · {journalSummary.books} libros
                      </p>
                      <p className="mt-0.5 text-xs text-ink3">
                        Del {formatJournalDate(journalSummary.from)} al {formatJournalDate(journalSummary.to)}
                      </p>
                    </div>
                  </div>

                  <JournalCoverStatsSummary stats={journalCoverStats} metadataStats={journalMetadataStats} />

                  {!libraryPreview && existingBooks.length === 0 ? (
                    <div className="rounded-btn border border-gold/30 bg-gold/10 p-3 text-xs leading-relaxed text-ink2">
                      Para poder vincular estas sesiones necesitas importar también el CSV oficial de la biblioteca
                      en el apartado 1.
                    </div>
                  ) : journalPreviewReport ? (
                    <ReportSummary report={journalPreviewReport} />
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {importing && (
            <div className="space-y-2.5 rounded-card bg-sunken/70 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-ink2">
                  <Loader2 size={16} className="animate-spin text-accent" />
                  {libraryPreview ? 'Completando portadas y guardando…' : 'Fusionando el diario…'}
                </span>
                {progress.total > 0 && (
                  <span className="font-bold tabular-nums text-ink">{progress.done} / {progress.total}</span>
                )}
              </div>
              {progress.total > 0 && <ProgressBar pct={progressPct} className="h-2.5" />}
            </div>
          )}

          <FieldError message={actionError} />
        </div>
      )}
    </Modal>
  );
}

function StepNumber({ value }: { value: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-onprimary">
      {value}
    </span>
  );
}

interface FileDropZoneProps {
  title: string;
  description: string;
  accept: string;
  fileName: string;
  inputRef: RefObject<HTMLInputElement>;
  dragging: boolean;
  onDraggingChange: (active: boolean) => void;
  onFile: (file: File) => void;
  icon: ReactNode;
}

function FileDropZone({
  title,
  description,
  accept,
  fileName,
  inputRef,
  dragging,
  onDraggingChange,
  onFile,
  icon,
}: FileDropZoneProps) {
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        onDraggingChange(true);
      }}
      onDragLeave={() => onDraggingChange(false)}
      onDrop={(event) => {
        event.preventDefault();
        onDraggingChange(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      role="button"
      tabIndex={0}
      aria-label={`Seleccionar ${title}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cx(
        'cursor-pointer rounded-card border-2 border-dashed p-5 text-center transition-all',
        dragging
          ? 'scale-[1.01] border-accent bg-accent/10'
          : 'border-line2 hover:border-accent/60 hover:bg-sunken/50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = '';
        }}
      />
      <span
        className={cx(
          'mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-card transition-colors',
          dragging ? 'bg-accent text-white' : 'bg-accent/10 text-accent',
        )}
      >
        {fileName ? icon : <CloudUpload size={22} />}
      </span>
      <p className="break-words text-sm font-bold text-ink">{fileName || title}</p>
      <p className="mt-1 text-xs text-ink3">{dragging ? '¡Suéltalo!' : fileName ? 'Haz clic para cambiar el archivo' : description}</p>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-btn border border-danger/25 bg-danger/10 p-3" role="alert">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
      <p className="text-sm font-semibold leading-relaxed text-danger">{message}</p>
    </div>
  );
}

function JournalCoverStatsSummary({
  stats,
  metadataStats,
}: {
  stats: StoryGraphJournalCoverStats | null;
  metadataStats: StoryGraphMetadataStats | null;
}) {
  if (!stats) return null;

  const hasAnyCover = stats.booksWithCover > 0 || stats.entriesWithCover > 0;
  const booksLabel = stats.booksInFile > 0
    ? `${stats.booksWithCover.toLocaleString('es')} de ${stats.booksInFile.toLocaleString('es')} libros`
    : null;
  const entriesLabel = `${stats.entriesWithCover.toLocaleString('es')} de ${stats.totalEntries.toLocaleString('es')} entradas`;
  const scopeLabel = [booksLabel, entriesLabel].filter(Boolean).join(' · ');
  const versionLabel = stats.extractorVersion ? ` Extractor v${stats.extractorVersion}.` : '';

  if (!hasAnyCover) {
    return (
      <div className="flex items-start gap-2 rounded-btn border border-gold/30 bg-gold/10 p-3 text-xs leading-relaxed text-ink2" role="status">
        <AlertCircle size={17} className="mt-0.5 shrink-0 text-gold" />
        <p>
          <strong>Este archivo no incluye ninguna URL de portada</strong> ({scopeLabel}).{versionLabel} Puedes
          importar el diario, pero no se sustituirá ninguna portada. Vuelve a generarlo con el extractor
          <strong> 1.0.6 o posterior</strong> y comprueba que su registro indica libros con portada.
        </p>
      </div>
    );
  }

  const metadataSummary = metadataStats
    ? `Datos incluidos en ${metadataStats.booksInFile.toLocaleString('es')} libros: idioma ${metadataStats.booksWithLanguage.toLocaleString('es')} · formato ${metadataStats.booksWithFormat.toLocaleString('es')} · páginas ${metadataStats.booksWithPages.toLocaleString('es')} · fecha ${metadataStats.booksWithPublishDate.toLocaleString('es')} · estado ${metadataStats.booksWithStatus.toLocaleString('es')} · puntuación ${metadataStats.booksWithRating.toLocaleString('es')} · saga ${metadataStats.booksWithSeries.toLocaleString('es')}.`
    : null;

  return (
    <div className="space-y-1.5 rounded-btn bg-surface/70 px-3 py-2 text-xs leading-relaxed text-ink2">
      <p>Portadas incluidas en el archivo: <strong>{scopeLabel}</strong>.{versionLabel}</p>
      {metadataSummary && <p>{metadataSummary}</p>}
    </div>
  );
}

function ReportSummary({ report, final = false }: { report: StoryGraphJournalMergeReport; final?: boolean }) {
  const entriesLabel = final
    ? `${report.addedEntries} nuevas · ${report.updatedEntries} actualizadas · ${report.unchangedEntries} sin cambios`
    : `${report.matchedEntries} de ${report.totalEntries} entradas vinculadas`;

  return (
    <div className="rounded-card border border-line bg-sunken/50 p-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <ReportMetric label="Libros" value={report.matchedBooks} />
        <ReportMetric label={final ? 'Entradas nuevas' : 'Entradas vinculadas'} value={final ? report.addedEntries : report.matchedEntries} />
        <ReportMetric label="Páginas nuevas" value={report.importedPages.toLocaleString('es')} />
        <ReportMetric label="Sin vincular" value={report.unmatchedEntries} />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink2">{entriesLabel}.</p>
      {report.providedCovers > 0 ? (
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          Portadas de StoryGraph para libros vinculados: {report.providedCovers}.{' '}
          {final ? 'Sustituidas' : 'Se sustituirán'}: {report.updatedCovers}. Ya coincidían:{' '}
          {report.unchangedCovers}.
        </p>
      ) : (
        <p className="mt-1 text-xs font-semibold leading-relaxed text-ink2">
          No se cambiará ninguna portada: el archivo no trae URLs de portada para libros vinculados.
        </p>
      )}
      {report.unmatchedCovers > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          Además, {report.unmatchedCovers} {report.unmatchedCovers === 1 ? 'portada no se aplicará' : 'portadas no se aplicarán'}
          {' '}porque su libro no se pudo vincular.
        </p>
      )}
      {report.providedMetadataBooks > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          Datos completados desde StoryGraph en {report.updatedMetadataBooks} de{' '}
          {report.providedMetadataBooks} libros con metadatos: idioma, formato, páginas, fecha, estado,
          puntuación y saga cuando el archivo los incluye.
        </p>
      )}
      {final && report.localizedCovers > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          Copias de portada guardadas en el servidor: {report.localizedCovers}.
        </p>
      )}
      {final && report.coverLocalizationFailures > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-ink2">
          No se pudieron copiar {report.coverLocalizationFailures} portadas externas; se conservó su URL como respaldo.
        </p>
      )}
      {report.importedMinutes > 0 && (
        <p className="mt-1 text-xs text-ink2">
          También se han detectado {report.importedMinutes.toLocaleString('es')} minutos de escucha/lectura.
        </p>
      )}
      {!final && report.addedEntries === 0 && report.updatedEntries === 0 && report.updatedCovers === 0 && report.unchangedEntries > 0 && (
        <p className="mt-1 text-xs font-semibold text-stread">
          Este diario ya estaba importado: volver a ejecutarlo no duplicará sesiones.
        </p>
      )}

      {report.unmatchedBooks.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-ink2">
            Ver {report.unmatchedBooks.length} libros sin coincidencia
          </summary>
          <div className="mt-2 max-h-44 divide-y divide-line/70 overflow-y-auto rounded-btn bg-surface/70 px-3">
            {report.unmatchedBooks.slice(0, 30).map((book, index) => (
              <div key={`${book.storyGraphBookId}-${book.title}-${index}`} className="flex items-center gap-2 py-2 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{book.title}</span>
                  <span className="block truncate text-ink3">
                    {book.author || 'Autor desconocido'}{book.isbn ? ` · ISBN ${book.isbn}` : ''}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-ink3">{book.entries} entradas</span>
              </div>
            ))}
            {report.unmatchedBooks.length > 30 && (
              <p className="py-2 text-center text-xs text-ink3">y {report.unmatchedBooks.length - 30} más…</p>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink3">
            Suele resolverse importando el CSV oficial o corrigiendo el ISBN/título del libro correspondiente en
            Bilibook y volviendo a subir el diario.
          </p>
        </details>
      )}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-btn bg-surface/80 px-3 py-2 text-center">
      <p className="font-display text-lg font-semibold leading-none tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink3">{label}</p>
    </div>
  );
}
