import type { Book } from './types';
import { dateKey } from './readingCalendar.ts';

export type PetSpecies = 'cat' | 'dragon' | 'monkey' | 'chicken' | 'trex';
export const PET_BACKGROUNDS = [
  { id: 'garden', label: 'Bosque mágico', image: '/pet-garden.webp' },
  { id: 'ocean', label: 'Costa tranquila', image: '/pet-bg-ocean.webp' },
  { id: 'library', label: 'Biblioteca', image: '/pet-bg-library.webp' },
  { id: 'snow', label: 'Bosque nevado', image: '/pet-bg-snow.webp' },
  { id: 'space', label: 'Jardín espacial', image: '/pet-bg-space.webp' },
  { id: 'jungle', label: 'Selva', image: '/pet-bg-jungle.webp' },
  { id: 'desert', label: 'Oasis', image: '/pet-bg-desert.webp' },
  { id: 'castle', label: 'Castillo', image: '/pet-bg-castle.webp' },
  { id: 'cherry', label: 'Cerezos', image: '/pet-bg-cherry.webp' },
  { id: 'autumn', label: 'Bosque de otoño', image: '/pet-bg-autumn.webp' },
] as const;
export type PetBackground = typeof PET_BACKGROUNDS[number]['id'];
export interface PetSettings { species: PetSpecies; skin: number; name: string; background: PetBackground; accessory: number | null }
export const PET_SPECIES: { id: PetSpecies; label: string; skins: string[] }[] = [
  { id: 'cat', label: 'Gato', skins: ['Europeo atigrado', 'Siamés', 'Bombay', 'Británico tricolor', 'Azul ruso', 'Maine coon'] },
  { id: 'dragon', label: 'Dragón', skins: ['Bosque', 'Rubí', 'Océano', 'Amatista', 'Sol', 'Escarcha'] },
  { id: 'monkey', label: 'Mono', skins: ['Cacao', 'Dorado', 'Nieve', 'Selva', 'Canela', 'Medianoche'] },
  { id: 'chicken', label: 'Pollo', skins: ['Pollito', 'En el huevo', 'Canela', 'Cascarón', 'Lavanda', 'Noche'] },
  { id: 'trex', label: 'T. rex', skins: ['Jurásico', 'Volcán', 'Laguna', 'Ciruela', 'Desierto', 'Fósil'] },
];
export const SKIN_THRESHOLDS = [0, 100, 300, 600, 1000, 1600];
export const ACCESSORY_TYPES = ['Gorro aventurero', 'Corona', 'Sombrero mágico', 'Boina', 'Lazo', 'Halo', 'Estrellas', 'Pétalos', 'Luna', 'Chispas'] as const;
export const ACCESSORY_COLORS = ['ámbar', 'océano', 'lavanda', 'bosque', 'rubí'] as const;
export const PET_ACCESSORIES = Array.from({ length: 50 }, (_, id) => ({ id, kind: id % 10, color: Math.floor(id / 10), name: `${ACCESSORY_TYPES[id % 10]} ${ACCESSORY_COLORS[Math.floor(id / 10)]}`, level: (id + 1) * 2 }));
export const DEFAULT_PET: PetSettings = { species: 'cat', skin: 0, name: '', background: 'garden', accessory: null };
export function normalizePet(value: unknown): PetSettings {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const species = PET_SPECIES.some(pet => pet.id === data.species) ? data.species as PetSpecies : 'cat';
  return { species, skin: Number.isInteger(data.skin) && Number(data.skin) >= 0 && Number(data.skin) < 6 ? Number(data.skin) : 0, name: typeof data.name === 'string' ? data.name.trim().slice(0, 24) : '', background: PET_BACKGROUNDS.some(item => item.id === data.background) ? data.background as PetBackground : 'garden', accessory: Number.isInteger(data.accessory) && Number(data.accessory) >= 0 && Number(data.accessory) < 50 ? Number(data.accessory) : null };
}
export interface PetChallenge { startDate: string; excluded: string[] }
export function normalizePetChallenge(value: unknown): PetChallenge | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate) || !Array.isArray(data.excluded)) return null;
  return { startDate: data.startDate, excluded: data.excluded.filter((key): key is string => typeof key === 'string') };
}
export function petProgress(books: Book[], now = new Date(), challenge: PetChallenge | null = null) {
  const today = dateKey(now);
  const daily = new Map<string, number>();
  const excluded = new Set(challenge?.excluded || []);
  for (const book of books) for (const entry of book.journal || []) {
    if (!challenge || excluded.has(JSON.stringify([book.id, entry.id || ''])) || entry.datePrecision || !Number.isFinite(entry.date) || entry.date <= 0 || !Number.isFinite(entry.pages) || entry.pages <= 0) continue;
    const date = new Date(entry.date);
    if (!Number.isFinite(date.getTime())) continue;
    const key = dateKey(date);
    if (key > today || key < challenge.startDate) continue;
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
  const level = Math.floor(pages / 100) + 1;
  return { ...pet, skin: pages >= SKIN_THRESHOLDS[pet.skin] ? pet.skin : 0, accessory: pet.accessory !== null && PET_ACCESSORIES[pet.accessory]?.level <= level ? pet.accessory : null };
}
