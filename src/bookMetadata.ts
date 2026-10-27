import type { BookFormat, BookLanguage, BookStatus } from './types';

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  arabic: 'ar', arabe: 'ar',
  basque: 'eu', euskera: 'eu', vasco: 'eu',
  catalan: 'ca', catala: 'ca',
  chinese: 'zh', chino: 'zh',
  czech: 'cs', checo: 'cs',
  danish: 'da', danes: 'da',
  dutch: 'nl', neerlandes: 'nl', holandes: 'nl',
  english: 'en', ingles: 'en',
  finnish: 'fi', fines: 'fi', finlandes: 'fi',
  french: 'fr', frances: 'fr',
  galician: 'gl', gallego: 'gl',
  german: 'de', aleman: 'de',
  greek: 'el', griego: 'el',
  hebrew: 'he', hebreo: 'he',
  hindi: 'hi',
  hungarian: 'hu', hungaro: 'hu',
  indonesian: 'id', indonesio: 'id',
  italian: 'it', italiano: 'it',
  japanese: 'ja', japones: 'ja',
  korean: 'ko', coreano: 'ko',
  norwegian: 'no', noruego: 'no',
  polish: 'pl', polaco: 'pl',
  portuguese: 'pt', portugues: 'pt',
  romanian: 'ro', rumano: 'ro',
  russian: 'ru', ruso: 'ru',
  spanish: 'es', espanol: 'es', castellano: 'es',
  swedish: 'sv', sueco: 'sv',
  thai: 'th', tailandes: 'th',
  turkish: 'tr', turco: 'tr',
  ukrainian: 'uk', ucraniano: 'uk',
  vietnamese: 'vi', vietnamita: 'vi',
};

const ISO_639_2_TO_1: Record<string, string> = {
  ara: 'ar', baq: 'eu', cat: 'ca', ces: 'cs', chi: 'zh', cze: 'cs', dan: 'da',
  deu: 'de', dut: 'nl', ell: 'el', eng: 'en', eus: 'eu', fin: 'fi', fra: 'fr',
  fre: 'fr', ger: 'de', glg: 'gl', gre: 'el', heb: 'he', hin: 'hi', hun: 'hu',
  ind: 'id', ita: 'it', jpn: 'ja', kor: 'ko', nld: 'nl', nor: 'no', pol: 'pl',
  por: 'pt', ron: 'ro', rum: 'ro', rus: 'ru', spa: 'es', swe: 'sv', tha: 'th',
  tur: 'tr', ukr: 'uk', vie: 'vi', zho: 'zh',
};

function cleanText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function withoutAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Devuelve un código ISO breve siempre que reconoce el nombre o código recibido. */
export function normalizeLanguageCode(value: unknown): BookLanguage {
  const raw = cleanText(value);
  if (!raw || /^not specified$|^unknown$|^none$/i.test(raw)) return '';

  const first = raw.split(/[,;/]/)[0].replace(/\([^)]*\)/g, ' ').trim();
  const lower = withoutAccents(first.toLowerCase()).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (LANGUAGE_NAME_TO_CODE[lower]) return LANGUAGE_NAME_TO_CODE[lower];

  const code = first.toLowerCase().replace(/[_-].*$/, '');
  if (/^[a-z]{2}$/.test(code)) return code;
  if (/^[a-z]{3}$/.test(code) && ISO_639_2_TO_1[code]) return ISO_639_2_TO_1[code];

  // Conservar un nombre no reconocido es más útil que inventar «inglés».
  return lower.replace(/\s+/g, '-');
}

