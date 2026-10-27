import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

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
});
