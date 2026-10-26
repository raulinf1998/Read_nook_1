import { Star, StarHalf } from 'lucide-react';
import { cx } from './ui';

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 18 }: Props) {
  const stars: number[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Puntuación' : `Puntuación: ${value} de 5`}>
      {stars.map((star) => {
        const isFull = value >= star;
        const isHalf = value >= star - 0.5 && value < star;
        return (
          <button
            key={star}
            type="button"
            disabled={!onChange}
            onClick={() => {
              if (!onChange) return;
              // clic en estrella llena -> media; clic en media -> quitar
              if (value === star) onChange(star - 0.5);
              else if (value === star - 0.5) onChange(0);
              else onChange(star);
            }}
            className={cx(
              'transition-transform duration-150 p-0.5 -m-0.5 rounded',
              onChange ? 'hover:scale-125 active:scale-95 cursor-pointer' : 'cursor-default'
            )}
            aria-label={`${star} estrellas`}
          >
            {isFull ? (
              <Star size={size} className="fill-gold text-gold drop-shadow-[0_1px_2px_rgb(var(--gold)/0.45)]" />
            ) : isHalf ? (
              <span className="relative inline-block">
                <Star size={size} className="text-line2" />
                <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <StarHalf size={size} className="fill-gold text-gold" />
                </span>
              </span>
            ) : (
              <Star size={size} className="text-line2" />
            )}
          </button>
        );
      })}
      {onChange && value > 0 && (
        <span className="ml-1.5 text-xs font-bold text-ink2 tabular-nums">{value.toFixed(1)}</span>
      )}
    </div>
  );
}