export function normalizeBookFormat(value: unknown): BookFormat | '' {
  const raw = cleanText(value);
  if (!raw || /^not specified$|^unknown$|^none$/i.test(raw)) return '';
  const text = withoutAccents(raw.toLowerCase()).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (['hardcover', 'hardback', 'tapa dura', 'cartone'].includes(text)) return 'hardcover';
  if (['paperback', 'softcover', 'tapa blanda', 'rustica', 'bolsillo'].includes(text)) return 'paperback';
  if (['ebook', 'e book', 'digital', 'electronico', 'kindle', 'epub'].includes(text)) return 'ebook';
  if (['audiobook', 'audio', 'audiolibro', 'audio cd', 'cd', 'mp3'].includes(text)) return 'audiobook';
  if (['other', 'otro', 'print', 'printed', 'physical'].includes(text)) return 'other';

  if (/\b(hardcover|hardback|tapa dura)\b/.test(text)) return 'hardcover';
  if (/\b(paperback|softcover|tapa blanda|rustica)\b/.test(text)) return 'paperback';
  if (/\b(ebook|e book|digital|kindle|epub|electronico)\b/.test(text)) return 'ebook';
  if (/\b(audiobook|audiolibro|audio)\b/.test(text)) return 'audiobook';
  return 'other';
}

export function normalizeBookStatus(value: unknown): BookStatus | '' {
  const raw = cleanText(value);
  if (!raw) return '';
  const text = withoutAccents(raw.toLowerCase()).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (text === 'dnf' || /\b(did not finish|abandonado|abandoned|stopped)\b/.test(text)) return 'dnf';
  if (/\b(to read|want to read|pending|pendiente|por leer|tbr)\b/.test(text)) return 'pending';
  if (/\b(currently reading|reading|leyendo|en curso|paused|pausado)\b/.test(text)) return 'reading';
  if (text === 'read' || /\b(finished|completed|leido|terminado)\b/.test(text)) return 'read';
  return '';
}

/** Bilibook representa las notas en incrementos de media estrella. */
export function normalizeRating(value: unknown): number | null {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim().replace(',', '.'))
      : NaN;
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.min(5, Math.max(0.5, Math.round(number * 2) / 2));
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, ene: 1, enero: 1,
  feb: 2, february: 2, febrero: 2,
  mar: 3, march: 3, marzo: 3,
  apr: 4, april: 4, abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, june: 6, junio: 6,
  jul: 7, july: 7, julio: 7,
  aug: 8, august: 8, ago: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septiembre: 9, setiembre: 9,
  oct: 10, october: 10, octubre: 10,
  nov: 11, november: 11, noviembre: 11,
  dec: 12, december: 12, dic: 12, diciembre: 12,
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function validDate(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${pad2(month)}-${pad2(day)}`
    : '';
}

/**
 * Normaliza una fecha editorial a ISO cuando StoryGraph trae día, a YYYY-MM
 * cuando solo trae mes y año, o a YYYY cuando solo se conoce el año.
 */
export function normalizePublishDate(value: unknown): string {
  const raw = cleanText(value);
  if (!raw || /^not specified$|^unknown$|^none$/i.test(raw)) return '';

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3])) || match[1];
  match = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (match) return `${match[1]}-${pad2(Number(match[2]))}`;
  match = raw.match(/^(\d{4})$/);
  if (match) return match[1];

  const lower = withoutAccents(raw.toLowerCase());
  match = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:de\s+)?([a-z]+)\.?\s+(?:de\s+)?(\d{4})/);
  if (match && MONTHS[match[2]]) return validDate(Number(match[3]), MONTHS[match[2]], Number(match[1]));

  match = lower.match(/([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (match && MONTHS[match[1]]) return validDate(Number(match[3]), MONTHS[match[1]], Number(match[2]));

  match = lower.match(/([a-z]+)\.?\s+(\d{4})/);
  if (match && MONTHS[match[1]]) return `${match[2]}-${pad2(MONTHS[match[1]])}`;

  match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));

  const year = raw.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  return year ? year[1] : raw;
}

export function normalizeSeriesPosition(value: unknown): string {
  return cleanText(value).replace(/^#\s*/, '').replace(/\s+/g, ' ').trim();
}
