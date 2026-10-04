(() => {
  'use strict';
  const T = (key, params) => globalThis.WhaleI18n?.t('panels.' + key, params) ?? key;
  const B = (el, prop, read) => globalThis.WhaleI18n?.bind(el, prop, read) ?? (el[prop] = read());
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  function text(parent, tag, value) { const el = document.createElement(tag); B(el, 'textContent', typeof value === 'function' ? value : () => value); parent.append(el); return el; }
  function time(value) { if (!value) return T('unknown'); const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? window.WhaleI18n.date(d) : T('unknown'); }
  function switchDesktop(command) {
    const expected=command==='desktop'?'standalone':'follow-codex';
    return new Promise((resolve,reject)=>{
      const clean=()=>{clearTimeout(timer);window.removeEventListener('whale-desktop-mode',done);};
      const done=e=>{if(e.detail===expected){clean();requestAnimationFrame(()=>requestAnimationFrame(resolve));}};
      const timer=setTimeout(()=>{clean();reject(Error(T('switchTimeout')));},8000);
      window.addEventListener('whale-desktop-mode',done);
      window.dispatchEvent(new Event('whale-mode-changing'));
      Promise.resolve(window.whaleDesktop.command(command)).then(result=>{if(result===false||result?.ok===false){clean();reject(Error(T('switchIncomplete')));}},e=>{clean();reject(e);});
    });
  }
  function open() {
    const dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    text(dialog, 'h2', () => (window.WhaleAccountView?.mode==='subscription'?T('memberDetails'):T('peakTitle'))); const content = document.createElement('div'); dialog.append(content);
    const actions = document.createElement('div'); actions.className = 'dialog-actions'; const refresh = text(actions, 'button', () => (T('refresh'))), close = text(actions, 'button', () => (T('close'))); dialog.append(actions);
    let generation = 0;
    async function load() {
      const own = ++generation; refresh.disabled = true; content.replaceChildren(); text(content, 'p', () => (T('loading')));
      try {
        const response = await fetch('/api/insights', { cache: 'no-store' }); if (!response.ok) throw Error(T('quotaUnavailable')); const data = await response.json();
        if (own !== generation || !dialog.isConnected) return; content.replaceChildren(); const sub = data.subscription || {};
        if(window.WhaleAccountView?.mode!=='subscription') {
          const p=data.pricing||{};
          if(p.visible){text(content,'p', () => (p.phase==='peak'?T('peak'):p.phase==='off-peak'?T('offPeak'):T('rulesPending')));text(content,'p', () => (T('nextChange',{date:time(p.nextChangeAt)})));text(content,'p', () => (M(p.note)));}
          else text(content,'p', () => (T('noPeak')));
          return;
        }
        text(content, 'h3', () => (T('subscription')));
        if (!sub.available) text(content, 'p', () => (M(sub.reason) || T('subscriptionRecordsMissing')));
        for (const item of sub.windows || []) {
          const box = document.createElement('section'); content.append(box);
          const valid = item.usedPercent !== null && item.usedPercent !== undefined && Number.isFinite(Number(item.usedPercent));
          text(box, 'strong', () => (window.WhaleAccountView.quotaLabel(item)));
          text(box, 'p', () => (valid ? T('quotaUsage',{used:Number(item.usedPercent).toFixed(1),remaining:Math.max(0,100-Number(item.usedPercent)).toFixed(1),stale:item.stale?T('dataStale'):''}) : T('quotaUnknown')));
          if (valid) { const progress = document.createElement('progress'); progress.max = 100; progress.value = Math.max(0, Math.min(100, item.usedPercent)); B(progress,'aria-label',()=>M(item.label) || T('quota')); box.append(progress); }
          text(box, 'p', () => (T('resetTime',{date:time(item.resetsAt)})));
        }
        text(content, 'h3', () => (T('localTokens7d'))); const tokens = sub.tokens || data.tokens || {};
        for (const [key, label] of Object.entries({ total: 'total', input: 'input', output: 'output', cachedInput: 'cachedInput', reasoningOutput: 'reasoningOutput' })) text(content, 'p', () => (T('namedValue',{label:T(label),value:Number.isFinite(tokens[key])?window.WhaleI18n.number(tokens[key]):T('noRecords')})));
        if (Number.isFinite(tokens.last5Hours)) text(content, 'p', () => (T('local5h',{tokens:T(tokens.last5Hours===1?'tokenCountOne':'tokenCountOther',{count:window.WhaleI18n.number(tokens.last5Hours)})})));
        if (tokens.complete === false) text(content, 'p', () => (T('scanIncomplete') + M(tokens.note)));
        text(content, 'small', () => (T('insightsDisclaimer')));
        const pricing = data.pricing || {};
      } catch (error) { if (own === generation) { content.replaceChildren(); text(content, 'p', () => (M(error.message) || T('readFailed'))); } }
      finally { if (own === generation) refresh.disabled = false; }
    }
    refresh.onclick = load; close.onclick = () => dialog.close(); dialog.onclose = () => { generation++; dialog.remove(); }; document.body.append(dialog); dialog.showModal(); load();
  }
  const menu = document.querySelector('.dshwv-menu');
  if (menu) {
    const container = menu.querySelector('.dshwv-menu-root') || menu.firstElementChild || menu;
    const row = document.createElement('div'); row.className = 'dshwv-menu-row';
    const feedback = text(row, 'button', () => (T('soundFeel'))), insights = text(row, 'button', () => (T('memberDetails'))); feedback.className = insights.className = 'dshwv-sound';
    feedback.onclick = () => window.WhaleFeedback.open(); insights.onclick = open; container.append(row);
    const accountModeChanged=async()=>{
      const member=window.WhaleAccountView?.mode==='subscription';B(insights,'textContent',()=>window.WhaleAccountView?.mode==='subscription'?T('memberDetails'):T('pricingPeriods'));insights.hidden=!member;
      if(!member){try{const p=await fetch('/api/pricing').then(r=>r.json());if(window.WhaleAccountView?.mode!=='subscription')insights.hidden=!p.visible;}catch{}}
    };
    accountModeChanged(); window.addEventListener('whale-account-view',accountModeChanged);setInterval(accountModeChanged,60000);
    if (window.whaleDesktop?.command) {
      const modeRow = document.createElement('div'); modeRow.className = 'dshwv-menu-row';
      for (const [command, label] of [['desktop', 'enterDesktop'], ['follow', 'followCodex']]) {
        const button = text(modeRow, 'button', () => T(label)); button.className = 'dshwv-sound';
        button.onclick = async () => { button.disabled=true; try { await switchDesktop(command); window.whaleToast?.(command === 'desktop' ? T('desktopModeSet') : T('followModeSet')); } catch (e) { window.whaleToast?.(M(e.message)); } finally {button.disabled=false;} };
      }
      container.append(modeRow);
    }
  }
  window.addEventListener('whale-open-insights', open);
})();
