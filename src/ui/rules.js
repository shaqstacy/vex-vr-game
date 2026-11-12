// In-game Rule Book viewer for the 2026-27 V5RC game "Override".
//
// Public API
//   mountRules(el, ctx)   render the viewer into `el`; returns { showRule, search, openTab, destroy }
//   searchRules(query)    -> [{ id, title, section, snippet, score }]  (ranked; used by tutor / VR menu)
//   showRule(id)          deep-link to one item (works before mount: it is queued)
//   getRule(id)           -> rule object or null
//   searchManual(query)   -> Promise<[{ page, snippet, count }]> full-text hits in the imported PDF
//   RULES, SECTIONS       data re-exported from rulesData.js
//
// Persistence
//   store 'rules:bookmarks'  array of rule ids
//   store 'rules:recent'     array of rule ids, newest first
//   store 'rules:quizBest'   best quiz score (0-10)
//   store 'rules:pdf'        { name, size, pages, headings, importedAt } for the imported PDF
//   IndexedDB 'vexvr-rules'  stores: 'pages' ({ page, text, headings }), 'files' (key 'manual' -> ArrayBuffer)

import { store, bus, h, esc } from '../store.js';
import { RULES, SECTIONS, QUIZ_FACTS, POPULAR_SEARCHES, MANUAL_VERSION, OFFICIAL_LINKS } from './rulesData.js';

export { RULES, SECTIONS };

const K_BOOKMARKS = 'rules:bookmarks';
const K_RECENT = 'rules:recent';
const K_QUIZ_BEST = 'rules:quizBest';
const K_PDF = 'rules:pdf';
const RECENT_MAX = 12;
const QUIZ_LEN = 10;

const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));
const RULE_BY_KEY = new Map(RULES.map((r) => [r.id.toLowerCase(), r]));
const SEVERITY = {
  safety: { label: 'Safety', cls: 'red' },
  major: { label: 'High-risk', cls: 'yellow' },
  minor: { label: 'Watch out', cls: 'blue' },
};
const HEADING_RE = /^<\s*((?:RSC|VUG|VUR|SC|SG|GG|G|S|R|T)\d+[a-z]?)\s*>\s*(.*)$/;

// ───────────────────────────────── helpers ─────────────────────────────────
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const normId = (id) => String(id || '').replace(/[<>\s]/g, '').toLowerCase();

export function getRule(id) {
  return RULE_BY_KEY.get(normId(id)) || null;
}

const STOP = new Set(('the a an of is are in on to for and or how many what when can i my do does it be with rule rules about much ' +
  'which you your we our if at that this may am get there their they').split(' '));

function tokenize(query) {
  const raw = String(query || '').toLowerCase().replace(/[<>]/g, ' ').split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
  const kept = raw.filter((t) => !STOP.has(t));
  const list = kept.length ? kept : raw;
  const out = [];
  for (let t of list) {
    if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !/\d/.test(t)) t = t.slice(0, -1);
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// Regex that matches a token at the start of a word (single characters must match a whole word).
function tokenRe(tok, flags = 'g') {
  return new RegExp('(?<![a-z0-9])' + reEsc(tok) + (tok.length < 2 ? '(?![a-z0-9])' : ''), flags);
}

function highlightRe(tokens) {
  if (!tokens || !tokens.length) return null;
  const parts = tokens.slice().sort((a, b) => b.length - a.length)
    .map((t) => reEsc(t) + (t.length < 2 ? '(?![a-z0-9])' : '[a-z0-9]*'));
  return new RegExp('(?<![a-z0-9])(?:' + parts.join('|') + ')', 'gi');
}

function hl(text, tokens) {
  const re = highlightRe(tokens);
  text = String(text);
  if (!re) return esc(text);
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

const ID_LINK_RE = new RegExp('(?<![\\w-])(' + RULES.map((r) => r.id).sort((a, b) => b.length - a.length).map(reEsc).join('|') + ')(?![\\w-])', 'g');

// Escape text, highlight search tokens and turn rule ids into deep links.
function richText(text, tokens, selfId) {
  text = String(text);
  let out = '';
  let last = 0;
  let m;
  ID_LINK_RE.lastIndex = 0;
  while ((m = ID_LINK_RE.exec(text))) {
    if (m[1] === selfId) continue;
    out += hl(text.slice(last, m.index), tokens);
    const r = getRule(m[1]);
    out += `<a href="#" class="rb-ref" data-rule="${esc(m[1])}" title="${esc(r ? r.title : '')}">${hl(m[1], tokens)}</a>`;
    last = m.index + m[1].length;
  }
  return out + hl(text.slice(last), tokens);
}

function makeSnippet(text, tokens, width = 170) {
  text = String(text).replace(/\s+/g, ' ').trim();
  const lc = text.toLowerCase();
  let pos = -1;
  for (const t of tokens) {
    const i = lc.search(tokenRe(t, ''));
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  if (pos < 0) pos = 0;
  let start = Math.max(0, pos - Math.floor(width * 0.35));
  let end = Math.min(text.length, start + width);
  if (start > 0) { const sp = text.indexOf(' ', start); if (sp >= 0 && sp < pos) start = sp + 1; }
  if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > pos) end = sp; }
  return (start > 0 ? '... ' : '') + text.slice(start, end) + (end < text.length ? ' ...' : '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// ────────────────────────────── search index ───────────────────────────────
let INDEX = null;
let VOCAB = null;
function bodyText(r) {
  const parts = [r.summary];
  if (r.points) parts.push(r.points.join(' '));
  if (r.example) parts.push(r.example);
  if (r.table) parts.push(r.table.head.join(' '), r.table.rows.map((row) => row.join(' ')).join(' '));
  return parts.join(' ');
}
function getIndex() {
  if (INDEX) return INDEX;
  INDEX = RULES.map((r) => ({
    rule: r,
    id: r.id.toLowerCase(),
    title: r.title.toLowerCase(),
    tags: (r.tags || []).map((t) => t.toLowerCase()),
    tagText: (r.tags || []).join(' | ').toLowerCase(),
    body: bodyText(r).toLowerCase(),
    plain: [r.summary, (r.points || []).join(' '), r.example || ''].join(' '),
  }));
  return INDEX;
}
function getVocab() {
  if (VOCAB) return VOCAB;
  const set = new Set();
  for (const e of getIndex()) {
    for (const w of (e.title + ' ' + e.tagText).split(/[^a-z0-9]+/)) if (w.length >= 4 && !STOP.has(w)) set.add(w);
  }
  VOCAB = [...set];
  return VOCAB;
}

function scoreEntry(e, tokens, qNorm, phrase) {
  let score = 0;
  let matched = 0;
  for (const t of tokens) {
    let s = 0;
    if (e.id === t) s += 300;
    else if (t.length >= 2 && e.id.startsWith(t)) s += 120;
    else if (t.length >= 3 && e.id.split('-').some((p) => p.startsWith(t))) s += 60;
    if (tokenRe(t, '').test(e.title)) {
      s += 50;
      if (new RegExp('(?<![a-z0-9])' + reEsc(t) + '(?![a-z0-9])').test(e.title)) s += 20;
    }
    if (e.tags.includes(t)) s += 35;
    else if (tokenRe(t, '').test(e.tagText)) s += 25;
    const hits = e.body.match(tokenRe(t));
    if (hits) s += Math.min(hits.length, 5) * 6;
    else if (t.length >= 3 && e.body.includes(t)) s += 2;
    if (s > 0) matched++;
    score += s;
  }
  if (qNorm && e.id === qNorm) score += 1000;
  if (phrase && phrase.includes(' ')) {
    if (e.title.includes(phrase)) score += 80;
    if (e.tags.includes(phrase)) score += 60;
    if (e.body.includes(phrase)) score += 20;
  }
  return { score, matched };
}

/**
 * Keyword search over the paraphrased rule summaries.
 * Ranking: exact id > title > tags > body. Multi-word queries must match every
 * word (falls back to "any word" when nothing matches them all).
 * @returns {{id:string,title:string,section:string,snippet:string,score:number}[]}
 */
export function searchRules(query, opts = {}) {
  const tokens = tokenize(query);
  const qNorm = normId(query);
  if (!tokens.length && !qNorm) return [];
  const phrase = String(query || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const scored = getIndex().map((e) => ({ e, ...scoreEntry(e, tokens, qNorm, phrase) })).filter((x) => x.score > 0);
  let hits = scored.filter((x) => x.matched === tokens.length || x.e.id === qNorm);
  if (!hits.length) hits = scored.map((x) => ({ ...x, score: x.score * (x.matched / Math.max(1, tokens.length)) * 0.5 }));
  hits.sort((a, b) => b.score - a.score || RULES.indexOf(a.e.rule) - RULES.indexOf(b.e.rule));
  const limit = opts.limit || hits.length;
  return hits.slice(0, limit).map(({ e, score }) => ({
    id: e.rule.id,
    title: e.rule.title,
    section: (SECTION_BY_ID.get(e.rule.section) || {}).title || e.rule.section,
    snippet: makeSnippet(e.plain, tokens),
    score: Math.round(score),
  }));
}

function suggestTerms(query) {
  const out = [];
  for (const t of tokenize(query)) {
    if (t.length < 3) continue;
    const max = t.length <= 4 ? 1 : 2;
    getVocab().map((w) => ({ w, d: levenshtein(t, w.slice(0, Math.max(t.length, Math.min(w.length, t.length + 1)))) }))
      .filter((x) => x.d <= max).sort((a, b) => a.d - b.d).slice(0, 3)
      .forEach((x) => { if (!out.includes(x.w)) out.push(x.w); });
  }
  return out.slice(0, 5);
}

// ───────────────────────── imported PDF (IndexedDB) ────────────────────────
const DB_NAME = 'vexvr-rules';
const manual = { loaded: null, pages: [], headings: [], doc: null, docPromise: null, memoryFile: null };

function idbOpen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available in this browser')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pages')) db.createObjectStore('pages', { keyPath: 'page' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open IndexedDB'));
  });
}
async function idbRun(stores, mode, fn) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      result = fn(tx);
    });
  } finally {
    db.close();
  }
}
const reqValue = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

