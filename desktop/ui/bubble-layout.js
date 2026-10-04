(() => {
  'use strict';

  // One measured layout for live buffers and editor previews. This module never
  // selects content, restarts GIFs, changes a notice timer, or writes preferences.
  const entries = new Map();
  const TEXT = '.dshwv-label,.dshwv-amount,.dshwv-hint,.dshwv-trow';
  const HIDDEN = 'dshwv-fit-suppressed';
  const MIN_FONT = 12;
  // Electron's Intl.Segmenter preserves combining marks and emoji ZWJ families
  // when the display summary has to end before the original message does.
  const graphemes = new Intl.Segmenter(undefined, { granularity:'grapheme' });
  let scheduled = 0;
  const english = () => (window.WhaleI18n?.locale || document.documentElement.lang || '').startsWith('en');
  const copy = (key, zh, en) => {
    const id = 'layout.' + key;
    const translated = window.WhaleI18n?.t?.(id);
    return translated && translated !== id ? translated : english() ? en : zh;
  };
  const shown = el => !!el && getComputedStyle(el).display !== 'none' && !el.closest('.' + HIDDEN);
  const set = (el, name, value) => { if (el.style[name] !== value) el.style[name] = value; };

  function dimensions(content, preview) {
    if (preview) return;
    const pop = content.closest('.dshwv-pop');
    const root = pop?.closest('.dshwv-root');
    if (!pop || !root) return;
    // A small character must not force its text below readable UI sizes.
    const width = Math.max(80, Math.min(Math.max(320, root.offsetWidth), innerWidth - 16, (innerHeight - 16) * 1026 / 700));
    set(pop, 'width', width.toFixed(3) + 'px');
    pop.style.setProperty('--dshw-u', (width / 1026).toFixed(6) + 'px');
    place(pop, root);
  }

  function place(pop, root) {
    // Compute in screen coordinates, then undo only the root's mirror. We never
    // change the character's position, persisted anchors, or animation transform.
    const previousX = parseFloat(pop.style.left) || 0;
    const previousY = parseFloat(pop.style.top) || 0;
    const matrix = getComputedStyle(root).transform;
    const rootMatrix = matrix === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(matrix);
    const bodyTransform = getComputedStyle(pop.parentElement).transform;
    const bodyMatrix = bodyTransform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(bodyTransform);
    const scaleX = rootMatrix.a * bodyMatrix.a;
    const scaleY = rootMatrix.d * bodyMatrix.d;
    // The mirror animation briefly crosses zero. Defer that singular frame;
    // the presentation loop resumes placement on the next usable transform.
    if (Math.abs(scaleX) < .05 || Math.abs(scaleY) < .05) return;
    const r = pop.getBoundingClientRect();
    const baseLeft = r.left - previousX * scaleX;
    const baseTop = r.top - previousY * scaleY;
    const x = Math.max(8, Math.min(baseLeft, innerWidth - r.width - 8));
    const y = Math.max(8, Math.min(baseTop, innerHeight - r.height - 8));
    set(pop, 'left', ((x - baseLeft) / scaleX).toFixed(3) + 'px');
    set(pop, 'top', ((y - baseTop) / scaleY).toFixed(3) + 'px');
  }

  function inspect(content) {
    const safe = content.getBoundingClientRect();
    const rectangles = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || !shown(node.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > .1 && rect.height > .1) rectangles.push(rect);
      }
    }
    for (const image of content.querySelectorAll('img')) if (shown(image)) rectangles.push(image.getBoundingClientRect());
    const overflow = rectangles.some(r => r.left < safe.left - .75 || r.right > safe.right + .75 || r.top < safe.top - .75 || r.bottom > safe.bottom + .75);
    return { overflow, width: safe.width, height: safe.height, rectangles: rectangles.map(r => ({ left:r.left, top:r.top, right:r.right, bottom:r.bottom })) };
  }

  function restore(entry) {
    for (const el of entry.generated) el.remove();
    entry.generated.length = 0;
    for (const el of entry.suppressed) el.classList.remove(HIDDEN);
    entry.suppressed.length = 0;
    for (const [el, styles] of entry.styles) for (const [name, value] of Object.entries(styles)) set(el, name, value);
    entry.styles.clear();
  }

  function remember(entry, el, names) {
    const saved = entry.styles.get(el) || {};
    for (const name of names) if (!(name in saved)) saved[name] = el.style[name];
    entry.styles.set(el, saved);
  }

  function suppress(entry, el) {
    el.classList.add(HIDDEN);
    entry.suppressed.push(el);
  }

  function sourceText(entry) {
    // Read the actual source nodes, including hidden long messages. Their text
    // and money bindings stay intact even when a compact summary is displayed.
    return [...entry.content.children].filter(el => (!entry.generated.includes(el) && getComputedStyle(el).display !== 'none') || entry.suppressed.includes(el))
      .map(el => el.textContent).filter(text => text.trim()).join('\n\n');
  }

  function showDetails(entry) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dshwv-message-details';
    dialog.setAttribute('aria-label', copy('fullMessage', '完整消息', 'Full message'));
    window.WhaleI18n?.bind?.(dialog, 'aria-label', () => copy('fullMessage', '完整消息', 'Full message'));
    const heading = document.createElement('h2');
    heading.textContent = copy('fullMessage', '完整消息', 'Full message');
    window.WhaleI18n?.bind?.(heading, 'textContent', () => copy('fullMessage', '完整消息', 'Full message'));
    const text = document.createElement('div');
    text.className = 'dshwv-message-details-text';
    text.textContent = sourceText(entry);
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'primary';
    close.textContent = copy('closeMessage', '关闭', 'Close');
    window.WhaleI18n?.bind?.(close, 'textContent', () => copy('closeMessage', '关闭', 'Close'));
    close.addEventListener('click', () => dialog.close());
    dialog.append(heading, text, close);
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once:true });
    dialog.showModal();
  }

  function detailsButton(entry) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'dshwv-details-link';
    button.setAttribute('aria-haspopup', 'dialog');
    button.textContent = copy('viewDetails', '查看详情', 'View details');
    button.addEventListener('pointerdown', e => e.stopPropagation());
    button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showDetails(entry); });
    entry.content.appendChild(button); entry.generated.push(button);
    return button;
  }

  function summary(entry) {
    const originals = [...entry.content.children].filter(shown);
    const protectedRows = originals.filter(el => el.matches('.dshwv-amount,[data-bubble-module="balance"],[data-bubble-module="today"]') || el.querySelector('[data-bubble-module="balance"],[data-bubble-module="today"]'));
    const prose = originals.filter(el => !protectedRows.includes(el) && el.tagName !== 'IMG' && el.textContent.trim());
    const originalProse = prose.map(el => el.textContent.trim()).join(' ');
    const first = prose[0];
    // A summary is a separate display node. Never replace or truncate stored
    // templates, currency amounts, live bindings, or a user's original text.
    for (const el of prose) suppress(entry, el);
    const brief = document.createElement('div');
    brief.className = 'dshwv-fit-brief';
    const points = [...graphemes.segment(originalProse)].map(part => part.segment);
    brief.textContent = points.length > 64 ? points.slice(0, 64).join('') + '…' : originalProse;
    if (brief.textContent) {
      entry.content.insertBefore(brief, first || entry.content.firstChild);
      entry.generated.push(brief);
    }
    const button = detailsButton(entry);
    if (!inspect(entry.content).overflow) return;
    brief.textContent = points.length > 30 ? points.slice(0, 30).join('') + '…' : originalProse;
    if (!inspect(entry.content).overflow) return;
    brief.remove();
    // Tiny viewports and six-row custom templates cannot show everything at a
    // readable font size. Keep complete primary amounts, put extra rows in the
    // explicit detail view, and never use ellipsis on a currency amount.
    for (const image of originals.filter(el => el.tagName === 'IMG')) {
      suppress(entry, image);
      if (!inspect(entry.content).overflow) return;
    }
    for (let i = protectedRows.length - 1; i >= 0 && inspect(entry.content).overflow; i--) suppress(entry, protectedRows[i]);
    // The detail affordance is the last readable state, not clipped content.
    button.dataset.bubbleCompact = 'true';
  }

  function fit(content, options = {}) {
    if (!content?.isConnected) return null;
    let entry = entries.get(content);
    if (!entry) {
      entry = { content, options, styles:new Map(), generated:[], suppressed:[], observer:null, resize:null };
      entries.set(content, entry);
    } else entry.options = { ...entry.options, ...options };
    entry.observer?.disconnect();
    try {
      restore(entry);
      dimensions(content, entry.options.preview);
      content.classList.add('dshwv-fit-content');
      const nodes = [...content.querySelectorAll(TEXT)].filter(shown);
      const sizes = nodes.map(el => {
        remember(entry, el, ['fontSize']);
        return Math.max(MIN_FONT, parseFloat(getComputedStyle(el).fontSize) || MIN_FONT);
      });
      const images = [...content.querySelectorAll('img')].filter(shown);
      const imageSizes = images.map(el => {
        remember(entry, el, ['maxHeight', 'maxWidth']);
        return Math.min(el.getBoundingClientRect().height || el.naturalHeight || 128, content.clientHeight);
      });
      for (const factor of [1, .94, .88, .82, .76, .70, .64, .58]) {
        nodes.forEach((el, i) => set(el, 'fontSize', Math.max(MIN_FONT, sizes[i] * factor).toFixed(2) + 'px'));
        images.forEach((el, i) => {
          set(el, 'maxHeight', Math.min(content.clientHeight, Math.max(32, imageSizes[i] * factor)).toFixed(2) + 'px');
          set(el, 'maxWidth', content.clientWidth + 'px');
        });
        if (!inspect(content).overflow) break;
      }
      if (inspect(content).overflow) summary(entry);
      const result = inspect(content);
      content.dataset.bubbleOverflow = String(result.overflow);
      content.dataset.bubbleSummary = String(entry.suppressed.length > 0);
      return result;
    } finally {
      entry.observer?.observe(content, { childList:true, characterData:true, subtree:true });
    }
  }

  function requestAll() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = 0;
      for (const [content, entry] of entries) {
        if (!content.isConnected) { entry.observer?.disconnect(); entry.resize?.disconnect(); entries.delete(content); continue; }
        fit(content, entry.options);
      }
    });
  }

  function observe(content, options = {}) {
    fit(content, options);
    const entry = entries.get(content);
    if (!entry || entry.observer) return;
    entry.observer = new MutationObserver(requestAll);
    entry.observer.observe(content, { childList:true, characterData:true, subtree:true });
    entry.resize = new ResizeObserver(requestAll);
    entry.resize.observe(content);
    const character = content.closest('.dshwv-root');
    if (character) entry.resize.observe(character);
    for (const img of content.querySelectorAll('img')) if (!img.complete) img.addEventListener('load', requestAll, { once:true });
    document.fonts?.ready.then(requestAll);
  }

  function reset(content) {
    const entry = entries.get(content);
    if (!entry) return;
    entry.observer?.disconnect();
    restore(entry);
    entry.observer?.observe(content, { childList:true, characterData:true, subtree:true });
  }

  window.addEventListener('resize', requestAll);
  window.addEventListener('whale-locale-change', requestAll);
  window.addEventListener('whale-locale-changed', requestAll);
  window.addEventListener('whale-language-change', requestAll);
  document.fonts?.addEventListener('loadingdone', requestAll);
  document.addEventListener('transitionend', event => {
    if (event.target.matches?.('.dshwv-root,.dshwv-body,.dshwv-position')) requestAll();
  });
  window.addEventListener('pagehide', () => {
    for (const entry of entries.values()) { entry.observer?.disconnect(); entry.resize?.disconnect(); }
    entries.clear();
  }, { once:true });
  window.WhaleBubbleLayout = Object.freeze({ fit, observe, inspect, requestAll, place, reset });
})();
