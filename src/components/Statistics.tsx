import { useMemo, useState } from 'react';
import { BookOpen, FileText, Star, Calendar } from 'lucide-react';
import type { Book } from '../types';
import { BarChart, DonutChart, HBarChart } from './Charts';

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#64748b'];
const PAGE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];
const FORMAT_COLORS = ['#f59e0b', '#3b82f6', '#10b981'];
const LANG_COLORS = ['#ef4444', '#3b82f6'];
const RATING_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#3b82f6'];

const MONTHS = [
  { value: 0, label: 'Ene' }, { value: 1, label: 'Feb' }, { value: 2, label: 'Mar' },
  { value: 3, label: 'Abr' }, { value: 4, label: 'May' }, { value: 5, label: 'Jun' },
  { value: 6, label: 'Jul' }, { value: 7, label: 'Ago' }, { value: 8, label: 'Sep' },
  { value: 9, label: 'Oct' }, { value: 10, label: 'Nov' }, { value: 11, label: 'Dic' },
];

interface Props {
  books: Book[];
}

export function Statistics({ books }: Props) {
  const [filterMode, setFilterMode] = useState<'all' | 'month'>('all');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const allRead = useMemo(() => books.filter((b) => b.status === 'read'), [books]);

  const readBooks = useMemo(() => {
    if (filterMode === 'all') return allRead;
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
      .map(([label, value], i) => ({ label, value, color: TAG_COLORS[i % TAG_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    const pageRanges = [
      { label: '0-250', value: 0 },
      { label: '251-400', value: 0 },
      { label: '401-600', value: 0 },
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
    const formatData = Array.from(formatMap.entries())
      .map(([label, value], i) => ({ label, value, color: FORMAT_COLORS[i] }));

    const authorMap = new Map<string, number>();
    readBooks.forEach((b) => { if (b.author) authorMap.set(b.author, (authorMap.get(b.author) || 0) + 1); });
    const authorData = Array.from(authorMap.entries())
      .map(([label, value]) => ({ label, value, color: '#6366f1' }))
      .sort((a, b) => b.value - a.value);

    const langMap = new Map<string, number>();
    readBooks.forEach((b) => {
      const key = b.language === 'es' ? 'Español' : 'Inglés';
      langMap.set(key, (langMap.get(key) || 0) + 1);
    });
    const langData = Array.from(langMap.entries())
      .map(([label, value], i) => ({ label, value, color: LANG_COLORS[i] }));

    const ratingBuckets = Array.from({ length: 11 }, (_, i) => ({ label: i % 2 === 0 ? String(i / 2) : String(i / 2), value: 0 }));
    readBooks.forEach((b) => {
      const idx = Math.round(b.rating * 2);
      if (idx >= 0 && idx <= 10) ratingBuckets[idx].value++;
    });

    // Monthly chart for the selected year
    const monthly = MONTHS.map((m) => ({ label: m.label, value: 0, month: m.value }));
    allRead.forEach((b) => {
      if (!b.finishedAt) return;
      const d = new Date(b.finishedAt);
      if (d.getFullYear() === year) monthly[d.getMonth()].value++;
    });

    return { totalPages, totalBooks, tagData, pageRanges, formatData, authorData, langData, ratingBuckets, monthly };
  }, [readBooks, allRead, year]);

  const avgRating = readBooks.filter((b) => b.rating > 0).length
    ? (readBooks.reduce((s, b) => s + b.rating, 0) / readBooks.filter((b) => b.rating > 0).length).toFixed(1)
    : '—';

  if (allRead.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <BookOpen size={28} className="text-gray-300 dark:text-gray-600" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Aún no has terminado ningún libro</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Las estadísticas aparecerán cuando completes lecturas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Period filter */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3.5 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-gray-400" />
          <div className="flex gap-1.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterMode === 'all' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
            >
              Global
            </button>
            <button
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterMode === 'month' ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
            >
              Por mes
            </button>
          </div>
          {filterMode !== 'all' && (
            <>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 outline-none border border-gray-100 dark:border-gray-700"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </>
          )}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 outline-none border border-gray-100 dark:border-gray-700 ml-auto"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard icon={BookOpen} label="Libros leídos" value={stats.totalBooks} />
        <MetricCard icon={FileText} label="Páginas leídas" value={stats.totalPages.toLocaleString('es')} />
        <MetricCard icon={Star} label="Nota media" value={avgRating} />
      </div>

      {/* Monthly chart for selected year */}
      <Card title="Libros por mes" subtitle={`Año ${year}`}>
        <BarChart data={stats.monthly} height={140} />
      </Card>

      {/* Tags */}
      <Card title="Géneros / Tags" subtitle="Distribución por tags personalizados">
        {stats.tagData.length > 0 ? (
          <DonutChart data={stats.tagData} centerLabel="tags" centerValue={stats.tagData.length.toString()} />
        ) : <EmptyChart />}
      </Card>

      {/* Page ranges */}
      <Card title="Páginas por rango" subtitle="Distribución de extensión">
        <BarChart
          data={stats.pageRanges.map((p, i) => ({ ...p, color: `linear-gradient(180deg, ${PAGE_COLORS[i]}, ${PAGE_COLORS[i]}cc)` }))}
          height={140}
        />
      </Card>

      {/* Format + Language */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Formato" subtitle="Físico vs Ebook">
          {stats.formatData.length > 0 ? (
            <DonutChart data={stats.formatData} size={120} centerLabel="libros" />
          ) : <EmptyChart />}
        </Card>
        <Card title="Idioma" subtitle="Español vs Inglés">
          {stats.langData.length > 0 ? (
            <DonutChart data={stats.langData} size={120} centerLabel="libros" />
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Authors */}
      <Card title="Libros por autor" subtitle="Top 10 autores más leídos">
        <HBarChart data={stats.authorData} />
      </Card>

      {/* Rating distribution */}
      <Card title="Distribución de puntuaciones" subtitle="De 0 a 5 estrellas (con medias)">
        <BarChart data={stats.ratingBuckets.map((r, i) => ({ ...r, color: RATING_COLORS[Math.min(Math.floor(i / 2), 5)] }))} height={120} />
      </Card>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 flex flex-col items-center text-center">
      <Icon size={16} className="text-gray-300 dark:text-gray-600 mb-1.5" />
      <span className="text-xl font-bold text-gray-900 dark:text-white leading-none">{value}</span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{label}</span>
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>;
}
