import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

test('dos clientes aplican cambios automáticos y reintentan un guardado fallido', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="a"></div><div id="b"></div></body></html>', { url: 'http://bilibook.test/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.localStorage = dom.window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const react = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = react;
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { useServerSettings } = await vite.ssrLoadModule('/src/hooks.ts');
  let serverSettings = { goal: 24, dark: false, theme: 'bosque', customPalettes: [], customPaletteId: null, settingsVersion: 4, settingsSyncProtocol: 2, libraryView: 'wood', chartPreferences: {} };
  localStorage.setItem('bilibook-custom-palettes', JSON.stringify([{ id: 'antigua', name: 'Antigua', baseTheme: 'calido' }]));
  let failures = 0;
  const sources = new Set();
  class FakeEventSource {
    listeners = {};
    constructor() { sources.add(this); }
    addEventListener(type, cb) { this.listeners[type] = cb; }
    close() { sources.delete(this); }
    emit() { this.listeners.settings?.({ data: JSON.stringify(serverSettings) }); }
  }
  globalThis.EventSource = FakeEventSource;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).includes('/custom-palettes/')) return new Response('{"error":"migración temporalmente no disponible"}', { status: 503 });
    if (opts.method === 'PUT') {
      if (failures++ === 0) return new Response(JSON.stringify({ error: 'fallo temporal' }), { status: 503 });
      const patch = JSON.parse(opts.body);
      serverSettings = { ...serverSettings, ...patch, settingsVersion: serverSettings.settingsVersion + 1 };
      for (const source of sources) source.emit();
    }
    return new Response(JSON.stringify(serverSettings), { status: 200 });
  };
  const clients = {};
  function Client({ id }) { clients[id] = useServerSettings(); return null; }
  const roots = [createRoot(document.getElementById('a')), createRoot(document.getElementById('b'))];
  t.after(async () => {
    await act(async () => roots.forEach((root) => root.unmount()));
    await vite.close(); dom.window.close(); globalThis.fetch = originalFetch;
    delete globalThis.window; delete globalThis.document; delete globalThis.navigator;
    delete globalThis.localStorage; delete globalThis.EventSource; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });
  await act(async () => {
    roots[0].render(react.createElement(Client, { id: 'phone' }));
    roots[1].render(react.createElement(Client, { id: 'pc' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  // Un fallo al migrar una paleta local no impide aplicar los datos válidos
  // del servidor ni hace que la versión se quede en cero.
  assert.equal(clients.phone.theme, 'bosque');
  assert.equal(clients.phone.settingsVersion, 4);
  await act(async () => { clients.phone.setDark(true); await new Promise((r) => setTimeout(r, 100)); });
  assert.equal(clients.phone.settingsSyncStatus, 'retrying');
  await act(async () => { await new Promise((r) => setTimeout(r, 1250)); });
  assert.equal(serverSettings.dark, true);
  assert.equal(clients.pc.dark, true);
  assert.equal(clients.phone.settingsSyncStatus, 'synced');
  assert.equal(clients.phone.settingsVersion, 5);
  assert.equal(clients.pc.settingsVersion, 5);
  await act(async () => { clients.pc.setTheme('oceano'); await new Promise((r) => setTimeout(r, 100)); });
  assert.equal(clients.phone.theme, 'oceano');
  assert.equal(clients.phone.settingsVersion, 6);
});
