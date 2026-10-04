// Translate only presentation fields on the response boundary. Stored data,
// account identifiers and user-authored text remain unchanged.
const fields = new Set(['error', 'message', 'note', 'reason', 'label', 'balanceLabel', 'balanceScope', 'unitNote', 'usageNote', 'warning', 'recoveryError', 'monitorError']);
export function localizeResponse(value, locale, catalogs) {
  if (Array.isArray(value)) return value.map(item => localizeResponse(item, locale, catalogs));
  if (!value || typeof value !== 'object') return value;
  const result = { ...value }, english = locale === 'en';
  const sources = Object.entries(catalogs['zh-CN'] || {}).filter(([key]) => key.startsWith('backend.'));
  const exact = new Map(sources.map(([key, text]) => [text, key]));
  for (const [field, item] of Object.entries(value)) {
    const explicitKey = value[field + 'Key'];
    // Names are user content unless a built-in response explicitly marks them.
    // Template arguments keep identifiers and currency codes out of translators.
    if (typeof item === 'string' && typeof explicitKey === 'string' && explicitKey.startsWith('backend.') && Object.hasOwn(catalogs['zh-CN'] || {}, explicitKey)) {
      const template = catalogs[english ? 'en' : 'zh-CN'][explicitKey] || item;
      const args = value[field + 'Args'] || {};
      result[field] = template.replace(/\{([A-Za-z][\w]*)\}/g, (all, key) => Object.hasOwn(args, key) ? String(args[key]) : all);
    } else if (typeof item === 'string' && fields.has(field)) {
      const key = exact.get(item);
      if (key) { result[field + 'Key'] = key; if (english) result[field] = catalogs.en[key] || item; }
      else if (english && /[\u3400-\u9fff]/.test(item)) {
        let text = item;
        for (const [id, source] of [...sources].sort((a, b) => b[1].length - a[1].length)) {
          if (source.length >= 2 && text.includes(source)) text = text.split(source).join(catalogs.en[id] || source);
        }
        result[field] = field === 'error' && /[\u3400-\u9fff]/.test(text)
          ? catalogs.en['backend.m041'] : text;
      }
    } else if (item && typeof item === 'object') result[field] = localizeResponse(item, locale, catalogs);
  }
  return result;
}
