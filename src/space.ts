import type { Book } from './types.ts';
import { completedReadings } from './rereads.ts';
import { normalizeLanguageCode } from './bookMetadata.ts';

export const PLANET_STYLES = [
  { id: 'orbita', label: 'Órbita clásica' },
  { id: 'saturno', label: 'Anillos de Saturno' },
  { id: 'luna', label: 'Luna grabada' },
  { id: 'aurora', label: 'Aurora luminosa' },
  { id: 'cristal', label: 'Cristal cósmico' },
  { id: 'eclipse', label: 'Eclipse' },
  { id: 'neon', label: 'Neón espacial' },
  { id: 'acuario', label: 'Mundo acuático' },
  { id: 'vintage', label: 'Observatorio antiguo' },
  { id: 'cometa', label: 'Planeta cometa' },
] as const;
export type PlanetStyle = typeof PLANET_STYLES[number]['id'];
export function normalizePlanetStyle(value: unknown): PlanetStyle {
  return PLANET_STYLES.some((style) => style.id === value) ? value as PlanetStyle : 'orbita';
}

export type SpaceReading = { book: Book; reading: Book; language: 'en' | 'es'; year: number; key: string };
export function buildSpaceReadings(books: Book[]) {
  const orbiting: SpaceReading[] = [];
  const withoutYear: Book[] = [];
  const otherLanguages: Book[] = [];
  books.forEach((book) => completedReadings(book).forEach((reading, index) => {
    const lang = normalizeLanguageCode(reading.language);
    if (lang !== 'en' && lang !== 'es') { otherLanguages.push(reading); return; }
    if (!reading.finishedAt || !Number.isFinite(reading.finishedAt)) { withoutYear.push(reading); return; }
    const year = new Date(reading.finishedAt).getFullYear();
    if (!Number.isFinite(year)) { withoutYear.push(reading); return; }
    orbiting.push({ book, reading, language: lang, year, key: `${book.id}:${index}` });
  }));
  const years = [...new Set(orbiting.map((entry) => entry.year))].sort((a, b) => a - b);
  return { orbiting, years, withoutYear, otherLanguages };
}

export function buildSpaceOrbits(entries: SpaceReading[], years: number[]) {
  let radius = 95;
  const create = (language: 'en' | 'es') => years.map((year) => {
    const planets = entries.filter((entry) => entry.language === language && entry.year === year)
      .sort((a, b) => (a.reading.finishedAt || 0) - (b.reading.finishedAt || 0) || a.key.localeCompare(b.key));
    radius = Math.max(radius + 62, Math.ceil(planets.length * 55 / (2 * Math.PI)));
    return { year, language, radius, planets };
  });
  const inner = create('en');
  const beltRadius = radius + 67;
  radius = beltRadius + 48;
  const outer = create('es');
  return { inner, outer, beltRadius, extent: radius + 90 };
}
