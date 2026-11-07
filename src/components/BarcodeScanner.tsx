import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { btnGhost, btnSoft, cx } from './ui';
import { isBookBarcode } from '../isbnBarcode';

interface ScanReader {
  decodeFromStream: (stream: MediaStream, video: HTMLVideoElement, callback: (result: { getText: () => string } | undefined) => void) => Promise<{ stop: () => void }>;
  decodeFromImageUrl: (url: string) => Promise<{ getText: () => string }>;
}
async function loadReader(): Promise<ScanReader> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 160 });
}
interface Props { onDetected: (isbn: string) => void; onClose: () => void; readerFactory?: () => Promise<ScanReader> }

/** La cámara solo se abre con una acción explícita; el vídeo nunca se envía al servidor. */
export function BarcodeScanner({ onDetected, onClose, readerFactory = loadReader }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onDetected);
  callbackRef.current = onDetected;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Los navegadores permiten la captura de imágenes por HTTP aunque bloqueen
  // getUserMedia. La cámara de fotos se abre con un gesto directo del usuario.
  const [mode, setMode] = useState<'live' | 'photo'>(() => window.isSecureContext ? 'live' : 'photo');
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoOperation = useRef(0);

  useEffect(() => () => { photoOperation.current += 1; }, []);
  const readPhoto = async (file: File | undefined) => {
    if (!file || photoBusy) return;
    const operation = ++photoOperation.current;
    setPhotoError('');
    setPhotoBusy(true);
    let url = '';
    try {
      url = URL.createObjectURL(file);
      const reader = await readerFactory();
      const result = await reader.decodeFromImageUrl(url);
      const isbn = result.getText();
      if (!isBookBarcode(isbn)) throw new Error('not-isbn');
      if (operation === photoOperation.current) callbackRef.current(isbn);
    } catch {
      if (operation === photoOperation.current) setPhotoError('No se ha podido leer un ISBN válido. Prueba otra foto, con buena luz y el código completo enfocado, o escríbelo a mano.');
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (operation === photoOperation.current) setPhotoBusy(false);
    }
  };

  useEffect(() => {
    if (mode !== 'live') return;
    let closed = false;
    let found = false;
    let stream: MediaStream | undefined;
    let controls: { stop: () => void } | undefined;
    const stop = () => {
      try { controls?.stop(); } catch { /* liberar igualmente las pistas */ }
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const visibility = () => {
      if (document.hidden) {
        closed = true;
        stop();
        setReady(false);
        setError('La cámara se ha detenido al salir de la aplicación. Puedes volver a activarla.');
      }
    };
    document.addEventListener('visibilitychange', visibility);
    setError(''); setReady(false);
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite acceder a la cámara. Introduce el ISBN manualmente.');
        const reader = await readerFactory();
        if (closed) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
        if (closed) { stop(); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        controls = await reader.decodeFromStream(stream, video, (result) => {
          const isbn = result?.getText();
          if (!closed && !found && isbn && isBookBarcode(isbn)) {
            found = true;
            stop();
            callbackRef.current(isbn);
          }
        });
        if (closed || found) { stop(); return; }
        setReady(true);
      } catch (err) {
        stop();
        if (closed) return;
        const name = err instanceof Error ? err.name : '';
        const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? 'No se ha concedido permiso para usar la cámara. Permítelo en el navegador o escribe el ISBN.'
          : name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? 'No se ha encontrado ninguna cámara. Puedes escribir el ISBN manualmente.'
            : err instanceof Error && err.message.startsWith('Este navegador') ? err.message
              : 'No se pudo iniciar la cámara. Comprueba los permisos o utiliza una foto.';
        setError(message);
      }
    };
    void start();
    return () => { closed = true; document.removeEventListener('visibilitychange', visibility); stop(); };
  }, [attempt, readerFactory, mode]);

  return <section className="mt-3 rounded-card border border-line bg-surface p-3" aria-label="Escáner de ISBN">
    <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Camera size={16} /> Escanear código de barras</p><button type="button" onClick={onClose} aria-label="Cerrar cámara" className={cx(btnGhost, 'p-1.5')}><X size={17} /></button></div>
    {mode === 'live' ? <>
      {!error && <div className="relative overflow-hidden rounded-lg bg-black"><video ref={videoRef} muted playsInline autoPlay className="aspect-[4/3] w-full object-cover" aria-label="Vista de la cámara" /><div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] top-[35%] h-[30%] rounded-lg border-2 border-white/80" /></div>}
      {error ? <div role="alert" className="text-xs text-danger">{error}<div className="mt-2"><button type="button" className={btnSoft} onClick={() => setAttempt((v) => v + 1)}>Reintentar vídeo</button></div></div> : <p role="status" className="mt-2 text-xs text-ink3">{ready ? 'Enfoca el código de barras del libro. La cámara se cerrará al detectarlo.' : 'Iniciando cámara…'}</p>}
      <button type="button" onClick={() => { setMode('photo'); setPhotoError(''); }} className={cx(btnSoft, 'mt-3')}><Camera size={16} /> Usar una foto</button>
    </> : <>
      <p className="text-xs text-ink3">Haz una foto del código de barras completo con buena luz. La imagen se procesa en tu dispositivo.</p>
      <label className={cx(btnSoft, 'mt-3 inline-flex cursor-pointer', photoBusy && 'pointer-events-none opacity-60')}>
        <Camera size={16} /> {photoBusy ? 'Leyendo foto…' : 'Hacer foto o elegir imagen'}
        <input type="file" accept="image/*" capture="environment" disabled={photoBusy} className="sr-only" aria-label="Hacer foto o elegir imagen" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void readPhoto(file); }} />
      </label>
      {photoError && <p role="alert" className="mt-2 text-xs text-danger">{photoError}</p>}
      {window.isSecureContext && <button type="button" onClick={() => { photoOperation.current += 1; setPhotoBusy(false); setMode('live'); }} className={cx(btnGhost, 'mt-3 ml-2')}>Usar vídeo</button>}
    </>}
  </section>;
}
