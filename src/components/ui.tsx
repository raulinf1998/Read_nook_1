import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META } from '../types';

/* ---------- Clases compartidas (tokens de tema) ---------- */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** Marca de Bilibook: el mismo SVG que usa el favicon de la pestaña. */
export function BrandMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}favicon.svg`}
      alt=""
      aria-hidden
      draggable={false}
      className={cx('shrink-0 select-none rounded-[26%] shadow-card', className)}
    />
  );
}

export const inputCls =
  'w-full px-3.5 py-2.5 rounded-btn border border-line bg-raised text-ink placeholder:text-ink3 ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all text-sm';

export const selectCls =
  'px-3 py-2.5 rounded-btn border border-line bg-raised text-ink text-sm outline-none ' +
  'focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all';

export const labelCls = 'block text-sm font-semibold text-ink2 mb-1.5';

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-btn bg-primary text-onprimary ' +
  'text-sm font-semibold hover:bg-primaryhover active:scale-[0.98] transition-all shadow-card ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';

export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-btn bg-sunken text-ink2 ' +
  'text-sm font-semibold hover:bg-line/60 hover:text-ink active:scale-[0.98] transition-all ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const btnSoft =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-btn bg-accent/10 text-accent ' +
  'text-xs font-bold hover:bg-accent/20 active:scale-[0.97] transition-all';

export const iconBtn =
  'p-2 rounded-btn text-ink3 hover:text-ink hover:bg-sunken active:scale-95 transition-all';

export const cardCls = 'bg-surface rounded-card border border-line shadow-card';

export function filterChipCls(active: boolean) {
  return cx(
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-[0.97]',
    active
      ? 'bg-primary text-onprimary shadow-card'
      : 'bg-surface text-ink2 border border-line hover:border-line2 hover:text-ink'
  );
}

/* ---------- Modal: hoja inferior en móvil, diálogo centrado en PC ---------- */

interface ModalProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string; // clase tailwind, p. ej. 'max-w-lg'
}

export function Modal({ title, icon, onClose, children, footer, maxWidth = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/45 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cx(
          'bg-surface w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col border border-line2 shadow-pop animate-pop-in',
          'rounded-t-[22px] sm:rounded-card overflow-hidden',
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0" aria-hidden>
          <span className="w-10 h-1.5 rounded-full bg-line2" />
        </div>
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-line bg-surface shrink-0">
          <h2 className="font-display text-lg font-semibold text-ink flex items-center gap-2.5">
            {icon && <span className="w-8 h-8 rounded-btn bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</span>}
            {title}
          </h2>
          <button onClick={onClose} className={iconBtn} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-line bg-sunken/50 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Portada: imagen con relieve o portada "diseñada" si falta ---------- */

const COVER_GRADIENTS: [string, string, string][] = [
  ['#9E4A2F', '#6E2F1D', '#FBEEDD'],
  ['#31572C', '#1E3A20', '#EAF3E2'],
  ['#274469', '#162A47', '#E3EDFB'],
  ['#5B3A8E', '#39245F', '#EFE7FC'],
  ['#8E5B23', '#5F3B14', '#FBF0DC'],
  ['#7A2E4F', '#4E1C33', '#FBE7F0'],
  ['#1F6E6B', '#124442', '#DFF5F2'],
  ['#3E3E46', '#22222A', '#ECECF2'],
];

function hashTitle(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

interface BookCoverProps {
  title: string;
  author?: string;
  coverUrl?: string;
  className?: string;
  /** sm: solo inicial · md/lg: título y autor impresos en la portada generada */
  detail?: 'sm' | 'md' | 'lg';
}

export function BookCover({ title, author, coverUrl, className = '', detail = 'md' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [coverUrl]);

  const showImg = Boolean(coverUrl?.trim()) && !failed;
  const [from, to, ink] = COVER_GRADIENTS[hashTitle(title || '?') % COVER_GRADIENTS.length];

  return (
    <div
      className={cx('relative overflow-hidden select-none shrink-0', className)}
      style={{ borderRadius: '3px 8px 8px 3px' }}
    >
      {showImg ? (
        <img
          src={coverUrl}
          alt={`Portada de ${title}`}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover bg-sunken"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // Open Library devuelve un píxel transparente si no hay portada
            if ((e.target as HTMLImageElement).naturalWidth <= 1) setFailed(true);
          }}
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col justify-between"
          style={{ background: `linear-gradient(150deg, ${from}, ${to})`, color: ink, padding: '9% 10% 9% 14%' }}
          aria-hidden
        >
          {detail === 'sm' ? (
            <span className="font-display font-semibold leading-none" style={{ fontSize: '20px' }}>
              {(title || '?').charAt(0).toUpperCase()}
            </span>
          ) : (
            <>
              <div>
                <span className="block w-6 h-px mb-2 opacity-70" style={{ background: ink }} />
                <p
                  className={cx('font-display font-semibold leading-snug', detail === 'lg' ? 'text-base line-clamp-5' : 'text-[11px] line-clamp-4')}
                >
                  {title || 'Sin título'}
                </p>
              </div>
              {author && (
                <p className={cx('uppercase tracking-wider opacity-75 line-clamp-2', detail === 'lg' ? 'text-[10px]' : 'text-[7px]')}>
                  {author}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <span className="cover-shine" aria-hidden />
    </div>
  );
}

/* ---------- Piezas pequeñas ---------- */

export function StatusBadge({ status, className = '' }: { status: BookStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold', meta.badge, className)}>
      <span className={cx('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export function ProgressBar({ pct, className = 'h-2' }: { pct: number; className?: string }) {
  return (
    <div className={cx('bg-sunken rounded-full overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-all duration-500 bg-grad-primary"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className={cx(cardCls, 'px-6 py-10 text-center border-dashed')}>
      <div className="w-14 h-14 rounded-card bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-ink3 mt-1 max-w-sm mx-auto">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
}

export function SectionHeader({ icon, title, count, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <span className="w-8 h-8 rounded-btn bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</span>
      <h2 className="font-display text-lg font-semibold text-ink leading-none">{title}</h2>
      {typeof count === 'number' && (
        <span className="text-xs font-bold text-ink3 bg-sunken rounded-full px-2 py-0.5">{count}</span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function bookProgress(book: Book) {
  return book.pages > 0 ? Math.min((book.currentPage / book.pages) * 100, 100) : 0;
}
