import { BookOpen, Compass, Feather, Headphones, Heart, Landmark, Rocket, Search, Skull, Sparkles, Theater, UserRound, type LucideIcon } from 'lucide-react';

const flags: Record<string, string> = {
  español: '🇪🇸', portugués: '🇵🇹', francés: '🇫🇷', alemán: '🇩🇪', italiano: '🇮🇹', neerlandés: '🇳🇱', sueco: '🇸🇪', noruego: '🇳🇴', danés: '🇩🇰', finés: '🇫🇮', polaco: '🇵🇱', checo: '🇨🇿', húngaro: '🇭🇺', rumano: '🇷🇴', griego: '🇬🇷', ruso: '🇷🇺', ucraniano: '🇺🇦', turco: '🇹🇷', árabe: '🇸🇦', hebreo: '🇮🇱', hindi: '🇮🇳', japonés: '🇯🇵', chino: '🇨🇳', coreano: '🇰🇷', indonesio: '🇮🇩', vietnamita: '🇻🇳', tailandés: '🇹🇭',
};
const genreIcons: Record<string, LucideIcon> = {
  fantasia: Sparkles, 'ciencia ficcion': Rocket, thriller: Search, romance: Heart,
  historica: Landmark, misterio: Search, aventura: Compass, terror: Skull,
  drama: Theater, poesia: Feather, biografia: UserRound, ensayo: Feather,
  juvenil: Sparkles, clasico: Landmark, contemporanea: BookOpen,
};

export function StatisticCategoryIcon({ type, label }: { type: 'language' | 'tag' | 'format'; label: string }) {
  if (type === 'language') {
    const language = label.trim().toLocaleLowerCase('es');
    if (language.startsWith('inglés')) {
      return <svg aria-hidden="true" viewBox="0 0 30 20" className="inline-block h-4 w-6 shrink-0 rounded-[2px] border border-line align-middle"><rect width="30" height="20" fill="white" /><path d="M 15 0 V 20 M 0 10 H 30" stroke="#c8102e" strokeWidth="4" /></svg>;
    }
    if (language === 'catalán') return <svg aria-hidden="true" viewBox="0 0 30 20" className="inline-block h-4 w-6 shrink-0 rounded-[2px] border border-line align-middle"><rect width="30" height="20" fill="#ffcc00" /><path d="M0 3h30M0 8h30M0 13h30M0 18h30" stroke="#c8102e" strokeWidth="2" /></svg>;
    if (language === 'euskera') return <svg aria-hidden="true" viewBox="0 0 30 20" className="inline-block h-4 w-6 shrink-0 rounded-[2px] border border-line align-middle"><rect width="30" height="20" fill="#d52b1e" /><path d="M0 0l30 20M30 0L0 20" stroke="#00843d" strokeWidth="5" /><path d="M15 0v20M0 10h30" stroke="white" strokeWidth="3" /></svg>;
    if (language === 'gallego') return <svg aria-hidden="true" viewBox="0 0 30 20" className="inline-block h-4 w-6 shrink-0 rounded-[2px] border border-line align-middle"><rect width="30" height="20" fill="white" /><path d="M0 0l30 20" stroke="#56a4d3" strokeWidth="5" /></svg>;
    return <span aria-hidden="true" className="inline-block text-base leading-none align-middle">{flags[language] || '🌐'}</span>;
  }
  if (type === 'format') {
    const style = "inline-block h-6 w-6 shrink-0 align-middle";
    if (label === 'Tapa dura') return <svg aria-hidden="true" viewBox="0 0 24 24" className={style}><rect x="3" y="2" width="17" height="20" rx="2" fill="rgb(var(--accent))" /><rect x="7" y="4" width="11" height="15" rx="1" fill="rgb(var(--surface))" opacity=".8" /><path d="M4 19h15M6 3v19" fill="none" stroke="rgb(var(--ink))" strokeWidth="1.3" /></svg>;
    if (label === 'Tapa blanda') return <svg aria-hidden="true" viewBox="0 0 24 24" className={style}><path d="M4 3h14l2 2v16H6a2 2 0 0 1-2-2z" fill="rgb(var(--accent))" opacity=".8" /><path d="M6 5v14a2 2 0 0 0 2 2h12M8 8h8M8 11h6" fill="none" stroke="rgb(var(--surface))" strokeWidth="1.4" strokeLinecap="round" /></svg>;
    if (label === 'Ebook') return <svg aria-hidden="true" viewBox="0 0 24 24" className={style}><rect x="4" y="1" width="16" height="22" rx="2.5" fill="rgb(var(--ink2))" /><rect x="6" y="4" width="12" height="14" rx=".5" fill="rgb(var(--surface))" /><path d="M8 7h8M8 10h8M8 13h5M10 20h4" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.2" strokeLinecap="round" /></svg>;
    const Icon = label === 'Audiolibro' ? Headphones : BookOpen;
    return <Icon aria-hidden="true" size={20} className="inline-block shrink-0 text-accent align-middle" />;
  }
  const key = label.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const Icon = genreIcons[key] || BookOpen;
  return <Icon aria-hidden="true" size={16} className="inline-block shrink-0 text-accent align-middle" />;
}
