import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editJournalEntry } from '../src/journalEdit.ts';
import { buildJournalProgressTimeline, mergeStoryGraphJournal } from '../src/storyGraphJournal.ts';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
const at = (day) => new Date(2024, 0, day, 12).getTime();
const entry = (id, day, pages, cumulativePages, extra = {}) => ({ id, date: at(day), pages, note: '', kind: 'progress', cumulativePages, percent: cumulativePages / 2, ...extra });
const book = (journal, extra = {}) => ({ id: 'b', title: 'Libro', author: 'Autora', isbn: '9780306406157', coverUrl: '', pages: 200, currentPage: 100, status: 'reading', startedAt: null, finishedAt: null, journal, ...extra });
const vals = (item, extra = {}) => ({ date: item.date, dateChanged: false, pages: item.pages, minutes: item.minutes || 0, note: item.note, reachedPage: item.cumulativePages, ...extra });

test('editar páginas de sesión y nota conserva posición, identidad y los demás registros', () => {
  const a = entry('a', 1, 50, 50); const b = entry('b', 3, 50, 100);
  const result = editJournalEntry(book([b, a]), [b, a], 'a', vals(a, { pages: 35, minutes: 20, note: 'Corregido' }));
  assert.ok(result.patch); assert.equal(result.patch.currentPage, undefined);
  assert.deepEqual(result.patch.journal.find((e) => e.id === 'b'), b);
  const edited = result.patch.journal.find((e) => e.id === 'a');
  assert.equal(edited.pages, 35); assert.equal(edited.cumulativePages, 50); assert.equal(edited.minutes, 20); assert.equal(edited.note, 'Corregido');
  assert.equal(buildJournalProgressTimeline(result.patch.journal, 200).currentPage, 100);
});

test('editar posición actual la actualiza; una posición incompatible no cambia el historial', () => {
  const a = entry('a', 1, 50, 50); const b = entry('b', 3, 50, 100); const input = book([b, a]);
  const result = editJournalEntry(input, input.journal, 'b', vals(b, { reachedPage: 120 }));
  assert.equal(result.patch.currentPage, 120); assert.equal(result.patch.journal[0].percent, 60);
  assert.ok(editJournalEntry(input, input.journal, 'a', vals(a, { reachedPage: 150 })).error);
  assert.ok(editJournalEntry(input, input.journal, 'a', vals(a, { pages: -1 })).error);
  const finished = editJournalEntry(input, input.journal, 'b', vals(b, { reachedPage: 200 }));
  assert.equal(finished.patch.status, 'read'); assert.equal(finished.patch.finishedAt, b.date); assert.equal(finished.patch.journal[0].kind, 'finished');
});

test('protege fronteras, fechas parciales y sincroniza finales vinculados', () => {
  const boundary = entry('end', 2, 0, 200, { kind: 'finished', rereadBoundary: true, datePrecision: 'year' });
  const current = entry('current', 4, 25, 25, { kind: 'progress' }); const input = book([current, boundary], { currentPage: 25, previousReadings: [{ finishedAt: boundary.date, pages: 200 }] });
  assert.ok(editJournalEntry(input, input.journal, 'end', vals(boundary, { reachedPage: 200, dateChanged: true, date: at(1) })).error);
  const safe = editJournalEntry(input, input.journal, 'end', vals(boundary, { reachedPage: 200, note: 'Nota' }));
  assert.equal(safe.patch.journal.find((e) => e.id === 'end').datePrecision, 'year');
  assert.ok(editJournalEntry(input, input.journal, 'current', vals(current, { dateChanged: true, date: at(1) })).error);
  const end = entry('finish', 3, 100, 200, { kind: 'finished' }); const done = book([end], { status: 'read', currentPage: 200, finishedAt: end.date });
  const moved = editJournalEntry(done, done.journal, 'finish', vals(end, { dateChanged: true, date: at(4) }));
  assert.equal(moved.patch.finishedAt, at(4)); assert.equal(moved.patch.finishedAtPrecision, 'day');
  assert.ok(editJournalEntry({ ...done, finishedAt: at(2) }, done.journal, 'finish', vals(end, { dateChanged: true, date: at(4) })).error);
});

test('las correcciones manuales de StoryGraph sobreviven a una nueva importación', () => {
  const raw = { sourceEntryId: '101', storyGraphBookId: '', isbn: '9780306406157', title: 'Libro', author: 'Autora', coverUrl: '', date: '2024-01-01', pagesRead: 50, pagesTotal: 50, bookPages: 200, percent: 25, minutesListened: null, minutesTotal: null, kind: 'progress', note: 'Original' };
  const initial = mergeStoryGraphJournal([book([], { currentPage: 0 })], [raw]).books[0];
  const sg = initial.journal[0];
  const correction = editJournalEntry(initial, initial.journal, sg.id, vals(sg, { pages: 30, minutes: 10, note: 'Corregido', dateChanged: true, date: at(2) }));
  const editedBook = { ...initial, ...correction.patch };
  const again = mergeStoryGraphJournal([editedBook], [{ ...raw, note: 'Cambió fuera' }]).books[0].journal[0];
  assert.equal(again.id, sg.id); assert.equal(again.sourceEntryId, '101'); assert.equal(again.pages, 30); assert.equal(again.note, 'Corregido'); assert.equal(again.minutes, 10); assert.equal(again.date, at(2)); assert.equal(again.cumulativePages, 50);
});

test('el diario permite cancelar y guardar una edición desde la ficha', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { JournalPanel } = await vite.ssrLoadModule('/src/components/JournalModal.tsx'); const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const a = entry('a', 1, 50, 50); let patches = [];
  await React.act(async () => root.render(React.createElement(JournalPanel, { book: book([a], { currentPage: 50 }), embedded: true, onUpdate: (id, patch) => patches.push({ id, patch }) })));
  const open = async () => React.act(async () => document.querySelector('[aria-label^="Editar registro del"]').click());
  await open(); assert.ok(document.querySelector('form[aria-label="Editar registro del diario"]'));
  await React.act(async () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Cancelar').click()); assert.equal(patches.length, 0);
  await open();
  const input = document.querySelector('form[aria-label="Editar registro del diario"] textarea');
  await React.act(async () => { const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set; setter.call(input, 'Muy entretenido'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await React.act(async () => document.querySelector('form[aria-label="Editar registro del diario"]').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(patches.length, 1); assert.equal(patches[0].patch.journal[0].note, 'Muy entretenido'); assert.equal(document.querySelector('form[aria-label="Editar registro del diario"]'), null);
});
