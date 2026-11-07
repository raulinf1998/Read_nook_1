import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupIsbn, normalizeIsbn } from '../server/isbn.js';

const example = '9788410399068';
const empty = { google: {}, books: {}, search: { docs: [] }, shop: { resources: { results: { products: [] } } }, estanteria: { resources: { results: { products: [] } } }, paquebote: '' };
const shopExample = { resources: { results: { products: [{ title: 'Kiss me once', vendor: 'Tack, Stella', tags: [example, 'Inlov'], image: 'https://cdn.shopify.com/cover.jpg', body: 'Ivy Redmond, joven heredera de una empresa multimillonaria.' }] } } };
function mockProviders(data, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const key = url.includes('paquebote.com') ? 'paquebote' : url.includes('googleapis.com') ? 'google' : url.includes('/api/books') ? 'books' : url.includes('openlibrary.org') ? 'search' : url.includes('laestanterialibros.com') ? 'estanteria' : 'shop';
    const value = data[key];
    if (value instanceof Error) throw value;
    if (typeof value === 'number') return new Response('', { status: value });
    return key === 'paquebote' ? new Response(value, { headers: { 'Content-Type': 'text/html' } }) : Response.json(value);
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
  assert.equal(calls.length, 6);
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
  const google = { items: [{ volumeInfo: { title: 'Crime and punishment', authors: ['Fyodor Dostoyevsky'], industryIdentifiers: [{ identifier: isbn }], language: 'en', pageCount: 671 } }] };
  const books = { [`ISBN:${isbn}`]: { title: 'Crime and punishment', cover: { large: 'http://covers.openlibrary.org/b/id/42-L.jpg' }, number_of_pages: 671 } };
  const result = await lookupIsbn(isbn, mockProviders({ ...empty, google, books }));
  assert.equal(result.status, 'found');
  assert.equal(result.result.title, 'Crime and punishment');
  assert.equal(result.result.pages, 671);
  assert.equal(result.result.coverUrl, 'https://covers.openlibrary.org/b/id/42-L.jpg');
  assert.equal(result.result.language, 'en');
});

test('no toma páginas o fecha de otra edición agregada en la búsqueda de Open Library', async () => {
  const search = { docs: [{ title: 'Crime and punishment', isbn: ['9780140449136'], first_publish_year: -700, number_of_pages_median: 99, language: ['eng'], cover_i: 123 }] };
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

test('La Estantería aporta páginas y fecha del ISBN exacto, no resultados aproximados', async () => {
  // Datos de la respuesta pública de search/suggest para 9788410399068.
  const estanteria = { resources: { results: { products: [{ title: 'Kiss me once - Stella Tack', body: '<p>Sinopsis.</p><p>Ficha técnica.</p><p>Publicación: Feb 11, 2026</p><p>Presentación: Rústica</p><p>Páginas: 448</p><p>ISBN: 9788410399068</p>', image: 'https://cdn.shopify.com/cover.jpg' }] } } };
  const result = await lookupIsbn(example, mockProviders({ ...empty, google: 429, shop: shopExample, estanteria }));
  assert.equal(result.result.title, 'Kiss me once');
  assert.equal(result.result.author, 'Stella Tack');
  assert.equal(result.result.pages, 448);
  assert.equal(result.result.format, 'Rústica');
  assert.equal(result.result.publishDate, '2026-02-11');
  const wrong = structuredClone(estanteria);
  wrong.resources.results.products[0].body = '<p>ISBN: 9780140449136</p><p>Páginas: 900</p>';
  assert.equal((await lookupIsbn(example, mockProviders({ ...empty, estanteria: wrong }))).status, 'not_found');
});

test('Paquebote encuentra Fuego por ISBN y completa los datos disponibles de la edición', async () => {
  // El contenido representa los datos verificados en la ficha pública de la librería.
  const paquebote = `<!doctype html><html><body><a href="/portadaslibros/9788408310303.jpg"><img src="/portadaslibros/9788408310303.jpg"></a>
    <div>ISBN: <strong>9788408310303</strong></div><h1>Fuego «El romance de bomberos que arde en TikTok. Edición con cantos tintados»</h1>
    <h3><a href="/buscar.php?autor=Sloane+St+James&amp;e=1">Sloane St James</a></h3>
    <div>Editorial: <b>Crossbooks</b></div><div>Año: <strong>2025</strong></div><div>Páginas: <strong>416</strong></div></body></html>`;
  const calls = [];
  const found = await lookupIsbn('9788408310303', mockProviders({ ...empty, google: 429, paquebote }, calls));
  assert.equal(found.status, 'found');
  assert.match(found.result.title, /^Fuego/);
  assert.equal(found.result.author, 'Sloane St James');
  assert.equal(found.result.pages, 416);
  assert.equal(found.result.publishDate, '2025');
  assert.equal(found.result.coverUrl, 'https://www.paquebote.com/portadaslibros/9788408310303.jpg');
  assert.ok(calls.some(({ url }) => url === 'https://www.paquebote.com/9788408310303'));
  const other = paquebote.replaceAll('9788408310303', '9780140449136');
  assert.equal((await lookupIsbn('9788408310303', mockProviders({ ...empty, paquebote: other }))).status, 'not_found');
  const invalid = '<html><body><h1>Página no encontrada</h1></body></html>';
  assert.equal((await lookupIsbn('9788408310303', mockProviders({ ...empty, paquebote: invalid }))).status, 'not_found');
});

test('Paquebote identifica una fecha completa y el ISBN-10 equivalente sin confiar en imágenes de otros hosts', async () => {
  const paquebote = `<html><body><div>ISBN: <b>978-84-10399-06-8</b></div><h1>KISS ME ONCE</h1><h3><a href="/buscar.php?autor=TACK">TACK, STELLA</a></h3><div>Fecha de publicación: <b>11/02/2026</b></div><img src="https://malicious.example/portadaslibros/9788410399068.jpg"></body></html>`;
  const found = await lookupIsbn('8410399067', mockProviders({ ...empty, paquebote }));
  assert.equal(found.status, 'found'); assert.equal(found.result.isbn, '8410399067');
  assert.equal(found.result.author, 'STELLA TACK'); assert.equal(found.result.publishDate, '2026-02-11');
  assert.equal(found.result.coverUrl, '');
});
