(() => {
  'use strict';
  const I = window.WhaleI18n, T = (key, params) => I.t('panels.' + key, params);
  const key = 'dshw-v3-feedback', events = ['press', 'release', 'success', 'cancelled'];
  const defaults = () => ({ feel: 'balanced', events: Object.fromEntries(events.map(k => [k, { preset: ['press', 'release', 'success'].includes(k) ? 'original' : 'silent', volume: .8 }])) });
  let settings = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) {
      if (['balanced', 'crisp', 'soft'].includes(saved.feel)) settings.feel = saved.feel;
      for (const event of events) if (saved.events?.[event]) settings.events[event] = saved.events[event];
    }
  } catch {}
  // Failed turns keep accounting records but have no special sound event or control.
  function play(event, url, master = 1, override) {
    const cfg = (override || settings).events[event];
    if (!cfg) return false;
    window.WhaleAudio.play({ channel: event === 'press' || event === 'release' ? 'gesture' : 'notice', url: Array.isArray(url) ? undefined : url, urls: Array.isArray(url) ? url : undefined, preset: cfg.preset, volume: cfg.preset === 'silent' ? 0 : cfg.volume * master });
    return true;
  }
  function text(parent, tag, key) {
    const el = document.createElement(tag); I.bind(el, 'textContent', () => T(key)); parent.append(el); return el;
  }
  function option(select, value) {
    const el = new Option('', value); I.bind(el, 'textContent', () => T(value)); select.add(el);
  }
  function open() {
    const draft = JSON.parse(JSON.stringify(settings)), dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    text(dialog, 'h2', 'feedbackTitle'); text(dialog, 'p', 'feedbackHelp');
    const feelLabel = document.createElement('label'); text(feelLabel, 'span', 'pressFeel');
    const feel = document.createElement('select'); for (const value of ['balanced', 'crisp', 'soft']) option(feel, value);
    feel.value = draft.feel; feel.onchange = () => { draft.feel = feel.value; }; feelLabel.append(feel); dialog.append(feelLabel);
    for (const event of events) {
      const row = document.createElement('fieldset'); text(row, 'legend', event);
      const select = document.createElement('select');
      for (const value of ['original', 'pearl', 'bubble', 'glass', 'silent']) {
        if (value === 'original' && !['press', 'release', 'success'].includes(event)) continue;
        option(select, value);
      }
      select.value = draft.events[event].preset; select.onchange = () => { draft.events[event].preset = select.value; };
      const volume = document.createElement('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '.01'; volume.value = draft.events[event].volume;
      I.bind(volume, 'aria-label', () => T('volumeLabel', { label: T(event) }));
      const number = document.createElement('output'); I.bind(number, 'textContent', () => I.number(Math.round(Number(volume.value) * 100)) + '%');
      volume.oninput = () => { draft.events[event].volume = Number(volume.value); number.textContent = I.number(Math.round(Number(volume.value) * 100)) + '%'; };
      const preview = document.createElement('button'); preview.type = 'button'; I.bind(preview, 'textContent', () => T('preview'));
      preview.onclick = () => play(event, window.WhaleFeedbackSources?.[event] || '/dsh-whale/sound/press.mp3?set=duck', 1, draft);
      row.append(select, volume, number, preview); dialog.append(row);
    }
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const cancel = text(actions, 'button', 'cancel'); cancel.onclick = () => dialog.close();
    const save = text(actions, 'button', 'save'); save.className = 'primary';
    save.onclick = () => { try { localStorage.setItem(key, JSON.stringify(draft)); settings = draft; dialog.close(); } catch { window.whaleToast?.(T('storageFailed')); } };
    dialog.append(actions); dialog.addEventListener('close', () => { window.WhaleAudio.stop(); dialog.remove(); }); document.body.append(dialog); dialog.showModal();
  }
  window.WhaleFeedback = { play, open, get feel() { return settings.feel; } };
})();
