import { PET_SPECIES, type PetSpecies } from '../petGame';

/** Ilustraciones locales con fondo transparente, seis diseños por especie. */
export function PixelPet({ species, skin, className = '' }: { species: PetSpecies; skin: number; className?: string }) {
  const item = PET_SPECIES.find(pet => pet.id === species) || PET_SPECIES[0];
  const index = Number.isInteger(skin) && skin >= 0 && skin < item.skins.length ? skin : 0;
  return <img src={`/pets/${item.id}-${index}.webp`} alt={`${item.label} pixel art · ${item.skins[index]}`} className={className} style={{ imageRendering: 'pixelated' }} />;
}
