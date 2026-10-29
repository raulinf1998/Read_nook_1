import {
  BookOpen, BarChart3, Compass, Target, Library, BookMarked, Plus, Upload, Tag, Palette, Moon, Sun,
} from 'lucide-react';
import type { ThemeId } from '../types';
import { THEMES } from '../types';
import { BrandMark, cx, btnPrimary, iconBtn } from './ui';

export type TabId = 'reading' | 'discover' | 'stats' | 'challenge' | 'library' | 'shelf';

const TABS: { id: TabId; label: string; short: string; icon: typeof BookOpen }[] = [
  { id: 'reading', label: 'Inicio', short: 'Inicio', icon: BookOpen },
  { id: 'library', label: 'Biblioteca', short: 'Libros', icon: Library },
  { id: 'shelf', label: 'Estantería', short: 'Balda', icon: BookMarked },
  { id: 'discover', label: 'Descubrir', short: 'Ideas', icon: Compass },
  { id: 'challenge', label: 'Reto anual', short: 'Reto', icon: Target },
  { id: 'stats', label: 'Estadísticas', short: 'Datos', icon: BarChart3 },
];

/* ---------------- Barra lateral (PC) ---------------- */

interface SidebarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  counts: Partial<Record<TabId, number>>;
  onAdd: () => void;
  onImport: () => void;
  onTags: () => void;
  onAppearance: () => void;
  theme: ThemeId;
  onSetTheme: (t: ThemeId) => void;
  activePaletteName?: string | null;
  dark: boolean;
  onToggleDark: () => void;
}

export function Sidebar({
  active, onChange, counts, onAdd, onImport, onTags, onAppearance,
  theme, onSetTheme, activePaletteName, dark, onToggleDark,
}: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[272px] z-40 overflow-y-auto border-r border-line bg-surface/80 backdrop-blur-xl px-4 py-5">
      {/* Marca */}
      <div className="flex items-center gap-3 px-2">
        <BrandMark className="h-11 w-11 shadow-lift" />
        <div>
          <p className="font-display text-xl font-semibold text-ink leading-none">Bilibook</p>
          <p className="text-[11px] text-ink3 mt-1 font-medium">Tu biblioteca, a tu manera</p>
        </div>
      </div>

      <button onClick={onAdd} className={cx(btnPrimary, 'w-full mt-6 py-3')}>
        <Plus size={17} strokeWidth={2.5} /> Añadir libro
      </button>

      {/* Navegación */}
      <nav className="mt-7 space-y-1" aria-label="Secciones">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-semibold transition-all active:scale-[0.99]',
                isActive
                  ? 'bg-accent/10 text-ink shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.25)]'
                  : 'text-ink2 hover:bg-sunken hover:text-ink'
              )}
            >
              <span className={cx(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                isActive ? 'bg-primary text-onprimary shadow-card' : 'bg-sunken text-ink3'
              )}>
                <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
              </span>
              {tab.label}
              {typeof count === 'number' && (
                <span className={cx(
                  'ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full',
                  isActive ? 'bg-primary text-onprimary' : 'bg-sunken text-ink3'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Herramientas */}
      <div className="mt-6 pt-5 border-t border-line space-y-1">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink3 mb-2">Herramientas</p>
        <SideTool icon={Upload} label="Importar CSV" onClick={onImport} />
        <SideTool icon={Tag} label="Gestionar tags" onClick={onTags} />
      </div>

      {/* Apariencia rápida */}
      <div className="mt-auto pt-5 border-t border-line">
        <div className="flex items-center justify-between px-2 mb-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink3">Tema</p>
          <div className="flex items-center gap-1">
            {(theme !== 'nocturno' || activePaletteName) && (
              <button
                onClick={onToggleDark}
                className="p-1.5 rounded-lg text-ink3 hover:text-ink hover:bg-sunken transition-colors"
                aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
                title={dark ? 'Modo claro' : 'Modo oscuro'}
              >
                {dark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            )}
            <button
              onClick={onAppearance}
              className="p-1.5 rounded-lg text-ink3 hover:text-ink hover:bg-sunken transition-colors"
              aria-label="Abrir selector de paletas"
              title="Ver y crear paletas"
            >
              <Palette size={15} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSetTheme(t.id)}
              title={t.label}
              aria-label={`Tema ${t.label}`}
              aria-pressed={theme === t.id}
              className={cx(
                'h-9 rounded-lg border-2 overflow-hidden flex transition-all active:scale-95',
                theme === t.id ? 'border-accent shadow-card' : 'border-line hover:border-line2'
              )}
              style={{ background: t.preview.bg }}
            >
              <span className="w-full h-full flex items-end gap-0.5 p-1">
                <span className="w-2.5 h-4 rounded-[2px]" style={{ background: t.preview.primary }} />
                <span className="w-2.5 h-3 rounded-[2px]" style={{ background: t.preview.accent2 }} />
                <span className="flex-1 h-2 rounded-full mb-0.5" style={{ background: t.preview.line }} />
              </span>
            </button>
          ))}
        </div>
        <p className="px-2 mt-2 text-[11px] font-semibold text-ink2 truncate">
          {activePaletteName || THEMES.find((t) => t.id === theme)?.label}
          {dark ? ' · oscuro' : ' · claro'}
        </p>
      </div>
    </aside>
  );
}

function SideTool({ icon: Icon, label, onClick }: { icon: typeof Upload; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-btn text-sm font-medium text-ink2 hover:bg-sunken hover:text-ink transition-colors"
    >
      <Icon size={16} className="text-ink3" />
      {label}
    </button>
  );
}

/** Acceso rápido de la cabecera móvil; respeta el bloqueo de Nocturno. */
export function MobileThemeToggle({ dark, locked, onToggle }: { dark: boolean; locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      className={`${iconBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
      aria-label={locked ? 'Modo oscuro fijo con el tema Nocturno' : dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={locked ? 'El tema Nocturno integrado siempre es oscuro' : dark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

/* ---------------- Barra inferior flotante (móvil) ---------------- */

interface MobileNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <nav
      className="lg:hidden fixed left-3 right-3 z-40 rounded-full bg-surface/90 backdrop-blur-xl border border-line shadow-pop px-1.5 py-1.5"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      aria-label="Secciones"
    >
      <div className="flex items-center justify-between">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              className={cx(
                'flex items-center justify-center gap-1.5 rounded-full transition-all duration-300 active:scale-95',
                isActive ? 'bg-primary text-onprimary px-3 py-2 shadow-card' : 'text-ink3 hover:text-ink px-2 py-2'
              )}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
              {isActive && <span className="text-[11px] font-bold leading-none">{tab.short}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
