import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const source = readFileSync(
  new URL('../public/tools/storygraph-journal-exporter.user.js', import.meta.url),
  'utf8',
);

function loadEntryIdExtractor() {
  const match = source.match(
    /function extractJournalEntryId\(href\) \{[\s\S]*?\n  \}\n\n  function parseJournalEntry/,
  );
  assert.ok(match, 'No se encontró extractJournalEntryId en el userscript');

  const functionText = match[0].replace(/\n\n  function parseJournalEntry$/, '');
  return new Function(
    'window',
    `${functionText}\nreturn extractJournalEntryId;`,
  )({ location: { origin: 'https://app.thestorygraph.com' } });
}

function loadCoverHelpers() {
  const match = source.match(
    /function bestSrcsetUrl\(srcset\) \{[\s\S]*?\n  function findCoverImage/,
  );
  assert.ok(match, 'No se encontraron las funciones de portada en el userscript');

  const functionText = match[0].replace(/\n  function findCoverImage$/, '');
  return new Function(
    `${functionText}\nreturn { bestSrcsetUrl, imageUrlFromElement };`,
  )();
}

describe('extractor local de StoryGraph', () => {
  test('acepta ID UUID y numéricos en enlaces de edición', () => {
    const extractJournalEntryId = loadEntryIdExtractor();
    const uuid = '5bf25096-ede4-4d44-8098-c78b6e7dd994';

    assert.equal(
      extractJournalEntryId(`/journal_entries/${uuid}/edit?return_to=%2Fjournal`),
      uuid,
    );
    assert.equal(
      extractJournalEntryId(`https://app.thestorygraph.com/journal_entries/${uuid}/edit`),
      uuid,
    );
    assert.equal(extractJournalEntryId('/journal_entries/9001/edit'), '9001');
    assert.equal(extractJournalEntryId('/journal_entries//edit'), '');
    assert.equal(extractJournalEntryId('/books/abc/edit'), '');
  });

  test('publica la versión corregida y no ordena los ID como números', () => {
    assert.match(source, /\/\/ @version\s+1\.0\.2/);
    assert.match(source, /const EXTRACTOR_VERSION = '1\.0\.2'/);
    assert.doesNotMatch(source, /journal_entries\\\/\(\\d\+\)\\\/edit/);
    assert.doesNotMatch(source, /Number\(a\.id\)\s*-\s*Number\(b\.id\)/);
  });

  test('elige la imagen de portada de mayor resolución y resuelve URLs relativas', () => {
    const { bestSrcsetUrl, imageUrlFromElement } = loadCoverHelpers();
    const srcset = 'https://cdn.thestorygraph.com/covers/small.jpg 300w, https://cdn.thestorygraph.com/covers/large.jpg 1200w';
    assert.equal(bestSrcsetUrl(srcset), 'https://cdn.thestorygraph.com/covers/large.jpg');

    const responsiveImage = {
      getAttribute(name) {
        return {
          srcset,
          'data-srcset': '',
          'data-src': '',
          'data-original': '',
          src: 'https://cdn.thestorygraph.com/covers/small.jpg',
        }[name] ?? null;
      },
      currentSrc: '',
      src: '',
    };
    assert.equal(
      imageUrlFromElement(responsiveImage, new URL('https://app.thestorygraph.com/books-read/raul98')),
      'https://cdn.thestorygraph.com/covers/large.jpg',
    );

    const lazyImage = {
      getAttribute(name) {
        return {
          srcset: '',
          'data-srcset': '',
          'data-src': '/covers/lazy.jpg',
          'data-original': '',
          src: 'data:image/gif;base64,placeholder',
        }[name] ?? null;
      },
      currentSrc: '',
      src: 'data:image/gif;base64,placeholder',
    };
    assert.equal(
      imageUrlFromElement(lazyImage, new URL('https://app.thestorygraph.com/books-read/raul98')),
      'https://app.thestorygraph.com/covers/lazy.jpg',
    );
  });

  test('exporta la portada en libros, entradas y CSV', () => {
    assert.ok(source.includes('coverUrl: previous?.coverUrl || cover.url'));
    assert.ok(source.includes("coverUrl: book.coverUrl || ''"));
    assert.ok(source.includes("'cover_url'"));
    assert.match(source, /booksWithCovers/);
  });

  test('diagnostica bloques visibles que no se pudieron interpretar', () => {
    assert.match(source, /visibleEntryElements/);
    assert.match(source, /visibleEditLinks/);
    assert.match(source, /booksWithUnparsedEntries/);
    assert.match(source, /No se pudo extraer ninguna entrada del diario/);
  });
});
