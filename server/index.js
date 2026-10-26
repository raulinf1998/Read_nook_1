import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');
const STATIC_DIR = join(__dirname, 'dist');

mkdirSync(DATA_DIR, { recursive: true });

const VALID_THEMES = ['calido', 'minimal', 'nocturno', 'vibrante'];

function loadDB() {
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
      return {
        books: Array.isArray(parsed.books) ? parsed.books : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        goal: typeof parsed.goal === 'number' ? parsed.goal : 24,
        dark: Boolean(parsed.dark),
        theme: VALID_THEMES.includes(parsed.theme) ? parsed.theme : 'calido',
      };
    } catch {
      // corrupted, start fresh
    }
  }
  return { books: [], tags: [], goal: 24, dark: false, theme: 'calido' };
}

function saveDB(db) {
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
  const newBooks = (req.body.books || []).map((b) => ({
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
const publicSettings = () => ({ goal: db.goal, dark: db.dark, theme: db.theme });

app.get('/api/settings', (req, res) => {
  res.json(publicSettings());
});
app.put('/api/settings', (req, res) => {
  if (typeof req.body.goal === 'number') db.goal = req.body.goal;
  if (typeof req.body.dark === 'boolean') db.dark = req.body.dark;
  if (VALID_THEMES.includes(req.body.theme)) db.theme = req.body.theme;
  saveDB(db);
  res.json(publicSettings());
});

const PORT = process.env.PORT || 3001;

// Serve static frontend (solo en producción, cuando existe dist/)
if (existsSync(join(STATIC_DIR, 'index.html'))) {
  app.use(express.static(STATIC_DIR));
  app.get('*', (req, res) => {
    res.sendFile(join(STATIC_DIR, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Read Nook server running on port ${PORT}`);
});
