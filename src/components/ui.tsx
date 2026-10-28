import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Book, BookStatus } from '../types';
import { STATUS_META } from '../types';
import { bookSpineCandidateUrls } from '../bookSpine';

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
  const [viewportStyle, setViewportStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // En móvil, el área realmente visible cambia con la barra del navegador
    // y con el teclado. VisualViewport permite que la hoja siga esa zona en
    // lugar de quedarse al final del documento o detrás del teclado.
    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      if (!visualViewport) return;
      setViewportStyle({
        top: `${visualViewport.offsetTop}px`,
        height: `${visualViewport.height}px`,
        bottom: 'auto',
      });
    };
    syncViewport();
    visualViewport?.addEventListener('resize', syncViewport);
    visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      visualViewport?.removeEventListener('resize', syncViewport);
      visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  // Portal a <body>: si el modal se monta dentro de una pestaña con
  // `transform` (las animaciones de entrada lo usan), CSS convierte ese
  // contenedor en el marco de referencia de `position: fixed` y el popup
  // aparece al final de la página en el teléfono. En body siempre se abre
  // sobre el punto visible en el que está el usuario.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 backdrop-blur-sm animate-fade-in [overscroll-behavior:contain] sm:items-center sm:p-4"
      style={viewportStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-bilibook-modal="true"
    >
      <div
        className={cx(
          'bg-surface w-full max-h-[92%] flex flex-col border border-line2 shadow-pop animate-pop-in',
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
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-line bg-sunken/50 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
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

interface BookSpineProps {
  book: Book;
  className?: string;
}

/**
 * Lomo para las vistas de estantería.
 *
 * Primero intenta una imagen de lomo (`spineUrl` o el candidato generado por
 * ISBN de OpenCover). Si no existe o no tiene proporción de lomo, compone uno
 * con la portada real guardada en Bilibook y el título/autor en vertical. No
 * presenta esa composición como una fotografía del lomo físico.
 */
export function BookSpine({ book, className = '' }: BookSpineProps) {
  const candidates = bookSpineCandidateUrls(book);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setCoverFailed(false);
  }, [book.id, book.isbn, book.spineUrl, book.coverUrl]);

  const candidate = candidates[candidateIndex] || '';
  const candidateIsExplicit = Boolean(book.spineUrl?.trim() && candidate === book.spineUrl.trim());
  const [from, to, ink] = COVER_GRADIENTS[hashTitle(`${book.title || '?'} ${book.author || ''}`) % COVER_GRADIENTS.length];
  const position = (book.seriesPosition || '').trim().replace(/^#\s*/, '');

  return (
    <div
      className={cx('relative shrink-0 select-none overflow-hidden shadow-book', className)}
      style={{
        borderRadius: '4px 2px 2px 4px',
        background: `linear-gradient(180deg, ${from}, ${to})`,
        color: ink,
      }}
      aria-hidden
    >
      {!candidate && book.coverUrl?.trim() && !coverFailed && (
        <img
          src={book.coverUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          style={{ objectPosition: '18% 50%' }}
          onError={() => setCoverFailed(true)}
          onLoad={(event) => {
            if ((event.target as HTMLImageElement).naturalWidth <= 1) setCoverFailed(true);
          }}
        />
      )}

      {!candidate && (
        <>
          <span className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/35" />
          <span className="absolute inset-x-1.5 top-2 h-px bg-white/45" />
          <span className="absolute inset-x-1.5 bottom-2 h-px bg-white/45" />
          <span
            className="absolute inset-x-1 bottom-8 top-8 flex flex-col items-center"
            style={{ textShadow: '0 1px 3px rgb(0 0 0 / 0.65)' }}
          >
            <span
              className="max-h-[66%] overflow-hidden text-ellipsis whitespace-nowrap font-display text-[11px] font-bold leading-none tracking-wide"
              style={{ writingMode: 'vertical-rl' }}
            >
              {book.title || 'Sin título'}
            </span>
            {book.author && (
              <span
                className="mt-auto max-h-[30%] overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-bold uppercase leading-none tracking-[0.14em] opacity-85"
                style={{ writingMode: 'vertical-rl' }}
              >
                {book.author}
              </span>
            )}
          </span>
          {position && (
            <span className="absolute bottom-3 left-1/2 flex h-5 min-w-5 -translate-x-1/2 items-center justify-center rounded-full bg-black/25 px-1 text-[8px] font-extrabold ring-1 ring-white/35">
              {position}
            </span>
          )}
        </>
      )}

      {candidate && (
        <img
          src={candidate}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCandidateIndex((index) => index + 1)}
          onLoad={(event) => {
            const image = event.target as HTMLImageElement;
            const ratio = image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1;
            if (image.naturalWidth < 8 || image.naturalHeight < 24 || (!candidateIsExplicit && ratio > 0.65)) {
              setCandidateIndex((index) => index + 1);
            }
          }}
        />
      )}

      <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-white/25" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-black/25" />
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