function setManualPages(pages) {
  manual.pages = pages.slice().sort((a, b) => a.page - b.page).map((p) => ({ ...p, lc: p.text.toLowerCase() }));
  manual.headings = [];
  for (const p of manual.pages) for (const hd of p.headings || []) manual.headings.push({ ...hd, page: p.page });
}

function loadManualPages() {
  if (manual.loaded) return manual.loaded;
  manual.loaded = (async () => {
    if (!store.get(K_PDF)) return;
    try {
      let pages;
      await idbRun(['pages'], 'readonly', (tx) => { reqValue(tx.objectStore('pages').getAll()).then((v) => { pages = v; }); });
      if (pages && pages.length) setManualPages(pages);
      else store.remove(K_PDF); // meta without data (site data was cleared)
    } catch (e) {
      console.warn('Rule Book: could not read the imported manual', e);
    }
  })();
  return manual.loaded;
}

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    }).catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

function itemsToLines(items) {
  const lines = [];
  let cur = '';
  let lastY = null;
  let lastEnd = null;
  for (const it of items) {
    if (typeof it.str !== 'string') continue;
    const x = it.transform ? it.transform[4] : 0;
    const y = it.transform ? it.transform[5] : 0;
    if (lastY !== null && Math.abs(y - lastY) > Math.max(2, (it.height || 0) * 0.5) && cur.trim()) {
      lines.push(cur); cur = ''; lastEnd = null;
    }
    if (cur && lastEnd !== null && x - lastEnd > 1.5 && !cur.endsWith(' ') && !it.str.startsWith(' ')) cur += ' ';
    cur += it.str;
    if (it.str) { lastY = y; lastEnd = x + (it.width || 0); }
    if (it.hasEOL) { lines.push(cur); cur = ''; lastEnd = null; }
  }
  if (cur.trim()) lines.push(cur);
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function detectHeadings(lines) {
  const out = [];
  for (const line of lines) {
    const m = HEADING_RE.exec(line);
    if (m && !out.some((x) => x.id === m[1])) out.push({ id: m[1], title: m[2].slice(0, 120) });
  }
  return out;
}

async function importPdf(file, onProgress) {
  const buf = await file.arrayBuffer();
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines = itemsToLines(content.items);
    pages.push({ page: n, text: lines.join('\n'), headings: detectHeadings(lines) });
    page.cleanup();
    if (onProgress) onProgress(n, doc.numPages);
  }
  let persisted = true;
  try {
    await idbRun(['pages', 'files'], 'readwrite', (tx) => {
      const ps = tx.objectStore('pages');
      ps.clear();
      for (const p of pages) ps.put(p);
      tx.objectStore('files').put(buf, 'manual');
    });
  } catch (e) {
    persisted = false;
    console.warn('Rule Book: could not save the manual to IndexedDB (it will work until you reload)', e);
  }
  if (manual.doc && manual.doc !== doc) { try { manual.doc.destroy(); } catch { /* ignore */ } }
  manual.doc = doc;
  manual.docPromise = Promise.resolve(doc);
  manual.memoryFile = buf;
  manual.loaded = Promise.resolve();
  setManualPages(pages);
  const meta = { name: file.name, size: file.size, pages: pages.length, headings: manual.headings.length, importedAt: Date.now(), persisted };
  store.set(K_PDF, meta);
  return meta;
}

async function removePdf() {
  try {
    await idbRun(['pages', 'files'], 'readwrite', (tx) => { tx.objectStore('pages').clear(); tx.objectStore('files').clear(); });
  } catch (e) { console.warn('Rule Book: could not clear IndexedDB', e); }
  if (manual.doc) { try { manual.doc.destroy(); } catch { /* ignore */ } }
  manual.doc = null; manual.docPromise = null; manual.memoryFile = null; manual.pages = []; manual.headings = [];
  manual.loaded = Promise.resolve();
  store.remove(K_PDF);
}

function getPdfDoc() {
  if (manual.docPromise) return manual.docPromise;
  manual.docPromise = (async () => {
    let buf = manual.memoryFile;
    if (!buf) await idbRun(['files'], 'readonly', (tx) => { reqValue(tx.objectStore('files').get('manual')).then((v) => { buf = v; }); });
    if (!buf) throw new Error('The PDF file is no longer stored in this browser. Please import it again.');
    const lib = await loadPdfjs();
    manual.doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    return manual.doc;
  })().catch((e) => { manual.docPromise = null; throw e; });
  return manual.docPromise;
}

