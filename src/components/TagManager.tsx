import { useState } from 'react';
import { X, Plus, Tag, Trash2 } from 'lucide-react';

interface Props {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  onClose: () => void;
}

export function TagManager({ tags, onAdd, onRemove, onClose }: Props) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onAdd(t);
    setInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag size={20} className="text-gray-700 dark:text-gray-300" />
            Gestionar tags
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nuevo tag..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-gray-900 dark:focus:border-gray-500 outline-none transition-all text-sm"
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
              Añadir
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium group"
              >
                {tag}
                <button
                  onClick={() => onRemove(tag)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} className="text-red-400 hover:text-red-500" />
                </button>
              </span>
            ))}
            {tags.length === 0 && <p className="text-sm text-gray-400">No hay tags. Añade el primero arriba.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
