import fs from 'node:fs';
import { createHash } from 'node:crypto';
// Pure compatibility projection: reading old settings never rewrites their files.
export const RETIRED_BUBBLE_IMAGE = 'bimg_yue_money';
const retired = value => value?.type === 'image' && value.imgId === RETIRED_BUBBLE_IMAGE;
const fallback = message => ({ type: 'text', text: typeof message === 'string' && message.trim() ? message : '记得关注 API 余额哦', size: 5 });

export function sanitizeGptAppearance(value) {
  if (Array.isArray(value)) return value.map(sanitizeGptAppearance);
  if (!value || typeof value !== 'object') return value;
  const result = { ...value };
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'modules' || key === 'lines') && Array.isArray(item)) {
      const remaining = item.filter(part => !retired(part));
      result[key] = remaining.map(sanitizeGptAppearance);
      // Only repair emptiness caused by retirement; preserve intentionally empty content.
      if (remaining.length !== item.length && !remaining.some(part =>
        part && (part.type === 'image' || part.type === 'balance' || part.type === 'today' ||
          part.type === 'random' && part.lines?.length || String(part.text || '').trim()))) {
        result[key].push(fallback(value.msg));
      }
    } else if (key === 'module' && retired(item)) result[key] = fallback();
    else if (item && typeof item === 'object') result[key] = sanitizeGptAppearance(item);
  }
  return result;
}

// Match only shipped legacy bytes, never a user's artwork based on its name alone.
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const legacyHashes = new Set(['bubble-petpet.gif', 'bubble-yue-money.gif', 'rua.gif'].flatMap(file => {
  try { return [digest(fs.readFileSync(new URL('../assets/' + file, import.meta.url)))]; } catch { return []; }
}));
export const isLegacyBuiltinArtwork = bytes => legacyHashes.has(digest(bytes));
