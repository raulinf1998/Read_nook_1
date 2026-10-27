import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  calculateJournalCurrentPage,
  mergeStoryGraphJournal,
  normalizeIsbnKey,
  parseStoryGraphJournalDate,
  parseStoryGraphJournalExport,
  parseStoryGraphJournalFile,
} from '../src/storyGraphJournal.ts';

function makeBook(overrides = {}) {
  return {
    title: 'Un libro de prueba',
    author: 'Ada Autora',
    isbn: '9780306406157',
    coverUrl: 'https://covers.example/previous.jpg',
    pages: 300,
    currentPage: 0,
    status: 'reading',
    startedAt: null,
    finishedAt: null,
    journal: [],
    ...overrides,
  };
}

function makeEntry(overrides = {}) {
  return {
    sourceEntryId: '101',
    storyGraphBookId: '',
    isbn: '9780306406157',
    title: 'Un libro de prueba',
    author: 'Ada Autora',
    coverUrl: '',
    date: '2026-01-01',
    pagesRead: null,
    pagesTotal: null,
    bookPages: 300,
    percent: null,
    minutesListened: null,
    minutesTotal: null,
    kind: 'progress',
    note: '',
    ...overrides,
  };
}

describe('parseo del diario de StoryGraph', () => {
  test('acepta el JSON del extractor y completa datos desde books', () => {
    const text = JSON.stringify({
      format: 'read-nook-storygraph-journal',
      version: 1,
      books: [{
        storyGraphId: '11111111-1111-4111-8111-111111111111',
        title: 'Ciudad de Jade',
        author: 'Fonda Lee',
        isbn: '9780306406157',
        coverUrl: 'https://cdn.thestorygraph.com/covers/ciudad-de-jade.jpg',
        pageCount: 560,
      }],
      entries: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        storyGraphId: '11111111-1111-4111-8111-111111111111',
        date: '2026-02-03',
        pagesRead: null,
        pagesTotal: 84,
        percent: 15,
        minutesListened: null,
        minutesTotal: null,
        kind: 'progress',
        note: 'Buen ritmo',
      }],
    });

    const parsedExport = parseStoryGraphJournalExport(text, 'diario.json');
    const entries = parsedExport.entries;
    assert.equal(entries.length, 1);
    assert.equal(parsedExport.books.length, 1);
    assert.equal(parsedExport.books[0].storyGraphBookId, '11111111-1111-4111-8111-111111111111');
    assert.equal(parsedExport.books[0].coverUrl, 'https://cdn.thestorygraph.com/covers/ciudad-de-jade.jpg');
    assert.equal(entries[0].sourceEntryId, '123e4567-e89b-12d3-a456-426614174000');
    assert.equal(entries[0].title, 'Ciudad de Jade');
    assert.equal(entries[0].author, 'Fonda Lee');
    assert.equal(entries[0].coverUrl, 'https://cdn.thestorygraph.com/covers/ciudad-de-jade.jpg');
    assert.equal(entries[0].bookPages, 560);
    assert.equal(entries[0].pagesTotal, 84);
  });

  test('conserva un ID UUID al fusionar una entrada', () => {
    const sourceEntryId = '123e4567-e89b-12d3-a456-426614174001';
    const result = mergeStoryGraphJournal(
      [makeBook()],
      [makeEntry({ sourceEntryId, pagesTotal: 42 })],
    );

    assert.equal(result.report.addedEntries, 1);
    assert.equal(result.books[0].journal[0].id, `sg-${sourceEntryId}`);
    assert.equal(result.books[0].journal[0].sourceEntryId, sourceEntryId);
    assert.equal(result.books[0].journal[0].pages, 42);
  });

  test('acepta el CSV gemelo con comas y saltos de línea en la nota', () => {
    const text = [
      'date,storygraph_book_id,isbn,title,author,cover_url,entry_id,pages_read,pages_total,book_pages,percent,minutes_listened,minutes_total,kind,note',
      '"2026-03-04","22222222-2222-4222-8222-222222222222","9780306406157","Título, con coma","Ada Autora","https://cdn.thestorygraph.com/covers/prueba.jpg","77","12","50","300","16.7","","","did-not-finish","Primera línea\nSegunda línea"',
    ].join('\r\n');

    const entries = parseStoryGraphJournalFile(text, 'diario.csv');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'Título, con coma');
    assert.equal(entries[0].coverUrl, 'https://cdn.thestorygraph.com/covers/prueba.jpg');
    assert.equal(entries[0].kind, 'dnf');
    assert.equal(entries[0].note, 'Primera línea\nSegunda línea');
  });

  test('normaliza fechas e ISBN-10', () => {
    assert.equal(parseStoryGraphJournalDate('January 5, 2026'), '2026-01-05');
    assert.equal(parseStoryGraphJournalDate('5 de enero de 2026'), '2026-01-05');
    assert.equal(normalizeIsbnKey('0-306-40615-2'), '9780306406157');
  });
});

