(() => {
  'use strict';
  const T = (key, params) => globalThis.WhaleI18n?.t('panels.' + key, params) ?? key;
  const B = (el, prop, read) => globalThis.WhaleI18n?.bind(el, prop, read) ?? (el[prop] = read());
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  const $ = id => document.getElementById(id);
  let toastTimer;
  const privateFields = ['baseUrl', 'keyEnv', 'profile', 'projectDir', 'dashboardUrl', 'balancePath', 'balanceField', 'usedField'];
  const resetFields = new Set();
  function toast(message) { B($('toast'), 'textContent', () => M(message)); $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000); }
  window.whaleToast = toast;
  async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const result = await response.json();
    if (result.ok === false) throw new Error(M(result.error) || T('incomplete'));
    return result;
  }
  const form = $('settings-form');
  const element = name => form.elements.namedItem(name);
  for (const key of privateFields) {
    const input = element(key), reset = document.createElement('button');
    input.autocomplete = 'off'; input.spellcheck = false;
    reset.type = 'button'; reset.className = 'private-reset'; B(reset, 'textContent', () => T('resetDefault'));
    reset.dataset.resetField = key;
    B(reset, 'aria-label', () => T('resetField', { field: globalThis.WhaleI18n.t(input.closest('label').querySelector('[data-i18n]')?.dataset.i18n || key) }));
    reset.addEventListener('click', () => {
      resetFields.add(key); input.value = ''; B(input, 'placeholder', () => T('resetPending')); input.focus();
    });
    input.addEventListener('input', () => { if (input.value.trim()) resetFields.delete(key); });
    input.insertAdjacentElement('afterend', reset);
  }
  async function openSettings() {
    try {
      const info = await api('/api/config'), settings = info.settings;
      resetFields.clear();
      for (const key of ['provider', 'currency', 'balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) element(key).value = settings[key] ?? '';
      for (const key of privateFields) {
        element(key).value = '';
        B(element(key), 'placeholder', () => info.configured?.[key] ? T('configuredPlaceholder') : T('defaultPlaceholder'));
      }
      element('monitorSessions').checked = settings.monitorSessions;
      for (const key of ['priceModel', 'priceInput', 'priceCached', 'priceOutput', 'priceWrite']) element(key).value = '';
      element('removePrice').checked = false;
      $('settings-error').hidden = true; $('settings-dialog').showModal();
    } catch (error) { toast(error.message); }
  }
  window.addEventListener('whale-open-settings', openSettings);
  for (const id of ['close-settings', 'cancel-settings']) $(id).addEventListener('click', () => $('settings-dialog').close());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const settings = {};
      for (const key of ['provider', 'currency']) settings[key] = element(key).value.trim();
      for (const key of privateFields) {
        const value = element(key).value.trim();
        if (value) settings[key] = value;
        else if (resetFields.has(key)) settings[key] = key === 'balanceField' ? 'data.balance' : '';
      }
      for (const key of ['balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) settings[key] = Number(element(key).value);
      settings.monitorSessions = element('monitorSessions').checked;
      const fields = ['priceInput', 'priceCached', 'priceOutput'];
      const hasPrice = [...fields, 'priceWrite'].some(key => element(key).value !== '');
      const model = element('priceModel').value.trim();
      if (element('removePrice').checked) {
        if (!model || hasPrice) throw new Error(T('priceDeleteError'));
        settings.pricingUpdate = { model, prices: null };
      } else if (hasPrice) {
        if (!model || fields.some(key => element(key).value === '')) throw new Error(T('priceRequired'));
        const prices = { input: Number(element('priceInput').value), cachedInput: Number(element('priceCached').value), output: Number(element('priceOutput').value) };
        if (element('priceWrite').value !== '') prices.cacheWrite = Number(element('priceWrite').value);
        settings.pricingUpdate = { model, prices };
      } else if (model) throw new Error(T('priceIncomplete'));
      await api('/api/config', 'PUT', settings); location.reload();
    } catch (error) { $('settings-error').hidden = false; B($('settings-error'), 'textContent', () => M(error.message)); }
  });
})();
