import { Star, StarHalf } from 'lucide-react';

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

export function StarRating({ value, onChange, size = 18 }: Props) {
  const stars: number[] = [1, 2, 3, 4, 5];

  return (
    <div className="flex items-center gap-0.5">
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
              // click full star -> set to that value; click again -> toggle half
              if (value === star) onChange(star - 0.5);
              else if (value === star - 0.5) onChange(0);
              else onChange(star);
            }}
            className={`transition-transform ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
            aria-label={`${star} estrellas`}
          >
            {isFull ? (
              <Star size={size} className="fill-amber-400 text-amber-400" />
            ) : isHalf ? (
              <span className="relative inline-block">
                <Star size={size} className="text-gray-300 dark:text-gray-600" />
                <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <StarHalf size={size} className="fill-amber-400 text-amber-400" />
                </span>
              </span>
            ) : (
              <Star size={size} className="text-gray-300 dark:text-gray-600" />
            )}
          </button>
        );
      })}
    </div>
  );
}
