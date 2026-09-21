import { useMemo, useState } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import type { Book } from '../types';

interface Props {
  books: Book[];
  goal: number;
  onSetGoal: (goal: number) => void;
}

export function ReadingChallenge({ books, goal, onSetGoal }: Props) {
  const [goalInput, setGoalInput] = useState(goal.toString());
  const [editing, setEditing] = useState(false);

  const year = new Date().getFullYear();
  const readThisYear = useMemo(
    () =>
      books.filter((b) => {
        if (b.status !== 'read' || !b.finishedAt) return false;
        return new Date(b.finishedAt).getFullYear() === year;
      }),
    [books, year]
  );

  const count = readThisYear.length;
  const pct = goal > 0 ? Math.min((count / goal) * 100, 100) : 0;

  // Pace calculation
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const yearPct = (dayOfYear / daysInYear) * 100;

  const expectedBooks = Math.round((goal * yearPct) / 100);
  const diff = count - expectedBooks;

  let paceStatus: { label: string; color: string; icon: typeof TrendingUp; bg: string };
  if (diff > 1) {
    paceStatus = { label: `Vas adelantado por ${diff} libros`, color: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp, bg: 'bg-emerald-50 dark:bg-emerald-500/10' };
  } else if (diff < -1) {
    paceStatus = { label: `Vas retrasado por ${Math.abs(diff)} libros`, color: 'text-red-500 dark:text-red-400', icon: TrendingDown, bg: 'bg-red-50 dark:bg-red-500/10' };
  } else {
    paceStatus = { label: 'Vas en buen ritmo', color: 'text-blue-500 dark:text-blue-400', icon: Minus, bg: 'bg-blue-50 dark:bg-blue-500/10' };
  }

  const PaceIcon = paceStatus.icon;
  const remaining = Math.max(goal - count, 0);
  const daysLeft = daysInYear - dayOfYear;
  const booksPerWeekNeeded = daysLeft > 0 ? (remaining / (daysLeft / 7)).toFixed(1) : '0';

  const saveGoal = () => {
    const n = parseInt(goalInput) || 0;
    onSetGoal(Math.max(0, n));
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center">
              <Target size={18} className="text-white dark:text-gray-900" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">Reto {year}</h2>
              <p className="text-xs text-gray-400">Objetivo anual de lectura</p>
            </div>
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:border-gray-900 dark:focus:border-gray-500"
                autoFocus
              />
              <button
                onClick={saveGoal}
                className="px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setGoalInput(goal.toString()); setEditing(true); }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {goal} libros
            </button>
          )}
        </div>

        {/* Progress ring */}
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg width={112} height={112} className="-rotate-90">
              <circle cx={56} cy={56} r={48} fill="none" strokeWidth={10} className="stroke-gray-100 dark:stroke-gray-800" />
              <circle
                cx={56}
                cy={56}
                r={48}
                fill="none"
                strokeWidth={10}
                stroke="url(#gradChallenge)"
                strokeDasharray={`${2 * Math.PI * 48}`}
                strokeDashoffset={`${2 * Math.PI * 48 * (1 - pct / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="gradChallenge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
              <span className="text-[10px] text-gray-400">/ {goal}</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Progreso</span>
              <span className="font-bold text-gray-900 dark:text-white">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #ec4899)' }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{remaining} restantes</span>
              <span>{daysLeft} días left</span>
            </div>
            <p className="text-xs text-gray-400">Necesitas {booksPerWeekNeeded} libros/semana</p>
          </div>
        </div>
      </div>

      {/* Pace indicator */}
      <div className={`rounded-2xl border p-5 ${paceStatus.bg} border-transparent`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-gray-900`}>
            <PaceIcon size={20} className={paceStatus.color} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${paceStatus.color}`}>{paceStatus.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Se esperaban {expectedBooks} libros para hoy ({yearPct.toFixed(0)}% del año)
            </p>
          </div>
        </div>
      </div>

      {/* Books read this year */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-amber-400" />
          Libros completados en {year}
        </h3>
        {readThisYear.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aún no has completado ningún libro este año.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {readThisYear.map((b) => (
              <div key={b.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-1.5 pr-3">
                {b.coverUrl ? (
                  <img src={b.coverUrl} alt={b.title} className="w-8 h-11 object-cover rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-8 h-11 rounded-sm bg-gray-200 dark:bg-gray-700" />
                )}
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-white max-w-[120px] truncate">{b.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {b.finishedAt ? new Date(b.finishedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
