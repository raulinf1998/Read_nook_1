import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('cada gráfico abre el desglose correcto, con portadas y valores en todas sus variantes', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { Statistics } = await vite.ssrLoadModule('/src/components/Statistics.tsx');
  const { DEFAULT_CHART_PREFERENCES } = await vite.ssrLoadModule('/src/preferences.ts');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const y = new Date().getFullYear(); const date = (year, month, day) => new Date(year, month, day, 12).getTime();
  const make = (id, author, finish, pages, rating, journal) => ({ id, title: 'Mismo título', author, coverUrl: `https://example.com/${id}.jpg`, status: 'read', pages, currentPage: pages, rating, tags: ['Fantasía'], language: 'es', createdAt: 1, finishedAt: finish, format: 'paperback', journal });
  const books = [make('a', 'Ana', date(y, 2, 3), 320, 4.5, [{ id: 's1', date: date(y, 2, 4), pages: 25 }, { id: 's2', date: date(y, 2, 5), pages: 15 }]), make('b', 'Bea', date(y, 2, 4), 200, 3, [{ id: 's3', date: date(y, 2, 4), pages: 10 }]), make('c', 'Celia', date(y - 1, 2, 4), 150, 3, [{ id: 's4', date: date(y - 1, 2, 4), pages: 80 }])];
  let opened;
  const render = (variant) => React.act(async () => root.render(React.createElement(Statistics, { books, onOpen: (book) => { opened = book; }, chartPreferences: { ...DEFAULT_CHART_PREFERENCES, journal: variant, books: variant, extension: variant, ratings: variant, topBooks: variant === 'bars' ? 'horizontal' : variant === 'line' ? 'columns' : 'donut', authors: variant === 'bars' ? 'horizontal' : variant === 'line' ? 'columns' : 'donut' }, onSetChartPreference() {} })));
  const section = (title) => [...document.querySelectorAll('h3')].find((h) => h.textContent === title).closest('section');
  const dialog = () => document.querySelector('[role=dialog]');
  const clickChart = async (title, label, index = 0) => { const targets = [...section(title).querySelectorAll(`[aria-label="${label}"]`)]; assert.ok(targets[index], `${title}: ${label}`); await React.act(async () => targets[index].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); assert.ok(dialog()); };
  const close = async () => React.act(async () => dialog().querySelector('[aria-label="Cerrar"]').click());
  const setSelect = async (label, value) => React.act(async () => { const select = document.querySelector(`select[aria-label="${label}"]`); select.value = value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  for (const variant of ['bars', 'line', 'area']) {
    await render(variant);
    await React.act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Por año').click());
    await setSelect('Año', String(y));
    assert.equal(section('Libros con más actividad').querySelectorAll('img').length, 2, variant);
    await clickChart('Libros con más actividad', 'Ver lecturas de Mismo título: 40');
    assert.match(dialog().textContent, /Ana/); assert.match(dialog().textContent, /40 págs registradas · 2 sesiones/); assert.doesNotMatch(dialog().textContent, /Bea|Celia/); assert.ok(dialog().querySelector('img[src="https://example.com/a.jpg"]'));
    await React.act(async () => dialog().querySelector('button:not([aria-label="Cerrar"])').click()); assert.equal(opened, books[0]); assert.equal(dialog(), null);
    await clickChart('Libros con más actividad', 'Ver lecturas de Mismo título: 10'); assert.match(dialog().textContent, /Bea/); assert.doesNotMatch(dialog().textContent, /Ana/); await close();
    await clickChart('Ritmo del diario', 'Ver lecturas de Mar: 50'); assert.match(dialog().textContent, /40 págs registradas/); assert.match(dialog().textContent, /10 págs registradas/); assert.doesNotMatch(dialog().textContent, /Celia/); await close();
    await clickChart('Libros por mes', 'Ver lecturas de Mar: 2'); assert.match(dialog().textContent, /Ana/); assert.match(dialog().textContent, /Bea/); await close();
    await clickChart('Extensión de los libros', 'Ver lecturas de 251–400: 1'); assert.match(dialog().textContent, /320 págs/); assert.match(dialog().textContent, /Ana/); await close();
    await clickChart('Distribución de puntuaciones', 'Ver lecturas de 4.5: 1'); assert.match(dialog().textContent, /4.5 estrellas/); assert.match(dialog().textContent, /Ana/); await close();
    await clickChart('Autores más leídos', 'Ver lecturas de Bea: 1'); assert.match(dialog().textContent, /Bea/); assert.doesNotMatch(dialog().textContent, /Ana/); await close();
    await React.act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Por mes').click()); await setSelect('Mes', '2');
    await clickChart('Ritmo del diario', 'Ver lecturas de 4: 35'); assert.match(dialog().textContent, /25 págs registradas/); assert.match(dialog().textContent, /10 págs registradas/); await close();
    await clickChart('Libros por día', 'Ver lecturas de 3: 1'); assert.match(dialog().textContent, /Ana/); assert.doesNotMatch(dialog().textContent, /Bea/); await close();
  }
});
