import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import type { Book } from '../types';
import { buildWrapUp, wrapUpYears, type WrapPeriod } from '../wrapUp';
import { btnPrimary, cardCls, selectCls } from './ui';

const themes = {
  azul: { label: 'Azul noche', background: '#101f35', panel: '#1c304b', ink: '#f5f7fb', muted: '#adbed1', accent: '#86c9ec' },
  crema: { label: 'Crema', background: '#f7f0e5', panel: '#e9dccc', ink: '#392f32', muted: '#786b66', accent: '#a35446' },
  bosque: { label: 'Bosque', background: '#1d3530', panel: '#2c4840', ink: '#f6f4e9', muted: '#b7cbbd', accent: '#c8dc98' },
} as const;
type Theme = keyof typeof themes;
type Summary = ReturnType<typeof buildWrapUp>;
const number = (n: number) => n.toLocaleString('es');

function coverImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    const image = new Image();
    // Las imágenes externas sin CORS se omiten para no bloquear la descarga.
    image.crossOrigin = 'anonymous';
    let done = false;
    const finish = (value: HTMLImageElement | null) => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
    const timer = window.setTimeout(() => finish(null), 8000);
    image.onload = () => finish(image); image.onerror = () => finish(null); image.src = url;
  });
}

function textFit(ctx: CanvasRenderingContext2D, value: string, max: number): string {
  if (ctx.measureText(value).width <= max) return value;
  let text = value;
  while (text.length && ctx.measureText(`${text}…`).width > max) text = text.slice(0, -1);
  return `${text}…`;
}

async function drawWrapUp(canvas: HTMLCanvasElement, summary: Summary, period: WrapPeriod, theme: Theme): Promise<number> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no permite generar la imagen.');
  const palette = themes[theme]; const { background, panel, ink, muted, accent } = palette;
  canvas.width = 1080; canvas.height = 1350;
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = panel; ctx.beginPath(); ctx.arc(1050, 60, 220, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = accent; ctx.font = '700 24px sans-serif'; ctx.fillText('BILIBOOK  /  MI DIARIO DE LECTURA', 72, 82);
  ctx.fillStyle = ink; ctx.font = '700 70px Georgia, serif'; ctx.fillText('Mi wrap-up', 72, 170);
  const label = period.month === null ? String(period.year) : new Date(period.year, period.month, 1, 12).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  ctx.fillStyle = accent; ctx.font = '600 36px sans-serif'; ctx.fillText(label.toLocaleUpperCase('es'), 75, 226);
  const stats = [[number(summary.readings.length), 'LECTURAS TERMINADAS'], [number(summary.journalPages), 'PÁGINAS EN EL DIARIO'], [number(summary.authors), 'AUTORES'], [summary.averageRating === null ? '—' : `${summary.averageRating.toFixed(1).replace('.', ',')} / 5`, 'NOTA MEDIA']];
  stats.forEach(([value, title], index) => {
    const x = 72 + (index % 2) * 476; const y = 276 + Math.floor(index / 2) * 135;
    ctx.fillStyle = panel; ctx.fillRect(x, y, 452, 112);
    ctx.fillStyle = ink; ctx.font = '700 47px sans-serif'; ctx.fillText(value, x + 25, y + 55);
    ctx.fillStyle = muted; ctx.font = '700 18px sans-serif'; ctx.fillText(title, x + 25, y + 88);
  });
  ctx.fillStyle = ink; ctx.font = '700 32px Georgia, serif'; ctx.fillText('Las historias del periodo', 72, 608);
  const covers = summary.covers.slice(0, 8);
  const images = await Promise.all(covers.map(book => coverImage(book.coverUrl)));
  const missing = covers.filter((book, i) => book.coverUrl && !images[i]).length;
  if (!covers.length) { ctx.fillStyle = muted; ctx.font = '26px sans-serif'; ctx.fillText('Aún no hay lecturas terminadas en este periodo.', 72, 692); }
  covers.forEach((book, i) => {
    const x = 72 + (i % 4) * 237; const y = 650 + Math.floor(i / 4) * 268; const image = images[i];
    ctx.fillStyle = panel; ctx.fillRect(x, y, 178, 216);
    if (image) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, 178, 216); ctx.clip();
      const scale = Math.max(178 / image.width, 216 / image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image, x + (178-w)/2, y + (216-h)/2, w, h); ctx.restore();
    } else {
      ctx.fillStyle = accent; ctx.font = '700 24px Georgia, serif'; ctx.fillText('✦', x + 20, y + 40);
      ctx.fillStyle = ink; ctx.font = '600 18px sans-serif'; ctx.fillText(textFit(ctx, book.title, 150), x + 14, y + 113);
    }
    ctx.fillStyle = ink; ctx.font = '600 18px sans-serif'; ctx.fillText(textFit(ctx, book.title, 185), x, y + 244);
  });
  if (summary.covers.length > 8) { ctx.fillStyle = muted; ctx.font = '22px sans-serif'; ctx.fillText(`+ ${summary.covers.length - 8} títulos más`, 72, 1215); }
  ctx.fillStyle = muted; ctx.font = '20px sans-serif'; ctx.fillText('Hecho con Bilibook  ·  Cada lectura cuenta', 72, 1304);
  return missing;
}

