import type { Book } from './types.ts';

function isValidIsbn13(value: string): boolean {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  const sum = [...value].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return sum % 10 === 0;
}

function isValidIsbn10(value: string): boolean {
  if (!/^\d{9}[\dX]$/.test(value)) return false;
  const sum = [...value].reduce((total, digit, index) => {
    const numeric = digit === 'X' ? 10 : Number(digit);
    return total + numeric * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

function convertCandidate(candidate: string): string | null {
  if (isValidIsbn13(candidate)) return candidate;
  if (!isValidIsbn10(candidate)) return null;

  const prefix = `978${candidate.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < prefix.length; index += 1) {
    sum += Number(prefix[index]) * (index % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${prefix}${checkDigit}`;
}

/**
 * Convierte un ISBN-10/13 guardado a ISBN-13 limpio, comprobando también su
 * dígito de control. Así no se pide el lomo de otro libro si el campo ISBN
 * contiene en realidad un UID de StoryGraph u otro identificador parecido.
 */
export function normalizeIsbn13(value: string | undefined | null): string | null {
  const clean = String(value || '').replace(/[\s-]+/g, '').toUpperCase();
  const exact = convertCandidate(clean);
  if (exact) return exact;

  // Acepta textos como «ISBN 978…» si dentro hay un candidato válido.
  const candidates = clean.match(/97[89]\d{10}|\d{9}[\dX]/g) || [];
  for (const candidate of candidates) {
    const converted = convertCandidate(candidate);
    if (converted) return converted;
  }
  return null;
}

/**
 * OpenCover genera un lomo a partir del ISBN. Su catálogo es muy parcial
 * (sobre todo ediciones japonesas), así que Bilibook lo usa solo como
 * candidato: si no carga o no tiene proporción de lomo, se descarta.
 */
export function openCoverSpineUrl(value: string | undefined | null): string | null {
  const isbn = normalizeIsbn13(value);
  return isbn ? `https://image.opencover.jp/v1/cover/spine/${isbn}.webp` : null;
}

export function bookSpineCandidateUrls(
  book: Pick<Book, 'isbn' | 'spineUrl'>,
): string[] {
  const urls = [
    (book.spineUrl || '').trim(),
    openCoverSpineUrl(book.isbn) || '',
  ].filter(Boolean);
  return [...new Set(urls)];
}

/** Grosor visual aproximado del lomo a partir de páginas y formato. */
export function spineWidthPx(book: Pick<Book, 'pages' | 'format'>, compact = false): number {
  const pages = Math.max(0, book.pages || 0);
  const byPages = pages > 0 ? 30 + Math.sqrt(pages) * 1.35 : 38;
  const formatBonus = book.format === 'hardcover' ? 5 : book.format === 'ebook' || book.format === 'audiobook' ? -5 : 0;
  const width = byPages + formatBonus;
  return Math.round(Math.min(compact ? 48 : 68, Math.max(compact ? 24 : 30, width)));
}
