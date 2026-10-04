(() => {
  'use strict';
  const T = (key, params) => globalThis.WhaleI18n?.t('panels.' + key, params) ?? key;
  const B = (el, prop, read) => globalThis.WhaleI18n?.bind(el, prop, read) ?? (el[prop] = read());
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  const N = value => globalThis.WhaleI18n?.number(value) ?? String(value);
  const validMode = value => value === 'api' || value === 'subscription';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function windowText(item) {
    const used = number(item.usedPercent);
    return used === null ? T('quotaUnknown') : T('quotaUsage', { used: used.toFixed(1), remaining: Math.max(0, 100 - used).toFixed(1), stale: item.stale ? T('snapshotStale') : '' });
  }
  function tokenText(value) { const n = number(value); return n === null ? T('noRecords') : T(n === 1 ? 'tokenCountOne' : 'tokenCountOther', { count: N(n) }); }
  function quotaLabel(item) { return item.windowDurationMins === 300 ? T('quota5h') : item.windowDurationMins === 10080 ? T('quotaWeek') : M(item.label) || T('quotaWindow'); }
  function noticeText(value) {
    if (!value || value.notify === false) return '';
    return number(value.tokens) === null ? T('turnNoTokens') : T('turnLocalTokens', { tokens: tokenText(value.tokens) });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validMode, windowText, tokenText, noticeText, quotaLabel };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const key = 'dshw-account-view';
  let mode = 'api', card = null, content = null, root = null, generation = 0, switching = false, latestNotice = null;
  let modeButtons = [], status = null, modeRevision = 0;
  try { const saved = localStorage.getItem(key); if (validMode(saved)) mode = saved; } catch {}
  function text(parent, tag, value) { const el = document.createElement(tag); if (value !== '' && value != null) B(el, 'textContent', typeof value === 'function' ? value : () => value); parent.append(el); return el; }
  function date(value) { if (!value) return T('unknown'); const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? globalThis.WhaleI18n?.date(d) ?? d.toLocaleString() : T('unknown'); }
  function close() { generation++; card?.remove(); card = content = null; }
  function position() {
    if (!card) return;
    const anchor = (root || document).querySelector('.dshwv-img') || document.querySelector('.dshwv-img');
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect(), width = card.offsetWidth || 280, height = card.offsetHeight || 220;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width)) + 'px';
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, bounds.top - height - 10 >= 8 ? bounds.top - height - 10 : bounds.bottom + 10)) + 'px';
    if(card.style.left!==left)card.style.left=left;
    if(card.style.top!==top)card.style.top=top;
  }
  function updateButtons() { for (const button of modeButtons) { button.disabled = switching; button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); } for(const el of document.querySelectorAll('[data-account-api]'))el.hidden=mode==='subscription';
    document.documentElement.dataset.accountMode = mode;
    for (const el of document.querySelectorAll('.whale-mode-description')) B(el, 'textContent', () => mode === 'subscription' ? T('modeDescriptionSubscription') : T('modeDescriptionApi'));
    for (const el of document.querySelectorAll('.whale-mode-open')) B(el, 'textContent', () => mode === 'subscription' ? T('modeOpenSubscription') : T('modeOpenApi'));
  }
  function followCard(ownCard) {
    if (card !== ownCard) return;
    position(); window.requestAnimationFrame(() => followCard(ownCard));
  }
  function commit(next) {
    mode = next; try { localStorage.setItem(key, mode); } catch {}
    close(); latestNotice = null; updateButtons();
    window.dispatchEvent(new CustomEvent('whale-account-view', { detail: { mode } }));
  }
  async function setMode(next) {
    if (!validMode(next) || switching) return false;
    modeRevision++; switching = true; updateButtons(); if (status) B(status, 'textContent', () => T('saving'));
    try {
      const response = await fetch('/api/display-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw Error(T('switchFailed'));
      const result = await response.json();
      if (result.ok === false || (result.mode || result.displayMode) !== next) throw Error(T('modeNotSaved'));
      commit(next); if (status) B(status, 'textContent', () => next === 'subscription' ? T('modeSavedSubscription') : T('modeSavedApi')); return true;
    } catch (e) { if (status) B(status, 'textContent', () => M(e.message) || T('switchFailed')); return false; }
    finally { switching = false; updateButtons(); }
  }
  async function refresh() {
    if (mode !== 'subscription' || !card) return;
    const own = ++generation; content.replaceChildren(); text(content, 'p', () => (T('loadingSubscription'))); position();
    try {
      const response = await fetch('/api/insights', { cache: 'no-store' }); if (!response.ok) throw Error(T('subscriptionUnavailable'));
      const data = await response.json(); if (own !== generation || !card) return;
      content.replaceChildren(); const sub = data.subscription || {};
      if (!sub.available) text(content, 'p', () => (M(sub.reason) || T('subscriptionMissing')));
      else {
        if (!(sub.windows || []).length) text(content, 'p', () => (T('noWindows')));
        for (const item of sub.windows || []) {
          const section = text(content, 'section', ''); text(section, 'strong', () => (quotaLabel(item))); text(section, 'p', () => (windowText(item)));
          const used = number(item.usedPercent);
          if (used !== null) { const meter = document.createElement('progress'); meter.max = 100; meter.value = Math.min(100, used); B(meter, 'aria-label', () => M(item.label) || T('quotaUsed')); section.append(meter); }
          text(section, 'small', () => (T('resetAt', { date: date(item.resetsAt) })));
        }
      }
      const tokens = sub.tokens || data.tokens || {};
      text(content, 'p', () => (T('local7d', { tokens: tokenText(tokens.total) }))); text(content, 'p', () => (T('local5h', { tokens: tokenText(tokens.last5Hours) })));
      if (tokens.complete === false) text(content, 'small', () => (T('partialScan')));
      text(content, 'small', () => (T('tokenDisclaimer')));
      const notice = noticeText(latestNotice); if (notice) text(content, 'p', () => noticeText(latestNotice)); position();
    } catch (e) { if (own === generation && content) { content.replaceChildren(); text(content, 'p', () => (M(e.message) || T('readFailed'))); position(); } }
  }
  function toggleBubble(anchorRoot) {
    if (mode !== 'subscription') return false;
    if (card) { close(); return true; }
    root = anchorRoot?.querySelector ? anchorRoot : document;
    card = document.createElement('section'); card.className = 'whale-account-card'; B(card, 'aria-label', () => T('subscriptionDetails'));
    const header = text(card, 'div', ''); header.className = 'whale-account-header'; text(header, 'strong', () => (T('subscriptionDetails')));
    const closeButton = text(header, 'button', () => (T('close'))); closeButton.onclick = close;
    content = text(card, 'div', ''); const refreshButton = text(card, 'button', () => (T('refresh'))); refreshButton.onclick = refresh;
    document.body.append(card); followCard(card); refresh(); return true;
  }
  function notice(value) {
    if (mode !== 'subscription') return;
    latestNotice = value;
    const message = noticeText(value);
    if (message) window.whaleToast?.(message);
    if (card) refresh();
  }
  function init() {
    const style = document.createElement('style'); style.textContent = `.whale-account-card{position:fixed;z-index:2147483646;width:280px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:14px;border:1px solid var(--gpt-focus);border-radius:16px;background:var(--gpt-surface);color:var(--gpt-ink);box-shadow:0 8px 26px rgba(var(--gpt-ink-rgb),.2);font:13px/1.5 system-ui;pointer-events:auto}.whale-account-card p{margin:8px 0}.whale-account-card small{display:block;color:var(--gpt-accent)}.whale-account-card progress{width:100%;accent-color:var(--gpt-accent)}.whale-account-header{display:flex;justify-content:space-between;align-items:center}.whale-account-card button,.whale-account-menu button{cursor:pointer;border:1px solid var(--gpt-focus);border-radius:8px;padding:5px 9px;background:var(--gpt-surface);color:var(--gpt-ink)}.whale-account-menu{font:12px/1.5 system-ui;padding:5px}.whale-account-menu summary{cursor:pointer}.whale-account-menu button[aria-pressed=true]{background:var(--gpt-accent);color:white}.whale-account-menu small{display:block;max-width:230px;margin-top:5px}`; document.head.append(style);
    const menu = document.querySelector('.dshwv-menu');
    if (menu) {
      const details = text(menu, 'section', ''); details.className = 'whale-account-menu'; text(details, 'strong', () => (T('panelTitle'))); menu.prepend(details);
      const row = text(details, 'div', ''); row.setAttribute('role', 'group'); B(row, 'aria-label', () => T('modeGroup'));
      for (const [value, label] of [['api', 'apiBalance'], ['subscription', 'subscription']]) { const button = text(row, 'button', () => T(label)); button.dataset.mode = value; button.onclick = () => setMode(value); modeButtons.push(button); }
      text(details, 'p', '').className = 'whale-mode-description';
      const open = text(details, 'button', ''); open.className = 'whale-mode-open'; open.onclick = () => window.dispatchEvent(new Event(mode === 'subscription' ? 'whale-open-insights' : 'whale-open-settings'));
      status = text(details, 'small', () => (T('modeHelp'))); status.setAttribute('role', 'status'); updateButtons();
      const view = menu.querySelector('.dshwv-menuview');
      if (view) {
        const languageRow = text(view, 'div', ''); languageRow.className = 'dshwv-menu-row whale-language-row'; languageRow.dataset.settingsGroup = 'appearance';
        const languageLabel = text(languageRow, 'label', () => T('language')); languageLabel.htmlFor = 'whale-language';
        const language = document.createElement('select'); language.id = 'whale-language';
        language.add(new Option('中文', 'zh-CN')); language.add(new Option('English', 'en')); language.value = window.WhaleI18n.locale;
        B(language, 'aria-label', () => T('language')); language.onchange = () => { if (!window.WhaleI18n.setLocale(language.value)) { language.value = window.WhaleI18n.locale; window.whaleToast?.(T('storageFailed')); } };
        languageRow.append(language); text(languageRow, 'small', () => T('languageHelp'));
        window.WhaleI18n.onChange(() => { language.value = window.WhaleI18n.locale; position(); });
        const rows = [...view.children];
        const groups = ['appearanceGroup', 'feedbackGroup', 'resourcesGroup'].map(label => {
          const group = document.createElement('details'); group.className = 'whale-menu-group'; group.dataset.settingsGroup = {appearanceGroup:'appearance',feedbackGroup:'feedback',resourcesGroup:'resources'}[label];
          text(group, 'summary', () => T(label)); view.append(group); return group;
        });
        groups[0].open = true;
        for (const child of rows) {
          if (child.classList.contains('dshwv-menu-sep')) { child.remove(); continue; }
          const index = child.dataset.settingsGroup === 'feedback' ? 1 : child.dataset.settingsGroup === 'resources' ? 2 : 0;
          groups[index].append(child);
        }
      }
    }
    const initialRevision = modeRevision;
    fetch('/api/display-mode', { cache: 'no-store' }).then(async response => { if (!response.ok) return; const data = await response.json(); const next = data.mode || data.displayMode; if (validMode(next) && !switching && modeRevision === initialRevision) commit(next); }).catch(() => {});
    window.addEventListener('resize', position);
    window.addEventListener('whale-mode-changing', close);
  }
  window.WhaleAccountView = { get mode() { return mode; }, toggleBubble, refresh, notice, close, setMode, quotaLabel };
  // Deferred scripts run at readyState=interactive before the widget creates its menu.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