describe('fusion del diario', () => {
  test('convierte acumulados y porcentajes en páginas de sesión sin borrar entradas manuales', () => {
    const manualDate = new Date(2026, 0, 3, 12).getTime();
    const book = makeBook({
      isbn: '0306406152',
      journal: [{ id: 'manual-1', date: manualDate, pages: 5, note: 'Manual' }],
    });
    const entries = [
      makeEntry({ sourceEntryId: '1', date: '2026-01-01', pagesTotal: 40 }),
      makeEntry({ sourceEntryId: '2', date: '2026-01-02', percent: 50 }),
    ];

    const result = mergeStoryGraphJournal([book], entries);
    const mergedBook = result.books[0];
    const imported = mergedBook.journal
      .filter((entry) => entry.source === 'storygraph')
      .sort((a, b) => a.date - b.date);

    assert.equal(result.report.matchedBooks, 1);
    assert.equal(result.report.addedEntries, 2);
    assert.equal(result.report.importedPages, 150);
    assert.deepEqual(imported.map((entry) => entry.pages), [40, 110]);
    assert.ok(mergedBook.journal.some((entry) => entry.id === 'manual-1'));
    assert.equal(mergedBook.currentPage, 155);
    assert.equal(calculateJournalCurrentPage(mergedBook.journal, mergedBook.pages), 155);
  });

  test('vincula por título y autor cuando no hay ID ni ISBN', () => {
    const book = makeBook({
      title: 'El nombre del viento: Crónica del asesino de reyes',
      author: 'Rothfuss, Patrick',
      isbn: '',
      pages: 880,
    });
    const entry = makeEntry({
      isbn: '',
      title: 'El nombre del viento',
      author: 'Patrick Rothfuss',
      pagesRead: 35,
      bookPages: 880,
    });

    const result = mergeStoryGraphJournal([book], [entry]);
    assert.equal(result.report.matchedEntries, 1);
    assert.equal(result.books[0].journal[0].pages, 35);
  });

  test('la portada de StoryGraph sustituye a la portada ya guardada', () => {
    const storyGraphCover = 'https://cdn.thestorygraph.com/covers/libro-de-prueba.jpg';
    const entry = makeEntry({ coverUrl: storyGraphCover, pagesTotal: 20 });

    const first = mergeStoryGraphJournal([makeBook()], [entry]);
    assert.equal(first.books[0].coverUrl, storyGraphCover);
    assert.equal(first.patches[0].patch.coverUrl, storyGraphCover);
    assert.equal(first.report.updatedCovers, 1);

    const second = mergeStoryGraphJournal(first.books, [entry]);
    assert.equal(second.books[0].coverUrl, storyGraphCover);
    assert.equal(second.report.updatedCovers, 0);
    assert.equal(second.patches[0].patch.coverUrl, undefined);
  });

  test('aplica la portada de books aunque ese libro no tenga entradas del diario', () => {
    const storyGraphBookId = '33333333-3333-4333-8333-333333333333';
    const storyGraphCover = 'https://cdn.thestorygraph.com/covers/sin-diario.jpg';
    const books = [
      makeBook(),
      makeBook({
        title: 'Libro sin diario',
        author: 'Otra Autora',
        isbn: '9781234567897',
        storyGraphId: storyGraphBookId,
      }),
    ];
    const metadata = [{
      storyGraphBookId,
      isbn: '9781234567897',
      title: 'Libro sin diario',
      author: 'Otra Autora',
      coverUrl: storyGraphCover,
    }];

    const result = mergeStoryGraphJournal(
      books,
      [makeEntry({ pagesTotal: 20 })],
      metadata,
    );

    assert.equal(result.books[1].coverUrl, storyGraphCover);
    assert.equal(result.books[1].journal.length, 0);
    assert.deepEqual(
      result.patches.find((item) => item.index === 1)?.patch,
      { coverUrl: storyGraphCover },
    );
    assert.equal(result.report.updatedCovers, 1);
    assert.equal(result.report.matchedBooks, 1);
  });

  test('reimportar actualiza por ID sin duplicar', () => {
    const first = mergeStoryGraphJournal(
      [makeBook()],
      [makeEntry({ pagesTotal: 40, note: 'Primera versión' })],
    );
    const unchanged = mergeStoryGraphJournal(
      first.books,
      [makeEntry({ pagesTotal: 40, note: 'Primera versión' })],
    );
    assert.equal(unchanged.report.addedEntries, 0);
    assert.equal(unchanged.report.unchangedEntries, 1);
    assert.equal(unchanged.books[0].journal.length, 1);

    const updated = mergeStoryGraphJournal(
      unchanged.books,
      [makeEntry({ pagesTotal: 45, note: 'Corregido' })],
    );
    assert.equal(updated.report.addedEntries, 0);
    assert.equal(updated.report.updatedEntries, 1);
    assert.equal(updated.books[0].journal.length, 1);
    assert.equal(updated.books[0].journal[0].pages, 45);
    assert.equal(updated.books[0].journal[0].note, 'Corregido');
  });

  test('una relectura reinicia el acumulado y la página actual', () => {
    const book = makeBook({ pages: 100, currentPage: 100, status: 'read' });
    const entries = [
      makeEntry({ sourceEntryId: 'r1', date: '2025-01-01', pagesTotal: 40, bookPages: 100 }),
      makeEntry({ sourceEntryId: 'r2', date: '2025-01-02', pagesTotal: 100, bookPages: 100, kind: 'finished' }),
      makeEntry({ sourceEntryId: 'r3', date: '2026-01-01', pagesTotal: 0, bookPages: 100, kind: 'started' }),
      makeEntry({ sourceEntryId: 'r4', date: '2026-01-02', pagesTotal: 25, bookPages: 100 }),
    ];

    const result = mergeStoryGraphJournal([book], entries);
    const chronological = [...result.books[0].journal].sort((a, b) => a.date - b.date);
    assert.deepEqual(chronological.map((entry) => entry.pages), [40, 60, 0, 25]);
    assert.equal(result.books[0].currentPage, 25);
  });

  test('no fuerza coincidencias ambiguas por título y autor', () => {
    const books = [
      makeBook({ isbn: '' }),
      makeBook({ isbn: '' }),
    ];
    const result = mergeStoryGraphJournal(books, [makeEntry({ isbn: '', pagesRead: 20 })]);
    assert.equal(result.report.matchedEntries, 0);
    assert.equal(result.report.unmatchedEntries, 1);
    assert.equal(result.report.unmatchedBooks.length, 1);
  });
});
