import { Palette, Check, Moon, Sun, BookOpen } from 'lucide-react';
import type { ThemeId } from '../types';
import { THEMES } from '../types';
import { Modal, cx } from './ui';

interface Props {
  theme: ThemeId;
  dark: boolean;
  onSetTheme: (t: ThemeId) => void;
  onSetDark: (d: boolean) => void;
  onClose: () => void;
}

/** Selector de apariencia con vista previa de los 4 temas. */
export function ThemePicker({ theme, dark, onSetTheme, onSetDark, onClose }: Props) {
  const isDarkOnly = theme === 'nocturno';

  return (
    <Modal title="Apariencia" icon={<Palette size={17} />} onClose={onClose} maxWidth="max-w-xl">
      <p className="text-sm text-ink2 -mt-1 mb-4">
        Cuatro formas de habitar tu rincón. El cambio se aplica al instante y queda guardado.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const selected = theme === t.id;
          const p = t.preview;
          return (
            <button
              key={t.id}
              onClick={() => onSetTheme(t.id)}
              aria-pressed={selected}
              className={cx(
                'text-left rounded-card border-2 p-2.5 transition-all active:scale-[0.99] group',
                selected ? 'border-accent shadow-lift bg-accent/[0.04]' : 'border-line hover:border-line2 bg-surface hover:shadow-lift'
              )}
            >
              {/* Mini maqueta de la app en ese tema */}
              <span
                className="block overflow-hidden border"
                style={{ background: p.bg, borderColor: p.line, borderRadius: p.radius }}
                aria-hidden
              >
                <span className="flex items-center gap-1.5 px-2.5 py-2 border-b" style={{ borderColor: p.line, background: p.surface }}>
                  <span className="w-4 h-4 rounded flex items-center justify-center" style={{ background: p.primary, color: p.onPrimary }}>
                    <BookOpen size={9} strokeWidth={2.6} />
                  </span>
                  <span className="text-[10px] font-bold" style={{ color: p.ink, fontFamily: p.fontDisplay }}>Read Nook</span>
                  <span className="ml-auto w-5 h-2 rounded-full" style={{ background: p.line }} />
                </span>
                <span className="flex gap-2 p-2.5">
                  <span className="flex gap-1 items-end">
                    <span className="w-4 h-6 rounded-[2px]" style={{ background: `linear-gradient(160deg, ${p.primary}, ${p.accent2})` }} />
                    <span className="w-4 h-5 rounded-[2px]" style={{ background: p.accent2 }} />
                    <span className="w-4 h-6 rounded-[2px] opacity-60" style={{ background: p.primary }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold leading-tight" style={{ color: p.ink, fontFamily: p.fontDisplay }}>
                      Leyendo ahora
                    </span>
                    <span className="block h-1.5 w-4/5 rounded-full mt-1.5" style={{ background: p.line }} />
                    <span className="block h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: p.line }}>
                      <span className="block h-full w-2/3" style={{ background: p.primary }} />
                    </span>
                    <span className="inline-block text-[8px] font-bold px-1.5 py-0.5 mt-2" style={{ background: p.primary, color: p.onPrimary, borderRadius: p.radius * 0.6 }}>
                      Añadir libro
                    </span>
                  </span>
                </span>
              </span>

              <span className="flex items-start gap-2 px-1 pt-2.5">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="font-display font-semibold text-ink text-sm">{t.label}</span>
                    {t.darkOnly && <Moon size={12} className="text-ink3" aria-label="Siempre oscuro" />}
                  </span>
                  <span className="block text-xs text-ink3 leading-snug mt-0.5">{t.tagline}</span>
                </span>
                <span className={cx(
                  'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all',
                  selected ? 'bg-accent text-white' : 'border-2 border-line2 text-transparent group-hover:border-ink3'
                )}>
                  <Check size={12} strokeWidth={3.2} />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Modo claro / oscuro (no aplica a Nocturno) */}
      <div className={cx(
        'mt-4 rounded-btn border border-line bg-sunken/60 p-2 flex items-center gap-2 transition-opacity',
        isDarkOnly && 'opacity-50 pointer-events-none'
      )}>
        <span className="text-xs font-bold text-ink2 px-2">Modo</span>
        <div className="flex gap-1.5 ml-auto">
          <ModeBtn active={!dark} onClick={() => onSetDark(false)} icon={<Sun size={14} />} label="Claro" />
          <ModeBtn active={dark} onClick={() => onSetDark(true)} icon={<Moon size={14} />} label="Oscuro" />
        </div>
      </div>
      {isDarkOnly && (
        <p className="text-xs text-ink3 mt-2">«Nocturno» es un tema oscuro por definición; el modo claro no le aplica.</p>
      )}
    </Modal>
  );
}

function ModeBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all active:scale-95',
        active ? 'bg-primary text-onprimary shadow-card' : 'bg-surface text-ink2 border border-line hover:text-ink'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
