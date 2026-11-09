import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, Crown, Flame, LockKeyhole, Sparkles, Star, Trophy } from 'lucide-react';
import type { Book } from '../types';
import { effectivePet, PET_ACCESSORIES, PET_BACKGROUNDS, PET_SPECIES, petProgress, SKIN_THRESHOLDS, type PetChallenge, type PetSettings, type PetSpecies } from '../petGame';
import { PixelPet } from './PixelPet';
import { headAnchor, PET_POSES, type PetPose } from '../petArt';
import { PetAccessory } from './PetAccessory';
import { ProgressBar } from './ui';

const number = (n: number) => n.toLocaleString('es');
const missions = [{ title: 'Una pequeña aventura', target: 10 }, { title: 'Un buen capítulo', target: 20 }, { title: 'Maratón de lectura', target: 50 }];
const milestones = [{ target: 100, icon: '🌱', title: 'Primer brote' }, { target: 300, icon: '🍄', title: 'Explorador del bosque' }, { target: 600, icon: '🔮', title: 'Guardián de historias' }, { target: 1000, icon: '🌙', title: 'Soñador de páginas' }, { target: 1600, icon: '👑', title: 'Leyenda del rincón' }];
function petName(pet: PetSettings) { return pet.name || PET_SPECIES.find(s => s.id === pet.species)!.label; }
function PetScene({ pet, className = '' }: { pet: PetSettings; className?: string }) {
  const pose = pet.pose || 'sentado';
  const head = headAnchor(pet.species, pet.skin, pose);
  const accessory = pet.accessory === null ? null : PET_ACCESSORIES[pet.accessory];
  return <div className={`pet-scene relative overflow-hidden ${className}`}>
    <div className="pet-scene-sky" style={{ backgroundImage: `url(${PET_BACKGROUNDS.find(item => item.id === pet.background)?.image || PET_BACKGROUNDS[0].image})` }} />
    <div className="pet-sprite absolute bottom-[8%] left-1/2 w-[40%] max-w-[190px] -translate-x-1/2">
      <PixelPet species={pet.species} skin={pet.skin} pose={pose} className="w-full drop-shadow-[0_9px_2px_rgba(33,44,32,.3)]" />
      {accessory && <div className="absolute pointer-events-none drop-shadow-md" style={accessory.placement === 'side' ? { width: '28%', bottom: '2%', left: head.x > 50 ? '4%' : '72%' } : { width: `${head.width}%`, left: `${head.x}%`, top: `${head.y}%`, transform: `translate(-50%, ${[5, 14, 15, 16, 17, 20, 24].includes(accessory.kind) ? '-110%' : '-96%'})` }}><PetAccessory id={accessory.id} className="w-full" /></div>}
    </div>
  </div>;
}

export function PetHomeCard({ books, pet, challenge, onOpen }: { books: Book[]; pet: PetSettings; challenge: PetChallenge | null; onOpen: () => void }) {
  const progress = petProgress(books, new Date(), challenge); const active = effectivePet(pet, progress.total);
  return <button type="button" onClick={onOpen} className="w-full rounded-card border border-line bg-surface shadow-card overflow-hidden text-left flex items-stretch group hover:shadow-lift transition-shadow" aria-label="Abrir Mi mascota">
    <PetScene pet={active} className="w-28 sm:w-40 shrink-0 min-h-[120px]" />
    <span className="p-4 sm:p-5 flex flex-col justify-center flex-1 min-w-0"><span className="text-[10px] font-extrabold tracking-[.15em] uppercase text-accent">Tu compañero lector</span><span className="font-display text-xl font-semibold text-ink mt-1 truncate">{petName(active)} <span className="text-xs text-ink3 font-sans">· Nivel {progress.level}</span></span><span className="text-xs text-ink2 mt-1">{challenge ? `${number(progress.dayPages)} páginas hoy · ${number(progress.total)} en total` : 'Activa tu aventura y empieza en el nivel 1'}</span><span className="mt-3"><ProgressBar pct={progress.levelPages} className="h-1.5" /></span></span><span className="self-center mr-4 text-ink3 group-hover:translate-x-1 transition-transform"><ArrowRight size={18} /></span>
  </button>;
}

