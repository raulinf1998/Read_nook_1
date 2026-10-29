import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { buildSpaceOrbits, buildSpaceReadings, normalizePlanetStyle, PLANET_STYLES } from '../src/space.ts';

const stamp = (year) => new Date(year, 5, 1, 12).getTime();
const book = (id, language, finishedAt, extra = {}) => ({ id, title: id, language, finishedAt, status: 'read', tags: [], pages: 100, currentPage: 100, rating: 0, author: 'Autora', createdAt: 1, coverUrl: '', journal: [], ...extra });
const books = [book('Inglés', 'en-GB', stamp(2021), { previousReadings: [{ finishedAt: stamp(2020), pages: 100 }] }), book('Castellano', 'es', stamp(2021)), book('Sin fecha', 'es', null), book('Francés', 'fr', stamp(2020)), book('Pendiente', 'en', null, { status: 'pending' })];

test('las lecturas y relecturas ocupan la órbita de su año y zona sin inventar datos', () => {
  const data = buildSpaceReadings(books);
  assert.deepEqual(data.years, [2020, 2021]);
  assert.equal(data.orbiting.length, 3);
  assert.deepEqual(data.withoutYear.map((b) => b.title), ['Sin fecha']);
  assert.deepEqual(data.otherLanguages.map((b) => b.title), ['Francés']);
  const layout = buildSpaceOrbits(data.orbiting, data.years);
  assert.ok(layout.inner.every((orbit) => orbit.radius < layout.beltRadius));
  assert.ok(layout.outer.every((orbit) => orbit.radius > layout.beltRadius));
  assert.deepEqual(layout.inner.map((orbit) => orbit.planets.length), [1, 1]);
  assert.deepEqual(layout.outer.map((orbit) => orbit.planets.length), [0, 1]);
  assert.equal(PLANET_STYLES.length, 10);
  assert.equal(normalizePlanetStyle('saturno'), 'saturno');
  assert.equal(normalizePlanetStyle('inexistente'), 'orbita');
});

test('el universo permite elegir los diez estilos y abrir cada libro original', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { Space } = await vite.ssrLoadModule('/src/components/Space.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  let opened, selected;
  const props = { books, planetStyle: 'orbita', onSetPlanetStyle: (v) => { selected = v; }, onOpen: (v) => { opened = v; } };
  await React.act(async () => root.render(React.createElement(Space, props)));
  const select = document.querySelector('select[aria-label="Forma de los planetas"]');
  assert.equal(select.options.length, 10);
  await React.act(async () => { select.value = 'saturno'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(selected, 'saturno');
  assert.equal(document.querySelectorAll('.space-planet').length, 3);
  await React.act(async () => document.querySelector('[aria-label="Abrir Inglés, inglés, 2020"]').click());
  assert.equal(opened, books[0]);
  assert.match(document.body.textContent, /Sin año de finalización/);
  assert.match(document.body.textContent, /Otros idiomas/);
  await React.act(async () => root.render(React.createElement(Space, { ...props, planetStyle: 'neon' })));
  assert.equal(document.querySelectorAll('.space-planet--neon').length, 3);
});
