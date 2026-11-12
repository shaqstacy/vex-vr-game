// Tiny persistence + event bus shared by every module.
const PREFIX = 'vexvr:';

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('store.set failed', key, e);
    }
    bus.emit('store:' + key, value);
  },
  remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
  },
};

const listeners = new Map();
export const bus = {
  on(evt, fn) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt)?.delete(fn);
  },
  emit(evt, data) {
    listeners.get(evt)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error('bus handler', evt, e); }
    });
  },
};

// DOM helper: h('div.card', {onclick}, child, child...)
export function h(sel, attrs, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// replaceChildren()/append() stringify null ("null" shows up in the page). Every module here
// builds child lists with `cond ? node : null`, so drop empties once, centrally.
if (typeof Element !== 'undefined' && !Element.prototype.__vexvrPatched) {
  Element.prototype.__vexvrPatched = true;
  for (const name of ['replaceChildren', 'append', 'prepend']) {
    const orig = Element.prototype[name];
    Element.prototype[name] = function (...kids) { return orig.apply(this, kids.filter((k) => k != null && k !== false)); };
  }
}
