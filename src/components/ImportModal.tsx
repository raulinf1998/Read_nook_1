import { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseStoryGraphCsv, enrichWithCovers } from '../lib';
import type { Book } from '../types';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      tryParse(text);
    };
    reader.readAsText(file);
  };

  const tryParse = (text: string) => {
    try {
      const books = parseStoryGraphCsv(text);
      if (books.length === 0) {
        setError('No se encontraron libros en el CSV. Verifica el formato.');
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

  const handleConfirm = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    const enriched = await enrichWithCovers(preview, (done, total) => {
      setProgress({ done, total });
    });
    setImporting(false);
    onImport(enriched);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload size={20} className="text-gray-700 dark:text-gray-300" />
            Importar desde TheStoryGraph
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3.5">
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              Exporta tu biblioteca desde TheStoryGraph en formato CSV (Settings &gt; Export Data),
              luego súbelo aquí. Los libros con ISBN se enriquecerán automáticamente con portadas desde Google Books y Open Library.
            </p>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <FileText size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {fileName || 'Haz clic para seleccionar un archivo CSV'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">o arrastra el archivo aquí</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Buscando portadas por ISBN... {progress.done} / {progress.total}
              </p>
            </div>
          )}

          {preview && preview.length > 0 && !importing && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={18} />
                <span className="text-sm font-medium">{preview.length} libros encontrados</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                {preview.slice(0, 20).map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-900 dark:text-white truncate flex-1">{b.title}</span>
                    <span className="text-gray-400 flex-shrink-0">{b.author}</span>
                    {b.isbn && !b.coverUrl && <span className="text-[10px] text-blue-400 flex-shrink-0">ISBN</span>}
                  </div>
                ))}
                {preview.length > 20 && <p className="text-xs text-gray-400 text-center pt-1">y {preview.length - 20} más...</p>}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!preview || preview.length === 0 || importing}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing ? 'Importando...' : `Importar ${preview ? `${preview.length} libros` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
