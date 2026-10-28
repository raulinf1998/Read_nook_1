import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const PNG_1X1_V2 = Buffer.concat([PNG_1X1, Buffer.from([0])]);

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/books`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error('El servidor no arrancó a tiempo.');
}

const expressInstalled = existsSync(new URL('../server/node_modules/express/package.json', import.meta.url));

test('guarda una portada subida en el servidor, la sirve y rechaza URLs locales', {
  skip: expressInstalled ? false : 'Instala antes las dependencias del servidor: npm --prefix server install',
}, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'bilibook-cover-test-'));
  const port = 33123;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Libro antiguo con la portada todavía incrustada y un archivo gestionado
  // que ya no usa nadie: el arranque debe localizar la primera y retirar el segundo.
  await mkdir(join(dataDir, 'covers'), { recursive: true });
  await writeFile(join(dataDir, 'covers', `${'0'.repeat(64)}.png`), PNG_1X1_V2);
  await writeFile(join(dataDir, 'db.json'), JSON.stringify({
    books: [{
      id: 'legacy-book',
      title: 'Libro antiguo',
      author: 'Autora de prueba',
      coverUrl: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
      coverSourceUrl: '',
      status: 'pending',
      rating: 0,
      notes: '',
      pages: 100,
      currentPage: 0,
      format: 'paperback',
      language: 'es',
      publishDate: '2020',
      description: '',
      tags: [],
      isbn: '',
      series: '',
      seriesPosition: '',
      startedAt: null,
      finishedAt: null,
      journal: [],
      createdAt: 1,
    }],
    tags: [],
    goal: 24,
    dark: false,
    theme: 'calido',
    customPalettes: [],
    customPaletteId: null,
  }));

  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => { serverLog += chunk; });
  child.stderr.on('data', (chunk) => { serverLog += chunk; });

  t.after(async () => {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(dataDir, { recursive: true, force: true });
  });

  try {
    await waitForServer(baseUrl);
  } catch (error) {
    throw new Error(`${error.message}\n${serverLog}`);
  }

  const coverFiles = async () => (await readdir(join(dataDir, 'covers'))).sort();
  let migratedBook;
  const migrationDeadline = Date.now() + 5_000;
  while (Date.now() < migrationDeadline) {
    const booksResponse = await fetch(`${baseUrl}/api/books`);
    const books = await booksResponse.json();
    migratedBook = books.find((book) => book.id === 'legacy-book');
    if (migratedBook?.coverUrl?.startsWith('/covers/') && (await coverFiles()).length === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.match(migratedBook.coverUrl, /^\/covers\/[0-9a-f]{64}\.png$/);
  assert.deepEqual(await coverFiles(), [migratedBook.coverUrl.split('/').pop()]);
  const deleteLegacy = await fetch(`${baseUrl}/api/books/legacy-book`, { method: 'DELETE' });
  assert.equal(deleteLegacy.status, 200);
  assert.deepEqual(await coverFiles(), []);

  const upload = await fetch(`${baseUrl}/api/covers/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: PNG_1X1,
  });
  assert.equal(upload.status, 200);
  const stored = await upload.json();
  assert.match(stored.coverUrl, /^\/covers\/[0-9a-f]{64}\.png$/);
  assert.equal(stored.contentType, 'image/png');
  assert.equal(stored.size, PNG_1X1.length);

  const duplicate = await fetch(`${baseUrl}/api/covers/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: PNG_1X1,
  });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), stored);

  const served = await fetch(`${baseUrl}${stored.coverUrl}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), PNG_1X1);

  const invalid = await fetch(`${baseUrl}/api/covers/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.from('esto no es una imagen'),
  });
  assert.equal(invalid.status, 400);

  const localUrl = await fetch(`${baseUrl}/api/covers/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'http://127.0.0.1:3001/secret.png' }),
  });
  assert.equal(localUrl.status, 400);
  assert.match((await localUrl.json()).error, /privadas|locales/i);

  const filenameOf = (coverUrl) => coverUrl.split('/').pop();
  const jsonRequest = async (path, method, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  const replacementUpload = await fetch(`${baseUrl}/api/covers/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: PNG_1X1_V2,
  });
  assert.equal(replacementUpload.status, 200);
  const replacement = await replacementUpload.json();
  assert.notEqual(replacement.coverUrl, stored.coverUrl);

  const baseBook = {
    author: 'Autora de prueba',
    status: 'pending',
    rating: 0,
    notes: '',
    pages: 100,
    currentPage: 0,
    format: 'paperback',
    language: 'es',
    publishDate: '2024',
    description: '',
    tags: [],
    isbn: '',
    series: '',
    seriesPosition: '',
    startedAt: null,
    finishedAt: null,
    journal: [],
  };

  const firstBook = await jsonRequest('/api/books', 'POST', {
    ...baseBook,
    title: 'Primer libro',
    coverUrl: stored.coverUrl,
    coverSourceUrl: '',
  });
  const secondBook = await jsonRequest('/api/books', 'POST', {
    ...baseBook,
    title: 'Segundo libro',
    coverUrl: stored.coverUrl,
    coverSourceUrl: '',
  });
  assert.equal(firstBook.coverUrl, stored.coverUrl);
  assert.equal(secondBook.coverUrl, stored.coverUrl);
  assert.deepEqual(await coverFiles(), [filenameOf(replacement.coverUrl), filenameOf(stored.coverUrl)].sort());

  const firstUpdated = await jsonRequest(`/api/books/${firstBook.id}`, 'PUT', {
    coverUrl: replacement.coverUrl,
    coverSourceUrl: '',
  });
  assert.equal(firstUpdated.coverUrl, replacement.coverUrl);
  // La imagen anterior se conserva mientras el segundo libro la comparte.
  assert.deepEqual(await coverFiles(), [filenameOf(replacement.coverUrl), filenameOf(stored.coverUrl)].sort());

  const secondUpdated = await jsonRequest(`/api/books/${secondBook.id}`, 'PUT', {
    coverUrl: replacement.coverUrl,
    coverSourceUrl: '',
  });
  assert.equal(secondUpdated.coverUrl, replacement.coverUrl);
  // Al dejar de usarla el último libro, la portada sustituida desaparece.
  assert.deepEqual(await coverFiles(), [filenameOf(replacement.coverUrl)]);

  const dataUrlUpdated = await jsonRequest(`/api/books/${firstBook.id}`, 'PUT', {
    coverUrl: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
    coverSourceUrl: '',
  });
  assert.equal(dataUrlUpdated.coverUrl, stored.coverUrl);
  assert.equal(dataUrlUpdated.coverSourceUrl, '');
  assert.deepEqual(await coverFiles(), [filenameOf(replacement.coverUrl), filenameOf(stored.coverUrl)].sort());

  await jsonRequest(`/api/books/${firstBook.id}`, 'DELETE');
  assert.deepEqual(await coverFiles(), [filenameOf(replacement.coverUrl)]);

  const cleared = await jsonRequest(`/api/books/${secondBook.id}`, 'PUT', {
    coverUrl: '',
    coverSourceUrl: '',
  });
  assert.equal(cleared.coverUrl, '');
  assert.deepEqual(await coverFiles(), []);
});
