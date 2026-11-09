import { PET_SPECIES, type PetSpecies } from '../petGame';
import { PET_POSES, type PetPose } from '../petArt';

/** Ilustraciones locales de las seis especies; la pose se valida antes de construir la ruta. */
export function PixelPet({ species, skin, pose, className = '' }: { species: PetSpecies; skin: number; pose?: PetPose; className?: string }) {
  const item = PET_SPECIES.find(pet => pet.id === species) || PET_SPECIES[0];
  const index = Number.isInteger(skin) && skin >= 0 && skin < item.skins.length ? skin : 0;
  const src = pose && PET_POSES.includes(pose) ? `/pets/poses/${item.id}/${index}/${pose}.webp` : `/pets/${item.id}-${index}.webp`;
  return <img src={src} alt={`${item.label} pixel art · ${item.skins[index]}${pose ? ` · ${pose}` : ''}`} className={className} style={{ imageRendering: 'pixelated' }} />;
}
