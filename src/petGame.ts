import type { Book } from './types';
import { dateKey } from './readingCalendar.ts';

export type PetSpecies = 'cat' | 'munchkin' | 'dragon' | 'monkey' | 'chicken' | 'trex';
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
  { id: 'interior-library', label: 'Biblioteca acogedora', image: '/pets/interior-library.webp' },
  { id: 'interior-fireplace', label: 'Junto a la chimenea', image: '/pets/interior-fireplace.webp' },
  { id: 'interior-attic', label: 'Desván lector', image: '/pets/interior-attic.webp' },
  { id: 'interior-cafe', label: 'Café de libros', image: '/pets/interior-cafe.webp' },
  { id: 'interior-greenhouse', label: 'Invernadero lector', image: '/pets/interior-greenhouse.webp' },
  { id: 'interior-observatory', label: 'Observatorio', image: '/pets/interior-observatory.webp' },
  { id: 'interior-gothic', label: 'Biblioteca gótica', image: '/pets/interior-gothic.webp' },
  { id: 'interior-workshop', label: 'Taller de encuadernación', image: '/pets/interior-workshop.webp' },
  { id: 'interior-rain', label: 'Tarde de lluvia', image: '/pets/interior-rain.webp' },
  { id: 'interior-magic', label: 'Estudio mágico', image: '/pets/interior-magic.webp' },
] as const;
export type PetBackground = typeof PET_BACKGROUNDS[number]['id'];
export function petBackgroundImage(background: PetBackground, phase: 'day' | 'night'): string {
  return `/pets/backgrounds/${phase}/${background}.webp`;
}
export interface PetSettings { pose?: 'sentado' | 'durmiendo' | 'andando' | 'jugando'; species: PetSpecies; skin: number; name: string; background: PetBackground; accessory: number | null }
export const PET_SPECIES: { id: PetSpecies; label: string; skins: string[] }[] = [
  { id: 'cat', label: 'Gato', skins: ['Europeo atigrado', 'Siamés', 'Bombay', 'Británico tricolor', 'British shorthair gris', 'Maine coon'] },
  { id: 'munchkin', label: 'Munchkin', skins: ['Atigrado', 'Siamés', 'Gris', 'Tricolor', 'Blanco', 'Blanco y negro'] },
  { id: 'dragon', label: 'Dragón', skins: ['Verde', 'Rojo', 'Acuático', 'Constelación', 'Dorado', 'Nube'] },
  { id: 'monkey', label: 'Mono', skins: ['Cacao', 'Dorado', 'Nieve', 'Selva', 'Canela', 'Medianoche'] },
  { id: 'chicken', label: 'Pollo', skins: ['Pollito', 'En el huevo', 'Canela', 'Cascarón', 'Lavanda', 'Noche'] },
  { id: 'trex', label: 'T. rex', skins: ['Jurásico', 'Volcán', 'Laguna', 'Ciruela', 'Desierto', 'Fósil'] },
];
export const SKIN_THRESHOLDS = [0, 100, 300, 600, 1000, 1600];
// Dos diseños de cada familia, todos con nombre propio y desbloqueo cada dos niveles.
const ACCESSORY_NAMES = [
  ['Gorro de Navidad', 'Gorro de duende'], ['Sombrero de mago', 'Sombrero de bruja'],
  ['Sombrero cowboy', 'Sombrero del desierto'], ['Calabaza sonriente', 'Calabaza luminosa'],
  ['Brote de primavera', 'Flor silvestre'], ['Corazón', 'Corazón brillante'],
  ['Corona real', 'Corona de flores'], ['Gorro de fiesta', 'Gorro de cumpleaños'],
  ['Sombrero pirata', 'Sombrero marinero'], ['Gorro de cocinero', 'Gorro de pastelero'],
  ['Boina francesa', 'Boina de artista'], ['Gorro de invierno', 'Gorro de nieve'],
  ['Casco de caballero', 'Casco de aventurero'], ['Diadema de orejas', 'Cuernos de fiesta'],
  ['Aureola dorada', 'Aureola lunar'], ['Estrella fugaz', 'Constelación'],
  ['Luna creciente', 'Sol radiante'], ['Nube pequeña', 'Nube de lluvia'],
  ['Seta roja', 'Seta del bosque'], ['Fantasmita', 'Fantasma amable'],
  ['Mariposa', 'Abejita'], ['Lazo de seda', 'Lazo de lunares'],
  ['Hoja otoñal', 'Hoja de trébol'], ['Campanita', 'Copo de nieve'],
  ['Cristal mágico', 'Diamante brillante'],
] as const;
// Los identificadores se conservan: una selección guardada ocupa el mismo
// nivel y se convierte en su nuevo compañero cuando el diseño se reemplaza.
const KEPT_ACCESSORY_IDS = new Set([0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 14, 15, 22, 23, 28, 29]);
// Dos imágenes de color independientes por animal, sin filtros CSS.
const COMPANION_TYPES = [
  ['rabbit', 'Conejito', 'lila', 'lila'], ['fox', 'Zorrito', 'rojizo', 'rojizo'],
  ['frog', 'Ranita', 'azul', 'azul'], ['hedgehog', 'Erizo', 'cobrizo', 'cobrizo'],
  ['owl', 'Búho', 'caramelo', 'caramelo'], ['turtle', 'Tortuguita', 'turquesa', 'turquesa'],
  ['squirrel', 'Ardilla', 'dorada', 'dorada'], ['hamster', 'Hámster', 'rosado', 'rosado'],
  ['bat', 'Murciélago', 'azul', 'azul'], ['penguin', 'Pingüino', 'azul', 'azul'],
  ['raccoon', 'Mapache', 'castano', 'castaño'], ['duck', 'Patito', 'blanco', 'blanco'],
  ['sheep', 'Ovejita', 'melocoton', 'melocotón'], ['mouse', 'Ratoncito', 'canela', 'canela'],
  ['butterfly', 'Mariposa', 'azul', 'azul'], ['snail', 'Caracol', 'verde', 'verde'],
  ['bee', 'Abejita', 'rosada', 'rosada'],
] as const;
const COMPANIONS = COMPANION_TYPES.flatMap(([image, label, alternate, alternateLabel]) => [
  { image: `/pets/companions/${image}-clasico.webp`, label: image === 'butterfly' ? 'Mariposa monarca' : `${label} clásico` },
  { image: `/pets/companions/${image}-${alternate}.webp`, label: `${label} ${alternateLabel}` },
]);
let companionIndex = 0;
export const PET_ACCESSORIES = Array.from({ length: 50 }, (_, id) => {
  const kind = Math.floor(id / 2), variant = id % 2;
  const companion = KEPT_ACCESSORY_IDS.has(id) ? null : COMPANIONS[companionIndex++];
  return { id, kind, variant, name: companion?.label ?? ACCESSORY_NAMES[kind][variant], level: (id + 1) * 2, placement: (companion ? 'side' : 'head') as 'side' | 'head', companion };
});
export const DEFAULT_PET: PetSettings = { species: 'cat', skin: 0, name: '', background: 'garden', accessory: null };
export function normalizePet(value: unknown): PetSettings {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const species = PET_SPECIES.some(pet => pet.id === data.species) ? data.species as PetSpecies : 'cat';
  const pose = ['sentado', 'durmiendo', 'andando', 'jugando'].includes(String(data.pose)) ? data.pose as PetSettings['pose'] : undefined;
  return { ...(pose ? { pose } : {}), species, skin: Number.isInteger(data.skin) && Number(data.skin) >= 0 && Number(data.skin) < 6 ? Number(data.skin) : 0, name: typeof data.name === 'string' ? data.name.trim().slice(0, 24) : '', background: PET_BACKGROUNDS.some(item => item.id === data.background) ? data.background as PetBackground : 'garden', accessory: Number.isInteger(data.accessory) && Number(data.accessory) >= 0 && Number(data.accessory) < 50 ? Number(data.accessory) : null };
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
