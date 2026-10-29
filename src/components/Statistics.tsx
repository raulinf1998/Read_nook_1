import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  AreaChart,
  BarChart3,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  Flame,
  Globe,
  LineChart,
  PieChart,
  Rows3,
  Star,
} from 'lucide-react';
import type { Book } from '../types';
import { FORMAT_META, formatLabel, languageLabel } from '../types';
import type { ChartPreferences } from '../preferences';
import { completedReadings } from '../rereads';
import { BarChart, DonutChart, HBarChart, TrendChart } from './Charts';
import { EmptyState, BookCover, btnGhost, cardCls, cx, selectCls } from './ui';
import { StatisticCategoryIcon } from './StatisticCategoryIcon';
import { formatReadingDate } from '../readingDate';

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
type TrendChartType = 'bars' | 'line' | 'area';
type RankingChartType = 'horizontal' | 'columns' | 'donut';
type DistributionChartType = 'donut' | 'horizontal' | 'columns';

interface Props {
  books: Book[];
  onOpen: (book: Book) => void;
  chartPreferences: ChartPreferences;
  onSetChartPreference: <K extends keyof ChartPreferences>(key: K, value: ChartPreferences[K]) => void;
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daySerial(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function calculateStreaks(activeDays: Set<string>): { longest: number; current: number } {
  if (!activeDays.size) return { longest: 0, current: 0 };
  const serials = new Set([...activeDays].map(daySerial));
  const sorted = [...serials].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = daySerial(localDateKey(Date.now()));
  let cursor = serials.has(today) ? today : today - 1;
  let current = 0;
  while (serials.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { longest, current };
}

export function Statistics({ books, onOpen, chartPreferences, onSetChartPreference: setChartPreference }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('global');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [detail, setDetail] = useState<{ type: 'language' | 'tag' | 'format'; label: string } | null>(null);

  // Cada finalización es una lectura: las anteriores siguen contando incluso
  // mientras el mismo libro está en curso de relectura.
  const allRead = useMemo(() => books.flatMap(completedReadings), [books]);

  // Libros del periodo elegido (todo excepto el gráfico mensual)
  const readBooks = useMemo(() => {
    if (filterMode === 'global') return allRead;
    return allRead.filter((b) => {
      if (!b.finishedAt) return false;
      const d = new Date(b.finishedAt);
      if (d.getFullYear() !== year) return false;
      if (filterMode === 'month' && (b.finishedAtPrecision === 'year' || d.getMonth() !== month)) return false;
      return true;
    });
  }, [allRead, filterMode, year, month]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allRead.forEach((b) => { if (b.finishedAt) years.add(new Date(b.finishedAt).getFullYear()); });
    books.forEach((book) => {
      (book.journal || []).forEach((entry) => {
        if (Number.isFinite(entry.date)) years.add(new Date(entry.date).getFullYear());
      });
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [allRead, books]);

  const allJournalSessions = useMemo(
    () => books.flatMap((book) => (book.journal || [])
      .filter((entry) => Number.isFinite(entry.date) && ((entry.pages || 0) > 0 || (entry.minutes || 0) > 0))
      .map((entry) => ({ book, entry }))),
    [books],
  );

  const currentStreak = useMemo(
    () => calculateStreaks(new Set(allJournalSessions.map(({ entry }) => localDateKey(entry.date)))).current,
    [allJournalSessions],
  );

  const journalActivity = useMemo(() => {
    const inPeriod = allJournalSessions.filter(({ entry }) => {
      if (filterMode === 'global') return true;
      const date = new Date(entry.date);
      if (date.getFullYear() !== year) return false;
      return filterMode === 'year' || date.getMonth() === month;
    });

    const pagesByDay = new Map<string, number>();
    const pagesByBook = new Map<string, { label: string; value: number; sessions: number }>();
    let totalPages = 0;
    let totalMinutes = 0;

    for (const { book, entry } of inPeriod) {
      const pages = Math.max(0, entry.pages || 0);
      totalPages += pages;
      totalMinutes += Math.max(0, entry.minutes || 0);
      const key = localDateKey(entry.date);
      pagesByDay.set(key, (pagesByDay.get(key) || 0) + pages);
      const currentBook = pagesByBook.get(book.id) || { label: book.title, value: 0, sessions: 0 };
      currentBook.value += pages;
      currentBook.sessions += 1;
      pagesByBook.set(book.id, currentBook);
    }

    const activeDays = new Set(pagesByDay.keys());
    const bestDay = [...pagesByDay.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

    let timeline: { label: string; value: number }[];
    let timelineLabel: string;
    if (filterMode === 'month') {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      timeline = Array.from({ length: daysInMonth }, (_, index) => {
        const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
        return { label: String(index + 1), value: pagesByDay.get(key) || 0 };
      });
      timelineLabel = 'Páginas por día';
    } else if (filterMode === 'year') {
      timeline = MONTHS.map((item) => ({ label: item.label, value: 0 }));
      for (const { entry } of inPeriod) {
        timeline[new Date(entry.date).getMonth()].value += Math.max(0, entry.pages || 0);
      }
      timelineLabel = 'Páginas por mes';
    } else {
      const byYear = new Map<number, number>();
      for (const { entry } of inPeriod) {
        const entryYear = new Date(entry.date).getFullYear();
        byYear.set(entryYear, (byYear.get(entryYear) || 0) + Math.max(0, entry.pages || 0));
      }
      timeline = [...byYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(-12)
        .map(([entryYear, value]) => ({ label: String(entryYear), value }));
      timelineLabel = 'Páginas por año';
    }

    const topBooks = [...pagesByBook.values()]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || b.sessions - a.sessions)
      .slice(0, 8)
      .map((item, index) => ({
        ...item,
        color: `linear-gradient(90deg, rgb(var(--chart-${(index % 4) + 1}) / 0.7), rgb(var(--chart-${(index % 4) + 1})))`,
      }));

    return {
      sessions: inPeriod.length,
      totalPages,
      totalMinutes,
      activeDays: activeDays.size,
      averagePerActiveDay: activeDays.size ? totalPages / activeDays.size : 0,
      booksWithActivity: pagesByBook.size,
      bestDay: bestDay ? { date: bestDay[0], pages: bestDay[1] } : null,
      longestStreak: calculateStreaks(activeDays).longest,
      timeline,
      timelineLabel,
      topBooks,
    };
  }, [allJournalSessions, filterMode, month, year]);

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
      const key = formatLabel(b.format);
      formatMap.set(key, (formatMap.get(key) || 0) + 1);
    });
    const formatOrder = Object.values(FORMAT_META).map((meta) => meta.label);
    const formatData = Array.from(formatMap.entries())
      .sort((a, b) => formatOrder.indexOf(a[0]) - formatOrder.indexOf(b[0]))
      .map(([label, value], index) => ({ label, value, color: PALETTE[index % PALETTE.length] }));

    const authorMap = new Map<string, number>();
    readBooks.forEach((b) => { if (b.author) authorMap.set(b.author, (authorMap.get(b.author) || 0) + 1); });
    const authorData = Array.from(authorMap.entries())
      .map(([label, value], i) => ({ label, value, color: `linear-gradient(90deg, rgb(var(--chart-${(i % 4) + 1}) / 0.7), rgb(var(--chart-${(i % 4) + 1})))` }))
      .sort((a, b) => b.value - a.value);

    const langMap = new Map<string, number>();
    readBooks.forEach((b) => {
      const key = languageLabel(b.language);
      langMap.set(key, (langMap.get(key) || 0) + 1);
    });
    const langData = Array.from(langMap.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([label, value], index) => ({ label, value, color: PALETTE[index % PALETTE.length] }));

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
      if (d.getFullYear() === year && b.finishedAtPrecision !== 'year') monthly[d.getMonth()].value++;
    });

    // Diario: días 1..31 del mes seleccionado
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daily = Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), value: 0 }));
    if (filterMode === 'month') {
      allRead.forEach((b) => {
        if (!b.finishedAt) return;
        const d = new Date(b.finishedAt);
        if (d.getFullYear() === year && d.getMonth() === month && b.finishedAtPrecision !== 'year' && b.finishedAtPrecision !== 'month') daily[d.getDate() - 1].value++;
      });
    }

    return { totalPages, totalBooks, tagData, pageRanges, formatData, authorData, langData, ratingBuckets, monthly, daily };
  }, [readBooks, allRead, year, month, filterMode]);

  const rated = readBooks.filter((b) => b.rating > 0);
  const avgRating = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '—';

  const periodLabel =
    filterMode === 'global' ? 'Histórico' : filterMode === 'year' ? `Año ${year}` : `${MONTHS[month].label} ${year}`;

  const renderTrendChart = (
    data: { label: string; value: number; color?: string }[],
    chartType: TrendChartType,
    height = 150,
    formatValue?: (value: number) => string,
    color = CH(1),
  ) => (
    chartType === 'bars'
      ? <BarChart data={data} height={height} formatValue={formatValue} />
      : (
        <TrendChart
          data={data}
          height={height}
          formatValue={formatValue}
          variant={chartType}
          color={color}
        />
      )
  );

  const withSolidColors = <T extends { label: string; value: number; color?: string }>(data: T[]) => data.map((item, index) => ({
    ...item,
    color: PALETTE[index % PALETTE.length],
  }));

  const renderRankingChart = (
    data: { label: string; value: number; color?: string }[],
    chartType: RankingChartType,
    formatValue?: (value: number) => string,
    maxItems = 10,
    centerLabel = 'en el top',
  ) => {
    const shown = data.slice(0, maxItems);
    const solid = withSolidColors(shown);
    if (chartType === 'donut') {
      return (
        <DonutChart
          data={solid}
          centerLabel={centerLabel}
          centerValue={shown.reduce((sum, item) => sum + item.value, 0).toLocaleString('es')}
        />
      );
    }
    if (chartType === 'columns') {
      return <BarChart data={solid} height={165} formatValue={formatValue} />;
    }
    return <HBarChart data={data} formatValue={formatValue} maxItems={maxItems} />;
  };

  const renderDistributionChart = (
    data: { label: string; value: number; color: string }[],
    chartType: DistributionChartType,
    centerLabel: string,
    centerValue?: string,
    size = 140,
    type?: 'language' | 'tag' | 'format',
  ) => {
    const onSelect = type ? (label: string) => { setDetail({ type, label }); window.scrollTo({ top: 0 }); } : undefined;
    const renderLabel = type && type !== 'language' ? (label: string) => <><StatisticCategoryIcon type={type} label={label} /> <span>{label}</span></> : undefined;
    if (chartType === 'horizontal') {
      return <HBarChart data={data} maxItems={data.length} onSelect={onSelect} renderLabel={renderLabel} />;
    }
    if (chartType === 'columns') {
      return <div className="overflow-x-auto"><div style={{ minWidth: `${Math.max(0, data.length * 70)}px` }}><BarChart data={data} height={155} onSelect={onSelect} renderLabel={renderLabel} /></div></div>;
    }
    return <DonutChart data={data} size={size} centerLabel={centerLabel} centerValue={centerValue} onSelect={onSelect} renderLabel={renderLabel} />;
  };

  if (detail) {
    const readings = readBooks.filter((book) => detail.type === 'language'
      ? languageLabel(book.language) === detail.label
      : detail.type === 'format' ? formatLabel(book.format) === detail.label : (book.tags || []).includes(detail.label));
    return <section className="space-y-5">
      <button type="button" className={btnGhost} onClick={() => setDetail(null)}><ArrowLeft size={16} /> Volver a estadísticas</button>
      <div className={cx(cardCls, 'p-5 sm:p-7')}>
        <p className="text-xs font-extrabold uppercase tracking-wider text-ink3">{detail.type === 'language' ? 'Idioma' : detail.type === 'format' ? 'Formato' : 'Género o tag'} · {periodLabel}</p>
        <h2 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold text-ink">{detail.type !== 'language' && <StatisticCategoryIcon type={detail.type} label={detail.label} />} {detail.label}</h2>
        <p className="mt-2 text-sm text-ink2">{readings.length} {readings.length === 1 ? 'lectura completada' : 'lecturas completadas'} · {readings.reduce((sum, book) => sum + (book.pages || 0), 0).toLocaleString('es')} páginas</p>
        <p className="mt-1 text-xs text-ink3">Las relecturas aparecen por separado.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {readings.map((reading, index) => <button key={`${reading.id}-${reading.finishedAt}-${index}`} type="button" onClick={() => onOpen(books.find((book) => book.id === reading.id) || reading)} className={cx(cardCls, 'flex min-w-0 items-center gap-3 p-3 text-left hover:border-accent transition-colors')}>
          <BookCover title={reading.title} author={reading.author} coverUrl={reading.coverUrl} detail="sm" className="h-[72px] w-12 shrink-0 shadow-book" />
          <span className="min-w-0"><span className="block truncate font-display text-base font-semibold text-ink">{reading.title}</span><span className="block truncate text-xs text-ink3">{reading.author || 'Autor desconocido'}</span><span className="mt-1 block text-xs text-ink2">{formatReadingDate(reading)} · {reading.pages || 0} págs.</span></span>
        </button>)}
      </div>
    </section>;
  }

  if (allRead.length === 0 && allJournalSessions.length === 0) {
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
        <p className="basis-full px-1 text-[11px] font-medium leading-relaxed text-ink3">
          Personaliza cada gráfico con los botones de su esquina: barras, línea, área, filas o donut. Tu elección queda guardada.
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-3 gap-3 stagger">
        <MetricCard icon={<BookOpen size={16} />} label="Libros leídos" value={stats.totalBooks} />
        <MetricCard icon={<FileText size={16} />} label="Páginas leídas" value={stats.totalPages.toLocaleString('es')} />
        <MetricCard icon={<Star size={16} />} label="Nota media" value={avgRating} />
      </div>

      <Card
        title="Ritmo del diario"
        subtitle={journalActivity.sessions > 0
          ? `${journalActivity.timelineLabel} · ${periodLabel} · ${journalActivity.booksWithActivity} libros con sesiones`
          : `Sesiones por fecha · ${periodLabel}`}
        action={(
          <TrendTypeControl
            value={chartPreferences.journal}
            onChange={(value) => setChartPreference('journal', value)}
          />
        )}
      >
        {journalActivity.sessions > 0 ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <ActivityStat
                icon={<FileText size={15} />}
                label="Páginas registradas"
                value={journalActivity.totalPages.toLocaleString('es')}
              />
              <ActivityStat
                icon={<CalendarDays size={15} />}
                label="Días activos"
                value={journalActivity.activeDays.toLocaleString('es')}
              />
              <ActivityStat
                icon={<Activity size={15} />}
                label="Media / día activo"
                value={`${journalActivity.averagePerActiveDay.toLocaleString('es', { maximumFractionDigits: 1 })} págs`}
              />
              <ActivityStat
                icon={<BookOpen size={15} />}
                label="Sesiones"
                value={journalActivity.sessions.toLocaleString('es')}
              />
            </div>

            {renderTrendChart(
              journalActivity.timeline,
              chartPreferences.journal,
              165,
              (value) => value ? value.toLocaleString('es') : '0',
              CH(1),
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-xs text-ink2">
              {journalActivity.bestDay && (
                <span>
                  <strong className="text-ink">Mejor día:</strong>{' '}
                  {formatDateKey(journalActivity.bestDay.date)} · {journalActivity.bestDay.pages.toLocaleString('es')} págs
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Flame size={14} className="text-accent" />
                Racha más larga: <strong className="text-ink">{journalActivity.longestStreak}</strong>
                {journalActivity.longestStreak === 1 ? 'día' : 'días'}
              </span>
              <span>
                Racha actual: <strong className="text-ink">{currentStreak}</strong> {currentStreak === 1 ? 'día' : 'días'}
              </span>
              {journalActivity.totalMinutes > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} className="text-accent" />
                  {journalActivity.totalMinutes.toLocaleString('es')} minutos registrados
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-accent/10 text-accent">
              <Activity size={21} />
            </span>
            <p className="max-w-lg text-sm leading-relaxed text-ink2">
              Todavía no hay sesiones con páginas en este periodo. Importa el JSON del diario de StoryGraph o
              registra avances en el diario de un libro para ver tus páginas por día y tus rachas.
            </p>
          </div>
        )}
      </Card>

      {journalActivity.topBooks.length > 0 && (
        <Card
          title="Libros con más actividad"
          subtitle={`Páginas registradas en el diario · ${periodLabel}`}
          action={(
            <RankingTypeControl
              value={chartPreferences.topBooks}
              onChange={(value) => setChartPreference('topBooks', value)}
            />
          )}
        >
          {renderRankingChart(
            journalActivity.topBooks,
            chartPreferences.topBooks,
            (value) => `${value.toLocaleString('es')} págs`,
            8,
            'págs en el top',
          )}
        </Card>
      )}

      {filterMode === 'month' ? (
        <Card
          title="Libros por día"
          subtitle={`${MONTHS[month].label} ${year} · Solo lecturas con día conocido`}
          action={(
            <TrendTypeControl
              value={chartPreferences.books}
              onChange={(value) => setChartPreference('books', value)}
            />
          )}
        >
          {renderTrendChart(stats.daily, chartPreferences.books, 150, undefined, CH(4))}
        </Card>
      ) : (
        <Card
          title="Libros por mes"
          subtitle={`Año ${year} · Solo lecturas con mes conocido`}
          action={(
            <TrendTypeControl
              value={chartPreferences.books}
              onChange={(value) => setChartPreference('books', value)}
            />
          )}
        >
          {renderTrendChart(stats.monthly, chartPreferences.books, 150, undefined, CH(4))}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card
          title="Géneros y tags"
          subtitle={`Toca un género para ver sus lecturas · ${periodLabel}`}
          action={(
            <DistributionTypeControl
              value={chartPreferences.tags}
              onChange={(value) => setChartPreference('tags', value)}
            />
          )}
        >
          {stats.tagData.length > 0 ? (
            renderDistributionChart(stats.tagData, chartPreferences.tags, 'tags', stats.tagData.length.toString(), 140, 'tag')
          ) : (
            <EmptyChart />
          )}
        </Card>

        <Card
          title="Extensión de los libros"
          subtitle={`Páginas por rango · ${periodLabel}`}
          action={(
            <TrendTypeControl
              value={chartPreferences.extension}
              onChange={(value) => setChartPreference('extension', value)}
            />
          )}
        >
          {renderTrendChart(
            stats.pageRanges.map((p, i) => ({
              ...p,
              color: `linear-gradient(180deg, rgb(var(--chart-${i + 1})), rgb(var(--chart-${i + 1}) / 0.55))`,
            })),
            chartPreferences.extension,
            150,
            undefined,
            CH(2),
          )}
        </Card>

        <Card
          title="Formato"
          subtitle={`Toca un formato para ver sus lecturas · ${periodLabel}`}
          action={(
            <DistributionTypeControl
              value={chartPreferences.format}
              onChange={(value) => setChartPreference('format', value)}
            />
          )}
        >
          {stats.formatData.length > 0
            ? renderDistributionChart(stats.formatData, chartPreferences.format, 'libros', undefined, 124, 'format')
            : <EmptyChart />}
        </Card>

        <Card
          title="Idioma"
          subtitle={`Toca un idioma para ver sus lecturas · ${periodLabel}`}
          action={(
            <DistributionTypeControl
              value={chartPreferences.language}
              onChange={(value) => setChartPreference('language', value)}
            />
          )}
        >
          {stats.langData.length > 0
            ? renderDistributionChart(stats.langData, chartPreferences.language, 'libros', undefined, 124, 'language')
            : <EmptyChart />}
        </Card>
      </div>

      <Card
        title="Autores más leídos"
        subtitle={`Top 10 · ${periodLabel}`}
        action={(
          <RankingTypeControl
            value={chartPreferences.authors}
            onChange={(value) => setChartPreference('authors', value)}
          />
        )}
      >
        {renderRankingChart(stats.authorData, chartPreferences.authors, undefined, 10, 'libros en el top')}
      </Card>

      <Card
        title="Distribución de puntuaciones"
        subtitle={`De 0 a 5 estrellas · ${periodLabel}`}
        action={(
          <TrendTypeControl
            value={chartPreferences.ratings}
            onChange={(value) => setChartPreference('ratings', value)}
          />
        )}
      >
        {renderTrendChart(
          stats.ratingBuckets.map((r, i) => ({
            ...r,
            color: `linear-gradient(180deg, rgb(var(--gold)), rgb(var(--gold) / ${0.45 + (i / 10) * 0.5}))`,
          })),
          chartPreferences.ratings,
          130,
          undefined,
          'rgb(var(--gold))',
        )}
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

function Card({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={cx(cardCls, 'p-4 sm:p-5')}>
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-ink text-base">{title}</h3>
          {subtitle && <p className="text-xs text-ink3 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function ChartTypeControl<T extends string>({ value, onChange, options, label }: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: React.ReactNode }[];
  label: string;
}) {
  return (
    <div className="flex rounded-full bg-sunken p-1 shadow-inner" role="group" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={cx(
              'flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-90',
              active ? 'bg-primary text-onprimary shadow-card' : 'text-ink3 hover:bg-surface hover:text-ink',
            )}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

function TrendTypeControl({ value, onChange }: {
  value: TrendChartType;
  onChange: (value: TrendChartType) => void;
}) {
  return (
    <ChartTypeControl
      value={value}
      onChange={onChange}
      label="Tipo de gráfico de tendencia"
      options={[
        { value: 'bars', label: 'Columnas', icon: <BarChart3 size={13} /> },
        { value: 'line', label: 'Línea', icon: <LineChart size={13} /> },
        { value: 'area', label: 'Área', icon: <AreaChart size={13} /> },
      ]}
    />
  );
}

function RankingTypeControl({ value, onChange }: {
  value: RankingChartType;
  onChange: (value: RankingChartType) => void;
}) {
  return (
    <ChartTypeControl
      value={value}
      onChange={onChange}
      label="Tipo de gráfico de clasificación"
      options={[
        { value: 'horizontal', label: 'Filas', icon: <Rows3 size={13} /> },
        { value: 'columns', label: 'Columnas', icon: <BarChart3 size={13} /> },
        { value: 'donut', label: 'Donut', icon: <PieChart size={13} /> },
      ]}
    />
  );
}

function DistributionTypeControl({ value, onChange }: {
  value: DistributionChartType;
  onChange: (value: DistributionChartType) => void;
}) {
  return (
    <ChartTypeControl
      value={value}
      onChange={onChange}
      label="Tipo de gráfico de distribución"
      options={[
        { value: 'donut', label: 'Donut', icon: <PieChart size={13} /> },
        { value: 'horizontal', label: 'Filas', icon: <Rows3 size={13} /> },
        { value: 'columns', label: 'Columnas', icon: <BarChart3 size={13} /> },
      ]}
    />
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

function ActivityStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-btn bg-sunken/70 px-3 py-3">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink3">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <span className="mt-1.5 block font-display text-xl font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-ink3 text-center py-8">Sin datos en este periodo</p>;
}
