import { BookOpen, BarChart3, Target, Library, BookMarked } from 'lucide-react';

export type TabId = 'reading' | 'stats' | 'challenge' | 'library' | 'shelf';

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: 'reading', label: 'Leyendo', icon: BookOpen },
  { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
  { id: 'challenge', label: 'Retos', icon: Target },
  { id: 'library', label: 'Biblioteca', icon: Library },
  { id: 'shelf', label: 'Librería', icon: BookMarked },
];

export function Navigation({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-3xl mx-auto flex items-center justify-around px-1 py-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all min-w-[58px] ${
                isActive
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-medium leading-none ${isActive ? '' : ''}`}>{tab.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-gray-900 dark:bg-white" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
