import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findSeriesGroup,
  groupBooksBySeries,
  missingSeriesPositions,
  nextSeriesBook,
  normalizeSeriesKey,
  seriesBookProgress,
  sortSeriesBooks,
} from '../src/series.ts';
import {
  bookSpineCandidateUrls,
  normalizeIsbn13,
  openCoverSpineUrl,
  spineWidthPx,
} from '../src/bookSpine.ts';

let sequence = 0;
function book(overrides = {}) {
  sequence += 1;
  return {
    id: `book-${sequence}`,
    title: `Libro ${sequence}`,
    author: 'Autora',
    pages: 320,
    currentPage: 0,
    status: 'pending',
    rating: 0,
    tags: [],
    createdAt: sequence,
    startedAt: null,
    finishedAt: null,
    format: 'paperback',
    language: 'Español',
    publishDate: '',
    isbn: '',
    coverUrl: '',
    description: '',
    notes: '',
    journal: [],
    quotes: [],
    storyGraphId: '',
    ...overrides,
  };
}

test('las sagas se agrupan sin distinguir acentos, mayúsculas ni espacios', () => {
  const books = [
    book({ title: 'Ciudad de Jade', series: 'La saga de los Huesos Verdes', seriesPosition: '1' }),
    book({ title: 'Guerra de Jade', series: 'La Saga de Los Huesos Verdes', seriesPosition: '2' }),
    book({ title: 'Legado de Jade', series: 'la saga de los huesos verdes', seriesPosition: '3' }),
  ];

  assert.equal(normalizeSeriesKey('  Hüesos   Verdes '), 'huesos verdes');
  const groups = groupBooksBySeries(books);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'La saga de los Huesos Verdes');
  assert.equal(findSeriesGroup(books, 'LA SAGA DE LOS HUESOS VERDES')?.books.length, 3);
});

test('los volúmenes se ordenan por posición, incluidas precuelas decimales', () => {
  const sorted = sortSeriesBooks([
    book({ title: 'Segundo', seriesPosition: '#2' }),
    book({ title: 'Precuela', seriesPosition: '0.5' }),
    book({ title: 'Primero', seriesPosition: '1' }),
    book({ title: 'Sin número antiguo', seriesPosition: '', publishDate: '1999' }),
    book({ title: 'Sin número moderno', seriesPosition: '', publishDate: '2024' }),
  ]);

  assert.deepEqual(sorted.map(({ title }) => title), [
    'Precuela',
    'Primero',
    'Segundo',
    'Sin número antiguo',
    'Sin número moderno',
  ]);
});

test('se detectan huecos enteros y los ómnibus cubren su rango', () => {
  const books = [
    book({ seriesPosition: '1' }),
    book({ seriesPosition: '3' }),
    book({ seriesPosition: '5-6' }),
    book({ seriesPosition: '0.5' }),
  ];

  assert.deepEqual(missingSeriesPositions(books), [2, 4]);
  assert.deepEqual(missingSeriesPositions([book({ seriesPosition: '' })]), []);
});

test('la siguiente lectura prioriza el libro en curso y después el primer pendiente', () => {
  const pending = book({ title: 'Pendiente', seriesPosition: '1', status: 'pending' });
  const reading = book({ title: 'En curso', seriesPosition: '3', status: 'reading', currentPage: 80 });
  const read = book({ title: 'Leído', seriesPosition: '2', status: 'read', currentPage: 320 });

  assert.equal(nextSeriesBook([pending, read, reading])?.title, 'En curso');
  assert.equal(nextSeriesBook([pending, read])?.title, 'Pendiente');
  assert.equal(seriesBookProgress(reading), 25);
  assert.equal(seriesBookProgress(book({ status: 'reading', pages: 100, currentPage: 140 })), 100);
});

test('el ISBN se normaliza y genera el candidato de lomo correcto', () => {
  assert.equal(normalizeIsbn13('978-84-01-35283-6'), '9788401352836');
  assert.equal(normalizeIsbn13('84-01-35283-5'), '9788401352836');
  assert.equal(normalizeIsbn13('ISBN: 978-84-01-35283-6'), '9788401352836');
  assert.equal(normalizeIsbn13('9788401352837'), null); // dígito de control inválido
  assert.equal(normalizeIsbn13('no-es-un-isbn'), null);
  assert.equal(
    openCoverSpineUrl('9788401352836'),
    'https://image.opencover.jp/v1/cover/spine/9788401352836.webp',
  );
  assert.deepEqual(
    bookSpineCandidateUrls({ isbn: '9788401352836', spineUrl: ' https://example.com/lomo.webp ' }),
    [
      'https://example.com/lomo.webp',
      'https://image.opencover.jp/v1/cover/spine/9788401352836.webp',
    ],
  );
});

test('el grosor del lomo crece con las páginas y respeta límites visuales', () => {
  const thin = spineWidthPx(book({ pages: 120, format: 'paperback' }));
  const thick = spineWidthPx(book({ pages: 1200, format: 'hardcover' }));
  const compact = spineWidthPx(book({ pages: 2000, format: 'hardcover' }), true);

  assert.ok(thick > thin);
  assert.ok(thick <= 68);
  assert.ok(compact <= 48);
});
