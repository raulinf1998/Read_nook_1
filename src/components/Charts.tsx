/* Gráficos ligeros en SVG/divs. Los colores llegan como valores CSS
   (p. ej. rgb(var(--chart-1))) y se aplican vía style para que sigan el tema. */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 160, formatValue }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-around gap-1.5" style={{ height }} role="img" aria-label="Gráfico de barras">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end min-w-0 group">
            <span className={`text-xs font-bold tabular-nums transition-colors ${d.value > 0 ? 'text-ink' : 'text-ink3/60'}`}>
              {formatValue ? formatValue(d.value) : d.value}
            </span>
            <div
              className="w-full max-w-[46px] rounded-t-[7px] rounded-b-[3px] transition-all duration-500 group-hover:brightness-110 group-hover:saturate-150 animate-grow-y"
              style={{
                height: `${Math.max(pct, d.value > 0 ? 4 : 1.5)}%`,
                background: d.color || 'linear-gradient(180deg, rgb(var(--chart-1)), rgb(var(--chart-1) / 0.55))',
                animationDelay: `${i * 35}ms`,
                opacity: d.value > 0 ? 1 : 0.35,
              }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="text-[10px] font-medium text-ink3 text-center leading-tight truncate w-full">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ data, size = 140, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label="Gráfico circular">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="14"
            style={{ stroke: 'rgb(var(--sunken))' }}
          />
          {total > 0 &&
            data.map((d, i) => {
              const dash = (d.value / total) * circumference;
              const seg = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth="14"
                  strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - dash + 2}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                  style={{ stroke: d.color }}
                >
                  <title>{`${d.label}: ${d.value}`}</title>
                </circle>
              );
              offset += dash;
              return seg;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold text-ink leading-none">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[10px] font-medium text-ink3 mt-1">{centerLabel}</span>}
        </div>
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[4px] shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-ink2 truncate flex-1">{d.label}</span>
            <span className="text-xs font-bold text-ink tabular-nums">{d.value}</span>
            {total > 0 && (
              <span className="text-[10px] text-ink3 tabular-nums w-8 text-right">{Math.round((d.value / total) * 100)}%</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface HBarChartProps {
  data: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
  maxItems?: number;
}

export function HBarChart({ data, formatValue, maxItems = 10 }: HBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const shown = data.slice(0, maxItems);

  if (shown.length === 0) {
    return <p className="text-sm text-ink3 text-center py-6">Sin datos</p>;
  }

  return (
    <div className="space-y-2.5" role="img" aria-label="Gráfico de barras horizontales">
      {shown.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2.5 group">
            <span className="text-xs font-medium text-ink2 w-32 truncate shrink-0" title={d.label}>{d.label}</span>
            <div className="flex-1 h-6 bg-sunken rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500 flex items-center justify-end px-2 animate-grow-x group-hover:brightness-110"
                style={{
                  width: `${Math.max(pct, 6)}%`,
                  background: d.color || 'linear-gradient(90deg, rgb(var(--chart-1) / 0.75), rgb(var(--chart-1)))',
                  animationDelay: `${i * 45}ms`,
                }}
              >
                <span className="text-[10px] font-bold text-white drop-shadow-sm tabular-nums">
                  {formatValue ? formatValue(d.value) : d.value}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
