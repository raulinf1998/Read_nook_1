import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');
const STATIC_DIR = join(__dirname, 'dist');

mkdirSync(DATA_DIR, { recursive: true });

const VALID_THEMES = ['calido', 'minimal', 'nocturno', 'vibrante', 'oceano', 'bosque', 'atardecer', 'lavanda'];
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
const PALETTE_ID_RE = /^[a-zA-Z0-9_-]{1,90}$/;

function sanitizePaletteColors(value, fallback) {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const color = (key) => (
    typeof record[key] === 'string' && HEX_COLOR_RE.test(record[key].trim())
      ? record[key].trim().toLowerCase()
      : fallback[key]
  );
  return {
    bg: color('bg'),
    surface: color('surface'),
    ink: color('ink'),
    primary: color('primary'),
    accent: color('accent'),
    accent2: color('accent2'),
  };
}

function sanitizeCustomPalettes(value) {
  if (!Array.isArray(value)) return [];
  const fallbackLight = {
    bg: '#eef8ff', surface: '#ffffff', ink: '#12324a',
    primary: '#0284c7', accent: '#0f766e', accent2: '#f59e0b',
  };
  const fallbackDark = {
    bg: '#061928', surface: '#0b2a42', ink: '#e8f6ff',
    primary: '#38bdf8', accent: '#2dd4bf', accent2: '#fbbf24',
  };
  const seen = new Set();
  const palettes = [];

  for (const raw of value.slice(0, 40)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!PALETTE_ID_RE.test(id) || seen.has(id)) continue;
    palettes.push({
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Mi paleta',
      baseTheme: VALID_THEMES.includes(raw.baseTheme) ? raw.baseTheme : 'calido',
      light: sanitizePaletteColors(raw.light, fallbackLight),
      dark: sanitizePaletteColors(raw.dark, fallbackDark),
      createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
    });
    seen.add(id);
    if (palettes.length >= 24) break;
  }
  return palettes;
}

function loadDB() {
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
      const customPalettes = sanitizeCustomPalettes(parsed.customPalettes);
      return {
        books: Array.isArray(parsed.books) ? parsed.books : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        goal: typeof parsed.goal === 'number' ? parsed.goal : 24,
        dark: Boolean(parsed.dark),
        theme: VALID_THEMES.includes(parsed.theme) ? parsed.theme : 'calido',
        customPalettes,
        customPaletteId: customPalettes.some((palette) => palette.id === parsed.customPaletteId)
          ? parsed.customPaletteId
          : null,
      };
    } catch {
      // corrupted, start fresh
    }
  }
  return { books: [], tags: [], goal: 24, dark: false, theme: 'calido', customPalettes: [], customPaletteId: null };
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
const publicSettings = () => ({
  goal: db.goal,
  dark: db.dark,
  theme: db.theme,
  customPalettes: db.customPalettes,
  customPaletteId: db.customPaletteId,
});

app.get('/api/settings', (req, res) => {
  res.json(publicSettings());
});
app.put('/api/settings', (req, res) => {
  if (typeof req.body.goal === 'number') db.goal = req.body.goal;
  if (typeof req.body.dark === 'boolean') db.dark = req.body.dark;
  if (VALID_THEMES.includes(req.body.theme)) db.theme = req.body.theme;
  if (Array.isArray(req.body.customPalettes)) {
    db.customPalettes = sanitizeCustomPalettes(req.body.customPalettes);
    if (!db.customPalettes.some((palette) => palette.id === db.customPaletteId)) {
      db.customPaletteId = null;
    }
  }
  if (req.body.customPaletteId === null) {
    db.customPaletteId = null;
  } else if (
    typeof req.body.customPaletteId === 'string'
    && db.customPalettes.some((palette) => palette.id === req.body.customPaletteId)
  ) {
    db.customPaletteId = req.body.customPaletteId;
  }
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
  console.log(`Bilibook server running on port ${PORT}`);
});
