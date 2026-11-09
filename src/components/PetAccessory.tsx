import { PET_ACCESSORIES } from '../petGame';

const COLORS = [
  ['#e5ab4e', '#ffe2a1', '#79532b'], ['#5da5bd', '#c2eff1', '#305b73'],
  ['#a984ca', '#ead7f4', '#594374'], ['#6caa78', '#d0edbb', '#3f694c'], ['#c86872', '#ffd2c0', '#803e55'],
];

/** Los tocados flotan sobre la mascota y los efectos alrededor: no dependen de la forma de su cabeza. */
export function PetAccessory({ id, className = '' }: { id: number; className?: string }) {
  const item = PET_ACCESSORIES[id];
  if (!item) return null;
  const [main, light, dark] = COLORS[item.color];
  return <svg aria-hidden="true" className={className} viewBox="0 0 100 60" shapeRendering="crispEdges">
    {item.kind === 0 && <><path fill={dark} d="M19 39h62v9H19zM25 20h50v21H25z"/><path fill={main} d="M29 19h42v20H29z"/><path fill={light} d="M32 23h34v4H32z"/><path fill={dark} d="M38 30h24v4H38z"/></>}
    {item.kind === 1 && <><path fill={dark} d="M22 16h8v8h8v-6h8V8h8v10h8v6h8v-8h8v30H22z"/><path fill={main} d="M27 24h10v8h8V22h10v10h8v-8h10v18H27z"/><path fill={light} d="M31 36h38v4H31zM47 28h6v6h-6z"/></>}
    {item.kind === 2 && <><path fill={dark} d="M46 3h8v8h7v9h7v11h9v8H23v-8h9V20h7V11h7zM17 39h66v8H17z"/><path fill={main} d="M46 13h8v8h7v10h7v7H32v-7h7V21h7z"/><path fill={light} d="M47 25h6v3h3v5h-3v3h-6v-3h-3v-5h3z"/></>}
    {item.kind === 3 && <><path fill={dark} d="M27 20h9v-5h29v5h10v19H25v-9h-5v-6h7z"/><path fill={main} d="M30 21h40v14H27v-8h3z"/><path fill={light} d="M37 19h24v4H37zM25 35h50v5H25z"/></>}
    {item.kind === 4 && <><path fill={dark} d="M20 19h10v4h12v6h16v-6h12v-4h10v23H70v-4H58v-4H42v4H30v4H20z"/><path fill={main} d="M25 24h9v4h8v7h-8v3h-9zm50 0h-9v4h-8v7h8v3h9z"/><path fill={light} d="M44 26h12v10H44z"/></>}
    {item.kind === 5 && <><path fill={dark} d="M23 19h8v-5h38v5h8v6h-8v5H31v-5h-8z"/><path fill={main} d="M31 18h38v4H31zM27 22h6v4h-6zm40 0h6v4h-6z"/><path fill={light} d="M35 15h30v3H35z"/></>}
    {item.kind === 6 && <><path fill={main} d="M18 15h6v6h6v6h-6v6h-6v-6h-6v-6h6zm50-3h6v6h6v6h-6v6h-6v-6h-6v-6h6zM45 27h6v6h6v6h-6v6h-6v-6h-6v-6h6z"/><path fill={light} d="M20 21h4v6h-4zm50-3h4v6h-4zm-23 15h4v6h-4z"/></>}
    {item.kind === 7 && <><path fill={main} d="M16 21h8v5h6v7h-6v5h-8v-5h-5v-7h5zm55-9h8v5h6v7h-6v5h-8v-5h-5v-7h5zM44 30h8v5h6v7h-6v5h-8v-5h-5v-7h5z"/><path fill={light} d="M18 27h5v5h-5zm55-9h5v5h-5zm-27 18h5v5h-5z"/></>}
    {item.kind === 8 && <><path fill={dark} d="M43 7h18v6H51v7h-4v12h4v7h10v6H43v-5h-8v-6h-5V19h5v-6h8z"/><path fill={main} d="M43 13h9v7h-5v14h5v5h-9v-5h-7V20h7z"/><path fill={light} d="M39 18h5v13h-5z"/></>}
    {item.kind === 9 && <><path fill={main} d="M20 10h4v9h8v4h-8v9h-4v-9h-8v-4h8zm48 12h4v8h8v4h-8v8h-4v-8h-8v-4h8zM44 9h4v5h5v4h-5v5h-4v-5h-5v-4h5z"/><path fill={light} d="M21 19h2v4h-2zm48 11h2v4h-2z"/></>}
    {/* Cada variante incorpora una silueta propia, no solo un cambio de color. */}
    {item.color === 1 && <path fill={light} d="M10 35h4v4h4v4h-4v4h-4v-4H6v-4h4zM86 35h4v4h4v4h-4v4h-4v-4h-4v-4h4z" />}
    {item.color === 2 && <path fill={light} d="M9 34h3v3h3v3h-3v3H9v-3H6v-3h3zm77-3h4v4h4v4h-4v4h-4v-4h-4v-4h4z" />}
    {item.color === 3 && <path fill={light} d="M7 34h5v3h3v5h-5v-3H7zm79 0h5v3h3v5h-5v-3h-3z" />}
    {item.color === 4 && <path fill={light} d="M9 33h3v3h3v5h-3v3H9v-3H6v-5h3zm78 0h3v3h3v5h-3v3h-3v-3h-3v-5h3z" />}
  </svg>;
}
