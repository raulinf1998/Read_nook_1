import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Clock3,
  Compass,
  Dices,
  History,
  Library,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Book } from '../types';
import { formatLabel, languageLabel, seriesLabel } from '../types';
import { StarRating } from './StarRating';
import {
  BookCover,
  EmptyState,
  ProgressBar,
  SectionHeader,
  bookProgress,
  btnGhost,
  btnSoft,
  cardCls,
  cx,
} from './ui';

interface Props {
  books: Book[];
  onOpen: (book: Book) => void;
  onAdd: () => void;
}

interface Recommendation {
  book: Book;
  score: number;
  reasons: string[];
}

interface TasteStat {
  label: string;
  count: number;
  ratingTotal: number;
  ratedCount: number;
}

function normalize(value: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return 'sin fecha';
  return new Date(timestamp).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function average(stat: TasteStat | undefined): number {
  return stat && stat.ratedCount > 0 ? stat.ratingTotal / stat.ratedCount : 0;
}

export function Discover({ books, onOpen, onAdd }: Props) {
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [rouletteBookId, setRouletteBookId] = useState<string | null>(null);

  const discovery = useMemo(() => {
    const readBooks = books.filter((book) => book.status === 'read');
    const readingBooks = books.filter((book) => book.status === 'reading');
    const pendingBooks = books.filter((book) => book.status === 'pending');

    const authorStats = new Map<string, TasteStat>();
    const tagStats = new Map<string, TasteStat>();

    const addStat = (map: Map<string, TasteStat>, rawLabel: string, rating: number) => {
      const label = rawLabel.trim();
      if (!label) return;
      const key = normalize(label);
      const current = map.get(key) || { label, count: 0, ratingTotal: 0, ratedCount: 0 };
      current.count += 1;
      if (rating > 0) {
        current.ratingTotal += rating;
        current.ratedCount += 1;
      }
      map.set(key, current);
    };

    for (const book of readBooks) {
      addStat(authorStats, book.author, book.rating);
      for (const tag of book.tags || []) addStat(tagStats, tag, book.rating);
    }

    const now = Date.now();
    const recommendations: Recommendation[] = pendingBooks.map((book) => {
      let score = 0;
      const reasons: string[] = [];

      const authorStat = authorStats.get(normalize(book.author));
      if (authorStat) {
        const authorAverage = average(authorStat);
        score += authorStat.count * 1.25 + authorAverage * 1.45;
        reasons.push(
          authorAverage > 0
            ? `Has leído ${authorStat.count} ${authorStat.count === 1 ? 'libro' : 'libros'} de ${book.author}, con nota media ${authorAverage.toFixed(1)}.`
            : `Ya conoces a ${book.author}: tienes ${authorStat.count} ${authorStat.count === 1 ? 'libro suyo leído' : 'libros suyos leídos'}.`,
        );
      }

      const matchingTags = (book.tags || [])
        .map((tag) => ({ tag, stat: tagStats.get(normalize(tag)) }))
        .filter((item): item is { tag: string; stat: TasteStat } => Boolean(item.stat))
        .sort((a, b) => (b.stat.count + average(b.stat)) - (a.stat.count + average(a.stat)));
      for (const { stat } of matchingTags) {
        score += stat.count * 0.32 + average(stat) * 0.55;
      }
      if (matchingTags.length) {
        reasons.push(`Encaja con tu gusto por ${matchingTags.slice(0, 2).map((item) => item.tag).join(' y ')}.`);
      }

      if (book.pages >= 180 && book.pages <= 480) {
        score += 1.15;
        reasons.push(`Tiene ${book.pages} páginas: un tamaño cómodo para arrancar sin compromiso enorme.`);
      }

      const ageDays = Math.max(0, (now - (book.createdAt || now)) / 86_400_000);
      score += Math.min(ageDays / 180, 1.4);
      if (ageDays > 180) reasons.push('Lleva tiempo esperando en tu lista: puede ser su momento.');

      if (!reasons.length) reasons.push('Es una elección fresca para salir de tu zona habitual.');
      return { book, score, reasons: reasons.slice(0, 3) };
    }).sort((a, b) => b.score - a.score || a.book.createdAt - b.book.createdAt);

    const continueBooks = [...readingBooks].sort((a, b) => {
      const leftA = a.pages > 0 ? Math.max(a.pages - a.currentPage, 0) : Number.MAX_SAFE_INTEGER;
      const leftB = b.pages > 0 ? Math.max(b.pages - b.currentPage, 0) : Number.MAX_SAFE_INTEGER;
      return leftA - leftB || bookProgress(b) - bookProgress(a);
    });

    const rereadGems = readBooks
      .filter((book) => book.rating >= 4.5)
      .sort((a, b) => (a.finishedAt || a.createdAt) - (b.finishedAt || b.createdAt) || b.rating - a.rating)
      .slice(0, 4);

    const forgotten = [...pendingBooks]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 5);

    const topAuthors = [...authorStats.values()]
      .sort((a, b) => b.count - a.count || average(b) - average(a))
      .slice(0, 5);
    const topTags = [...tagStats.values()]
      .sort((a, b) => b.count - a.count || average(b) - average(a))
      .slice(0, 6);

    return {
      readBooks,
      readingBooks,
      pendingBooks,
      recommendations,
      continueBooks,
      rereadGems,
      forgotten,
      topAuthors,
      topTags,
    };
  }, [books]);

  if (books.length === 0) {
    return (
      <EmptyState
        icon={<Compass size={26} />}
        title="Tu brújula lectora está lista"
        description="Añade tus primeros libros y Descubrir aprenderá de tus gustos para proponerte la siguiente lectura, rescatar pendientes y recordar tus favoritos."
      >
        <button onClick={onAdd} className={btnGhost}>Añadir mi primer libro</button>
      </EmptyState>
    );
  }

  const recommendation = discovery.recommendations.length
    ? discovery.recommendations[recommendationIndex % discovery.recommendations.length]
    : null;
  const fallbackBook = discovery.rereadGems[0] || discovery.continueBooks[0] || books[0];
  const heroBook = recommendation?.book || fallbackBook;
  const heroReasons = recommendation?.reasons || [
    heroBook.rating > 0
      ? `Te dejó una nota de ${heroBook.rating.toFixed(1)}: es una apuesta segura para releer.`
      : 'Lo tienes a mano en tu biblioteca y puede ser un buen reencuentro.',
  ];

  const rouletteCandidates = [...discovery.pendingBooks, ...discovery.readingBooks];
  const rouletteBook = rouletteCandidates.find((book) => book.id === rouletteBookId) || null;
  const spinRoulette = () => {
    if (!rouletteCandidates.length) return;
    if (rouletteCandidates.length === 1) {
      setRouletteBookId(rouletteCandidates[0].id);
      return;
    }
    let next = rouletteBook;
    while (!next || next.id === rouletteBookId) {
      next = rouletteCandidates[Math.floor(Math.random() * rouletteCandidates.length)];
    }
    setRouletteBookId(next.id);
  };

  const maxAuthorCount = Math.max(...discovery.topAuthors.map((author) => author.count), 1);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Recomendación principal */}
      <section className="relative overflow-hidden rounded-card bg-grad-primary text-ongrad shadow-lift p-5 sm:p-7">
        <Compass size={280} strokeWidth={0.45} className="absolute -right-14 -top-16 opacity-[0.13]" aria-hidden />
        <div className="relative flex flex-col sm:flex-row gap-5 sm:gap-7">
          <button
            onClick={() => onOpen(heroBook)}
            className="mx-auto sm:mx-0 shrink-0 transition-transform duration-300 hover:-translate-y-1.5 hover:-rotate-1 active:scale-[0.98]"
            aria-label={`Abrir ${heroBook.title}`}
          >
            <BookCover
              title={heroBook.title}
              author={heroBook.author}
              coverUrl={heroBook.coverUrl}
              detail="lg"
              className="w-32 sm:w-40 aspect-[2/3] shadow-pop"
            />
          </button>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-85">
              <Sparkles size={14} />
              {recommendation ? 'Tu próxima lectura' : 'Una joya para volver'}
            </p>
            <h3 className="font-display text-3xl sm:text-4xl font-semibold leading-tight mt-2 line-clamp-3">
              {heroBook.title}
            </h3>
            <p className="text-sm font-semibold opacity-85 mt-1">{heroBook.author || 'Autor desconocido'}</p>

            <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5 text-[11px] font-bold">
              {heroBook.pages > 0 && <HeroChip>{heroBook.pages} págs</HeroChip>}
              <HeroChip>{formatLabel(heroBook.format)}</HeroChip>
              <HeroChip>{languageLabel(heroBook.language)}</HeroChip>
              {seriesLabel(heroBook) && <HeroChip>{seriesLabel(heroBook)}</HeroChip>}
              {(heroBook.tags || []).slice(0, 3).map((tag) => <HeroChip key={tag}>{tag}</HeroChip>)}
            </div>

            <ul className="mt-4 space-y-1.5 text-sm leading-relaxed opacity-95">
              {heroReasons.map((reason) => (
                <li key={reason} className="flex gap-2 text-left">
                  <Sparkles size={15} className="mt-0.5 shrink-0" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap justify-center sm:justify-start gap-2">
              <button
                onClick={() => onOpen(heroBook)}
                className="inline-flex items-center gap-1.5 rounded-btn bg-white px-4 py-2.5 text-sm font-extrabold text-neutral-900 shadow-card transition-all hover:bg-white/90 active:scale-95"
              >
                Ver ficha <ArrowRight size={15} />
              </button>
              {discovery.recommendations.length > 1 && (
                <button
                  onClick={() => setRecommendationIndex((value) => value + 1)}
                  className="inline-flex items-center gap-1.5 rounded-btn bg-ongrad/10 px-4 py-2.5 text-sm font-extrabold ring-1 ring-ongrad/30 transition-all hover:bg-ongrad/20 active:scale-95"
                >
                  <Shuffle size={15} /> Otra idea
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Continuar */}
        <section className={cx(cardCls, 'p-4 sm:p-5')}>
          <SectionHeader icon={<Clock3 size={17} />} title="Sigue con impulso" count={discovery.continueBooks.length} />
          {discovery.continueBooks.length ? (
            <div className="space-y-3">
              {discovery.continueBooks.slice(0, 3).map((book) => {
                const pct = bookProgress(book);
                const left = book.pages > 0 ? Math.max(book.pages - book.currentPage, 0) : 0;
                const sessions = left > 0 ? Math.ceil(left / 25) : 0;
                return (
                  <div key={book.id} className="flex gap-3 rounded-btn bg-sunken/55 p-3">
                    <button onClick={() => onOpen(book)} aria-label={`Abrir ${book.title}`} className="shrink-0 transition-transform hover:-translate-y-0.5">
                      <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-11 h-[66px] shadow-book" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button onClick={() => onOpen(book)} className="block max-w-full truncate text-left text-sm font-bold text-ink hover:text-accent">
                        {book.title}
                      </button>
                      <p className="truncate text-xs text-ink3">{book.author || 'Autor desconocido'}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <ProgressBar pct={pct} className="h-2 flex-1" />
                        <span className="text-[11px] font-extrabold tabular-nums text-ink2">{pct.toFixed(0)}%</span>
                      </div>
                      <p className="mt-1.5 text-[11px] font-medium text-ink3">
                        {left > 0
                          ? `${left} págs para terminar · unas ${sessions} ${sessions === 1 ? 'sesión' : 'sesiones'} de 25`
                          : 'Listo para registrar tu avance'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyMini text="No tienes ninguna lectura en curso. La recomendación de arriba puede ser el comienzo." />
          )}
        </section>

        {/* Ruleta */}
        <section className={cx(cardCls, 'p-4 sm:p-5 overflow-hidden relative')}>
          <Dices size={150} strokeWidth={0.6} className="absolute -right-8 -bottom-10 text-accent opacity-[0.07]" aria-hidden />
          <SectionHeader
            icon={<Dices size={17} />}
            title="Ruleta lectora"
            action={(
              <button onClick={spinRoulette} disabled={!rouletteCandidates.length} className={btnSoft}>
                <Shuffle size={13} /> Girar
              </button>
            )}
          />
          <div className="relative">
            {rouletteBook ? (
              <div className="flex items-center gap-4">
                <button onClick={() => onOpen(rouletteBook)} aria-label={`Abrir ${rouletteBook.title}`} className="shrink-0 transition-transform hover:-translate-y-1 hover:-rotate-1">
                  <BookCover title={rouletteBook.title} author={rouletteBook.author} coverUrl={rouletteBook.coverUrl} detail="md" className="w-20 aspect-[2/3] shadow-book" />
                </button>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">El azar ha hablado</p>
                  <button onClick={() => onOpen(rouletteBook)} className="mt-1 block text-left font-display text-xl font-semibold leading-tight text-ink line-clamp-2 hover:text-accent">
                    {rouletteBook.title}
                  </button>
                  <p className="mt-1 truncate text-sm text-ink3">{rouletteBook.author || 'Autor desconocido'}</p>
                  <p className="mt-2 text-xs font-semibold text-ink2">
                    {rouletteBook.status === 'reading' ? 'Retómalo durante 15 minutos.' : 'Lee las primeras 10 páginas y decide.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-3">
                <p className="font-display text-lg font-semibold text-ink">¿No sabes qué leer?</p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-ink3">
                  Gira la ruleta entre tus pendientes y lecturas en curso. Sin pensar demasiado: diez páginas y a ver qué pasa.
                </p>
                <button onClick={spinRoulette} disabled={!rouletteCandidates.length} className={cx(btnSoft, 'mt-4')}>
                  <Dices size={14} /> Sorpréndeme
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Joyas para releer */}
      {discovery.rereadGems.length > 0 && (
        <section>
          <SectionHeader icon={<Trophy size={17} />} title="Joyas para releer" count={discovery.rereadGems.length} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 stagger">
            {discovery.rereadGems.map((book) => (
              <article key={book.id} className={cx(cardCls, 'group overflow-hidden hover:shadow-lift hover:-translate-y-1 transition-all duration-300')}>
                <button onClick={() => onOpen(book)} className="block w-full bg-sunken" aria-label={`Abrir ${book.title}`}>
                  <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="md" className="aspect-[2/3] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                </button>
                <div className="p-3">
                  <h4 className="h-[2.55em] font-display text-sm font-semibold leading-snug text-ink line-clamp-2">{book.title}</h4>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <StarRating value={book.rating} size={11} />
                    <span className="text-[10px] font-semibold text-ink3">{formatDate(book.finishedAt)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Olvidados */}
        <section className={cx(cardCls, 'p-4 sm:p-5')}>
          <SectionHeader icon={<History size={17} />} title="Pendientes olvidados" count={discovery.forgotten.length} />
          {discovery.forgotten.length ? (
            <div className="divide-y divide-line/70">
              {discovery.forgotten.map((book) => (
                <div key={book.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <button onClick={() => onOpen(book)} aria-label={`Abrir ${book.title}`} className="shrink-0 transition-transform hover:-translate-y-0.5">
                    <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} detail="sm" className="w-9 h-[54px] shadow-book" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onOpen(book)} className="block max-w-full truncate text-left text-sm font-bold text-ink hover:text-accent">
                      {book.title}
                    </button>
                    <p className="truncate text-xs text-ink3">{book.author || 'Autor desconocido'}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-ink3">
                      <Bookmark size={11} /> En tu lista desde {formatDate(book.createdAt)}
                    </p>
                  </div>
                  {book.pages > 0 && <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink3">{book.pages} págs</span>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyMini text="No hay pendientes esperando. Todo en orden por aquí." />
          )}
        </section>

        {/* Perfil de gustos */}
        <section className={cx(cardCls, 'p-4 sm:p-5')}>
          <SectionHeader icon={<Library size={17} />} title="Tu perfil de gustos" />
          {discovery.topAuthors.length ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink3">Autores de cabecera</p>
                <div className="space-y-2.5">
                  {discovery.topAuthors.map((author) => (
                    <div key={author.label} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-xs font-semibold text-ink2" title={author.label}>{author.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                        <span className="block h-full rounded-full bg-grad-primary animate-grow-x" style={{ width: `${(author.count / maxAuthorCount) * 100}%` }} />
                      </span>
                      <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-ink3">
                        {author.count} {author.count === 1 ? 'libro' : 'libros'}
                        {average(author) > 0 ? ` · ${average(author).toFixed(1)}★` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {discovery.topTags.length > 0 && (
                <div>
                  <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink3">Territorios favoritos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {discovery.topTags.map((tag) => (
                      <span key={tag.label} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1.5 text-[11px] font-extrabold text-accent">
                        <RotateCcw size={11} />
                        {tag.label}
                        <span className="opacity-70">{tag.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyMini text="Cuando termines y puntúes libros, aquí aparecerán tus autores y géneros de cabecera." />
          )}
        </section>
      </div>
    </div>
  );
}

function HeroChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-ongrad/10 px-2.5 py-1 ring-1 ring-ongrad/20 backdrop-blur-sm">
      {children}
    </span>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-btn bg-sunken/55 p-3.5">
      <Sparkles size={17} className="mt-0.5 shrink-0 text-accent" />
      <p className="text-sm leading-relaxed text-ink2">{text}</p>
    </div>
  );
}
