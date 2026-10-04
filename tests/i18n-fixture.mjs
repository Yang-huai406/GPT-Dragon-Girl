import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadCatalogs } = require('../lib/i18n.cjs');
const source = fs.readFileSync(new URL('../desktop/ui/i18n.js', import.meta.url), 'utf8');
export function createI18n(locale = 'zh-CN') {
  const storage = new Map([['dshw-locale', locale]]);
  const context = {
    WhaleI18nCatalogs: loadCatalogs(),
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: {}, readyState: 'complete', querySelectorAll: () => [] },
    dispatchEvent() {},
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  };
  vm.runInNewContext(source, context);
  return context.WhaleI18n;
}
export function withI18n(context, locale = 'zh-CN') {
  const i18n = createI18n(locale);
  context.WhaleI18n = i18n;
  if (context.window) context.window.WhaleI18n = i18n;
  return context;
}
