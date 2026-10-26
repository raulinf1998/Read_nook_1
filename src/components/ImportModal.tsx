import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Globe, CloudUpload } from 'lucide-react';
import { parseStoryGraphCsv, enrichWithCovers } from '../lib';
import type { Book, BookLanguage } from '../types';
import { LANGUAGE_META } from '../types';
import { Modal, ProgressBar, btnGhost, btnPrimary, cx, selectCls } from './ui';

interface Props {
  onImport: (books: Omit<Book, 'id' | 'createdAt'>[]) => void;
  onClose: () => void;
}

export function ImportModal({ onImport, onClose }: Props) {
  const [preview, setPreview] = useState<Omit<Book, 'id' | 'createdAt'>[] | null>(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [defaultLang, setDefaultLang] = useState<BookLanguage>('es');
  const [rawText, setRawText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const tryParse = (text: string, lang: BookLanguage) => {
    try {
      const books = parseStoryGraphCsv(text, lang);
      if (books.length === 0) {
        setError('No se encontraron libros en el CSV. Verifica que es la exportación de TheStoryGraph.');
        setPreview(null);
      } else {
        setPreview(books);
        setError('');
      }
    } catch {
      setError('Error al procesar el archivo CSV.');
      setPreview(null);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRawText(text);
      tryParse(text, defaultLang);
    };
    reader.readAsText(file);
  };

  const handleLangChange = (lang: BookLanguage) => {
    setDefaultLang(lang);
    if (rawText) tryParse(rawText, lang);
  };

  const handleConfirm = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    const enriched = await enrichWithCovers(preview, (done, total) => setProgress({ done, total }));
    setImporting(false);
    onImport(enriched);
    onClose();
  };

  const progressPct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <Modal
      title="Importar biblioteca"
      icon={<Upload size={17} />}
      onClose={onClose}
      footer={
        <div className="flex gap-2.5">
          <button onClick={onClose} disabled={importing} className={cx(btnGhost, 'flex-1 bg-surface border border-line')}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!preview || preview.length === 0 || importing} className={cx(btnPrimary, 'flex-1')}>
            {importing ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Importando…</span>
            ) : preview ? `Importar ${preview.length} libros` : 'Importar'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-streading/10 border border-streading/20 rounded-btn p-3.5">
          <p className="text-xs text-ink2 leading-relaxed">
            Exporta tu biblioteca desde <strong>TheStoryGraph</strong> (Settings → Export Data) y sube aquí el CSV.
            Los libros con ISBN se completan solos con portada y datos desde Google Books y Open Library.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Globe size={16} className="text-ink3 shrink-0" />
          <label htmlFor="imp-lang" className="text-sm font-semibold text-ink2 shrink-0">Idioma por defecto</label>
          <select
            id="imp-lang"
            value={defaultLang}
            onChange={(e) => handleLangChange(e.target.value as BookLanguage)}
            className={cx(selectCls, 'ml-auto py-1.5 text-xs')}
          >
            {(Object.keys(LANGUAGE_META) as BookLanguage[]).map((l) => (
              <option key={l} value={l}>{LANGUAGE_META[l].label}</option>
            ))}
          </select>
        </div>

        {/* Zona de subida con arrastrar y soltar */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
          className={cx(
            'border-2 border-dashed rounded-card p-7 text-center cursor-pointer transition-all',
            dragging ? 'border-accent bg-accent/10 scale-[1.01]' : 'border-line2 hover:border-accent/60 hover:bg-sunken/50'
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <span className={cx(
            'w-12 h-12 rounded-card flex items-center justify-center mx-auto mb-2.5 transition-colors',
            dragging ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
          )}>
            {fileName ? <FileText size={22} /> : <CloudUpload size={22} />}
          </span>
          <p className="text-sm font-bold text-ink">{fileName || 'Suelta el CSV aquí o haz clic para elegirlo'}</p>
          <p className="text-xs text-ink3 mt-1">{dragging ? '¡Suéltalo!' : 'Exportación de TheStoryGraph en formato .csv'}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-danger/10 border border-danger/25 rounded-btn p-3">
            <AlertCircle size={18} className="text-danger shrink-0" />
            <p className="text-sm font-semibold text-danger">{error}</p>
          </div>
        )}

        {importing && (
          <div className="rounded-card bg-sunken/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink2 inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-accent" /> Buscando portadas por ISBN…
              </span>
              <span className="font-bold text-ink tabular-nums">{progress.done} / {progress.total}</span>
            </div>
            <ProgressBar pct={progressPct} className="h-2.5" />
          </div>
        )}

        {preview && preview.length > 0 && !importing && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-stread">
              <CheckCircle2 size={18} />
              <span className="text-sm font-bold">{preview.length} libros listos para importar</span>
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-line/70 bg-sunken/60 rounded-btn px-3">
              {preview.slice(0, 20).map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-2">
                  <span className="font-semibold text-ink truncate flex-1">{b.title}</span>
                  <span className="text-ink3 truncate max-w-[38%]">{b.author}</span>
                  {b.isbn && !b.coverUrl && (
                    <span className="text-[9px] font-extrabold tracking-wide bg-streading/15 text-streading px-1.5 py-0.5 rounded shrink-0">ISBN</span>
                  )}
                </div>
              ))}
              {preview.length > 20 && <p className="text-xs text-ink3 text-center py-2">y {preview.length - 20} más…</p>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
