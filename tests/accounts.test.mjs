import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function wait(base) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/api/settings`)).ok) return; } catch { /* arranque */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('No arrancó el servidor');
}

test('migra a Raúl, aísla cuentas, conserva portadas compartidas y persiste al reiniciar', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'bilibook-accounts-'));
  const base = 'http://127.0.0.1:33126';
  const old = { books: [{ id: 'original', title: 'Original', author: 'Autor', coverUrl: '', tags: [] }], tags: ['mío'], goal: 20, theme: 'bosque', dark: false, customPalettes: [], customPaletteId: null, settingsVersion: 4 };
  await writeFile(join(dir, 'db.json'), JSON.stringify(old));
  let child;
  const start = async () => { child = spawn(process.execPath, ['server/index.js'], { cwd: new URL('../', import.meta.url), env: { ...process.env, DATA_DIR: dir, PORT: '33126' }, stdio: 'ignore' }); await wait(base); };
  const stop = async () => { if (child?.exitCode === null) { const done = new Promise((r) => child.once('exit', r)); child.kill(); await done; } };
  t.after(async () => { await stop(); await rm(dir, { recursive: true, force: true }); });
  await start();
  const request = async (account, path, options = {}) => {
    const res = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', Cookie: `bilibook-account=${account}`, ...options.headers } });
    return { res, data: await res.json() };
  };
  assert.equal((await request('raul', '/api/books')).data[0].id, 'original');
  assert.deepEqual((await request('pequenaja', '/api/books')).data, []);
  assert.equal((await request('raul', '/api/settings')).data.theme, 'bosque');
  assert.equal((await request('pequenaja', '/api/settings')).data.theme, 'calido');
  const html = await fetch(`${base}/`, { headers: { Cookie: 'bilibook-account=pequenaja' } });
  if (html.ok) {
    const text = await html.text();
    assert.match(text, /"theme":"calido"/);
  }
  const controller = new AbortController();
  const events = await fetch(`${base}/api/settings/events`, { headers: { Cookie: 'bilibook-account=pequenaja' }, signal: controller.signal });
  const reader = events.body.getReader();
  await reader.read(); // primer estado de Pequeñaja
  const nextEvent = reader.read();
  const update = (account, body) => request(account, '/api/settings', { method: 'PUT', body: JSON.stringify(body) });
  await update('raul', { theme: 'oceano', shelfColors: { frame: '#123456', wood: '#654321' } });
  assert.equal(await Promise.race([nextEvent.then(() => 'mensaje'), new Promise((r) => setTimeout(() => r('sin mensaje'), 100))]), 'sin mensaje');
  await update('pequenaja', { theme: 'lavanda', goal: 12, shelfColors: { background: '#abcdef' } });
  assert.match(new TextDecoder().decode((await nextEvent).value), /"theme":"lavanda"/);
  controller.abort();
  assert.equal((await request('raul', '/api/settings')).data.theme, 'oceano');
  assert.equal((await request('pequenaja', '/api/settings')).data.theme, 'lavanda');
  assert.equal((await request('raul', '/api/settings')).data.goal, 20);
  assert.deepEqual((await request('raul', '/api/settings')).data.shelfColors, { frame: '#123456', wood: '#654321', background: '#ded7c9' });
  assert.equal((await request('pequenaja', '/api/settings')).data.shelfColors.background, '#abcdef');
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'db.before-accounts.json'), 'utf8')), old);
  const book = { title: 'Otro', author: 'Otra autora', coverUrl: '', tags: [], journal: [] };
  const created = await request('pequenaja', '/api/books', { method: 'POST', body: JSON.stringify(book) });
  assert.equal(created.res.status, 200);
  assert.equal((await request('raul', '/api/books')).data.length, 1);
  assert.equal((await request('pequenaja', '/api/books')).data.length, 1);
  assert.equal((await request('raul', `/api/books/${created.data.id}`, { method: 'PUT', body: JSON.stringify({ title: 'No' }) })).res.status, 404);
  assert.deepEqual((await request('raul', '/api/books/shared')).data.map((b) => b.owner).sort(), ['pequenaja', 'raul']);
  // El mismo archivo puede ser usado por ambas cuentas; borrar una referencia
  // no debe eliminar la portada de la otra.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=', 'base64');
  const upload = await fetch(`${base}/api/covers/upload`, { method: 'POST', headers: { 'Content-Type': 'image/png', Cookie: 'bilibook-account=raul' }, body: png });
  const cover = await upload.json();
  assert.equal(upload.status, 200);
  await request('raul', '/api/books/original', { method: 'PUT', body: JSON.stringify({ coverUrl: cover.coverUrl }) });
  await request('pequenaja', `/api/books/${created.data.id}`, { method: 'PUT', body: JSON.stringify({ coverUrl: cover.coverUrl }) });
  await request('raul', '/api/books/original', { method: 'PUT', body: JSON.stringify({ coverUrl: '' }) });
  assert.equal((await fetch(base + cover.coverUrl)).status, 200);
  assert.equal((await request('pequenaja', '/api/books')).data[0].coverUrl, cover.coverUrl);
  await stop(); await start();
  assert.equal((await request('raul', '/api/books')).data[0].title, 'Original');
  assert.equal((await request('pequenaja', '/api/books')).data[0].title, 'Otro');
  assert.equal((await request('pequenaja', '/api/settings')).data.theme, 'lavanda');
  assert.equal((await request('raul', '/api/settings')).data.shelfColors.frame, '#123456');
  assert.equal((await request('pequenaja', '/api/settings')).data.shelfColors.background, '#abcdef');
});
