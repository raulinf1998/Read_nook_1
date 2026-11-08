import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readingActivity, pageLevel, daysInYear, dateKey } from '../src/readingCalendar.ts';

const date = (year, month, day) => new Date(year, month - 1, day, 12).getTime();
const entry = (day, pages, extra = {}) => ({ date: day, pages, ...extra });
const book = (id, journal) => ({ id, title: `Libro ${id}`, author: 'Autora', coverUrl: `https://example.com/${id}.jpg`, journal });

test('actividad suma sesiones y libros, sin inventar fechas parciales', () => {
  const day = date(2024, 2, 29);
  const books = [book('a', [entry(day, 10), entry(day, 10), entry(day, 100, { datePrecision: 'month' }), entry(day, 5, { datePrecision: 'unknown' })]), book('b', [entry(day, 31), entry(date(2024, 3, 1), 0, { minutes: 10 })])];
  const activity = readingActivity(books);
  assert.equal(activity.get('2024-02-29').pages, 51);
  assert.deepEqual(activity.get('2024-02-29').books.map(b => b.id), ['a', 'b']);
  assert.equal(activity.get('2024-03-01').pages, 0);
  assert.equal(readingActivity([book('c', [entry(day, 2, { datePrecision: 'year' }), entry(day, 0)])]).size, 0);
  assert.deepEqual([0, 1, 20, 21, 50, 51].map(pageLevel), [0, 1, 1, 2, 2, 3]);
  assert.equal(daysInYear(2024).length, 366);
  assert.equal(daysInYear(2025).length, 365);
  assert.equal(dateKey(daysInYear(2024)[59]), '2024-02-29');
});

test('calendario presenta varias portadas, abre libros y navega meses y años', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { ReadingCalendar } = await vite.ssrLoadModule('/src/components/ReadingCalendar.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const now = new Date(); const year = now.getFullYear(); const month = now.getMonth() + 1;
  const books = [book('a', [entry(date(year, month, 1), 20)]), book('b', [entry(date(year, month, 1), 31)])];
  let opened;
  await React.act(async () => root.render(React.createElement(ReadingCalendar, { books, onOpen: b => { opened = b; } })));
  const calendar = document.querySelector('[aria-label="Calendario de lectura"]');
  assert.equal(calendar.querySelectorAll('button[aria-label^="Abrir Libro"]').length, 2);
  await React.act(async () => calendar.querySelector('button[aria-label^="Abrir Libro b"]').click());
  assert.equal(opened, books[1]);
  const chart = document.querySelector('[aria-label="Actividad de lectura anual"]');
  assert.equal(chart.querySelectorAll('[role="img"]').length, daysInYear(year).length);
  const square = chart.querySelector(`[aria-label="${new Date(year, month - 1, 1, 12).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}: 51 páginas"]`);
  assert.ok(square.className.includes('bg-primary'));
  await React.act(async () => document.querySelector('[aria-label="Mes siguiente"]').click());
  assert.equal(calendar.querySelectorAll('button[aria-label^="Abrir Libro"]').length, 0);
  await React.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Hoy').click());
  assert.equal(calendar.querySelectorAll('button[aria-label^="Abrir Libro"]').length, 2);
  await React.act(async () => document.querySelector('[aria-label="Año anterior"]').click());
  assert.match(chart.textContent, new RegExp(`Tu actividad en ${year - 1}`));
  assert.equal(chart.querySelectorAll('[role="img"]').length, daysInYear(year - 1).length);
});
