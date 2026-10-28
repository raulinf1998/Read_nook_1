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
const INDEX_HTML_PATH = join(STATIC_DIR, 'index.html');
const EMBEDDED_SETTINGS_PLACEHOLDER = '/* __BILIBOOK_SETTINGS__ */ null';

function sendAppIndex(_req, res, next) {
  try {
    // Se lee en cada petición: es un HTML pequeño y así un despliegue nuevo
    // nunca queda escondido tras una plantilla memorizada por el proceso.
    const indexHtmlTemplate = readFileSync(INDEX_HTML_PATH, 'utf8');
    const embeddedSettings = JSON.stringify(publicSettings())
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    const html = indexHtmlTemplate.includes(EMBEDDED_SETTINGS_PLACEHOLDER)
      ? indexHtmlTemplate.replace(EMBEDDED_SETTINGS_PLACEHOLDER, embeddedSettings)
      : indexHtmlTemplate;
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Type': 'text/html; charset=utf-8',
    });
    return res.send(html);
  } catch (err) {
    if (err && err.code === 'ENOENT') return next();
    return next(err);
  }
}
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const SERVER_STARTED_AT = Date.now();
const MANAGED_COVER_RE = /^[0-9a-f]{64}\.(jpg|png|webp|gif|avif|bmp)$/;

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

function coverString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function localCoverFilename(value) {
  const raw = coverString(value);
  if (!raw) return '';

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return '';
    }
  }
  pathname = pathname.split(/[?#]/)[0];
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return '';
  }
  if (!pathname.startsWith('/covers/')) return '';

  const filename = pathname.slice('/covers/'.length);
  if (!filename || filename.includes('/') || filename.includes('\\')) return '';
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return COVER_TYPES[extension] ? filename : '';
}

function isHttpCoverUrl(value) {
  return /^https?:\/\//i.test(coverString(value));
}