export function WrapUp({ books }: { books: Book[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState(now.getMonth());
  const [theme, setTheme] = useState<Theme>('azul');
  const [ready, setReady] = useState(false); const [missing, setMissing] = useState(0); const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const years = useMemo(() => wrapUpYears(books), [books]);
  const period = useMemo(() => ({ year, month: mode === 'month' ? month : null }), [year, month, mode]);
  const summary = useMemo(() => buildWrapUp(books, period), [books, period]);
  useEffect(() => {
    let cancelled = false;
    setReady(false); setError(''); setMissing(0);
    const canvas = document.createElement('canvas');
    drawWrapUp(canvas, summary, period, theme).then(count => {
      if (cancelled || !canvasRef.current) return;
      const target = canvasRef.current; target.width = canvas.width; target.height = canvas.height;
      const context = target.getContext('2d'); if (!context) throw new Error('Tu navegador no permite generar la imagen.');
      context.drawImage(canvas, 0, 0); setMissing(count); setReady(true);
    }).catch(() => { if (!cancelled) setError('No se pudo generar la imagen. Prueba de nuevo en otro navegador.'); });
    return () => { cancelled = true; };
  }, [summary, period, theme]);
  const download = () => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) { setError('No se pudo descargar la imagen.'); return; }
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
      link.download = `bilibook-wrap-up-${year}${mode === 'month' ? `-${String(month + 1).padStart(2, '0')}` : ''}.png`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }, 'image/png');
  };
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
    <section className={`${cardCls} p-5 sm:p-6 space-y-5`}>
      <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Tus lecturas en una imagen</p><h3 className="font-display text-2xl font-semibold text-ink mt-1">Crea tu wrap-up</h3><p className="text-sm text-ink2 mt-2">Elige el periodo y descarga un resumen para guardar o compartir.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-ink2">Periodo<select className={`${selectCls} w-full mt-1`} value={mode} onChange={e => setMode(e.target.value as 'month' | 'year')}><option value="month">Mensual</option><option value="year">Anual</option></select></label>
        <label className="text-sm font-semibold text-ink2">Año<select className={`${selectCls} w-full mt-1`} value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        {mode === 'month' && <label className="text-sm font-semibold text-ink2">Mes<select className={`${selectCls} w-full mt-1`} value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2024, i, 1).toLocaleDateString('es', { month: 'long' })}</option>)}</select></label>}
        <label className="text-sm font-semibold text-ink2">Estilo<select className={`${selectCls} w-full mt-1`} value={theme} onChange={e => setTheme(e.target.value as Theme)}>{Object.entries(themes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      </div>
      <button type="button" className={`${btnPrimary} w-full sm:w-auto`} disabled={!ready} onClick={download}><Download size={17} /> Descargar imagen PNG</button>
      <p className="text-xs leading-relaxed text-ink3">Incluye lecturas terminadas, relecturas, páginas registradas en el diario, autores y valoración media. Las fechas solo conocidas por año no se asignan a un mes. Se muestran hasta ocho portadas distintas.</p>
      {missing > 0 && <p role="status" className="text-xs text-ink2">{missing} {missing === 1 ? 'portada no está disponible' : 'portadas no están disponibles'} para la imagen; se muestra su título.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
    <section className={`${cardCls} p-4 sm:p-5`} aria-label="Vista previa del wrap-up"><div className="flex items-center gap-2 text-sm font-semibold text-ink2 mb-3"><Sparkles size={16} /> Vista previa</div><canvas ref={canvasRef} role="img" aria-label={`Resumen de lectura de ${period.month === null ? period.year : `${month + 1}/${year}`}: ${summary.readings.length} lecturas terminadas y ${summary.journalPages} páginas del diario`} className="block w-full rounded-lg shadow-card" />{!ready && !error && <p role="status" className="text-sm text-ink3 mt-2">Preparando imagen…</p>}</section>
  </div>;
}
