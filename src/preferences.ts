import { LIBRARY_VIEW_OPTIONS, type LibraryViewMode } from './libraryViews';

export type ChartPreferences = {
  journal: 'bars' | 'line' | 'area';
  books: 'bars' | 'line' | 'area';
  extension: 'bars' | 'line' | 'area';
  ratings: 'bars' | 'line' | 'area';
  topBooks: 'horizontal' | 'columns' | 'donut';
  authors: 'horizontal' | 'columns' | 'donut';
  tags: 'donut' | 'horizontal' | 'columns';
  format: 'donut' | 'horizontal' | 'columns';
  language: 'donut' | 'horizontal' | 'columns';
};

export const DEFAULT_CHART_PREFERENCES: ChartPreferences = {
  journal: 'bars', books: 'bars', extension: 'bars', ratings: 'bars',
  topBooks: 'horizontal', authors: 'horizontal', tags: 'donut', format: 'donut', language: 'donut',
};

export function normalizeLibraryView(value: unknown): LibraryViewMode {
  return LIBRARY_VIEW_OPTIONS.some((option) => option.value === value) ? value as LibraryViewMode : 'wood';
}

export function normalizeChartPreferences(value: unknown): ChartPreferences {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_CHART_PREFERENCES };
  for (const key of Object.keys(result) as (keyof ChartPreferences)[]) {
    const allowed = ['journal', 'books', 'extension', 'ratings'].includes(key)
      ? ['bars', 'line', 'area'] : ['horizontal', 'columns', 'donut'];
    if (typeof input[key] === 'string' && allowed.includes(input[key] as string)) {
      // Los dos grupos de claves tienen valores permitidos distintos.
      (result as Record<string, string>)[key] = input[key] as string;
    }
  }
  return result;
}
