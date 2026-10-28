import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/settings`, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error('El servidor no arrancó a tiempo.');
}

function palette(id, name, primary) {
  return {
    id,
    name,
    baseTheme: 'oceano',
    light: {
      bg: '#eef8ff',
      surface: '#ffffff',
      ink: '#12324a',
      primary,
      accent: '#0f766e',
      accent2: '#f59e0b',
    },
    dark: {
      bg: '#061928',
      surface: '#0b2a42',
      ink: '#e8f6ff',
      primary,
      accent: '#2dd4bf',
      accent2: '#fbbf24',
    },
    createdAt: 123,
  };
}

const expressInstalled = existsSync(new URL('../server/node_modules/express/package.json', import.meta.url));

test('la apariencia se comparte en el servidor y las paletas se guardan sin pisar las del otro dispositivo', {
  skip: expressInstalled ? false : 'Instala antes las dependencias del servidor: npm --prefix server install',
}, async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'bilibook-settings-test-'));
  const port = 33124;
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

  const requestSettings = async (path = '/api/settings', options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return { response, settings: await response.json() };
  };

  const initial = await requestSettings();
  assert.equal(initial.response.status, 200);
  assert.match(initial.response.headers.get('cache-control') || '', /no-store/);
  assert.equal(initial.settings.settingsVersion, 0);
  assert.deepEqual(initial.settings.customPalettes, []);

  const mobilePalette = palette('custom-movil', 'Creada en el móvil', '#0284c7');
  const fromMobile = await requestSettings(`/api/settings/custom-palettes/${mobilePalette.id}`, {
    method: 'PUT',
    body: JSON.stringify({ palette: mobilePalette, activate: true }),
  });
  assert.equal(fromMobile.response.status, 200);
  assert.equal(fromMobile.settings.settingsVersion, 1);
  assert.equal(fromMobile.settings.customPaletteId, mobilePalette.id);
  assert.deepEqual(fromMobile.settings.customPalettes.map(({ id }) => id), [mobilePalette.id]);

  // El PC guarda otra paleta sin conocer todavía la lista del móvil. Al ir
  // por un endpoint individual, el servidor une ambas en lugar de sustituirla.
  const pcPalette = palette('custom-pc', 'Creada en el PC', '#7c3aed');
  const fromPc = await requestSettings(`/api/settings/custom-palettes/${pcPalette.id}`, {
    method: 'PUT',
    body: JSON.stringify({ palette: pcPalette, activate: false }),
  });
  assert.equal(fromPc.response.status, 200);
  assert.equal(fromPc.settings.settingsVersion, 2);
  assert.equal(fromPc.settings.customPaletteId, mobilePalette.id);
  assert.deepEqual(
    fromPc.settings.customPalettes.map(({ id }) => id),
    [mobilePalette.id, pcPalette.id],
  );

  const seenByPc = await requestSettings();
  assert.equal(seenByPc.settings.settingsVersion, 2);
  assert.deepEqual(
    seenByPc.settings.customPalettes.map(({ name }) => name),
    ['Creada en el móvil', 'Creada en el PC'],
  );

  const appearance = await requestSettings('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ theme: 'bosque', dark: true, customPaletteId: pcPalette.id }),
  });
  assert.equal(appearance.settings.settingsVersion, 3);
  assert.equal(appearance.settings.theme, 'bosque');
  assert.equal(appearance.settings.dark, true);
  assert.equal(appearance.settings.customPaletteId, pcPalette.id);
  assert.equal(appearance.settings.customPalettes.length, 2);

  const afterDelete = await requestSettings(`/api/settings/custom-palettes/${mobilePalette.id}`, {
    method: 'DELETE',
  });
  assert.equal(afterDelete.settings.settingsVersion, 4);
  assert.deepEqual(afterDelete.settings.customPalettes.map(({ id }) => id), [pcPalette.id]);
  assert.equal(afterDelete.settings.customPaletteId, pcPalette.id);

  const repeatedDelete = await requestSettings(`/api/settings/custom-palettes/${mobilePalette.id}`, {
    method: 'DELETE',
  });
  assert.equal(repeatedDelete.settings.settingsVersion, 4);

  const invalid = await requestSettings('/api/settings/custom-palettes/otro-id', {
    method: 'PUT',
    body: JSON.stringify({ palette: pcPalette, activate: true }),
  });
  assert.equal(invalid.response.status, 400);
});
