import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('Más recientes ordena por última finalización y deja los libros sin fecha al final', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { Library } = await vite.ssrLoadModule('/src/components/Library.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const book = (title, createdAt, finishedAt, extra = {}) => ({ id: title, title, createdAt, finishedAt, status: 'read', tags: [], author: 'Autora', pages: 100, currentPage: 100, rating: 0, format: 'paperback', coverUrl: '', journal: [], ...extra });
  const books = [book('Sin fecha', 1000, null), book('Antiguo', 900, 100), book('Reciente', 1, 300), book('Releyendo', 2, null, { status: 'reading', previousReadings: [{ finishedAt: 200, pages: 100 }] }), book('Pendiente', 800, null, { status: 'pending' })];
  const noop = () => {};
  const props = { books, view: 'grid', onSetView: noop, onUpdate: noop, onDelete: noop, onEdit: noop, onOpen: noop, onOpenSeries: noop };
  await React.act(async () => root.render(React.createElement(Library, props)));
  const titles = () => [...document.querySelectorAll('article h3')].map((element) => element.textContent);
  assert.deepEqual(titles(), ['Reciente', 'Releyendo', 'Antiguo', 'Sin fecha', 'Pendiente']);
  const selector = document.querySelector('select[aria-label="Ordenar por"]');
  await React.act(async () => { selector.value = 'title'; selector.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.deepEqual(titles(), ['Antiguo', 'Pendiente', 'Reciente', 'Releyendo', 'Sin fecha']);
  await React.act(async () => { selector.value = 'recent'; selector.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.deepEqual(titles(), ['Reciente', 'Releyendo', 'Antiguo', 'Sin fecha', 'Pendiente']);
});
