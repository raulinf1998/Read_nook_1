import { load } from 'cheerio';

// Consulta ISBN con proveedores fijos: ninguna URL recibida del cliente se solicita.
const TIMEOUT_MS = 6500;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

export function normalizeIsbn(value) {
  const isbn = typeof value === 'string' ? value.trim().replace(/[\s-]/g, '').toUpperCase() : '';
  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? isbn : null;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index), 0);
    return sum % 11 === 0 ? isbn : null;
  }
  return null;
}

function isbn13(isbn) {
  if (isbn.length === 13) return isbn;
  const stem = `978${isbn.slice(0, 9)}`;
  const sum = [...stem].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return stem + ((10 - sum % 10) % 10);
}
function matchesIsbn(candidate, isbn) {
  const normalized = normalizeIsbn(typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '');
  return Boolean(normalized && isbn13(normalized) === isbn13(isbn));
}
const cleanString = (value) => typeof value === 'string' ? value.trim() : '';
const cleanDescription = (value) => cleanString(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
const pages = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : 0;
const httpsUrl = (value) => {
  const url = cleanString(value).replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://');
  try { return new URL(url).protocol === 'https:' ? url : ''; } catch { return ''; }
};

async function requestProvider(url, fetchImpl, kind = 'json') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { 'Accept': kind === 'html' ? 'text/html' : 'application/json', 'User-Agent': 'Bilibook/1.0 (ISBN lookup)' } });
    if (!response.ok) {
      if (response.status === 404) return { ok: true, data: null };
      return { ok: false, data: null };
    }
    if (Number(response.headers?.get('content-length') || 0) > MAX_JSON_BYTES) return { ok: false, data: null };
    if (!response.body) return { ok: false, data: null };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_JSON_BYTES) {
        controller.abort();
        return { ok: false, data: null };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, data: kind === 'html' ? text : JSON.parse(text) };
  } catch {
    return { ok: false, data: null };
  } finally { clearTimeout(timeout); }
}

