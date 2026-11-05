import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('Leyendo ahora muestra el progreso sin deslizador y registra avances en el diario', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { ReadingNow } = await vite.ssrLoadModule('/src/components/ReadingNow.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const book = (id, pages, previousReadings) => ({ id, title: id, status: 'reading', author: '', coverUrl: '', pages, currentPage: 25, rating: 0, tags: [], journal: [], previousReadings });
  const books = [book('Primera lectura', 100), book('Relectura', 100, [{ finishedAt: 1, pages: 100 }]), book('Sin páginas', 0)];
  const noop = () => {};
  let updated;
  await React.act(async () => root.render(React.createElement(ReadingNow, { books, goal: 12, onUpdate: (...args) => { updated = args; }, onEdit: noop, onOpen: noop, onOpenSeries: noop, onAdd: noop, onLoadDemo: noop, onGoChallenge: noop })));
  const cards = [...document.querySelectorAll('article')];
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.equal(card.querySelector('input[type="range"]'), null);
    assert.ok(card.querySelector('[role="progressbar"]'));
    assert.ok([...card.querySelectorAll('button')].some((b) => b.textContent.includes('Registrar avance')));
  }
  assert.equal(cards[0].querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '25');
  assert.match(cards[0].textContent, /Página 25/);
  assert.equal(updated, undefined);
  await React.act(async () => [...cards[0].querySelectorAll('button')].find((b) => b.textContent.includes('Registrar avance')).click());
  const input = document.querySelector('input[type="number"]');
  assert.ok(input);
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '40'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await React.act(async () => input.closest('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(updated[0], 'Primera lectura');
  assert.equal(updated[1].currentPage, 40);
  assert.equal(updated[1].journal[0].pages, 15);
});
