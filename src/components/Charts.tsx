interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 160, formatValue }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-around gap-2" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {formatValue ? formatValue(d.value) : d.value}
            </span>
            <div
              className="w-full max-w-[48px] rounded-t-lg transition-all duration-500 hover:opacity-80"
              style={{
                height: `${Math.max(pct, 2)}%`,
                background: d.color || 'linear-gradient(180deg, #6366f1, #818cf8)',
              }}
            />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center leading-tight">{d.label}</span>
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
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              className="text-gray-100 dark:text-gray-800"
            />
          ) : (
            data.map((d, i) => {
              const dash = (d.value / total) * circumference;
              const seg = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              );
              offset += dash;
              return seg;
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900 dark:text-white">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[10px] text-gray-400">{centerLabel}</span>}
        </div>
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{d.label}</span>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">{d.value}</span>
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
    return <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>;
  }

  return (
    <div className="space-y-2.5">
      {shown.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate flex-shrink-0">{d.label}</span>
            <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500 flex items-center justify-end px-1.5"
                style={{ width: `${Math.max(pct, 3)}%`, background: d.color || '#6366f1' }}
              >
                <span className="text-[10px] font-semibold text-white">
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
