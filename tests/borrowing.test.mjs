import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { combinedShelf } from '../src/borrowing.ts';

async function wait(base) {
  for (let n = 0; n < 100; n++) { try { if ((await fetch(base + '/api/settings')).ok) return; } catch {} await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('El servidor no arrancó');
}

test('prestar o vincular preserva historiales, evita duplicados y persiste entre cuentas', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'bilibook-loans-'));
  const base = 'http://127.0.0.1:33130';
  let child;
  const start = async () => { child = spawn(process.execPath, ['server/index.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DATA_DIR: dir, PORT: '33130' }, stdio: 'ignore' }); await wait(base); };
  const stop = async () => { if (child?.exitCode === null) { const done = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await done; } };
  t.after(async () => { await stop(); await rm(dir, { recursive: true, force: true }); });
  const request = async (account, path, method = 'GET', body) => { const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: `bilibook-account=${account}` }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, body: await res.json() }; };
  await start();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=', 'base64');
  const uploaded = await fetch(base + '/api/covers/upload', { method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: 'bilibook-account=raul' }, body: png });
  const cover = (await uploaded.json()).coverUrl;
  const source = (await request('raul', '/api/books', 'POST', { title: 'Libro', author: 'Autora', pages: 100, coverUrl: cover, tags: ['Fantasía'], status: 'read', rating: 5, notes: 'privada', finishedAt: 1, currentPage: 100, journal: [{ id: 'r', date: 1, pages: 100 }] })).body;
  const loan = (await request('pequenaja', '/api/books/borrow', 'POST', { owner: 'raul', bookId: source.id })).body;
  assert.equal(loan.coverUrl, cover);
  assert.equal(loan.status, 'pending'); assert.equal(loan.currentPage, 0); assert.deepEqual(loan.journal, []); assert.equal(loan.rating, 0); assert.equal(loan.notes, '');
  assert.deepEqual(loan.borrowedFrom, { owner: 'raul', bookId: source.id });
  const again = await Promise.all(Array.from({ length: 3 }, () => request('pequenaja', '/api/books/borrow', 'POST', { owner: 'raul', bookId: source.id })));
  assert.ok(again.every((r) => r.body.id === loan.id));
  await request('pequenaja', `/api/books/${loan.id}`, 'PUT', { status: 'read', currentPage: 100, journal: [{ id: 'p', date: 2, pages: 100 }] });
  assert.equal((await request('raul', '/api/books')).body[0].journal[0].id, 'r');
  let shared = (await request('raul', '/api/books/shared')).body;
  assert.equal(combinedShelf(shared, 'raul').length, 1);
  assert.equal(combinedShelf(shared, 'raul')[0].id, source.id);
  assert.equal(combinedShelf(shared, 'pequenaja')[0].id, loan.id);
  const source2 = (await request('raul', '/api/books', 'POST', { title: 'Otro', author: 'Autora', pages: 200, coverUrl: '', tags: [], status: 'read', journal: [] })).body;
  const existing = (await request('pequenaja', '/api/books', 'POST', { title: 'Otro', author: 'Autora', pages: 200, coverUrl: '', tags: [], status: 'read', currentPage: 200, rating: 4, finishedAt: 42, journal: [{ id: 'old', date: 42, pages: 200 }] })).body;
  const linked = await request('pequenaja', '/api/books/borrow', 'POST', { owner: 'raul', bookId: source2.id, existingBookId: existing.id });
  assert.equal(linked.status, 200); assert.equal(linked.body.id, existing.id); assert.equal(linked.body.journal[0].id, 'old'); assert.equal(linked.body.rating, 4);
  assert.equal((await request('pequenaja', '/api/books/borrow', 'POST', { owner: 'raul', bookId: source.id, existingBookId: existing.id })).status, 409);
  assert.equal((await request('raul', '/api/books/borrow', 'POST', { owner: 'raul', bookId: source.id })).status, 400);
  assert.equal((await request('raul', '/api/books/borrow', 'POST', { owner: 'pequenaja', bookId: loan.id })).status, 404);
  await stop(); await start();
  assert.equal((await request('pequenaja', '/api/books')).body.find((b) => b.id === existing.id).journal[0].id, 'old');
  shared = (await request('raul', '/api/books/shared')).body;
  assert.equal(combinedShelf(shared, 'raul').length, 2);
  await request('raul', `/api/books/${source.id}`, 'DELETE');
  shared = (await request('raul', '/api/books/shared')).body;
  assert.ok(combinedShelf(shared, 'raul').some((book) => book.id === loan.id));
  assert.equal((await fetch(base + cover)).status, 200, 'la portada sigue disponible para la ficha prestada');
});

test('el diálogo permite vincular una ficha existente o crear otra explícitamente', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { BorrowDialog } = await vite.ssrLoadModule('/src/components/BorrowDialog.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  let selected;
  const source = { id: 'source', owner: 'raul', title: 'El libro', author: 'Autor', coverUrl: '', isbn: '123' };
  const existing = { id: 'existing', title: 'El libro', author: 'Autor', isbn: '123' };
  await React.act(async () => root.render(React.createElement(BorrowDialog, { source, books: [existing], onClose() {}, onSwitch() {}, onBorrow: async (id) => { selected = id; } })));
  const select = document.querySelector('#borrow-target');
  assert.equal(select.value, '');
  assert.match(document.body.textContent, /ya tienes una ficha/);
  await React.act(async () => { select.value = 'existing'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.match(document.body.textContent, /Se conservarán tu diario/);
  await React.act(async () => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Vincular mi ficha')).click());
  assert.equal(selected, 'existing');
});