function searchManualSync(query) {
  const tokens = tokenize(query);
  const qNorm = normId(query);
  if (!tokens.length) return [];
  const res = [];
  const collect = (needAll) => {
    for (const p of manual.pages) {
      let count = 0;
      let matched = 0;
      const positions = [];
      for (const t of tokens) {
        const re = tokenRe(t);
        let m;
        let c = 0;
        while ((m = re.exec(p.lc))) { c++; if (positions.length < 40) positions.push(m.index); }
        if (c) matched++;
        count += c;
      }
      if (!count || (needAll && matched < tokens.length)) continue;
      positions.sort((a, b) => a - b);
      const flat = p.text.replace(/\n/g, ' ');
      const snippets = [];
      let lastEnd = -1;
      for (const pos of positions) {
        if (pos < lastEnd || snippets.length >= 3) continue;
        const start = Math.max(0, pos - 60);
        const end = Math.min(flat.length, pos + 120);
        snippets.push((start > 0 ? '... ' : '') + flat.slice(start, end).trim() + (end < flat.length ? ' ...' : ''));
        lastEnd = end;
      }
      const isHeading = (p.headings || []).some((x) => x.id.toLowerCase() === qNorm);
      res.push({ page: p.page, count, snippet: snippets[0] || '', snippets, score: count + matched * 5 + (isHeading ? 1000 : 0), isHeading });
    }
  };
  collect(true);
  if (!res.length && tokens.length > 1) collect(false);
  res.sort((a, b) => b.score - a.score || a.page - b.page);
  return res;
}

/** Full-text search of the imported official PDF (empty array when none is imported). */
export async function searchManual(query) {
  await loadManualPages();
  return searchManualSync(query).map(({ page, snippet, count }) => ({ page, snippet, count }));
}

// ────────────────────────────────── quiz ───────────────────────────────────
function buildQuiz() {
  const facts = shuffle(QUIZ_FACTS);
  const qs = [];
  const usedRules = new Set();
  for (const f of facts) {
    if (qs.length >= QUIZ_LEN - 2) break;
    if (usedRules.has(f.rule) && Math.random() < 0.6) continue;
    usedRules.add(f.rule);
    qs.push({ q: f.q, choices: shuffle([f.a, ...f.wrong]), answer: f.a, rule: f.rule, why: f.why });
  }
  // "What is rule X about?" questions generated from the officially numbered rules.
  const numbered = RULES.filter((r) => /^(SC|SG|S)\d+$/.test(r.id));
  for (const r of shuffle(numbered)) {
    if (qs.length >= QUIZ_LEN) break;
    const others = shuffle(numbered.filter((o) => o.id !== r.id && o.section === r.section)).slice(0, 3);
    if (others.length < 3) continue;
    qs.push({
      q: `What is rule ${r.id} about?`,
      choices: shuffle([r.title, ...others.map((o) => o.title)]),
      answer: r.title, rule: r.id, why: `${r.id} is "${r.title}".`,
    });
  }
  for (const f of facts) { // top up if the bank filter skipped too many
    if (qs.length >= QUIZ_LEN) break;
    if (qs.some((x) => x.q === f.q)) continue;
    qs.push({ q: f.q, choices: shuffle([f.a, ...f.wrong]), answer: f.a, rule: f.rule, why: f.why });
  }
  return { qs: shuffle(qs).slice(0, QUIZ_LEN), i: 0, picked: null, score: 0, wrong: [], done: false };
}

// ─────────────────────────────────── CSS ───────────────────────────────────
const CSS = `
.rb-root { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; }
.rb-root .panel-head { gap: 8px; }
.rb-tabs { display: flex; gap: 4px; }
.rb-search { flex: 1 1 160px; min-width: 120px; }
.rb-banner { padding: 6px 14px; background: #f2c2301f; border-bottom: 1px solid #f2c23055; font-size: 12px; line-height: 1.5; color: var(--text); }
.rb-banner b { color: #f7da7c; }
.rb-body { flex: 1; min-height: 0; display: flex; }
.rb-tree { width: 216px; flex: 0 0 216px; border-right: 1px solid var(--border); overflow: auto; padding: 8px; }
.rb-main { flex: 1; min-width: 0; overflow: auto; padding: 14px; }
.rb-item { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; background: none; border: 0; border-radius: 6px; padding: 5px 8px; cursor: pointer; color: var(--text); font-size: 13px; line-height: 1.3; }
.rb-item:hover { background: var(--panel2); }
.rb-item.active { background: var(--panel2); box-shadow: inset 3px 0 0 var(--accent); }
.rb-item .rb-grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rb-item .rb-count { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.rb-item.rb-sub { font-size: 12px; padding: 3px 8px 3px 14px; color: var(--muted); }
.rb-item.rb-sub:hover { color: var(--text); }
.rb-tree h4 { margin: 12px 8px 4px; font-size: 11px; }
.rb-tree h4:first-child { margin-top: 2px; }
.rb-card { margin-bottom: 10px; }
.rb-card-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.rb-card-head h3 { margin: 0; flex: 1; min-width: 0; line-height: 1.35; }
.rb-card-head h3 a { color: inherit; text-decoration: none; cursor: pointer; }
.rb-card-head h3 a:hover { color: var(--accent); }
.rb-id { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 5px; background: var(--accent); color: #fff; white-space: nowrap; }
.rb-star { background: none; border: 0; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 2px; color: var(--muted); }
.rb-star:hover, .rb-star.on { color: var(--yellow); }
.rb-card ul { margin: 0 0 8px; padding-left: 20px; line-height: 1.5; }
.rb-card li { margin-bottom: 3px; }
.rb-card table { margin: 0 0 8px; font-size: 13px; }
.rb-example { border-left: 3px solid var(--green); background: #35b36b14; padding: 6px 10px; border-radius: 0 6px 6px 0; margin: 0 0 8px; line-height: 1.5; }
.rb-example b { color: #8fe0b3; }
.rb-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.rb-ref { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: .92em; text-decoration: none; border-bottom: 1px dotted var(--accent); white-space: nowrap; }
.rb-chip { cursor: pointer; }
.rb-chip:hover { border-color: var(--accent); color: var(--text); }
.rb-hit { display: block; width: 100%; text-align: left; cursor: pointer; margin-bottom: 8px; color: inherit; font: inherit; }
.rb-hit:hover { border-color: var(--accent); }
.rb-hit p { margin: 4px 0 0; }
.rb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 8px; margin-bottom: 14px; }
.rb-tile { cursor: pointer; text-align: left; color: inherit; font: inherit; }
.rb-tile:hover { border-color: var(--accent); }
.rb-tile b { display: block; margin-bottom: 3px; }
.rb-crumbs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
.rb-quiz-choice { display: block; width: 100%; text-align: left; white-space: normal; margin-bottom: 6px; padding: 9px 12px; }
.rb-quiz-choice.rb-right { background: #35b36b33; border-color: var(--green); }
.rb-quiz-choice.rb-wrong { background: #e0453a33; border-color: var(--red); }
.rb-bar { height: 6px; border-radius: 3px; background: var(--panel); overflow: hidden; margin: 6px 0 12px; }
.rb-bar > i { display: block; height: 100%; background: var(--accent); transition: width .2s; }
.rb-pdf-tools { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.rb-pdf-tools input { width: 64px; text-align: center; }
.rb-canvas-wrap { overflow: auto; background: #0d1116; border: 1px solid var(--border); border-radius: 6px; padding: 8px; text-align: center; min-height: 120px; }
.rb-canvas-wrap canvas { background: #fff; max-width: none; box-shadow: 0 2px 10px #0008; }
.rb-pagetext { white-space: pre-wrap; line-height: 1.5; font-size: 13px; margin: 8px 0 0; }
.rb-drop { border: 2px dashed var(--border); border-radius: var(--radius); padding: 22px; text-align: center; }
.rb-drop.rb-over { border-color: var(--accent); background: #2f9be014; }
@media (max-width: 760px) { .rb-tree { width: 150px; flex-basis: 150px; } }
@media print { .rb-tree, .rb-root .panel-head { display: none !important; } .rb-main { overflow: visible; } }
`;
function injectCss() {
  if (document.getElementById('rb-style')) return;
  document.head.append(h('style', { id: 'rb-style', textContent: CSS }));
}