function googleResult(data, isbn) {
  const item = (Array.isArray(data?.items) ? data.items : []).find((entry) => {
    const ids = entry?.volumeInfo?.industryIdentifiers;
    return Array.isArray(ids) && ids.some((id) => matchesIsbn(id?.identifier, isbn));
  });
  const info = item?.volumeInfo;
  if (!info || !cleanString(info.title)) return null;
  const image = info.imageLinks || {};
  return { title: cleanString(info.title), author: Array.isArray(info.authors) ? info.authors.filter((v) => typeof v === 'string').join(', ') : '', coverUrl: httpsUrl(image.extraLarge || image.large || image.medium || image.thumbnail || image.smallThumbnail), pages: pages(info.pageCount), publishDate: cleanString(info.publishedDate), language: cleanString(info.language), format: '', description: cleanDescription(info.description), isbn };
}
function openBooksResult(data, isbn) {
  const info = data?.[`ISBN:${isbn}`];
  if (!info || !cleanString(info.title)) return null;
  const cover = info.cover || {};
  return { title: cleanString(info.title), author: Array.isArray(info.authors) ? info.authors.map((a) => cleanString(a?.name)).filter(Boolean).join(', ') : '', coverUrl: httpsUrl(cover.large || cover.medium || cover.small), pages: pages(info.number_of_pages), publishDate: cleanString(info.publish_date), language: cleanString(info.languages?.[0]?.key).split('/').pop() || '', format: cleanString(info.physical_format), description: cleanDescription(typeof info.notes === 'string' ? info.notes : info.notes?.value), isbn };
}
function openSearchResult(data, isbn) {
  const doc = (Array.isArray(data?.docs) ? data.docs : []).find((entry) => Array.isArray(entry?.isbn) && entry.isbn.some((v) => matchesIsbn(v, isbn)));
  if (!doc || !cleanString(doc.title)) return null;
  return { title: cleanString(doc.title), author: Array.isArray(doc.author_name) ? doc.author_name.filter((v) => typeof v === 'string').join(', ') : '', coverUrl: '', pages: 0, publishDate: '', language: '', format: '', description: '', isbn };
}
function shopResult(data, isbn) {
  const products = data?.resources?.results?.products;
  if (!Array.isArray(products)) return null;
  // El buscador devuelve coincidencias aproximadas: solo aceptar el ISBN exacto
  // en etiquetas o variantes; nunca atribuir otra edición al ISBN consultado.
  const product = products.find((item) => [...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(item.variants) ? item.variants.flatMap((v) => [v?.barcode, v?.sku]) : [])].some((v) => matchesIsbn(v, isbn)));
  if (!product || !cleanString(product.title)) return null;
  const vendor = cleanString(product.vendor);
  const parts = vendor.split(',').map((part) => part.trim());
  const author = parts.length === 2 && parts.every(Boolean) ? `${parts[1]} ${parts[0]}` : vendor;
  return { title: cleanString(product.title), author, coverUrl: httpsUrl(product.featured_image?.url || product.image), pages: 0, publishDate: '', language: '', format: '', description: cleanDescription(product.body), isbn };
}
// La Estantería publica una ficha técnica en el cuerpo del producto. Se exige
// un ISBN explícito y exacto; una búsqueda aproximada nunca basta.
function estanteriaResult(data, isbn) {
  const products = data?.resources?.results?.products;
  if (!Array.isArray(products)) return null;
  const product = products.find((item) => {
    const text = cleanDescription(item?.body);
    const candidates = [...text.matchAll(/\bISBN(?:-1[03])?\s*:?\s*([0-9Xx-]{10,17})/gi)];
    return candidates.some((match) => matchesIsbn(match[1], isbn));
  });
  if (!product || !cleanString(product.title)) return null;
  const text = cleanDescription(product.body);
  const pageMatch = text.match(/P[aá]ginas\s*:\s*(\d{1,5})\b/i);
  const formatMatch = text.match(/Presentaci[oó]n\s*:\s*(R[uú]stica|Tapa blanda|Tapa dura|Carton[eé]|Ebook|Audiolibro)\b/i);
  const publishMatch = text.match(/Publicaci[oó]n\s*:\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  let publishDate = '';
  if (publishMatch) {
    const date = new Date(`${publishMatch[1]} UTC`);
    if (Number.isFinite(date.getTime())) publishDate = date.toISOString().slice(0, 10);
  }
  return { title: cleanString(product.title), author: '', coverUrl: httpsUrl(product.featured_image?.url || product.image), pages: pages(pageMatch?.[1]), publishDate, language: '', format: formatMatch?.[1] || '', description: text.split(/Ficha t[eé]cnica\s*\.?/i)[0].trim(), isbn };
}
// Paquebote tiene una ficha pública por ISBN. Solo se usa si la propia ficha
// identifica exactamente la edición; nunca se sigue ningún enlace externo.
function paqueboteResult(html, isbn) {
  if (typeof html !== 'string') return null;
  const $ = load(html);
  $('script, style, noscript').remove();
  $('p, div, li, h1, h2, h3, br, section, article').append(' ');
  const title = cleanString($('h1').first().text());
  const body = $('body').text().replace(/\s+/g, ' ');
  if (!title) return null;
  const titleIndex = body.indexOf(title.replace(/\s+/g, ' '));
  if (titleIndex < 0) return null;
  const identity = body.slice(Math.max(0, titleIndex - 500), titleIndex + title.length + 500);
  const identifiers = [...identity.matchAll(/\bISBN(?:-1[03])?\s*:?\s*([0-9Xx-]{10,17})/gi)];
  if (!identifiers.some((match) => matchesIsbn(match[1], isbn))) return null;
  const rawAuthor = cleanString($('a[href*="buscar.php?autor="]').first().text());
  const authorParts = rawAuthor.split(',').map((part) => part.trim());
  const author = authorParts.length === 2 && authorParts.every(Boolean) ? `${authorParts[1]} ${authorParts[0]}` : rawAuthor;
  const pageMatch = body.match(/P[aá]ginas\s*:\s*(\d{1,5})\b/i);
  const fullDate = body.match(/Fecha de publicaci[oó]n\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const year = body.match(/A[nñ]o\s*:\s*((?:19|20)\d{2})\b/i);
  let publishDate = year ? year[1] : '';
  if (fullDate) {
    const [day, month, y] = fullDate.slice(1).map(Number);
    const date = new Date(Date.UTC(y, month - 1, day));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) publishDate = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  // Solo se acepta una portada cuyo nombre identifique esta edición.
  const image = $('img').toArray().map((node) => $(node).attr('src') || '').find((src) => new RegExp(`/portadaslibros/${isbn13(isbn)}\\.(?:jpg|jpeg|png)(?:[?#]|$)`, 'i').test(src));
  const imageUrl = image ? new URL(image, 'https://www.paquebote.com') : null;
  const coverUrl = imageUrl?.hostname === 'www.paquebote.com' ? httpsUrl(imageUrl.href) : '';
  return { title, author, coverUrl, pages: pages(pageMatch?.[1]), publishDate, language: '', format: '', description: '', isbn };
}
function merge(primary, secondary) {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return Object.fromEntries(Object.keys(primary).map((key) => [key, primary[key] || secondary[key]]));
}

export async function lookupIsbn(raw, fetchImpl = fetch) {
  const isbn = normalizeIsbn(raw);
  if (!isbn) return { status: 'invalid' };
  const encoded = encodeURIComponent(isbn);
  const encoded13 = encodeURIComponent(isbn13(isbn));
  const urls = [
    `https://www.googleapis.com/books/v1/volumes?q=isbn%3A${encoded}`,
    `https://openlibrary.org/api/books?bibkeys=ISBN%3A${encoded}&format=json&jscmd=data`,
    `https://openlibrary.org/search.json?isbn=${encoded}`,
    `https://www.lainevitable.com/search/suggest.json?q=${encoded13}&resources%5Btype%5D=product&resources%5Blimit%5D=5`,
    `https://laestanterialibros.com/search/suggest.json?q=${encoded13}&resources%5Btype%5D=product&resources%5Blimit%5D=5`,
    `https://www.paquebote.com/${encoded13}`,
  ];
  const responses = await Promise.all(urls.map((url, index) => requestProvider(url, fetchImpl, index === urls.length - 1 ? 'html' : 'json')));
  const parsers = [googleResult, openBooksResult, openSearchResult, shopResult, estanteriaResult, paqueboteResult];
  let result = null;
  responses.forEach((response, i) => {
    try { result = merge(result, parsers[i](response.data, isbn)); }
    catch { response.ok = false; }
  });
  if (result) return { status: 'found', result };
  return { status: responses.some((response) => !response.ok) ? 'unavailable' : 'not_found' };
}
