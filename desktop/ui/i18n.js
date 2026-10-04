(function (host) {
  'use strict';
  const catalogs = host.WhaleI18nCatalogs || { 'zh-CN': {}, en: {} };
  const normalize = value => /^en(?:-|$)/i.test(value || '') ? 'en' : 'zh-CN';
  let locale = 'zh-CN';
  try { locale = normalize(localStorage.getItem('dshw-locale') || 'zh-CN'); } catch {}
  const listeners = new Set(), bindings = new Map();
  function t(key, params = {}) {
    const template = catalogs[locale]?.[key] ?? catalogs['zh-CN']?.[key] ?? key;
    return String(template).replace(/\{([A-Za-z][\w]*)\}/g, (all, name) => Object.hasOwn(params, name) ? String(params[name]) : all);
  }
  function write(el, property, factory) {
    const value = factory();
    if (property in el && !property.startsWith('aria-')) el[property] = value;
    else el.setAttribute(property, value);
  }
  function bind(el, property, factory) {
    if (!el || typeof factory !== 'function') return el;
    let entry = bindings.get(el);
    if (!entry) { entry = { properties: new Map(), connected: !!el.isConnected }; bindings.set(el, entry); }
    entry.properties.set(property, factory); write(el, property, factory); return el;
  }
  function applyStatic(root = document) {
    for (const el of root.querySelectorAll('[data-i18n]')) bind(el, 'textContent', () => t(el.dataset.i18n));
    for (const property of ['title', 'placeholder', 'aria-label']) {
      const attribute = 'data-i18n-' + property;
      for (const el of root.querySelectorAll('[' + attribute + ']')) bind(el, property, () => t(el.getAttribute(attribute)));
    }
  }
  function setLocale(next) {
    if (!['zh-CN', 'en'].includes(next)) return false;
    if (next === locale) return true;
    try { localStorage.setItem('dshw-locale', next); } catch { return false; }
    locale = next; document.documentElement.lang = next;
    for (const [el, entry] of bindings) {
      if (entry.connected && !el.isConnected) { bindings.delete(el); continue; }
      entry.connected ||= !!el.isConnected;
      for (const [property, factory] of entry.properties) { try { write(el, property, factory); } catch {} }
    }
    for (const callback of listeners) { try { callback(next); } catch {} }
    host.dispatchEvent(new CustomEvent('whale-locale-changed', { detail: { locale } }));
    host.dispatchEvent(new Event('whale-preference-committed'));
    return true;
  }
  // Translate trusted built-in response text; unknown/custom text stays verbatim.
  const sourceKeys = new Map(Object.values(catalogs).flatMap(catalog => Object.entries(catalog).map(([key,value]) => [value,key])));
  function message(value) {
    const text = String(value ?? ''); const key = sourceKeys.get(text);
    if (key) return t(key);
    let result = text;
    const from = locale === 'en' ? 'zh-CN' : 'en';
    for (const [id, source] of Object.entries(catalogs[from] || {}).filter(([key]) => key.startsWith('backend.')).sort((a,b) => b[1].length-a[1].length)) {
      if (source.length >= 2 && result.includes(source)) result = result.split(source).join(t(id));
    }
    return result;
  }
  const number = (value, options) => new Intl.NumberFormat(locale, options).format(value);
  const date = (value, options) => new Intl.DateTimeFormat(locale, options || { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  host.WhaleI18n = Object.freeze({ t, bind, applyStatic, setLocale, message, number, date,
    get locale() { return locale; }, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); } });
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyStatic()); else applyStatic();
  }
  // Locale is request presentation context, never account configuration.
  if (typeof host.fetch === 'function' && typeof location !== 'undefined') {
    const originalFetch = host.fetch.bind(host);
    host.fetch = (input, init = {}) => {
      try {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
        if (url.protocol === location.protocol && url.host === location.host && /^(\/api\/|\/dsh-whale\/)/.test(url.pathname)) {
          const headers = new Headers(input instanceof Request ? input.headers : undefined);
          new Headers(init.headers || {}).forEach((value,key) => headers.set(key,value));
          headers.set('x-whale-locale', locale); init = { ...init, headers };
        }
      } catch {}
      return originalFetch(input, init);
    };
  }
})(typeof window === 'undefined' ? globalThis : window);
