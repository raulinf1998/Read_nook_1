import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');
const STATIC_DIR = join(__dirname, 'dist');

mkdirSync(DATA_DIR, { recursive: true });

interface DB {
  books: any[];
  tags: string[];
  goal: number;
  dark: boolean;
}

function loadDB(): DB {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    } catch {
      // corrupted, start fresh
    }
  }
  return { books: [], tags: [], goal: 24, dark: false };
}

function saveDB(db: DB) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

const app = express();
app.use(express.json({ limit: '50mb' }));

// --- Books ---
app.get('/api/books', (req, res) => {
  res.json(db.books);
});

app.post('/api/books', (req, res) => {
  const book = { ...req.body, id: crypto.randomUUID(), createdAt: Date.now() };
  db.books.unshift(book);
  saveDB(db);
  res.json(book);
});

app.put('/api/books/:id', (req, res) => {
  const idx = db.books.findIndex((b) => b.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.books[idx] = { ...db.books[idx], ...req.body };
  saveDB(db);
  res.json(db.books[idx]);
});

app.delete('/api/books/:id', (req, res) => {
  db.books = db.books.filter((b) => b.id !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

app.post('/api/books/import', (req, res) => {
  const newBooks = (req.body.books || []).map((b: any) => ({
    ...b,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }));
  db.books = [...newBooks, ...db.books];
  saveDB(db);
  res.json({ imported: newBooks.length });
});

// --- Tags ---
app.get('/api/tags', (req, res) => res.json(db.tags));
app.post('/api/tags', (req, res) => {
  const tag = req.body.tag;
  if (tag && !db.tags.includes(tag)) {
    db.tags.push(tag);
    saveDB(db);
  }
  res.json(db.tags);
});
app.delete('/api/tags/:tag', (req, res) => {
  db.tags = db.tags.filter((t) => t !== req.params.tag);
  saveDB(db);
  res.json(db.tags);
});

// --- Settings ---
app.get('/api/settings', (req, res) => {
  res.json({ goal: db.goal, dark: db.dark });
});
app.put('/api/settings', (req, res) => {
  if (typeof req.body.goal === 'number') db.goal = req.body.goal;
  if (typeof req.body.dark === 'boolean') db.dark = req.body.dark;
  saveDB(db);
  res.json({ goal: db.goal, dark: db.dark });
});

const PORT = process.env.PORT || 3001;

// Serve static frontend
app.use(express.static(STATIC_DIR));
app.get('*', (req, res) => {
  res.sendFile(join(STATIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Book tracker running on port ${PORT}`);
});
