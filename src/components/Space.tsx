import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, Sparkles } from 'lucide-react';
import type { Book } from '../types';
import { PLANET_STYLES, buildSpaceOrbits, buildSpaceReadings, type PlanetStyle } from '../space';
import { formatReadingDate } from '../readingDate';
import { normalizeLanguageCode } from '../bookMetadata';
import { BookCover, cardCls, cx, selectCls } from './ui';

interface Props {
  books: Book[];
  onOpen: (book: Book) => void;
  planetStyle: PlanetStyle;
  onSetPlanetStyle: (style: PlanetStyle) => void;
}

export function Space({ books, onOpen, planetStyle, onSetPlanetStyle }: Props) {
  const data = useMemo(() => buildSpaceReadings(books), [books]);
  const [language, setLanguage] = useState<'all' | 'en' | 'es' | 'other'>('all');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const availableYears = useMemo(() => [...new Set([
    ...data.years,
    ...data.otherLanguages.map((book) => book.finishedAt ? new Date(book.finishedAt).getFullYear() : NaN).filter(Number.isFinite),
  ])].sort((a, b) => a - b), [data]);
  const matchesYear = (book: Book) => {
    if (!fromYear && !toYear) return true;
    if (!book.finishedAt || !Number.isFinite(book.finishedAt)) return false;
    const year = new Date(book.finishedAt).getFullYear();
    return Number.isFinite(year) && (!fromYear || year >= Number(fromYear)) && (!toYear || year <= Number(toYear));
  };
  const visibleReadings = data.orbiting.filter((entry) => (language === 'all' || language === entry.language) && matchesYear(entry.reading));
  const visibleYears = [...new Set(visibleReadings.map((entry) => entry.year))].sort((a, b) => a - b);
  const orbits = buildSpaceOrbits(visibleReadings, visibleYears);
  const withoutYear = data.withoutYear.filter((book) => (language === 'all' || normalizeLanguageCode(book.language) === language) && matchesYear(book));
  const otherLanguages = data.otherLanguages.filter((book) => (language === 'all' || language === 'other') && matchesYear(book));
  const filtersActive = language !== 'all' || Boolean(fromYear || toYear);
  const [zoom, setZoom] = useState(0.65);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const size = orbits.extent * 2;
  const center = orbits.extent;
  const centerView = () => {
    const node = viewport.current;
    if (node) { node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2; node.scrollTop = (node.scrollHeight - node.clientHeight) / 2; }
  };
  useEffect(() => { centerView(); }, [size, zoom]);

  const original = (reading: Book) => books.find((book) => book.id === reading.id) || reading;
  const stars = Array.from({ length: 140 }, (_, i) => ({ x: (i * 197 + 71) % 997 / 997 * 100, y: (i * 367 + 137) % 991 / 991 * 100, size: i % 13 === 0 ? 2 : 1 }));
  const asteroids = Array.from({ length: 320 }, (_, i) => {
    const angle = i * 2.399963;
    const spread = Math.sin(i * 83.17) * 19 + Math.sin(i * 17.4) * 8;
    const radius = orbits.beltRadius + spread;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle), r: 1.3 + (i % 4) * 0.65 };
  });

  return <section className="space-y-4">
    <div className={cx(cardCls, 'flex flex-wrap items-end gap-3 p-4')}>
      <label className="min-w-[180px] flex-1 text-xs font-bold text-ink2">Forma de los planetas
        <select value={planetStyle} onChange={(event) => onSetPlanetStyle(event.target.value as PlanetStyle)} className={cx(selectCls, 'mt-1 w-full')} aria-label="Forma de los planetas">
          {PLANET_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
        </select>
      </label>
      <label className="min-w-[150px] flex-1 text-xs font-bold text-ink2">Idioma
        <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className={cx(selectCls, 'mt-1 w-full')} aria-label="Idioma del espacio">
          <option value="all">Todos los idiomas</option><option value="en">Inglés</option><option value="es">Castellano</option><option value="other">Otros idiomas</option>
        </select>
      </label>
      <label className="min-w-[110px] flex-1 text-xs font-bold text-ink2">Desde
        <select value={fromYear} onChange={(event) => { const value = event.target.value; setFromYear(value); if (value && toYear && Number(value) > Number(toYear)) setToYear(value); }} className={cx(selectCls, 'mt-1 w-full')} aria-label="Desde el año">
          <option value="">Cualquier año</option>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      <label className="min-w-[110px] flex-1 text-xs font-bold text-ink2">Hasta
        <select value={toYear} onChange={(event) => { const value = event.target.value; setToYear(value); if (value && fromYear && Number(value) < Number(fromYear)) setFromYear(value); }} className={cx(selectCls, 'mt-1 w-full')} aria-label="Hasta el año">
          <option value="">Cualquier año</option>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </label>
      {filtersActive && <button type="button" onClick={() => { setLanguage('all'); setFromYear(''); setToYear(''); }} className="rounded-btn border border-line bg-surface px-3 py-2 text-xs font-bold text-ink">Limpiar filtros</button>}
      <div className="flex items-center gap-2" role="group" aria-label="Zoom del universo">
        <button type="button" className="rounded-btn border border-line bg-surface p-2 text-ink" aria-label="Alejar" onClick={() => setZoom((value) => Math.max(0.35, +(value - 0.1).toFixed(2)))} disabled={zoom <= 0.35}><Minus size={17} /></button>
        <span className="w-10 text-center text-xs font-bold text-ink2 tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" className="rounded-btn border border-line bg-surface p-2 text-ink" aria-label="Acercar" onClick={() => setZoom((value) => Math.min(1.25, +(value + 0.1).toFixed(2)))} disabled={zoom >= 1.25}><Plus size={17} /></button>
        <button type="button" className="rounded-btn border border-line bg-surface p-2 text-ink" aria-label="Centrar el universo" onClick={centerView}><Crosshair size={17} /></button>
      </div>
    </div>
    <p className="text-sm text-ink2">Inglés dentro del cinturón · Castellano fuera. Cada órbita representa un año; cada planeta, una lectura terminada. Arrastra el fondo para moverte y toca un planeta para abrir el libro.</p>
    {visibleReadings.length === 0 ? <div className={cx(cardCls, 'p-8 text-center text-ink2')}><Sparkles className="mx-auto mb-3 text-accent" /><p>{filtersActive ? 'No hay planetas para los filtros seleccionados.' : 'Tu universo está esperando lecturas terminadas en inglés o castellano con año conocido.'}</p></div> :
      <div ref={viewport} className={cx('space-viewport', dragging && 'space-viewport--dragging')} aria-label="Sistema solar de lecturas" tabIndex={0}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          // En pantallas táctiles dejamos el desplazamiento nativo del navegador.
          if (event.pointerType === 'touch' || event.button !== 0 || (event.target as Element).closest('button, a, input, select')) return;
          const node = event.currentTarget;
          const rect = node.getBoundingClientRect();
          if (event.clientX >= rect.left + node.clientWidth || event.clientY >= rect.top + node.clientHeight) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop };
          node.setPointerCapture?.(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x);
          event.currentTarget.scrollTop = drag.current.top - (event.clientY - drag.current.y);
        }}
        onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      >
        <div style={{ width: size * zoom, height: size * zoom, position: 'relative' }}>
          <div className="space-universe" style={{ width: size, height: size, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            {stars.map((star, i) => <span key={i} aria-hidden className="space-star" style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }} />)}
            <svg className="space-orbits" width={size} height={size} aria-hidden="true">
              {[...orbits.inner, ...orbits.outer].map((orbit) => <g key={`${orbit.language}-${orbit.year}`}><circle cx={center} cy={center} r={orbit.radius} fill="none" stroke="rgba(172,202,255,.28)" strokeWidth="1" /><text x={center} y={center - orbit.radius - 7} textAnchor="middle" fill="#bdc9e0" fontSize="13" fontWeight="700">{orbit.year}</text></g>)}
              {asteroids.map((asteroid, index) => <circle key={index} cx={asteroid.x} cy={asteroid.y} r={asteroid.r} fill={index % 3 === 0 ? '#d3a979' : '#7892b1'} opacity={0.4 + (index % 4) * 0.13} />)}
            </svg>
            <div className="space-sun" style={{ left: center, top: center }} aria-hidden="true"><span>✦</span></div>
            {[...orbits.inner, ...orbits.outer].flatMap((orbit) => orbit.planets.map((entry, index) => {
              const angle = -Math.PI / 2 + (Math.PI * 2 * (index + 0.5)) / Math.max(orbit.planets.length, 1) + (orbit.year % 7) * 0.17;
              const left = center + Math.cos(angle) * orbit.radius;
              const top = center + Math.sin(angle) * orbit.radius;
              return <button type="button" key={entry.key} className={`space-planet space-planet--${planetStyle}`} style={{ left, top }} onClick={() => onOpen(entry.book)} title={`${entry.reading.title} · ${entry.year} · ${entry.language === 'en' ? 'Inglés' : 'Castellano'}`} aria-label={`Abrir ${entry.reading.title}, ${entry.language === 'en' ? 'inglés' : 'castellano'}, ${entry.year}`}>
                <span className="space-planet-cover"><BookCover title={entry.book.title} author={entry.book.author} coverUrl={entry.book.coverUrl} detail="sm" className="h-full w-full" /></span>
              </button>;
            }))}
          </div>
        </div>
      </div>}
    {(fromYear || toYear) && data.withoutYear.length > 0 && <p className="text-xs text-ink3">Las lecturas sin año conocido no se incluyen al filtrar por fechas.</p>}
    {(withoutYear.length > 0 || otherLanguages.length > 0) && <div className={cx(cardCls, 'space-y-3 p-4')}>
      <h3 className="font-display text-lg font-semibold text-ink">Lecturas fuera de las órbitas</h3>
      {withoutYear.length > 0 && <ReadingList title="Sin año de finalización" readings={withoutYear} onOpen={(book) => onOpen(original(book))} />}
      {otherLanguages.length > 0 && <ReadingList title="Otros idiomas o idioma sin especificar" readings={otherLanguages} onOpen={(book) => onOpen(original(book))} />}
      <p className="text-xs text-ink3">Edita el libro para completar su idioma o su fecha de lectura. No se inventan años ni idiomas.</p>
    </div>}
  </section>;
}

function ReadingList({ title, readings, onOpen }: { title: string; readings: Book[]; onOpen: (book: Book) => void }) {
  return <div><p className="text-xs font-bold text-ink3">{title} · {readings.length}</p><div className="mt-2 flex flex-wrap gap-2">{readings.map((book, index) => <button key={`${book.id}-${index}`} type="button" className="rounded-full border border-line bg-sunken px-3 py-1.5 text-xs font-semibold text-ink hover:text-accent" onClick={() => onOpen(book)}>{book.title}{book.finishedAt ? ` · ${formatReadingDate(book)}` : ''}</button>)}</div></div>;
}
