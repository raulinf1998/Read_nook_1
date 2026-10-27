// ==UserScript==
// @name         Read Nook · Exportar diario de StoryGraph
// @namespace    https://read-nook.local/
// @version      1.0.2
// @description  Exporta localmente el Reading Journal de StoryGraph a JSON/CSV para Read Nook.
// @author       Read Nook
// @match        https://app.thestorygraph.com/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

/*
 * Exportador local del Reading Journal de StoryGraph para Read Nook.
 *
 * - Solo realiza peticiones GET al propio dominio de StoryGraph.
 * - Usa la sesión ya iniciada en este navegador.
 * - No envía datos ni credenciales a Read Nook ni a terceros.
 * - Genera un archivo JSON o CSV en local.
 */

(() => {
  'use strict';

  const HOST = 'app.thestorygraph.com';
  const PANEL_ID = 'read-nook-sg-exporter';
  const EXTRACTOR_VERSION = '1.0.2';
  const USERNAME_KEY = 'readnook.storygraph.username';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const REQUEST_DELAY_MS = 140;

  function createDiagnostics() {
    return {
      journalPages: 0,
      journalPanes: 0,
      visibleEntryElements: 0,
      visibleEditLinks: 0,
      unparsedEntryElements: 0,
      booksWithUnparsedEntries: 0,
      booksWithCovers: 0,
    };
  }

  if (window.location.hostname !== HOST) {
    window.alert('Abre StoryGraph con tu sesión iniciada y vuelve a ejecutar el exportador.');
    return;
  }

  const previousPanel = document.getElementById(PANEL_ID);
  if (previousPanel) {
    previousPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    previousPanel.querySelector('[data-role="username"]')?.focus();
    return;
  }

  const state = {
    running: false,
    cancelled: false,
    data: null,
    books: new Map(),
    entries: new Map(),
    requests: 0,
    diagnostics: createDiagnostics(),
  };

  const MONTHS = {
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

  function createElement(tag, styles, text) {
    const element = document.createElement(tag);
    if (styles) element.style.cssText = styles;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function buildPanel() {
    const panel = createElement('section', [
      'position:fixed',
      'z-index:2147483647',
      'top:12px',
      'right:12px',
      'width:min(440px, calc(100vw - 24px))',
      'max-height:calc(100vh - 24px)',
      'overflow:auto',
      'box-sizing:border-box',
      'padding:18px',
      'border-radius:16px',
      'background:#fffaf1',
      'color:#25211b',
      'border:1px solid #d6c7ad',
      'box-shadow:0 18px 55px rgba(37,31,20,.28)',
      'font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';'));
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Exportador de diario de StoryGraph para Read Nook');

    const header = createElement('div', 'display:flex;align-items:flex-start;gap:12px;justify-content:space-between;');
    const headingWrap = createElement('div');
    headingWrap.append(
      createElement('div', 'font-size:18px;font-weight:800;line-height:1.2;', '📚 Read Nook'),
      createElement('div', 'font-size:13px;color:#6f6250;margin-top:2px;', 'Exportar diario de StoryGraph'),
    );
    const close = createElement('button', buttonStyle('#efe5d3', '#3c3428', '#cbbd9f'), '✕');
    close.type = 'button';
    close.title = 'Cerrar';
    close.setAttribute('aria-label', 'Cerrar exportador');
    close.dataset.role = 'close';
    header.append(headingWrap, close);

    const intro = createElement(
      'p',
      'margin:12px 0;color:#594f3f;',
      'Recorre tus libros leídos, en curso y abandonados, descarga su diario y guarda fecha, páginas, porcentaje, minutos, notas y la portada de StoryGraph. Todo ocurre en este navegador.',
    );

    const usernameLabel = createElement('label', 'display:block;font-weight:700;margin:12px 0 6px;', 'Usuario de StoryGraph');
    const username = document.createElement('input');
    username.type = 'text';
    username.autocomplete = 'username';
    username.placeholder = 'p. ej. raul98';
    username.dataset.role = 'username';
    username.style.cssText = 'box-sizing:border-box;width:100%;padding:10px 12px;border:1px solid #cbbd9f;border-radius:10px;background:white;color:#25211b;font:inherit;';

    const options = createElement('div', 'display:grid;gap:8px;margin:12px 0;');
    options.append(
      makeCheckbox('include-dnf', 'Incluir libros abandonados', true),
      makeCheckbox('include-notes', 'Incluir notas', true),
      makeCheckbox('edit-fallback', 'Completar páginas faltantes desde “Editar” (recomendado)', true),
    );

    const run = createElement('button', buttonStyle('#7c4a21', '#ffffff', '#7c4a21'), 'Exportar mi diario');
    run.type = 'button';
    run.dataset.role = 'run';
    run.style.width = '100%';
    run.style.padding = '11px 14px';

    const progressTrack = createElement('div', 'height:9px;border-radius:999px;background:#eadfc9;overflow:hidden;margin:14px 0 8px;');
    const progressBar = createElement('div', 'height:100%;width:0%;background:#a86c2c;transition:width .2s ease;');
    progressBar.dataset.role = 'progress-bar';
    progressTrack.append(progressBar);

    const status = createElement('div', 'min-height:20px;font-size:13px;font-weight:650;', 'Listo. No cierres esta pestaña durante la exportación.');
    status.dataset.role = 'status';

    const log = createElement('pre', [
      'white-space:pre-wrap',
      'word-break:break-word',
      'max-height:190px',
      'overflow:auto',
      'margin:10px 0',
      'padding:10px',
      'border-radius:10px',
      'background:#2d271e',
      'color:#f4ead7',
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
    ].join(';'));
    log.dataset.role = 'log';

    const downloads = createElement('div', 'display:grid;grid-template-columns:1fr 1fr;gap:9px;');
    const downloadJson = createElement('button', buttonStyle('#fff', '#4c3a24', '#cbbd9f'), '⬇ Descargar JSON');
    const downloadCsv = createElement('button', buttonStyle('#fff', '#4c3a24', '#cbbd9f'), '⬇ Descargar CSV');
    downloadJson.type = 'button';
    downloadCsv.type = 'button';
    downloadJson.dataset.role = 'download-json';
    downloadCsv.dataset.role = 'download-csv';
    downloadJson.disabled = true;
    downloadCsv.disabled = true;
    setButtonDisabled(downloadJson, true);
    setButtonDisabled(downloadCsv, true);
    downloads.append(downloadJson, downloadCsv);

    const privacy = createElement(
      'p',
      'font-size:12px;color:#746652;margin:12px 0 0;',
      'Privacidad: solo hace peticiones GET a StoryGraph desde tu sesión. No pide ni guarda contraseña, cookies ni envía nada a Read Nook automáticamente.',
    );

    panel.append(header, intro, usernameLabel, username, options, run, progressTrack, status, log, downloads, privacy);
    document.body.appendChild(panel);
    return panel;
  }

  function buttonStyle(background, color, border) {
    return [
      'box-sizing:border-box',
      'border-radius:10px',
      `border:1px solid ${border}`,
      `background:${background}`,
      `color:${color}`,
      'padding:8px 11px',
      'font:700 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'cursor:pointer',
    ].join(';');
  }

  function setButtonDisabled(button, disabled) {
    button.disabled = disabled;
    button.style.opacity = disabled ? '.45' : '1';
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }

  function makeCheckbox(role, label, checked) {
    const wrapper = createElement('label', 'display:flex;align-items:flex-start;gap:8px;cursor:pointer;');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.dataset.role = role;
    input.style.marginTop = '3px';
    wrapper.append(input, createElement('span', '', label));
    return wrapper;
  }

  const panel = buildPanel();
  const els = {
    username: panel.querySelector('[data-role="username"]'),
    includeDnf: panel.querySelector('[data-role="include-dnf"]'),
    includeNotes: panel.querySelector('[data-role="include-notes"]'),
    editFallback: panel.querySelector('[data-role="edit-fallback"]'),
    run: panel.querySelector('[data-role="run"]'),
    close: panel.querySelector('[data-role="close"]'),
    progress: panel.querySelector('[data-role="progress-bar"]'),
    status: panel.querySelector('[data-role="status"]'),
    log: panel.querySelector('[data-role="log"]'),
    json: panel.querySelector('[data-role="download-json"]'),
    csv: panel.querySelector('[data-role="download-csv"]'),
  };

  els.username.value = guessUsername();
  els.username.focus();

  els.close.addEventListener('click', () => {
    state.cancelled = true;
    panel.remove();
  });
  els.run.addEventListener('click', () => {
    if (state.running) {
      state.cancelled = true;
      setStatus('Cancelando…');
      els.run.textContent = 'Cancelando…';
      return;
    }
    void runExport().catch((error) => {
      if (isCancellation(error)) {
        logLine('Exportación cancelada.');
        setStatus('Exportación cancelada.');
      } else {
        console.error('[Read Nook] StoryGraph exporter', error);
        logLine(`❌ ${error instanceof Error ? error.message : String(error)}`);
        setStatus('La exportación terminó con un error.');
      }
    }).finally(() => {
      state.running = false;
      els.run.textContent = state.data ? 'Volver a exportar' : 'Exportar mi diario';
    });
  });
  els.json.addEventListener('click', () => {
    const data = buildExport(new Date().toISOString());
    download(`read-nook-storygraph-journal-${safeFilename(els.username.value)}.json`, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
  });
  els.csv.addEventListener('click', () => {
    const data = buildExport(new Date().toISOString());
    download(`read-nook-storygraph-journal-${safeFilename(els.username.value)}.csv`, toCsv(data.entries), 'text/csv;charset=utf-8');
  });

  function guessUsername() {
    try {
      const saved = window.localStorage.getItem(USERNAME_KEY);
      if (saved) return saved;
    } catch (_) {
      // localStorage puede estar bloqueado; la detección continúa sin él.
    }

    const pathMatch = window.location.pathname.match(
      /^\/(?:profile|books-read|currently-reading|to-read|books-dnf|stats)\/([^/?#]+)/,
    );
    if (pathMatch) return decodeURIComponent(pathMatch[1]);

    const counts = new Map();
    for (const link of document.querySelectorAll('a[href^="/profile/"]')) {
      const name = link.getAttribute('href')?.split('/')[2]?.split(/[?#]/)[0];
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  }

  function safeFilename(value) {
    return String(value || 'storygraph').trim().replace(/[^a-z0-9._-]+/gi, '-') || 'storygraph';
  }

  function logLine(message) {
    const line = `${message}\n`;
    els.log.textContent += line;
    els.log.scrollTop = els.log.scrollHeight;
  }

  function setStatus(message) {
    els.status.textContent = message;
  }

  function setProgress(done, total) {
    const percent = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
    els.progress.style.width = `${percent}%`;
  }

  function isCancellation(error) {
    return error && typeof error === 'object' && error.name === 'ReadNookCancelled';
  }

  function cancellationError() {
    const error = new Error('Exportación cancelada por el usuario.');
    error.name = 'ReadNookCancelled';
    return error;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function runExport() {
    const username = els.username.value.trim().replace(/^@/, '');
    if (!username) throw new Error('Escribe tu nombre de usuario de StoryGraph.');

    state.running = true;
    state.cancelled = false;
    state.data = null;
    state.books.clear();
    state.entries.clear();
    state.requests = 0;
    state.diagnostics = createDiagnostics();
    els.log.textContent = '';
    setProgress(0, 1);
    setButtonDisabled(els.json, true);
    setButtonDisabled(els.csv, true);
    els.run.textContent = 'Cancelar';
    setStatus('Buscando libros…');

    try {
      window.localStorage.setItem(USERNAME_KEY, username);
    } catch (_) {
      // No es imprescindible recordar el usuario.
    }

    logLine(`Extractor v${EXTRACTOR_VERSION}`);
    logLine(`Usuario: ${username}`);
    await discoverBooks(username);
    const books = [...state.books.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    if (!books.length) {
      throw new Error('No se encontraron libros. Comprueba el usuario y que la sesión sigue iniciada.');
    }

    state.diagnostics.booksWithCovers = books.filter((book) => book.coverUrl).length;
    logLine(`Libros localizados: ${books.length} (${state.diagnostics.booksWithCovers} con portada). Leyendo diarios…`);
    let completed = 0;
    for (const book of books) {
      if (state.cancelled) throw cancellationError();
      setStatus(`Diario ${completed + 1} de ${books.length}: ${book.title}`);
      try {
        await scrapeBookJournal(book);
      } catch (error) {
        if (isCancellation(error)) throw error;
        logLine(`⚠️ ${book.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
      completed += 1;
      setProgress(completed, books.length);
      if (completed % 10 === 0 || completed === books.length) {
        logLine(`Progreso: ${completed}/${books.length} libros · ${state.entries.size} entradas · ${state.requests} peticiones`);
      }
    }

    state.data = buildExport(new Date().toISOString());
    const pages = state.data.entries.reduce((sum, entry) => sum + (Number(entry.pagesRead) || 0), 0);
    const diagnostics = state.diagnostics;
    logLine(
      `Diagnóstico: ${diagnostics.journalPages} páginas de diario · ${diagnostics.journalPanes} contenedores · `
      + `${diagnostics.visibleEntryElements} bloques visibles · ${diagnostics.visibleEditLinks} enlaces de edición · ${diagnostics.booksWithCovers} portadas.`,
    );

    if (state.data.entries.length === 0) {
      setStatus('No se pudo extraer ninguna entrada del diario.');
      logLine('❌ No se generó un diario válido: se encontraron libros, pero ninguna entrada interpretable.');
      if (diagnostics.visibleEntryElements > 0 || diagnostics.visibleEditLinks > 0) {
        logLine('StoryGraph sí devolvió bloques/enlaces del diario; probablemente cambió su HTML y hay que actualizar el extractor.');
      } else {
        logLine('Comprueba en StoryGraph que esos libros tienen entradas en View journal entries y que la sesión sigue iniciada.');
      }
      return;
    }

    if (diagnostics.booksWithUnparsedEntries > 0 || diagnostics.unparsedEntryElements > 0) {
      setStatus(`Listo con avisos: ${state.data.entries.length} entradas en ${books.length} libros.`);
      logLine(
        `⚠️ ${state.data.entries.length} entradas exportables · ${pages.toLocaleString()} páginas con valor directo. `
        + `No se pudieron interpretar ${diagnostics.unparsedEntryElements} bloques en ${diagnostics.booksWithUnparsedEntries} libros.`,
      );
    } else {
      setStatus(`Listo: ${state.data.entries.length} entradas en ${books.length} libros.`);
      logLine(`✅ ${state.data.entries.length} entradas exportables · ${pages.toLocaleString()} páginas con valor directo.`);
    }
    logLine('Descarga JSON (recomendado) y súbelo después a Read Nook → Importar.');
    setButtonDisabled(els.json, false);
    setButtonDisabled(els.csv, false);
  }

  async function discoverBooks(username) {
    const encoded = encodeURIComponent(username);
    const sources = [
      { label: 'leídos', path: `/books-read/${encoded}?year=0` },
      { label: 'en lectura', path: `/currently-reading/${encoded}` },
    ];
    if (els.includeDnf.checked) sources.push({ label: 'abandonados', path: `/books-dnf/${encoded}` });

    for (const source of sources) {
      let foundInSource = 0;
      for (let page = 1; page <= 250; page += 1) {
        if (state.cancelled) throw cancellationError();
        const url = new URL(source.path, window.location.origin);
        if (page > 1 || url.searchParams.has('page')) url.searchParams.set('page', String(page));
        const doc = await fetchDocument(url);
        const before = state.books.size;
        parseBookList(doc, url);
        const added = state.books.size - before;
        foundInSource += added;
        if (page === 1 || page % 5 === 0) logLine(`${source.label}: página ${page}, ${foundInSource} libros nuevos…`);
        if (added === 0) break;
      }
      logLine(`${source.label}: ${foundInSource} libros.`);
    }
  }

  function bestSrcsetUrl(srcset) {
    if (!srcset) return '';
    let bestUrl = '';
    let bestScore = -1;

    for (const part of String(srcset).split(',')) {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) continue;
      const descriptor = tokens[1] || '';
      let score = 0;
      if (/^\d+(?:\.\d+)?w$/i.test(descriptor)) {
        score = Number.parseFloat(descriptor);
      } else if (/^\d+(?:\.\d+)?x$/i.test(descriptor)) {
        score = Number.parseFloat(descriptor) * 1000;
      }
      if (score >= bestScore) {
        bestUrl = tokens[0];
        bestScore = score;
      }
    }

    return bestUrl;
  }

  function absoluteHttpUrl(raw, baseUrl) {
    const value = String(raw || '').trim();
    if (!value || /^data:/i.test(value)) return '';
    try {
      const url = new URL(value, baseUrl);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
    } catch {
      return '';
    }
  }

  function imageUrlFromElement(image, pageUrl) {
    if (!image) return '';
    const candidates = [
      bestSrcsetUrl(image.getAttribute?.('srcset')),
      bestSrcsetUrl(image.getAttribute?.('data-srcset')),
      image.getAttribute?.('data-src'),
      image.getAttribute?.('data-original'),
      image.getAttribute?.('src'),
      image.currentSrc,
      image.src,
    ];

    for (const candidate of candidates) {
      const url = absoluteHttpUrl(candidate, pageUrl);
      if (url) return url;
    }
    return '';
  }

  function findCoverImage(card, anchor, pageUrl, bookId) {
    const roots = [];
    if (card) roots.push(card);
    if (anchor && anchor !== card) roots.push(anchor);

    const candidates = [];
    const seen = new Set();
    roots.forEach((root) => {
      const images = root.tagName === 'IMG'
        ? [root]
        : [...(root.querySelectorAll?.('img') || [])];
      images.forEach((image, index) => {
        if (seen.has(image)) return;
        seen.add(image);
        const url = imageUrlFromElement(image, pageUrl);
        if (!url) return;
        const linkHref = image.closest?.('a[href]')?.getAttribute('href') || '';
        const score = (linkHref.includes(`/books/${bookId}`) ? 20 : 0)
          + (image.getAttribute?.('alt') ? 5 : 0)
          - index;
        candidates.push({ image, url, score });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || {
      image: card?.querySelector?.('img') || null,
      url: '',
    };
  }

  function parseBookList(doc, pageUrl) {
    const headings = [...doc.querySelectorAll('h3 a[href^="/books/"]')];
    if (headings.length) {
      for (const anchor of headings) upsertBookFromAnchor(anchor, pageUrl);
      return;
    }

    // Respaldo para variantes de listado sin encabezados h3.
    const main = doc.querySelector('main') || doc.body;
    for (const anchor of main?.querySelectorAll('a[href^="/books/"]') || []) {
      upsertBookFromAnchor(anchor, pageUrl);
    }
  }

  function upsertBookFromAnchor(anchor, pageUrl) {
    const href = anchor.getAttribute('href') || '';
    const id = href.match(/^\/books\/([^/?#]+)/)?.[1] || '';
    if (!UUID_RE.test(id)) return;

    const card = findBookCard(anchor);
    const cardText = cleanText(card?.textContent || anchor.textContent || '');
    const cover = findCoverImage(card, anchor, pageUrl, id);
    const image = cover.image || card?.querySelector('img');
    const alt = cleanText(image?.getAttribute('alt') || '');
    let title = cleanText(anchor.textContent || '');
    let authorFromAlt = '';
    if (alt) {
      const parts = alt.split(/\s+by\s+/i);
      if (!title) title = cleanText(parts[0] || '');
      authorFromAlt = cleanText(parts.slice(1).join(' by ') || '');
    }
    if (!title) title = id;

    const authors = [];
    if (card) {
      for (const authorLink of card.querySelectorAll('a[href^="/authors/"]')) {
        const name = cleanText(authorLink.textContent || '');
        if (!name || authors.includes(name)) continue;
        const after = authorLink.nextSibling?.textContent || '';
        if (/translator|traductor/i.test(after)) continue;
        authors.push(name);
      }
    }
    if (!authors.length && authorFromAlt) authors.push(authorFromAlt);

    const isbnMatch = cardText.match(/ISBN\/UID:\s*([^A-Za-z0-9]*[A-Za-z0-9][A-Za-z0-9-]*)/i);
    const isbn = cleanIsbn(isbnMatch?.[1] || '');
    const pagesMatch = cardText.match(/(\d[\d.,]*)\s*(?:pages|páginas|paginas)/i);
    const bookPages = parseNumber(pagesMatch?.[1]);

    const previous = state.books.get(id);
    const book = {
      storyGraphId: id,
      title: previous?.title && previous.title !== id ? previous.title : title,
      author: previous?.author || authors.join(', '),
      isbn: previous?.isbn || isbn,
      coverUrl: previous?.coverUrl || cover.url,
      pageCount: previous?.pageCount || bookPages,
      storyGraphUrl: new URL(`/books/${id}`, pageUrl.origin).toString(),
    };
    state.books.set(id, book);
  }

  function findBookCard(anchor) {
    let current = anchor;
    let fallback = anchor.parentElement || anchor;
    for (let depth = 0; depth < 9 && current?.parentElement; depth += 1) {
      current = current.parentElement;
      // No subir a un contenedor con varios libros: podría tomar el ISBN o
      // el autor de una tarjeta vecina.
      if (current.querySelectorAll('h3 a[href^="/books/"]').length > 1) break;
      fallback = current;
      const text = current.textContent || '';
      if (text.length > 6000) break;
      if (/ISBN\/UID:/i.test(text) || (/\bpages\b|páginas/i.test(text) && depth >= 2)) return current;
    }
    return fallback;
  }

  async function scrapeBookJournal(book) {
    const visited = new Set();
    let nextUrl = new URL('/journal', window.location.origin);
    nextUrl.searchParams.set('book_id', book.storyGraphId);
    let pageNumber = 1;
    const bookEntries = [];
    let visibleEntryElements = 0;
    let visibleEditLinks = 0;
    let unparsedEntryElements = 0;

    while (nextUrl && pageNumber <= 150) {
      if (state.cancelled) throw cancellationError();
      const key = nextUrl.toString();
      if (visited.has(key)) break;
      visited.add(key);

      const doc = await fetchDocument(nextUrl);
      const parsed = parseJournalDocument(doc, book);
      const parsedEntries = parsed.entries;
      visibleEntryElements += parsed.entryElements;
      visibleEditLinks += parsed.editLinks;
      unparsedEntryElements += parsed.unparsedEntryElements;
      state.diagnostics.journalPages += 1;
      state.diagnostics.journalPanes += parsed.panes;
      state.diagnostics.visibleEntryElements += parsed.entryElements;
      state.diagnostics.visibleEditLinks += parsed.editLinks;
      state.diagnostics.unparsedEntryElements += parsed.unparsedEntryElements;

      let newCount = 0;
      for (const entry of parsedEntries) {
        if (!state.entries.has(entry.id)) newCount += 1;
        state.entries.set(entry.id, entry);
        if (!bookEntries.some((item) => item.id === entry.id)) bookEntries.push(entry);
      }

      let candidate = findNextJournalUrl(doc, nextUrl, book.storyGraphId, visited);
      if (!candidate && parsedEntries.length >= 20) {
        candidate = new URL(nextUrl.toString());
        candidate.searchParams.set('page', String(pageNumber + 1));
        if (visited.has(candidate.toString())) candidate = null;
      }
      if (pageNumber > 1 && newCount === 0) break;
      if (!candidate) break;
      nextUrl = candidate;
      pageNumber += 1;
    }

    if (unparsedEntryElements > 0 || (bookEntries.length === 0 && visibleEditLinks > 0)) {
      state.diagnostics.booksWithUnparsedEntries += 1;
      if (state.diagnostics.booksWithUnparsedEntries <= 5) {
        logLine(
          `⚠️ “${book.title}”: StoryGraph mostró ${visibleEntryElements} bloques y ${visibleEditLinks} enlaces de edición, `
          + `pero no se pudieron interpretar ${Math.max(unparsedEntryElements, visibleEditLinks - bookEntries.length)} entradas.`,
        );
      }
    }

    if (!els.editFallback.checked) return;
    const incomplete = bookEntries.filter(
      (entry) => !entry.date
        || (entry.pagesRead === null && entry.pagesTotal === null && entry.percent === null && entry.kind === 'progress'),
    );
    let done = 0;
    for (const entry of incomplete) {
      if (state.cancelled) throw cancellationError();
      try {
        await enrichFromEditForm(entry);
      } catch (error) {
        if (isCancellation(error)) throw error;
        logLine(`⚠️ No se pudo completar una entrada de “${book.title}”: ${error instanceof Error ? error.message : String(error)}`);
      }
      done += 1;
      if (done % 25 === 0) logLine(`Completadas ${done}/${incomplete.length} entradas sin páginas de “${book.title}”.`);
    }
  }

  function findNextJournalUrl(doc, currentUrl, bookId, visited) {
    const candidates = [];

    const addCandidate = (raw) => {
      if (!raw) return;
      try {
        const url = new URL(raw, window.location.origin);
        if (url.hostname !== HOST || url.pathname !== '/journal') return;
        const candidateBook = url.searchParams.get('book_id');
        if (candidateBook && candidateBook !== bookId) return;
        if (!candidateBook) url.searchParams.set('book_id', bookId);
        if (!visited.has(url.toString())) candidates.push(url);
      } catch (_) {
        // Ignora enlaces mal formados.
      }
    };

    for (const link of doc.querySelectorAll('a[rel~="next"][href], a[href*="/journal?"][href*="page="]')) {
      addCandidate(link.getAttribute('href'));
    }
    for (const link of doc.querySelectorAll('a[href]')) {
      const label = cleanText(link.textContent || '');
      if (/^(next|more|load more|siguiente|ver más|cargar más)$/i.test(label)) addCandidate(link.getAttribute('href'));
    }
    for (const frame of doc.querySelectorAll('turbo-frame[src]')) {
      addCandidate(frame.getAttribute('src'));
    }

    const currentPage = Number(currentUrl.searchParams.get('page') || 1);
    return candidates.find((url) => Number(url.searchParams.get('page') || 1) > currentPage) || candidates[0] || null;
  }

  function parseJournalDocument(doc, book) {
    const panes = [...doc.querySelectorAll('.journal-entry-panes')];
    const entryElements = panes.flatMap((pane) => [...pane.querySelectorAll(':scope > div')]);
    const entries = entryElements
      .map((element) => parseJournalEntry(element, book))
      .filter(Boolean);

    return {
      entries,
      panes: panes.length,
      entryElements: entryElements.length,
      editLinks: doc.querySelectorAll('a[href*="/journal_entries/"][href*="/edit"]').length,
      unparsedEntryElements: Math.max(0, entryElements.length - entries.length),
    };
  }

  function extractJournalEntryId(href) {
    if (!href) return '';

    let pathname = href;
    try {
      pathname = new URL(href, window.location.origin).pathname;
    } catch (_) {
      // Si el href no es una URL resoluble, se intenta igualmente con el texto recibido.
    }

    // StoryGraph ha usado ID numéricos y actualmente usa UUID. Se captura el
    // segmento completo para no descartar identificadores con guiones.
    const match = pathname.match(/^\/journal_entries\/([^/]+)\/edit\/?$/i);
    if (!match) return '';

    try {
      return decodeURIComponent(match[1]);
    } catch (_) {
      return match[1];
    }
  }

  function parseJournalEntry(element, book) {
    const editLink = element.querySelector('a[href*="/journal_entries/"][href*="/edit"]');
    const href = editLink?.getAttribute('href') || '';
    const id = extractJournalEntryId(href);
    if (!id) return null;

    const rawText = cleanText(element.textContent || '');
    const dateSource = element.querySelector('p.font-semibold')?.textContent || rawText;
    const badge = element.querySelector('span[title]');
    const kindText = `${badge?.getAttribute('title') || ''} ${badge?.textContent || ''}`;
    const kind = normalizeKind(kindText, rawText);
    const pages = parsePageProgress(rawText);
    const percent = parsePercent(element, rawText);
    const listening = parseListening(rawText);
    const noteElement = element.querySelector('.trix-content');
    const note = els.includeNotes.checked ? textWithBreaks(noteElement) : '';

    return {
      id,
      storyGraphId: book.storyGraphId,
      isbn: book.isbn || '',
      title: book.title,
      author: book.author || '',
      coverUrl: book.coverUrl || '',
      date: parseDate(dateSource) || '',
      pagesRead: pages.pagesRead,
      pagesTotal: pages.pagesTotal,
      bookPages: pages.bookPages || book.pageCount || null,
      percent,
      minutesListened: listening.minutes,
      minutesTotal: listening.totalMinutes,
      kind,
      note,
    };
  }

  function normalizeKind(kindText, rawText) {
    const source = kindText.trim() ? kindText : rawText.slice(0, 180);
    const normalized = source
      .toLocaleLowerCase('en')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/did not finish|dnf|abandon/.test(normalized)) return 'did-not-finish';
    if (/finished|completed|termin/.test(normalized)) return 'finished';
    if (/started|start reading|comenz|empez/.test(normalized)) return 'started';
    if (/paused|paus/.test(normalized)) return 'paused';
    return 'progress';
  }

  function parsePageProgress(rawText) {
    const text = rawText.replace(/\u00a0/g, ' ');
    const detailed = text.match(
      /(?:read\s+)?([0-9][0-9.,]*)\s*(?:pages?|páginas?|paginas?)(?:\s+(?:read|leídas?|leidas?))?\s*\(\s*([0-9][0-9.,]*)\s*\/\s*([0-9][0-9.,]*)\s*(?:pages?|páginas?|paginas?)?\s*\)/i,
    );
    if (detailed) {
      return {
        pagesRead: parseNumber(detailed[1]),
        pagesTotal: parseNumber(detailed[2]),
        bookPages: parseNumber(detailed[3]),
      };
    }

    const cumulative = text.match(/([0-9][0-9.,]*)\s*\/\s*([0-9][0-9.,]*)\s*(?:pages?|páginas?|paginas?)/i);
    if (cumulative) {
      return {
        pagesRead: null,
        pagesTotal: parseNumber(cumulative[1]),
        bookPages: parseNumber(cumulative[2]),
      };
    }

    const simple = text.match(/(?:read\s+)?([0-9][0-9.,]*)\s*(?:pages?|páginas?|paginas?)(?:\s+(?:read|leídas?|leidas?))/i)
      || text.match(/(?:pages? read in (?:the )?last sitting|last sitting)\s*[:#-]?\s*([0-9][0-9.,]*)/i);
    if (simple) {
      return { pagesRead: parseNumber(simple[1]), pagesTotal: null, bookPages: null };
    }
    return { pagesRead: null, pagesTotal: null, bookPages: null };
  }

  function parsePercent(element, rawText) {
    const styled = [...element.querySelectorAll('[style]')]
      .map((node) => node.getAttribute('style') || '')
      .join(' ');
    const width = styled.match(/width\s*:\s*([0-9]+(?:[.,][0-9]+)?)%/i);
    if (width) return clamp(parseNumber(width[1]), 0, 100);
    const aria = element.querySelector('[aria-valuenow]')?.getAttribute('aria-valuenow');
    if (aria) return clamp(parseNumber(aria), 0, 100);
    const text = rawText.match(/\b([0-9]+(?:[.,][0-9]+)?)%/);
    return text ? clamp(parseNumber(text[1]), 0, 100) : null;
  }

  function parseListening(rawText) {
    const duration = '([0-9]+\\s*(?:hours?|hrs?|h)\\s*(?:and\\s*)?(?:[0-9]+\\s*(?:minutes?|mins?|m))?|[0-9]+\\s*(?:minutes?|mins?|m))';
    const match = rawText.match(new RegExp(`${duration}\\s+listened(?:\\s*\\(\\s*${duration}(?:\\s+(?:out of|total))?\\s*\\))?`, 'i'));
    if (!match) return { minutes: null, totalMinutes: null };
    return {
      minutes: durationToMinutes(match[1]),
      totalMinutes: durationToMinutes(match[2]),
    };
  }

  function durationToMinutes(value) {
    if (!value) return null;
    const hours = value.match(/([0-9]+)\s*(?:hours?|hrs?|h)\b/i);
    const minutes = value.match(/([0-9]+)\s*(?:minutes?|mins?|m)\b/i);
    const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total > 0 ? total : null;
  }

  async function enrichFromEditForm(entry) {
    const doc = await fetchDocument(`/journal_entries/${encodeURIComponent(entry.id)}/edit`);
    const form = doc.querySelector(`form[action="/journal_entries/${CSS.escape(entry.id)}"]`)
      || doc.querySelector('form[action*="/journal_entries/"]')
      || doc.querySelector('form');
    if (!form) return;

    const fields = new Map();
    for (const field of form.querySelectorAll('input[name], select[name], textarea[name]')) {
      const name = field.getAttribute('name') || '';
      let value = '';
      if (field.tagName === 'SELECT') {
        value = field.querySelector('option[selected]')?.getAttribute('value') || field.value || '';
      } else if (field.tagName === 'TEXTAREA') {
        value = field.value || field.textContent || '';
      } else {
        value = field.getAttribute('value') || field.value || '';
      }
      fields.set(name, value);
    }

    const get = (...suffixes) => {
      for (const [name, value] of fields) {
        const normalized = name.toLowerCase();
        if (suffixes.some((suffix) => normalized === suffix || normalized.endsWith(`[${suffix}]`))) return value;
      }
      return '';
    };

    const day = get('day');
    const month = get('month');
    const year = get('year');
    if (day && month && year) entry.date = toIsoDate(Number(year), Number(month), Number(day)) || entry.date;

    const pagesRead = parseNumber(get('pages_read_in_last_sitting', 'pages_read_last_sitting', 'pages_read'));
    const pagesTotal = parseNumber(get('pages_read_total', 'pages_total', 'page_reached', 'current_page'));
    const percent = parseNumber(get('percent_reached', 'percent', 'percentage'));
    const minutes = parseNumber(get('minutes_listened_in_last_sitting', 'minutes_listened', 'minutes_read'));
    const minutesTotal = parseNumber(get('minutes_listened_total', 'minutes_total'));

    if (entry.pagesRead === null && pagesRead !== null) entry.pagesRead = pagesRead;
    if (entry.pagesTotal === null && pagesTotal !== null) entry.pagesTotal = pagesTotal;
    if (entry.percent === null && percent !== null) entry.percent = clamp(percent, 0, 100);
    if (entry.minutesListened === null && minutes !== null) entry.minutesListened = minutes;
    if (entry.minutesTotal === null && minutesTotal !== null) entry.minutesTotal = minutesTotal;

    if (els.includeNotes.checked && !entry.note) {
      const rawNote = get('note', 'notes', 'content');
      if (rawNote) {
        const parsed = new DOMParser().parseFromString(`<div>${rawNote}</div>`, 'text/html');
        entry.note = textWithBreaks(parsed.body.firstElementChild);
      }
    }
  }

  async function fetchDocument(urlOrPath) {
    const url = urlOrPath instanceof URL ? urlOrPath : new URL(urlOrPath, window.location.origin);
    let lastError;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (state.cancelled) throw cancellationError();
      try {
        state.requests += 1;
        const response = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`StoryGraph respondió ${response.status}`);
        }
        if (!response.ok) throw new Error(`StoryGraph respondió ${response.status} en ${url.pathname}`);
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const finalPath = safePathname(response.url);
        if (finalPath.includes('/users/sign_in') || doc.querySelector('form[action*="/users/sign_in"]')) {
          throw new Error('La sesión de StoryGraph ha caducado. Vuelve a iniciar sesión y reinténtalo.');
        }
        if (REQUEST_DELAY_MS) await delay(REQUEST_DELAY_MS);
        return doc;
      } catch (error) {
        if (isCancellation(error)) throw error;
        lastError = error;
        if (attempt < 2) await delay(700 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No se pudo leer una página de StoryGraph.');
  }

  function safePathname(rawUrl) {
    try {
      return new URL(rawUrl, window.location.origin).pathname;
    } catch (_) {
      return '';
    }
  }

  function buildExport(exportedAt) {
    const includeNotes = els.includeNotes.checked;
    const entries = [...state.entries.values()]
      .map((entry) => ({ ...entry, note: includeNotes ? entry.note : '' }))
      .sort((a, b) => (
        a.date.localeCompare(b.date)
        || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        || (a.pagesTotal || 0) - (b.pagesTotal || 0)
        || String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' })
      ));
    return {
      format: 'read-nook-storygraph-journal',
      version: 1,
      extractorVersion: EXTRACTOR_VERSION,
      diagnostics: { ...state.diagnostics },
      exportedAt,
      username: els.username.value.trim().replace(/^@/, ''),
      books: [...state.books.values()].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
      entries,
    };
  }

  function toCsv(entries) {
    const headers = [
      'date', 'storygraph_book_id', 'isbn', 'title', 'author', 'cover_url', 'entry_id',
      'pages_read', 'pages_total', 'book_pages', 'percent',
      'minutes_listened', 'minutes_total', 'kind', 'note',
    ];
    const rows = entries.map((entry) => [
      entry.date,
      entry.storyGraphId,
      entry.isbn,
      entry.title,
      entry.author,
      entry.coverUrl || '',
      entry.id,
      entry.pagesRead ?? '',
      entry.pagesTotal ?? '',
      entry.bookPages ?? '',
      entry.percent ?? '',
      entry.minutesListened ?? '',
      entry.minutesTotal ?? '',
      entry.kind,
      entry.note,
    ]);
    return [headers, ...rows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function cleanText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function textWithBreaks(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    for (const br of clone.querySelectorAll('br')) br.replaceWith(document.createTextNode('\n'));
    for (const block of clone.querySelectorAll('p,div,li,blockquote,h1,h2,h3,h4')) {
      block.append(document.createTextNode('\n'));
    }
    return String(clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    let text = String(value).trim().replace(/\s/g, '');
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) text = text.replace(/,/g, '');
    else text = text.replace(',', '.');
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100) / 100;
  }

  function clamp(value, min, max) {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    return Math.max(min, Math.min(max, value));
  }

  function cleanIsbn(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw || raw === 'NONE' || raw === 'N/A') return '';
    const isbn = raw.replace(/[^0-9X]/g, '');
    if (isbn.length === 10 || isbn.length === 13) return isbn;
    // StoryGraph también usa ASIN/UID cuando una edición no tiene ISBN.
    // Conservarlo ayuda a vincularla con el CSV oficial, que usa el mismo campo.
    const uid = raw.replace(/[^A-Z0-9]/g, '');
    return uid.length >= 5 && uid.length <= 32 ? uid : '';
  }

  function parseDate(rawText) {
    const text = String(rawText || '').replace(/\u00a0/g, ' ');
    const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

    const monthFirst = text.match(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s+(\d{4})\b/i);
    if (monthFirst) {
      const month = MONTHS[normalizeMonthName(monthFirst[1])];
      if (month) return toIsoDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
    }

    const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:de\s+)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\.?\s+(?:de\s+)?(\d{4})\b/i);
    if (dayFirst) {
      const month = MONTHS[normalizeMonthName(dayFirst[2])];
      if (month) return toIsoDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
    }

    const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
    if (numeric) return toIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
    return '';
  }

  function normalizeMonthName(value) {
    return String(value || '')
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\.$/, '');
  }

  function toIsoDate(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return '';
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
})();
