import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { parseReadingDate, formatReadingDate, readingDateInput } from '../src/readingDate.ts';
import { completedReadings, startReread } from '../src/rereads.ts';

test('fechas parciales se validan y muestran sin inventar mes o día', () => {
  for (const [value, precision] of [['2020', 'year'], ['2020-02', 'month'], ['2020-02-29', 'day']]) {
    const parsed = parseReadingDate(value);
    assert.equal(parsed.precision, precision);
    assert.equal(readingDateInput(parsed.timestamp, precision), value);
    const label = formatReadingDate({ finishedAt: parsed.timestamp, finishedAtPrecision: precision });
    if (precision === 'year') assert.equal(label, '2020');
    if (precision === 'month') assert.match(label, /^febrero de 2020$/);
  }
  for (const invalid of ['2020-13', '2021-02-29', '2020-00', '2020-2', 'abc']) assert.equal(parseReadingDate(invalid), null);
  const stamp = parseReadingDate('2020').timestamp;
  const book = { status: 'read', finishedAt: stamp, finishedAtPrecision: 'year', pages: 100, journal: [] };
  const restarted = { ...book, ...startReread(book, Date.now(), () => Math.random().toString()) };
  assert.equal(completedReadings(restarted)[0].finishedAtPrecision, 'year');
});

test('el formulario guarda año o mes sin modificar el diario y la estantería permite elegir colores', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { BookForm } = await vite.ssrLoadModule('/src/components/BookForm.tsx');
  const { Bookshelf } = await vite.ssrLoadModule('/src/components/Bookshelf.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const book = { id: '1', title: 'Antiguo', author: '', status: 'read', tags: [], pages: 100, currentPage: 100, rating: 0, createdAt: 1, finishedAt: Date.now(), startedAt: null, coverUrl: '', journal: [], notes: '', format: 'paperback', language: 'es', publishDate: '', description: '', isbn: '' };
  let saved;
  await React.act(async () => root.render(React.createElement(BookForm, { editingBook: book, availableTags: [], onClose() {}, onSubmit: (value) => { saved = value; } })));
  const input = document.querySelector('#f-finished');
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '2018-05'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await React.act(async () => document.querySelector('#book-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(saved.finishedAtPrecision, 'month');
  assert.equal(readingDateInput(saved.finishedAt, saved.finishedAtPrecision), '2018-05');
  assert.deepEqual(saved.journal, []);
  const updates = [];
  await React.act(async () => root.render(React.createElement(Bookshelf, { books: [], colors: { frame: '#eee6d5', wood: '#d3a15f', background: '#ded7c9' }, onSetColor: (...args) => updates.push(args), onOpen() {} })));
  const toggle = [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Colores de la estantería'));
  await React.act(async () => toggle.click());
  assert.equal(document.querySelectorAll('#shelf-colors input[type=color]').length, 3);
  const color = document.querySelector('[aria-label="Color de madera"]');
  await React.act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(color, '#112233'); color.dispatchEvent(new dom.window.Event('input', { bubbles: true })); color.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.deepEqual(updates[0], ['wood', '#112233']);
});
