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

function loadMetadataHelpers() {
  const match = source.match(
    /function escapeRegExp\(value\) \{[\s\S]*?\n  function extractBookMetadata/,
  );
  assert.ok(match, 'No se encontraron las funciones de metadatos en el userscript');
  const functionText = match[0].replace(/\n  function extractBookMetadata$/, '');
  const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const parseNumber = (value) => {
    const number = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  return new Function(
    'window',
    'cleanText',
    'parseNumber',
    'parseDate',
    'MONTHS',
    'normalizeMonthName',
    `${functionText}\nreturn { normalizeLanguageCode, normalizeBookFormat, parsePublishDateValue, extractUserRating, extractSeriesInfo };`,
  )(
    { location: { origin: 'https://app.thestorygraph.com' } },
    cleanText,
    parseNumber,
    (value) => (value === 'November 14, 2017' ? '2017-11-14' : ''),
    { november: 11 },
    (value) => String(value || '').toLocaleLowerCase('en'),
  );
}

function loadPercentParser() {
  const match = source.match(
    /function parsePercent\(element, rawText\) \{[\s\S]*?\n  \}\n\n  function parseListening/,
  );
  assert.ok(match, 'No se encontró parsePercent en el userscript');
  const functionText = match[0].replace(/\n\n  function parseListening$/, '');
  const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(String(value).replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const clamp = (value, min, max) => (
    value === null ? null : Math.min(max, Math.max(min, value))
  );
  return new Function(
    'parseNumber',
    'clamp',
    `${functionText}\nreturn parsePercent;`,
  )(parseNumber, clamp);
}

function loadCoverHelpers() {
  const match = source.match(
    /function bestSrcsetUrl\(srcset\) \{[\s\S]*?\n  function metaImageUrl/,
  );
  assert.ok(match, 'No se encontraron las funciones de portada en el userscript');

  const functionText = match[0].replace(/\n  function metaImageUrl$/, '');
  return new Function(
    'window',
    'UUID_RE',
    `${functionText}\nreturn { bestSrcsetUrl, imageUrlFromElement, extractStoryGraphBookId, findCoverImage, collectLinkedCoverUrls };`,
  )(
    { location: { origin: 'https://app.thestorygraph.com' } },
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
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
    assert.match(source, /\/\/ @version\s+1\.0\.6/);
    assert.match(source, /const EXTRACTOR_VERSION = '1\.0\.6'/);
    assert.doesNotMatch(source, /journal_entries\\\/\(\\d\+\)\\\/edit/);
    assert.doesNotMatch(source, /Number\(a\.id\)\s*-\s*Number\(b\.id\)/);
  });

  test('no confunde un ancho de maquetación del 100 % con el avance lector', () => {
    const parsePercent = loadPercentParser();
    const fakeNode = (attributes) => ({
      className: attributes.class || '',
      id: attributes.id || '',
      getAttribute(name) { return attributes[name] ?? null; },
      closest() { return attributes.inProgress ? {} : null; },
    });
    const fakeElement = ({ progressbar = null, styled = [] } = {}) => ({
      querySelector(selector) {
        return selector === '[role="progressbar"]' ? progressbar : null;
      },
      querySelectorAll(selector) {
        return selector === '[style]' ? styled : [];
      },
    });

    const layoutNode = fakeNode({ class: 'w-full', style: 'width: 100%' });
    assert.equal(
      parsePercent(fakeElement({ styled: [layoutNode] }), '24 pages read (36%)'),
      36,
    );
    assert.equal(
      parsePercent(fakeElement({ styled: [layoutNode] }), '24 pages read'),
      null,
    );
    assert.equal(
      parsePercent(
        fakeElement({ styled: [fakeNode({ class: 'reading-progress', style: 'width: 42%' })] }),
        'Progress update',
      ),
      42,
    );

    const progressbar = {
      getAttribute(name) {
        return { 'aria-valuenow': '45', 'aria-valuemin': '0', 'aria-valuemax': '90' }[name] ?? null;
      },
    };
    assert.equal(parsePercent(fakeElement({ progressbar }), 'Progress update'), 50);
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

  test('encuentra la portada enlazada de un panel de StoryGraph y descarta la imagen de carga', () => {
    const { extractStoryGraphBookId, findCoverImage, collectLinkedCoverUrls } = loadCoverHelpers();
    const bookId = '427b8c91-807a-487c-87fc-c2b13503d4b0';
    const pageUrl = new URL('https://app.thestorygraph.com/books-read/raul98?year=0');
    const coverUrl = 'https://cdn.thestorygraph.com/haoeo4eip2vq8aduh2wxhqctsf85';

    const anchor = {
      tagName: 'A',
      getAttribute(name) {
        return name === 'href' ? `/books/${bookId}` : null;
      },
      querySelectorAll(selector) {
        return selector === 'img' ? [loadingImage, coverImage] : [];
      },
      querySelector(selector) {
        return selector === 'img' ? coverImage : null;
      },
    };

    function makeImage(src, alt, inBookCover) {
      return {
        tagName: 'IMG',
        currentSrc: '',
        src: '',
        getAttribute(name) {
          return { src, alt }[name] ?? null;
        },
        closest(selector) {
          if (selector === 'a[href]') return anchor;
          if (selector === '.book-cover') return inBookCover ? {} : null;
          return null;
        },
      };
    }

    const loadingImage = makeImage(
      'https://assets.thestorygraph.com/assets/loading-more-books-example.svg',
      'Loading...',
      false,
    );
    const coverImage = makeImage(coverUrl, 'Ciudad de Jade by Fonda Lee', true);
    const pane = {
      tagName: 'DIV',
      classList: { contains: (name) => name === 'book-pane' },
      querySelectorAll(selector) {
        return selector === 'img' ? [loadingImage, coverImage] : [];
      },
      querySelector(selector) {
        return selector === 'img' ? coverImage : null;
      },
    };
    const doc = {
      querySelectorAll(selector) {
        return selector === 'a[href]' ? [anchor] : [];
      },
    };

    assert.equal(extractStoryGraphBookId(`/books/${bookId}`), bookId);
    assert.deepEqual(
      (({ url, source }) => ({ url, source }))(findCoverImage(pane, null, pageUrl, bookId)),
      { url: coverUrl, source: 'book-pane' },
    );
    assert.deepEqual(
      (({ url, source }) => ({ url, source }))(collectLinkedCoverUrls(doc, pageUrl).get(bookId)),
      { url: coverUrl, source: 'book-pane' },
    );
  });

  test('usa paneles .book-pane y la ficha individual como respaldo de portada', () => {
    assert.match(source, /querySelectorAll\('\.book-pane'\)/);
    assert.match(source, /dataset\?\.bookId/);
    assert.ok(source.includes("closest?.('.book-cover')"));
    assert.match(source, /collectLinkedCoverUrls\(doc, pageUrl\)/);
    assert.match(source, /fillMissingMetadataFromBookPages\(books\)/);
    assert.doesNotMatch(source, /fillMissingCoversFromBookPages\(books\)/);
    assert.match(source, /coverFromBookPage\(doc, url, book\)/);
    assert.match(source, /booksById\.get\(entry\.storyGraphId\)/);
    assert.match(source, /finalBook\?\.coverUrl/);
  });

  test('exporta la portada en libros, entradas y CSV', () => {
    assert.ok(source.includes('coverUrl: previous?.coverUrl || cover.url'));
    assert.ok(source.includes("coverUrl: book.coverUrl || ''"));
    assert.ok(source.includes("'cover_url'"));
    assert.match(source, /booksWithCovers/);
  });

  test('normaliza y exporta todos los metadatos visibles de StoryGraph', () => {
    const helpers = loadMetadataHelpers();
    assert.equal(helpers.normalizeLanguageCode('Spanish'), 'es');
    assert.equal(helpers.normalizeLanguageCode('English (US)'), 'en');
    assert.equal(helpers.normalizeBookFormat('hardcover'), 'hardcover');
    assert.equal(helpers.normalizeBookFormat('Audio CD'), 'audiobook');
    assert.equal(helpers.normalizeBookFormat('Library binding'), 'other');
    assert.equal(helpers.parsePublishDateValue('November 14, 2017', '2016', ''), '2017-11-14');
    assert.equal(helpers.parsePublishDateValue('', '', 'first pub 1968'), '1968');
    assert.equal(helpers.extractUserRating(null, '4.5 raul98’s review Pace: medium'), 4.5);
    assert.equal(helpers.extractUserRating(null, '4.25 average rating'), null);

    const nameAnchor = {
      textContent: 'Huesos verdes',
      getAttribute(name) { return name === 'href' ? '/series/huesos-verdes-id/huesos-verdes' : null; },
    };
    const positionAnchor = {
      textContent: '#0.5',
      getAttribute(name) { return name === 'href' ? '/series/huesos-verdes-id/huesos-verdes' : null; },
    };
    const card = {
      querySelector(selector) { return selector === '.book-title-author-and-series' ? {} : null; },
      querySelectorAll(selector) {
        if (selector === '.book-title-author-and-series') return [card];
        if (selector === 'a[href^="/series/"]') return [nameAnchor, positionAnchor];
        return [];
      },
    };
    assert.deepEqual(helpers.extractSeriesInfo(card), {
      series: 'Huesos verdes',
      seriesPosition: '0.5',
      seriesId: 'huesos-verdes-id',
      seriesUrl: 'https://app.thestorygraph.com/series/huesos-verdes-id/huesos-verdes',
    });

    const combinedAnchorCard = {
      querySelector() { return null; },
      querySelectorAll(selector) {
        return selector === 'a[href^="/series/"]'
          ? [{ textContent: 'Saga en un solo enlace #2', getAttribute(name) { return name === 'href' ? '/series/saga-id/saga' : null; } }]
          : [];
      },
    };
    assert.equal(helpers.extractSeriesInfo(combinedAnchorCard).series, 'Saga en un solo enlace');
    assert.equal(helpers.extractSeriesInfo(combinedAnchorCard).seriesPosition, '2');

    assert.match(source, /status: 'pending'/);
    assert.match(source, /status: 'dnf'/);
    assert.match(source, /status: 'reading'/);
    assert.match(source, /status: 'read'/);
    assert.match(source, /book\.status !== 'pending'/);
    assert.ok(source.includes("'read_status'"));
    assert.ok(source.includes("'series_position'"));
    assert.ok(source.includes('entry.language ||'));
    assert.ok(source.includes('entry.publishDate ||'));
  });

  test('diagnostica bloques visibles que no se pudieron interpretar', () => {
    assert.match(source, /visibleEntryElements/);
    assert.match(source, /visibleEditLinks/);
    assert.match(source, /booksWithUnparsedEntries/);
    assert.match(source, /bookPanesSeen/);
    assert.match(source, /coverImagesSeen/);
    assert.match(source, /booksWithoutCovers/);
    assert.match(source, /No se pudo extraer ninguna entrada del diario/);
  });
});
