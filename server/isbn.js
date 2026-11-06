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

async function requestJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { 'Accept': 'application/json', 'User-Agent': 'Bilibook/1.0 (ISBN lookup)' } });
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
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, data: null };
  } finally { clearTimeout(timeout); }
}

function googleResult(data, isbn) {
  const item = (Array.isArray(data?.items) ? data.items : []).find((entry) => {
    const ids = entry?.volumeInfo?.industryIdentifiers;
    return !Array.isArray(ids) || !ids.length || ids.some((id) => matchesIsbn(id.identifier, isbn));
  });
  const info = item?.volumeInfo;
  if (!info || !cleanString(info.title)) return null;
  const image = info.imageLinks || {};
  return { title: cleanString(info.title), author: Array.isArray(info.authors) ? info.authors.filter((v) => typeof v === 'string').join(', ') : '', coverUrl: httpsUrl(image.extraLarge || image.large || image.medium || image.thumbnail || image.smallThumbnail), pages: pages(info.pageCount), publishDate: cleanString(info.publishedDate), language: cleanString(info.language), description: cleanDescription(info.description), isbn };
}
function openBooksResult(data, isbn) {
  const info = data?.[`ISBN:${isbn}`];
  if (!info || !cleanString(info.title)) return null;
  const cover = info.cover || {};
  return { title: cleanString(info.title), author: Array.isArray(info.authors) ? info.authors.map((a) => cleanString(a?.name)).filter(Boolean).join(', ') : '', coverUrl: httpsUrl(cover.large || cover.medium || cover.small), pages: pages(info.number_of_pages), publishDate: cleanString(info.publish_date), language: cleanString(info.languages?.[0]?.key).split('/').pop() || '', description: cleanDescription(typeof info.notes === 'string' ? info.notes : info.notes?.value), isbn };
}
function openSearchResult(data, isbn) {
  const doc = (Array.isArray(data?.docs) ? data.docs : []).find((entry) => Array.isArray(entry?.isbn) && entry.isbn.some((v) => matchesIsbn(v, isbn)));
  if (!doc || !cleanString(doc.title)) return null;
  return { title: cleanString(doc.title), author: Array.isArray(doc.author_name) ? doc.author_name.filter((v) => typeof v === 'string').join(', ') : '', coverUrl: '', pages: 0, publishDate: '', language: '', description: '', isbn };
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
  return { title: cleanString(product.title), author, coverUrl: httpsUrl(product.featured_image?.url || product.image), pages: 0, publishDate: '', language: '', description: cleanDescription(product.body), isbn };
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
  const urls = [
    `https://www.googleapis.com/books/v1/volumes?q=isbn%3A${encoded}`,
    `https://openlibrary.org/api/books?bibkeys=ISBN%3A${encoded}&format=json&jscmd=data`,
    `https://openlibrary.org/search.json?isbn=${encoded}`,
    `https://www.lainevitable.com/search/suggest.json?q=${encoded}&resources%5Btype%5D=product&resources%5Blimit%5D=5`,
  ];
  const responses = await Promise.all(urls.map((url) => requestJson(url, fetchImpl)));
  const parsers = [googleResult, openBooksResult, openSearchResult, shopResult];
  let result = null;
  responses.forEach((response, i) => {
    try { result = merge(result, parsers[i](response.data, isbn)); }
    catch { response.ok = false; }
  });
  if (result) return { status: 'found', result };
  return { status: responses.some((response) => !response.ok) ? 'unavailable' : 'not_found' };
}
