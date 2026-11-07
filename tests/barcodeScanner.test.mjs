import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { isBookBarcode } from '../src/isbnBarcode.ts';

test('solo acepta ISBN-13 de libros con dígito de control correcto', () => {
  assert.equal(isBookBarcode('9788410399068'), true);
  assert.equal(isBookBarcode('9788410399069'), false);
  assert.equal(isBookBarcode('4006381333931'), false);
  assert.equal(isBookBarcode('978-8410399068'), false);
});

test('escáner detecta una vez, libera cámara y respeta cancelación y permisos', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://bilibook.test/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(dom.window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { BarcodeScanner } = await vite.ssrLoadModule('/src/components/BarcodeScanner.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  let stopped = 0, decoderStopped = 0, callback, detected = [], constraints;
  const stream = { getTracks: () => [{ stop: () => { stopped++; } }] };
  const factory = async () => ({ decodeFromStream: async (_stream, _video, cb) => { callback = cb; return { stop: () => { decoderStopped++; } }; } });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async (value) => { constraints = value; return stream; } } });
  const render = () => React.act(async () => root.render(React.createElement(BarcodeScanner, { onDetected: (value) => detected.push(value), onClose: () => {}, readerFactory: factory })));
  await render();
  assert.equal(constraints.audio, false); assert.equal(constraints.video.facingMode.ideal, 'environment');
  assert.ok(document.querySelector('video[playsinline]'));
  await React.act(async () => { callback({ getText: () => '4006381333931' }); callback({ getText: () => '9788410399068' }); callback({ getText: () => '9788410399068' }); });
  assert.deepEqual(detected, ['9788410399068']); assert.ok(stopped > 0); assert.ok(decoderStopped > 0);
  await React.act(async () => root.render(null));
  let release;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise((resolve) => { release = resolve; }) } });
  stopped = 0;
  await render(); assert.ok(release);
  await React.act(async () => root.render(null));
  await React.act(async () => { release(stream); await Promise.resolve(); });
  assert.ok(stopped > 0, 'si el permiso llega tras cerrar, la cámara se libera');
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; } } });
  await render(); assert.match(document.querySelector('[role=alert]').textContent, /permiso/i);
});

test('el decodificador ZXing lee una imagen EAN-13 del ISBN de ejemplo', async () => {
  const { default: z } = await import('@zxing/library');
  const isbn = '9788410399068';
  const left = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const alternate = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const right = left.map((bits) => [...bits].map((bit) => bit === '1' ? '0' : '1').join(''));
  const parity = 'ABBABA'; // primer dígito: 9
  const bits = '0'.repeat(12) + '101' + [...isbn.slice(1, 7)].map((digit, i) => (parity[i] === 'A' ? left : alternate)[Number(digit)]).join('') + '01010' + [...isbn.slice(7)].map((digit) => right[Number(digit)]).join('') + '101' + '0'.repeat(12);
  const width = bits.length * 4, height = 150;
  const pixels = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = bits[Math.floor(x / 4)] === '1' ? 0 : 255;
  const source = new z.RGBLuminanceSource(pixels, width, height);
  const reader = new z.MultiFormatReader();
  reader.setHints(new Map([[z.DecodeHintType.POSSIBLE_FORMATS, [z.BarcodeFormat.EAN_13]]]));
  assert.equal(reader.decode(new z.BinaryBitmap(new z.HybridBinarizer(source))).getText(), isbn);
});

test('por HTTP usa una foto local, busca el ISBN y permite reintentar sin cámara en directo', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://192.168.1.20:3001/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  Object.defineProperty(dom.window, 'isSecureContext', { value: false, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  let created = 0, revoked = 0, calls = 0, detected = [], barcode = '4006381333931', release;
  URL.createObjectURL = () => { created++; return 'blob:local'; };
  URL.revokeObjectURL = (value) => { assert.equal(value, 'blob:local'); revoked++; };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => { calls++; throw new Error('No debe abrir vídeo HTTP'); } } });
  const React = await import('react'); const { createRoot } = await import('react-dom/client');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  const { BarcodeScanner } = await vite.ssrLoadModule('/src/components/BarcodeScanner.tsx');
  const root = createRoot(document.getElementById('root'));
  t.after(async () => { await React.act(async () => root.unmount()); await vite.close(); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; delete globalThis.window; delete globalThis.document; delete globalThis.navigator; delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const factory = async () => ({ decodeFromStream: async () => { throw new Error('No debe abrir vídeo'); }, decodeFromImageUrl: async () => ({ getText: () => barcode }) });
  const render = (readerFactory = factory) => React.act(async () => root.render(React.createElement(BarcodeScanner, { onDetected: (isbn) => detected.push(isbn), onClose: () => {}, readerFactory })));
  const choosePhoto = async () => {
    const input = document.querySelector('input[type=file]');
    assert.equal(input.getAttribute('capture'), 'environment'); assert.equal(input.accept, 'image/*');
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['foto'], 'foto.jpg', { type: 'image/jpeg' })] });
    await React.act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await Promise.resolve(); });
  };
  await render();
  assert.equal(calls, 0); assert.equal(document.querySelector('video'), null);
  assert.match(document.body.textContent, /Hacer foto o elegir imagen/); assert.doesNotMatch(document.body.textContent, /HTTPS/);
  await choosePhoto(); assert.match(document.querySelector('[role=alert]').textContent, /ISBN válido/); assert.deepEqual(detected, []); assert.equal(created, 1); assert.equal(revoked, 1);
  barcode = '9788410399068'; await choosePhoto(); assert.deepEqual(detected, ['9788410399068']); assert.equal(revoked, 2);
  await React.act(async () => root.render(null));
  const slowFactory = async () => ({ decodeFromImageUrl: () => new Promise((resolve) => { release = resolve; }) });
  await render(slowFactory); await choosePhoto(); assert.ok(release);
  await React.act(async () => root.render(null));
  await React.act(async () => { release({ getText: () => '9788410399068' }); await Promise.resolve(); });
  assert.deepEqual(detected, ['9788410399068']); assert.equal(revoked, 3);
});
