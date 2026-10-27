// ==UserScript==
// @name         Read Nook · Exportar diario de StoryGraph
// @namespace    https://read-nook.local/
// @version      1.0.5
// @description  Exporta localmente el Reading Journal de StoryGraph a JSON/CSV para Bilibook.
// @author       Bilibook
// @match        https://app.thestorygraph.com/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

/*
 * Exportador local del Reading Journal de StoryGraph para Bilibook.
 *
 * - Solo realiza peticiones GET al propio dominio de StoryGraph.
 * - Usa la sesión ya iniciada en este navegador.
 * - No envía datos ni credenciales a Bilibook ni a terceros.
 * - Genera un archivo JSON o CSV en local.
 */

(() => {
  'use strict';

  const HOST = 'app.thestorygraph.com';
  const PANEL_ID = 'read-nook-sg-exporter';
  const EXTRACTOR_VERSION = '1.0.5';
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
      booksWithoutCovers: 0,
      bookPanesSeen: 0,
      coverImagesSeen: 0,
      coversFromBookPanes: 0,
      coversFromLinkedImages: 0,
      coversFromBookPages: 0,
      booksWithLanguage: 0,
      booksWithFormat: 0,
      booksWithPages: 0,
      booksWithPublishDate: 0,
      booksWithStatus: 0,
      booksWithRating: 0,
      booksInSeries: 0,
      metadataFromBookPages: 0,
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
    panel.setAttribute('aria-label', 'Exportador de diario de StoryGraph para Bilibook');

    const header = createElement('div', 'display:flex;align-items:flex-start;gap:12px;justify-content:space-between;');
    const headingWrap = createElement('div');
    headingWrap.append(
      createElement('div', 'font-size:18px;font-weight:800;line-height:1.2;', '📚 Bilibook'),
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
      'Recorre tus libros leídos, en curso, pendientes y abandonados, descarga su diario y guarda portada, idioma, formato, páginas, fecha de publicación, estado, puntuación, saga, porcentaje, minutos y notas. Todo ocurre en este navegador.',
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
      makeCheckbox('include-to-read', 'Incluir pendientes y sus datos', true),
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
      'Privacidad: solo hace peticiones GET a StoryGraph desde tu sesión. No pide ni guarda contraseña, cookies ni envía nada a Bilibook automáticamente.',
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
    includeToRead: panel.querySelector('[data-role="include-to-read"]'),
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
        console.error('[Bilibook] StoryGraph exporter', error);
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

    await fillMissingMetadataFromBookPages(books);
    refreshCoverDiagnostics(books);
    logLine(
      `Libros localizados: ${books.length} (${state.diagnostics.booksWithCovers} con portada, `
      + `${state.diagnostics.booksWithoutCovers} sin portada). Leyendo diarios…`,
    );
    logLine(
      `Datos localizados: idioma ${state.diagnostics.booksWithLanguage}, formato ${state.diagnostics.booksWithFormat}, `
      + `páginas ${state.diagnostics.booksWithPages}, fecha ${state.diagnostics.booksWithPublishDate}, estado ${state.diagnostics.booksWithStatus}, `
      + `puntuación ${state.diagnostics.booksWithRating}, saga ${state.diagnostics.booksInSeries}.`,
    );
    if (state.diagnostics.booksWithCovers === 0) {
      logLine('⚠️ Todavía no se ha encontrado ninguna portada de StoryGraph; el diario se exportará, pero Bilibook no podrá sustituir portadas con este archivo.');
    }
    const journalBooks = books.filter((book) => book.status !== 'pending');
    const pendingBooks = books.length - journalBooks.length;
    if (pendingBooks > 0) {
      logLine(`${pendingBooks} libros pendientes se exportarán con portada y datos, sin consultar un diario que aún no tienen.`);
    }
    let completed = 0;
    for (const book of journalBooks) {
      if (state.cancelled) throw cancellationError();
      setStatus(`Diario ${completed + 1} de ${journalBooks.length}: ${book.title}`);
      try {
        await scrapeBookJournal(book);
      } catch (error) {
        if (isCancellation(error)) throw error;
        logLine(`⚠️ ${book.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
      completed += 1;
      setProgress(completed, journalBooks.length);
      if (completed % 10 === 0 || completed === journalBooks.length) {
        logLine(`Progreso: ${completed}/${journalBooks.length} libros · ${state.entries.size} entradas · ${state.requests} peticiones`);
      }
    }

    state.data = buildExport(new Date().toISOString());
    const pages = state.data.entries.reduce((sum, entry) => sum + (Number(entry.pagesRead) || 0), 0);
    const diagnostics = state.diagnostics;
    logLine(
      `Diagnóstico: ${diagnostics.journalPages} páginas de diario · ${diagnostics.journalPanes} contenedores · `
      + `${diagnostics.visibleEntryElements} bloques visibles · ${diagnostics.visibleEditLinks} enlaces de edición · `
      + `${diagnostics.bookPanesSeen} paneles de libro · ${diagnostics.coverImagesSeen} imágenes de portada vistas · `
      + `${diagnostics.booksWithCovers} libros con portada (${diagnostics.coversFromBookPanes} de listados, `
      + `${diagnostics.coversFromLinkedImages} de enlaces-imagen, ${diagnostics.coversFromBookPages} de fichas) · `
      + `${diagnostics.booksWithLanguage} con idioma · ${diagnostics.booksWithFormat} con formato · `
      + `${diagnostics.booksWithPages} con páginas · ${diagnostics.booksWithPublishDate} con fecha · `
      + `${diagnostics.booksWithStatus} con estado · ${diagnostics.booksWithRating} con puntuación · `
      + `${diagnostics.booksInSeries} en saga.`,
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

    const missingEveryCover = books.length > 0 && diagnostics.booksWithCovers === 0;
    if (diagnostics.booksWithUnparsedEntries > 0 || diagnostics.unparsedEntryElements > 0 || missingEveryCover) {
      setStatus(`Listo con avisos: ${state.data.entries.length} entradas en ${books.length} libros.`);
      logLine(
        `⚠️ ${state.data.entries.length} entradas exportables · ${pages.toLocaleString()} páginas con valor directo. `
        + `No se pudieron interpretar ${diagnostics.unparsedEntryElements} bloques en ${diagnostics.booksWithUnparsedEntries} libros.`,
      );
      if (missingEveryCover) {
        logLine('⚠️ El archivo incluirá el diario, pero ninguna URL de portada: Bilibook indicará 0 portadas sustituidas. Copia la línea «Diagnóstico» si necesitas ayuda.');
      }
    } else {
      setStatus(`Listo: ${state.data.entries.length} entradas en ${books.length} libros.`);
      logLine(`✅ ${state.data.entries.length} entradas exportables · ${pages.toLocaleString()} páginas con valor directo.`);
    }
    logLine('Descarga JSON (recomendado) y súbelo después a Bilibook → Importar.');
    setButtonDisabled(els.json, false);
    setButtonDisabled(els.csv, false);
  }

  async function discoverBooks(username) {
    const encoded = encodeURIComponent(username);
    const sources = [
      { label: 'leídos', path: `/books-read/${encoded}?year=0`, status: 'read' },
      { label: 'en lectura', path: `/currently-reading/${encoded}`, status: 'reading' },
    ];
    if (els.includeDnf.checked) sources.push({ label: 'abandonados', path: `/books-dnf/${encoded}`, status: 'dnf' });
    if (els.includeToRead.checked) sources.push({ label: 'pendientes', path: `/to-read/${encoded}`, status: 'pending' });

    for (const source of sources) {
      let foundInSource = 0;
      for (let page = 1; page <= 250; page += 1) {
        if (state.cancelled) throw cancellationError();
        const url = new URL(source.path, window.location.origin);
        if (page > 1 || url.searchParams.has('page')) url.searchParams.set('page', String(page));
        const doc = await fetchDocument(url);
        const before = state.books.size;
        parseBookList(doc, url, source.status);
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

  function isLikelyCoverUrl(rawUrl) {
    if (!rawUrl) return false;
    try {
      const url = new URL(rawUrl);
      const hostAndPath = `${url.hostname}${url.pathname}`.toLowerCase();
      if (/loading-more-books|spinner|placeholder|no[-_]?cover|missing[-_]?cover/.test(hostAndPath)) return false;
      if (url.hostname === 'assets.thestorygraph.com' && /loading|logo|icon/.test(url.pathname.toLowerCase())) return false;
      return true;
    } catch {
      return false;
    }
  }

  function imageUrlFromElement(image, pageUrl) {
    if (!image) return '';
    const candidates = [
      bestSrcsetUrl(image.getAttribute?.('srcset')),
      bestSrcsetUrl(image.getAttribute?.('data-srcset')),
      image.getAttribute?.('data-src'),
      image.getAttribute?.('data-original'),
      image.getAttribute?.('data-lazy-src'),
      image.getAttribute?.('src'),
      image.currentSrc,
      image.src,
    ];

    // StoryGraph puede servir la imagen responsive desde un <source> hermano
    // dentro de <picture>, no solo desde los atributos del propio <img>.
    const picture = image.closest?.('picture');
    if (picture?.querySelectorAll) {
      for (const source of picture.querySelectorAll('source')) {
        candidates.unshift(
          bestSrcsetUrl(source.getAttribute?.('srcset')),
          bestSrcsetUrl(source.getAttribute?.('data-srcset')),
          source.getAttribute?.('data-src'),
          source.getAttribute?.('src'),
        );
      }
    }

    for (const candidate of candidates) {
      const url = absoluteHttpUrl(candidate, pageUrl);
      if (url && isLikelyCoverUrl(url)) return url;
    }
    return '';
  }

  function extractStoryGraphBookId(href) {
    if (!href) return '';
    let pathname = String(href);
    try {
      pathname = new URL(pathname, window.location.origin).pathname;
    } catch (_) {
      // Se intenta igualmente con el href textual.
    }
    const id = pathname.match(/^\/books\/([^/?#]+)(?:\/|$)/)?.[1] || '';
    return UUID_RE.test(id) ? id : '';
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
      const rootIsBookPane = Boolean(root.classList?.contains?.('book-pane'));
      images.forEach((image, index) => {
        if (seen.has(image)) return;
        seen.add(image);
        const url = imageUrlFromElement(image, pageUrl);
        if (!url) return;

        const linkHref = image.closest?.('a[href]')?.getAttribute('href') || '';
        const linkedBookId = extractStoryGraphBookId(linkHref);
        const inBookCover = Boolean(image.closest?.('.book-cover'));
        let hostname = '';
        try {
          hostname = new URL(url).hostname;
        } catch (_) {
          hostname = '';
        }

        let source = 'image';
        let score = -index;
        if (inBookCover) {
          source = 'book-pane';
          score += 100;
        } else if (linkedBookId === bookId) {
          source = 'linked-image';
          score += 80;
        } else if (rootIsBookPane) {
          source = 'book-pane';
          score += 60;
        }
        if (hostname === 'cdn.thestorygraph.com') score += 30;
        if (image.getAttribute?.('alt')) score += 5;

        candidates.push({ image, url, score, source });
      });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || {
      image: card?.querySelector?.('img') || null,
      url: '',
      source: '',
    };
  }

  function collectLinkedCoverUrls(doc, pageUrl) {
    const covers = new Map();
    for (const anchor of doc.querySelectorAll?.('a[href]') || []) {
      const bookId = extractStoryGraphBookId(anchor.getAttribute?.('href') || '');
      if (!bookId) continue;
      const candidate = findCoverImage(anchor, anchor, pageUrl, bookId);
      if (!candidate.url) continue;
      const previous = covers.get(bookId);
      if (!previous || candidate.score > previous.score) covers.set(bookId, candidate);
    }
    return covers;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function labeledValue(text, label) {
    const labels = 'ISBN\\/UID|Format|Language|Original Pub Year|Edition Pub Date|Publisher';
    const match = String(text || '').match(
      new RegExp(`${escapeRegExp(label)}:\\s*(.+?)(?=\\s+(?:${labels}):|\\s+\\d+\\s+editions?\\b|$)`, 'i'),
    );
    const value = cleanText(match?.[1] || '');
    return /^not specified$|^unknown$|^none$/i.test(value) ? '' : value;
  }

  const LANGUAGE_NAME_TO_CODE = {
    arabic: 'ar', basque: 'eu', catalan: 'ca', chinese: 'zh', czech: 'cs',
    danish: 'da', dutch: 'nl', english: 'en', finnish: 'fi', french: 'fr',
    galician: 'gl', german: 'de', greek: 'el', hebrew: 'he', hindi: 'hi',
    hungarian: 'hu', indonesian: 'id', italian: 'it', japanese: 'ja',
    korean: 'ko', norwegian: 'no', polish: 'pl', portuguese: 'pt',
    romanian: 'ro', russian: 'ru', spanish: 'es', swedish: 'sv',
    thai: 'th', turkish: 'tr', ukrainian: 'uk', vietnamese: 'vi',
  };

  function normalizeLanguageCode(value) {
    const raw = cleanText(value || '').split(/[,;/]/)[0].replace(/\([^)]*\)/g, ' ').trim();
    if (!raw) return '';
    const lower = raw.toLocaleLowerCase('en');
    if (LANGUAGE_NAME_TO_CODE[lower]) return LANGUAGE_NAME_TO_CODE[lower];
    const code = lower.replace(/[_-].*$/, '');
    return /^[a-z]{2}$/.test(code) ? code : lower.replace(/\s+/g, '-');
  }

  function normalizeBookFormat(value) {
    const text = cleanText(value || '').toLocaleLowerCase('en').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text || text === 'not specified' || text === 'unknown') return '';
    if (/\b(hardcover|hardback|tapa dura)\b/.test(text)) return 'hardcover';
    if (/\b(paperback|softcover|tapa blanda)\b/.test(text)) return 'paperback';
    if (/\b(ebook|e book|digital|kindle|epub)\b/.test(text)) return 'ebook';
    if (/\b(audiobook|audio|audiolibro)\b/.test(text)) return 'audiobook';
    return 'other';
  }

  function parsePublishDateValue(editionText, originalYearText, text) {
    const edition = cleanText(editionText || '');
    if (edition) {
      const parsed = parseDate(edition);
      if (parsed) return parsed;
      const monthYear = edition.match(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\.?\s+(\d{4})\b/i);
      const month = monthYear ? MONTHS[normalizeMonthName(monthYear[1])] : null;
      if (monthYear && month) return `${monthYear[2]}-${String(month).padStart(2, '0')}`;
      const editionYear = edition.match(/\b(\d{4})\b/);
      if (editionYear) return editionYear[1];
    }

    const originalYear = cleanText(originalYearText || '').match(/\b(\d{4})\b/)?.[1]
      || String(text || '').match(/\bfirst pub(?:lished)?\s+(\d{4})\b/i)?.[1]
      || '';
    return originalYear;
  }

  function extractUserRating(card, cardText) {
    const valueFromText = (value) => {
      const number = parseNumber(value);
      return number !== null && number > 0 && number <= 5 ? number : null;
    };

    if (card?.querySelectorAll) {
      for (const anchor of card.querySelectorAll('a[href^="/reviews/"]')) {
        const candidates = [
          anchor.previousElementSibling?.textContent,
          anchor.previousSibling?.textContent,
          anchor.parentElement?.textContent,
          anchor.getAttribute?.('aria-label'),
          anchor.getAttribute?.('title'),
          anchor.getAttribute?.('data-rating'),
        ];
        for (const candidate of candidates) {
          const match = String(candidate || '').match(/(?:^|\s)([0-5](?:[.,]\d{1,2})?)(?:\s|$)/);
          const value = valueFromText(match?.[1]);
          if (value !== null) return value;
        }
      }

      for (const element of card.querySelectorAll('[data-rating], [data-star-rating]')) {
        const value = valueFromText(element.getAttribute?.('data-rating') || element.getAttribute?.('data-star-rating'));
        if (value !== null) return value;
      }
    }

    const reviewMatch = String(cardText || '').match(
      /(?:^|\s)([0-5](?:[.,]\d{1,2})?)\s+[A-Za-z0-9_.-]+(?:'s|’s)\s+review\b/i,
    );
    const fromReview = valueFromText(reviewMatch?.[1]);
    if (fromReview !== null) return fromReview;

    const ownMatch = String(cardText || '').match(
      /(?:your|my)\s+rating\s*[:#-]?\s*([0-5](?:[.,]\d{1,2})?)/i,
    );
    return valueFromText(ownMatch?.[1]);
  }

  function extractSeriesInfo(card) {
    const empty = { series: '', seriesPosition: '', seriesId: '', seriesUrl: '' };
    if (!card?.querySelectorAll) return empty;

    const scopes = [];
    if (card.querySelector) {
      scopes.push(...(card.querySelectorAll('.book-title-author-and-series') || []));
    }
    if (!scopes.length) scopes.push(card);

    for (const scope of scopes) {
      const anchors = [...(scope.querySelectorAll?.('a[href^="/series/"]') || [])];
      let series = '';
      let seriesPosition = '';
      let seriesId = '';
      let seriesUrl = '';

      for (const anchor of anchors) {
        const text = cleanText(anchor.textContent || '');
        const href = anchor.getAttribute?.('href') || '';
        const id = href.match(/\/series\/([^/?#]+)/)?.[1] || '';
        if (!text) continue;
        if (text.startsWith('#')) {
          if (!seriesPosition) seriesPosition = text.replace(/^#\s*/, '');
          if (!seriesId) seriesId = id;
          continue;
        }
        if (!series) {
          const combined = text.match(/^(.*?)\s*#([0-9]+(?:[.,][0-9]+)?(?:\s*[-–]\s*[0-9]+(?:[.,][0-9]+)?)?)$/);
          series = combined ? cleanText(combined[1]) : text;
          if (combined && !seriesPosition) seriesPosition = combined[2].replace(/\s+/g, '');
          seriesId = id;
          try {
            seriesUrl = new URL(href, window.location.origin).toString();
          } catch (_) {
            seriesUrl = href;
          }
        }
      }
      if (series) return { series, seriesPosition, seriesId, seriesUrl };
    }
    return empty;
  }

  function extractBookMetadata(card, cardText, sourceStatus = '') {
    const text = cleanText(cardText || card?.textContent || '');
    const pagesMatch = text.match(/(\d[\d.,]*)\s*(?:pages|páginas|paginas)/i);
    const summaryMatch = text.match(
      /(\d[\d.,]*)\s*(?:pages|páginas|paginas)\s*[•·|]\s*([^•·|]+?)\s*[•·|]\s*(?:first pub\s*)?(\d{4})\b/i,
    );
    const formatName = labeledValue(text, 'Format') || cleanText(summaryMatch?.[2] || '');
    const languageName = labeledValue(text, 'Language');
    const originalPublicationYear = parseNumber(labeledValue(text, 'Original Pub Year'))
      || parseNumber(summaryMatch?.[3])
      || parseNumber(text.match(/\bfirst pub(?:lished)?\s+(\d{4})\b/i)?.[1]);
    const publishDate = parsePublishDateValue(
      labeledValue(text, 'Edition Pub Date'),
      originalPublicationYear ? String(Math.round(originalPublicationYear)) : '',
      text,
    );
    const seriesInfo = extractSeriesInfo(card);

    return {
      language: normalizeLanguageCode(languageName),
      languageName,
      format: normalizeBookFormat(formatName),
      formatName,
      // El resumen «N pages • formato • año» es el total de la edición; tiene
      // prioridad sobre cualquier otra mención de páginas dentro de la tarjeta.
      pageCount: parseNumber(summaryMatch?.[1] || pagesMatch?.[1]),
      publishDate,
      originalPublicationYear: originalPublicationYear ? Math.round(originalPublicationYear) : null,
      status: sourceStatus || '',
      rating: extractUserRating(card, text),
      ...seriesInfo,
    };
  }

  function mergeBookStatus(previousStatus, candidateStatus) {
    if (!previousStatus) return candidateStatus || '';
    if (previousStatus === 'pending' && candidateStatus && candidateStatus !== 'pending') return candidateStatus;
    return previousStatus;
  }

  function metaImageUrl(doc, pageUrl) {
    const selectors = [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'link[rel="image_src"]',
    ];
    for (const selector of selectors) {
      const element = doc.querySelector?.(selector);
      const raw = element?.getAttribute?.('content') || element?.getAttribute?.('href') || '';
      const url = absoluteHttpUrl(raw, pageUrl);
      if (url && isLikelyCoverUrl(url)) return url;
    }
    return '';
  }

  function coverFromBookPage(doc, pageUrl, book) {
    const panes = [...(doc.querySelectorAll?.('.book-pane') || [])]
      .filter((pane) => {
        const paneId = pane.dataset?.bookId || pane.getAttribute?.('data-book-id') || '';
        return !paneId || paneId === book.storyGraphId;
      });
    for (const pane of panes) {
      const candidate = findCoverImage(pane, null, pageUrl, book.storyGraphId);
      if (candidate.url) return { ...candidate, source: 'book-page' };
    }

    const linked = collectLinkedCoverUrls(doc, pageUrl).get(book.storyGraphId);
    if (linked?.url) return { ...linked, source: 'book-page' };

    const normalizedTitle = String(book.title || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const images = [...(doc.querySelectorAll?.('img') || [])];
    for (const image of images) {
      const alt = String(image.getAttribute?.('alt') || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!normalizedTitle || !alt.startsWith(normalizedTitle)) continue;
      const url = imageUrlFromElement(image, pageUrl);
      if (url) return { image, url, source: 'book-page' };
    }

    const metaUrl = metaImageUrl(doc, pageUrl);
    if (metaUrl) {
      try {
        const hostname = new URL(metaUrl).hostname;
        if (hostname === 'cdn.thestorygraph.com') return { image: null, url: metaUrl, source: 'book-page' };
      } catch (_) {
        // Si no es una URL válida ya se descartó en metaImageUrl.
      }
    }

    for (const image of images) {
      const url = imageUrlFromElement(image, pageUrl);
      if (!url) continue;
      try {
        if (new URL(url).hostname === 'cdn.thestorygraph.com') {
          return { image, url, source: 'book-page' };
        }
      } catch (_) {
        // Se sigue buscando una imagen válida.
      }
    }

    return { image: null, url: '', source: '' };
  }

  function metadataFromBookPage(doc, book) {
    const panes = [...(doc.querySelectorAll?.('.book-pane') || [])]
      .filter((pane) => {
        const paneId = pane.dataset?.bookId || pane.getAttribute?.('data-book-id') || '';
        return !paneId || paneId === book.storyGraphId;
      });

    let combined = extractBookMetadata(null, '', book.status || '');
    const mergeMissing = (candidate) => {
      combined = {
        language: combined.language || candidate.language,
        languageName: combined.languageName || candidate.languageName,
        format: combined.format || candidate.format,
        formatName: combined.formatName || candidate.formatName,
        pageCount: combined.pageCount || candidate.pageCount,
        publishDate: combined.publishDate || candidate.publishDate,
        originalPublicationYear: combined.originalPublicationYear || candidate.originalPublicationYear,
        status: mergeBookStatus(combined.status, candidate.status),
        rating: combined.rating ?? candidate.rating,
        series: combined.series || candidate.series,
        seriesPosition: combined.seriesPosition || candidate.seriesPosition,
        seriesId: combined.seriesId || candidate.seriesId,
        seriesUrl: combined.seriesUrl || candidate.seriesUrl,
      };
    };

    for (const pane of panes) mergeMissing(extractBookMetadata(pane, pane.textContent || '', book.status || ''));

    if (!combined.language || !combined.format || !combined.pageCount || !combined.publishDate) {
      const title = cleanText(book.title || '').toLocaleLowerCase('en');
      const scope = [...(doc.querySelectorAll?.('.book-title-author-and-series') || [])]
        .find((element) => !title || cleanText(element.textContent || '').toLocaleLowerCase('en').includes(title));
      let card = scope || null;
      for (let depth = 0; card?.parentElement && depth < 8; depth++) {
        const text = card.textContent || '';
        if (/ISBN\/UID:/i.test(text) || (/\bFormat:/i.test(text) && /\bLanguage:/i.test(text))) break;
        card = card.parentElement;
      }
      if (card) mergeMissing(extractBookMetadata(card, card.textContent || '', book.status || ''));
    }

    return combined;
  }

  function refreshCoverDiagnostics(books = [...state.books.values()]) {
    state.diagnostics.booksWithCovers = books.filter((book) => book.coverUrl).length;
    state.diagnostics.booksWithoutCovers = books.length - state.diagnostics.booksWithCovers;
    state.diagnostics.coversFromBookPanes = books.filter((book) => book.coverSource === 'book-pane').length;
    state.diagnostics.coversFromLinkedImages = books.filter((book) => book.coverSource === 'linked-image').length;
    state.diagnostics.coversFromBookPages = books.filter((book) => book.coverSource === 'book-page').length;
    state.diagnostics.booksWithLanguage = books.filter((book) => book.language).length;
    state.diagnostics.booksWithFormat = books.filter((book) => book.format).length;
    state.diagnostics.booksWithPages = books.filter((book) => book.pageCount).length;
    state.diagnostics.booksWithPublishDate = books.filter((book) => book.publishDate).length;
    state.diagnostics.booksWithStatus = books.filter((book) => book.status).length;
    state.diagnostics.booksWithRating = books.filter((book) => book.rating !== null && book.rating !== undefined && book.rating > 0).length;
    state.diagnostics.booksInSeries = books.filter((book) => book.series).length;
  }

  async function fillMissingMetadataFromBookPages(books) {
    const missing = books.filter((book) => (
      !book.coverUrl
      || !book.isbn
      || !book.pageCount
      || !book.language
      || !book.format
      || !book.publishDate
    ));
    if (!missing.length) return;

    logLine(`Buscando en la ficha individual la portada o datos que faltan de ${missing.length} libros…`);
    let foundCovers = 0;
    let completed = 0;
    for (const book of missing) {
      if (state.cancelled) throw cancellationError();
      completed += 1;
      setStatus(`Completando datos ${completed} de ${missing.length}: ${book.title}`);
      const url = new URL(`/books/${book.storyGraphId}`, window.location.origin);
      try {
        const doc = await fetchDocument(url);
        let changed = false;

        if (!book.coverUrl) {
          const cover = coverFromBookPage(doc, url, book);
          if (cover.url) {
            book.coverUrl = cover.url;
            book.coverSource = 'book-page';
            foundCovers += 1;
            changed = true;
          }
        }

        const metadata = metadataFromBookPage(doc, book);
        const assignIfMissing = (field, value) => {
          if (!book[field] && value) {
            book[field] = value;
            changed = true;
          }
        };
        assignIfMissing('language', metadata.language);
        assignIfMissing('languageName', metadata.languageName);
        assignIfMissing('format', metadata.format);
        assignIfMissing('formatName', metadata.formatName);
        assignIfMissing('pageCount', metadata.pageCount);
        assignIfMissing('publishDate', metadata.publishDate);
        assignIfMissing('originalPublicationYear', metadata.originalPublicationYear);
        assignIfMissing('series', metadata.series);
        assignIfMissing('seriesPosition', metadata.seriesPosition);
        assignIfMissing('seriesId', metadata.seriesId);
        assignIfMissing('seriesUrl', metadata.seriesUrl);
        if ((book.rating === null || book.rating === undefined) && metadata.rating !== null) {
          book.rating = metadata.rating;
          changed = true;
        }

        const cardText = cleanText(doc.body?.textContent || '');
        if (!book.isbn) {
          const isbn = cleanIsbn(cardText.match(/ISBN\/UID:\s*([^A-Za-z0-9]*[A-Za-z0-9][A-Za-z0-9-]*)/i)?.[1] || '');
          if (isbn) {
            book.isbn = isbn;
            changed = true;
          }
        }

        if (changed) {
          state.books.set(book.storyGraphId, book);
          state.diagnostics.metadataFromBookPages += 1;
        }
      } catch (error) {
        if (isCancellation(error)) throw error;
        if (completed <= 5) {
          logLine(`⚠️ No se pudo leer la ficha de “${book.title}” para completar sus datos: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (completed % 10 === 0 || completed === missing.length) {
        logLine(`Fichas revisadas: ${completed}/${missing.length} · ${foundCovers} portadas recuperadas…`);
      }
    }
    refreshCoverDiagnostics(books);
  }

  function parseBookList(doc, pageUrl, sourceStatus = '') {
    // StoryGraph renderiza cada resultado dentro de un `.book-pane` con
    // `data-book-id`; la portada está en `.book-cover img`, normalmente como
    // imagen enlazada a `/books/{id}`. Esta es la vía principal y no depende
    // de adivinar ancestros desde el enlace del título.
    const linkedCovers = collectLinkedCoverUrls(doc, pageUrl);
    state.diagnostics.coverImagesSeen += linkedCovers.size;

    const panes = [...doc.querySelectorAll('.book-pane')];
    state.diagnostics.bookPanesSeen += panes.length;
    if (panes.length) {
      let parsedPanes = 0;
      for (const pane of panes) {
        if (upsertBookFromPane(pane, pageUrl, linkedCovers, sourceStatus)) parsedPanes += 1;
      }
      if (parsedPanes) return;
    }

    const headings = [...doc.querySelectorAll('h3 a[href^="/books/"]')];
    if (headings.length) {
      for (const anchor of headings) upsertBookFromAnchor(anchor, pageUrl, linkedCovers, sourceStatus);
      return;
    }

    // Respaldo para variantes de listado sin paneles ni encabezados h3.
    const main = doc.querySelector('main') || doc.body;
    for (const anchor of main?.querySelectorAll('a[href^="/books/"]') || []) {
      upsertBookFromAnchor(anchor, pageUrl, linkedCovers, sourceStatus);
    }
  }

  function upsertBookFromPane(pane, pageUrl, linkedCovers, sourceStatus = '') {
    const titleAnchor = pane.querySelector('.book-title-author-and-series a[href^="/books/"]')
      || pane.querySelector('h3 a[href^="/books/"]')
      || pane.querySelector('.book-cover a[href^="/books/"]')
      || pane.querySelector('a[href^="/books/"]');
    const paneId = pane.dataset?.bookId || pane.getAttribute?.('data-book-id') || '';
    const id = UUID_RE.test(paneId)
      ? paneId
      : extractStoryGraphBookId(titleAnchor?.getAttribute?.('href') || '');
    if (!id) return false;

    return upsertBookFromCard(id, pane, titleAnchor || pane, pageUrl, linkedCovers?.get(id), sourceStatus);
  }

  function upsertBookFromAnchor(anchor, pageUrl, linkedCovers, sourceStatus = '') {
    const id = extractStoryGraphBookId(anchor.getAttribute('href') || '');
    if (!id) return;

    const card = anchor.closest?.('.book-pane') || findBookCard(anchor);
    upsertBookFromCard(id, card, anchor, pageUrl, linkedCovers?.get(id), sourceStatus);
  }

  function upsertBookFromCard(id, card, anchor, pageUrl, linkedCover, sourceStatus = '') {
    const cardText = cleanText(card?.textContent || anchor?.textContent || '');
    let cover = findCoverImage(card, anchor, pageUrl, id);
    if (linkedCover?.url && (!cover.url || cover.source === 'image')) {
      cover = linkedCover;
    }

    const image = cover.image || card?.querySelector?.('img');
    const alt = cleanText(image?.getAttribute('alt') || '');
    let title = cleanText(anchor?.textContent || '');
    let authorFromAlt = '';
    if (alt) {
      const parts = alt.split(/\s+by\s+/i);
      if (!title) title = cleanText(parts[0] || '');
      authorFromAlt = cleanText(parts.slice(1).join(' by ') || '');
    }
    if (!title) title = id;

    const authors = [];
    if (card?.querySelectorAll) {
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
    const metadata = extractBookMetadata(card, cardText, sourceStatus);
    const bookPages = metadata.pageCount;

    const previous = state.books.get(id);
    const book = {
      storyGraphId: id,
      title: previous?.title && previous.title !== id ? previous.title : title,
      author: previous?.author || authors.join(', '),
      isbn: previous?.isbn || isbn,
      coverUrl: previous?.coverUrl || cover.url,
      coverSource: previous?.coverUrl ? (previous.coverSource || '') : (cover.source || ''),
      pageCount: previous?.pageCount || bookPages,
      language: previous?.language || metadata.language,
      languageName: previous?.languageName || metadata.languageName,
      format: previous?.format || metadata.format,
      formatName: previous?.formatName || metadata.formatName,
      publishDate: previous?.publishDate || metadata.publishDate,
      originalPublicationYear: previous?.originalPublicationYear || metadata.originalPublicationYear,
      status: mergeBookStatus(previous?.status, metadata.status),
      rating: previous?.rating ?? metadata.rating,
      series: previous?.series || metadata.series,
      seriesPosition: previous?.seriesPosition || metadata.seriesPosition,
      seriesId: previous?.seriesId || metadata.seriesId,
      seriesUrl: previous?.seriesUrl || metadata.seriesUrl,
      storyGraphUrl: new URL(`/books/${id}`, pageUrl.origin).toString(),
    };
    state.books.set(id, book);
    return true;
  }

  function findBookCard(anchor) {
    const pane = anchor.closest?.('.book-pane');
    if (pane) return pane;

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
      language: book.language || '',
      languageName: book.languageName || '',
      format: book.format || '',
      formatName: book.formatName || '',
      publishDate: book.publishDate || '',
      originalPublicationYear: book.originalPublicationYear || null,
      status: book.status || '',
      rating: book.rating ?? null,
      series: book.series || '',
      seriesPosition: book.seriesPosition || '',
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
    const books = [...state.books.values()]
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    refreshCoverDiagnostics(books);
    const booksById = new Map(books.map((book) => [book.storyGraphId, book]));

    // La portada y los metadatos canónicos son los del objeto libro al terminar
    // la extracción. Se copian también a cada entrada por si se recuperaron
    // después de leer el diario o si Bilibook importa el CSV.
    const entries = [...state.entries.values()]
      .map((entry) => {
        const finalBook = booksById.get(entry.storyGraphId);
        return {
          ...entry,
          coverUrl: finalBook?.coverUrl || entry.coverUrl || '',
          language: finalBook?.language || entry.language || '',
          languageName: finalBook?.languageName || entry.languageName || '',
          format: finalBook?.format || entry.format || '',
          formatName: finalBook?.formatName || entry.formatName || '',
          publishDate: finalBook?.publishDate || entry.publishDate || '',
          originalPublicationYear: finalBook?.originalPublicationYear || entry.originalPublicationYear || null,
          status: finalBook?.status || entry.status || '',
          rating: finalBook?.rating ?? entry.rating ?? null,
          series: finalBook?.series || entry.series || '',
          seriesPosition: finalBook?.seriesPosition || entry.seriesPosition || '',
          bookPages: entry.bookPages || finalBook?.pageCount || null,
          note: includeNotes ? entry.note : '',
        };
      })
      .sort((a, b) => (
        a.date.localeCompare(b.date)
        || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        || (a.pagesTotal || 0) - (b.pagesTotal || 0)
        || String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: 'base' })
      ));

    return {
      format: 'read-nook-storygraph-journal',
      version: 2,
      extractorVersion: EXTRACTOR_VERSION,
      diagnostics: { ...state.diagnostics },
      exportedAt,
      username: els.username.value.trim().replace(/^@/, ''),
      books,
      entries,
    };
  }

  function toCsv(entries) {
    const headers = [
      'date', 'storygraph_book_id', 'isbn', 'title', 'author', 'cover_url',
      'language', 'format', 'publish_date', 'read_status', 'rating', 'series', 'series_position',
      'entry_id', 'pages_read', 'pages_total', 'book_pages', 'percent',
      'minutes_listened', 'minutes_total', 'kind', 'note',
    ];
    const rows = entries.map((entry) => [
      entry.date,
      entry.storyGraphId,
      entry.isbn,
      entry.title,
      entry.author,
      entry.coverUrl || '',
      entry.language || '',
      entry.format || '',
      entry.publishDate || '',
      entry.status || '',
      entry.rating ?? '',
      entry.series || '',
      entry.seriesPosition || '',
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
