import { useMemo, useState } from 'react';
import { BookOpen, FileText, Star, Globe, BarChart3 } from 'lucide-react';
import type { Book } from '../types';
import { BarChart, DonutChart, HBarChart } from './Charts';
import { EmptyState, cardCls, cx, selectCls } from './ui';

// Colores desde los tokens del tema: los gráficos se tiñen solos al cambiar de tema
const CH = (n: number) => `rgb(var(--chart-${n}))`;
const PALETTE = [CH(1), CH(2), CH(3), CH(4), CH(5), CH(6)];

const MONTHS = [
  { value: 0, label: 'Ene' }, { value: 1, label: 'Feb' }, { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' }, { value: 4, label: 'May' }, { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' }, { value: 7, label: 'Ago' }, { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' }, { value: 10, label: 'Nov' }, { value: 11, label: 'Dic' },
];

type FilterMode = 'global' | 'year' | 'month';

interface Props {
  books: Book[];
}

export function Statistics({ books }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('global');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const allRead = useMemo(() => books.filter((b) => b.status === 'read'), [books]);

  // Libros del periodo elegido (todo excepto el gráfico mensual)
  const readBooks = useMemo(() => {
    if (filterMode === 'global') return allRead;
    return allRead.filter((b) => {
      if (!b.finishedAt) return false;
      const d = new Date(b.finishedAt);
      if (d.getFullYear() !== year) return false;
      if (filterMode === 'month' && d.getMonth() !== month) return false;
      return true;
    });
  }, [allRead, filterMode, year, month]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRead.forEach((b) => { if (b.finishedAt) years.add(new Date(b.finishedAt).getFullYear()); });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [allRead]);

  const stats = useMemo(() => {
    const totalPages = readBooks.reduce((s, b) => s + b.pages, 0);
    const totalBooks = readBooks.length;

    const tagMap = new Map<string, number>();
    readBooks.forEach((b) => b.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
    const tagData = Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

    const pageRanges = [
      { label: '0–250', value: 0 },
      { label: '251–400', value: 0 },
      { label: '401–600', value: 0 },
      { label: '601+', value: 0 },
    ];
    readBooks.forEach((b) => {
      if (b.pages <= 250) pageRanges[0].value++;
      else if (b.pages <= 400) pageRanges[1].value++;
      else if (b.pages <= 600) pageRanges[2].value++;
      else pageRanges[3].value++;
    });

    const formatMap = new Map<string, number>();
    readBooks.forEach((b) => {
      const key = b.format === 'hardcover' ? 'Tapa dura' : b.format === 'ebook' ? 'Ebook' : 'Tapa blanda';
      formatMap.set(key, (formatMap.get(key) || 0) + 1);
    });
    const formatOrder = ['Tapa dura', 'Tapa blanda', 'Ebook'];
    const formatData = Array.from(formatMap.entries())
      .sort((a, b) => formatOrder.indexOf(a[0]) - formatOrder.indexOf(b[0]))
      .map(([label, value]) => ({ label, value, color: CH(formatOrder.indexOf(label) + 1) }));

    const authorMap = new Map<string, number>();
    readBooks.forEach((b) => { if (b.author) authorMap.set(b.author, (authorMap.get(b.author) || 0) + 1); });
    const authorData = Array.from(authorMap.entries())
      .map(([label, value], i) => ({ label, value, color: `linear-gradient(90deg, rgb(var(--chart-${(i % 4) + 1}) / 0.7), rgb(var(--chart-${(i % 4) + 1})))` }))
      .sort((a, b) => b.value - a.value);

    const langMap = new Map<string, number>();
    readBooks.forEach((b) => {
      const key = b.language === 'es' ? 'Español' : 'Inglés';
      langMap.set(key, (langMap.get(key) || 0) + 1);
    });
    const langData = Array.from(langMap.entries())
      .map(([label, value]) => ({ label, value, color: label === 'Español' ? CH(1) : CH(4) }));

    const ratingBuckets = Array.from({ length: 11 }, (_, i) => ({ label: String(i / 2), value: 0 }));
    readBooks.forEach((b) => {
      const idx = Math.round(b.rating * 2);
      if (idx >= 0 && idx <= 10) ratingBuckets[idx].value++;
    });

    // Mensual: siempre los 12 meses del año seleccionado
    const monthly = MONTHS.map((m) => ({ label: m.label, value: 0, month: m.value }));
    allRead.forEach((b) => {
      if (!b.finishedAt) return;
      const d = new Date(b.finishedAt);
      if (d.getFullYear() === year) monthly[d.getMonth()].value++;
    });

    // Diario: días 1..31 del mes seleccionado
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daily = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), value: 0 }));
    if (filterMode === 'month') {
      allRead.forEach((b) => {
        if (!b.finishedAt) return;
        const d = new Date(b.finishedAt);
        if (d.getFullYear() === year && d.getMonth() === month) daily[d.getDate() - 1].value++;
      });
    }

    return { totalPages, totalBooks, tagData, pageRanges, formatData, authorData, langData, ratingBuckets, monthly, daily };
  }, [readBooks, allRead, year, month, filterMode]);

  const rated = readBooks.filter((b) => b.rating > 0);
  const avgRating = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '—';

  const periodLabel =
    filterMode === 'global' ? 'Histórico' : filterMode === 'year' ? `Año ${year}` : `${MONTHS[month].label} ${year}`;

  if (allRead.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={26} />}
        title="Aún no has terminado ningún libro"
        description="En cuanto completes tu primera lectura verás aquí tus páginas, géneros, autores y ritmos por mes."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Filtro de periodo: control segmentado */}
      <div className={cx(cardCls, 'p-2.5 flex flex-wrap items-center gap-2')}>
        <div className="flex bg-sunken rounded-full p-1 gap-0.5">
          <SegBtn active={filterMode === 'global'} onClick={() => setFilterMode('global')}>
            <Globe size={13} /> Global
          </SegBtn>
          <SegBtn active={filterMode === 'year'} onClick={() => setFilterMode('year')}>Por año</SegBtn>
          <SegBtn active={filterMode === 'month'} onClick={() => setFilterMode('month')}>Por mes</SegBtn>
        </div>
        <div className="flex gap-2 ml-auto">
          {filterMode === 'month' && (
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={cx(selectCls, 'py-1.5 text-xs rounded-full')} aria-label="Mes">
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          {filterMode !== 'global' && (
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={cx(selectCls, 'py-1.5 text-xs rounded-full')} aria-label="Año">
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-3 gap-3 stagger">
        <MetricCard icon={<BookOpen size={16} />} label="Libros leídos" value={stats.totalBooks} />
        <MetricCard icon={<FileText size={16} />} label="Páginas leídas" value={stats.totalPages.toLocaleString('es')} />
        <MetricCard icon={<Star size={16} />} label="Nota media" value={avgRating} />
      </div>

      {filterMode === 'month' ? (
        <Card title="Libros por día" subtitle={`${MONTHS[month].label} ${year}`}>
          <BarChart data={stats.daily} height={150} />
        </Card>
      ) : (
        <Card title="Libros por mes" subtitle={`Año ${year}`}>
          <BarChart data={stats.monthly} height={150} />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card title="Géneros y tags" subtitle={`Distribución · ${periodLabel}`}>
          {stats.tagData.length > 0 ? (
            <DonutChart data={stats.tagData} centerLabel="tags" centerValue={stats.tagData.length.toString()} />
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card title="Extensión de los libros" subtitle={`Páginas por rango · ${periodLabel}`}>
          <BarChart
            data={stats.pageRanges.map((p, i) => ({
              ...p,
              color: `linear-gradient(180deg, rgb(var(--chart-${i + 1})), rgb(var(--chart-${i + 1}) / 0.55))`,
            }))}
            height={150}
          />
        </Card>

        <Card title="Formato" subtitle={`Físico vs ebook · ${periodLabel}`}>
          {stats.formatData.length > 0 ? <DonutChart data={stats.formatData} size={124} centerLabel="libros" /> : <EmptyChart />}
        </Card>

        <Card title="Idioma" subtitle={`Español vs inglés · ${periodLabel}`}>
          {stats.langData.length > 0 ? <DonutChart data={stats.langData} size={124} centerLabel="libros" /> : <EmptyChart />}
        </Card>
      </div>

      <Card title="Autores más leídos" subtitle={`Top 10 · ${periodLabel}`}>
        <HBarChart data={stats.authorData} />
      </Card>

      <Card title="Distribución de puntuaciones" subtitle={`De 0 a 5 estrellas · ${periodLabel}`}>
        <BarChart
          data={stats.ratingBuckets.map((r, i) => ({
            ...r,
            color: `linear-gradient(180deg, rgb(var(--gold)), rgb(var(--gold) / ${0.45 + (i / 10) * 0.5}))`,
          }))}
          height={130}
        />
      </Card>
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95',
        active ? 'bg-primary text-onprimary shadow-card' : 'text-ink2 hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={cx(cardCls, 'p-4 sm:p-5')}>
      <header className="mb-4">
        <h3 className="font-display font-semibold text-ink text-base">{title}</h3>
        {subtitle && <p className="text-xs text-ink3 mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className={cx(cardCls, 'p-4 flex flex-col items-center text-center')}>
      <span className="w-8 h-8 rounded-btn bg-accent/10 text-accent flex items-center justify-center mb-2">{icon}</span>
      <span className="font-display text-2xl font-semibold text-ink leading-none tabular-nums">{value}</span>
      <span className="text-[11px] font-medium text-ink3 mt-1.5">{label}</span>
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-ink3 text-center py-8">Sin datos en este periodo</p>;
}
