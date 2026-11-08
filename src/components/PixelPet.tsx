import type { PetSpecies } from '../petGame';

// Cada forma está construida con bloques enteros; las variantes también cambian marcas y detalles.
const colors: Record<PetSpecies, string[][]> = {
  cat: [['#bd8350','#efd0a0','#69452e','#ffd878'],['#ead6b2','#fff0d7','#77564c','#8dccec'],['#343747','#777b8e','#20212c','#a5e46c'],['#f4dfbf','#fff4da','#69432d','#f3ad65'],['#8a9eaf','#bdcbd1','#546775','#a8d38c'],['#e49446','#ffdb9e','#a65c2d','#9dc974']],
  dragon: [['#4aab80','#a4ddb1','#28715f','#f4c671'],['#cd6265','#f6b5a0','#893f55','#ffdb8b'],['#539aba','#a7d9dc','#346580','#f9d785'],['#9674c0','#d0bde8','#5f4a89','#f7d58d'],['#dda64d','#fce4a1','#a66b3d','#b4774d'],['#a4c9d1','#e1f6f0','#6497ad','#e7ae93']],
  monkey: [['#9b6442','#e9c696','#603d32','#ffd07c'],['#cd9952','#f4d6a2','#8d5d35','#a5cc79'],['#d8d2c5','#f5e4c8','#989388','#c58d77'],['#82905c','#d9c496','#536447','#f2cb72'],['#bf7950','#f0c49a','#844638','#a8d1bd'],['#586173','#c2ac9a','#333c4b','#d0b9ec']],
  chicken: [['#f3ca61','#fff0aa','#c78937','#f28d5b'],['#e9d9b8','#fff2d8','#a78868','#d76450'],['#c98956','#f2cd9e','#8f5d3d','#d85849'],['#e5e7e2','#ffffff','#a4b6b5','#ed846d'],['#bcadd5','#eee1f0','#8476a7','#f0a674'],['#596477','#aab6bf','#394656','#ed9d6d']],
  trex: [['#72aa79','#c5deb0','#497859','#f1cc78'],['#c77260','#efb79e','#8d4b49','#e9c36c'],['#5e9fa2','#afdfd0','#37747d','#f5d387'],['#987fae','#d8c6db','#685a84','#e8c17a'],['#c3a064','#f1d7a6','#8a704c','#d98569'],['#9da49b','#dce2c9','#68776e','#d49c78']],
};

