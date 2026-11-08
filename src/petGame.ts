import type { Book } from './types';
import { dateKey } from './readingCalendar.ts';

export type PetSpecies = 'cat' | 'dragon' | 'monkey' | 'chicken' | 'trex';
export interface PetSettings { species: PetSpecies; skin: number; name: string }
export const PET_SPECIES: { id: PetSpecies; label: string; skins: string[] }[] = [
  { id: 'cat', label: 'Gato', skins: ['Europeo atigrado', 'Siamés', 'Bombay', 'Británico tricolor', 'Azul ruso', 'Maine coon'] },
  { id: 'dragon', label: 'Dragón', skins: ['Bosque', 'Rubí', 'Océano', 'Amatista', 'Sol', 'Escarcha'] },
  { id: 'monkey', label: 'Mono', skins: ['Cacao', 'Dorado', 'Nieve', 'Selva', 'Canela', 'Medianoche'] },
  { id: 'chicken', label: 'Pollo', skins: ['Pollito', 'Corral', 'Canela', 'Nube', 'Lavanda', 'Noche'] },
  { id: 'trex', label: 'T. rex', skins: ['Jurásico', 'Volcán', 'Laguna', 'Ciruela', 'Desierto', 'Fósil'] },
];
export const SKIN_THRESHOLDS = [0, 100, 300, 600, 1000, 1600];
export const DEFAULT_PET: PetSettings = { species: 'cat', skin: 0, name: '' };
export function normalizePet(value: unknown): PetSettings {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const species = PET_SPECIES.some(pet => pet.id === data.species) ? data.species as PetSpecies : 'cat';
  return { species, skin: Number.isInteger(data.skin) && Number(data.skin) >= 0 && Number(data.skin) < 6 ? Number(data.skin) : 0, name: typeof data.name === 'string' ? data.name.trim().slice(0, 24) : '' };
}
export function petProgress(books: Book[], now = new Date()) {
  const today = dateKey(now);
  const daily = new Map<string, number>();
  for (const book of books) for (const entry of book.journal || []) {
    if (entry.datePrecision || !Number.isFinite(entry.date) || entry.date <= 0 || !Number.isFinite(entry.pages) || entry.pages <= 0) continue;
    const date = new Date(entry.date);
    if (!Number.isFinite(date.getTime())) continue;
    const key = dateKey(date);
    if (key > today) continue;
    daily.set(key, (daily.get(key) || 0) + entry.pages);
  }
  const total = [...daily.values()].reduce((sum, n) => sum + n, 0);
  const dayPages = daily.get(today) || 0;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7, 12);
  const weekPages = [...daily].reduce((sum, [key, pages]) => sum + (key >= dateKey(weekStart) && key <= today ? pages : 0), 0);
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!daily.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (daily.has(dateKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return { total, dayPages, weekPages, streak, level: Math.floor(total / 100) + 1, levelPages: total % 100, activeDays: daily.size };
}
export function effectivePet(pet: PetSettings, pages: number): PetSettings {
  return { ...pet, skin: pages >= SKIN_THRESHOLDS[pet.skin] ? pet.skin : 0 };
}
