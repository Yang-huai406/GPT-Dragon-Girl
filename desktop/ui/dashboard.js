(() => {
  'use strict';
  const T = (key, params) => globalThis.WhaleI18n?.t('panels.' + key, params) ?? key;
  const B = (el, prop, read) => globalThis.WhaleI18n?.bind(el, prop, read) ?? (el[prop] = read());
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  function init() {
    const menu=document.querySelector('.dshwv-menu'), account=window.WhaleAccountView;
    if(!menu||!account||!window.WhaleLegacyUsage)return;
    const settings=menu.querySelector('.dshwv-menuview'),usageArea=menu.querySelector('.dshwv-usage-area'),header=menu.querySelector('.whale-account-menu');
    if(!settings||!usageArea||!header)return;
    const originalControls=[...settings.querySelectorAll('button,input,select,textarea')];
    menu.classList.add('whale-dashboard');B(header.querySelector('strong'),'textContent',()=>T('brand'));
    let page='overview',generation=0,balance=null,insights=null,lastNotice=null;
    const el=(parent,tag,value,cls)=>{const e=document.createElement(tag);if(value)B(e,'textContent',typeof value === 'function' ? value : () => value);if(cls)e.className=cls;parent.append(e);return e;};
    const nav=el(menu,'nav','','whale-dashboard-tabs');nav.setAttribute('role','tablist');B(nav,'aria-label',()=>T('navLabel'));header.after(nav);
    const scroll=el(menu,'div','','whale-dashboard-scroll');
    const overview=el(scroll,'section','','whale-overview');
    const overviewData=el(overview,'div','','whale-overview-data');
    const actions=el(overview,'div','','whale-dashboard-actions');
    const refreshButton=el(actions,'button', () => (T('refresh')));refreshButton.onclick=()=>refresh(true);
    const modeOpen=header.querySelector('.whale-mode-open');actions.append(modeOpen);
    const usage=el(scroll,'section','','whale-usage-page');usage.append(usageArea);
    const tokenUsage=el(usage,'section','','whale-token-usage');
    scroll.append(settings);settings.classList.add('whale-settings-page');
    // The legacy navigation button remains available from the API overview.
    const legacyNav=[...menu.children].find(e=>e.matches('[data-account-api]'));
    if(legacyNav)overview.append(legacyNav);
    const tabs={};const panels={overview,usage,settings};
    for(const [name,label] of [['overview','overview'],['usage','usage'],['settings','settings']]){
      const button=el(nav,'button', () => T(label));button.id='whale-tab-'+name;button.dataset.page=name;button.setAttribute('role','tab');button.setAttribute('aria-controls','whale-page-'+name);button.onclick=()=>select(name);tabs[name]=button;
      panels[name].id='whale-page-'+name;panels[name].setAttribute('role','tabpanel');panels[name].setAttribute('aria-labelledby',button.id);
    }
    nav.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const keys=Object.keys(tabs),current=keys.indexOf(page);const next=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:2))%3;
      event.preventDefault();select(keys[next]);tabs[keys[next]].focus();
    });
    const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
    const token=value=>finite(value)?T(value===1?'tokenCountOne':'tokenCountOther',{count:window.WhaleI18n.number(value)}):T('noRecords');
    const date=value=>value&&Number.isFinite(new Date(value).getTime())?window.WhaleI18n.date(value):T('resetUnknown');
    const money=(value,currency=balance?.currency||'USD')=>{
      if(!finite(value))return T('unavailable');
      const converted=window.WhaleMoney.convert(value,currency);
      if(converted===null)return T('conversionUnavailable');
      return converted>0&&converted<.01?'＜'+window.WhaleMoney.symbol()+'0.01':window.WhaleMoney.formatMoney(value,currency);
    };
    function metric(parent,label,value){const box=el(parent,'div','','whale-metric');el(box,'span', label);el(box,'strong', value);return box;}
    function render(){
      overviewData.replaceChildren();tokenUsage.replaceChildren();
      if(account.mode==='subscription'){
        const sub=insights?.subscription||{},grid=el(overviewData,'div','','whale-quota-grid');
        for(const [minutes,label] of [[300,'quota5h'],[10080,'quotaWeek']]){
          const w=(sub.windows||[]).find(w=>w.windowDurationMins===minutes),box=el(grid,'section','','whale-quota-box');
          el(box,'span', () => T(label));el(box,'strong', () => (w&&finite(w.usedPercent)?T('remaining',{percent:Math.max(0,100-w.usedPercent).toFixed(1)}):T('notObserved')));
          if(w&&finite(w.usedPercent)){const progress=el(box,'progress');progress.max=100;progress.value=Math.max(0,100-w.usedPercent);B(progress,'aria-label',()=>T('quotaRemaining',{label:T(label)}));}
          el(box,'small', () => (w?T('resetAt',{date:date(w.resetsAt)}):T('waitingQuota')));if(w?.stale)el(box,'small', () => (T('staleQuota')));
        }
        if(!sub.available)el(overviewData,'p', () => (M(sub.reason)||T('readingQuota')),'whale-dashboard-note');
        metric(overviewData, () => (T('turnObserved')), () => (token(lastNotice?.tokens)));
        el(overviewData,'p', () => (T('quotaDisclaimer')),'whale-dashboard-note');
        el(tokenUsage,'h3', () => (T('localTokens')));
        const totals=sub.tokens||insights?.tokens||{};
        metric(tokenUsage, () => (T('rolling5h')), () => (token(totals.last5Hours)));metric(tokenUsage, () => (T('last7d')), () => (token(totals.total)));
        for(const [key,label] of [['input','input'],['output','output'],['cachedInput','cachedInput'],['reasoningOutput','reasoningOutput']])metric(tokenUsage, () => T(label), () => (token(totals[key])));
        el(tokenUsage,'p', () => (T('subsetDisclaimer')),'whale-dashboard-note');
        if(totals.complete===false)el(tokenUsage,'p', () => (T('partialScan')),'whale-dashboard-note');
        const details=el(tokenUsage,'button', () => (T('quotaDetailsButton')));details.onclick=()=>window.dispatchEvent(new Event('whale-open-insights'));
      }else{
        el(overviewData,'span', () => (T('currentBalance')),'whale-dashboard-label');
        el(overviewData,'strong', () => (balance?.unlimited?T('unlimited'):money(balance?.totalBalance)),'whale-balance-number');
        if(balance?.stale)el(overviewData,'p', () => (T('staleBalance')),'whale-dashboard-note');
        if(balance?.ok===false)el(overviewData,'p', () => (T('balanceUnavailable')),'whale-dashboard-note');
        metric(overviewData, () => (T('todayObserved')), () => (money(balance?.todayUsage)));
        metric(overviewData, () => (T('turnObserved')), () => (lastNotice?lastNotice.costState==='pending'?T('pending'):lastNotice.costState==='unknown'?T('amountUnknown'):money(lastNotice.amount,lastNotice.currency):T('noRecords')));
        el(overviewData,'p', () => (T('usagePageHelp')),'whale-dashboard-note');
      }
    }
    async function refresh(manual=false){
      const own=++generation,mode=account.mode;refreshButton.disabled=true;
      try{
        const response=await fetch(mode==='subscription'?'/api/insights':'/dsh-whale/balance.json'+(manual?'?refresh=1':''),{cache:'no-store'});
        if(!response.ok)throw Error(T('refreshFailed'));const data=await response.json();
        if(own!==generation||account.mode!==mode)return;
        if(mode==='subscription')insights=data;else balance=data;render();
      }catch{if(own===generation){if(mode==='api')balance={ok:false};render();}}
      finally{if(own===generation)refreshButton.disabled=false;}
    }
    function select(next){
      if(!panels[next])return;page=next;
      for(const [key,panel] of Object.entries(panels)){panel.hidden=key!==page;tabs[key].setAttribute('aria-selected',String(key===page));tabs[key].tabIndex=key===page?0:-1;}
      const api=account.mode==='api';usageArea.hidden=!api;tokenUsage.hidden=api;
      window.WhaleLegacyUsage.stop();
      if(page==='usage'&&api&&menu.classList.contains('dshwv-menu-open'))window.WhaleLegacyUsage.start();
      scroll.scrollTop=0;render();window.WhaleRendering?.presentFor(100);
    }
    window.WhaleDashboard={select,refresh,get page(){return page;}};
    let wasOpen=false;new MutationObserver(()=>{
      const open=menu.classList.contains('dshwv-menu-open');if(open===wasOpen)return;wasOpen=open;
      if(open){select(page);refresh();}else{window.WhaleLegacyUsage.stop();generation++;refreshButton.disabled=false;}
    }).observe(menu,{attributes:true,attributeFilter:['class']});
    window.addEventListener('whale-account-view',()=>{generation++;lastNotice=null;select(page);if(wasOpen)refresh();});
    window.addEventListener('whale-turn-notice',event=>{lastNotice=event.detail;render();});
    window.addEventListener('whale-balance',event=>{balance=event.detail;if(account.mode==='api')render();});
    window.WhaleMoney.onChange(()=>{if(account.mode==='api')render();});
    setInterval(()=>{if(wasOpen&&page!=='settings')refresh();},30000);
    // Moving existing nodes preserves all original handlers and values.
    if(originalControls.some(control=>!settings.contains(control)))throw Error('Dashboard lost an existing settings control');
    select('overview');
  }
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
