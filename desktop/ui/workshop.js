(() => {
  'use strict';
  const T = (key, params) => globalThis.WhaleI18n?.t('panels.' + key, params) ?? key;
  const B = (el, prop, read) => globalThis.WhaleI18n?.bind(el, prop, read) ?? (el[prop] = read());
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  const limit = 24 * 1024 * 1024;
  function element(tag, text) { const el = document.createElement(tag); if (text) B(el, 'textContent', typeof text === 'function' ? text : () => text); return el; }
  function open() {
    const dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    dialog.append(element('h2', () => (T('workshopTitle'))), element('p', () => (T('workshopHelp'))));
    const steps=element('ol');
    for(const line of ['workshopStep1','workshopStep2','workshopStep3'])steps.append(element('li', () => T(line)));
    dialog.append(steps,element('p', () => (T('workshopFormat'))));
    const preview=element('div');preview.className='workshop-preview';dialog.append(preview);
    const status = element('p'); status.setAttribute('role', 'status');
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; B(file,'aria-label',()=>T('selectPack'));
    // Native file control labels follow the OS, so expose our localized picker.
    file.hidden = true;
    const filePicker = element('div'); filePicker.className = 'workshop-file-picker';
    const chooseFile = element('button', () => T('chooseFile')); chooseFile.type = 'button'; chooseFile.onclick = () => file.click(); B(chooseFile, 'aria-label', () => T('selectPack'));
    const fileName = element('span');
    const updateFileName = () => B(fileName, 'textContent', () => file.files?.[0]?.name || T('noFileSelected'));
    updateFileName(); filePicker.append(file, chooseFile, fileName);
    const importButton = element('button', () => (T('importPack'))); importButton.disabled = true; let selected;
    file.onchange = async () => { updateFileName(); selected = null; importButton.disabled = true; const candidate = file.files?.[0]; if (!candidate) return; if (candidate.size > limit) { B(status,'textContent',()=>T('packTooLarge')); return; }
      try { const parsed = JSON.parse(await candidate.text()); if (parsed.schema !== 'api-balance-whale-workshop' || parsed.version !== 1) throw Error(T('unsupportedPack')); selected = parsed; preview.replaceChildren(); B(status,'textContent',()=>['roles','images','fragments','groups'].map((k,i) => [T('roles'),T('images'),T('audioFragments'),T('soundGroups')][i] + ' ' + window.WhaleI18n.number(Array.isArray(parsed[k]) ? parsed[k].length : 0)).join(' · ')); for(const [kind,label] of [['roles','roles'],['images','bubbleImages'],['fragments','audio'],['groups','soundGroups']])for(const item of (Array.isArray(parsed[kind])?parsed[kind]:[]).slice(0,30))preview.append(element('p', () => (T('namedValue',{label:T(label),value:String(item.name||T('unnamed')).slice(0,100)})))); importButton.disabled = false; } catch { B(status,'textContent',()=>T('invalidPack')); preview.replaceChildren(); }
    };
    importButton.onclick = async () => { if (!selected) return; importButton.disabled = true;
      try { const response = await fetch('/api/workshop/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected) }); const result = await response.json(); if (!response.ok || result.ok === false) throw Error(M(result.error) || T('importIncomplete')); B(status,'textContent',()=>T('importComplete')); selected = null; file.value = ''; updateFileName(); reload.hidden = false; } catch (error) { B(status,'textContent',()=>M(error.message)); importButton.disabled = false; }
    };
    const exportButton = element('button', () => (T('exportAssets'))); exportButton.onclick = async () => { exportButton.disabled = true; try { const response = await fetch('/api/workshop/export', { cache: 'no-store' }); const pack = await response.json(); if (!response.ok || pack.ok === false) throw Error(M(pack.error) || T('exportIncomplete')); const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }); if (blob.size > limit) throw Error(T('exportTooLarge')); const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = 'whale-workshop.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); B(status,'textContent',()=>T('exportComplete')); } catch (error) { B(status,'textContent',()=>M(error.message)); } finally { exportButton.disabled = false; } };
    const reload = element('button', () => (T('reloadAssets'))); reload.hidden = true; reload.onclick = () => location.reload();
    const close = element('button', () => (T('close'))); close.onclick = () => dialog.close(); const actions = element('div'); actions.className = 'dialog-actions'; actions.append(exportButton, importButton, reload, close); dialog.append(filePicker, status, actions); dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();
  }
  const menu = document.querySelector('.dshwv-menuview'); if (menu) { const row = element('div'); row.className = 'dshwv-menu-row'; row.dataset.settingsGroup = 'resources'; const button = element('button', () => (T('workshopTitle'))); button.className = 'dshwv-sound'; button.onclick = open; row.append(button); menu.append(row); }
})();
