import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupIsbn, normalizeIsbn } from '../server/isbn.js';

const example = '9788410399068';
const empty = { google: {}, books: {}, search: { docs: [] }, shop: { resources: { results: { products: [] } } } };
const shopExample = { resources: { results: { products: [{ title: 'Kiss me once', vendor: 'Tack, Stella', tags: [example, 'Inlov'], image: 'https://cdn.shopify.com/cover.jpg', body: 'Ivy Redmond, joven heredera de una empresa multimillonaria.' }] } } };
function mockProviders(data, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const key = url.includes('googleapis.com') ? 'google' : url.includes('/api/books') ? 'books' : url.includes('openlibrary.org') ? 'search' : 'shop';
    const value = data[key];
    if (value instanceof Error) throw value;
    if (typeof value === 'number') return new Response('', { status: value });
    return Response.json(value);
  };
}

test('ISBN-10 e ISBN-13 admiten guiones y verifican el dígito de control', () => {
  assert.equal(normalizeIsbn('978-84-10399-06-8'), example);
  assert.equal(normalizeIsbn('0-306-40615-2'), '0306406152');
  assert.equal(normalizeIsbn('0-8044-2957-x'), '080442957X');
  assert.equal(normalizeIsbn('9788410399069'), null);
  assert.equal(normalizeIsbn('9788410399068/../../'), null);
});

test('el ISBN facilitado se recupera de La Inevitable cuando Google falla y Open Library no lo tiene', async () => {
  const calls = [];
  const result = await lookupIsbn('978-84-10399-06-8', mockProviders({ ...empty, google: 429, shop: shopExample }, calls));
  assert.equal(result.status, 'found');
  assert.equal(result.result.title, 'Kiss me once');
  assert.equal(result.result.author, 'Stella Tack');
  assert.equal(result.result.isbn, example);
  assert.equal(result.result.coverUrl, 'https://cdn.shopify.com/cover.jpg');
  assert.equal(result.result.pages, 0);
  assert.equal(result.result.language, '');
  assert.equal(calls.length, 4);
  assert.ok(calls.every(({ options }) => options.redirect === 'error' && options.signal));
});

test('rechaza coincidencias aproximadas del comercio y no confunde fallos con ausencia', async () => {
  const shop = { resources: { results: { products: [{ title: 'Edición distinta', vendor: 'Otro', tags: ['9780140449136'] }] } } };
  assert.equal((await lookupIsbn(example, mockProviders({ ...empty, shop }))).status, 'not_found');
  assert.equal((await lookupIsbn(example, mockProviders({ ...empty, google: 429, shop }))).status, 'unavailable');
  assert.equal((await lookupIsbn(example, mockProviders({ ...empty, shop: new Error('network down') }))).status, 'unavailable');
  assert.equal((await lookupIsbn('123', mockProviders(empty))).status, 'invalid');
});

test('otra edición real obtiene metadatos exactos de Google y datos que faltan de Open Library', async () => {
  const isbn = '9780140449136';
  const google = { items: [{ volumeInfo: { title: 'The Odyssey', authors: ['Homer'], industryIdentifiers: [{ identifier: isbn }], language: 'en', pageCount: 541 } }] };
  const books = { [`ISBN:${isbn}`]: { title: 'The Odyssey', cover: { large: 'http://covers.openlibrary.org/b/id/42-L.jpg' }, number_of_pages: 541 } };
  const result = await lookupIsbn(isbn, mockProviders({ ...empty, google, books }));
  assert.equal(result.status, 'found');
  assert.equal(result.result.title, 'The Odyssey');
  assert.equal(result.result.pages, 541);
  assert.equal(result.result.coverUrl, 'https://covers.openlibrary.org/b/id/42-L.jpg');
  assert.equal(result.result.language, 'en');
});

test('no toma páginas o fecha de otra edición agregada en la búsqueda de Open Library', async () => {
  const search = { docs: [{ title: 'The Odyssey', isbn: ['9780140449136'], first_publish_year: -700, number_of_pages_median: 99, language: ['eng'], cover_i: 123 }] };
  const result = await lookupIsbn('9780140449136', mockProviders({ ...empty, search }));
  assert.equal(result.result.pages, 0);
  assert.equal(result.result.publishDate, '');
  assert.equal(result.result.coverUrl, '');
});

test('el servidor y la imagen Docker incluyen el servicio, y CSV tolera fallos de portada', async () => {
  const [server, docker, lib, form] = await Promise.all(['server/index.js', 'Dockerfile', 'src/lib.ts', 'src/components/BookForm.tsx'].map((path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  assert.match(server, /app\.get\('\/api\/isbn\/:isbn'/);
  assert.match(docker, /COPY server\/index\.js server\/isbn\.js/);
  assert.match(lib, /fetchByIsbn\(book\.isbn\)\.catch\(\(\) => null\)/);
  assert.match(form, /finally\s*\{\s*setLoading\(false\)/);
});

test('una consulta que no responde se cancela sin bloquear la búsqueda', async () => {
  let aborted = false;
  const quick = mockProviders(empty);
  const result = await lookupIsbn(example, (url, options) => {
    if (!url.includes('googleapis.com')) return quick(url, options);
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      aborted = true;
      reject(new Error('aborted'));
    }, { once: true }));
  });
  assert.equal(aborted, true);
  assert.equal(result.status, 'unavailable');
});
