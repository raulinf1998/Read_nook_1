import { useMemo, useState } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Trophy, Pencil, Check, PartyPopper, Flag, CalendarDays, Gauge } from 'lucide-react';
import type { Book } from '../types';
import { BookCover, cx, cardCls } from './ui';

interface Props {
  books: Book[];
  goal: number;
  onSetGoal: (goal: number) => void;
  onOpen: (book: Book) => void;
}

export function ReadingChallenge({ books, goal, onSetGoal, onOpen }: Props) {
  const [goalInput, setGoalInput] = useState(goal.toString());
  const [editing, setEditing] = useState(false);

  const year = new Date().getFullYear();
  const readThisYear = useMemo(
    () =>
      books
        .filter((b) => b.status === 'read' && b.finishedAt && new Date(b.finishedAt).getFullYear() === year)
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)),
    [books, year]
  );

  const count = readThisYear.length;
  const pct = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;
  const completed = goal > 0 && count >= goal;

  // Ritmo: libros esperados a día de hoy
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const yearPct = (dayOfYear / daysInYear) * 100;
  const expectedBooks = Math.round((goal * yearPct) / 100);
  const diff = count - expectedBooks;

  let pace: { label: string; detail: string; icon: typeof TrendingUp; cls: string };
  if (completed) {
    pace = { label: '¡Reto completado!', detail: `Has alcanzado tu objetivo de ${goal} libros. ¿Subimos el listón?`, icon: PartyPopper, cls: 'text-stread bg-stread/10 border-stread/25' };
  } else if (diff > 1) {
    pace = { label: `Vas por delante: +${diff} libros`, detail: `Para hoy se esperaban ${expectedBooks} (${yearPct.toFixed(0)}% del año).`, icon: TrendingUp, cls: 'text-stread bg-stread/10 border-stread/25' };
  } else if (diff < -1) {
    pace = { label: `Vas por detrás: ${diff} libros`, detail: `Para hoy se esperaban ${expectedBooks} (${yearPct.toFixed(0)}% del año). ¡Aún hay tiempo!`, icon: TrendingDown, cls: 'text-danger bg-danger/10 border-danger/25' };
  } else {
    pace = { label: 'Vas en ritmo perfecto', detail: `Se esperaban ${expectedBooks} libros para hoy (${yearPct.toFixed(0)}% del año).`, icon: Minus, cls: 'text-streading bg-streading/10 border-streading/25' };
  }
  const PaceIcon = pace.icon;

  const remaining = Math.max(goal - count, 0);
  const daysLeft = daysInYear - dayOfYear;
  const booksPerWeekNeeded = daysLeft > 0 ? (remaining / (daysLeft / 7)).toFixed(1) : '0';

  const saveGoal = (n: number) => {
    onSetGoal(Math.max(0, Math.min(999, n)));
    setEditing(false);
  };

  const milestones = [25, 50, 75, 100].map((m) => ({
    pct: m,
    booksNeeded: Math.ceil((goal * m) / 100),
    done: pct >= m,
  }));

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Héroe del reto */}
      <section className="relative overflow-hidden rounded-card shadow-lift bg-grad-primary text-ongrad p-5 sm:p-7">
        <Target size={240} strokeWidth={0.5} className="absolute -right-10 -top-10 opacity-[0.12]" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5 sm:gap-7">
          {/* Anillo */}
          <div className="relative w-[132px] h-[132px] shrink-0 mx-auto sm:mx-0">
            <svg width={132} height={132} className="-rotate-90">
              <circle cx={66} cy={66} r={57} fill="none" strokeWidth={11} style={{ stroke: 'rgb(var(--on-grad) / 0.25)' }} />
              <circle
                cx={66} cy={66} r={57} fill="none" strokeWidth={11} strokeLinecap="round"
                style={{ stroke: 'rgb(var(--on-grad) / 0.96)' }}
                strokeDasharray={`${2 * Math.PI * 57}`}
                strokeDashoffset={`${2 * Math.PI * 57 * (1 - pct / 100)}`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl font-semibold leading-none tabular-nums">{count}</span>
              <span className="text-[11px] font-semibold opacity-85 mt-1">de {goal} libros</span>
              <span className="text-sm font-extrabold mt-0.5 tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-[230px]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">Reto de lectura</p>
            <h2 className="font-display text-3xl font-semibold mt-1">
              {completed ? `¡${year} conquistado!` : `Tu año lector ${year}`}
            </h2>

            {/* Edición del objetivo */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {editing ? (
                <span className="flex items-center gap-1.5 bg-ongrad/10 ring-1 ring-ongrad/30 rounded-btn p-1">
                  <StepperBtn onClick={() => setGoalInput(String(Math.max(0, (parseInt(goalInput) || 0) - 1)))} label="−" aria="Quitar uno" />
                  <input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveGoal(parseInt(goalInput) || 0)}
                    className="w-16 px-2 py-1 rounded-lg bg-white/90 text-neutral-900 text-sm font-bold text-center outline-none"
                    autoFocus
                    aria-label="Objetivo anual de libros"
                  />
                  <StepperBtn onClick={() => setGoalInput(String((parseInt(goalInput) || 0) + 1))} label="+" aria="Añadir uno" />
                  <button
                    onClick={() => saveGoal(parseInt(goalInput) || 0)}
                    className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-neutral-900 text-xs font-extrabold hover:bg-white/90 active:scale-95 transition-all"
                  >
                    <Check size={13} strokeWidth={3} /> Guardar
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => { setGoalInput(goal.toString()); setEditing(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-ongrad/10 ring-1 ring-ongrad/30 text-xs font-bold hover:bg-ongrad/20 active:scale-95 transition-all"
                >
                  Objetivo: {goal} libros <Pencil size={12} />
                </button>
              )}
              <span className="text-xs font-semibold opacity-85">{remaining} por leer · {daysLeft} días restantes</span>
            </div>

            {/* Hitos */}
            <div className="mt-5">
              <div className="relative h-2 rounded-full bg-ongrad/20">
                <div className="absolute inset-y-0 left-0 rounded-full bg-ongrad transition-all duration-700" style={{ width: `${pct}%` }} />
                {milestones.slice(0, 3).map((m) => (
                  <span
                    key={m.pct}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
                    style={{ left: `${m.pct}%`, background: m.done ? 'rgb(var(--on-grad))' : 'rgb(var(--on-grad) / 0.3)', border: '2px solid rgb(var(--on-grad) / 0.55)' }}
                    title={`${m.pct}% · ${m.booksNeeded} libros`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-bold opacity-85">
                {milestones.map((m) => (
                  <span key={m.pct} className={m.done ? '' : 'opacity-70'}>{m.done ? '✓ ' : ''}{m.pct}%</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ritmo + cifras */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cx('rounded-card border p-4 flex items-center gap-3 shadow-card sm:col-span-1', pace.cls.split(' ').slice(1).join(' '))}>
          <span className="w-10 h-10 rounded-btn bg-surface flex items-center justify-center shrink-0 shadow-card">
            <PaceIcon size={20} className={pace.cls.split(' ')[0]} />
          </span>
          <div className="min-w-0">
            <p className={cx('font-display font-semibold text-sm leading-snug', pace.cls.split(' ')[0])}>{pace.label}</p>
            <p className="text-[11px] text-ink2 mt-0.5 leading-snug">{pace.detail}</p>
          </div>
        </div>
        <InfoTile
          icon={<Gauge size={17} />}
          value={`${booksPerWeekNeeded} / semana`}
          label="Ritmo necesario para llegar"
        />
        <InfoTile
          icon={<CalendarDays size={17} />}
          value={`${daysLeft} días`}
          label={`Para cerrar ${year} (${yearPct.toFixed(0)}% transcurrido)`}
        />
      </div>

      {/* Libros del año */}
      <section className={cx(cardCls, 'p-4 sm:p-5')}>
        <h3 className="font-display font-semibold text-ink text-base flex items-center gap-2 mb-4">
          <Trophy size={17} className="text-gold" />
          Completados en {year}
          <span className="text-xs font-sans font-bold text-ink3 bg-sunken rounded-full px-2 py-0.5">{readThisYear.length}</span>
        </h3>
        {readThisYear.length === 0 ? (
          <div className="text-center py-8">
            <Flag size={26} className="text-ink3 mx-auto mb-2" />
            <p className="text-sm text-ink2 font-medium">La meta te espera: aún no has terminado ningún libro este año.</p>
            <p className="text-xs text-ink3 mt-1">Al completar uno aparecerá en esta vitrina.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 stagger">
            {readThisYear.map((b) => (
              <button key={b.id} onClick={() => onOpen(b)} className="group block w-full text-left" aria-label={`Abrir ficha de ${b.title}`}>
                <BookCover
                  title={b.title}
                  author={b.author}
                  coverUrl={b.coverUrl}
                  detail="md"
                  className="w-full aspect-[2/3] shadow-book group-hover:-translate-y-1.5 group-hover:-rotate-1 transition-transform duration-300"
                />
                <p className="text-[11px] font-semibold text-ink leading-tight line-clamp-2 mt-2">{b.title}</p>
                <p className="text-[10px] text-ink3 mt-0.5 capitalize">
                  {b.finishedAt ? new Date(b.finishedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}
                  {b.rating > 0 ? ` · ★ ${b.rating}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StepperBtn({ onClick, label, aria }: { onClick: () => void; label: string; aria: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="w-7 h-7 rounded-lg bg-ongrad/15 hover:bg-ongrad/25 text-base font-extrabold leading-none active:scale-90 transition-all"
    >
      {label}
    </button>
  );
}

function InfoTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className={cx(cardCls, 'p-4 flex items-center gap-3')}>
      <span className="w-10 h-10 rounded-btn bg-accent/10 text-accent flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-display font-semibold text-ink text-base leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-ink3 mt-1 leading-snug">{label}</p>
      </div>
    </div>
  );
}
