import type { PetSpecies } from './petGame';

export const PET_POSES = ['sentado', 'durmiendo', 'andando', 'jugando'] as const;
export type PetPose = typeof PET_POSES[number];
export type HeadAnchor = { x: number; y: number; width: number };
// Posiciones medidas sobre cada imagen de 256 × 256; el orden es sentado, durmiendo, andando y jugando.
type AnchorRow = readonly [HeadAnchor, HeadAnchor, HeadAnchor, HeadAnchor];
const h = (x: number, y: number, width = 32): HeadAnchor => ({ x, y, width });
export const PET_HEAD_ANCHORS: Record<PetSpecies, readonly AnchorRow[]> = {
  cat: [
    [h(47,17),h(29,44),h(23,43),h(31,57)], [h(43,18),h(28,48),h(20,45),h(29,56)],
    [h(43,16),h(29,46),h(20,48),h(30,53)], [h(40,17),h(27,47),h(23,45),h(28,55)],
    [h(42,18),h(28,48),h(23,45),h(31,57)], [h(47,16),h(28,48),h(23,43),h(31,54)],
  ],
  munchkin: [
    [h(48,17),h(28,45),h(75,49),h(29,55)], [h(72,26),h(28,49),h(20,43),h(28,56)],
    [h(26,35),h(27,48),h(23,43),h(30,55)], [h(28,23),h(27,48),h(26,44),h(29,56)],
    [h(27,20),h(27,47),h(23,45),h(24,53)], [h(26,35),h(27,48),h(22,46),h(27,55)],
  ],
  monkey: [
    [h(36,17),h(28,53),h(34,17),h(48,30)], [h(32,27),h(29,52),h(25,52),h(47,33)],
    [h(48,24),h(48,29),h(45,20),h(48,32)], [h(34,24),h(27,57),h(32,25),h(48,32)],
    [h(35,22),h(27,60),h(74,42),h(48,32)], [h(36,24),h(27,57),h(38,23),h(48,33)],
  ],
  chicken: [
    [h(48,18),h(48,18),h(43,19),h(48,18)], [h(48,22),h(48,24),h(48,22),h(48,22)],
    [h(48,19),h(48,19),h(48,20),h(48,19)], [h(48,18),h(48,18),h(48,18),h(48,18)],
    [h(48,18),h(48,18),h(46,18),h(48,18)], [h(48,18),h(48,18),h(46,18),h(48,18)],
  ],
  dragon: [
    [h(70,19),h(48,52),h(72,50),h(63,30)], [h(70,20),h(72,62),h(76,52),h(68,25)],
    [h(64,29),h(22,63),h(70,49),h(68,22)], [h(72,21),h(68,51),h(75,50),h(72,25)],
    [h(67,25),h(61,35),h(72,54),h(68,26)], [h(82,77),h(53,42),h(20,76),h(69,27)],
  ],
  trex: [
    [h(34,16),h(33,22),h(33,18),h(34,18)], [h(35,18),h(77,60),h(31,25),h(36,18)],
    [h(32,18),h(25,62),h(30,19),h(30,18)], [h(32,18),h(24,62),h(31,31),h(32,25)],
    [h(33,29),h(24,62),h(32,30),h(39,24)], [h(31,17),h(23,62),h(31,19),h(31,18)],
  ],
};
export function headAnchor(species: PetSpecies, skin: number, pose: PetPose): HeadAnchor {
  const rows = PET_HEAD_ANCHORS[species];
  return (rows[skin] || rows[0])[Math.max(0, PET_POSES.indexOf(pose))];
}