export function PetGame({ books, pet, challenge, onActivate, onSetPet }: { books: Book[]; pet: PetSettings; challenge: PetChallenge | null; onActivate: (pet: PetSettings) => Promise<void>; onSetPet: (pet: PetSettings) => void }) {
  const progress = petProgress(books, new Date(), challenge); const active = effectivePet(pet, progress.total);
  const [name, setName] = useState(pet.name);
  const [greeting, setGreeting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [chosenSpecies, setChosenSpecies] = useState<PetSpecies>(pet.species);
  useEffect(() => setName(pet.name), [pet.name]);
  const species = PET_SPECIES.find(item => item.id === active.species)!;
  const nextUnlock = SKIN_THRESHOLDS.find(target => target > progress.total);
  const completed = missions.filter(m => progress.dayPages >= m.target).length;
  const update = (patch: Partial<PetSettings>) => onSetPet({ ...active, ...patch });
  if (!challenge) return <section className="rounded-card border border-line bg-surface shadow-card overflow-hidden max-w-3xl">
    <PetScene pet={{ ...active, species: chosenSpecies, skin: 0 }} className="h-64 sm:h-80" />
    <form className="p-6 sm:p-8" onSubmit={async event => {
      event.preventDefault();
      if (!name.trim()) { setActivationError('Ponle un nombre a tu mascota para empezar.'); return; }
      setActivating(true); setActivationError('');
      try { await onActivate({ ...active, species: chosenSpecies, skin: 0, name: name.trim(), accessory: null }); }
      catch { setActivationError('No se pudo iniciar el reto. Comprueba la conexión y vuelve a intentarlo.'); }
      finally { setActivating(false); }
    }}><p className="text-xs font-extrabold uppercase tracking-widest text-accent">Una nueva aventura</p><h3 className="font-display text-3xl font-semibold mt-2">Elige a tu compañero</h3>
      <p className="text-sm text-ink2 leading-relaxed mt-3">Elige una mascota y ponle nombre para empezar en el nivel 1. Podrás cambiarla después sin perder vuestro progreso. Las lecturas anteriores no cuentan.</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5" role="group" aria-label="Elegir primera mascota">{PET_SPECIES.map(item => <button key={item.id} type="button" onClick={() => setChosenSpecies(item.id)} aria-pressed={chosenSpecies === item.id} className={`rounded-xl border p-1 sm:p-2 ${chosenSpecies === item.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-sunken/50'}`}><PixelPet species={item.id} skin={0} className="w-full max-w-20 mx-auto" /><span className="block text-[10px] sm:text-xs font-bold truncate">{item.label}</span></button>)}</div>
      <label htmlFor="first-pet-name" className="block text-sm font-bold mt-5 mb-2">Nombre de tu mascota</label><input id="first-pet-name" required maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="¿Cómo se llama?" className="w-full rounded-btn border border-line bg-sunken px-3 py-3 text-sm text-ink" />
      <button type="submit" disabled={activating} className="mt-5 rounded-btn bg-primary text-onprimary px-5 py-3 font-bold disabled:opacity-60">{activating ? 'Preparando…' : 'Empezar nuestra aventura'}</button>
      {activationError && <p role="alert" className="text-danger text-sm mt-3">{activationError}</p>}
    </form>
  </section>;
  return <div className="space-y-6">
    <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5">
      <section className="rounded-card border border-line bg-surface shadow-card overflow-hidden">
        <div className="relative"><PetScene pet={active} className="h-64 sm:h-80" /><button type="button" onClick={() => setGreeting(!greeting)} aria-label={`Saludar a ${petName(active)}`} className="absolute inset-x-[30%] bottom-[8%] h-[60%] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" />{greeting && <div role="status" className="absolute left-1/2 top-14 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-[#314457] shadow-lg">¡Me encanta leer contigo! ♥</div>}<div className="absolute top-4 left-4 flex gap-2"><span className="rounded-full bg-[#263742]/85 px-3 py-1.5 text-[11px] text-white font-bold backdrop-blur">✦ NIVEL {progress.level}</span><span className="rounded-full bg-[#263742]/85 px-3 py-1.5 text-[11px] text-white font-bold backdrop-blur">{species.label}</span></div><span className="absolute bottom-3 right-3 text-[10px] font-bold text-white/90 bg-[#263742]/70 rounded-full px-2 py-1">TU RINCÓN DE LECTURA</span></div>
        <div className="p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3 items-start"><div><p className="text-[10px] uppercase tracking-[.16em] text-accent font-extrabold">Compañero de aventuras</p><h3 className="font-display font-semibold text-3xl mt-1">{petName(active)}</h3><p className="text-xs text-ink3 mt-1">{species.label} · {species.skins[active.skin]}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent px-3 py-1.5 text-xs font-bold"><Sparkles size={14} /> {number(progress.total)} páginas</span></div>
          <div className="mt-5"><div className="flex justify-between text-xs font-semibold text-ink2 mb-2"><span>Nivel {progress.level}</span><span>{number(progress.levelPages)} / 100 para el siguiente nivel</span></div><ProgressBar pct={progress.levelPages} className="h-2.5" /><p className="text-xs text-ink3 mt-2">Cada 100 páginas registradas subís un nivel juntos.</p></div>
          <form className="mt-5 flex gap-2" onSubmit={event => { event.preventDefault(); update({ name }); }}><label htmlFor="pet-name" className="sr-only">Nombre de la mascota</label><input id="pet-name" maxLength={24} value={name} onChange={e => setName(e.target.value)} placeholder="Ponle un nombre" className="min-w-0 flex-1 rounded-btn border border-line bg-sunken px-3 py-2 text-sm text-ink" /><button type="submit" className="rounded-btn bg-primary text-onprimary px-4 py-2 text-sm font-bold">Guardar</button></form>
        </div>
      </section>
      <div className="space-y-5">
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.16em] text-accent font-extrabold">Una página a la vez</p><h3 className="font-display text-2xl font-semibold mt-1">Misiones de hoy</h3><p className="text-xs text-ink3 mt-1">Se renuevan cada día · {completed}/3 completadas</p></div><span className="rounded-xl bg-accent/10 p-2.5 text-accent"><Star size={20} /></span></div>
          <div className="mt-5 space-y-4">{missions.map(mission => { const done = progress.dayPages >= mission.target; return <div key={mission.target}><div className="flex items-center gap-2 text-sm"><span className={`grid place-items-center w-6 h-6 rounded-full ${done ? 'bg-accent text-onprimary' : 'bg-sunken text-ink3'}`}>{done ? <Check size={14} /> : <BookOpen size={13} />}</span><span className="font-bold flex-1">{mission.title}</span><span className="text-xs text-ink3 tabular-nums">{number(Math.min(progress.dayPages, mission.target))}/{mission.target}</span></div><ProgressBar pct={Math.min(100, progress.dayPages / mission.target * 100)} className="h-1.5 mt-2" /></div>; })}</div>
        </section>
        <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card"><div className="flex items-center gap-2"><Flame className="text-accent" size={19} /><h3 className="font-display text-xl font-semibold">Vuestra aventura</h3></div><div className="mt-4 grid grid-cols-3 gap-2 text-center">{[[number(progress.dayPages),'hoy'], [number(progress.weekPages),'esta semana'], [number(progress.streak),'días de racha']].map(([value,label]) => <div key={label} className="rounded-xl bg-sunken p-2 sm:p-3"><p className="font-display font-bold text-xl text-ink">{value}</p><p className="text-[10px] text-ink3 font-semibold mt-1">{label}</p></div>)}</div><div className="mt-4 pt-4 border-t border-line"><div className="flex justify-between gap-2 text-xs font-bold text-ink2"><span>Reto semanal · 100 páginas</span><span>{number(Math.min(progress.weekPages, 100))}/100</span></div><ProgressBar pct={Math.min(progress.weekPages, 100)} className="h-1.5 mt-2" />{progress.weekPages >= 100 && <p className="text-xs text-accent font-bold mt-2">¡Reto semanal completado!</p>}</div><p className="text-xs text-ink3 mt-4 leading-relaxed">La racha cuenta días consecutivos con páginas registradas, hasta hoy o ayer. No hay penalizaciones si descansáis.</p></section>
      </div>
    </div>
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] uppercase tracking-[.16em] text-accent font-extrabold">Elige a tu compañero</p><h3 className="font-display text-2xl font-semibold mt-1">La colección</h3><p className="text-xs text-ink3 mt-1">Cambia de mascota cuando quieras; compartís los mismos avances.</p></div><span className="text-xs font-bold text-ink2">{PET_SPECIES.length} mascotas · {PET_SPECIES.length * 6} aspectos</span></div>
      <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-3" role="group" aria-label="Elegir mascota">{PET_SPECIES.map(item => <button key={item.id} type="button" onClick={() => update({ species: item.id, skin: 0 })} aria-pressed={active.species === item.id} className={`rounded-xl border p-1 sm:p-2 transition-colors ${active.species === item.id ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-sunken/50 hover:border-accent'}`}><PixelPet species={item.id} skin={0} className="w-full max-w-[90px] mx-auto" /><span className="block text-[10px] sm:text-xs font-bold text-ink mt-1 truncate">{item.label}</span></button>)}</div>
      <div className="mt-5"><h4 className="font-bold text-sm mb-2">Postura</h4><div className="flex flex-wrap gap-2" role="group" aria-label="Elegir postura">{PET_POSES.map((pose: PetPose) => { const labels = active.species === 'dragon' ? ['En reposo', 'Durmiendo', 'Volando', 'Aliento'] : ['Sentado', 'Durmiendo', 'Andando', 'Jugando']; const selected = (active.pose || 'sentado') === pose; return <button key={pose} type="button" onClick={() => update({ pose })} aria-pressed={selected} className={`rounded-full border px-3 py-2 text-xs font-bold ${selected ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink2'}`}>{labels[PET_POSES.indexOf(pose)]}</button>; })}</div></div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-6 mb-3"><h4 className="font-bold text-sm">Aspectos de {species.label}</h4><p className="text-xs text-ink3">{nextUnlock ? `Próximo aspecto: ${number(nextUnlock)} páginas` : '¡Todos los aspectos desbloqueados!'}</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">{species.skins.map((label, index) => { const unlocked = progress.total >= SKIN_THRESHOLDS[index]; const selected = active.skin === index; return <button key={label} type="button" disabled={!unlocked} onClick={() => update({ skin: index })} aria-pressed={selected} className={`relative text-center rounded-xl border p-2 ${selected ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-sunken/50'} ${unlocked ? 'hover:border-accent' : 'opacity-60 cursor-not-allowed'}`}><PixelPet species={active.species} skin={index} className="w-16 sm:w-full max-w-24 mx-auto" /><span className="block text-xs font-bold text-ink leading-tight">{label}</span><span className="block text-[10px] text-ink3 mt-1">{unlocked ? selected ? 'Seleccionado' : 'Disponible' : <><LockKeyhole size={10} className="inline" /> {number(SKIN_THRESHOLDS[index])} págs</>}</span></button>; })}</div>
    </section>
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card">
      <div className="flex flex-wrap justify-between items-end gap-3"><div><p className="text-[10px] uppercase tracking-[.16em] text-accent font-extrabold">Vuestro vestidor mágico</p><h3 className="font-display text-2xl font-semibold mt-1">Gorros y efectos</h3><p className="text-xs text-ink3 mt-1">Se desbloquea uno cada dos niveles. Elige cualquiera de los desbloqueados, cámbialo o quítalo cuando quieras; sirve para todas las mascotas.</p></div><button type="button" onClick={() => update({ accessory: null })} aria-pressed={active.accessory === null} className={`rounded-btn border px-3 py-2 text-xs font-bold ${active.accessory === null ? 'border-accent bg-accent/10 text-accent' : 'border-line text-ink2'}`}>Sin añadido</button></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 sm:grid-cols-6 gap-2 mt-5" role="group" aria-label="Elegir añadido visual">{PET_ACCESSORIES.map(item => {
        const unlocked = progress.level >= item.level; const selected = active.accessory === item.id;
        return <button key={item.id} type="button" disabled={!unlocked} onClick={() => update({ accessory: item.id })} aria-pressed={selected} className={`rounded-xl border p-2 text-center ${selected ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-sunken/50'} ${unlocked ? 'hover:border-accent' : 'opacity-55 cursor-not-allowed'}`}>
          <PetAccessory id={item.id} className="h-12 w-full" /><span className="block text-xs font-bold leading-tight">{item.name}</span><span className="block text-[10px] text-ink3 mt-1">{unlocked ? selected ? 'Equipado' : 'Disponible' : <> <LockKeyhole size={10} className="inline" /> Nivel {item.level}</>}</span>
        </button>;
      })}</div>
    </section>
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card">
      <p className="text-[10px] uppercase tracking-[.16em] text-accent font-extrabold">Un lugar para cada historia</p>
      <h3 className="font-display text-2xl font-semibold mt-1">El rincón de tu mascota</h3>
      <p className="text-xs text-ink3 mt-1">Elige uno de los diez escenarios. También aparecerá en Inicio.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5" role="group" aria-label="Elegir fondo">
        {PET_BACKGROUNDS.map(scene => <button key={scene.id} type="button" aria-label={`Fondo ${scene.label}`} aria-pressed={active.background === scene.id} onClick={() => update({ background: scene.id })} className={`text-left rounded-xl overflow-hidden border-2 transition-all ${active.background === scene.id ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-accent'}`}>
          <img src={scene.image} alt="" loading="lazy" className="w-full aspect-[16/9] object-cover" style={{ imageRendering: 'pixelated' }} />
          <span className="flex items-center justify-between gap-1 px-2.5 py-2 text-xs font-bold text-ink">{scene.label}{active.background === scene.id && <Check size={14} className="text-accent shrink-0" />}</span>
        </button>)}
      </div>
    </section>
    <section className="rounded-card border border-line bg-surface p-5 sm:p-6 shadow-card"><div className="flex gap-3 items-center"><div className="rounded-xl bg-accent/10 p-2.5 text-accent"><Trophy size={20} /></div><div><h3 className="font-display text-2xl font-semibold">Vuestros logros</h3><p className="text-xs text-ink3">Se desbloquean automáticamente con páginas registradas.</p></div></div><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 sm:grid-cols-6 gap-2 mt-5">{milestones.map(item => { const unlocked = progress.total >= item.target; return <div key={item.target} className={`rounded-xl border border-line bg-sunken/50 p-3 ${unlocked ? '' : 'opacity-50'}`}><span className="text-2xl" aria-hidden>{item.icon}</span><p className="font-bold text-xs mt-2">{item.title}</p><p className="text-[10px] text-ink3 mt-1">{unlocked ? 'Conseguido' : `${number(item.target)} páginas`}</p></div>; })}</div><p className="text-xs text-ink3 mt-4 leading-relaxed"><Crown size={13} className="inline mr-1" />El progreso cuenta las páginas nuevas de tu diario desde la activación, también si se importan con fecha posterior o igual al inicio. Si editas o borras registros, se recalcula. Las fechas futuras o incompletas no cuentan.</p></section>
  </div>;
}