export function PixelPet({ species, skin, className = '' }: { species: PetSpecies; skin: number; className?: string }) {
  const [body, light, dark, accent] = colors[species][skin] || colors[species][0];
  const R = (x: number, y: number, w: number, h: number, fill: string, key: string) => <rect key={key} x={x} y={y} width={w} height={h} fill={fill} />;
  const common = [R(6,13,12,7,dark,'bodyborder'),R(7,13,10,6,body,'body'),R(8,18,3,3,dark,'foot1'),R(13,18,3,3,dark,'foot2'),R(8,17,3,3,body,'foot3'),R(13,17,3,3,body,'foot4')];
  return <svg viewBox="0 0 24 24" shapeRendering="crispEdges" className={className} role="img" aria-label={`${species === 'cat' ? 'Gato' : species === 'dragon' ? 'Dragón' : species === 'monkey' ? 'Mono' : species === 'chicken' ? 'Pollo' : 'T. rex'} pixel art`}>
    {species === 'cat' && <>
      {R(17,14,3,2,dark,'tail1')}{R(19,10,2,5,dark,'tail2')}{R(18,11,2,4,body,'tail3')}{common}
      {skin === 5 && <>{R(5,3,2,4,dark,'tuft1')}{R(17,3,2,4,dark,'tuft2')}</>}
      {R(5,5,3,6,dark,'ear1')}{R(16,5,3,6,dark,'ear2')}{R(6,6,2,4,body,'ear3')}{R(16,6,2,4,body,'ear4')}
      {R(6,8,12,8,dark,'head0')}{R(5,9,14,5,dark,'head1')}{R(6,8,12,7,body,'head2')}{R(7,12,10,3,light,'muzzle')}
      {skin === 1 && <>{R(6,8,3,4,dark,'s1')}{R(15,8,3,4,dark,'s2')}</>}
      {(skin === 0 || skin === 5) && <>{R(9,8,1,3,dark,'stripe1')}{R(12,8,1,3,dark,'stripe2')}{R(7,16,2,1,dark,'stripe3')}{R(15,16,2,1,dark,'stripe4')}</>}
      {skin === 3 && <>{R(6,8,4,3,dark,'patch1')}{R(14,8,4,3,accent,'patch2')}{R(13,15,3,2,accent,'patch3')}</>}
      {R(8,11,2,2,dark,'eye1')}{R(14,11,2,2,dark,'eye2')}{R(9,11,1,1,accent,'shine1')}{R(14,11,1,1,accent,'shine2')}{R(11,13,2,1,dark,'nose')}
    </>}
    {species === 'dragon' && <>
      {R(2,11,6,7,dark,'wing1')}{R(3,10,4,6,accent,'wing2')}{R(16,11,6,7,dark,'wing3')}{R(17,10,4,6,accent,'wing4')}{R(18,18,3,2,dark,'tail')}{common}
      {R(8,4,2,4,accent,'horn1')}{R(14,4,2,4,accent,'horn2')}{R(6,7,12,9,dark,'head')}{R(7,7,10,8,body,'face')}{R(8,12,8,3,light,'snout')}{R(8,10,2,2,dark,'e1')}{R(14,10,2,2,dark,'e2')}{R(11,14,2,1,dark,'nose')}{R(10,16,4,3,light,'belly')}
    </>}
    {species === 'monkey' && <>
      {R(17,14,3,2,dark,'tail1')}{R(19,12,2,4,dark,'tail2')}{R(18,11,3,2,dark,'tail3')}{common}{R(9,15,6,4,light,'belly')}
      {R(4,8,4,5,dark,'ear1')}{R(16,8,4,5,dark,'ear2')}{R(5,9,3,3,light,'ear3')}{R(16,9,3,3,light,'ear4')}{R(7,6,10,10,dark,'head')}{R(8,7,8,8,body,'face')}{R(8,10,8,5,light,'muzzle')}{R(9,10,2,2,dark,'eye1')}{R(13,10,2,2,dark,'eye2')}{R(10,13,4,1,dark,'mouth')}
    </>}
    {species === 'chicken' && <>
      {R(6,10,12,10,dark,'outer')}{R(5,12,14,6,dark,'outer2')}{R(6,10,12,9,body,'body')}{R(7,14,10,5,light,'belly')}{R(9,19,2,2,accent,'foot1')}{R(14,19,2,2,accent,'foot2')}{R(6,13,2,4,dark,'wing1')}{R(16,13,2,4,dark,'wing2')}
      {R(8,6,8,7,dark,'head')}{R(9,6,6,6,body,'face')}{R(10,4,2,3,accent,'comb1')}{R(12,5,2,2,accent,'comb2')}{R(9,9,1,2,dark,'eye1')}{R(14,9,1,2,dark,'eye2')}{R(11,11,2,2,accent,'beak')}
    </>}
    {species === 'trex' && <>
      {R(3,15,5,3,dark,'tail1')}{R(2,14,4,2,body,'tail2')}{R(5,12,3,2,accent,'spike1')}{R(7,10,3,3,accent,'spike2')}{common}{R(9,15,6,4,light,'belly')}{R(8,6,10,9,dark,'head')}{R(9,6,8,8,body,'face')}{R(15,9,5,5,dark,'snout1')}{R(15,9,4,4,body,'snout2')}{R(13,13,6,2,light,'jaw')}{R(12,8,2,2,dark,'eye')}{R(17,10,1,1,dark,'nose')}{R(16,15,3,2,dark,'arm')}{R(16,15,2,1,body,'arm2')}
    </>}
  </svg>;
}
