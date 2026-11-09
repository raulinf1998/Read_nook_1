import type { PetSpecies } from './petGame';

export const PET_POSES = ['sentado', 'durmiendo', 'andando', 'jugando'] as const;
export type PetPose = typeof PET_POSES[number];
export type HeadAnchor = { x: number; y: number; width: number };
// Posiciones medidas sobre cada imagen de 256 × 256; el orden es sentado, durmiendo, andando y jugando.
type AnchorRow = readonly [HeadAnchor, HeadAnchor, HeadAnchor, HeadAnchor];
const h = (x: number, y: number, width = 27): HeadAnchor => ({ x, y, width });
export const PET_HEAD_ANCHORS: Record<PetSpecies, readonly AnchorRow[]> = {
  cat: [
    [h(47,21),h(29,48),h(23,47),h(31,61)], [h(43,22),h(28,52),h(20,49),h(29,60)],
    [h(43,20),h(29,50),h(20,52),h(30,57)], [h(40,21),h(27,51),h(23,49),h(28,59)],
    [h(42,22),h(28,52),h(23,49),h(31,61)], [h(47,20),h(28,52),h(23,47),h(31,58)],
  ],
  munchkin: [
    [h(48,21),h(28,49),h(75,53),h(29,59)], [h(72,30),h(28,53),h(20,47),h(28,60)],
    [h(26,39),h(27,52),h(23,47),h(30,59)], [h(28,27),h(27,52),h(26,48),h(29,60)],
    [h(27,24),h(27,51),h(23,49),h(24,57)], [h(26,39),h(27,52),h(22,50),h(27,59)],
  ],
  monkey: [
    [h(36,17),h(28,53),h(34,17),h(48,30)], [h(32,28),h(36,39),h(25,41),h(47,31)],
    [h(48,24),h(48,29),h(45,20),h(48,32)], [h(40,27),h(27,47),h(32,28),h(48,33)],
    [h(35,26),h(27,54),h(74,46),h(48,32)], [h(36,27),h(27,48),h(38,26),h(48,35)],
  ],
  chicken: [
    [h(48,18),h(48,18),h(43,19),h(48,18)], [h(48,22),h(48,24),h(48,22),h(48,22)],
    [h(48,19),h(48,19),h(48,20),h(48,19)], [h(48,18),h(48,18),h(48,18),h(48,18)],
    [h(48,18),h(48,18),h(46,18),h(48,18)], [h(48,18),h(48,18),h(46,18),h(48,18)],
  ],
  dragon: [
    [h(70,26,26),h(35,64,24),h(72,54,22),h(63,34,26)], [h(70,27,26),h(76,70,24),h(76,60,22),h(68,32,26)],
    [h(66,41,24),h(22,71,22),h(75,62,22),h(68,30,24)], [h(72,28,26),h(68,60,24),h(79,56,22),h(72,32,26)],
    [h(67,32,26),h(73,31,24),h(78,58,22),h(68,33,26)], [h(84,88,15),h(53,51,20),h(13,71,15),h(57,24,20)],
  ],
  trex: [
    [h(34,21),h(33,27),h(33,23),h(34,23)], [h(35,23),h(77,75),h(31,30),h(36,23)],
    [h(32,23),h(25,62),h(30,24),h(30,23)], [h(32,23),h(24,62),h(31,36),h(32,30)],
    [h(33,34),h(24,62),h(32,35),h(44,23)], [h(31,22),h(23,71),h(31,24),h(31,23)],
  ],
};
export function headAnchor(species: PetSpecies, skin: number, pose: PetPose): HeadAnchor {
  const rows = PET_HEAD_ANCHORS[species];
  const original = (rows[skin] || rows[0])[Math.max(0, PET_POSES.indexOf(pose))];
  return original;
}
