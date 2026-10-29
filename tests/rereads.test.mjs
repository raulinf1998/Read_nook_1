import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startReread, completedReadings } from '../src/rereads.ts';
import { buildJournalProgressTimeline, planManualProgress } from '../src/storyGraphJournal.ts';

const firstEnd = new Date(2024, 5, 1, 12).getTime();
const restart = new Date(2025, 1, 1, 12).getTime();
const later = new Date(2025, 1, 2, 12).getTime();
function ids() { let n = 0; return () => `manual-${++n}`; }
function book() { return { id: 'a', title: 'Libro', author: 'Autora', status: 'read', pages: 100, currentPage: 100, startedAt: null, finishedAt: firstEnd, journal: [], tags: [], rating: 4 }; }

test('la relectura conserva la primera lectura, empieza de cero y suma otra al terminar', () => {
  let current = book();
  current = { ...current, ...startReread(current, restart, ids()) };
  assert.equal(current.status, 'reading');
  assert.equal(current.currentPage, 0);
  assert.equal(completedReadings(current).length, 1);
  assert.equal(completedReadings(current)[0].finishedAt, firstEnd);
  const before = buildJournalProgressTimeline(current.journal, current.pages);
  assert.equal(before.currentPage, 0);
  assert.equal(before.currentSegmentIndex, 1);
  const plan = planManualProgress(current.journal, current.pages, 0, 40, later);
  assert.equal(plan.invalidReason, null);
  assert.equal(plan.deltaPages, 40);
  current.journal.push({ id: 'p', date: later, pages: 40, note: '', kind: 'progress', cumulativePages: 40 });
  const end = later + 1000;
  const finish = planManualProgress(current.journal, current.pages, 40, 100, end);
  assert.equal(finish.deltaPages, 60);
  current.journal.push({ id: 'f', date: end, pages: 60, note: '', kind: 'finished', cumulativePages: 100 });
  current = { ...current, status: 'read', currentPage: 100, finishedAt: end };
  const reads = completedReadings(current);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads.map((item) => item.finishedAt), [firstEnd, end]);
  assert.equal(reads.reduce((sum, item) => sum + item.pages, 0), 200);
  assert.equal(current.journal.reduce((sum, item) => sum + item.pages, 0), 100);
  assert.deepEqual(buildJournalProgressTimeline(current.journal, 100).points.map((p) => p.segmentIndex), [0, 1, 1, 1]);
});

test('las lecturas previas sin fecha siguen contando sin inventar una fecha', () => {
  const original = { ...book(), finishedAt: null };
  const patch = startReread(original, restart, ids());
  assert.ok(patch);
  const reads = completedReadings({ ...original, ...patch });
  assert.equal(reads.length, 1);
  assert.equal(reads[0].finishedAt, null);
});

test('no inicia otra relectura simultánea ni coloca el inicio antes de entradas futuras', () => {
  assert.equal(startReread({ ...book(), status: 'reading' }, restart, ids()), null);
  assert.equal(startReread({ ...book(), journal: [{ id: 'future', date: later, pages: 2, note: '' }] }, restart, ids()), null);
});

test('varias relecturas conservan años y páginas previas sin duplicar cierres', () => {
  const makeId = ids();
  let current = { ...book(), journal: [{ id: 'old', date: firstEnd, pages: 100, note: '', kind: 'finished', cumulativePages: 100 }] };
  current = { ...current, ...startReread(current, restart, makeId) };
  assert.equal(current.journal.filter((entry) => entry.kind === 'finished').length, 1);
  assert.equal(current.journal.find((entry) => entry.id === 'old').rereadBoundary, true);
  const secondEnd = later;
  current = { ...current, status: 'read', currentPage: 100, finishedAt: secondEnd, journal: [...current.journal, { id: 'end2', date: secondEnd, pages: 100, note: '', kind: 'finished', cumulativePages: 100 }] };
  current = { ...current, ...startReread(current, secondEnd + 10000, makeId) };
  const reads = completedReadings(current);
  assert.equal(reads.length, 2);
  assert.deepEqual(reads.map((read) => new Date(read.finishedAt).getFullYear()), [2024, 2025]);
  assert.equal(current.journal.reduce((total, entry) => total + entry.pages, 0), 200);
  assert.equal(buildJournalProgressTimeline(current.journal, 100).currentPage, 0);
  assert.equal(buildJournalProgressTimeline(current.journal, 100).currentSegmentIndex, 2);
});
