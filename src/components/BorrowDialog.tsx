import { useState } from 'react';
import { BookCopy, UserRound } from 'lucide-react';
import { ACCOUNT_NAMES } from '../accounts';
import type { SharedBook } from '../borrowing';
import type { Book } from '../types';
import { BookCover, Modal, btnGhost, btnPrimary, cx, selectCls } from './ui';

interface Props {
  source: SharedBook;
  books: Book[];
  onBorrow: (existingBookId?: string) => Promise<void>;
  onSwitch: () => void;
  onClose: () => void;
}

export function BorrowDialog({ source, books, onBorrow, onSwitch, onClose }: Props) {
  const candidates = books.filter((book) => !book.borrowedFrom);
  const normalize = (value: string) => (value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const possibleMatch = candidates.some((book) => (source.isbn && book.isbn && source.isbn === book.isbn) || (normalize(source.title) && normalize(source.title) === normalize(book.title) && normalize(source.author) === normalize(book.author)));
  const [selection, setSelection] = useState(possibleMatch ? '' : 'new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canBorrow = !source.borrowedFrom && source.onMyShelf !== false;
  const submit = async () => {
    if (!selection || busy) return;
    setBusy(true); setError('');
    try { await onBorrow(selection === 'new' ? undefined : selection); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar el préstamo.'); setBusy(false); }
  };
  return <Modal title="Libro de la otra biblioteca" icon={<BookCopy size={18} />} onClose={busy ? () => {} : onClose} maxWidth="max-w-lg">
    <div className="space-y-4">
      <div className="flex gap-3 items-center"><BookCover title={source.title} author={source.author} coverUrl={source.coverUrl} detail="sm" className="w-14 h-20 shadow-book" /><div className="min-w-0"><p className="font-display text-lg font-semibold text-ink">{source.title}</p><p className="text-sm text-ink3">{source.author}</p><p className="mt-1 text-xs font-bold text-accent">Ejemplar de {ACCOUNT_NAMES[source.owner]}</p></div></div>
      {canBorrow ? <>
        <p className="text-sm text-ink2">Añádelo a tu biblioteca como préstamo para llevar tu propio progreso, diario y valoración. La librería conjunta mostrará una sola copia.</p>
        {possibleMatch && <p className="rounded-btn bg-accent/10 px-3 py-2 text-xs text-ink2">Parece que ya tienes una ficha de este libro. Puedes vincularla sin perder su historial o crear una ficha nueva.</p>}
        <label className="block text-xs font-bold text-ink2" htmlFor="borrow-target">Tu ficha de lectura</label>
        <select id="borrow-target" value={selection} onChange={(event) => setSelection(event.target.value)} className={cx(selectCls, 'w-full')}>
          {possibleMatch && <option value="">Elige cómo añadirlo</option>}
          <option value="new">Crear una ficha nueva, sin avances</option>
          {candidates.map((book) => <option key={book.id} value={book.id}>Vincular: {book.title} · {book.author || 'Autor desconocido'}</option>)}
        </select>
        {selection !== 'new' && selection && <p className="text-xs text-ink3">Se conservarán tu diario, fechas, valoraciones y demás datos. Confirma que es el mismo ejemplar.</p>}
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <button type="button" disabled={!selection || busy} onClick={() => void submit()} className={cx(btnPrimary, 'w-full disabled:opacity-50')}>{busy ? 'Guardando…' : selection && selection !== 'new' ? 'Vincular mi ficha' : 'Coger prestado'}</button>
      </> : <p className="text-sm text-ink2">Este libro no está disponible como ejemplar propio para prestar.</p>}
      <button type="button" disabled={busy} onClick={onSwitch} className={cx(btnGhost, 'w-full')}><UserRound size={15} /> Cambiar a {ACCOUNT_NAMES[source.owner]}</button>
    </div>
  </Modal>;
}
