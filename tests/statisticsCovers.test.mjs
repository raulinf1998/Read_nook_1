import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('portadas de Stats siguen el periodo, incluyen relecturas y abren el libro original', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { Statistics } = await vite.ssrLoadModule('/src/components/Statistics.tsx');
  const { DEFAULT_CHART_PREFERENCES } = await vite.ssrLoadModule('/src/preferences.ts');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const date = (y, m, d = 1) => new Date(y, m - 1, d, 12).getTime();
  const book = (id, title, extra) => ({ id, title, author: 'Autora', coverUrl: `https://example.com/${id}.jpg`, status: 'read', pages: 100, currentPage: 100, rating: 0, tags: [], language: 'es', createdAt: 1, format: 'paperback', journal: [], ...extra });
  const books = [
    book('a', 'Año anterior', { finishedAt: date(2020, 1) }),
    book('b', 'Dos lecturas', { finishedAt: date(2021, 3), previousReadings: [{ finishedAt: date(2021, 3, 2), pages: 100 }] }),
    book('c', 'Solo año', { finishedAt: date(2021, 1), finishedAtPrecision: 'year' }),
    book('d', 'Releyendo', { status: 'reading', finishedAt: null, previousReadings: [{ finishedAt: date(2021, 3), pages: 100 }] }),
    book('e', 'Sin fecha', { finishedAt: null }),
    book('f', 'Pendiente', { status: 'pending', finishedAt: null }),
  ];
  let opened;
  await React.act(async () => root.render(React.createElement(Statistics, { books, onOpen: (book) => { opened = book; }, chartPreferences: DEFAULT_CHART_PREFERENCES, onSetChartPreference() {} })));
  const covers = () => [...document.querySelectorAll('button[aria-label^="Abrir "]')];
  assert.deepEqual(new Set(covers().map((el) => el.getAttribute('aria-label'))), new Set(['Abrir Año anterior', 'Abrir Dos lecturas', 'Abrir Solo año', 'Abrir Releyendo', 'Abrir Sin fecha']));
  await React.act(async () => [...document.querySelectorAll('button')].find((el) => el.textContent === 'Por año').click());
  const setSelect = async (label, value) => React.act(async () => { const select = document.querySelector(`select[aria-label="${label}"]`); select.value = value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  await setSelect('Año', '2021');
  assert.deepEqual(new Set(covers().map((el) => el.getAttribute('aria-label'))), new Set(['Abrir Dos lecturas', 'Abrir Solo año', 'Abrir Releyendo']));
  assert.match(covers().find((el) => el.getAttribute('aria-label') === 'Abrir Dos lecturas').textContent, /2 lecturas/);
  await React.act(async () => covers().find((el) => el.getAttribute('aria-label') === 'Abrir Releyendo').click());
  assert.equal(opened, books[3]);
  await React.act(async () => [...document.querySelectorAll('button')].find((el) => el.textContent === 'Por mes').click());
  await setSelect('Mes', '2');
  assert.deepEqual(new Set(covers().map((el) => el.getAttribute('aria-label'))), new Set(['Abrir Dos lecturas', 'Abrir Releyendo']));
  await setSelect('Mes', '3');
  assert.equal(covers().length, 0);
  assert.match(document.body.textContent, /No hay libros terminados en este periodo/);
});

test('nombres de navegación son iguales en móvil y ordenador', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { MobileNav, Sidebar } = await vite.ssrLoadModule('/src/components/Navigation.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const noop = () => {};
  await React.act(async () => root.render(React.createElement(React.Fragment, null, React.createElement(Sidebar, { active: 'reading', counts: {}, onChange: noop, onAdd: noop, onImport: noop, onTags: noop, onAppearance: noop, theme: 'calido', onSetTheme: noop, dark: false, onToggleDark: noop }), React.createElement(MobileNav, { active: 'reading', onChange: noop }))));
  const desktop = [...document.querySelectorAll('aside nav button')].map((button) => button.textContent.trim());
  assert.deepEqual(desktop, ['Inicio', 'Libros', 'Librería', 'Espacio', 'Calendario', 'Descubrir', 'Reto anual', 'Stats']);
  const mobile = [...document.querySelectorAll('nav > div.grid > button')].map((button) => button.getAttribute('aria-label'));
  assert.deepEqual(mobile, ['Inicio', 'Libros', 'Stats', 'Librería', 'Otros']);
  for (const label of mobile.filter((label) => label !== 'Otros')) assert.ok(desktop.includes(label));
  await React.act(async () => document.querySelector('[aria-label="Otros"]').click());
  const others = [...document.querySelectorAll('#mobile-other-tabs button')].map((button) => button.textContent.trim());
  assert.deepEqual(others, ['Espacio', 'Calendario', 'Descubrir', 'Reto anual']);
  for (const label of others) assert.ok(desktop.includes(label));
});
