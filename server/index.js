import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');
const COVERS_DIR = join(DATA_DIR, 'covers');
const STATIC_DIR = join(__dirname, 'dist');
const MAX_COVER_BYTES = 10 * 1024 * 1024;

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(COVERS_DIR, { recursive: true });

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

const COVER_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

function coverHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function detectCoverExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  const header = buffer.subarray(0, 16).toString('latin1');
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'gif';
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'webp';
  if (header.slice(4, 8) === 'ftyp' && /^(avif|avis|mif1|msf1)/.test(header.slice(8, 12))) return 'avif';
  if (header.startsWith('BM')) return 'bmp';
  return '';
}

async function storeCoverBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw coverHttpError(400, 'No se recibió ninguna imagen.');
  }
  if (buffer.length > MAX_COVER_BYTES) {
    throw coverHttpError(413, 'La imagen supera el máximo de 10 MB.');
  }
  const extension = detectCoverExtension(buffer);
  if (!extension) {
    throw coverHttpError(400, 'El archivo no parece una imagen JPG, PNG, WebP, GIF, AVIF o BMP válida.');
  }

  const hash = createHash('sha256').update(buffer).digest('hex');
  const filename = `${hash}.${extension}`;
  const finalPath = join(COVERS_DIR, filename);

  try {
    await fsPromises.access(finalPath);
  } catch {
    const tempPath = join(COVERS_DIR, `.tmp-${randomUUID()}`);
    await fsPromises.writeFile(tempPath, buffer, { flag: 'wx' });
    try {
      await fsPromises.rename(tempPath, finalPath);
    } catch (error) {
      await fsPromises.unlink(tempPath).catch(() => {});
      // Otra petición simultánea pudo guardar antes la misma imagen.
      try {
        await fsPromises.access(finalPath);
      } catch {
        throw error;
      }
    }
  }

  return {
    coverUrl: `/covers/${filename}`,
    filename,
    size: buffer.length,
    contentType: COVER_TYPES[extension],
  };
}

function isPrivateOrReservedIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 2)
      || (a === 192 && b === 88)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 203 && b === 0)
      || a >= 224;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('::ffff:')) {
      const mapped = lower.slice('::ffff:'.length);
      return net.isIP(mapped) === 4 ? isPrivateOrReservedIp(mapped) : true;
    }
    const first = lower.split(':')[0] || '0';
    const value = Number.parseInt(first || '0', 16);
    return (value >= 0xfe80 && value <= 0xfebf)
      || (value >= 0xfc00 && value <= 0xfdff)
      || value >= 0xff00
      || lower.startsWith('2001:db8:');
  }
  return true;
}

async function assertPublicCoverUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw coverHttpError(400, 'La URL de la portada no es válida.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw coverHttpError(400, 'La URL de la portada debe empezar por http:// o https://.');
  }
  if (url.username || url.password) {
    throw coverHttpError(400, 'La URL de la portada no debe incluir usuario ni contraseña.');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
  ) {
    throw coverHttpError(400, 'No se pueden descargar portadas desde direcciones locales.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw coverHttpError(400, 'No se pueden descargar portadas desde direcciones IP privadas.');
    }
    return url;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw coverHttpError(400, 'No se pudo resolver el dominio de la URL de la portada.');
  }
  if (!addresses.length || addresses.some((item) => isPrivateOrReservedIp(item.address))) {
    throw coverHttpError(400, 'No se pueden descargar portadas desde direcciones IP privadas.');
  }
  return url;
}

async function readCoverResponse(response) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_COVER_BYTES) {
    throw coverHttpError(413, 'La imagen enlazada supera el máximo de 10 MB.');
  }
  if (!response.body?.getReader) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_COVER_BYTES) {
      await reader.cancel();
      throw coverHttpError(413, 'La imagen enlazada supera el máximo de 10 MB.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function downloadCoverFromUrl(rawUrl) {
  let currentUrl = rawUrl;
  for (let redirect = 0; redirect <= 5; redirect++) {
    const url = await assertPublicCoverUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/bmp,*/*;q=0.8',
          'User-Agent': 'Bilibook cover storage (+https://github.com/raulinf1998/Read_nook_1)',
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw coverHttpError(504, 'El servidor de la imagen tardó demasiado en responder.');
      }
      throw coverHttpError(502, 'No se pudo descargar la imagen desde esa URL.');
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => {});
      if (!location) throw coverHttpError(502, 'La URL de la portada devolvió una redirección inválida.');
      if (redirect === 5) throw coverHttpError(502, 'La URL de la portada tiene demasiadas redirecciones.');
      currentUrl = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) {
      throw coverHttpError(400, `La URL de la portada respondió ${response.status}.`);
    }
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      throw coverHttpError(400, 'La URL no devolvió una imagen.');
    }

    // El temporizador de la petición termina al recibir las cabeceras; hace
    // falta otro mientras se lee el cuerpo para que una imagen que gotea
    // bytes no deje bloqueada una importación indefinidamente.
    const bodyTimeout = setTimeout(() => controller.abort(), 15_000);
    try {
      return await readCoverResponse(response);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw coverHttpError(504, 'El servidor de la imagen tardó demasiado en enviarla.');
      }
      throw error;
    } finally {
      clearTimeout(bodyTimeout);
    }
  }
  throw coverHttpError(502, 'No se pudo descargar la imagen desde esa URL.');
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

// --- Portadas guardadas en el servidor ---
// Se nombran por el hash de la imagen: la misma portada no se duplica y su
// URL local sigue funcionando si desaparece la URL externa original.
app.use('/covers', express.static(COVERS_DIR, {
  index: false,
  fallthrough: true,
  immutable: true,
  maxAge: '365d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

app.post(
  '/api/covers/upload',
  express.raw({ type: () => true, limit: MAX_COVER_BYTES }),
  async (req, res) => {
    try {
      const stored = await storeCoverBuffer(req.body);
      res.json(stored);
    } catch (error) {
      res.status(error?.status || 500).json({ error: error?.message || 'No se pudo guardar la portada.' });
    }
  },
);

app.use('/api/covers/upload', (error, req, res, next) => {
  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({ error: 'La imagen supera el máximo de 10 MB.' });
  }
  return next(error);
});

app.post('/api/covers/from-url', async (req, res) => {
  try {
    const sourceUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!sourceUrl) throw coverHttpError(400, 'Falta la URL de la portada.');
    const buffer = await downloadCoverFromUrl(sourceUrl);
    const stored = await storeCoverBuffer(buffer);
    res.json({ ...stored, sourceUrl });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || 'No se pudo descargar y guardar la portada.' });
  }
});

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
  app.use(express.static(STATIC_DIR, {
    setHeaders(res, filePath) {
      // El extractor se instala desde esta URL: nunca debe servirse una copia
      // cacheada de una versión anterior tras desplegar una corrección.
      if (filePath.endsWith('.user.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }
    },
  }));
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
