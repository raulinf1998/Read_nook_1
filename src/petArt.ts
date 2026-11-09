import type { PetSpecies } from './petGame';

export const PET_POSES = ['sentado', 'durmiendo', 'andando', 'jugando'] as const;
export type PetPose = typeof PET_POSES[number];
export type HeadAnchor = { x: number; y: number; width: number };
// Posiciones medidas sobre cada imagen de 256 × 256; el orden es sentado, durmiendo, andando y jugando.
type AnchorRow = readonly [HeadAnchor, HeadAnchor, HeadAnchor, HeadAnchor];
const h = (x: number, y: number, width = 27): HeadAnchor => ({ x, y, width });
export const PET_HEAD_ANCHORS: Record<PetSpecies, readonly AnchorRow[]> = {
  cat: [
    [h(47,27),h(30,54),h(21,47),h(36,63)], [h(43,28),h(30,57),h(20,49),h(34,62)],
    [h(43,26),h(30,55),h(20,50),h(35,61)], [h(40,27),h(29,56),h(20,43),h(32,62)],
    [h(42,28),h(30,57),h(20,47),h(35,63)], [h(47,26),h(30,57),h(20,46),h(34,62)],
  ],
  munchkin: [
    [h(48,27),h(30,55),h(75,52),h(34,62)], [h(72,30),h(28,53),h(20,47),h(28,60)],
    [h(26,39),h(27,52),h(23,47),h(30,59)], [h(28,33),h(27,56),h(20,41),h(27,63)],
    [h(27,24),h(27,51),h(23,49),h(24,57)], [h(26,39),h(27,52),h(22,50),h(27,59)],
  ],
  monkey: [
    [h(36,17),h(28,53),h(34,17),h(44,28)], [h(32,28),h(36,39),h(25,41),h(47,27)],
    [h(48,24),h(53,29),h(45,20),h(48,29)], [h(40,27),h(27,47),h(32,28),h(48,29)],
    [h(35,26),h(27,54),h(74,46),h(48,32)], [h(36,27),h(27,48),h(38,26),h(48,29)],
  ],
  chicken: [
    [h(48,21),h(48,21),h(43,22),h(48,21)], [h(48,25),h(48,27),h(48,25),h(48,25)],
    [h(48,22),h(48,22),h(48,23),h(48,22)], [h(48,21),h(48,21),h(48,21),h(48,21)],
    [h(48,21),h(48,21),h(46,21),h(48,21)], [h(48,21),h(48,21),h(46,21),h(48,21)],
  ],
  dragon: [
    [h(70,26,26),h(35,64,24),h(72,54,22),h(63,34,26)], [h(70,27,26),h(76,70,24),h(76,60,22),h(68,32,26)],
    [h(66,41,24),h(22,71,22),h(75,62,22),h(68,30,24)], [h(74,28,24),h(68,60,24),h(79,56,22),h(72,32,26)],
    [h(67,32,26),h(73,31,24),h(78,58,22),h(68,33,26)], [h(84,87,13),h(54,54,25),h(14,70,13),h(62,27,24)],
  ],
  trex: [
    [h(34,21),h(33,30),h(33,23),h(34,24)], [h(35,23),h(77,75),h(31,30),h(36,23)],
    [h(32,23),h(25,62),h(30,24),h(30,23)], [h(32,23),h(24,62),h(31,36),h(32,24)],
    [h(33,34),h(24,62),h(32,35),h(49,23)], [h(31,22),h(23,71),h(31,29),h(31,23)],
  ],
};
// Hat width is measured per pose as a percentage of the 256 px sprite.
// Profile and sleeping heads occupy much less of the canvas than front-facing ones.
const HEAD_WIDTHS: Record<PetSpecies, readonly (readonly [number, number, number, number])[]> = {
  cat: [[34,29,19,25],[32,28,18,24],[32,29,19,24],[32,28,20,25],[34,29,20,25],[35,29,20,25]],
  munchkin: [[34,29,20,25],[32,29,19,25],[31,29,20,26],[31,29,20,25],[31,29,21,25],[31,29,19,25]],
  monkey: [[33,31,32,32],[35,31,26,30],[34,33,34,33],[32,29,32,30],[35,29,27,30],[32,28,32,30]],
  chicken: [[35,35,31,35],[35,35,34,35],[35,35,31,35],[35,35,32,35],[35,35,31,35],[35,35,32,35]],
  dragon: [[26,24,22,26],[26,24,22,26],[24,22,22,24],[24,24,22,26],[26,24,22,26],[13,25,13,24]],
  trex: [[32,31,31,32],[32,27,30,32],[32,28,31,31],[32,28,31,31],[32,29,32,32],[31,28,31,31]],
};
export function headAnchor(species: PetSpecies, skin: number, pose: PetPose): HeadAnchor {
  const rows = PET_HEAD_ANCHORS[species];
  const index = Number.isInteger(skin) && skin >= 0 && skin < rows.length ? skin : 0;
  const poseIndex = Math.max(0, PET_POSES.indexOf(pose));
  return { ...rows[index][poseIndex], width: HEAD_WIDTHS[species][index][poseIndex] };
}
