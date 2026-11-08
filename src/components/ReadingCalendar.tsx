import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Book } from '../types';
import { dateKey, daysInYear, pageLevel, readingActivity } from '../readingCalendar';
import { BookCover, iconBtn } from './ui';

// Los colores también se comparten con la leyenda.
const levels = ['reading-activity-0', 'reading-activity-1', 'reading-activity-2', 'reading-activity-3'];
const weekday = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const monthNames = Array.from({ length: 12 }, (_, month) => new Date(2024, month, 1).toLocaleDateString('es', { month: 'short' }).replace('.', ''));

export function ReadingCalendar({ books, onOpen }: { books: Book[]; onOpen: (book: Book) => void }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1, 12); });
  const activity = useMemo(() => readingActivity(books), [books]);
  const year = month.getFullYear();
  const yearDays = useMemo(() => daysInYear(year), [year]);
  const offset = (new Date(year, month.getMonth(), 1).getDay() + 6) % 7;
  const count = new Date(year, month.getMonth() + 1, 0).getDate();
  const startOffset = (new Date(year, 0, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((startOffset + yearDays.length) / 7);
  const move = (delta: number) => setMonth(new Date(year, month.getMonth() + delta, 1, 12));
  const monthTitle = month.toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return <div className="space-y-6">
    <section className="rounded-card border border-line bg-surface p-4 sm:p-6 shadow-card" aria-label="Calendario de lectura">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Tu diario visual</p><h3 className="font-display text-2xl font-semibold text-ink capitalize">{monthTitle}</h3></div>
        <div className="flex items-center gap-1"><button type="button" className={iconBtn} onClick={() => move(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button><button type="button" className={iconBtn} onClick={() => move(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button><button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); }} className="ml-1 rounded-btn border border-line px-3 py-2 text-xs font-semibold text-ink2">Hoy</button></div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">{weekday.map((day, i) => <div key={i} className="text-center text-xs font-bold text-ink3 pb-1">{day}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(year, month.getMonth(), i + 1, 12);
          const day = activity.get(dateKey(date));
          return <div key={i} className="min-w-0 min-h-[76px] sm:min-h-[125px] rounded-lg border border-line bg-sunken/40 p-1 sm:p-1.5">
            <span className="block text-[11px] sm:text-xs font-bold text-ink2">{i + 1}</span>
            {day && <div className={`mt-1 grid gap-1 ${day.books.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{day.books.map((book) => <button key={book.id} type="button" onClick={() => onOpen(book)} title={`${book.title} · ${date.toLocaleDateString('es')}`} aria-label={`Abrir ${book.title}, leído el ${date.toLocaleDateString('es')}`} className="w-full min-w-0 rounded-sm overflow-hidden shadow-sm focus-visible:ring-2 focus-visible:ring-accent"><BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-full aspect-[2/3]" /></button>)}</div>}
          </div>;
        })}
      </div>
      <p className="mt-4 text-xs text-ink3">Portadas de los libros con actividad registrada en el diario. Pulsa una portada para abrir el libro.</p>
    </section>
    <section className="rounded-card border border-line bg-surface p-4 sm:p-6 shadow-card" aria-label="Actividad de lectura anual">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div><p className="text-xs font-bold uppercase tracking-widest text-accent">Una página cada día</p><h3 className="font-display text-2xl font-semibold text-ink">Tu actividad en {year}</h3></div><div className="flex gap-1"><button type="button" className={iconBtn} aria-label="Año anterior" onClick={() => setMonth(new Date(year - 1, month.getMonth(), 1, 12))}><ChevronLeft size={20} /></button><button type="button" className={iconBtn} aria-label="Año siguiente" onClick={() => setMonth(new Date(year + 1, month.getMonth(), 1, 12))}><ChevronRight size={20} /></button></div></div>
      <div className="overflow-x-auto pb-2"><div style={{ width: `${weeks * 16}px` }}>
        <div className="relative h-5 text-[10px] text-ink3">{monthNames.map((name, index) => { const start = new Date(year, index, 1, 12); const dayIndex = Math.round((Date.UTC(year, index, 1) - Date.UTC(year, 0, 1)) / 86400000); return <span key={name} className="absolute capitalize" style={{ left: `${Math.floor((startOffset + dayIndex) / 7) * 16}px` }} title={start.toLocaleDateString('es', { month: 'long' })}>{name}</span>; })}</div>
        <div className="grid gap-1" style={{ gridTemplateRows: 'repeat(7, 12px)', gridTemplateColumns: `repeat(${weeks}, 12px)`, gridAutoFlow: 'column' }}>
          {Array.from({ length: startOffset }, (_, i) => <span key={`blank-${i}`} />)}
          {yearDays.map((date) => { const pages = activity.get(dateKey(date))?.pages || 0; const label = `${date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}: ${pages.toLocaleString('es')} páginas`; return <span key={dateKey(date)} role="img" aria-label={label} title={label} className={`rounded-[3px] ${levels[pageLevel(pages)]}`} />; })}
        </div>
      </div></div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink2">{['0', '1–20', '21–50', 'Más de 50'].map((label, i) => <span key={label} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${levels[i]}`} />{label} páginas</span>)}</div>
      <p className="mt-3 text-xs text-ink3">Suma de páginas registradas en el diario de todos tus libros. Las fechas incompletas no se asignan a un día.</p>
    </section>
  </div>;
}