// ───────────────────────────── module-level API ────────────────────────────
let activeInstance = null;
let pendingRule = null;

/** Deep-link to a rule. Returns true when the id exists. Queued if the viewer is not mounted yet. */
export function showRule(id) {
  const rule = getRule(id);
  if (!rule) return false;
  if (activeInstance) activeInstance.showRule(rule.id);
  else pendingRule = rule.id;
  return true;
}
bus.on('rules:show', (id) => { showRule(id); });

// ───────────────────────────────── mount ───────────────────────────────────
export function mountRules(el, ctx = {}) {
  injectCss();
  const S = {
    tab: 'rules',                 // 'rules' | 'manual' | 'quiz'
    view: { type: 'home' },       // rules tab: home | section | rule | search | bookmarks | recent
    hist: [],
    q: '',
    mview: { type: 'home' },      // manual tab: home | page | search
    zoom: 1,
    quiz: null,
    importing: null,
    importError: null,
    renderSeq: 0,
    renderTask: null,
    destroyed: false,
  };

  const toast = (msg) => { if (typeof ctx.toast === 'function') ctx.toast(msg); else bus.emit('toast', msg); };
  const bookmarks = () => (store.get(K_BOOKMARKS, []) || []).filter((id) => getRule(id));
  const recent = () => (store.get(K_RECENT, []) || []).filter((id) => getRule(id));
  const pdfMeta = () => store.get(K_PDF);
  const hasManual = () => manual.pages.length > 0;

  // ── skeleton ──
  const tabBtns = {
    rules: h('button.btn.small', { type: 'button', onclick: () => setTab('rules'), title: 'Student-friendly rule summaries' }, 'Summaries'),
    manual: h('button.btn.small', { type: 'button', onclick: () => setTab('manual'), title: 'Read and search the official PDF you imported' }, 'Full manual'),
    quiz: h('button.btn.small', { type: 'button', onclick: () => setTab('quiz'), title: '10-question rules quiz' }, 'Quiz'),
  };
  const searchInput = h('input.rb-search', {
    type: 'search', placeholder: 'Search rules...', 'aria-label': 'Search the Rule Book', autocomplete: 'off', spellcheck: false,
    oninput: () => onSearchInput(),
    onkeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); jumpToFirstHit(); }
      else if (e.key === 'Escape' && searchInput.value) { e.stopPropagation(); searchInput.value = ''; onSearchInput(); }
    },
  });
  const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: { display: 'none' }, onchange: () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (f) startImport(f);
  } });
  const importBtn = h('button.btn.small', { type: 'button', onclick: () => fileInput.click(), title: 'Load the official Game Manual PDF from your computer' }, 'Import official PDF');
  const head = h('div.panel-head',
    h('h2', 'Rule Book'),
    h('div.rb-tabs', tabBtns.rules, tabBtns.manual, tabBtns.quiz),
    searchInput, importBtn, fileInput);
  const banner = h('div.rb-banner', { role: 'note' },
    h('b', `Paraphrased study summary of manual v${MANUAL_VERSION}`),
    ' — the official VEX V5 Override Game Manual is the only authority: ',
    OFFICIAL_LINKS.map((l, i) => [i ? ' · ' : '', h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.label)]));
  const tree = h('nav.rb-tree', { 'aria-label': 'Rule Book sections' });
  const main = h('div.rb-main');
  const root = h('div.rb-root', head, banner, h('div.rb-body', tree, main));
  el.replaceChildren(root);

  // delegated clicks for rule links inside rendered text
  root.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-rule]');
    if (a && root.contains(a)) { e.preventDefault(); openRule(a.getAttribute('data-rule')); }
  });

  // ── navigation ──
  function setTab(tab) {
    if (S.tab === tab && !(tab === 'quiz' && S.quiz && S.quiz.done)) { render(); return; }
    S.tab = tab;
    S.q = '';
    searchInput.value = '';
    if (tab === 'rules' && S.view.type === 'search') S.view = { type: 'home' };
    if (tab === 'manual' && S.mview.type === 'search') S.mview = { type: 'home' };
    if (tab === 'quiz' && !S.quiz) S.quiz = buildQuiz();
    render(true);
  }
  function go(view, push = true) {
    if (push && S.tab === 'rules' && S.view.type !== 'search') S.hist.push(S.view);
    if (S.hist.length > 40) S.hist.shift();
    S.tab = 'rules';
    S.view = view;
    render(true);
  }
  function back() {
    const prev = S.hist.pop();
    S.view = prev || { type: 'home' };
    S.tab = 'rules';
    if (S.view.type !== 'search') { S.q = ''; searchInput.value = ''; } else { S.q = S.view.q; searchInput.value = S.view.q; }
    render(true);
  }
  function openRule(id, tokens) {
    const rule = getRule(id);
    if (!rule) return false;
    const list = [rule.id, ...recent().filter((x) => x !== rule.id)].slice(0, RECENT_MAX);
    store.set(K_RECENT, list);
    if (S.tab === 'rules' && S.view.type === 'search') S.hist.push(S.view);
    go({ type: 'rule', id: rule.id, tokens: tokens || null }, !(S.tab === 'rules' && S.view.type === 'search'));
    bus.emit('rules:view', { id: rule.id, title: rule.title });
    return true;
  }
  function openPage(n, tokens) {
    const total = manual.pages.length || (pdfMeta() || {}).pages || 1;
    S.tab = 'manual';
    S.mview = { type: 'page', page: Math.max(1, Math.min(total, n | 0 || 1)), tokens: tokens || null };
    render(true);
  }
  function onSearchInput() {
    S.q = searchInput.value;
    const q = S.q.trim();
    if (S.tab === 'manual') {
      if (q) S.mview = { type: 'search', q };
      else if (S.mview.type === 'search') S.mview = { type: 'home' };
    } else {
      if (S.tab === 'quiz') S.tab = 'rules';
      if (q) {
        if (S.view.type !== 'search') S.hist.push(S.view);
        S.view = { type: 'search', q };
      } else if (S.view.type === 'search') {
        S.view = S.hist.pop() || { type: 'home' };
      }
    }
    render(true);
  }
  function jumpToFirstHit() {
    const q = searchInput.value.trim();
    if (!q) return;
    if (S.tab === 'manual') {
      const hits = searchManualSync(q);
      if (hits.length) openPage(hits[0].page, tokenize(q));
    } else {
      const hits = searchRules(q, { limit: 1 });
      if (hits.length) openRule(hits[0].id, tokenize(q));
    }
  }
  function runSearch(q) {
    searchInput.value = q;
    onSearchInput();
    searchInput.focus();
  }
  function toggleBookmark(id) {
    const list = bookmarks();
    const on = list.includes(id);
    store.set(K_BOOKMARKS, on ? list.filter((x) => x !== id) : [...list, id]);
    toast(on ? `Removed ${id} from bookmarks` : `Bookmarked ${id}`);
    render();
  }

  // ── rendering ──
  function render(scrollTop = false) {
    if (S.destroyed) return;
    for (const [k, b] of Object.entries(tabBtns)) b.classList.toggle('active', S.tab === k);
    searchInput.placeholder = S.tab === 'manual' ? 'Search the official PDF text...' : 'Search rules: toggle, possession, SG6 ...';
    importBtn.textContent = pdfMeta() ? 'Replace PDF' : 'Import official PDF';
    renderTree();
    cancelPageRender();
    main.replaceChildren();
    if (S.tab === 'quiz') renderQuiz();
    else if (S.tab === 'manual') renderManual();
    else renderRulesView();
    if (scrollTop) main.scrollTop = 0;
  }

  function treeItem(label, count, active, onclick, sub = false, title = '') {
    return h('button.rb-item' + (sub ? '.rb-sub' : '') + (active ? '.active' : ''), { type: 'button', onclick, title: title || label },
      h('span.rb-grow', label), count != null ? h('span.rb-count', count) : null);
  }

  function renderTree() {
    tree.replaceChildren();
    if (S.tab === 'manual' && hasManual()) {
      const cur = S.mview.type === 'page' ? S.mview.page : -1;
      tree.append(h('h4', 'Official manual'));
      tree.append(treeItem('Overview', null, S.mview.type === 'home', () => { S.mview = { type: 'home' }; searchInput.value = ''; S.q = ''; render(true); }));
      if (manual.headings.length) {
        tree.append(h('h4', `Detected rules (${manual.headings.length})`));
        for (const hd of manual.headings) {
          tree.append(treeItem(`<${hd.id}> ${hd.title}`, 'p.' + hd.page, false, () => openPage(hd.page, [hd.id.toLowerCase()]), true));
        }
      }
      tree.append(h('h4', `Pages (${manual.pages.length})`));
      for (const p of manual.pages) {
        const first = (p.text.split('\n')[0] || '').slice(0, 60) || '(no text)';
        tree.append(treeItem(`${p.page}. ${first}`, null, p.page === cur, () => openPage(p.page), true));
      }
      const act = tree.querySelector('.rb-item.active');
      if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
      return;
    }
    const v = S.tab === 'rules' ? S.view : {};
    const curSection = v.type === 'section' ? v.id : v.type === 'rule' ? (getRule(v.id) || {}).section : null;
    tree.append(h('h4', 'Sections'));
    tree.append(treeItem('Start here', null, v.type === 'home', () => go({ type: 'home' })));
    for (const s of SECTIONS) {
      const n = RULES.filter((r) => r.section === s.id).length;
      tree.append(treeItem(s.title, n, curSection === s.id, () => { searchInput.value = ''; S.q = ''; go({ type: 'section', id: s.id }); }));
    }
    tree.append(h('h4', 'My Rule Book'));
    tree.append(treeItem('★ Bookmarks', bookmarks().length, v.type === 'bookmarks', () => go({ type: 'bookmarks' })));
    const rec = recent();
    tree.append(treeItem('Recently viewed', rec.length, v.type === 'recent', () => go({ type: 'recent' })));
    for (const id of rec.slice(0, 6)) {
      const r = getRule(id);
      tree.append(treeItem(`${r.id} · ${r.title}`, null, v.type === 'rule' && v.id === id, () => openRule(id), true));
    }
  }

  function starBtn(rule) {
    const on = bookmarks().includes(rule.id);
    return h('button.rb-star' + (on ? '.on' : ''), {
      type: 'button', title: on ? 'Remove bookmark' : 'Bookmark this rule', 'aria-pressed': String(on), 'aria-label': (on ? 'Remove bookmark for ' : 'Bookmark ') + rule.id,
      onclick: (e) => { e.stopPropagation(); toggleBookmark(rule.id); },
    }, on ? '★' : '☆');
  }

  function ruleCard(rule, { tokens = null, full = false } = {}) {
    const sev = SEVERITY[rule.severity];
    const card = h('div.card.rb-card', { id: 'rb-rule-' + rule.id });
    card.append(h('div.rb-card-head',
      h('span.rb-id', { html: hl(rule.id, tokens) }),
      h('h3', full ? { html: hl(rule.title, tokens) } : h('a', { href: '#', 'data-rule': rule.id, html: hl(rule.title, tokens) })),
      starBtn(rule)));
    const meta = h('div.rb-meta');
    if (sev) meta.append(h('span.tag.' + sev.cls, { title: 'Study hint from this guide about how costly breaking the rule tends to be - the Head Referee decides the real consequence' }, sev.label));
    if (rule.verify) meta.append(h('span.tag.yellow', { title: 'This is a standard V5RC principle written from general knowledge. Check the exact wording and rule number in the official manual.' }, 'confirm wording & number in the official manual'));
    for (const para of rule.summary.split(/\n\n+/)) card.append(h('p', { html: richText(para, tokens, rule.id) }));
    if (rule.table) {
      card.append(h('table',
        h('thead', h('tr', rule.table.head.map((c) => h('th', { html: hl(c, tokens) })))),
        h('tbody', rule.table.rows.map((row) => h('tr', row.map((c) => h('td', { html: richText(c, tokens, rule.id) })))))));
    }
    if (rule.points && rule.points.length) card.append(h('ul', rule.points.map((p) => h('li', { html: richText(p, tokens, rule.id) }))));
    if (rule.example) card.append(h('div.rb-example', { html: '<b>Example: </b>' + richText(rule.example, tokens, rule.id) }));
    if (full && rule.see && rule.see.length) {
      meta.append(h('span.muted.small', 'See also:'));
      for (const id of rule.see) {
        const r = getRule(id);
        if (r) meta.append(h('span.tag.rb-chip', { 'data-rule': r.id, title: r.title, role: 'link', tabIndex: 0, onkeydown: (e) => { if (e.key === 'Enter') openRule(r.id); } }, `${r.id} · ${r.title}`));
      }
    }
    if (meta.childNodes.length) card.append(meta);
    return card;
  }

  function sectionHeader(title, blurb, extra) {
    return h('div', { style: { marginBottom: '12px' } }, h('div.row', h('h2.grow', { style: { margin: 0 } }, title), extra || null), blurb ? h('p.muted', { style: { marginTop: '4px' } }, blurb) : null);
  }

  function renderRulesView() {
    const v = S.view;
    if (v.type === 'search') return renderSearch(v.q);
    if (v.type === 'rule') return renderRule(v);
    if (v.type === 'section') {
      const s = SECTION_BY_ID.get(v.id);
      const list = RULES.filter((r) => r.section === v.id);
      main.append(sectionHeader(s.title, s.blurb, h('span.tag', `${list.length} items`)));
      if (list.some((r) => r.verify)) {
        main.append(h('p.small.muted', 'Items tagged "confirm wording & number" describe standard V5RC principles. Their ids here are descriptive (for example R-motors); find the real rule number in the official manual.'));
      }
      for (const r of list) main.append(ruleCard(r));
      return;
    }
    if (v.type === 'bookmarks' || v.type === 'recent') {
      const isB = v.type === 'bookmarks';
      const ids = isB ? bookmarks() : recent();
      main.append(sectionHeader(isB ? '★ Bookmarks' : 'Recently viewed', isB ? 'Rules you starred. They are saved in this browser.' : 'The last rules you opened.',
        ids.length ? h('button.btn.small', { type: 'button', onclick: () => { store.set(isB ? K_BOOKMARKS : K_RECENT, []); render(); } }, 'Clear all') : null));
      if (!ids.length) {
        main.append(h('div.card', h('p', isB ? 'No bookmarks yet. Click the ☆ on any rule to keep it here - handy for the rules your team keeps tripping over.' : 'Nothing viewed yet. Open any rule and it will show up here.')));
      }
      for (const id of ids) main.append(ruleCard(getRule(id)));
      return;
    }
    renderHome();
  }

  function renderHome() {
    main.append(sectionHeader('Override Rule Book', 'Student-friendly summaries of the 2026-27 V5RC game rules. Search above, browse a section on the left, or start with a cheat sheet.'));
    main.append(h('h4', 'Quick reference'));
    main.append(h('div.rb-grid', RULES.filter((r) => r.section === 'quick').map((r) =>
      h('button.card.rb-tile', { type: 'button', onclick: () => openRule(r.id) }, h('b', r.title), h('span.muted.small', r.summary.slice(0, 90) + (r.summary.length > 90 ? '...' : ''))))));
    main.append(h('h4', 'Popular searches'));
    main.append(h('div.row', { style: { marginBottom: '14px' } }, POPULAR_SEARCHES.map((q) => h('button.btn.small', { type: 'button', onclick: () => runSearch(q) }, q))));
    main.append(h('h4', 'Sections'));
    main.append(h('div.rb-grid', SECTIONS.filter((s) => s.id !== 'quick').map((s) =>
      h('button.card.rb-tile', { type: 'button', onclick: () => go({ type: 'section', id: s.id }) },
        h('b', s.title), h('span.muted.small', s.blurb)))));
    const best = store.get(K_QUIZ_BEST);
    main.append(h('div.card', h('div.row',
      h('div.grow', h('b', 'Test yourself'), h('div.muted.small', `${QUIZ_LEN} quick multiple-choice questions.` + (best != null ? ` Your best so far: ${best}/${QUIZ_LEN}.` : ''))),
      h('button.btn.primary', { type: 'button', onclick: () => { S.quiz = buildQuiz(); setTab('quiz'); } }, 'Start quiz'))));
    main.append(h('div.card', { style: { marginTop: '10px' } }, h('div.row',
      h('div.grow', h('b', 'Read the real thing'), h('div.muted.small', pdfMeta()
        ? `Imported: ${pdfMeta().name} (${pdfMeta().pages} pages).`
        : 'Download the official Game Manual PDF, then import it to read and search it here. It never leaves your computer.')),
      h('button.btn', { type: 'button', onclick: () => (pdfMeta() ? setTab('manual') : fileInput.click()) }, pdfMeta() ? 'Open full manual' : 'Import official PDF'))));
  }

  function renderRule(v) {
    const rule = getRule(v.id);
    if (!rule) { S.view = { type: 'home' }; return renderHome(); }
    const sec = SECTION_BY_ID.get(rule.section);
    const siblings = RULES.filter((r) => r.section === rule.section);
    const i = siblings.indexOf(rule);
    main.append(h('div.rb-crumbs',
      h('button.btn.small', { type: 'button', onclick: back }, '← Back'),
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); go({ type: 'section', id: rule.section }); } }, sec.title),
      h('span.grow'),
      i > 0 ? h('button.btn.small', { type: 'button', onclick: () => openRule(siblings[i - 1].id), title: siblings[i - 1].title }, '‹ ' + siblings[i - 1].id) : null,
      i < siblings.length - 1 ? h('button.btn.small', { type: 'button', onclick: () => openRule(siblings[i + 1].id), title: siblings[i + 1].title }, siblings[i + 1].id + ' ›') : null));
    main.append(ruleCard(rule, { tokens: v.tokens, full: true }));

    // link into the imported official PDF
    const box = h('div.card');
    if (hasManual()) {
      const official = /^(SC|SG|GG|G|S|R|T|RSC)\d+[a-z]?$/.test(rule.id);
      const pages = official ? manual.headings.filter((x) => x.id.toLowerCase() === rule.id.toLowerCase()).map((x) => x.page) : [];
      if (pages.length) {
        box.append(h('div.row', h('span.grow', `Official wording of <${rule.id}> in your imported manual:`),
          pages.map((p) => h('button.btn.small', { type: 'button', onclick: () => openPage(p, [rule.id.toLowerCase()]) }, 'Page ' + p))));
      } else {
        const q = official ? rule.id : rule.title;
        box.append(h('div.row', h('span.grow.muted', 'Look this up in your imported manual:'),
          h('button.btn.small', { type: 'button', onclick: () => { S.tab = 'manual'; S.q = q; searchInput.value = q; S.mview = { type: 'search', q }; render(true); } }, `Search PDF for "${q}"`)));
      }
    } else {
      box.append(h('div.row', h('span.grow.muted.small', 'This is a paraphrase. Import the official PDF to check the exact wording side by side.'),
        h('button.btn.small', { type: 'button', onclick: () => fileInput.click() }, 'Import official PDF')));
    }
    main.append(box);
  }

  function renderSearch(q) {
    const tokens = tokenize(q);
    const hits = searchRules(q);
    main.append(sectionHeader(`${hits.length} result${hits.length === 1 ? '' : 's'} for "${q}"`,
      hits.length ? 'Press Enter to jump to the first result.' : null));
    if (!hits.length) {
      const sugg = suggestTerms(q);
      main.append(h('div.card',
        h('p', h('b', 'No results. '), 'Try a shorter keyword, a rule number such as SG6, or one of these:'),
        sugg.length ? h('div.row', { style: { marginBottom: '8px' } }, h('span.muted.small', 'Did you mean:'), sugg.map((s) => h('button.btn.small', { type: 'button', onclick: () => runSearch(s) }, s))) : null,
        h('div.row', h('span.muted.small', 'Popular:'), POPULAR_SEARCHES.map((s) => h('button.btn.small', { type: 'button', onclick: () => runSearch(s) }, s)))));
    }
    for (const hit of hits) {
      const r = getRule(hit.id);
      main.append(h('button.card.rb-hit', { type: 'button', onclick: () => openRule(hit.id, tokens) },
        h('div.row',
          h('span.rb-id', { html: hl(r.id, tokens) }),
          h('b.grow', { html: hl(r.title, tokens) }),
          r.verify ? h('span.tag.yellow', { title: 'Confirm wording & number in the official manual' }, 'confirm') : null,
          h('span.tag', (SECTION_BY_ID.get(r.section) || {}).short || r.section)),
        h('p.muted', { html: hl(hit.snippet, tokens) })));
    }
    if (hasManual()) {
      const mh = searchManualSync(q);
      main.append(h('div.card', h('div.row',
        h('span.grow.muted', mh.length ? `The official PDF mentions this on ${mh.length} page${mh.length === 1 ? '' : 's'}.` : 'No matches in the official PDF text.'),
        mh.length ? h('button.btn.small', { type: 'button', onclick: () => { S.tab = 'manual'; S.mview = { type: 'search', q }; render(true); } }, 'Search the full manual') : null)));
    }
  }

  // ── quiz ──
  function renderQuiz() {
    if (!S.quiz) S.quiz = buildQuiz();
    const Z = S.quiz;
    if (Z.done) {
      const best = Math.max(store.get(K_QUIZ_BEST, 0) || 0, Z.score);
      const msg = Z.score === QUIZ_LEN ? 'Perfect score - you could referee this!' : Z.score >= 8 ? 'Great work. Just a couple to tidy up.' : Z.score >= 5 ? 'Good start. Review the rules below and try again.' : 'Keep going - read the cheat sheet, then have another go.';
      main.append(sectionHeader('Quiz finished', msg));
      main.append(h('div.card', { style: { marginBottom: '10px' } },
        h('div.row', h('h2', { style: { margin: 0 } }, `${Z.score} / ${QUIZ_LEN}`),
          h('span.stars', '★'.repeat(Math.round(Z.score / 2)), h('span.off', '★'.repeat(5 - Math.round(Z.score / 2)))),
          h('span.grow'), h('span.muted.small', `Best: ${best}/${QUIZ_LEN}`)),
        h('div.row', { style: { marginTop: '10px' } },
          h('button.btn.primary', { type: 'button', onclick: () => { S.quiz = buildQuiz(); render(true); } }, 'Try again'),
          h('button.btn', { type: 'button', onclick: () => openRule('QR-scoring') }, 'Open scoring cheat sheet'))));
      if (Z.wrong.length) {
        main.append(h('h4', 'Review these'));
        for (const w of Z.wrong) {
          main.append(h('div.card.rb-card',
            h('p', h('b', w.q)),
            h('p', 'Correct answer: ', h('b', w.answer), h('span.muted', ' — ' + w.why)),
            h('button.btn.small', { type: 'button', onclick: () => openRule(w.rule) }, `Read ${w.rule}`)));
        }
      }
      return;
    }
    const Q = Z.qs[Z.i];
    main.append(sectionHeader('Rules quiz', null, h('span.tag', `Score ${Z.score}`)));
    main.append(h('div.muted.small', `Question ${Z.i + 1} of ${Z.qs.length}`));
    main.append(h('div.rb-bar', h('i', { style: { width: `${((Z.i + (Z.picked != null ? 1 : 0)) / Z.qs.length) * 100}%` } })));
    const card = h('div.card');
    card.append(h('h3', { style: { marginBottom: '12px' } }, Q.q));
    Q.choices.forEach((c, idx) => {
      let cls = '';
      if (Z.picked != null) cls = c === Q.answer ? '.rb-right' : (c === Z.picked ? '.rb-wrong' : '');
      card.append(h('button.btn.rb-quiz-choice' + cls, {
        type: 'button', disabled: Z.picked != null, 'data-choice': idx,
        onclick: () => {
          Z.picked = c;
          if (c === Q.answer) Z.score++; else Z.wrong.push(Q);
          render();
        },
      }, `${'ABCD'[idx]}.  ${c}`));
    });
    if (Z.picked != null) {
      const ok = Z.picked === Q.answer;
      const r = getRule(Q.rule);
      card.append(h('div.rb-example', { style: ok ? null : { borderLeftColor: 'var(--red)', background: '#e0453a14' } },
        h('b', { style: ok ? null : { color: '#ff9d95' } }, ok ? 'Correct! ' : 'Not quite. '), Q.why, ' ',
        r ? h('a', { href: '#', 'data-rule': r.id }, `Read ${r.id}: ${r.title}`) : null));
      card.append(h('div.row', h('span.grow'),
        h('button.btn.primary', { type: 'button', onclick: () => {
          if (Z.i + 1 >= Z.qs.length) {
            Z.done = true;
            if (Z.score > (store.get(K_QUIZ_BEST, 0) || 0)) store.set(K_QUIZ_BEST, Z.score);
            bus.emit('rules:quiz', { score: Z.score, total: Z.qs.length });
          } else { Z.i++; Z.picked = null; }
          render(true);
        } }, Z.i + 1 >= Z.qs.length ? 'See my score' : 'Next question')));
    }
    main.append(card);
  }

  // ── imported manual ──
  async function startImport(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      S.importError = `"${file.name}" does not look like a PDF. Download the Game Manual as a PDF from the official site and choose that file.`;
      S.tab = 'manual';
      render(true);
      return;
    }
    S.tab = 'manual';
    S.importError = null;
    S.importing = { name: file.name, page: 0, total: 0 };
    S.mview = { type: 'home' };
    S.q = ''; searchInput.value = '';
    render(true);
    try {
      const meta = await importPdf(file, (n, total) => {
        if (!S.importing) return;
        S.importing.page = n; S.importing.total = total;
        const bar = main.querySelector('.rb-import-bar');
        const lbl = main.querySelector('.rb-import-label');
        if (bar) bar.style.width = `${(n / total) * 100}%`;
        if (lbl) lbl.textContent = `Reading page ${n} of ${total}...`;
      });
      S.importing = null;
      toast(`Imported ${meta.pages} pages from ${meta.name}`);
      bus.emit('rules:pdf', meta);
    } catch (e) {
      console.warn('Rule Book: PDF import failed', e);
      S.importing = null;
      S.importError = `Could not read "${file.name}" as a PDF (${(e && e.message) || 'unknown error'}). Make sure it is the Game Manual PDF and try again.`;
    }
    render(true);
  }

  function dropZone(node) {
    node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('rb-over'); });
    node.addEventListener('dragleave', () => node.classList.remove('rb-over'));
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      node.classList.remove('rb-over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) startImport(f);
    });
    return node;
  }

  function renderManual() {
    if (S.importing) {
      main.append(sectionHeader('Importing the official manual', S.importing.name));
      main.append(h('div.card', h('div.rb-import-label', 'Opening the PDF...'), h('div.rb-bar', h('i.rb-import-bar', { style: { width: '0%' } })),
        h('p.muted.small', 'Everything happens inside your browser. The file is not uploaded anywhere.')));
      return;
    }
    if (S.importError) main.append(h('div.card', { style: { borderColor: 'var(--red)', marginBottom: '10px' } }, h('b', 'Import problem: '), S.importError));
    const meta = pdfMeta();
    if (!meta || !hasManual()) {
      main.append(sectionHeader('Full manual', 'Read and search the official Game Manual right here, next to the summaries.'));
      main.append(dropZone(h('div.rb-drop',
        h('p', h('b', 'No official PDF imported yet')),
        h('ol', { style: { textAlign: 'left', display: 'inline-block', margin: '0 0 12px', lineHeight: '1.7' } },
          h('li', 'Open ', h('a', { href: OFFICIAL_LINKS[0].url, target: '_blank', rel: 'noopener noreferrer' }, OFFICIAL_LINKS[0].label), ' and download the Game Manual PDF.'),
          h('li', 'Click the button below (or drop the file on this box).'),
          h('li', 'Search it, jump to any rule, and view the real pages.')),
        h('div', h('button.btn.primary', { type: 'button', onclick: () => fileInput.click() }, 'Import official PDF')),
        h('p.muted.small', { style: { marginTop: '10px' } }, 'The file stays on this computer (saved in this browser\'s IndexedDB). Nothing is uploaded.'))));
      return;
    }
    if (S.mview.type === 'search') return renderManualSearch(S.mview.q);
    if (S.mview.type === 'page') return renderManualPage(S.mview);

    main.append(sectionHeader('Full manual', `${meta.name} · ${meta.pages} pages · imported ${new Date(meta.importedAt).toLocaleDateString()}`,
      h('div.row',
        h('button.btn.small', { type: 'button', onclick: () => fileInput.click() }, 'Replace PDF'),
        h('button.btn.small', { type: 'button', onclick: async () => { await removePdf(); S.mview = { type: 'home' }; toast('Removed the imported manual'); render(true); } }, 'Remove'))));
    if (meta.persisted === false) main.append(h('p.small.muted', 'This browser would not let us save the file, so it will need importing again after a reload.'));
    main.append(h('div.card', { style: { marginBottom: '10px' } }, h('div.row',
      h('span.grow', 'Use the search box above to search every page, pick a page on the left, or start reading.'),
      h('button.btn.primary', { type: 'button', onclick: () => openPage(1) }, 'Open page 1'))));
    if (manual.headings.length) {
      main.append(h('h4', `Rules detected in the PDF (${manual.headings.length})`));
      const groups = new Map();
      for (const hd of manual.headings) {
        const fam = hd.id.replace(/\d.*$/, '');
        if (!groups.has(fam)) groups.set(fam, []);
        groups.get(fam).push(hd);
      }
      for (const [fam, list] of groups) {
        main.append(h('div.card.rb-card', h('b', `<${fam}> rules`), h('div.row', { style: { marginTop: '6px', gap: '4px' } },
          list.map((hd) => h('button.btn.small', { type: 'button', title: `${hd.title} (page ${hd.page})`, onclick: () => openPage(hd.page, [hd.id.toLowerCase()]) }, hd.id)))));
      }
    } else {
      main.append(h('p.muted', 'No rule headings such as <SG6> were found in this PDF\'s text. Search and page viewing still work. (If this is a scanned PDF it has no text layer to search.)'));
    }
  }

  function renderManualSearch(q) {
    const tokens = tokenize(q);
    const hits = searchManualSync(q);
    const total = hits.reduce((n, x) => n + x.count, 0);
    main.append(sectionHeader(`${hits.length} page${hits.length === 1 ? '' : 's'} match "${q}"`, hits.length ? `${total} matches in the official PDF text. Press Enter to open the best page.` : null));
    if (!hits.length) {
      const own = searchRules(q, { limit: 3 });
      main.append(h('div.card', h('p', h('b', 'No matches in the PDF text. '), 'Check the spelling or try a single keyword.'),
        own.length ? h('div.row', h('span.muted.small', 'In the summaries:'), own.map((o) => h('button.btn.small', { type: 'button', onclick: () => openRule(o.id, tokens) }, `${o.id} · ${o.title}`))) : null));
      return;
    }
    for (const hit of hits.slice(0, 80)) {
      main.append(h('button.card.rb-hit', { type: 'button', onclick: () => openPage(hit.page, tokens) },
        h('div.row', h('span.rb-id', 'p. ' + hit.page), h('span.grow.muted.small', `${hit.count} match${hit.count === 1 ? '' : 'es'}` + (hit.isHeading ? ' · rule heading' : ''))),
        hit.snippets.map((s) => h('p', { html: hl(s, tokens) }))));
    }
    if (hits.length > 80) main.append(h('p.muted.small', `Showing the best 80 of ${hits.length} pages. Add another word to narrow it down.`));
  }

  function cancelPageRender() {
    S.renderSeq++;
    if (S.renderTask) { try { S.renderTask.cancel(); } catch { /* ignore */ } S.renderTask = null; }
  }

  function renderManualPage(v) {
    const total = manual.pages.length;
    const n = Math.max(1, Math.min(total, v.page));
    const pageData = manual.pages[n - 1];
    const pageInput = h('input', { type: 'number', min: 1, max: total, value: n, 'aria-label': 'Page number',
      onchange: () => openPage(parseInt(pageInput.value, 10) || n, v.tokens) });
    const status = h('span.muted.small', 'Loading page...');
    const canvas = h('canvas', { 'aria-label': `Official manual page ${n}` });
    const wrap = h('div.rb-canvas-wrap', canvas);
    main.append(h('div.rb-pdf-tools',
      h('button.btn.small', { type: 'button', onclick: () => { S.mview = S.q.trim() ? { type: 'search', q: S.q.trim() } : { type: 'home' }; render(true); } }, S.q.trim() ? '← Results' : '← Overview'),
      h('button.btn.small', { type: 'button', disabled: n <= 1, onclick: () => openPage(n - 1, v.tokens), title: 'Previous page' }, '‹ Prev'),
      h('span.small', 'Page'), pageInput, h('span.small.muted', 'of ' + total),
      h('button.btn.small', { type: 'button', disabled: n >= total, onclick: () => openPage(n + 1, v.tokens), title: 'Next page' }, 'Next ›'),
      h('span.grow'),
      h('button.btn.small', { type: 'button', onclick: () => { S.zoom = Math.max(0.5, +(S.zoom - 0.25).toFixed(2)); render(); }, title: 'Zoom out' }, '−'),
      h('span.small.muted', Math.round(S.zoom * 100) + '%'),
      h('button.btn.small', { type: 'button', onclick: () => { S.zoom = Math.min(3, +(S.zoom + 0.25).toFixed(2)); render(); }, title: 'Zoom in' }, '+'),
      status));
    const heads = (pageData.headings || []);
    if (heads.length) {
      main.append(h('div.row', { style: { marginBottom: '8px', gap: '4px' } }, h('span.muted.small', 'On this page:'),
        heads.map((hd) => {
          const mine = getRule(hd.id);
          return h('span.tag' + (mine ? '.rb-chip' : ''), mine ? { 'data-rule': mine.id, title: 'Open our summary of ' + mine.id } : { title: hd.title }, `<${hd.id}>`);
        })));
    }
    main.append(wrap);
    main.append(h('details', { open: !!(v.tokens && v.tokens.length), style: { marginTop: '10px' } },
      h('summary', { style: { cursor: 'pointer' } }, 'Text on this page', v.tokens && v.tokens.length ? ' (matches highlighted)' : ''),
      h('div.rb-pagetext', { html: pageData.text ? hl(pageData.text, v.tokens) : '<span class="muted">This page has no extractable text.</span>' })));

    const seq = ++S.renderSeq;
    (async () => {
      try {
        const doc = await getPdfDoc();
        if (seq !== S.renderSeq || S.destroyed) return;
        const page = await doc.getPage(n);
        if (seq !== S.renderSeq || S.destroyed) return;
        const base = page.getViewport({ scale: 1 });
        const avail = Math.max(240, (main.clientWidth || 700) - 46);
        const cssScale = (avail / base.width) * S.zoom;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
        canvas.style.height = Math.floor(viewport.height / dpr) + 'px';
        const task = page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport });
        S.renderTask = task;
        await task.promise;
        if (S.renderTask === task) S.renderTask = null;
        if (seq === S.renderSeq) { status.textContent = ''; canvas.dataset.rendered = String(n); }
      } catch (e) {
        if (e && e.name === 'RenderingCancelledException') return;
        if (seq !== S.renderSeq) return;
        console.warn('Rule Book: page render failed', e);
        status.textContent = '';
        wrap.replaceChildren(h('p.muted', { style: { padding: '16px' } }, `Could not draw this page (${(e && e.message) || 'unknown error'}). The page text is still available below.`));
      }
    })();
  }

  // ── instance API ──
  const api = {
    showRule(id) { return openRule(id); },
    search(q) { S.tab = 'rules'; runSearch(String(q || '')); return searchRules(q); },
    openTab(tab) { if (tabBtns[tab]) setTab(tab); },
    destroy() {
      S.destroyed = true;
      cancelPageRender();
      if (activeInstance === api) activeInstance = null;
      if (root.parentNode === el) el.replaceChildren();
    },
  };
  activeInstance = api;

  render();
  loadManualPages().then(() => { if (!S.destroyed && hasManual()) render(); });
  if (pendingRule) { const id = pendingRule; pendingRule = null; openRule(id); }
  return api;
}
