import { useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { Modal, btnPrimary, cx, inputCls } from './ui';

interface Props {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  onClose: () => void;
}

const SUGGESTIONS = ['Favoritos', 'Relectura', 'Prestado', 'Saga', 'Premiado', 'Cómic / Manga', 'No ficción', 'Infantil'];

export function TagManager({ tags, onAdd, onRemove, onClose }: Props) {
  const [input, setInput] = useState('');
  const duplicated = input.trim() !== '' && tags.some((t) => t.toLowerCase() === input.trim().toLowerCase());

  const handleAdd = () => {
    const t = input.trim();
    if (t && !duplicated) onAdd(t);
    setInput('');
  };

  const missingSuggestions = SUGGESTIONS.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));

  return (
    <Modal title="Gestionar tags" icon={<Tag size={17} />} onClose={onClose} maxWidth="max-w-md">
      <div className="space-y-5">
        <div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Nuevo tag, p. ej. «Favoritos»"
              className={cx(inputCls, 'flex-1')}
              autoFocus
              aria-label="Nuevo tag"
            />
            <button onClick={handleAdd} disabled={!input.trim() || duplicated} className={btnPrimary}>
              <Plus size={16} strokeWidth={2.5} /> Añadir
            </button>
          </div>
          {duplicated && <p className="text-xs font-semibold text-stpending mt-2">Ese tag ya existe.</p>}
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink3 mb-2.5">
            Tus tags · {tags.length}
          </h3>
          {tags.length === 0 ? (
            <p className="text-sm text-ink3">Todavía no tienes tags. Añade el primero arriba o elige una sugerencia.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1.5 rounded-full bg-sunken text-ink2 text-xs font-bold"
                >
                  {tag}
                  <button
                    onClick={() => onRemove(tag)}
                    className="w-[18px] h-[18px] flex items-center justify-center rounded-full shrink-0 text-ink3 hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label={`Eliminar tag ${tag}`}
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-ink3 mt-2.5 leading-relaxed">
            Eliminar un tag no lo quita de los libros que ya lo tengan; solo deja de ofrecerse al editar.
          </p>
        </div>

        {missingSuggestions.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink3 mb-2.5">Sugerencias</h3>
            <div className="flex flex-wrap gap-1.5">
              {missingSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onAdd(s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-line2 text-xs font-bold text-ink3 hover:text-accent hover:border-accent/50 hover:bg-accent/[0.06] active:scale-95 transition-all"
                >
                  <Plus size={12} strokeWidth={2.5} /> {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
