'use strict';
const fs = require('node:fs');
const path = require('node:path');
function loadCatalogs(root = path.resolve(__dirname, '..')) {
  const result = { 'zh-CN': {}, en: {} };
  for (const name of fs.readdirSync(path.join(root, 'locales')).sort()) {
    const locale = name.endsWith('.zh-CN.json') ? 'zh-CN' : name.endsWith('.en.json') ? 'en' : null;
    if (!locale) continue;
    const values = JSON.parse(fs.readFileSync(path.join(root, 'locales', name), 'utf8').replace(/^\uFEFF/, ''));
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== 'string' || Object.hasOwn(result[locale], key)) throw Error('Invalid or duplicate locale key: ' + key);
      result[locale][key] = value;
    }
  }
  return result;
}
const normalizeLocale = value => /^en(?:-|$)/i.test(value || '') ? 'en' : 'zh-CN';
function translate(catalogs, locale, key, args = {}) {
  const template = catalogs[normalizeLocale(locale)]?.[key] ?? catalogs['zh-CN']?.[key] ?? key;
  return String(template).replace(/\{([A-Za-z][\w]*)\}/g, (all, name) => Object.hasOwn(args, name) ? String(args[name]) : all);
}
function savedLocale(file) {
  try { return normalizeLocale(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))['dshw-locale']); }
  catch { return 'zh-CN'; }
}
module.exports = { loadCatalogs, normalizeLocale, translate, savedLocale };
