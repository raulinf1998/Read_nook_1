import { useState, type ReactNode } from 'react';
import {
  ChevronRight,
  Moon,
  Palette,
  RefreshCw,
  Settings,
  Sun,
  Tag,
  Upload,
} from 'lucide-react';
import { THEMES, type ThemeId } from '../types';
import { Modal, cx } from './ui';

interface SettingsMenuProps {
  theme: ThemeId;
  dark: boolean;
  darkModeLocked: boolean;
  activePaletteName: string | null;
  settingsVersion: number;
  onToggleDark: () => void;
  onAppearance: () => void;
  onImport: () => void;
  onTags: () => void;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}

export function SettingsMenu({
  theme,
  dark,
  darkModeLocked,
  activePaletteName,
  settingsVersion,
  onToggleDark,
  onAppearance,
  onImport,
  onTags,
  onRefresh,
  onClose,
}: SettingsMenuProps) {
  const [refreshing, setRefreshing] = useState(false);
  const themeLabel = THEMES.find((item) => item.id === theme)?.label || theme;
  const appearanceSummary = activePaletteName
    ? `Paleta «${activePaletteName}» · ${dark ? 'oscuro' : 'claro'}`
    : `${themeLabel} · ${dark ? 'oscuro' : 'claro'}`;

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Modal
      title="Ajustes"
      icon={<Settings size={17} />}
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="space-y-2.5">
        <SettingsRow
          icon={<Palette size={19} />}
          title="Apariencia"
          description={appearanceSummary}
          onClick={onAppearance}
        />

        <button
          type="button"
          onClick={onToggleDark}
          disabled={darkModeLocked}
          aria-pressed={dark}
          className={cx(
            'w-full flex items-center gap-3 rounded-btn border border-line bg-sunken/55 px-3.5 py-3 text-left transition-all',
            darkModeLocked
              ? 'opacity-60 cursor-not-allowed'
              : 'hover:border-line2 hover:bg-sunken active:scale-[0.99]',
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
            {dark ? <Moon size={19} /> : <Sun size={19} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Modo claro / oscuro</span>
            <span className="mt-0.5 block truncate text-xs text-ink3">
              {darkModeLocked
                ? 'El tema Nocturno integrado siempre es oscuro'
                : dark
                  ? 'Oscuro activado · toca para pasar a claro'
                  : 'Claro activado · toca para pasar a oscuro'}
            </span>
          </span>
          <span
            aria-hidden
            className={cx(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              dark ? 'bg-primary' : 'bg-line2',
            )}
          >
            <span
              className={cx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                dark ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </span>
        </button>

        <SettingsRow
          icon={<Upload size={19} />}
          title="Importar"
          description="Biblioteca y diario de StoryGraph"
          onClick={onImport}
        />
        <SettingsRow
          icon={<Tag size={19} />}
          title="Tags"
          description="Crear y eliminar etiquetas"
          onClick={onTags}
        />
      </div>

      <div className="mt-5 rounded-btn border border-line bg-sunken/55 px-3.5 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Apariencia del servidor</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink3">
              Versión de ajustes #{settingsVersion}. Tras sincronizar, debe ser
              la misma en el PC y en el teléfono.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="shrink-0 rounded-btn bg-surface px-3 py-2 text-xs font-bold text-ink2 shadow-card transition-all hover:text-ink active:scale-95 disabled:cursor-wait disabled:opacity-60"
          >
            {refreshing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-btn border border-line bg-sunken/55 px-3.5 py-3 text-left transition-all hover:border-line2 hover:bg-sunken active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-ink3">{description}</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-ink3" aria-hidden />
    </button>
  );
}