function decodeDataCoverUrl(raw) {
  const match = raw.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
  if (!match) return null;
  const contentType = (match[1] || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/')) return null;
  try {
    return match[2]
      ? Buffer.from(match[3], 'base64')
      : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  } catch {
    return null;
  }
}

async function storedLocalCover(filename) {
  const path = join(COVERS_DIR, filename);
  const stat = await fsPromises.stat(path);
  if (!stat.isFile()) throw new Error('La portada local no es un archivo.');
  if (stat.size > MAX_COVER_BYTES) throw coverHttpError(413, 'La imagen supera el máximo de 10 MB.');
  const buffer = await fsPromises.readFile(path);
  // Se vuelve a derivar el nombre desde los bytes: si alguien sustituyó el
  // contenido de un archivo antiguo, el libro pasa a apuntar al hash nuevo y
  // no queda servido para siempre con la caché del nombre anterior.
  return storeCoverBuffer(buffer);
}

/**
 * Copia automáticamente al servidor la portada de un libro.
 *
 * El nombre final es el SHA-256 de la imagen: los mismos bytes siempre usan
 * el mismo archivo. Cuando una edición cambia la imagen, la ruta de libros
 * elimina después el archivo anterior si ya no lo usa ningún otro libro, así
 * no se acumulan versiones duplicadas. Si la descarga externa falla se
 * conserva la URL original como respaldo para no bloquear el guardado.
 */
async function localizeBookCover(candidate, previousBook = null) {
  const book = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? { ...candidate }
    : {};
  const raw = coverString(book.coverUrl);
  const rawSource = coverString(book.coverSourceUrl);

  if (!raw) {
    return { ...book, coverUrl: '', coverSourceUrl: '' };
  }

  const localFilename = localCoverFilename(raw);
  if (localFilename) {
    try {
      const stored = await storedLocalCover(localFilename);
      return {
        ...book,
        coverUrl: stored.coverUrl,
        coverSourceUrl: rawSource && rawSource !== raw ? rawSource : '',
      };
    } catch {
      if (!isHttpCoverUrl(rawSource)) {
        return { ...book, coverUrl: raw, coverSourceUrl: rawSource };
      }
      try {
        const stored = await storeCoverBuffer(await downloadCoverFromUrl(rawSource));
        return { ...book, coverUrl: stored.coverUrl, coverSourceUrl: rawSource };
      } catch {
        return { ...book, coverUrl: raw, coverSourceUrl: rawSource };
      }
    }
  }

  if (/^data:/i.test(raw)) {
    try {
      const buffer = decodeDataCoverUrl(raw);
      if (!buffer) throw new Error('Portada data: no válida.');
      const stored = await storeCoverBuffer(buffer);
      return { ...book, coverUrl: stored.coverUrl, coverSourceUrl: '' };
    } catch {
      return { ...book, coverUrl: raw, coverSourceUrl: rawSource };
    }
  }

  if (isHttpCoverUrl(raw)) {
    const previousLocalFilename = previousBook ? localCoverFilename(previousBook.coverUrl) : '';
    const previousSource = coverString(previousBook?.coverSourceUrl);
    if (previousLocalFilename && previousSource === raw) {
      try {
        const stored = await storedLocalCover(previousLocalFilename);
        return { ...book, coverUrl: stored.coverUrl, coverSourceUrl: raw };
      } catch {
        // Si la copia local ya no está, se intenta descargar otra vez abajo.
      }
    }

    try {
      const stored = await storeCoverBuffer(await downloadCoverFromUrl(raw));
      return { ...book, coverUrl: stored.coverUrl, coverSourceUrl: raw };
    } catch {
      return { ...book, coverUrl: raw, coverSourceUrl: rawSource || raw };
    }
  }

  return { ...book, coverUrl: raw, coverSourceUrl: rawSource };
}

async function localizeBookCoverList(books) {
  const output = [...books];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, output.length) }, async () => {
    while (cursor < output.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await localizeBookCover(output[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

function referencedCoverFilenames() {
  return new Set(
    db.books
      .map((book) => localCoverFilename(book.coverUrl))
      .filter(Boolean),
  );
}

async function deleteCoverIfUnreferenced(filename) {
  if (!filename || !MANAGED_COVER_RE.test(filename)) return false;
  if (referencedCoverFilenames().has(filename)) return false;
  try {
    await fsPromises.unlink(join(COVERS_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

async function cleanupOrphanedCovers({ before = SERVER_STARTED_AT } = {}) {
  const referenced = referencedCoverFilenames();
  let entries;
  try {
    entries = await fsPromises.readdir(COVERS_DIR, { withFileTypes: true });
  } catch {
    return 0;
  }

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || referenced.has(entry.name)) continue;
    const managed = MANAGED_COVER_RE.test(entry.name);
    const temporary = entry.name.startsWith('.tmp-');
    if (!managed && !temporary) continue;

    try {
      const stat = await fsPromises.stat(join(COVERS_DIR, entry.name));
      if (before && stat.mtimeMs >= before) continue;
      await fsPromises.unlink(join(COVERS_DIR, entry.name));
      removed += 1;
    } catch {
      // Si otro proceso lo está usando, se conserva.
    }
  }
  return removed;
}

let bookMutationQueue = Promise.resolve();
function enqueueBookMutation(task) {
  const run = bookMutationQueue.then(task, task);
  bookMutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Migración de arranque: copia al disco las portadas antiguas que aún sean
 * externas y retira archivos gestionados que ya no usa ningún libro. Trabaja
 * sobre instantáneas para no pisar una edición hecha mientras descarga.
 */
async function migrateBookCovers() {
  if (dbLoadFailed) {
    console.error('Base de datos dañada: no se copiarán ni retirarán portadas en este arranque.');
    return;
  }

  const snapshots = db.books.map((book) => ({
    id: book.id,
    coverUrl: coverString(book.coverUrl),
    coverSourceUrl: coverString(book.coverSourceUrl),
  }));
  const sameSnapshot = (book, snapshot) => Boolean(book)
    && coverString(book.coverUrl) === snapshot.coverUrl
    && coverString(book.coverSourceUrl) === snapshot.coverSourceUrl;

  let cursor = 0;
  let updated = 0;
  const workers = Array.from({ length: Math.min(4, snapshots.length) }, async () => {
    while (cursor < snapshots.length) {
      const snapshot = snapshots[cursor];
      cursor += 1;

      const current = db.books.find((book) => book.id === snapshot.id);
      if (!sameSnapshot(current, snapshot)) continue;

      const localized = await localizeBookCover({ ...current }, current);
      const currentAfter = db.books.find((book) => book.id === snapshot.id);
      if (!sameSnapshot(currentAfter, snapshot)) continue;
      if (
        currentAfter.coverUrl === localized.coverUrl
        && coverString(currentAfter.coverSourceUrl) === coverString(localized.coverSourceUrl)
      ) continue;

      currentAfter.coverUrl = localized.coverUrl;
      currentAfter.coverSourceUrl = localized.coverSourceUrl;
      updated += 1;
      saveDB(db);
    }
  });
  await Promise.all(workers);

  const removed = await cleanupOrphanedCovers();
  if (updated || removed) {
    console.log(`Portadas locales: ${updated} actualizadas, ${removed} archivos sin uso retirados.`);
  }
}

let dbLoadFailed = false;

function loadDB() {
  if (existsSync(DATA_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.books)) {
        throw new Error('Formato de base de datos no reconocido.');
      }
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
        settingsVersion: typeof parsed.settingsVersion === 'number'
          && Number.isSafeInteger(parsed.settingsVersion)
          && parsed.settingsVersion > 0
          ? parsed.settingsVersion
          : 0,
      };
    } catch {
      // Si la base de datos está dañada no se deben interpretar todas las
      // portadas como huérfanas: la migración/limpieza se detiene abajo.
      dbLoadFailed = true;
    }
  }
  return {
    books: [],
    tags: [],
    goal: 24,
    dark: false,
    theme: 'calido',
    customPalettes: [],
    customPaletteId: null,
    settingsVersion: 0,
  };
}

function saveDB(db) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

const app = express();
app.use(express.json({ limit: '50mb' }));

// --- Portadas guardadas en el servidor ---
// Se nombran por el hash de la imagen: la misma portada no se duplica, su URL
// local sigue funcionando si desaparece la externa y al sustituirla se retira
// el archivo anterior cuando ningún libro lo sigue usando.
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

app.post('/api/books', async (req, res) => {
  try {
    const input = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const book = await enqueueBookMutation(async () => {
      const initial = { ...input, id: randomUUID(), createdAt: Date.now() };
      const localized = await localizeBookCover(initial);
      db.books.unshift(localized);
      saveDB(db);
      return localized;
    });
    res.json(book);
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || 'No se pudo guardar el libro.' });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const patch = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const book = await enqueueBookMutation(async () => {
      const idx = db.books.findIndex((b) => b.id === req.params.id);
      if (idx < 0) return null;

      const previous = db.books[idx];
      const previousCoverFilename = localCoverFilename(previous.coverUrl);
      let candidate = {
        ...previous,
        ...patch,
        id: previous.id,
        createdAt: previous.createdAt,
      };
      const touchesCover = Object.prototype.hasOwnProperty.call(patch, 'coverUrl')
        || Object.prototype.hasOwnProperty.call(patch, 'coverSourceUrl');

      if (touchesCover) {
        candidate = await localizeBookCover(candidate, previous);
      }

      db.books[idx] = candidate;
      saveDB(db);

      if (touchesCover && previousCoverFilename) {
        // La imagen anterior solo desaparece si ningún otro libro la comparte.
        await deleteCoverIfUnreferenced(previousCoverFilename);
      }
      return candidate;
    });

    if (!book) return res.status(404).json({ error: 'Not found' });
    return res.json(book);
  } catch (error) {
    return res.status(error?.status || 500).json({ error: error?.message || 'No se pudo actualizar el libro.' });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    await enqueueBookMutation(async () => {
      const previous = db.books.find((b) => b.id === req.params.id);
      const previousCoverFilename = localCoverFilename(previous?.coverUrl);
      db.books = db.books.filter((b) => b.id !== req.params.id);
      saveDB(db);
      if (previousCoverFilename) await deleteCoverIfUnreferenced(previousCoverFilename);
      return true;
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || 'No se pudo eliminar el libro.' });
  }
});

app.post('/api/books/import', async (req, res) => {
  try {
    const input = Array.isArray(req.body?.books) ? req.body.books : [];
    const imported = await enqueueBookMutation(async () => {
      const initial = input
        .filter((book) => book && typeof book === 'object' && !Array.isArray(book))
        .map((book) => ({
          ...book,
          id: randomUUID(),
          createdAt: Date.now(),
        }));
      const newBooks = await localizeBookCoverList(initial);
      db.books = [...newBooks, ...db.books];
      saveDB(db);
      return newBooks.length;
    });
    res.json({ imported });
  } catch (error) {
    res.status(error?.status || 500).json({ error: error?.message || 'No se pudo importar la biblioteca.' });
  }
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
// La apariencia (tema, modo y paletas personalizadas) vive en el servidor,
// no en cada navegador. `settingsVersion` crece con cada cambio para que un
// dispositivo pueda detectar ajustes hechos desde otro y descartar las
// respuestas antiguas que lleguen fuera de orden.
const publicSettings = () => ({
  goal: db.goal,
  dark: db.dark,
  theme: db.theme,
  customPalettes: db.customPalettes,
  customPaletteId: db.customPaletteId,
  settingsVersion: db.settingsVersion || 0,
});

function sendSettings(res) {
  // Nunca debe reutilizarse una copia cacheada de otro momento/dispositivo.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  return res.json(publicSettings());
}

function touchSettings() {
  db.settingsVersion = (Number.isSafeInteger(db.settingsVersion) ? db.settingsVersion : 0) + 1;
}

app.get('/api/settings', (req, res) => {
  sendSettings(res);
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
  touchSettings();
  saveDB(db);
  sendSettings(res);
});

// Guardar o borrar una sola paleta, sin enviar la lista completa. Así, un PC
// que todavía no ha visto la paleta creada en el móvil no puede borrarla al
// guardar otra desde su lista antigua (ni al revés).
app.put('/api/settings/custom-palettes/:id', (req, res) => {
  const candidate = req.body?.palette ?? req.body;
  const [palette] = sanitizeCustomPalettes([candidate]);
  if (!palette || palette.id !== req.params.id) {
    return res.status(400).json({ error: 'La paleta personalizada no es válida.' });
  }

  const existingIndex = db.customPalettes.findIndex((item) => item.id === palette.id);
  if (existingIndex >= 0) {
    db.customPalettes[existingIndex] = palette;
  } else {
    if (db.customPalettes.length >= 24) {
      return res.status(409).json({ error: 'Ya hay 24 paletas personalizadas guardadas.' });
    }
    db.customPalettes.push(palette);
  }

  if (req.body?.activate !== false) {
    db.theme = palette.baseTheme;
    db.customPaletteId = palette.id;
  }
  touchSettings();
  saveDB(db);
  return sendSettings(res);
});

app.delete('/api/settings/custom-palettes/:id', (req, res) => {
  const previousLength = db.customPalettes.length;
  db.customPalettes = db.customPalettes.filter((palette) => palette.id !== req.params.id);
  if (db.customPaletteId === req.params.id) db.customPaletteId = null;
  if (db.customPalettes.length !== previousLength) {
    touchSettings();
    saveDB(db);
  }
  return sendSettings(res);
});

const PORT = process.env.PORT || 3001;

// Serve static frontend (solo en producción, cuando existe dist/)
if (existsSync(INDEX_HTML_PATH)) {
  app.get(['/', '/index.html'], sendAppIndex);
  app.use(express.static(STATIC_DIR, {
    // El HTML no se sirve como un archivo estático más: sendAppIndex lo
    // entrega sin caché y con los ajustes actuales del servidor incrustados.
    index: false,
    setHeaders(res, filePath) {
      if (filePath === INDEX_HTML_PATH) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }
      // El extractor se instala desde esta URL: nunca debe servirse una copia
      // cacheada de una versión anterior tras desplegar una corrección.
      if (filePath.endsWith('.user.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }
    },
  }));
  app.get('*', sendAppIndex);
} else {
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bilibook server running on port ${PORT}`);
});

void migrateBookCovers().catch((error) => {
  console.error('No se pudo completar la copia automática de portadas:', error);
});
