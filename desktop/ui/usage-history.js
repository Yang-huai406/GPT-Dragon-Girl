(() => {
  'use strict';
  const I=window.WhaleI18n,T=(key,args)=>I.t('history.'+key,args);
  const add=(parent,tag,read)=>{const node=document.createElement(tag);parent.append(node);I.bind(node,'textContent',typeof read==='function'?read:()=>read);return node;};
  const amount=(value,currency)=>value==null?T('unknown'):T('small',{amount:currency+' '+I.number(Number(value),{minimumFractionDigits:2,maximumFractionDigits:2})});
  const money=(value,currency)=>value==null?T('unknown'):value>0&&value<.01?amount(value,currency):currency+' '+I.number(Number(value),{minimumFractionDigits:2,maximumFractionDigits:2});
  const date=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||'')?I.date(day+'T00:00:00Z',{dateStyle:'medium',timeZone:'UTC'}):day||T('unknown');
  function open(){
    const dialog=document.createElement('dialog');dialog.className='whale-v3-dialog whale-history-dialog';
    add(dialog,'h2',()=>T('title'));add(dialog,'p',()=>T('explanation'));
    const select=document.createElement('select');dialog.append(select);I.bind(select,'aria-label',()=>T('scope'));
    const content=document.createElement('div');dialog.append(content);
    const close=add(dialog,'button',()=>T('close'));close.className='primary';close.onclick=()=>dialog.close();
    let generation=0;
    dialog.onclose=()=>{generation++;dialog.remove();};
    const status=read=>{content.replaceChildren();add(content,'p',read);};
    async function load(){
      const own=++generation;status(()=>T('loading'));
      try{
        const response=await fetch('/dsh-whale/usage-records.json?scope='+encodeURIComponent(select.value),{cache:'no-store'});
        if(!response.ok)throw Error(T('loadFailed'));
        const data=await response.json();if(own!==generation||!dialog.isConnected)return;
        content.replaceChildren();add(content,'p',()=>T('total',{amount:money(data.all.total,data.currency)}));
        if(!data.all.totalComplete)add(content,'p',()=>T('incomplete'));
        const table=document.createElement('table');content.append(table);const head=document.createElement('tr');table.append(head);
        add(head,'th',()=>T('date'));add(head,'th',()=>T('accountCharges'));
        for(const day of data.all.days){const row=document.createElement('tr');table.append(row);add(row,'td',()=>date(day.date));add(row,'td',()=>money(day.total,data.currency));}
        add(content,'h3',()=>T('recent'));
        for(const event of data.all.events){
          const row=add(content,'p',()=>T('event',{date:date(event.day),status:T(['completed','failed','aborted','interrupted','superseded'].includes(event.outcome)?event.outcome:'unknown'),kind:T(event.costState==='estimated'?'estimate':'turnCost'),amount:money(event.cost,data.currency),tokens:I.number(Number(event.tokens||0))}));
          if(event.accountIntervalAmount!=null){const extra=add(content,'small',()=>T('interval',{amount:money(event.accountIntervalAmount,event.accountIntervalCurrency||data.currency)}));extra.className='whale-history-interval';}
        }
        const note=add(content,'small',()=>I.message(data.note)); note.className='whale-history-note';
      }catch(error){if(own===generation)status(()=>I.message(error.message));}
    }
    select.onchange=load;document.body.append(dialog);dialog.showModal();
    fetch('/api/usage-scopes',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error(T('scopesFailed'));return r.json();}).then(data=>{
      if(!dialog.isConnected)return;
      for(const item of data.scopes){const option=add(select,'option',()=>item.current?T('current',{name:item.labelKey?I.t(item.labelKey,item.labelArgs):I.message(item.label)}):item.labelKey?I.t(item.labelKey,item.labelArgs):I.message(item.label));option.value=item.scope;}
      if(!data.scopes.length){status(()=>T('none'));return;}
      const current=data.scopes.find(item=>item.current);if(current)select.value=current.scope;load();
    }).catch(error=>{if(dialog.isConnected)status(()=>I.message(error.message));});
  }
  const menu=document.querySelector('.dshwv-menu');
  if(menu){
    const parent=menu.querySelector('.whale-menu-group[data-settings-group="resources"]')||menu.querySelector('.whale-settings-page')||menu;
    const row=document.createElement('div');row.className='dshwv-menu-row';row.dataset.settingsGroup='resources';parent.append(row);
    const button=add(row,'button',()=>T('title'));button.className='dshwv-sound';button.dataset.action='usage-history';button.onclick=open;
  }
})();
