import { PET_ACCESSORIES } from '../petGame';

// Bounds of the visible artwork, including strokes, so its bottom edge is a
// predictable contact point instead of the empty padding in the original SVG.
const ART_BOUNDS = [
  '18 7 65 62', '8 8 84 61', '8 24 84 38', '21 17 58 53', '25 10 50 59',
  '23 18 54 42', '19 20 63 45', '14 6 72 62', '16 25 68 37', '12 10 76 56',
  '17 18 64 43', '22 13 56 52', '21 17 58 48', '24 16 52 46', '17 25 66 24',
  '17 11 65 52', '21 11 43 54', '17 19 66 49', '24 20 52 46', '28 16 44 50',
  '20 20 60 40', '17 25 66 36', '26 19 48 50', '25 19 50 50', '23 14 54 54',
] as const;

/** Iconos de píxel vectoriales, compartidos por el vestidor y la escena. */
export function PetAccessory({ id, className = '' }: { id: number; className?: string }) {
  const item = PET_ACCESSORIES[id]; if (!item) return null;
  const { kind, variant } = item;
  const ink = '#303047', main = variant ? '#7661b1' : '#cf554d', light = variant ? '#dcd3f3' : '#ffe6c5';
  return <svg aria-hidden="true" className={className} viewBox={ART_BOUNDS[kind]} preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges">
    {kind === 0 && <><path fill={ink} d="M18 57h65v12H18zM25 48h48V29H58V15H46V9H35v14h-7v17h-3z"/><path fill={variant?'#529b69':'#c83b42'} d="M30 48V27h8V15h8v8h12v13h9v12z"/><path fill="#fff7e6" d="M19 57h62v9H19zM33 7h13v10H33z"/><path fill="#f6cb64" d="M49 38h8v7h-8z"/></>}
    {kind === 1 && <><path fill={ink} d="M8 59h84v10H8zM20 54h60v6H20zM28 51h44L55 8H44z"/><path fill={variant?'#765584':'#3f4f9c'} d="M35 52l14-36 16 36z"/><path fill="#e3b65e" d="M35 48h30v6H35zM46 31h5v5h5v5h-5v5h-5v-5h-5v-5h5z"/></>}
    {kind === 2 && <><path fill={ink} d="M8 54h84v8H8zM20 48h60v8H20zM27 24h13v7h20v-7h13v27H27z"/><path fill={variant?'#c58b4f':'#90603c'} d="M31 29h8v6h22v-6h8v19H31z"/><path fill="#eed39d" d="M29 43h42v5H29zM46 42h9v7h-9z"/></>}
    {kind === 3 && <><path fill={ink} d="M29 28h42v6h8v29h-8v7H29v-7h-8V34h8zM46 17h9v12h-9z"/><path fill="#e68b39" d="M29 34h42v29H29z"/><path fill="#f9b44d" d="M39 33h8v31h-8zm15 0h8v31h-8z"/><path fill="#527b42" d="M46 18h8v12h-8zM52 18h13v6H52z"/><path fill={ink} d="M33 42h6v6h-6zm28 0h6v6h-6zM39 55h22v4H39z"/></>}
    {kind === 4 && <><path fill="#4c7e48" d="M47 43h6v25h-6zM35 36h12v6H35zM53 30h12v6H53z"/><path fill="#72b56a" d="M25 28h11v7h11v8H34v-6h-9zm29 0h9v-7h12v9h-6v7H54z"/>{!!variant && <><path fill="#f2b3c9" d="M43 10h14v6h7v12h-7v7H43v-7h-7V16h7z"/><path fill="#e8b954" d="M46 19h8v8h-8z"/></>}</>}
    {kind === 5 && <><path fill={ink} d="M23 24h10v-6h13v7h8v-7h13v6h10v20H70v8h-8v8H38v-8h-8v-8h-7z"/><path fill={variant?'#ed8caf':'#e95466'} d="M28 25h13v7h18v-7h13v17h-8v8h-8v6H44v-6h-8v-8h-8z"/><path fill="#ffd5dd" d="M33 28h7v7h-7z"/></>}
    {kind === 6 && <><path fill={ink} d="M19 23h9v8h10V20h9v10h7V20h9v11h10v-8h9v42H19z"/><path fill="#eabb4b" d="M24 34h18v-8h4v11h9V26h4v8h18v25H24z"/><path fill={variant?'#eea7ba':'#f7df8b'} d="M30 46h6v6h-6zm17 0h6v6h-6zm17 0h6v6h-6z"/></>}
    {kind === 7 && <><path fill={ink} d="M45 8h10l26 54H19zM14 60h72v8H14z"/><path fill={variant?'#e79a66':'#72a8c7'} d="M49 18l23 42H28z"/><path fill="#f7d877" d="M39 40h7v7h-7zm17-9h7v7h-7zm1 21h7v7h-7zM46 6h8v9h-8z"/></>}
    {kind === 8 && <><path fill={ink} d="M16 25h68v26H73v11H27V51H16z"/><path fill={variant?'#f3eee2':'#555666'} d="M21 30h58v17H68v10H32V47H21z"/><path fill={variant?'#54769b':'#e7e2cf'} d="M44 34h12v12H44zM39 48h22v4H39z"/></>}
    {kind === 9 && <><path fill={ink} d="M20 52h60v14H20zM22 46H12V25h10V17h16v-7h24v7h16v8h10v21H78v6z"/><path fill="#faf1d9" d="M18 26h11v-7h16v-6h11v6h16v7h10v17H18zM25 51h50v10H25z"/><path fill={main} d="M27 49h46v5H27z"/></>}
    {kind === 10 && <><path fill={ink} d="M17 43h8V29h10v-6h28v-5h10v5h8v20h-6v18H25V49h-8z"/><path fill={main} d="M23 36h8v-7h36v-5h6v6h5v13H23zM30 43h40v12H30z"/><path fill={light} d="M31 46h37v4H31z"/></>}
    {kind === 11 && <><path fill={ink} d="M22 50h56v15H22zM26 36h7V25h8v-6h18v6h8v11h7v14H26z"/><path fill={variant?'#78a8c9':'#bd6273'} d="M31 38h7V28h24v10h7v12H31z"/><path fill={light} d="M22 52h56v10H22zM45 13h10v10H45z"/></>}
    {kind === 12 && <><path fill={ink} d="M21 27h8V17h42v10h8v38H21z"/><path fill={variant?'#a18b6f':'#9da9b5'} d="M27 28h7v-7h32v7h7v31H27z"/><path fill={ink} d="M30 40h40v7H30zM44 48h12v11H44z"/><path fill="#eff3e5" d="M34 31h32v4H34z"/></>}
    {kind === 13 && <><path fill={ink} d="M24 62V23h8v-7h8v23h20V16h8v7h8v39h-8V49H32v13z"/><path fill={main} d="M28 23h8v20h28V23h8v35h-6V45H34v13h-6z"/><path fill={light} d="M31 27h5v12h-5zm34 0h5v12h-5z"/></>}
    {kind === 14 && <><path fill="#85633f" d="M17 31h8v-6h50v6h8v12h-8v6H25v-6h-8z"/><path fill={variant?'#d2d9f6':'#f9db74'} d="M25 29h50v5H25zM21 34h7v7h-7zm51 0h7v7h-7zM27 41h46v5H27z"/></>}
    {kind === 15 && <><path fill="#d49646" d="M46 11h8v17h13v8h-9v13h-8v14h-8V49h-9V36h-9v-8h22z"/><path fill="#ffe68a" d="M47 21h6v14h9v5h-9v13h-6V40h-9v-5h9z"/>{!!variant && <path fill="#f5d977" d="M17 18h6v6h-6zm58 27h7v7h-7z"/>}</>}
    {kind === 16 && <><path fill="#e6b456" d="M39 11h22v8H48v9h-7v21h7v8h16v8H39v-7H27v-9h-6V27h6v-9h12z"/><path fill="#ffe7a4" d="M39 18h9v10h-7v21h7v8h-9v-7h-7V27h7z"/>{!!variant && <circle cx="51" cy="39" r="13" fill="#f5b64b"/>}</>}
    {kind === 17 && <><path fill="#98b4c5" d="M17 38h12v-9h10V19h22v8h11v10h11v18H17z"/><path fill="#f2f6f4" d="M22 38h11v-9h12v-7h14v9h11v8h9v11H22z"/>{!!variant && <path stroke="#68a8d4" strokeWidth="5" d="M30 58v9m20-9v9m20-9v9"/>}</>}
    {kind === 18 && <><path fill={ink} d="M24 38h8V27h10v-7h16v7h10v11h8v12H59v16H41V50H24z"/><path fill={variant?'#b79a71':'#c75b58'} d="M29 39h8V29h26v10h8v8H29z"/><path fill="#f4e5ca" d="M45 50h10v12H45zM36 35h7v6h-7zm21 0h7v6h-7z"/></>}
    {kind === 19 && <><path fill={ink} d="M28 23h8v-7h28v7h8v43h-8v-6h-7v6H43v-6h-7v6h-8z"/><path fill={variant?'#d6ddf0':'#fff9e9'} d="M33 26h7v-6h20v6h7v32h-6v-5h-8v7h-7v-7h-8v5h-5z"/><path fill="#444459" d="M39 34h5v7h-5zm17 0h5v7h-5zM46 46h8v4h-8z"/></>}
    {kind === 20 && <><path fill={variant?'#e9ad45':'#b984ca'} d="M43 29H31v-9H20v17h8v10H20v13h12v-8h11v-7h14v7h11v8h12V47h-8V37h8V20H69v9H57z"/><path fill="#4c414d" d="M45 30h10v26H45z"/><path fill="#f9dfb9" d="M25 27h8v6h-8zm42 0h8v6h-8z"/></>}
    {kind === 21 && <><path fill={ink} d="M17 25h12v5h13v7h16v-7h13v-5h12v36H71v-6H58v-6H42v6H29v6H17z"/><path fill={main} d="M22 30h10v5h10v15H32v5H22zm56 0H68v5H58v15h10v5h10z"/><path fill={light} d="M44 35h12v14H44z"/></>}
    {kind === 22 && <><path fill="#527e43" d="M47 47h6v22h-6z"/><path fill={variant?'#68ad61':'#d28242'} d="M47 46H35v-7h-9V27h9v-8h12v8h6v-8h12v8h9v12h-9v7H53z"/><path fill="#c9db8b" d="M47 32h6v15h-6z"/></>}
    {kind === 23 && <><path fill="#9c7040" d="M39 19h22v7h7v27h7v7H25v-7h7V26h7zM45 62h10v7H45z"/><path fill={variant?'#d5eafa':'#f5ca61'} d="M39 27h22v27H39z"/><path fill="#fff1bd" d="M42 30h6v16h-6z"/></>}
    {kind === 24 && <><path fill="#4e567e" d="M38 14h24l15 24-27 30-27-30z"/><path fill={variant?'#a6e1e9':'#aa94df'} d="M41 19h18l12 19-21 24-21-24z"/><path fill="#f1effe" d="M43 24h6v11h-6zm12 15h5v10h-5z"/></>}
  </svg>;
}
