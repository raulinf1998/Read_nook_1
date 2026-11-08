import type { Book } from './types';

export interface DayActivity { pages: number; books: Book[] }

/** Solo atribuye actividad a un día cuando el diario contiene una fecha exacta. */
export function readingActivity(books: Book[]): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();
  for (const book of books) {
    for (const entry of book.journal || []) {
      if (entry.datePrecision || !Number.isFinite(entry.date) || entry.date <= 0) continue;
      const pages = Number.isFinite(entry.pages) ? Math.max(0, entry.pages) : 0;
      const minutes = Number.isFinite(entry.minutes) ? Math.max(0, entry.minutes || 0) : 0;
      if (!pages && !minutes) continue;
      const key = dateKey(new Date(entry.date));
      const day = days.get(key) || { pages: 0, books: [] };
      day.pages += pages;
      if (!day.books.some((item) => item.id === book.id)) day.books.push(book);
      days.set(key, day);
    }
  }
  return days;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 20 pertenece al primer tramo; 50, al segundo. */
export function pageLevel(pages: number): number {
  return pages <= 0 ? 0 : pages <= 20 ? 1 : pages <= 50 ? 2 : 3;
}

export function daysInYear(year: number): Date[] {
  const days: Date[] = [];
  for (let date = new Date(year, 0, 1, 12); date.getFullYear() === year; date = new Date(year, date.getMonth(), date.getDate() + 1, 12)) days.push(date);
  return days;
}
