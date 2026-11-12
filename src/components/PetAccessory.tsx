import { PET_ACCESSORIES } from '../petGame';

// Bounds of the visible artwork, including strokes, so its bottom edge is a
// predictable contact point instead of the empty padding in the original SVG.
const ART_BOUNDS = [
  '12 5 76 64', '8 4 84 65', '8 22 84 40', '18 16 64 56', '24 10 53 59',
  '23 18 54 42', '19 20 63 45', '14 6 72 62', '16 25 68 37', '12 10 76 56',
  '17 18 64 43', '22 13 56 52', '21 17 58 48', '24 16 52 46', '17 25 66 24',
  '17 11 65 52', '21 11 43 54', '17 19 66 49', '24 20 52 46', '28 16 44 50',
  '20 20 60 40', '17 25 66 36', '26 19 48 50', '25 19 50 50', '23 14 54 54',
] as const;

/** Iconos de píxel vectoriales, compartidos por el vestidor y la escena. */
export function PetAccessory({ id, className = '' }: { id: number; className?: string }) {
  const item = PET_ACCESSORIES[id]; if (!item) return null;
  if (item.companion) return <img aria-hidden="true" alt="" src={item.companion.image} className={className} style={{ objectFit: 'contain', imageRendering: 'pixelated', filter: item.companion.filter }} />;
  const { kind, variant } = item;
  const ink = '#303047', main = variant ? '#7661b1' : '#cf554d', light = variant ? '#dcd3f3' : '#ffe6c5';
  return <svg aria-hidden="true" className={className} viewBox={ART_BOUNDS[kind]} preserveAspectRatio="xMidYMax meet" shapeRendering="crispEdges">
    {kind === 0 && <>
      {/* Silueta continua: el cuerpo une el pompón con la banda de pelo. */}
      <path fill={ink} d="M13 53h7v-9h5v-9h6v-9h6v-9h9V9h10v5h8v6h7v9h5v9h4v15h8v16H12V53z"/>
      <path fill={variant ? '#35845b' : '#b92738'} d="M22 53v-9h6v-9h6v-9h7v-9h10v5h8v6h7v9h7v16z"/>
      <path fill={variant ? '#64b982' : '#e65053'} d="M29 48v-9h6v-9h7v-8h8v7h7v7h7v12z"/>
      <path fill={variant ? '#a8db9d' : '#f58273'} d="M38 33h5v-7h6v5h5v5h-8v5h-8z"/>
      <path fill="#d8d4c9" d="M14 54h73v13H14z"/><path fill="#fff9ec" d="M17 55h67v8H17z"/><path fill="#fff" d="M23 56h8v4h-8zm18 0h8v4h-8zm18 0h8v4h-8z"/>
      <path fill={ink} d="M43 5h14v4h5v10h-5v5H43v-5h-5V9h5z"/><path fill="#fff8eb" d="M43 9h14v10H43z"/><path fill="#fff" d="M45 9h7v5h-7z"/>
      {variant ? <path fill="#f2d16c" d="M68 42h5v5h-5z"/> : <path fill="#f6d079" d="M61 41h4v4h4v4h-4v4h-4v-4h-4v-4h4z"/>}
    </>}
    {kind === 1 && <><path fill="#211d38" d="M8 58h84v11H8zM19 52h62v7H19zM27 52L43 10h7V4h8v8h5v8h5v10h5v12h6v10z"/><path fill={variant?'#655077':'#394b85'} d="M32 51l14-36h8v9h7v9h6v10h5v8z"/><path fill={variant?'#a181aa':'#6b80bb'} d="M36 44l11-27h4v9h5v7h5v6h-7v-5h-6v8z"/><path fill="#bf914f" d="M28 46h45v7H28z"/><path fill="#f6d889" d="M31 47h38v3H31zM47 29h3v4h4v3h-4v4h-3v-4h-4v-3h4zM59 39h3v3h-3z"/><path fill="#474265" d="M12 60h76v5H12z"/></>}
    {kind === 2 && <><path fill="#302020" d="M8 54h84v8H8zM19 49h62v7H19zM25 22h13v7h24v-7h13v29H25z"/><path fill={variant?'#ba8250':'#94613a'} d="M30 28h7v6h26v-6h7v20H30z"/><path fill="#d8a66d" d="M32 30h4v6h28v-6h4v5H32z"/><path fill="#693f2e" d="M29 41h42v8H29z"/><path fill="#e9bd6b" d="M44 41h12v8H44z"/><path fill="#6e4a31" d="M47 43h6v4h-6z"/><path fill="#bc8c59" d="M13 56h74v3H13z"/></>}
    {kind === 3 && <><path fill="#35231e" d="M31 25h13v-9h11v9h14v5h9v7h4v23h-5v7h-9v5H32v-5h-9v-7h-5V37h5v-7h8z"/><path fill={variant?'#eea847':'#d9702f'} d="M29 33h42v6h6v20h-6v6H29v-6h-6V39h6z"/><path fill="#f2a143" d="M37 31h9v34h-9zM54 31h9v34h-9z"/><path fill="#b85224" d="M33 37h3v20h-3zm30 0h3v20h-3z"/><path fill="#48683b" d="M46 17h8v14h-8zm7 0h12v5H53z"/><path fill="#f8d079" d="M33 36h4v4h-4zm23-2h4v4h-4z"/><path fill="#39241e" d="M33 43h7v6h-7zm27 0h7v6h-7zM38 55h24v4H38z"/></>}
    {kind === 4 && <><path fill="#304c32" d="M46 35h8v34h-8zM31 30h15v6H31zM54 25h15v6H54z"/><path fill="#4d8b50" d="M24 25h11v6h11v10H34v-5H24zm30 0h9v-6h14v10h-7v6H54z"/><path fill="#9bd180" d="M27 27h8v4h6v4h-7v-3h-7zm32-3h6v-3h8v4h-5v4h-9z"/>{!!variant && <><path fill="#8c546e" d="M43 10h14v6h7v12h-7v7H43v-7h-7V16h7z"/><path fill="#eaa7ba" d="M44 13h12v5h5v9h-5v5H44v-5h-5v-9h5z"/><path fill="#f4d06c" d="M46 20h8v7h-8z"/></>}</>}
    {kind === 5 && <><path fill="#553044" d="M23 24h10v-6h13v7h8v-7h13v6h10v20H70v8h-8v8H38v-8h-8v-8h-7z"/><path fill={variant?'#55b9e8':'#d5455a'} d="M28 25h13v7h18v-7h13v17h-8v8h-8v6H44v-6h-8v-8h-8z"/><path fill={variant ? '#a6e4fa' : '#f78c97'} d="M31 26h8v5h7v5H31zm24 18h7v5h-7z"/><path fill={variant ? '#e8faff' : '#ffd6cc'} d="M32 28h5v5h-5z"/></>}
    {kind === 6 && <><path fill="#5a3a2b" d="M19 23h9v8h10V20h9v10h7V20h9v11h10v-8h9v42H19z"/><path fill="#c9923f" d="M24 34h18v-8h4v11h9V26h4v8h18v25H24z"/><path fill="#f3d46d" d="M28 36h13v4H28zm19 0h7v4h-7zm13 0h13v4H60zM25 56h50v4H25z"/><path fill={variant?'#ed9fac':'#87b6c8'} d="M31 46h6v7h-6zm16 0h6v7h-6zm16 0h6v7h-6z"/><path fill="#fff3be" d="M32 46h3v3h-3zm16 0h3v3h-3zm16 0h3v3h-3z"/></>}
    {kind === 7 && <><path fill={ink} d="M45 8h10l26 54H19zM14 60h72v8H14z"/><path fill={variant?'#e79a66':'#72a8c7'} d="M49 18l23 42H28z"/><path fill="#f7d877" d="M39 40h7v7h-7zm17-9h7v7h-7zm1 21h7v7h-7zM46 6h8v9h-8z"/></>}
    {kind === 8 && <><path fill={ink} d="M16 25h68v26H73v11H27V51H16z"/><path fill={variant?'#f3eee2':'#555666'} d="M21 30h58v17H68v10H32V47H21z"/><path fill={variant?'#54769b':'#e7e2cf'} d="M44 34h12v12H44zM39 48h22v4H39z"/></>}
    {kind === 9 && <><path fill={ink} d="M20 52h60v14H20zM22 46H12V25h10V17h16v-7h24v7h16v8h10v21H78v6z"/><path fill="#faf1d9" d="M18 26h11v-7h16v-6h11v6h16v7h10v17H18zM25 51h50v10H25z"/><path fill={main} d="M27 49h46v5H27z"/></>}
    {kind === 10 && <><path fill={ink} d="M17 43h8V29h10v-6h28v-5h10v5h8v20h-6v18H25V49h-8z"/><path fill={main} d="M23 36h8v-7h36v-5h6v6h5v13H23zM30 43h40v12H30z"/><path fill={light} d="M31 46h37v4H31z"/></>}
    {kind === 11 && <><path fill={ink} d="M22 50h56v15H22zM26 36h7V25h8v-6h18v6h8v11h7v14H26z"/><path fill={variant?'#78a8c9':'#bd6273'} d="M31 38h7V28h24v10h7v12H31z"/><path fill={light} d="M22 52h56v10H22zM45 13h10v10H45z"/></>}
    {kind === 12 && <><path fill={ink} d="M21 27h8V17h42v10h8v38H21z"/><path fill={variant?'#a18b6f':'#9da9b5'} d="M27 28h7v-7h32v7h7v31H27z"/><path fill={ink} d="M30 40h40v7H30zM44 48h12v11H44z"/><path fill="#eff3e5" d="M34 31h32v4H34z"/></>}
    {kind === 13 && <><path fill={ink} d="M24 62V23h8v-7h8v23h20V16h8v7h8v39h-8V49H32v13z"/><path fill={main} d="M28 23h8v20h28V23h8v35h-6V45H34v13h-6z"/><path fill={light} d="M31 27h5v12h-5zm34 0h5v12h-5z"/></>}
    {kind === 14 && <><path fill={variant ? '#657487' : '#85633f'} d="M17 31h8v-6h50v6h8v12h-8v6H25v-6h-8z"/><path fill={variant?'#d8e3f1':'#f9db74'} d="M25 29h50v5H25zM21 34h7v7h-7zm51 0h7v7h-7zM27 41h46v5H27z"/></>}
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
    {/* Costuras, reflejos y textura fina en los diseños conservados. */}
    {kind === 0 && <><path fill={variant ? '#88d7a0' : '#ff9f91'} d="M31 45h2v-3h2v-3h2v-3h2v2h-2v3h-2v3h-2v3h-2zM54 32h2v3h2v3h2v3h-2v-2h-2v-3h-2z"/><path fill="#c6c1b6" d="M18 63h3v2h-3zm12 0h3v2h-3zm12 0h3v2h-3zm12 0h3v2h-3zm12 0h3v2h-3zm12 0h3v2h-3z"/></>}
    {kind === 1 && <path fill="#e6d0a0" d="M35 48h2v2h-2zm7 0h2v2h-2zm17 0h2v2h-2zm7 0h2v2h-2zM48 19h2v3h-2zm6 11h2v2h-2z"/>}
    {kind === 2 && <><path fill="#e5b983" d="M31 36h2v3h-2zm36 0h2v3h-2zM17 57h5v1h-5zm8 0h5v1h-5zm45 0h5v1h-5z"/><path fill="#fbe6a6" d="M45 42h2v2h-2zm9 0h1v2h-1z"/></>}
    {kind === 4 && <path fill="#c9eea2" d="M29 28h3v2h-3zm7 3h3v2h-3zm28-9h4v2h-4zM49 39h2v18h-2z"/>}
    {kind === 5 && <path fill={variant ? '#e7faff' : '#ffe9dd'} d="M34 27h3v3h-3zm5 4h3v2h-3zm22-4h4v2h-4z"/>}
    {kind === 7 && <><path fill="#fff1bd" d="M48 19h2v3h-2zm-8 19h2v2h-2zm16-7h2v2h-2zm-22 23h2v2h-2zm27-3h2v2h-2z"/><path fill={variant ? '#c47552' : '#4f84a9'} d="M46 26h2v3h-2zm9 14h2v3h-2zM28 58h44v2H28z"/></>}
    {kind === 11 && <><path fill={variant ? '#afd7ec' : '#eaa2aa'} d="M35 36h3v2h-3zm5-5h3v2h-3zm6 0h3v2h-3zm6 0h3v2h-3zm6 0h3v2h-3zM34 41h4v2h-4zm7 0h4v2h-4zm7 0h4v2h-4zm7 0h4v2h-4zm7 0h4v2h-4z"/><path fill="#fff" d="M47 14h5v3h-5z"/></>}
    {kind === 11 && <path fill="#fff" d="M28 54h4v2h-4zm8 0h4v2h-4zm8 0h4v2h-4zm8 0h4v2h-4zm8 0h4v2h-4zm8 0h4v2h-4z"/>}
    {/* Luces y detalles escalonados: mismos píxeles y paleta cálida de los sprites. */}
    {kind === 7 && <path fill="#fff0bd" d="M47 20h4v5h-4zM34 53h4v4h-4zm25 0h4v4h-4z"/>}
    {kind === 8 && <><path fill="#c8a772" d="M20 28h60v3H20zM27 55h46v3H27z"/><path fill="#f3d38d" d="M45 36h10v3H45z"/></>}
    {kind === 9 && <><path fill="#ded3bc" d="M17 41h66v5H17zM25 60h50v3H25z"/><path fill="#fff" d="M32 21h8v3h-8zm20-6h8v3h-8z"/></>}
    {kind === 10 && <><path fill="#f2aa91" d="M30 31h19v3H30z"/><path fill="#6b4050" d="M29 51h42v4H29z"/></>}
    {kind === 11 && <><path fill="#e8c2c0" d="M38 29h6v4h-6zm14 0h6v4h-6z"/><path fill="#a8bbce" d="M25 59h50v3H25z"/></>}
    {kind === 12 && <><path fill="#dbe0df" d="M30 26h5v9h-5zm9-4h21v3H39z"/><path fill="#6b7181" d="M30 52h5v5h-5zm35 0h5v5h-5z"/></>}
    {kind === 13 && <path fill="#f5c7ac" d="M29 29h3v8h-3zm38 0h3v8h-3z"/>}
    {kind === 14 && <path fill={variant ? '#f4f9ff' : '#fff5c5'} d="M28 29h20v3H28zm36 6h8v3h-8z"/>}
    {kind === 15 && <path fill="#fff4b7" d="M48 23h4v13h7v3h-7v10h-4V39h-7v-3h7z"/>}
    {kind === 16 && <path fill="#fff5bc" d="M32 28h4v18h-4zm7-8h7v4h-7z"/>}
    {kind === 17 && <path fill="#fff" d="M30 37h8v-6h10v-4h8v4H45v6h-7v4h-8z"/>}
    {kind === 18 && <><path fill="#fff0ca" d="M33 38h7v4h-7zm25 0h6v4h-6z"/><path fill="#ddbaa1" d="M46 59h8v3h-8z"/></>}
    {kind === 19 && <><path fill="#fff" d="M36 27h5v5h-5zm18-5h5v4h-5z"/><path fill="#b6c1cf" d="M33 53h5v5h-5zm29 0h5v5h-5z"/></>}
    {kind === 20 && <path fill="#fff2c0" d="M23 23h5v4h-5zm49 0h5v4h-5zm-43 26h5v4h-5zm38 0h5v4h-5z"/>}
    {kind === 21 && <path fill="#f5c7c9" d="M25 34h5v5h-5zm45 0h5v5h-5zM46 37h3v7h-3z"/>}
    {kind === 22 && <path fill="#f2d79a" d="M36 26h5v4h-5zm21 0h5v4h-5z"/>}
    {kind === 23 && <><path fill="#f9df92" d="M35 23h30v3H35zM32 54h36v4H32z"/><path fill="#fff8d4" d="M43 32h4v10h-4z"/></>}
    {kind === 24 && <><path fill="#d9c9f5" d="M38 25h4v9h-4zM60 26h4v8h-4z"/><path fill="#655b91" d="M32 39h36v3H32z"/></>}
  </svg>;
}
