// Adapted from MeteorNOX dsh-whale-widget (MIT). Scheduling modules removed; money display uses two decimals.
(function () {
  if (window.__dshWhaleWidget) return;
  window.__dshWhaleWidget = true;
  var dshwEnabled = true;
  // Built-in labels retain their semantic key through arrays and control factories.
  // They are resolved only at explicit UI write sites; user text is never looked up.
  function wt(key, params) { return window.WhaleI18n.t(key, params); }
  function wc(key, count) {
    var plural = new Intl.PluralRules(window.WhaleI18n.locale).select(count);
    return wt(key + '.' + plural, { count: window.WhaleI18n.number(count) });
  }
  function wm(key) {
    return Object.freeze({
      i18nKey: key,
      toString: function () { return wt(key); },
      toJSON: function () { return wt(key); },
      valueOf: function () { return wt(key); },
      slice: function (a, b) { return wt(key).slice(a, b); },
      replace: function (pattern, value) { return wt(key).replace(pattern, value); },
      trim: function () { return wt(key).trim(); }
    });
  }
  function wexpr(factory) { return {toString: function(){return String(factory());}, toJSON: function(){return String(factory());}}; }
  function widgetLocalizedHtml(host, key) {
    host.innerHTML = '';
    var placeholder = document.createElement('div');
    wb(placeholder, 'innerHTML', function(){return wt(key);});
    host.appendChild(placeholder);
  }
  function wb(element, property, factory) {
    window.WhaleI18n.bind(element, property, function () { var value = factory(); return String(value == null ? '' : value); });
    return element;
  }

  // Canvas and native color inputs need resolved hex values; DOM/SVG use the same CSS tokens.
  var gptThemeFallback = {"ink": "#443b58", "secondary": "#9a7fac", "soft": "#f4effa", "line": "#d9cde8", "focus": "#ae98ce", "surface": "#fffdfd", "accent-strong": "#65518e", "muted": "#776c87", "accent": "#7865a5", "tint": "#ebe3f4"};
  function gptThemeColor(name) {
    var value = typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(document.documentElement).getPropertyValue('--gpt-' + name).trim() : '';
    return value || gptThemeFallback[name];
  }
  function gptThemeAlpha(alpha) {
    var rgb = typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(document.documentElement).getPropertyValue('--gpt-ink-rgb').trim() : '';
    return 'rgba(' + (rgb || '68,59,88') + ',' + alpha + ')';
  }

  function dshwInit() {
    if (window.__dshWhaleInit) return;
    window.__dshWhaleInit = true;
    var MIN_SCALE = 0.6;
    var MAX_SCALE = 2.5;
    var STEP = 0.1;
    var CLICK_SQ = 9;
    var REFRESH_MS = 60000;


    var BUBBLE_MS = 5000;
    var FETCH_TIMEOUT_MS = 25000;
    var whaleMoneyTemplates = new WeakMap();
    var BALANCE_URL = '/dsh-whale/balance.json';
    var SIZE_URL = '/dsh-whale/size.json';
    var IMG_URL = '/dsh-whale/image.png?v=2';
    var GIF_URL = '/dsh-whale/rua.gif';
    var BUBBLE_URL = '/dsh-whale/bubble.json';
    var assetWarnings = Object.create(null);
    function assetNotice(message) {
      if (window.whaleToast) window.whaleToast(window.WhaleI18n.message(message || wm("widget.assetActionDidNotCompleteTryAgain")));
    }
    function assetWarning(data) {
      if (data && data.warning && !assetWarnings[data.warning]) {
        assetWarnings[data.warning] = true;
        assetNotice(data.warning);
      }
    }
    function requireSaved(data) {
      if (!data || data.ok !== true) throw new Error(data && data.error || wm("widget.saveDidNotCompleteTryAgain"));
      assetWarning(data);
      return data;
    }
    function assetFailure(error) { assetNotice(error && error.message || wm("widget.saveDidNotCompleteTryAgain")); }
    // Track composition even when the platform omits KeyboardEvent.isComposing.
    var whaleComposing = false;
    document.addEventListener('compositionstart', function () { whaleComposing = true; }, true);
    document.addEventListener('compositionend', function () { whaleComposing = false; }, true);
    function whaleImeKey(e) { return whaleComposing || !!e.isComposing || e.keyCode === 229; }
    function mediaDataUrl(blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error(wm("widget.couldNotReadTheFileChooseItAgain"))); };
        reader.readAsDataURL(blob);
      });
    }
    var css = ['.dshwv-root{position:fixed;right:0;bottom:0;--dshw-scale:1;--dshw-base:clamp(122px,calc(min(250px,min(100vw,100vh) * 0.28) * var(--dshw-scale)),625px);width:var(--dshw-base);height:var(--dshw-base);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:9999;font-family:inherit;transition:none}', '.dshwv-root.dshwv-left{transform:scaleX(-1)}', '.dshwv-root.dshwv-dragging{cursor:grabbing;transition:none}', '.dshwv-body{position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:50% 100%;transition:transform .22s cubic-bezier(.34,1.56,.64,1)}', '.dshwv-img{position:absolute;right:0;bottom:0;width:59.45%;height:59.45%;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none;object-fit:contain;object-position:right bottom}', '.dshwv-pop{position:absolute;left:0;top:0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:1;--dshw-u:calc(var(--dshw-base) / 1026)}', 'html .dshwv-pop, html .dshwv-pop svg{background:transparent !important;border:0 !important;border-radius:0 !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important}', '.dshwv-pop svg{display:block;width:100%;height:100%;pointer-events:none}', '.dshwv-pop svg path,.dshwv-pop svg ellipse{pointer-events:none;cursor:pointer}', '.dshwv-pop.dshwv-pop-open svg path,.dshwv-pop.dshwv-pop-open svg ellipse{pointer-events:visiblePainted}', '.dshwv-pop .dshwv-bshape,.dshwv-pop .dshwv-b1,.dshwv-pop .dshwv-b2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s ease,transform .2s ease}', '.dshwv-pop.dshwv-pop-open .dshwv-bshape,.dshwv-pop.dshwv-pop-open .dshwv-b1,.dshwv-pop.dshwv-pop-open .dshwv-b2{opacity:1;transform:none}', '.dshwv-gif{position:absolute;left:var(--dshw-vx,44.25%);top:var(--dshw-vy,36%);transform:translate(-50%,-50%);max-width:calc(var(--dshw-u) * 560);max-height:calc(var(--dshw-u) * 400);display:none;opacity:0;transition:opacity .2s ease;pointer-events:none;-webkit-user-drag:none;user-select:none;object-fit:contain}', '.dshwv-root.dshwv-left .dshwv-gif{transform:translate(-50%,-50%) scaleX(-1)}', '.dshwv-pop.dshwv-pop-open .dshwv-gif{opacity:1}', '.dshwv-pop.dshwv-pop-open .dshwv-b2{transition-delay:0s}', '.dshwv-pop.dshwv-pop-open .dshwv-b1{transition-delay:.13s}', '.dshwv-pop.dshwv-pop-open .dshwv-bshape{transition-delay:.26s}', '.dshwv-pop .dshwv-bshape{transition-delay:.1s}', '.dshwv-pop .dshwv-b1{transition-delay:.2s}', '.dshwv-pop .dshwv-b2{transition-delay:.3s}', '.dshwv-text{position:absolute;left:var(--dshw-vx,44.25%);top:var(--dshw-vy,36%);width:66%;height:64%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--gpt-accent);line-height:1.15;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .16s ease}', '.dshwv-pop.dshwv-pop-open .dshwv-text{opacity:1;transition:opacity .16s ease .36s}', '.dshwv-root.dshwv-left .dshwv-text{transform:translate(-50%,-50%) scaleX(-1)}', '.dshwv-text .dshwv-trow{flex:0 0 auto;margin:calc(var(--dshw-u) * 2) 0}', '.dshwv-text .dshwv-mimg{flex:0 0 auto}', '.dshwv-text .dshwv-label,.dshwv-text .dshwv-amount,.dshwv-text .dshwv-hint{flex:0 0 auto;margin-left:auto;margin-right:auto}', '.dshwv-label{font-size:calc(var(--dshw-u) * 66);font-weight:600;letter-spacing:.06em}', '.dshwv-amount{font-size:calc(var(--dshw-u) * 128);font-weight:800;line-height:1.05}', '.dshwv-period{font-size:calc(var(--dshw-u) * 104);font-weight:800;line-height:1.05}', '.dshwv-wrap{white-space:normal;max-width:calc(var(--dshw-u) * 560);line-height:1.2}', '.dshwv-hint{font-size:calc(var(--dshw-u) * 56);color:var(--gpt-muted);letter-spacing:.02em;margin-top:calc(var(--dshw-u) * 9);min-height:calc(var(--dshw-u) * 64);line-height:1.15}', '.dshwv-menu-btn{position:absolute;top:calc(40.55% + 4px);right:4px;width:26px;height:26px;border:none;border-radius:6px;background:rgba(var(--gpt-ink-rgb),.85);cursor:pointer;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;z-index:2;opacity:0;transition:opacity .15s ease}', '.dshwv-menu-btn.dshwv-menu-btn-visible{opacity:1;pointer-events:auto}', '.dshwv-menu-btn span{display:block;width:14px;height:2px;background:var(--gpt-surface);border-radius:1px}', '.dshwv-menu-btn:hover{background:var(--gpt-ink)}', '.dshwv-menu-btn-hidden{visibility:hidden;pointer-events:none}', '.dshwv-menu{position:fixed;min-width:196px;max-width:min(340px,calc(100vw - 24px));box-sizing:border-box;background:rgba(255,255,255,.92);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:10px;padding:10px 12px;opacity:0;transform:scale(.96) translateY(10px);transform-origin:top right;transition:opacity .22s ease,transform .22s cubic-bezier(.34,1.3,.6,1);pointer-events:none;z-index:10000;box-shadow:0 6px 18px rgba(0,0,0,.18);color-scheme:light}', '.dshwv-menu.dshwv-menu-open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}', '.dshwv-menu-row{display:flex;align-items:center;gap:8px;margin:5px 0;color:var(--gpt-ink);font-size:12px;white-space:nowrap}', '.dshwv-range{flex:1;min-width:0;accent-color:var(--gpt-ink)}', '.dshwv-number{width:44px;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 4px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);box-sizing:border-box}', '.dshwv-number:disabled{opacity:.4;background:rgba(var(--gpt-ink-rgb),.06);cursor:not-allowed}', '.dshwv-sound:disabled{opacity:.45;cursor:not-allowed}', '.dshwv-sound{flex:1;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:3px 0;cursor:pointer}', '.dshwv-sound:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-check{width:16px;height:16px;accent-color:var(--gpt-ink);cursor:pointer;flex:0 0 auto}', '.dshwv-menu-sep{height:1px;background:rgba(var(--gpt-ink-rgb),.25);margin:6px 0}', '.dshwv-volpct{width:44px;text-align:right;color:var(--gpt-ink);font-size:12px}', '.dshwv-rolebtn-wrap{position:relative;flex:1;min-width:0}', '.dshwv-rolebtn{flex:1;min-width:0;display:flex;align-items:center;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:0 6px;cursor:pointer;overflow:hidden;height:24px}', '.dshwv-rolebtn:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-btnlabel{display:block;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:normal}', '.dshwv-roleimport{border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-ink);color:var(--gpt-surface);font-size:12px;padding:3px 8px;cursor:pointer;flex:0 0 auto}', '.dshwv-roleimport:hover{background:var(--gpt-accent-strong)}', '.dshwv-rolelist{position:fixed;z-index:10001;box-sizing:border-box;background:rgba(255,255,255,.98);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:4px;max-height:240px;overflow-y:auto;display:none;color-scheme:light}', '.dshwv-rolelist.dshwv-rolelist-open{display:block}', '.dshwv-roleitem{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;cursor:pointer;color:var(--gpt-ink);font-size:12px;white-space:nowrap;min-width:0}', '.dshwv-roleitem:hover{background:rgba(var(--gpt-ink-rgb),.1)}', '.dshwv-roleitem.dshwv-roleitem-cur{background:rgba(var(--gpt-ink-rgb),.14)}', '.dshwv-rolethumb{width:22px;height:22px;border-radius:4px;object-fit:cover;flex:0 0 auto;background:var(--gpt-tint)}', '.dshwv-rolename{flex:1;min-width:0;overflow:hidden}', '.dshwv-nameinner{display:inline-flex;white-space:nowrap;transition:transform .22s ease}', '.dshwv-rolenamewrap{flex:1;min-width:0;display:flex;align-items:center;gap:6px;overflow:hidden}', '.dshwv-nameinner .dshwv-namecopy{margin-right:40px;white-space:nowrap;flex:0 0 auto}', '.dshwv-roleGifTag{flex:0 0 auto;font-size:10px;line-height:1;padding:2px 4px;border-radius:3px;background:var(--gpt-ink);color:var(--gpt-surface)}', '.dshwv-rolepin{width:22px;height:22px;border:none;background:none;cursor:pointer;font-size:13px;opacity:.45;padding:0;flex:0 0 auto}', '.dshwv-rolepin.on{opacity:1}', '.dshwv-roledel{width:22px;height:22px;border:none;background:none;cursor:pointer;font-size:13px;color:#c0392b;padding:0;flex:0 0 auto}', '.dshwv-audiobtn{flex:1;min-width:0;display:flex;align-items:center;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:0 6px;cursor:pointer;overflow:hidden;height:24px}', '.dshwv-audiobtn:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-audioimport{border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-ink);color:var(--gpt-surface);font-size:12px;padding:3px 8px;cursor:pointer;flex:0 0 auto}', '.dshwv-audioimport:hover{background:var(--gpt-accent-strong)}', '.dshwv-audiolist{position:fixed;z-index:10001;box-sizing:border-box;background:rgba(255,255,255,.98);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:4px;max-height:240px;overflow-y:auto;display:none;color-scheme:light}', '.dshwv-audiolist.dshwv-audiolist-open{display:block}', '.dshwv-audioitem{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;cursor:pointer;color:var(--gpt-ink);font-size:12px;white-space:nowrap;min-width:0}', '.dshwv-audioitem:hover{background:rgba(var(--gpt-ink-rgb),.1)}', '.dshwv-audioitem.dshwv-audioitem-cur{background:rgba(var(--gpt-ink-rgb),.14)}', '.dshwv-audioname{flex:1;min-width:0;overflow:hidden}', '.dshwv-audiopreset{color:var(--gpt-muted);font-size:11px;flex:0 0 auto}', '.dshwv-audiothumb{width:22px;height:22px;border-radius:4px;flex:0 0 auto;background:var(--gpt-tint);display:flex;align-items:center;justify-content:center;font-size:13px}', '.dshwv-audiopin{width:22px;height:22px;border:none;background:none;cursor:pointer;font-size:13px;opacity:.45;padding:0;flex:0 0 auto}', '.dshwv-audiopin.on{opacity:1}', '.dshwv-audiodel{width:22px;height:22px;border:none;background:none;cursor:pointer;font-size:13px;color:#c0392b;padding:0;flex:0 0 auto}', '.dshwv-audiomask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:20500;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-audiowin{background:var(--gpt-surface);border-radius:12px;padding:16px 18px;width:360px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center}', '.dshwv-audiotitle{font-size:14px;font-weight:600;color:var(--gpt-ink);margin-bottom:12px}', '.dshwv-audionameinput{width:50%;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:6px 8px;font-size:13px;color:var(--gpt-ink);text-align:center;margin:0 auto 14px;display:block}', '.dshwv-audiorow{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--gpt-ink);font-size:12px;white-space:nowrap}', '.dshwv-audioslotlabel{flex:0 0 auto;width:32px;text-align:left}', '.dshwv-audioselect{flex:1;min-width:0;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;padding:3px 4px}', '.dshwv-audiosmallimport{border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:3px 10px;cursor:pointer;flex:0 0 auto}', '.dshwv-audiosmallimport:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-slotwrap{position:relative;flex:1;min-width:0}', '.dshwv-slotbtn{width:100%;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;padding:5px 6px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-slotbtn:hover{background:rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-slotlist{position:fixed;z-index:20600;box-sizing:border-box;background:rgba(255,255,255,.98);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:4px;max-height:200px;overflow-y:auto;display:none;color-scheme:light}', '.dshwv-audiocropcanvas{width:300px;height:120px;display:block;margin:0 auto 10px;background:var(--gpt-soft);border:1px solid rgba(var(--gpt-ink-rgb),.2);border-radius:8px;cursor:crosshair;touch-action:none}', '.dshwv-audiotime{color:var(--gpt-ink);font-size:12px;margin:6px 0 10px}', '.dshwv-audiosliderrow{display:flex;align-items:center;gap:8px;margin:2px 0}', '.dshwv-audiosliderrow input[type=range]{flex:1;accent-color:var(--gpt-ink)}', '.dshwv-audiosliderrow input[type=number]{width:64px;flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 4px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);box-sizing:border-box;text-align:right}', '.dshwv-audiosliderrow input[type=number]:disabled{opacity:.4}', '.dshwv-zoomlabel{flex:0 0 auto;width:56px;color:var(--gpt-ink);font-size:12px;text-align:left}', '.dshwv-dualrange{position:relative;flex:1;height:22px;min-width:0;cursor:pointer;touch-action:none}', '.dshwv-dualrange-track{position:absolute;left:4px;right:4px;top:50%;height:4px;transform:translateY(-50%);background:rgba(var(--gpt-ink-rgb),.15);border-radius:2px}', '.dshwv-dualrange-fill{position:absolute;top:50%;height:4px;transform:translateY(-50%);background:rgba(var(--gpt-ink-rgb),.45);border-radius:2px}', '.dshwv-dualrange-thumb{position:absolute;top:50%;width:14px;height:14px;margin-left:-7px;margin-top:-7px;border-radius:50%;background:var(--gpt-ink);border:2px solid var(--gpt-surface);box-shadow:0 1px 3px rgba(0,0,0,.3);box-sizing:border-box}', '.dshwv-cropmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:20000;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-cropwin{background:var(--gpt-surface);border-radius:12px;padding:16px 18px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center}', '.dshwv-croptitle{font-size:14px;font-weight:600;color:var(--gpt-ink);margin-bottom:12px}', '.dshwv-cropbox{position:relative;width:260px;height:260px;margin:0 auto 12px;border:1px dashed var(--gpt-ink);border-radius:8px;overflow:hidden;background:var(--gpt-soft);cursor:grab;touch-action:none}', '.dshwv-cropbox canvas{display:block}', '.dshwv-cropzoom{width:100%;accent-color:var(--gpt-ink)}', '.dshwv-cropname{width:170px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:5px 8px;font-size:13px;color:var(--gpt-ink);text-align:center;margin:0 auto 12px;display:block}', '.dshwv-cropctrl{display:flex;align-items:center;gap:8px;margin:0 0 10px}', '.dshwv-croplabel{flex:0 0 auto;width:28px;color:var(--gpt-ink);font-size:12px;text-align:left}', '.dshwv-cropnum{width:52px;flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 4px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);box-sizing:border-box;text-align:right}', '.dshwv-cropflip{width:26px;height:26px;flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:14px;cursor:pointer;padding:0;line-height:1}', '.dshwv-cropflip:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-cropflip-on{background:var(--gpt-ink);color:var(--gpt-surface)}', '.dshwv-cropbtns{display:flex;gap:10px;justify-content:center}', '.dshwv-cropbtn{border:none;border-radius:6px;padding:6px 18px;font-size:13px;cursor:pointer}', '.dshwv-cropbtn-ok{background:var(--gpt-ink);color:var(--gpt-surface)}', '.dshwv-cropbtn-ok:hover{background:var(--gpt-accent-strong)}', '.dshwv-cropbtn-no{background:rgba(var(--gpt-ink-rgb),.1);color:var(--gpt-ink)}', '.dshwv-cropbtn-no:hover{background:rgba(var(--gpt-ink-rgb),.2)}', '.dshwv-gifmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:20000;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-gifwin{background:var(--gpt-surface);border-radius:12px;padding:16px 18px;width:340px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center}', '.dshwv-giftitle{font-size:14px;font-weight:600;color:var(--gpt-ink);margin-bottom:12px}', '.dshwv-gifpreview{position:relative;width:280px;height:280px;margin:0 auto 10px;border:1px dashed var(--gpt-ink);border-radius:8px;overflow:hidden;background:var(--gpt-soft);display:flex;align-items:center;justify-content:center}', '.dshwv-gifpreviewimg{max-width:100%;max-height:100%;object-fit:contain;display:block}', '.dshwv-gifhint{color:var(--gpt-muted);font-size:12px;margin-bottom:12px}', '.dshwv-gifname{width:170px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:5px 8px;font-size:13px;color:var(--gpt-ink);text-align:center;margin:0 auto 12px;display:block}', '.dshwv-confirmmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:21000;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-confirmwin{background:var(--gpt-surface);border-radius:12px;padding:16px 18px;width:280px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center}', '.dshwv-confirmtext{font-size:13px;color:var(--gpt-ink);margin-bottom:14px;line-height:1.5;word-break:break-all}', '.dshwv-confirmbtns{display:flex;gap:10px;justify-content:center}', '.dshwv-snapmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:22000;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-snapwin{background:var(--gpt-surface);border-radius:12px;padding:14px 16px;width:400px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center;color:var(--gpt-ink);box-sizing:border-box}', '.dshwv-snaptitle{font-size:14px;font-weight:600;color:var(--gpt-ink);margin-bottom:10px}', '.dshwv-snapmodes{display:flex;align-items:center;justify-content:center;gap:18px;margin:0 0 12px;font-size:13px;flex-wrap:wrap}', '.dshwv-snapmodes label{display:inline-flex;align-items:center;gap:4px;cursor:pointer;color:var(--gpt-ink)}', '.dshwv-snapmodes input{accent-color:var(--gpt-ink);cursor:pointer}', '.dshwv-snapgrid{display:grid;grid-template-columns:72px 190px 72px;grid-template-rows:26px 190px 26px;gap:4px;margin:0 auto 8px;place-items:center;width:max-content;justify-content:center}', '.dshwv-snapcell{display:flex;align-items:center;justify-content:center;gap:3px;min-width:0}', '.dshwv-snappreview{position:relative;width:190px;height:190px;border:1px solid rgba(var(--gpt-ink-rgb),.5);border-radius:8px;background:var(--gpt-surface);overflow:hidden;touch-action:none}', '.dshwv-snapflip{position:absolute;top:0;bottom:0;left:0;background:rgba(var(--gpt-ink-rgb),.07);pointer-events:none}', '.dshwv-snapzone{position:absolute;pointer-events:none}', '.dshwv-snapline{position:absolute;background:var(--gpt-ink);pointer-events:none}', '.dshwv-snapline-flip{background:#c0392b}', '.dshwv-snaphandle{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:var(--gpt-ink);border:2px solid var(--gpt-surface);box-shadow:0 1px 3px rgba(0,0,0,.35);cursor:ew-resize;pointer-events:auto;z-index:3;box-sizing:border-box}', '.dshwv-snaphandle-flip{background:#c0392b}', '.dshwv-snaphandle-h{cursor:ns-resize}', '.dshwv-snapnum{width:58px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 4px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);text-align:right}', '.dshwv-snapnum:disabled{opacity:.45}', '.dshwv-snapunit{font-size:11px;color:var(--gpt-muted);flex:0 0 auto}', '.dshwv-snapfliprow{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;margin:0 0 12px;color:var(--gpt-ink)}', '.dshwv-snapbtns{display:flex;gap:10px;justify-content:center}', '.dshwv-snapbtn{border:none;border-radius:6px;padding:6px 18px;font-size:13px;cursor:pointer}', '.dshwv-snapbtn-ok{background:var(--gpt-ink);color:var(--gpt-surface)}', '.dshwv-snapbtn-ok:hover{background:var(--gpt-accent-strong)}', '.dshwv-snapbtn-no{background:rgba(var(--gpt-ink-rgb),.1);color:var(--gpt-ink)}', '.dshwv-snapbtn-no:hover{background:rgba(var(--gpt-ink-rgb),.2)}', '.dshwv-snapoff{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(246,248,253,.88);color:var(--gpt-muted);font-size:13px;z-index:5;pointer-events:auto}', '.dshwv-bubmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:20500;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-bubcard{background:var(--gpt-surface);border-radius:12px;padding:14px 16px;width:440px;box-shadow:0 10px 30px rgba(0,0,0,.3);text-align:center;color:var(--gpt-ink);box-sizing:border-box;max-height:88vh;overflow-y:auto;overflow-x:hidden}', '.dshwv-bubtitle{font-size:14px;font-weight:600;color:var(--gpt-ink);margin-bottom:8px}', '.dshwv-bubsec{font-size:12px;color:var(--gpt-muted);margin:10px 0 6px;text-align:left;border-top:1px solid rgba(var(--gpt-ink-rgb),.12);padding-top:8px}', '.dshwv-bubsec-first{border-top:none;margin-top:2px;padding-top:0}', '.dshwv-bubrow{display:flex;align-items:center;gap:6px;margin:4px 0;padding:4px;border:1px solid rgba(var(--gpt-ink-rgb),.16);border-radius:8px;background:var(--gpt-surface)}', '.dshwv-bubchip{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;height:44px;border:1px dashed rgba(var(--gpt-ink-rgb),.35);border-radius:8px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;overflow:hidden;cursor:pointer}', '.dshwv-bubkind{width:96px;flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;padding:3px 2px;cursor:pointer}', '.dshwv-rgbwrap{position:relative;display:inline-block;vertical-align:middle;text-align:left}', '.dshwv-rgbhead{width:96px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;padding:3px 8px;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:space-between;gap:4px}', '.dshwv-rgbhead::after{content:"▾";font-size:9px;opacity:.7;flex:0 0 auto}', '.dshwv-rgbmenu{position:absolute;left:0;top:calc(100% + 2px);z-index:60;min-width:100%;max-width:160px;max-height:172px;overflow-y:auto;overflow-x:hidden;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.3);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.18);padding:4px 0;display:none;text-align:left}', '.dshwv-rgbmenu.dshwv-rgbopen{display:block}', '.dshwv-rgbopt{padding:4px 10px;font-size:12px;color:var(--gpt-ink);cursor:pointer;white-space:nowrap}', '.dshwv-rgbopt:hover{background:rgba(var(--gpt-ink-rgb),.1)}', '.dshwv-rgbopt.dshwv-rgbcur{background:rgba(var(--gpt-ink-rgb),.16);font-weight:600}', '.dshwv-paladd{flex:0 0 auto;border:1px dashed rgba(var(--gpt-ink-rgb),.5);border-radius:8px;background:transparent;color:var(--gpt-ink);font-size:13px;line-height:1.4;padding:3px 9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;user-select:none}', '.dshwv-paladd:hover{background:rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-libchip{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;padding:0;margin:0;cursor:default;user-select:none}', '.dshwv-libchip .dshwv-palchip:hover{background:rgba(var(--gpt-ink-rgb),.18)}', '.dshwv-libdel{position:absolute;top:-7px;right:-7px;width:16px;height:16px;border-radius:50%;background:#c0392b;color:var(--gpt-surface);font-size:10px;line-height:1;display:none;align-items:center;justify-content:center;cursor:pointer;border:none;padding:0 0 1px;z-index:2}', '.dshwv-libchip:hover .dshwv-libdel{display:flex}', '.dshwv-libdel:hover{background:#a93226}', '.dshwv-fontinp{width:150px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface)}', '.dshwv-fontwrap{flex:1;min-width:0}', '.dshwv-fontwrap .dshwv-rgbhead{width:100%;box-sizing:border-box}', '.dshwv-rgbmenu.dshwv-fontmenu{width:220px;max-width:240px;max-height:134px}', '.dshwv-qcolwrap{flex:0 1 auto;min-width:0;width:200px;max-width:200px}', '.dshwv-qcolwrap .dshwv-rgbhead{width:100%;box-sizing:border-box}', '.dshwv-rgbmenu.dshwv-qcolmenu{width:190px;max-width:210px;max-height:152px}', '.dshwv-qcolmenu .dshwv-rgbopt.optgrad{background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;text-shadow:none;background-size:200% auto;animation:dshwvRainbow 2.6s linear infinite;transition:transform .15s ease}', '.dshwv-qcolmenu .dshwv-rgbopt.optgrad:hover{transform:scale(1.06);transform-origin:right center;text-decoration:underline}', '.dshwv-qedit{position:fixed;z-index:26000;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:10px;box-shadow:0 8px 22px rgba(var(--gpt-ink-rgb),.22);padding:10px 12px;color-scheme:light}', '.dshwv-qedit-row{display:flex;align-items:center;gap:6px;margin:3px 0;flex-wrap:wrap;min-width:0}', '.dshwv-qedit-row label{font-size:12px;color:var(--gpt-ink);flex:0 0 auto}', '.dshwv-qedit-content{flex:1;min-width:120px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:4px 6px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface)}', '.dshwv-qselect{box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;padding:3px 4px;flex:0 1 auto;min-width:0}', '.dshwv-qcolorhost{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}', '.dshwv-qcolorhost input[type=color]{width:26px;height:20px;padding:0;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:4px;background:var(--gpt-surface)}', '.dshwv-qcolorhost .dshwv-bubmini{width:auto;height:20px;font-size:11px;opacity:.85;padding:0 6px}', '.dshwv-usagepanel{position:fixed;z-index:26020;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:10px;box-shadow:0 8px 22px rgba(var(--gpt-ink-rgb),.22);padding:10px 12px;color-scheme:light;max-height:70vh;overflow-y:auto}', '.dshwv-menuview{display:block}', '.dshwv-usage-sub{display:none;max-height:min(70vh,560px);overflow-y:auto;padding-right:2px;width:100%;box-sizing:border-box}', '.dshwv-usage-back{border:none;background:none;color:var(--gpt-ink);font-size:12px;font-weight:600;cursor:pointer;padding:0 0 2px;text-align:left;width:100%}', '.dshwv-usage-back:hover{color:var(--gpt-accent-strong);text-decoration:underline}', '.dshwv-usagebody{display:flex;flex-direction:column;gap:2px;color:var(--gpt-ink);font-size:12px;min-width:0;overflow-x:hidden}', '@keyframes dshwvViewIn{from{transform:translateY(-8px)}to{transform:translateY(0)}}', '.dshwv-view-in{animation:dshwvViewIn .1s ease}', '.dshwv-usage-sec{display:flex;justify-content:space-between;align-items:center;margin:2px 0 2px;font-weight:600;border-bottom:1px solid rgba(var(--gpt-ink-rgb),.15);padding-bottom:3px;white-space:nowrap}', '.dshwv-usage-total{color:#e0433f;font-weight:700}', '.dshwv-usage-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 0;min-width:0}', '.dshwv-usage-scroll{overflow-y:auto;overflow-x:hidden;padding-right:2px;margin:2px 0 2px;border:1px solid rgba(var(--gpt-ink-rgb),.12);border-radius:6px}', '.dshwv-usage-today{height:55px}', '.dshwv-usage-days{height:55px}', '.dshwv-usage-oview{text-align:center;padding:4px 0 6px;border-bottom:1px solid rgba(var(--gpt-ink-rgb),.12);margin-bottom:6px}', '.dshwv-usage-oview-num{font-size:22px;font-weight:800;color:var(--gpt-ink);margin:2px 0}', '.dshwv-usage-collapse{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:none;border:none;border-bottom:1px solid rgba(var(--gpt-ink-rgb),.15);padding:6px 0 3px;margin:6px 0 2px;color:var(--gpt-ink);font-size:12px;font-weight:600;cursor:pointer;text-align:left}', '.dshwv-usage-collapse:hover{color:var(--gpt-accent-strong)}', '.dshwv-usage-chev{flex:0 0 auto;color:var(--gpt-muted);font-size:10px}', '.dshwv-usage-collapse-body{min-width:0;overflow-x:hidden}', '.dshwv-usage-ratio{min-width:0}', '.dshwv-usage-daydetail{margin:2px 0 6px 12px;padding:0 2px 2px 10px;border-left:2px solid rgba(var(--gpt-ink-rgb),.16);min-width:0}', '.dshwv-usage-scroll{scrollbar-width:thin;scrollbar-color:rgba(var(--gpt-ink-rgb),.16) transparent}', '.dshwv-usage-scroll::-webkit-scrollbar{width:6px}', '.dshwv-usage-scroll::-webkit-scrollbar-track{background:transparent}', '.dshwv-usage-scroll::-webkit-scrollbar-thumb{background:rgba(var(--gpt-ink-rgb),.14);border-radius:3px}', '.dshwv-usage-scroll::-webkit-scrollbar-thumb:hover{background:rgba(var(--gpt-ink-rgb),.26)}', '.dshwv-usage-model{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-usage-hint{color:var(--gpt-muted);font-size:11px;padding:2px 0;line-height:1.4}', '.dshwv-usage-subtitle{text-align:center;font-size:13px;font-weight:700;color:var(--gpt-ink);margin:0 0 6px}', '.dshwv-usageset{border:1px dashed rgba(var(--gpt-ink-rgb),.28);border-radius:8px;padding:0 6px 6px;margin:0 0 6px}', '.dshwv-usagemsg{flex:1;min-width:80px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 5px;font-size:11px;color:var(--gpt-ink);background:var(--gpt-surface)}', '.dshwv-usagemsg:disabled{opacity:.45}', '.dshwv-usage-yuan{color:var(--gpt-ink);font-size:12px;flex:0 0 auto}', '.dshwv-msgtext{width:100%;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:5px 7px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);resize:vertical;min-height:60px}', '.dshwv-usage-more{display:block;width:100%;margin-top:4px;border:1px dashed rgba(var(--gpt-ink-rgb),.5);border-radius:8px;background:transparent;color:var(--gpt-ink);font-size:12px;padding:5px;cursor:pointer}', '.dshwv-usage-more:hover{background:rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-usage-mask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:22000;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-resmask{position:fixed;inset:0;background:rgba(var(--gpt-ink-rgb),.55);z-index:20500;display:flex;align-items:center;justify-content:center;color-scheme:light}', '.dshwv-usage-card{position:relative;background:var(--gpt-surface);border-radius:12px;width:min(560px,92vw);max-height:82vh;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.3)}', '.dshwv-usage-wintitle{font-size:14px;font-weight:600;color:var(--gpt-ink);padding:12px 16px 8px;border-bottom:1px solid rgba(var(--gpt-ink-rgb),.15)}', '.dshwv-usage-close{position:absolute;top:8px;right:10px;width:24px;height:24px;border:none;background:none;font-size:18px;cursor:pointer;color:var(--gpt-ink);opacity:.6;border-radius:6px}', '.dshwv-usage-close:hover{background:rgba(var(--gpt-ink-rgb),.1);opacity:1}', '.dshwv-usage-windowbody{overflow-y:auto;padding:4px 16px 14px;flex:1;color:var(--gpt-ink);font-size:12px}', '.dshwv-usage-chartwrap{position:relative;margin:4px 0 10px}', '.dshwv-usage-chartwrap canvas{display:block;width:100%;height:150px;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.15);border-radius:8px;box-sizing:border-box}', '.dshwv-usage-tip{position:absolute;pointer-events:none;background:rgba(var(--gpt-ink-rgb),.88);color:var(--gpt-surface);font-size:11px;padding:3px 7px;border-radius:5px;white-space:nowrap;z-index:5}', '.dshwv-usage-ratio{display:flex;align-items:center;gap:8px;margin:3px 0}', '.dshwv-usage-ratio-label{flex:0 0 96px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gpt-ink)}', '.dshwv-usage-ratio-track{flex:1;min-width:0;height:10px;border-radius:5px;background:rgba(var(--gpt-ink-rgb),.12);min-width:0}', '.dshwv-usage-ratio-fill{height:100%;border-radius:5px;min-width:0;max-width:100%}', '.dshwv-usage-ratio-pct{flex:0 0 42px;text-align:right;color:var(--gpt-ink);font-size:11px;white-space:nowrap}', '.dshwv-usage-ratio-cost{flex:0 0 auto;color:var(--gpt-ink);font-size:11px;white-space:nowrap}', '.dshwv-fontinp:focus{outline:none;border-color:var(--gpt-ink)}', '.dshwv-bubmini{width:22px;height:22px;flex:0 0 auto;border:none;background:none;cursor:pointer;font-size:14px;color:var(--gpt-ink);opacity:.6;padding:0;border-radius:4px}', '.dshwv-bubmini:hover{background:rgba(var(--gpt-ink-rgb),.12);opacity:1}', '.dshwv-bubmini-on{opacity:1}', '.dshwv-bubadd{width:100%;border:1px dashed rgba(var(--gpt-ink-rgb),.4);border-radius:8px;background:none;color:var(--gpt-ink);font-size:13px;padding:8px;cursor:pointer;margin:6px 0}', '.dshwv-bubadd:hover{background:rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-bubbtns{display:flex;gap:10px;justify-content:center;margin-top:10px}', '.dshwv-bubbtn{border:none;border-radius:6px;padding:6px 18px;font-size:13px;cursor:pointer}', '.dshwv-bubbtn-ok{background:var(--gpt-ink);color:var(--gpt-surface)}', '.dshwv-bubbtn-ok:hover{background:var(--gpt-accent-strong)}', '.dshwv-bubbtn-no{background:rgba(var(--gpt-ink-rgb),.1);color:var(--gpt-ink)}', '.dshwv-bubbtn-no:hover{background:rgba(var(--gpt-ink-rgb),.2)}', '.dshwv-bubhint{font-size:11px;color:var(--gpt-muted);text-align:left;margin-top:6px}', '.dshwv-choicerow{display:flex;align-items:center;gap:12px;flex:1;min-width:0;padding:2px 0}', '.dshwv-choicegrp{position:relative;flex:1 1 0;min-width:150px}', '.dshwv-choicegrp .dshwv-choicechip{width:100%;height:36px;padding:0 34px 0 20px}', '.dshwv-choicegrp .dshwv-winput{position:absolute;top:4px;right:4px;bottom:4px;width:26px;border:1px solid rgba(var(--gpt-ink-rgb),.45);background:var(--gpt-surface);border-radius:5px;padding:0 2px;font-size:11px;color:var(--gpt-ink);text-align:center;box-sizing:border-box}', '.dshwv-winput{width:46px;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 4px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);box-sizing:border-box;text-align:center;flex:0 0 auto}', '.dshwv-splitbtn{width:26px;height:26px;min-width:26px;border:none;background:transparent;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;flex:0 0 auto;opacity:.85}', '.dshwv-splitbtn span{position:relative;display:block;width:16px;height:16px;transform:rotate(0deg);transition:transform .18s ease}', '.dshwv-splitbtn span::before,.dshwv-splitbtn span::after{content:\'\';position:absolute;background:var(--gpt-ink);border-radius:1.5px}', '.dshwv-splitbtn span::before{left:0;top:50%;width:100%;height:2.5px;margin-top:-1.25px}', '.dshwv-splitbtn span::after{top:0;left:50%;width:2.5px;height:100%;margin-left:-1.25px}', '.dshwv-splitbtn:hover span{transform:rotate(45deg)}', '.dshwv-bubchip-cur{outline:2px solid rgba(var(--gpt-ink-rgb),.55)}', '.dshwv-sidebar{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}', '.dshwv-trow{display:block;text-align:center;line-height:1.2;white-space:nowrap;margin:calc(var(--dshw-u) * 5) auto;text-shadow:0 1px 2px rgba(255,255,255,.6)}', '@keyframes dshwvRainbow{0%{background-position:0% 0}100%{background-position:200% 0}}', '.dshwv-trow.dshwv-rgb,.dshwv-qcolmenu .dshwv-rgbopt.opt-macaron{background-image:linear-gradient(90deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200));background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:dshwvRainbow 2.6s linear infinite;text-shadow:none}', '.dshwv-trow.dshwv-rgb-candy,.dshwv-qcolmenu .dshwv-rgbopt.opt-candy{background-image:linear-gradient(90deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))}', '.dshwv-trow.dshwv-rgb-rouge,.dshwv-qcolmenu .dshwv-rgbopt.opt-rouge{background-image:linear-gradient(90deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))}', '.dshwv-trow.dshwv-rgb-bamboo,.dshwv-qcolmenu .dshwv-rgbopt.opt-bamboo{background-image:linear-gradient(90deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))}', '.dshwv-trow.dshwv-rgb-aurora,.dshwv-qcolmenu .dshwv-rgbopt.opt-aurora{background-image:linear-gradient(90deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))}', '.dshwv-trow.dshwv-rgb-deepsea,.dshwv-qcolmenu .dshwv-rgbopt.opt-deepsea{background-image:linear-gradient(90deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))}', '.dshwv-trow.dshwv-rgb-sunset,.dshwv-qcolmenu .dshwv-rgbopt.opt-sunset{background-image:linear-gradient(90deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))}', '.dshwv-trow.dshwv-rgb-forest,.dshwv-qcolmenu .dshwv-rgbopt.opt-forest{background-image:linear-gradient(90deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))}', '.dshwv-trow.dshwv-rgb-champagne,.dshwv-qcolmenu .dshwv-rgbopt.opt-champagne{background-image:linear-gradient(90deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))}', '.dshwv-trow.dshwv-rgb-lavender,.dshwv-qcolmenu .dshwv-rgbopt.opt-lavender{background-image:linear-gradient(90deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))}', '.dshwv-trow.dshwv-rgb-mint,.dshwv-qcolmenu .dshwv-rgbopt.opt-mint{background-image:linear-gradient(90deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))}', '.dshwv-trow.dshwv-rgb-lava,.dshwv-qcolmenu .dshwv-rgbopt.opt-lava{background-image:linear-gradient(90deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))}', '.dshwv-trow.dshwv-rgb-galaxy,.dshwv-qcolmenu .dshwv-rgbopt.opt-galaxy{background-image:linear-gradient(90deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))}', '.dshwv-trow.dshwv-rgb-ink,.dshwv-trowtx.dshwv-rgb-ink,.dshwv-qcolmenu .dshwv-rgbopt.opt-ink{background-image:linear-gradient(90deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))}', '.dshwv-trow.dshwv-rgb-indigo,.dshwv-trowtx.dshwv-rgb-indigo,.dshwv-qcolmenu .dshwv-rgbopt.opt-indigo{background-image:linear-gradient(90deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))}', '.dshwv-trow.dshwv-bgrgb{text-shadow:none;background-size:200% auto;animation:dshwvRainbow 2.6s linear infinite}', '.dshwv-trow.dshwv-bgrgb-macaron{background-image:linear-gradient(90deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200))}', '.dshwv-trow.dshwv-bgrgb-candy{background-image:linear-gradient(90deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))}', '.dshwv-trow.dshwv-bgrgb-rouge{background-image:linear-gradient(90deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))}', '.dshwv-trow.dshwv-bgrgb-bamboo{background-image:linear-gradient(90deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))}', '.dshwv-trow.dshwv-bgrgb-aurora{background-image:linear-gradient(90deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))}', '.dshwv-trow.dshwv-bgrgb-deepsea{background-image:linear-gradient(90deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))}', '.dshwv-trow.dshwv-bgrgb-sunset{background-image:linear-gradient(90deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))}', '.dshwv-trow.dshwv-bgrgb-forest{background-image:linear-gradient(90deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))}', '.dshwv-trow.dshwv-bgrgb-champagne{background-image:linear-gradient(90deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))}', '.dshwv-trow.dshwv-bgrgb-lavender{background-image:linear-gradient(90deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))}', '.dshwv-trow.dshwv-bgrgb-mint{background-image:linear-gradient(90deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))}', '.dshwv-trow.dshwv-bgrgb-lava{background-image:linear-gradient(90deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))}', '.dshwv-trow.dshwv-bgrgb-galaxy{background-image:linear-gradient(90deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))}', '.dshwv-trow.dshwv-bgrgb-ink{background-image:linear-gradient(90deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))}', '.dshwv-trow.dshwv-bgrgb-indigo{background-image:linear-gradient(90deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))}', '.dshwv-trowtx.dshwv-rgb{background-image:linear-gradient(90deg,rgb(255,180,200),rgb(255,205,170),rgb(255,225,165),rgb(245,240,180),rgb(190,240,210),rgb(180,230,245),rgb(190,215,250),rgb(220,200,245),rgb(240,200,230),rgb(255,180,200));background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;animation:dshwvRainbow 2.6s linear infinite;text-shadow:none}', '.dshwv-trowtx.dshwv-rgb-candy{background-image:linear-gradient(90deg,rgb(255,145,170),rgb(255,170,130),rgb(255,195,110),rgb(240,220,115),rgb(140,220,175),rgb(115,210,205),rgb(130,195,240),rgb(160,170,235),rgb(210,155,230),rgb(235,135,190),rgb(255,145,170))}', '.dshwv-trowtx.dshwv-rgb-rouge{background-image:linear-gradient(90deg,rgb(140,25,45),rgb(175,35,60),rgb(120,20,55),rgb(160,40,75),rgb(190,55,80),rgb(130,30,65),rgb(140,25,45))}', '.dshwv-trowtx.dshwv-rgb-bamboo{background-image:linear-gradient(90deg,rgb(70,180,85),rgb(95,200,105),rgb(55,165,70),rgb(110,215,120),rgb(80,190,95),rgb(60,172,78),rgb(70,180,85))}', '.dshwv-trowtx.dshwv-rgb-aurora{background-image:linear-gradient(90deg,rgb(70,240,200),rgb(90,200,255),rgb(120,140,255),rgb(180,120,255),rgb(240,140,255),rgb(70,240,200))}', '.dshwv-trowtx.dshwv-rgb-deepsea{background-image:linear-gradient(90deg,rgb(20,90,180),rgb(30,140,210),rgb(40,180,220),rgb(20,120,190),rgb(50,160,230),rgb(25,100,200),rgb(20,90,180))}', '.dshwv-trowtx.dshwv-rgb-sunset{background-image:linear-gradient(90deg,rgb(255,180,80),rgb(255,130,90),rgb(255,90,110),rgb(220,90,150),rgb(160,90,190),rgb(255,180,80))}', '.dshwv-trowtx.dshwv-rgb-forest{background-image:linear-gradient(90deg,rgb(30,100,60),rgb(60,140,80),rgb(90,180,90),rgb(140,200,80),rgb(180,210,90),rgb(30,100,60))}', '.dshwv-trowtx.dshwv-rgb-champagne{background-image:linear-gradient(90deg,rgb(220,180,100),rgb(240,205,130),rgb(255,225,160),rgb(230,190,110),rgb(245,210,140),rgb(220,180,100))}', '.dshwv-trowtx.dshwv-rgb-lavender{background-image:linear-gradient(90deg,rgb(180,150,255),rgb(200,170,255),rgb(230,180,240),rgb(255,190,220),rgb(240,160,200),rgb(180,150,255))}', '.dshwv-trowtx.dshwv-rgb-mint{background-image:linear-gradient(90deg,rgb(120,230,180),rgb(150,240,200),rgb(170,240,230),rgb(140,220,240),rgb(120,200,220),rgb(120,230,180))}', '.dshwv-trowtx.dshwv-rgb-lava{background-image:linear-gradient(90deg,rgb(255,60,40),rgb(255,110,30),rgb(255,170,40),rgb(255,210,70),rgb(255,140,50),rgb(255,60,40))}', '.dshwv-trowtx.dshwv-rgb-galaxy{background-image:linear-gradient(90deg,rgb(40,30,90),rgb(70,50,130),rgb(110,70,170),rgb(160,90,190),rgb(220,120,180),rgb(40,30,90))}', '.dshwv-trowtx.dshwv-rgb-ink{background-image:linear-gradient(90deg,rgb(20,20,20),rgb(80,80,80),rgb(140,140,140),rgb(200,200,200),rgb(250,250,250),rgb(250,250,250),rgb(200,200,200),rgb(140,140,140),rgb(80,80,80),rgb(20,20,20))}', '.dshwv-trowtx.dshwv-rgb-indigo{background-image:linear-gradient(90deg,rgb(32,49,112),rgb(52,76,146),rgb(74,102,180),rgb(100,126,210),rgb(130,132,224),rgb(130,132,224),rgb(100,126,210),rgb(74,102,180),rgb(52,76,146),rgb(32,49,112))}', '.dshwv-mimg{display:block;margin:0 auto;max-width:calc(var(--dshw-u) * 540);max-height:calc(var(--dshw-u) * 300);object-fit:contain}', '.dshwv-bubpal{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;margin:4px 0 6px;text-align:left}', '.dshwv-palchip{flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:4px 8px;cursor:pointer;user-select:none}', '.dshwv-palchip:hover{background:rgba(var(--gpt-ink-rgb),.18)}', '.dshwv-bubpvbox{min-height:60px;border:1px dashed rgba(var(--gpt-ink-rgb),.5);border-radius:10px;background:var(--gpt-surface);padding:8px;text-align:center}', '.dshwv-pvrow{display:flex;align-items:center;gap:4px;justify-content:center;margin:2px 0;padding:2px;border:1px solid transparent;border-radius:6px}', '.dshwv-pvrow:hover{background:rgba(var(--gpt-ink-rgb),.06);border-color:rgba(var(--gpt-ink-rgb),.2)}', '.dshwv-pvlab{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gpt-ink);line-height:1.2}', '.dshwv-pvrowline{flex-wrap:wrap;justify-content:center;gap:4px;text-align:center}', '.dshwv-pvmod{display:inline-flex;align-items:center;gap:3px;border:1px solid rgba(var(--gpt-ink-rgb),.4);background:var(--gpt-surface);border-radius:9px;padding:1px 5px 1px 9px;cursor:grab;max-width:100%;box-sizing:border-box;box-shadow:0 1px 2px rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-pvmod:hover{border-color:rgba(var(--gpt-ink-rgb),.75);box-shadow:0 1px 5px rgba(var(--gpt-ink-rgb),.22)}', '.dshwv-pvmod .dshwv-pvlab{flex:1 1 auto;min-width:0;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gpt-ink);font-size:12px;line-height:1.5;cursor:grab}', '.dshwv-pvmod.dshwv-pvimg{border-style:dashed;background:var(--gpt-soft)}', '.dshwv-pvrowline .dshwv-bubmini{width:18px;height:18px;font-size:11px;opacity:.75}', '.dshwv-pvdrag{flex:0 0 auto;cursor:grab;color:rgba(var(--gpt-ink-rgb),.5);font-size:14px;line-height:1;padding:2px 3px;user-select:none}', '.dshwv-pvdrag:hover{color:var(--gpt-ink)}', '.dshwv-pvadd{flex:0 0 auto;width:22px;height:22px;border:1px dashed rgba(var(--gpt-ink-rgb),.6);border-radius:8px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:13px;line-height:1;cursor:pointer;padding:0;margin-left:2px}', '.dshwv-pvadd:hover{border-color:var(--gpt-ink);background:var(--gpt-soft)}', '.dshwv-bubimgprev{display:none;max-width:120px;max-height:80px;margin:6px auto;border-radius:6px;border:1px solid rgba(var(--gpt-ink-rgb),.3)}', '.dshwv-bubprev{margin:8px auto 2px;text-align:center}', '.dshwv-minipop{position:relative;width:100%;aspect-ratio:1026/700;margin:0 auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.18))}', '.dshwv-minipop svg{display:block;width:100%;height:100%}', '.dshwv-bubchip-btn{flex:1;min-width:0;border:1px dashed rgba(var(--gpt-ink-rgb),.35);border-radius:8px;background:var(--gpt-surface);color:var(--gpt-ink);font-size:12px;height:34px;padding:0 8px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-bubchip-btn:hover{background:rgba(var(--gpt-ink-rgb),.06)}', '.dshwv-bubrow-drag{cursor:grab}', '.dshwv-bubrow-drag:hover{border-color:rgba(var(--gpt-ink-rgb),.4)}', '.dshwv-bubdrag{flex:0 0 auto;color:var(--gpt-muted);font-size:14px;cursor:grab;padding:0 2px}', '.dshwv-bublibrow{display:flex;align-items:center;gap:6px;margin:2px 0}', '.dshwv-bubnewbtn{border:none;border-radius:6px;background:rgba(var(--gpt-ink-rgb),.1);color:var(--gpt-ink);font-size:12px;padding:4px 8px;cursor:pointer}', '.dshwv-bubnewbtn:hover{background:rgba(var(--gpt-ink-rgb),.2)}', '.dshwv-linerow{border:1px solid rgba(var(--gpt-ink-rgb),.14);border-radius:6px;margin:2px 0;padding:2px;background:var(--gpt-surface)}', '.dshwv-linew{width:48px;box-sizing:border-box;flex:0 0 auto;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px;font-size:12px;color:var(--gpt-ink);text-align:center}', '.dshwv-linetx{flex:1;min-width:0;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:3px 6px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface)}', '.dshwv-linedel{flex:0 0 auto;width:18px;height:18px;line-height:1;border:none;background:none;color:#c0392b;cursor:pointer;font-size:10px;padding:0}', '.dshwv-linepanel{border-top:1px dashed rgba(var(--gpt-ink-rgb),.2);margin:2px 0 4px;padding:2px 4px 0}', '.dshwv-linehead{display:flex;align-items:center;gap:8px;margin:2px 0 4px;padding:0 3px;color:var(--gpt-muted);font-size:11px}', '.dshwv-linehead .dshwv-lhw{flex:0 0 48px;text-align:center}', '.dshwv-linehead .dshwv-lhc{flex:1;min-width:0;display:flex;justify-content:center}', '.dshwv-linehead .dshwv-lho{flex:0 0 78px;text-align:center}', '.dshwv-linerow .dshwv-audiorow{margin-bottom:0}', '.dshwv-addline{display:block;width:70%;margin:12px auto 0;border:1px dashed rgba(var(--gpt-ink-rgb),.5);border-radius:8px;background:transparent;color:var(--gpt-ink);font-size:12px;padding:6px 8px;cursor:pointer}', '.dshwv-addline:hover{background:rgba(var(--gpt-ink-rgb),.08)}', '.dshwv-colrow{display:flex;align-items:center;gap:8px;position:relative;margin:2px 0 4px}', '.dshwv-colsw{width:34px;height:22px;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;cursor:pointer;font-size:10px;padding:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}', '.dshwv-colpop{position:absolute;left:0;top:calc(100% + 4px);z-index:30;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.3);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.18);padding:8px;width:190px;text-align:left}', '.dshwv-coldots{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:8px}', '.dshwv-coldot{width:22px;height:22px;border-radius:50%;border:1px solid rgba(var(--gpt-ink-rgb),.25);cursor:pointer;padding:0}', '.dshwv-colhex{width:100%;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:3px 6px;font-size:11px;color:var(--gpt-ink);margin-bottom:8px}', '.dshwv-colfoot{display:flex;gap:8px;justify-content:flex-end}', '.dshwv-colnat{width:42px;height:26px;border:1px solid rgba(var(--gpt-ink-rgb),.45);border-radius:6px;padding:2px;background:var(--gpt-surface);cursor:pointer;box-sizing:border-box}', '.dshwv-rgbmenu,.dshwv-rolelist,.dshwv-audiolist,.dshwv-slotlist,.dshwv-usage-sub,.dshwv-listbox{scrollbar-width:thin;scrollbar-color:rgba(var(--gpt-ink-rgb),.16) transparent}', '.dshwv-rgbmenu::-webkit-scrollbar,.dshwv-rolelist::-webkit-scrollbar,.dshwv-audiolist::-webkit-scrollbar,.dshwv-slotlist::-webkit-scrollbar,.dshwv-usage-sub::-webkit-scrollbar,.dshwv-listbox::-webkit-scrollbar{width:6px}', '.dshwv-rgbmenu::-webkit-scrollbar-track,.dshwv-rolelist::-webkit-scrollbar-track,.dshwv-audiolist::-webkit-scrollbar-track,.dshwv-slotlist::-webkit-scrollbar-track,.dshwv-usage-sub::-webkit-scrollbar-track,.dshwv-listbox::-webkit-scrollbar-track{background:transparent}', '.dshwv-rgbmenu::-webkit-scrollbar-thumb,.dshwv-rolelist::-webkit-scrollbar-thumb,.dshwv-audiolist::-webkit-scrollbar-thumb,.dshwv-slotlist::-webkit-scrollbar-thumb,.dshwv-usage-sub::-webkit-scrollbar-thumb,.dshwv-listbox::-webkit-scrollbar-thumb{background:rgba(var(--gpt-ink-rgb),.14);border-radius:3px}', '.dshwv-rgbmenu::-webkit-scrollbar-thumb:hover,.dshwv-rolelist::-webkit-scrollbar-thumb:hover,.dshwv-audiolist::-webkit-scrollbar-thumb:hover,.dshwv-slotlist::-webkit-scrollbar-thumb:hover,.dshwv-usage-sub::-webkit-scrollbar-thumb:hover,.dshwv-listbox::-webkit-scrollbar-thumb:hover{background:rgba(var(--gpt-ink-rgb),.26)}', '.dshwv-custwrap{position:relative;flex:1;min-width:0;display:flex;align-items:center}', '.dshwv-custbtn{flex:1;min-width:0;height:24px;box-sizing:border-box;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;background:rgba(var(--gpt-ink-rgb),.08);color:var(--gpt-ink);font-size:12px;padding:0 8px;cursor:pointer;display:flex;align-items:center;gap:6px;text-align:left}', '.dshwv-custbtn:hover{background:rgba(var(--gpt-ink-rgb),.16)}', '.dshwv-custbtn:disabled{opacity:.45;cursor:not-allowed}', '.dshwv-custbtn::after{content:"▾";font-size:9px;opacity:.7;flex:0 0 auto}', '.dshwv-custlab{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-custmenu{max-height:220px;max-width:min(340px,calc(100vw - 16px))}', '.dshwv-custrow{display:flex;align-items:center;min-width:0;overflow:hidden;box-sizing:border-box}', '.dshwv-custrow .dshwv-custnm{flex:1;min-width:0;overflow:hidden;display:flex;align-items:center}', '.dshwv-custrow .dshwv-custnm .dshwv-nameinner{display:inline-flex;white-space:nowrap;transition:transform .22s ease}', '.dshwv-custrow .dshwv-custnm .dshwv-namecopy{margin-right:40px;white-space:nowrap;flex:0 0 auto}', '.dshwv-stylerow{display:flex;align-items:flex-start;gap:10px;margin:0 0 2px}', '.dshwv-stylerow .dshwv-qedit-row{flex:1 1 50%;min-width:0;width:auto;margin:0;align-items:center;flex-wrap:nowrap}', '.dshwv-stylerow .dshwv-qcolwrap{width:auto;max-width:none;min-width:0;flex:1 1 auto}', '.dshwv-stylerow .dshwv-qcolwrap .dshwv-rgbhead{width:100%;padding:3px 6px;font-size:12px}', '.dshwv-stylerow .dshwv-qcolorhost{gap:3px}', '.dshwv-stylerow .dshwv-qcolorhost input[type=color]{width:22px;height:18px}', '.dshwv-stylerow .dshwv-qcolorhost .dshwv-bubmini{height:18px;font-size:10px;padding:0 4px}', '.dshwv-tplq{flex:0 0 auto;width:18px;height:18px;border-radius:50%;border:1px solid rgba(var(--gpt-ink-rgb),.55);background:none;color:var(--gpt-ink);font-size:11px;font-weight:700;line-height:1;cursor:pointer;padding:0;margin-left:4px}', '.dshwv-tplq:hover{background:rgba(var(--gpt-ink-rgb),.14)}', '.dshwv-tplhelp{position:fixed;z-index:26080;display:none;max-width:252px;background:var(--gpt-surface);border:1px solid rgba(var(--gpt-ink-rgb),.35);border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,.16);padding:8px 10px;font-size:12px;color:var(--gpt-ink);color-scheme:light}', '.dshwv-rescard{width:min(620px,94vw)}', '.dshwv-reshead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 0;flex:0 0 auto}', '.dshwv-reshead .dshwv-restitle{font-size:15px;font-weight:700;color:var(--gpt-ink)}', '.dshwv-resclose{flex:0 0 auto;border:none;background:none;cursor:pointer;font-size:15px;color:var(--gpt-muted);padding:2px 6px;border-radius:6px}', '.dshwv-resclose:hover{background:rgba(var(--gpt-ink-rgb),.1);color:var(--gpt-ink)}', '.dshwv-reswrap{overflow-y:auto;padding:4px 14px 12px;flex:1 1 auto;min-height:0}', '.dshwv-rescat{font-weight:700;color:var(--gpt-ink);margin:12px 0 4px;font-size:13px;display:flex;align-items:center;gap:8px}', '.dshwv-rescat::after{content:"";flex:1;height:1px;background:rgba(var(--gpt-ink-rgb),.15)}', '.dshwv-resrow{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:7px}', '.dshwv-resrow:hover{background:rgba(var(--gpt-ink-rgb),.06)}', '.dshwv-resthum{width:34px;height:34px;border-radius:6px;object-fit:cover;flex:0 0 auto;background:var(--gpt-tint);border:1px solid rgba(var(--gpt-ink-rgb),.12)}', '.dshwv-resicon{width:34px;height:34px;border-radius:6px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--gpt-soft)}', '.dshwv-resmain{flex:1;min-width:0;overflow:hidden}', '.dshwv-resnm{font-size:12px;color:var(--gpt-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-resmeta{font-size:10px;color:var(--gpt-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}', '.dshwv-restag{flex:0 0 auto;font-size:10px;color:var(--gpt-surface);background:var(--gpt-ink);border-radius:3px;padding:1px 5px}', '.dshwv-restag-built{background:var(--gpt-muted)}', '.dshwv-resdel{flex:0 0 auto;border:1px solid rgba(201,57,43,.4);border-radius:5px;background:none;color:#c9392b;font-size:11px;padding:2px 9px;cursor:pointer}', '.dshwv-resdel:hover{background:rgba(201,57,43,.08)}', '.dshwv-resdel:disabled{opacity:.4;cursor:not-allowed}', '.dshwv-resempty{color:var(--gpt-muted);font-size:12px;padding:4px 8px}'].join('\n');
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    // Extra settings must remain reachable in a small Codex window. Popovers
    // are mounted on document.body, so scrolling this panel does not clip them.
    styleEl.textContent += '\n.dshwv-menu{max-height:calc(100vh - 16px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}';
    document.head.appendChild(styleEl);
    var root = document.createElement('div');
    root.className = 'dshwv-root';
    var positioner = document.createElement('div');
    positioner.className = 'dshwv-position';
    positioner.appendChild(root);
    var img = document.createElement('img');
    img.className = 'dshwv-img';
    var initRoleUrl = IMG_URL;
    try {
      var initRoleId = localStorage.getItem('dshw-role') || '';
      if (initRoleId && initRoleId !== 'default') initRoleUrl = '/dsh-whale/role-image.png?id=' + encodeURIComponent(initRoleId);
    } catch (err) {}
    img.src = initRoleUrl;
    wb(img, "alt", (function(){ return function(){ return wm("widget.apiBalance"); }; })());
    img.draggable = false;
    var menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'dshwv-menu-btn';
    wb(menuBtn, "title", (function(){ return function(){ return wm("widget.menu"); }; })());
    menuBtn.innerHTML = '<span></span><span></span><span></span>';
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });
    var menuBox = document.createElement('div');
    menuBox.className = 'dshwv-menu';
    menuBox.addEventListener('scroll', function () {
      dshwCustSelClose(); closeRolePanel(); closeAudioGroupPanel(); closeFxInfo();
    });
    function menuLabel(text) {
      var s = document.createElement('span');
      wb(s, "textContent", (function(text){ return function(){ return text; }; })(text));
      return s;
    }
    function menuRow() {
      var r = document.createElement('div');
      r.className = 'dshwv-menu-row';
      return r;
    }
    var scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = String(MIN_SCALE);
    scaleInput.max = String(MAX_SCALE);
    scaleInput.step = '0.1';
    scaleInput.className = 'dshwv-range';
    scaleInput.value = '1.5';
    var scaleNumber = document.createElement('input');
    scaleNumber.type = 'number';
    scaleNumber.min = '1';
    scaleNumber.max = '20';
    scaleNumber.step = '1';
    scaleNumber.className = 'dshwv-number';
    scaleNumber.value = '10';
    scaleInput.addEventListener('pointerdown', function () {
      positioner.style.transition = 'none';
    });
    scaleInput.addEventListener('input', function () {
      setScale(scaleInput.value);
    });
    scaleInput.addEventListener('change', function () {
      positioner.style.transition = '';
      try {
        refreshFlip();
      } catch (err) {}
    });
    scaleNumber.addEventListener('focus', function () {
      positioner.style.transition = 'none';
    });
    scaleNumber.addEventListener('blur', function () {
      positioner.style.transition = '';
    });
    scaleNumber.addEventListener('input', function () {
      var v = Math.round(Number(scaleNumber.value));
      var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19;
      setScale(s);
    });
    scaleNumber.addEventListener('change', function () {
      var v = Math.round(Number(scaleNumber.value));
      var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19;
      setScale(s);
      positioner.style.transition = '';
      try {
        refreshFlip();
      } catch (err) {}
    });
    var audioGroupBtn = document.createElement('button');
    audioGroupBtn.type = 'button';
    audioGroupBtn.className = 'dshwv-audiobtn';
    wb(audioGroupBtn, "title", (function(){ return function(){ return wm("widget.chooseSoundSet"); }; })());
    var audioGroupBtnLabel = document.createElement('span');
    audioGroupBtnLabel.className = 'dshwv-btnlabel';
    wb(audioGroupBtnLabel, "textContent", (function(){ return function(){ return wm("widget.rubberDuck"); }; })());
    audioGroupBtn.appendChild(audioGroupBtnLabel);
    var audioGroupPanel = document.createElement('div');
    audioGroupPanel.className = 'dshwv-audiolist';
    var audioImportBtn = document.createElement('button');
    audioImportBtn.type = 'button';
    audioImportBtn.className = 'dshwv-audioimport';
    wb(audioImportBtn, "textContent", (function(){ return function(){ return wm("widget.import"); }; })());
    wb(audioImportBtn, "title", (function(){ return function(){ return wm("widget.createOrEditASoundSet"); }; })());
    audioGroupBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioGroupPanel();
    });
    audioImportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openAudioGroupEditor(null);
    });
    document.body.appendChild(audioGroupPanel);
    function soundOpt(value, label) {
      var o = document.createElement('option');
      o.value = value;
      wb(o, "textContent", (function(label){ return function(){ return label; }; })(label));
      return o;
    }
    var dshwCustSelOpen = null;
    var dshwCustSuppressAt = 0;
    function dshwCustSelClose() {
      var o = dshwCustSelOpen;
      dshwCustSelOpen = null;
      if (!o) return;
      try {
        o.menu.classList.remove('dshwv-rgbopen');
        if (o.menu.parentNode === document.body) document.body.removeChild(o.menu);
      } catch (err) {}
    }
    if (!window.__dshwCustBound) {
      window.__dshwCustBound = true;
      document.addEventListener('pointerdown', function (e) {
        var o = dshwCustSelOpen;
        if (!o) return;
        try {
          var onBtn = !!(e.target && e.target.closest && e.target.closest('.dshwv-custbtn'));
          if (onBtn) {
            dshwCustCloseNow();
            return;
          }
          if (e.target && o.menu.contains(e.target)) return;
        } catch (err) {}
        dshwCustSelClose();
      }, true);
      document.addEventListener('keydown', function (e) {
      if (whaleImeKey(e)) return;
        if (e.key === 'Escape') dshwCustCloseNow();
      }, true);
      window.addEventListener('resize', function () {
        dshwCustCloseNow();
      });
    }
    function dshwCustCloseNow() {
      dshwCustSelClose();
      dshwCustSuppressAt = Date.now();
    }
    var taskEndDrop = null;
    var moduleImgDrop = null;
    function dshwCustSel(sel, opts) {
      if (!sel || !sel.parentNode || sel.__dshwCust) return {
        sync: function () {},
        refresh: function () {}
      };
      sel.__dshwCust = true;
      var parent = sel.parentNode;
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-custwrap';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dshwv-custbtn';
      wb(btn, 'title', function(){return sel.title || '';});
      var lab = document.createElement('span');
      lab.className = 'dshwv-custlab';
      btn.appendChild(lab);
      parent.insertBefore(wrap, sel);
      wrap.appendChild(btn);
      wrap.appendChild(sel);
      sel.style.display = 'none';
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-custmenu';
      function labelOf(v) {
        for (var i = 0; i < sel.options.length; i++) {
          if (String(sel.options[i].value) === String(v)) return String(sel.options[i].textContent || sel.options[i].text || '');
        }
        return '';
      }
      function sync() {
        try {
          wb(lab, "textContent", (function(labelOf,sel){ return function(){ return labelOf(sel.value) || '—'; }; })(labelOf,sel));
          btn.disabled = !!sel.disabled;
        } catch (err) {}
      }
      function fill() {
        menu.innerHTML = '';
        var cur = sel.value;
        for (var i = 0; i < sel.options.length; i++) {
          (function (opt) {
            var d = document.createElement('div');
            var lab = wexpr(function(){ return opt.textContent || opt.text || opt.value; });
            if (opts && opts.scrollNames) {
              d.className = 'dshwv-rgbopt dshwv-custrow' + (String(opt.value) === String(cur) ? ' dshwv-rgbcur' : '');
              var nm = makeNameCell('dshwv-custnm', lab);
              d.appendChild(nm);
              bindNameMarquee(d, nm);
            } else {
              d.className = 'dshwv-rgbopt' + (String(opt.value) === String(cur) ? ' dshwv-rgbcur' : '');
              wb(d, "textContent", (function(lab){ return function(){ return lab; }; })(lab));
            }
            d.addEventListener('click', function (e) {
              e.stopPropagation();
              try {
                sel.value = opt.value;
              } catch (err) {}
              sync();
              dshwCustSelClose();
              try {
                sel.dispatchEvent(new Event('change'));
              } catch (err) {}
            });
            menu.appendChild(d);
          })(sel.options[i]);
        }
      }
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (btn.disabled) return;
        if (dshwCustSuppressAt && Date.now() - dshwCustSuppressAt < 350) {
          dshwCustSuppressAt = 0;
          return;
        }
        if (dshwCustSelOpen && dshwCustSelOpen.btn === btn) {
          dshwCustSelClose();
          return;
        }
        dshwCustSelClose();
        fill();
        sync();
        if (menu.parentNode !== document.body) document.body.appendChild(menu);
        dshwDropOpen(menu, btn);
        if (opts && typeof opts.bottom === 'function') {
          try {
            var bEl = opts.bottom();
            if (bEl && bEl.getBoundingClientRect) {
              var bTop = bEl.getBoundingClientRect().top;
              var mTop = menu.getBoundingClientRect().top;
              var avail = Math.floor(bTop - mTop - 6);
              if (avail >= 40) menu.style.maxHeight = Math.min(avail, 220) + 'px';
            }
          } catch (err) {}
        }
        dshwCustSelOpen = {
          menu: menu,
          btn: btn
        };
      });
      sync();
      window.WhaleI18n.onChange(function(){ if (wrap.isConnected) sync(); });
      return {
        sync: sync,
        refresh: function () {
          fill();
          sync();
        }
      };
    }
    var usageRecBtn = document.createElement('button');
    usageRecBtn.type = 'button';
    usageRecBtn.className = 'dshwv-roleimport';
    wb(usageRecBtn, "textContent", (function(){ return function(){ return wm("widget.apiUsageHistory"); }; })());
    wb(usageRecBtn, "title", (function(){ return function(){ return wm("widget.viewTodayTheLast7DaysOrAll"); }; })());
    usageRecBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleUsagePanel();
    });
    var taskEndToggle = document.createElement('input');
    taskEndToggle.type = 'checkbox';
    taskEndToggle.className = 'dshwv-check';
    taskEndToggle.checked = false;
    wb(taskEndToggle, "title", (function(){ return function(){ return wm("widget.playASoundWhenATurnCompletes"); }; })());
    taskEndToggle.addEventListener('change', function () {
      usageSet = usageSet || ({});
      usageSet.taskEnd = usageSet.taskEnd || ({
        on: false,
        sel: ''
      });
      usageSet.taskEnd.on = taskEndToggle.checked;
      taskEndSel.disabled = !taskEndToggle.checked;
      if (taskEndDrop) taskEndDrop.refresh();
      saveUsageSettings({
        taskEnd: usageSet.taskEnd
      });
    });
    var taskEndSel = document.createElement('select');
    taskEndSel.className = 'dshwv-sound';
    taskEndSel.disabled = true;
    wb(taskEndSel, "title", (function(){ return function(){ return wm("widget.chooseACompletionSoundASoundSetOr"); }; })());
    taskEndSel.addEventListener('change', function () {
      usageSet = usageSet || ({});
      usageSet.taskEnd = usageSet.taskEnd || ({
        on: false,
        sel: ''
      });
      usageSet.taskEnd.sel = taskEndSel.value;
      saveUsageSettings({
        taskEnd: usageSet.taskEnd
      });
    });
    function fillTaskEndOptions(pref) {
      var prefSel = usageSet && usageSet.taskEnd && usageSet.taskEnd.sel || pref && pref.sel || '';
      var cur = taskEndSel.value || prefSel || '';
      taskEndSel.innerHTML = '';
      var seen = {};
      var seenLbl = {};
      function add(v, lab) {
        if (seen[v]) return;
        if (seenLbl[lab]) return;
        seen[v] = 1;
        seenLbl[lab] = 1;
        taskEndSel.appendChild(soundOpt(v, lab));
      }
      var grps = Array.isArray(audioGroups) ? audioGroups : [];
      for (var gi = 0; gi < grps.length; gi++) {
        var gg = grps[gi];
        if (!gg || !gg.id) continue;
        var gv = 'grp:' + gg.id;
        if (seen[gv]) continue;
        seen[gv] = 1;
        taskEndSel.appendChild(soundOpt(gv, (function(id){return wexpr(function(){ return audioGroupName(id) + wt('widget.click'); });})(gg.id)));
      }
      var pre = [['preset:duck:press', wm("widget.rubberDuckPress")], ['preset:duck:release', wm("widget.rubberDuckRelease")], ['preset:fx1:press', wm("widget.sound1Press")], ['preset:fx1:release', wm("widget.sound1Release")]];
      pre.forEach(function (o) {
        add(o[0], o[1]);
      });
      var frags = Array.isArray(audioFragments) ? audioFragments : [];
      frags.forEach(function (f) {
        if (!f || !f.id) return;
        if (f.preset) return;
        add('frag:' + f.id, String(f.name || f.id));
      });
      var fragN = 0;
      for (var fi = 0; fi < taskEndSel.options.length; fi++) if (String(taskEndSel.options[fi].value).indexOf('frag:') === 0) fragN++;
      var found = false;
      for (var i = 0; i < taskEndSel.options.length; i++) if (taskEndSel.options[i].value === cur) {
        taskEndSel.value = cur;
        found = true;
        break;
      }
      if (!found) {
        if (cur && String(cur).indexOf('frag:') === 0 && fragN === 0) {
          taskEndSel.value = '';
          if (taskEndDrop) taskEndDrop.refresh();
          return;
        }
        if (cur && String(cur).indexOf('grp:') === 0 && (!Array.isArray(audioGroups) || audioGroups.length === 0)) {
          taskEndSel.value = '';
          if (taskEndDrop) taskEndDrop.refresh();
          return;
        }
        var chosen = 'preset:duck:press';
        for (var j = 0; j < taskEndSel.options.length; j++) {
          var v = taskEndSel.options[j].value;
          if (v.indexOf('frag:') === 0) {
            chosen = v;
            if (String(taskEndSel.options[j].textContent || '') === 'entity') break;
          }
        }
        taskEndSel.value = chosen;
        usageSet = usageSet || ({});
        usageSet.taskEnd = usageSet.taskEnd || ({
          on: false,
          sel: ''
        });
        usageSet.taskEnd.sel = chosen;
      }
      if (pref && pref.sel) {
        for (var k = 0; k < taskEndSel.options.length; k++) if (taskEndSel.options[k].value === pref.sel) taskEndSel.value = pref.sel;
      }
      var seen2 = {};
      for (var di = taskEndSel.options.length - 1; di >= 0; di--) {
        var dv = taskEndSel.options[di].value;
        if (seen2[dv]) {
          try {
            taskEndSel.remove(di);
          } catch (err) {}
        } else seen2[dv] = 1;
      }
      if (taskEndDrop) taskEndDrop.refresh();
    }
    function refreshTaskEndAfterAudio() {
      try {
        fillTaskEndOptions(usageSet && usageSet.taskEnd || null);
      } catch (err) {}
    }
    function playTaskEndSound() {
      try {
        if (!usageSet || !usageSet.taskEnd || !usageSet.taskEnd.on || soundOn === false) return;
        var sel = usageSet.taskEnd.sel || taskEndSel.value || '';
        var url = '';
        if (sel.indexOf('grp:') === 0) {
          if (window.WhaleFeedback) {
            var groupId = sel.slice(4);
            var sources = ['press', 'release'].filter(function (slot) { return !audioGroupSlotEmpty(groupId, slot); })
              .map(function (slot) { return '/dsh-whale/sound/' + slot + '.mp3?set=' + encodeURIComponent(groupId); });
            window.WhaleFeedbackSources = window.WhaleFeedbackSources || {};
            window.WhaleFeedbackSources.success = sources;
            if (sources.length) window.WhaleFeedback.play('success', sources, soundOn ? soundVol : 0);
            return;
          }
          playTaskEndGroupClick(sel.slice(4));
          return;
        }
        if (sel.indexOf('frag:') === 0) url = '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(sel.slice(5)); else if (sel.indexOf('preset:') === 0) {
          var parts = sel.split(':');
          url = '/dsh-whale/sound/' + (parts[2] === 'release' ? 'release' : 'press') + '.mp3?set=' + parts[1];
        }
        if (!url) return;
        if (window.WhaleFeedback) { window.WhaleFeedbackSources = window.WhaleFeedbackSources || {}; window.WhaleFeedbackSources.success = url; window.WhaleFeedback.play('success', url, soundOn ? soundVol : 0); return; }
        var a = new Audio(url);
        try {
          a.volume = (Number.isFinite(Number(soundVol)) ? Number(soundVol) : 0.9);
        } catch (err) {}
        a.play().catch(function () {});
      } catch (err) {}
    }
    function playTaskEndGroupClick(groupId) {
      try {
        if (!groupId) return;
        var g = null;
        for (var gi = 0; gi < audioGroups.length; gi++) if (audioGroups[gi] && audioGroups[gi].id === groupId) {
          g = audioGroups[gi];
          break;
        }
        var pressEmpty = !!(g && g.press === '');
        var releaseEmpty = !!(g && g.release === '');
        if (pressEmpty && releaseEmpty) return;
        var vol = (Number.isFinite(Number(soundVol)) ? Number(soundVol) : 0.9);
        if (pressEmpty) {
          if (!releaseEmpty) {
            var relOnly = new Audio('/dsh-whale/sound/release.mp3?set=' + encodeURIComponent(groupId));
            try {
              relOnly.volume = vol;
            } catch (err) {}
            relOnly.currentTime = 0;
            var pr = relOnly.play();
            if (pr && pr.catch) pr.catch(function () {});
          }
          return;
        }
        var press = new Audio('/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(groupId));
        try {
          press.volume = vol;
        } catch (err) {}
        if (releaseEmpty) {
          press.currentTime = 0;
          var pp = press.play();
          if (pp && pp.catch) pp.catch(function () {});
          return;
        }
        var release = new Audio('/dsh-whale/sound/release.mp3?set=' + encodeURIComponent(groupId));
        try {
          release.volume = vol;
        } catch (err) {}
        var relPlayed = false;
        function playRel() {
          if (relPlayed) return;
          relPlayed = true;
          try {
            release.currentTime = 0;
            var p = release.play();
            if (p && p.catch) p.catch(function () {});
          } catch (err) {}
        }
        press.onended = function () {
          playRel();
        };
        press.currentTime = 0;
        var p0 = press.play();
        if (p0 && p0.catch) p0.catch(function () {});
      } catch (err) {}
    }
    var bubbleToggle = document.createElement('input');
    bubbleToggle.type = 'checkbox';
    bubbleToggle.className = 'dshwv-check';
    bubbleToggle.checked = true;
    wb(bubbleToggle, "title", (function(){ return function(){ return wm("widget.showOrHideBubbles"); }; })());
    bubbleToggle.addEventListener('change', function () {
      setBubbleOn(bubbleToggle.checked);
    });
    var turnCostToggle = document.createElement('input');
    turnCostToggle.type = 'checkbox';
    turnCostToggle.className = 'dshwv-check';
    turnCostToggle.checked = true;
    wb(turnCostToggle, "title", (function(){ return function(){ return wm("widget.showTheObservedCostAfterEachTurn"); }; })());
    turnCostToggle.addEventListener('change', function () {
      setTurnCostOn(turnCostToggle.checked);
    });
    var turnCostCloseInput = document.createElement('input');
    turnCostCloseInput.type = 'number';
    turnCostCloseInput.min = '0';
    turnCostCloseInput.step = '1';
    turnCostCloseInput.className = 'dshwv-number';
    turnCostCloseInput.value = '5';
    turnCostCloseInput.disabled = false;
    wb(turnCostCloseInput, "title", (function(){ return function(){ return wm("widget.use0ToKeepTheBubbleOpenUntil"); }; })());
    turnCostCloseInput.addEventListener('input', function () {
      setTurnCostClose(turnCostCloseInput.value);
    });
    turnCostCloseInput.addEventListener('change', function () {
      setTurnCostClose(turnCostCloseInput.value);
    });
    var scrollGapToggle = document.createElement('input');
    scrollGapToggle.type = 'checkbox';
    scrollGapToggle.className = 'dshwv-check';
    scrollGapToggle.checked = false;
    wb(scrollGapToggle, "title", (function(){ return function(){ return wm("widget.leaveAGapForTheScrollbarTurnOff"); }; })());
    scrollGapToggle.addEventListener('change', function () {
      setScrollGapOn(scrollGapToggle.checked);
    });
    var scrollGapInput = document.createElement('input');
    scrollGapInput.type = 'number';
    scrollGapInput.min = '0';
    scrollGapInput.step = '1';
    scrollGapInput.className = 'dshwv-number';
    scrollGapInput.value = '17';
    scrollGapInput.disabled = true;
    wb(scrollGapInput, "title", (function(){ return function(){ return wm("widget.scrollbarGapInPixelsUse0ForNo"); }; })());
    scrollGapInput.addEventListener('input', function () {
      setScrollGapPx(scrollGapInput.value);
    });
    scrollGapInput.addEventListener('change', function () {
      setScrollGapPx(scrollGapInput.value);
    });
    var row1 = menuRow();
    row1.dataset.settingsGroup = "appearance";
    row1.appendChild(menuLabel(wm("widget.size")));
    row1.appendChild(scaleInput);
    row1.appendChild(scaleNumber);
    var row2 = menuRow();
    row2.dataset.settingsGroup = "feedback";
    row2.appendChild(menuLabel(wm("widget.sound")));
    row2.appendChild(audioGroupBtn);
    row2.appendChild(audioImportBtn);
    var volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '1';
    volInput.step = '0.05';
    volInput.className = 'dshwv-range';
    volInput.value = '0.9';
    var volPct = document.createElement('span');
    volPct.className = 'dshwv-volpct';
    volPct.textContent = '90%';
    volInput.addEventListener('input', function () {
      setVol(volInput.value);
    });
    var row3 = menuRow();
    row3.dataset.settingsGroup = "feedback";
    row3.appendChild(menuLabel(wm("widget.volume")));
    row3.appendChild(volInput);
    row3.appendChild(volPct);
    var row6 = menuRow();
    row6.dataset.settingsGroup = "feedback";
    row6.appendChild(menuLabel(wm("widget.bubbles")));
    row6.appendChild(bubbleToggle);
    var bubbleCustomBtn = document.createElement('button');
    bubbleCustomBtn.type = 'button';
    bubbleCustomBtn.className = 'dshwv-roleimport';
    bubbleCustomBtn.style.flex = '1';
    wb(bubbleCustomBtn, "textContent", (function(){ return function(){ return wm("widget.editBubbles"); }; })());
    wb(bubbleCustomBtn, "title", (function(){ return function(){ return wm("widget.openTheBubbleEditor"); }; })());
    bubbleCustomBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openBubbleEditor();
    });
    row6.appendChild(bubbleCustomBtn);
    var menuSep1 = document.createElement('div');
    menuSep1.className = 'dshwv-menu-sep';
    var row7 = menuRow();
    row7.dataset.settingsGroup = "feedback";
    row7.appendChild(menuLabel(wm("widget.turnCostNotices")));
    row7.appendChild(turnCostToggle);
    row7.appendChild(menuLabel(wm("widget.autoClose")));
    row7.appendChild(turnCostCloseInput);
    row7.appendChild(menuLabel(wm("widget.sec")));
    var row9 = menuRow();
    row9.dataset.settingsGroup = "appearance";
    row9.appendChild(menuLabel(wm("widget.scrollbarGap")));
    row9.appendChild(scrollGapToggle);
    row9.appendChild(menuLabel(wm("widget.width")));
    row9.appendChild(scrollGapInput);
    row9.appendChild(menuLabel('px'));
    var roleBtn = document.createElement('button');
    roleBtn.type = 'button';
    roleBtn.className = 'dshwv-rolebtn';
    wb(roleBtn, "title", (function(){ return function(){ return wm("widget.chooseCharacter"); }; })());
    var roleBtnLabel = document.createElement('span');
    roleBtnLabel.className = 'dshwv-btnlabel';
    wb(roleBtnLabel, "textContent", (function(){ return function(){ return wm("widget.gptDragonGirl"); }; })());
    roleBtn.appendChild(roleBtnLabel);
    var rolePanel = document.createElement('div');
    rolePanel.className = 'dshwv-rolelist';
    var roleImportBtn = document.createElement('button');
    roleImportBtn.type = 'button';
    roleImportBtn.className = 'dshwv-roleimport';
    wb(roleImportBtn, "textContent", (function(){ return function(){ return wm("widget.import"); }; })());
    wb(roleImportBtn, "title", (function(){ return function(){ return wm("widget.importACustomCharacterImage"); }; })());
    var rowRole = menuRow();
    rowRole.dataset.settingsGroup = "appearance";
    rowRole.appendChild(menuLabel(wm("widget.character")));
    rowRole.appendChild(roleBtn);
    rowRole.appendChild(roleImportBtn);
    var roleFileInput = document.createElement('input');
    roleFileInput.type = 'file';
    roleFileInput.accept = 'image/*';
    roleFileInput.style.display = 'none';
    roleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleRolePanel();
    });
    roleImportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      roleFileInput.click();
    });
    roleFileInput.addEventListener('change', function () {
      onRoleFileChosen(roleFileInput);
    });
    menuBox.appendChild(rowRole);
    menuBox.appendChild(row1);
    menuBox.appendChild(row2);
    menuBox.appendChild(row3);
    menuBox.appendChild(row6);
    menuBox.appendChild(row7);
    var rowTaskEnd = menuRow();
    rowTaskEnd.dataset.settingsGroup = "feedback";
    rowTaskEnd.appendChild(menuLabel(wm("widget.completionSound")));
    rowTaskEnd.appendChild(taskEndToggle);
    rowTaskEnd.appendChild(taskEndSel);
    taskEndDrop = dshwCustSel(taskEndSel, {
      bottom: function () {
        return usageNavRow;
      },
      scrollNames: true
    });
    try {
      var taskEndWrapEl = taskEndSel.parentNode;
      if (taskEndWrapEl) {
        taskEndWrapEl.style.flex = '0 0 120px';
        taskEndWrapEl.style.width = '120px';
        taskEndWrapEl.style.maxWidth = '120px';
      }
    } catch (err) {}
    menuBox.appendChild(rowTaskEnd);
    var currencyRow = menuRow();
    currencyRow.dataset.settingsGroup = "resources";
    currencyRow.dataset.accountApi = 'true';
    currencyRow.appendChild(menuLabel(wm("widget.displayCurrency")));
    var currencySel = document.createElement('select');
    currencySel.id = 'dshw-display-currency';
    currencySel.className = 'dshwv-sound';
    [['USD', wm("widget.usDollarUsd")], ['CNY', wm("widget.chineseYuanCny")]].forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0]; wb(option, "textContent", (function(entry){ return function(){ return entry[1]; }; })(entry)); currencySel.appendChild(option);
    });
    currencyRow.appendChild(currencySel);
    var currencyDrop = dshwCustSel(currencySel, { bottom: function () { return usageNavRow; } });
    currencySel.parentNode.style.flex = '0 0 120px';
    currencySel.parentNode.style.width = '120px';
    menuBox.appendChild(currencyRow);
    var currencyNote = document.createElement('div');
    currencyNote.className = 'dshwv-fx-info';
    currencyNote.id = 'dshw-currency-note';
    currencyNote.hidden = true; currencyNote.tabIndex = -1;
    currencyNote.setAttribute('role', 'region'); wb(currencyNote,"aria-label",(function(){ return function(){ return wm("widget.referenceExchangeRateDetails"); }; })());
    document.body.appendChild(currencyNote);
    var fxRefreshRow = menuRow();
    fxRefreshRow.dataset.settingsGroup = "resources";
    fxRefreshRow.dataset.accountApi = 'true';
    fxRefreshRow.appendChild(menuLabel(wm("widget.exchangeRate")));
    var fxRefreshBtn = document.createElement('button');
    fxRefreshBtn.type = 'button'; fxRefreshBtn.className = 'dshwv-roleimport';
    fxRefreshBtn.id = 'dshw-fx-refresh'; wb(fxRefreshBtn, "textContent", (function(){ return function(){ return wm("widget.refreshRate"); }; })());
    wb(fxRefreshBtn, "title", (function(){ return function(){ return wm("widget.checkFrankfurterAndUpdateDisplayedAmountsWait15"); }; })());
    fxRefreshRow.appendChild(fxRefreshBtn);
    var fxInfoBtn = document.createElement('button');
    fxInfoBtn.type = 'button'; fxInfoBtn.className = 'dshwv-fx-info-button';
    fxInfoBtn.id = 'dshw-fx-info'; fxInfoBtn.textContent = '!';
    wb(fxInfoBtn,"aria-label",(function(){ return function(){ return wm("widget.showReferenceExchangeRateDetails"); }; })());
    fxInfoBtn.setAttribute('aria-controls', currencyNote.id); fxInfoBtn.setAttribute('aria-expanded', 'false');
    fxRefreshRow.appendChild(fxInfoBtn); menuBox.appendChild(fxRefreshRow);
    function closeFxInfo(restoreFocus) {
      if (!currencyNote || currencyNote.hidden) return;
      currencyNote.hidden = true; fxInfoBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) fxInfoBtn.focus({ preventScroll: true });
    }
    function positionFxInfo() {
      if (currencyNote.hidden) return;
      var anchor = fxInfoBtn.getBoundingClientRect(), width = currencyNote.offsetWidth, height = currencyNote.offsetHeight;
      var left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
      var below = anchor.bottom + 7, above = anchor.top - height - 7;
      var top = below + height <= window.innerHeight - 8 ? below : Math.max(8, above);
      currencyNote.style.left = left + 'px';
      currencyNote.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
    }
    fxInfoBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!currencyNote.hidden) { closeFxInfo(true); return; }
      dshwCustSelClose(); closeRolePanel(); closeAudioGroupPanel();
      currencyNote.hidden = false; fxInfoBtn.setAttribute('aria-expanded', 'true');
      positionFxInfo(); currencyNote.focus({ preventScroll: true });
    });
    document.addEventListener('pointerdown', function (e) {
      if (!currencyNote.hidden && !currencyNote.contains(e.target) && !fxInfoBtn.contains(e.target)) closeFxInfo();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (whaleImeKey(e)) return;
      if (e.key === 'Escape' && !currencyNote.hidden) { e.preventDefault(); e.stopPropagation(); closeFxInfo(true); }
    }, true);
    window.addEventListener('resize', function () { closeFxInfo(); });
    function fxTime(value) {
      var date = new Date(value);
      return value && isFinite(date.getTime()) ? date.toLocaleString(window.WhaleI18n.locale, { timeZone: 'Asia/Shanghai', hour12: false }) : wm("widget.notYetRetrieved");
    }
    function updateFxButton() {
      var moneyState = WhaleMoney.state();
      var seconds = Math.ceil((moneyState.cooldownRemainingMs || 0) / 1000);
      fxRefreshBtn.disabled = !!moneyState.refreshing || seconds > 0;
      wb(fxRefreshBtn, "textContent", (function(moneyState,seconds){ return function(){ return moneyState.refreshing ? wm("widget.checking") : seconds > 0 ? seconds + wm("widget.secUntilRefresh") : wm("widget.refreshRate"); }; })(moneyState,seconds));
    }
    fxRefreshBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      WhaleMoney.refreshQuote({ force: true, apply: true, reason: 'manual' }).then(function (ok) {
        assetNotice(ok ? wm("widget.exchangeRateCheckedDisplayedAmountsUpdated") : wm("widget.couldNotCheckTheRateKeepingTheAvailable"));
      }).catch(function (error) { assetNotice(error.message); });
      updateFxButton();
    });
    setInterval(updateFxButton, 1000);
    WhaleMoney.onChange(function (moneyState) {
      currencySel.value = moneyState.displayCurrency;
      currencySel.disabled = ['USD', 'CNY'].indexOf(moneyState.nativeCurrency) < 0;
      currencyDrop.refresh();
      var fx = moneyState.quote;
      var latest = moneyState.latestQuote || fx;
      wb(currencyNote, "textContent", (function(fx,latest,fxTime,moneyState){ return function(){ return (fx ? wm("widget.1Usd") + fx.usdCny + wm("widget.cnyFrankfurterRateDate") + fx.date : wm("widget.retrievingReferenceExchangeRate")) +
        (latest && latest.stale ? wm("widget.offlineCache") : '') +
        wm("widget.lastRetrieved") + fxTime(latest && latest.retrievedAt) +
        wm("widget.lastChecked") + fxTime(moneyState.checkedAt) + wm("widget.beijingTime") +
        wm("widget.checkedDailyAt0015MarketHolidaysMay") +
        (moneyState.hasPendingQuote ? wm("widget.aNewRateIsReadyAndWillApply") : '') +
        (moneyState.error ? '\n' + moneyState.error : ''); }; })(fx,latest,fxTime,moneyState));
      wb(currencyNote, "title", (function(latest){ return function(){ return latest ? (latest.source || 'Frankfurter') + wm("widget.originalApiAmountsAndLedgerCurrencyStayUnchanged") : ''; }; })(latest));
      updateFxButton();
      positionFxInfo();
    });
    currencySel.addEventListener('change', function () {
      var next = currencySel.value;
      currencySel.value = WhaleMoney.state().displayCurrency;
      currencyDrop.refresh();
      WhaleMoney.setDisplayCurrency(next).catch(function () {});
    });
    menuBox.appendChild(menuSep1);
    menuBox.appendChild(row9);
    var rowSnap = menuRow();
    rowSnap.dataset.settingsGroup = "appearance";
    var snapRowLabel = document.createElement('span');
    wb(snapRowLabel, "textContent", (function(){ return function(){ return wm("widget.snapFlip"); }; })());
    var snapCustomBtn = document.createElement('button');
    snapCustomBtn.type = 'button';
    snapCustomBtn.className = 'dshwv-roleimport';
    wb(snapCustomBtn, "textContent", (function(){ return function(){ return wm("widget.customize"); }; })());
    wb(snapCustomBtn, "title", (function(){ return function(){ return wm("widget.setEdgeSnappingWidthsAndTheHorizontalFlip"); }; })());
    snapCustomBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openSnapModal();
    });
    rowSnap.appendChild(snapRowLabel);
    rowSnap.appendChild(snapCustomBtn);
    menuBox.appendChild(rowSnap);
    var menuHideToggle = document.createElement('input');
    menuHideToggle.type = 'checkbox';
    menuHideToggle.className = 'dshwv-check';
    menuHideToggle.checked = false;
    wb(menuHideToggle, "title", (function(){ return function(){ return wm("widget.hideTheMenuButtonRightClickGptDragon"); }; })());
    menuHideToggle.addEventListener('change', function () {
      setMenuBtnHide(menuHideToggle.checked);
    });
    var rowHide = menuRow();
    rowHide.dataset.settingsGroup = "appearance";
    rowHide.appendChild(menuLabel(wm("widget.hideMenuButton")));
    rowHide.appendChild(menuHideToggle);
    menuBox.appendChild(rowHide);
    var rowRes = menuRow();
    rowRes.dataset.settingsGroup = "resources";
    var resOpenBtn = document.createElement('button');
    resOpenBtn.type = 'button';
    resOpenBtn.className = 'dshwv-roleimport';
    resOpenBtn.style.flex = '1';
    wb(resOpenBtn, "textContent", (function(){ return function(){ return wm("widget.manage"); }; })());
    wb(resOpenBtn, "title", (function(){ return function(){ return wm("widget.manageImportedImagesAndAudio"); }; })());
    resOpenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openResManager();
    });
    rowRes.appendChild(menuLabel(wm("widget.mediaLibrary")));
    rowRes.appendChild(resOpenBtn);
    menuBox.appendChild(rowRes);
    var USAGE_REC_URL = '/dsh-whale/usage-records.json';
    var usageSet = null;
    var USAGE_SET_URL = '/dsh-whale/usage-settings.json';
    function loadUsageSettings(cb) {
      try {
        fetch(USAGE_SET_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (d && d.ok && d.settings) usageSet = d.settings;
          if (cb) cb();
        }).catch(function () {
          if (cb) cb();
        });
      } catch (err) {
        if (cb) cb();
      }
    }
    function saveUsageSettings(patch) {
      try {
        fetch(USAGE_SET_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(patch || ({}))
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && d.settings) usageSet = d.settings;
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var apiSettingsBtn = document.createElement('button');
    apiSettingsBtn.type = 'button';
    apiSettingsBtn.className = 'dshwv-api-open';
    apiSettingsBtn.dataset.accountApi = 'true';
    apiSettingsBtn.dataset.settingsGroup = 'resources';
    wb(apiSettingsBtn, "textContent", (function(){ return function(){ return wm("widget.apiSettings"); }; })());
    apiSettingsBtn.style.cssText = 'width:100%;margin:6px 0;padding:7px;border:1px solid var(--gpt-line);border-radius:8px;background:var(--gpt-soft);color:var(--gpt-ink);cursor:pointer';
    apiSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.dispatchEvent(new Event('whale-open-settings'));
    });
    menuBox.appendChild(apiSettingsBtn);
    var resetPositionBtn = document.createElement('button');
    resetPositionBtn.type = 'button'; resetPositionBtn.className = 'dshwv-sound';
    resetPositionBtn.dataset.settingsGroup = 'appearance';
    wb(resetPositionBtn, "textContent", (function(){ return function(){ return wm("widget.resetPositionToBottomRight"); }; })());
    resetPositionBtn.addEventListener('click', function () { window.dispatchEvent(new Event('whale-reset-position')); });
    menuBox.appendChild(resetPositionBtn);
    var menuRootView = document.createElement('div');
    menuRootView.className = 'dshwv-menuview';
    while (menuBox.firstChild) menuRootView.appendChild(menuBox.firstChild);
    menuBox.appendChild(menuRootView);
    var usagePanel = document.createElement('div');
    usagePanel.className = 'dshwv-usage-sub';
    usagePanel.style.display = 'none';
    var usageArea = document.createElement('div');
    usageArea.className = 'dshwv-usage-area';
    usageArea.style.cssText = 'flex:1 1 auto;min-height:0;overflow:hidden;position:relative';
    menuBox.appendChild(usageArea);
    usageArea.appendChild(usagePanel);
    var usageNavRow = menuRow();
    usageNavRow.dataset.accountApi = 'true';
    usageNavRow.dataset.settingsGroup = 'resources';
    usageNavRow.style.flex = '0 0 auto';
    usageRecBtn.style.width = '100%';
    usageNavRow.appendChild(usageRecBtn);
    menuBox.appendChild(usageNavRow);
    var usagePanelOpen = false;
    var usageRefreshTimer = null;
    var usageMainEl = null;
    function toggleUsagePanel() {
      if (usagePanelOpen) {
        hideUsageSub();
        return;
      }
      showUsageSub();
    }
    function dshwvPlayViewIn(el) {
      if (!el) return;
      el.classList.remove('dshwv-view-in');
      void el.offsetWidth;
      el.classList.add('dshwv-view-in');
    }
    var usageHideTimer = null;
    var usageShowTimer = null;
    function setUsageNavBtn(inUsage) {
      try {
        wb(usageRecBtn, "textContent", (function(inUsage){ return function(){ return inUsage ? wm("widget.backToControls") : wm("widget.apiUsageHistory"); }; })(inUsage));
        wb(usageRecBtn, "title", (function(inUsage){ return function(){ return inUsage ? wm("widget.backToMainMenu") : wm("widget.viewTodayTheLast7DaysOrAll"); }; })(inUsage));
      } catch (err) {}
    }
    function showUsageSub() {
      if (window.WhaleDashboard) { window.WhaleDashboard.select('usage'); return; }
      try {
        if (usageHideTimer) {
          clearTimeout(usageHideTimer);
          usageHideTimer = null;
        }
      } catch (err) {}
      usagePanelOpen = true;
      var w0 = 300;
      var h0 = 360;
      try {
        var mb = menuBox.getBoundingClientRect();
        if (mb.width > 0) w0 = Math.round(mb.width);
        if (mb.height > 0) h0 = Math.round(mb.height);
      } catch (err) {}
      menuBox.style.width = w0 + 'px';
      menuBox.style.maxWidth = w0 + 'px';
      menuBox.style.height = h0 + 'px';
      menuBox.style.overflow = 'hidden';
      menuBox.style.display = 'flex';
      menuBox.style.flexDirection = 'column';
      try {
        if (menuRootView && usageArea) {
          if (menuRootView.parentNode !== usageArea) usageArea.appendChild(menuRootView);
        }
      } catch (err) {}
      usageArea.style.display = 'block';
      usagePanel.style.display = 'block';
      usagePanel.style.position = 'absolute';
      usagePanel.style.top = '0';
      usagePanel.style.left = '0';
      usagePanel.style.width = '100%';
      usagePanel.style.height = '100%';
      usagePanel.style.maxHeight = 'none';
      usagePanel.style.overflowY = 'auto';
      usagePanel.style.zIndex = '1';
      usagePanel.style.transform = 'translateY(100%)';
      usagePanel.style.transition = 'none';
      if (menuRootView) {
        menuRootView.style.display = 'block';
        menuRootView.style.position = 'absolute';
        menuRootView.style.top = '0';
        menuRootView.style.left = '0';
        menuRootView.style.width = '100%';
        menuRootView.style.height = '100%';
        menuRootView.style.zIndex = '2';
        menuRootView.style.transform = 'translateY(0)';
        menuRootView.style.transition = 'none';
      }
      setUsageNavBtn(true);
      renderUsagePanel();
      try {
        void usageArea.offsetHeight;
      } catch (err) {}
      usagePanel.style.transition = 'transform .22s ease';
      usagePanel.style.transform = 'translateY(0)';
      if (menuRootView) {
        menuRootView.style.transition = 'transform .22s ease';
        menuRootView.style.transform = 'translateY(-100%)';
      }
      usageShowTimer = setTimeout(function () {
        try {
          if (menuRootView) menuRootView.style.display = 'none';
        } catch (err) {}
      }, 240);
      if (usageRefreshTimer) {
        clearInterval(usageRefreshTimer);
        usageRefreshTimer = null;
      }
      usageRefreshTimer = setInterval(function () {
        if (usagePanelOpen) renderUsagePanel();
      }, 10000);
    }
    function hideUsageSub() {
      if (window.WhaleDashboard) { window.WhaleLegacyUsage.stop(); return; }
      if (usageRefreshTimer) {
        clearInterval(usageRefreshTimer);
        usageRefreshTimer = null;
      }
      if (usageHideTimer) {
        clearTimeout(usageHideTimer);
        usageHideTimer = null;
      }
      if (usageShowTimer) {
        clearTimeout(usageShowTimer);
        usageShowTimer = null;
      }
      if (!usagePanelOpen) {
        setUsageNavBtn(false);
        return;
      }
      usagePanelOpen = false;
      if (!usagePanel) {
        setUsageNavBtn(false);
        return;
      }
      setUsageNavBtn(false);
      try {
        if (menuRootView && usageArea) {
          if (menuRootView.parentNode !== usageArea) usageArea.appendChild(menuRootView);
        }
      } catch (err) {}
      usagePanel.style.position = 'absolute';
      usagePanel.style.top = '0';
      usagePanel.style.left = '0';
      usagePanel.style.width = '100%';
      usagePanel.style.height = '100%';
      usagePanel.style.zIndex = '2';
      usagePanel.style.transform = 'translateY(0)';
      usagePanel.style.transition = 'none';
      if (menuRootView) {
        menuRootView.style.display = 'block';
        menuRootView.style.position = 'absolute';
        menuRootView.style.top = '0';
        menuRootView.style.left = '0';
        menuRootView.style.width = '100%';
        menuRootView.style.height = '100%';
        menuRootView.style.zIndex = '1';
        menuRootView.style.transform = 'translateY(-100%)';
        menuRootView.style.transition = 'none';
      }
      try {
        void usageArea.offsetHeight;
      } catch (err) {}
      usagePanel.style.transition = 'transform .22s ease';
      usagePanel.style.transform = 'translateY(100%)';
      if (menuRootView) {
        menuRootView.style.transition = 'transform .22s ease';
        menuRootView.style.transform = 'translateY(0)';
      }
      usageHideTimer = setTimeout(function () {
        usageHideTimer = null;
        try {
          usagePanel.style.display = 'none';
        } catch (err) {}
        try {
          usagePanel.style.transform = '';
          usagePanel.style.transition = '';
          usagePanel.style.width = '';
          usagePanel.style.height = '';
          usagePanel.style.maxHeight = '';
          usagePanel.style.position = '';
          usagePanel.style.top = '';
          usagePanel.style.left = '';
          usagePanel.style.zIndex = '';
        } catch (err) {}
        if (menuRootView && usageArea) {
          try {
            if (usageArea.contains(menuRootView)) menuBox.insertBefore(menuRootView, usageArea);
            menuRootView.style.transform = '';
            menuRootView.style.transition = '';
            menuRootView.style.position = '';
            menuRootView.style.top = '';
            menuRootView.style.left = '';
            menuRootView.style.width = '';
            menuRootView.style.height = '';
            menuRootView.style.zIndex = '';
          } catch (err) {}
        }
        try {
          usageArea.style.display = '';
        } catch (err) {}
        if (menuBox) {
          menuBox.style.width = '';
          menuBox.style.maxWidth = '';
          menuBox.style.height = '';
          menuBox.style.overflow = '';
          menuBox.style.display = '';
          menuBox.style.flexDirection = '';
        }
      }, 230);
    }
    function closeUsagePanel() {
      hideUsageSub();
    }
    window.WhaleLegacyUsage = {
      start: function () {
        usagePanelOpen = true;
        usagePanel.style.cssText = 'display:block;position:static;width:100%;height:auto;max-height:none;overflow:visible;transform:none';
        renderUsagePanel();
        if (!usageRefreshTimer) usageRefreshTimer = setInterval(function () { if (usagePanelOpen) renderUsagePanel(); }, 10000);
      },
      stop: function () { usagePanelOpen = false; clearInterval(usageRefreshTimer); usageRefreshTimer = null; },
      records: function () { openUsageRecordsWindow(); }
    };
    function whaleCurrencySymbol() {
      return WhaleMoney.symbol();
    }
    function usageMoney(x, currency) {
      return x == null ? '—' : WhaleMoney.formatMoney(x, currency || state && state.currency || 'USD');
    }
    function usageMoneyText(x, currency) {
      var nativeCurrency = currency || state && state.currency || 'USD';
      return function () { return usageMoney(x, nativeCurrency); };
    }
    function bindUsageMoney(element, x, currency) {
      return WhaleMoney.bind(element, usageMoneyText(x, currency));
    }
    function usageDayLabel(day) {
      try {
        var d = day.split('-');
        if (d.length !== 3) return day;
        var now = new Date();
        var cur = String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        if (day === cur) return wm("widget.today");
        return d[1] + '-' + d[2];
      } catch (err) {
        return day;
      }
    }
    function renderUsagePanel() {
      if (usageMainEl && usagePanelOpen && usageSet !== null) {
        refreshUsageMain();
        return;
      }
      buildUsageSubShell();
      refreshUsageMain();
    }
    function buildUsageSubShell() {
      usagePanel.innerHTML = '';
      var subTitle = document.createElement('div');
      subTitle.className = 'dshwv-usage-subtitle';
      wb(subTitle, "textContent", (function(){ return function(){ return wm("widget.gptDragonGirlUsage"); }; })());
      usagePanel.appendChild(subTitle);
      buildUsageSettingsArea();
      usageMainEl = document.createElement('div');
      usageMainEl.className = 'dshwv-usagebody';
      usagePanel.appendChild(usageMainEl);
    }
    function usageAlertBudgetEditor(key, onSave) {
      try {
        var isAlert = key === 'alert';
        var cfg = (usageSet || ({}))[isAlert ? 'alert' : 'budget'] || ({});
        var numDef = isAlert ? 50 : 20;
        var numInit = isAlert ? cfg.below != null ? cfg.below : numDef : cfg.amount != null ? cfg.amount : numDef;
        var nativeCurrency = state.currency || 'USD';
        var nativeDraft = Number(numInit);
        var step = {
          kind: 'custom',
          modules: JSON.parse(JSON.stringify(usageRemindLinesOf(cfg, isAlert)))
        };
        var bkEditItems = bubbleEditItems;
        var bkEditorSnap = bubbleEditorSnap;
        var bkItemSnap = bubbleItemSnap;
        var bkEditIdx = bubbleEditItemIdx;
        var bkSide = bubbleEditSide;
        var bkPal = bubblePalEl;
        var bkPv = bubblePvEl;
        var bkPrev = bubblePvPrevEl;
        var bkRenderPv = renderBubblePv;
        var bkQeditEnsure = qeditEnsure;
        var bkModMaskZ = moduleMask ? moduleMask.style.zIndex : '';
        bubbleEditItems = [step];
        bubbleEditItemIdx = 0;
        bubbleEditSide = -1;
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        bubbleEditorSnap = null;
        var mask = document.createElement('div');
        mask.className = 'dshwv-bubmask';
        mask.style.zIndex = '26000';
        var card = document.createElement('div');
        card.className = 'dshwv-bubcard';
        card.style.maxHeight = '88vh';
        card.style.overflow = 'hidden auto';
        var title = document.createElement('div');
        title.className = 'dshwv-bubtitle';
        wb(title, "textContent", (function(isAlert){ return function(){ return wm("widget.edit") + (isAlert ? wm("widget.lowBalance") : wm("widget.dailyBudget")) + wm("widget.noticeAddModulesBelow"); }; })(isAlert));
        card.appendChild(title);
        var secCond = document.createElement('div');
        secCond.className = 'dshwv-bubsec dshwv-bubsec-first';
        wb(secCond, "textContent", (function(isAlert){ return function(){ return isAlert ? wm("widget.notifyWhenBalanceFallsBelowThisValue") : wm("widget.notifyWhenTodaySObservedUsageReachesThis"); }; })(isAlert));
        card.appendChild(secCond);
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'dshwv-check';
        chk.checked = !!cfg.on;
        var numInp = document.createElement('input');
        numInp.type = 'number';
        numInp.min = '0';
        numInp.step = '0.01';
        numInp.className = 'dshwv-number';
        numInp.style.width = '80px';
        numInp.dataset.moneyInput = key;
        WhaleMoney.bind(numInp, function () { return WhaleMoney.formatNumber(nativeDraft, nativeCurrency); }, function (value) { numInp.value = value; });
        var condBox = document.createElement('div');
        condBox.style.padding = '2px 0';
        condBox.style.display = 'flex';
        condBox.style.flexWrap = 'wrap';
        condBox.style.alignItems = 'center';
        condBox.style.gap = '6px 14px';
        condBox.style.textAlign = 'left';
        condBox.style.fontSize = '12px';
        condBox.style.color = gptThemeColor('ink');
        function segCond() {
          var s = document.createElement('span');
          s.style.display = 'inline-flex';
          s.style.alignItems = 'center';
          s.style.gap = '5px';
          s.style.whiteSpace = 'nowrap';
          return s;
        }
        var gOn = segCond();
        gOn.appendChild(chk);
        gOn.appendChild(qLabel(wm("widget.enableNotice")));
        condBox.appendChild(gOn);
        var gNum = segCond();
        gNum.appendChild(qLabel(isAlert ? wm("widget.balance") : wm("widget.observedToday")));
        gNum.appendChild(numInp);
        var currencyUnit = qLabel('');
        WhaleMoney.bind(currencyUnit, function () { return ' ' + WhaleMoney.unit() + wm("widget.toNotify"); });
        gNum.appendChild(currencyUnit);
        condBox.appendChild(gNum);
        var condBrk = document.createElement('span');
        condBrk.style.flex = '1 0 100%';
        condBrk.style.height = '0';
        condBrk.style.margin = '0';
        condBox.appendChild(condBrk);
        var acChk = document.createElement('input');
        acChk.type = 'checkbox';
        acChk.className = 'dshwv-check';
        acChk.checked = cfg.autoClose !== false;
        var defSec = Number(cfg.ttlSec);
        if (!isFinite(defSec) || defSec <= 0) defSec = 6;
        var secInp = document.createElement('input');
        secInp.type = 'number';
        secInp.min = '0';
        secInp.step = '1';
        secInp.className = 'dshwv-number';
        secInp.style.width = '56px';
        secInp.value = String(defSec);
        var gAc = segCond();
        gAc.appendChild(acChk);
        gAc.appendChild(qLabel(wm("widget.autoClose")));
        condBox.appendChild(gAc);
        var gSec = segCond();
        gSec.appendChild(secInp);
        var lSec = qLabel(wm("widget.sec0KeepOpen"));
        lSec.style.opacity = '.75';
        lSec.style.fontSize = '11px';
        gSec.appendChild(lSec);
        condBox.appendChild(gSec);
        card.appendChild(condBox);
        var secPal = document.createElement('div');
        secPal.className = 'dshwv-bubsec dshwv-bubsec-first';
        wb(secPal, "textContent", (function(){ return function(){ return wm("widget.modulesClickOrDragIntoTheContentArea"); }; })());
        card.appendChild(secPal);
        bubblePalEl = document.createElement('div');
        bubblePalEl.className = 'dshwv-bubpal';
        card.appendChild(bubblePalEl);
        var secPv = document.createElement('div');
        secPv.className = 'dshwv-bubsec';
        wb(secPv, "textContent", (function(){ return function(){ return wm("widget.noticeContentUpTo6ModulesPerRow"); }; })());
        card.appendChild(secPv);
        bubblePvEl = document.createElement('div');
        bubblePvEl.className = 'dshwv-bubpvbox';
        card.appendChild(bubblePvEl);
        bubblePvPrevEl = document.createElement('div');
        bubblePvPrevEl.className = 'dshwv-bubprev';
        card.appendChild(bubblePvPrevEl);
        bubblePvEl.addEventListener('dragover', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
          } catch (err) {}
        });
        bubblePvEl.addEventListener('drop', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
            if (bubbleModDrag) {
              var mdd = bubbleModDrag;
              bubbleModDrag = null;
              bubblePvDropBlockEnd(mdd.ri, mdd.mi);
              return;
            }
            var key = bubbleDragKey;
            if (!key) return;
            bubbleDragKey = null;
            if (key === 'image') {
              bubblePickImageToAdd();
              return;
            }
            if (key === 'wizard') {
              bubbleModuleAdd({
                type: 'text',
                text: wm("widget.newContent"),
                size: 6,
                bold: true
              });
              return;
            }
            var m = bubblePaletteModule(key);
            if (m) bubbleModuleAdd(m);
          } catch (err) {}
        });
        var btns = document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        function cleanup() {
          try {
            WhaleMoney.clearBindings(mask);
            document.body.removeChild(mask);
            bubbleEditItems = bkEditItems;
            bubbleEditorSnap = bkEditorSnap;
            bubbleItemSnap = bkItemSnap;
            bubbleEditItemIdx = bkEditIdx;
            bubbleEditSide = bkSide;
            bubblePalEl = bkPal;
            bubblePvEl = bkPv;
            bubblePvPrevEl = bkPrev;
            renderBubblePv = bkRenderPv;
            qeditEnsure = bkQeditEnsure;
            if (moduleMask) moduleMask.style.zIndex = bkModMaskZ;
            var zsEl = document.getElementById('dshw-remind-overlay-z');
            if (zsEl) {
              try {
                document.head.removeChild(zsEl);
              } catch (err) {}
            }
            window.__dshwRemindMask = null;
          } catch (err) {}
        }
        var noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        wb(noBtn, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
        noBtn.addEventListener('click', cleanup);
        btns.appendChild(noBtn);
        var resBtn = document.createElement('button');
        resBtn.type = 'button';
        resBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        wb(resBtn, "textContent", (function(){ return function(){ return wm("widget.restoreDefaults"); }; })());
        wb(resBtn, "title", (function(){ return function(){ return wm("widget.restoreNoticeContentWithoutChangingItsTrigger"); }; })());
        resBtn.addEventListener('click', function () {
          step.modules = JSON.parse(JSON.stringify(usageRemindDefaultLines(isAlert)));
          renderBubblePv();
        });
        btns.appendChild(resBtn);
        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        wb(okBtn, "textContent", (function(){ return function(){ return wm("widget.save"); }; })());
        okBtn.addEventListener('click', function () {
          if (!numInp.reportValidity()) return;
          try {
            bubbleRowsCanon(step.modules);
          } catch (err) {}
          var o = {
            on: chk.checked,
            lines: JSON.parse(JSON.stringify(step.modules)),
            autoClose: acChk.checked,
            ttlSec: Math.max(0, Number(secInp.value) || 0)
          };
          if (isAlert) o.below = nativeDraft; else o.amount = nativeDraft;
          cleanup();
          if (onSave) onSave(o);
        });
        btns.appendChild(okBtn);
        card.appendChild(btns);
        try {
          if (moduleMask) moduleMask.style.zIndex = '27000';
        } catch (err) {}
        var remindZStyle = document.createElement('style');
        remindZStyle.id = 'dshw-remind-overlay-z';
        remindZStyle.textContent = '.dshwv-confirmmask,.dshwv-cropmask,.dshwv-audiomask,.dshwv-snapmask,.dshwv-usage-mask{z-index:28500!important}';
        document.head.appendChild(remindZStyle);
        var qeditEnsureSuper = bkQeditEnsure;
        qeditEnsure = function () {
          var el = qeditEnsureSuper();
          try {
            if (el) el.style.zIndex = '28000';
          } catch (err) {}
          return el;
        };
        try {
          if (qeditEl) qeditEl.style.zIndex = '28000';
        } catch (err) {}
        var renderPvSuper = bkRenderPv;
        renderBubblePv = function () {
          try {
            renderPvSuper();
          } catch (err) {}
          try {
            var it = bubbleEditTarget();
            var below = isAlert ? nativeDraft : null;
            var amount = isAlert ? null : nativeDraft;
            if (it && Array.isArray(it.modules) && bubblePvPrevEl) bubblePreviewInto(bubblePvPrevEl, usageAlertModsResolved(it.modules, below, amount));
          } catch (err) {}
        };
        function editNativeAmount() {
          try {
            var inputValue = Number(numInp.value);
            if (!isFinite(inputValue) || inputValue < 0 || numInp.value === '') throw new Error(wm("widget.enterAValidAmount"));
            nativeDraft = WhaleMoney.fromDisplay(inputValue, nativeCurrency);
            numInp.setCustomValidity(''); renderBubblePv();
          } catch (err) { numInp.setCustomValidity(err.message); }
        }
        numInp.addEventListener('input', editNativeAmount);
        chk.addEventListener('change', renderBubblePv);
        mask.appendChild(card);
        mask.addEventListener('click', function (e) {
          if (e.target === mask) cleanup();
        });
        window.__dshwRemindMask = mask;
        document.body.appendChild(mask);
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
    function buildUsageSettingsArea() {
      var S = usageSet || ({});
      var stA = S.alert || ({
        on: false,
        below: 50
      });
      var stB = S.budget || ({
        on: false,
        amount: 20
      });
      function mkRow(labelTxt, key, stateFn, persist) {
        var row = menuRow();
        var lb = menuLabel(labelTxt);
        lb.style.flex = '0 0 auto';
        row.appendChild(lb);
        var info = document.createElement('span');
        info.className = 'dshwv-usage-hint';
        info.style.flex = '1';
        info.style.textAlign = 'right';
        info.style.paddingRight = '6px';
        info.style.whiteSpace = 'nowrap';
        info.style.overflow = 'hidden';
        info.style.textOverflow = 'ellipsis';
        row.appendChild(info);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dshwv-roleimport';
        wb(btn, "textContent", (function(){ return function(){ return wm("widget.edit2"); }; })());
        wb(btn, "title", (function(){ return function(){ return wm("widget.configureStatusThresholdAndNoticeText"); }; })());
        btn.addEventListener('click', function () {
          usageAlertBudgetEditor(key, function (o) {
            persist(o);
            info.textContent = stateFn();
          });
        });
        row.appendChild(btn);
        usagePanel.appendChild(row);
        info.dataset.moneyRole = key;
        WhaleMoney.bind(info, stateFn);
      }
      mkRow(wm("widget.lowBalance"), 'alert', function () {
        var current = usageSet && usageSet.alert || {};
        if (!current.on) return wm("widget.off");
        return wm("widget.balance") + usageMoney(current.below != null ? current.below : 50) + wm("widget.toNotify2");
      }, function (o) {
        stA.on = o.on;
        stA.below = o.below;
        stA.lines = o.lines;
        stA.autoClose = o.autoClose !== false;
        stA.ttlSec = o.ttlSec != null ? o.ttlSec : 6;
        usageSet.alert = {
          on: o.on,
          below: o.below,
          lines: o.lines,
          autoClose: stA.autoClose,
          ttlSec: stA.ttlSec
        };
        saveUsageSettings({
          alert: usageSet.alert
        });
      });
      mkRow(wm("widget.dailyBudget"), 'budget', function () {
        var current = usageSet && usageSet.budget || {};
        if (!current.on) return wm("widget.off");
        return wm("widget.used") + usageMoney(current.amount != null ? current.amount : 20) + wm("widget.toNotify2");
      }, function (o) {
        stB.on = o.on;
        stB.amount = o.amount;
        stB.lines = o.lines;
        stB.autoClose = o.autoClose !== false;
        stB.ttlSec = o.ttlSec != null ? o.ttlSec : 6;
        usageSet.budget = {
          on: o.on,
          amount: o.amount,
          lines: o.lines,
          autoClose: stB.autoClose,
          ttlSec: stB.ttlSec
        };
        saveUsageSettings({
          budget: usageSet.budget
        });
      });
    }
    function refreshUsageMain() {
      if (!usageMainEl) return;
      usageMainEl.innerHTML = '';
      var body = document.createElement('div');
      wb(body, "textContent", (function(){ return function(){ return wm("widget.loading"); }; })());
      usageMainEl.appendChild(body);
      fetch(USAGE_REC_URL, {
        cache: 'no-store'
      }).then(function (r) {
        return r.json();
      }).then(function (d) {
        if (d && d.ok && d.settings) usageSet = d.settings;
        WhaleMoney.refreshBindings(usagePanel);
        fillUsagePanel(d);
        if (d && d.ok && d.today && isFinite(Number(d.today.total))) {
          var recTotal = Number(d.today.total);
          if (state.todayUsage === null || recTotal >= state.todayUsage) {
            state.todayUsage = recTotal;

          }
        }
      }).catch(function () {
        wb(usageMainEl, "textContent", (function(){ return function(){ return wm("widget.couldNotLoadRecords"); }; })());
      });
    }
    function uSectionTitle(leftTxt, rightTxt) {
      var h = document.createElement('div');
      h.className = 'dshwv-usage-sec';
      var l = document.createElement('span');
      wb(l, "textContent", (function(leftTxt){ return function(){ return leftTxt; }; })(leftTxt));
      h.appendChild(l);
      var r = document.createElement('span');
      r.className = 'dshwv-usage-total';
      if (typeof rightTxt === 'function') WhaleMoney.bind(r, rightTxt); else wb(r, "textContent", (function(rightTxt){ return function(){ return rightTxt; }; })(rightTxt));
      h.appendChild(r);
      return h;
    }
    function fillUsagePanel(d) {
      var hostEl = usageMainEl || usagePanel;
      hostEl.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-usagebody';
      if (!d || !d.ok) {
        wb(wrap, "textContent", (function(){ return function(){ return wm("widget.couldNotLoadRecords"); }; })());
        hostEl.appendChild(wrap);
        return;
      }
      var today = d.today || ({});
      var todayModels = today.models || [];
      var hasEvToday = todayModels.length > 0;
      wrap.appendChild(uSectionTitle(wm("widget.observedTodayModelEstimates"), usageMoneyText(today.total)));
      var todayBox = document.createElement('div');
      todayBox.className = 'dshwv-usage-scroll dshwv-usage-today';
      if (hasEvToday) {
        todayModels.forEach(function (row) {
          var r = document.createElement('div');
          r.className = 'dshwv-usage-row';
          var n = document.createElement('span');
          wb(n, "textContent", (function(row){ return function(){ return row.model || wm("widget.unknown"); }; })(row));
          n.className = 'dshwv-usage-model';
          r.appendChild(n);
          var c = document.createElement('span');
          bindUsageMoney(c, row.cost);
          r.appendChild(c);
          todayBox.appendChild(r);
        });
      } else if ((today.total || 0) > 0) {
        var noM = document.createElement('div');
        noM.className = 'dshwv-usage-hint';
        wb(noM, "textContent", (function(){ return function(){ return wm("widget.todaySTotalComesFromBalanceChangesModel"); }; })());
        todayBox.appendChild(noM);
      } else {
        var empty = document.createElement('div');
        empty.className = 'dshwv-usage-hint';
        wb(empty, "textContent", (function(){ return function(){ return wm("widget.noUsageRecordedToday"); }; })());
        todayBox.appendChild(empty);
      }
      wrap.appendChild(todayBox);
      wrap.appendChild(uSectionTitle(d.total7Complete === false ? wm("widget.last7DaysKnownSubtotal") : wm("widget.last7Days"), usageMoneyText(d.total7)));
      var daysBox = document.createElement('div');
      daysBox.className = 'dshwv-usage-scroll dshwv-usage-days';
      (d.days7 || []).forEach(function (row) {
        var r = document.createElement('div');
        r.className = 'dshwv-usage-row';
        var n = document.createElement('span');
        wb(n,'textContent',(function(date){return function(){return usageDayLabel(date);};})(row.date));
        r.appendChild(n);
        var c = document.createElement('span');
        bindUsageMoney(c, row.total);
        r.appendChild(c);
        daysBox.appendChild(r);
      });
      wrap.appendChild(daysBox);
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'dshwv-usage-more';
      wb(more, "textContent", (function(){ return function(){ return wm("widget.moreUsageRecords"); }; })());
      wb(more, "title", (function(){ return function(){ return wm("widget.openAllRecordedUsage"); }; })());
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        openUsageRecordsWindow();
      });
      wrap.appendChild(more);
      (usageMainEl || usagePanel).appendChild(wrap);
    }
    var usageMoreMask = document.createElement('div');
    usageMoreMask.className = 'dshwv-usage-mask';
    usageMoreMask.style.display = 'none';
    var usageMoreCard = document.createElement('div');
    usageMoreCard.className = 'dshwv-usage-card';
    usageMoreMask.appendChild(usageMoreCard);
    usageMoreMask.addEventListener('click', function (e) {
      if (e.target === usageMoreMask) closeUsageRecordsWindow();
    });
    document.body.appendChild(usageMoreMask);
    function openUsageRecordsWindow() {
      widgetLocalizedHtml(usageMoreCard,"widget.loading2");
      usageMoreMask.style.display = 'flex';
      fetch(USAGE_REC_URL, {
        cache: 'no-store'
      }).then(function (r) {
        return r.json();
      }).then(function (d) {
        fillUsageRecordsWindow(d);
      }).catch(function () {
        widgetLocalizedHtml(usageMoreCard,"widget.couldNotLoad");
      });
    }
    function closeUsageRecordsWindow() {
      usageMoreMask.style.display = 'none';
    }
    var resMaskEl = null;
    var resCardEl = null;
    function resMaskOpen() {
      try {
        if (!resMaskEl) {
          resMaskEl = document.createElement('div');
          resMaskEl.className = 'dshwv-resmask';
          resMaskEl.style.display = 'none';
          resCardEl = document.createElement('div');
          resCardEl.className = 'dshwv-usage-card dshwv-rescard';
          resMaskEl.appendChild(resCardEl);
          resMaskEl.addEventListener('click', function (e) {
            if (e.target === resMaskEl) resManagerClose();
          });
          document.body.appendChild(resMaskEl);
        }
        resManagerRender();
        resMaskEl.style.display = 'flex';
      } catch (err) {}
    }
    function resManagerClose() {
      try {
        if (resMaskEl) resMaskEl.style.display = 'none';
      } catch (err) {}
    }
    function openResManager() {
      resMaskOpen();
    }
    function resMkTag(text, built) {
      var t = document.createElement('span');
      t.className = 'dshwv-restag' + (built ? ' dshwv-restag-built' : '');
      wb(t, "textContent", (function(text){ return function(){ return text; }; })(text));
      return t;
    }
    function resImgRow(imgUrl, name, meta, rightEls) {
      var img = document.createElement('img');
      img.className = 'dshwv-resthum';
      img.src = imgUrl;
      img.alt = '';
      var main = document.createElement('div');
      main.className = 'dshwv-resmain';
      main.style.minWidth = '0';
      var nm = document.createElement('div');
      nm.className = 'dshwv-resnm';
      wb(nm, "textContent", (function(name){ return function(){ return name; }; })(name));
      main.appendChild(nm);
      if (meta) {
        var mt = document.createElement('div');
        mt.className = 'dshwv-resmeta';
        wb(mt, "textContent", (function(meta){ return function(){ return meta; }; })(meta));
        main.appendChild(mt);
      }
      var row = document.createElement('div');
      row.className = 'dshwv-resrow';
      var left = document.createElement('div');
      left.className = 'dshwv-resmain';
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      left.appendChild(img);
      left.appendChild(main);
      row.appendChild(left);
      for (var i = 0; i < (rightEls || []).length; i++) row.appendChild(rightEls[i]);
      return row;
    }
    function resIconRow(iconText, name, meta, rightEls) {
      var icon = document.createElement('div');
      icon.className = 'dshwv-resicon';
      icon.textContent = iconText;
      var main = document.createElement('div');
      main.className = 'dshwv-resmain';
      main.style.minWidth = '0';
      var nm = document.createElement('div');
      nm.className = 'dshwv-resnm';
      wb(nm, "textContent", (function(name){ return function(){ return name; }; })(name));
      main.appendChild(nm);
      if (meta) {
        var mt = document.createElement('div');
        mt.className = 'dshwv-resmeta';
        wb(mt, "textContent", (function(meta){ return function(){ return meta; }; })(meta));
        main.appendChild(mt);
      }
      var row = document.createElement('div');
      row.className = 'dshwv-resrow';
      var left = document.createElement('div');
      left.className = 'dshwv-resmain';
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      left.appendChild(icon);
      left.appendChild(main);
      row.appendChild(left);
      for (var i = 0; i < (rightEls || []).length; i++) row.appendChild(rightEls[i]);
      return row;
    }
    function resMkDel(label, disabled, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-resdel';
      wb(b, "textContent", (function(label){ return function(){ return label; }; })(label));
      b.disabled = !!disabled;
      if (!disabled) b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      return b;
    }
    function resManagerRender() {
      try {
        var card = resCardEl;
        card.innerHTML = '';
        var head = document.createElement('div');
        head.className = 'dshwv-reshead';
        var title = document.createElement('span');
        title.className = 'dshwv-restitle';
        wb(title, "textContent", (function(){ return function(){ return wm("widget.mediaLibrary"); }; })());
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'dshwv-resclose';
        x.textContent = '✕';
        wb(x, "title", (function(){ return function(){ return wm("widget.close"); }; })());
        x.addEventListener('click', resManagerClose);
        head.appendChild(title);
        head.appendChild(x);
        card.appendChild(head);
        var wrap = document.createElement('div');
        wrap.className = 'dshwv-reswrap';
        card.appendChild(wrap);
        widgetLocalizedHtml(wrap,"widget.loading3");
        var roles = [];
        var bubbleImgs = [];
        var audio = null;
        var done = 0;
        function fin() {
          done++;
          if (done < 3) return;
          resRenderData(wrap, roles, bubbleImgs, audio);
        }
        function fail() {
          fin();
        }
        try {
          fetch('/dsh-whale/roles.json', {
            cache: 'no-store'
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
            if (d && d.ok && Array.isArray(d.roles)) roles = d.roles;
            fin();
          }).catch(fail);
        } catch (err) {
          fin();
        }
        try {
          fetch('/dsh-whale/bubble-imgs.json', {
            cache: 'no-store'
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
            if (d && d.ok && Array.isArray(d.images)) bubbleImgs = d.images;
            fin();
          }).catch(fail);
        } catch (err) {
          fin();
        }
        try {
          fetch('/dsh-whale/audio.json', {
            cache: 'no-store'
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
            audio = d;
            fin();
          }).catch(fail);
        } catch (err) {
          fin();
        }
      } catch (err) {}
    }
    function resDelRole(id) {
      var r = null;
      for (var i = 0; i < roleList.length; i++) if (roleList[i].id === id) {
        r = roleList[i];
        break;
      }
      showDeleteConfirm(wexpr((function(r,id){ return function(){ return wm("widget.deleteCharacter") + (r ? r.name : id) + wm("widget.ifActiveTheDefaultGptDragonGirlWill"); }; })(r,id)), function () {
        try {
          fetch('/dsh-whale/role-delete.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: id
            })
          }).then(function (res) {
            return res.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.roles)) {
              roleList = d.roles.map(function(role){return role.id === 'default' ? Object.assign({},role,{name:wm('widget.gptDragonGirl')}) : role;});
              renderRolePanel();
              if (currentRole && currentRole.id === id) applyRole('default', wm("widget.gptDragonGirl"), IMG_URL);
              openResManager();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    function resDelBubbleImg(id) {
      var im = null;
      for (var i = 0; i < bubbleImgList.length; i++) if (bubbleImgList[i].id === id) {
        im = bubbleImgList[i];
        break;
      }
      showDeleteConfirm(wexpr((function(im,id){ return function(){ return wm("widget.deleteBubbleImage") + (im && im.name ? im.name : id) + wm("widget.bubblesUsingThisImageWillNoLongerDisplay"); }; })(im,id)), function () {
        try {
          fetch('/dsh-whale/bubble-img-upload.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.images)) {
              bubbleImgList = d.images;
              openResManager();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    function resDelAudioGroup(id) {
      var g = null;
      for (var i = 0; i < (audioGroups || []).length; i++) if (audioGroups[i].id === id) {
        g = audioGroups[i];
        break;
      }
      showDeleteConfirm(wexpr((function(g,id){ return function(){ return wm("widget.deleteSoundSet") + (g && g.name ? g.name : id) + wm("widget.label"); }; })(g,id)), function () {
        try {
          fetch('/dsh-whale/audio.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-group',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.groups)) {
              audioGroups = d.groups.map(function(group){ var key = group.id === 'duck' ? 'widget.rubberDuck' : group.id === 'fx1' ? 'widget.sound1' : null; return key ? Object.assign({},group,{name:wm(key)}) : group; });
              renderAudioGroupPanel();
              refreshTaskEndAfterAudio();
              if (soundSet === id) setSoundSet('duck');
              openResManager();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    function resDelAudioFrag(id) {
      var f = null;
      for (var i = 0; i < (audioFragments || []).length; i++) if (audioFragments[i].id === id) {
        f = audioFragments[i];
        break;
      }
      showDeleteConfirm(wexpr((function(f,id){ return function(){ return wm("widget.deleteAudioClip") + (f && f.name ? f.name : id) + wm("widget.soundSlotsUsingThisClipWillReturnTo"); }; })(f,id)), function () {
        try {
          fetch('/dsh-whale/audio.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-fragment',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.fragments)) {
              audioFragments = d.fragments.map(function(fragment){var key = {ya1:'widget.rubberDuckPress',ya2:'widget.rubberDuckRelease',fx1:'widget.sound1Press',fx2:'widget.sound1Release'}[fragment.id]; return fragment.preset && key ? Object.assign({},fragment,{name:wm(key)}) : fragment;});
              if (Array.isArray(d.groups)) audioGroups = d.groups;
              renderAudioGroupPanel();
              refreshTaskEndAfterAudio();
              openResManager();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    function resRenderData(wrap, roles, bubbleImgs, audio) {
      try {
        wrap.innerHTML = '';
        var catImg = document.createElement('div');
        catImg.className = 'dshwv-rescat';
        wb(catImg, "textContent", (function(){ return function(){ return wm("widget.images"); }; })());
        wrap.appendChild(catImg);
        var anyImg = false;
        roles.forEach(function (r) {
          anyImg = true;
          var isDefault = r.id === 'default';
          var tag = resMkTag(wexpr((function(isDefault){ return function(){ return isDefault ? wm("widget.defaultCharacter") : wm("widget.customCharacter"); }; })(isDefault)), isDefault);
          wrap.appendChild(resImgRow(r.url, r.id === 'default' ? wm('widget.gptDragonGirl') : r.name || r.id, r.id, [tag, resMkDel(wm("widget.delete"), isDefault, function () {
            resDelRole(r.id);
          })]));
        });
        bubbleImgs.forEach(function (im) {
          anyImg = true;
          var tag = resMkTag(wexpr((function(im){ return function(){ return im.builtin ? wm("widget.builtInImage") : wm("widget.bubbleImage"); }; })(im)), !!im.builtin);
          wrap.appendChild(resImgRow('/dsh-whale/bubble-img.png?id=' + encodeURIComponent(im.id), im.builtin && im.id === 'bimg_petpet' ? wm('widget.gptPetpet') : im.name || im.id, im.id, [tag, resMkDel(wm("widget.delete"), !!im.builtin, function () {
            resDelBubbleImg(im.id);
          })]));
        });
        if (!anyImg) {
          var empty = document.createElement('div');
          empty.className = 'dshwv-resempty';
          wb(empty, "textContent", (function(){ return function(){ return wm("widget.noCustomImagesYet"); }; })());
          wrap.appendChild(empty);
        }
        var catAu = document.createElement('div');
        catAu.className = 'dshwv-rescat';
        wb(catAu, "textContent", (function(){ return function(){ return wm("widget.audio"); }; })());
        wrap.appendChild(catAu);
        var anyAu = false;
        var groups = audio && Array.isArray(audio.groups) ? audio.groups : [];
        groups.forEach(function (g) {
          anyAu = true;
          var preset = !!g.preset;
          var tag = resMkTag(wexpr((function(preset){ return function(){ return preset ? wm("widget.presetSet") : wm("widget.customSet"); }; })(preset)), preset);
          var meta = '';
          if (!preset && g.press && g.release) meta = wexpr(function(){return wm('widget.press') + g.press + wm('widget.release') + g.release;});
          wrap.appendChild(resIconRow(preset ? '🎧' : '🎵', preset && g.id === 'duck' ? wm('widget.rubberDuck') : preset && g.id === 'fx1' ? wm('widget.sound1') : g.name || g.id, meta, [tag, resMkDel(wm("widget.delete"), preset, function () {
            resDelAudioGroup(g.id);
          })]));
        });
        var frags = audio && Array.isArray(audio.fragments) ? audio.fragments : [];
        frags.forEach(function (f) {
          if (f.preset) return;
          anyAu = true;
          var tag = resMkTag(wm("widget.audioClip"), false);
          wrap.appendChild(resIconRow('🎶', f.name || f.id, f.id, [tag, resMkDel(wm("widget.delete"), false, function () {
            resDelAudioFrag(f.id);
          })]));
        });
        if (!anyAu) {
          var empty2 = document.createElement('div');
          empty2.className = 'dshwv-resempty';
          wb(empty2, "textContent", (function(){ return function(){ return wm("widget.noCustomAudioYet"); }; })());
          wrap.appendChild(empty2);
        }
      } catch (err) {}
    }
    var usageAlertBelowFired = false;
    var usageBudgetFiredKey = null;
    function usageTodayKeyStr() {
      var d = new Date();
      var p = function (n) {
        return String(n).padStart(2, '0');
      };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function usageRemindDefaultLines(isAlert) {
      return [{
        type: 'text',
        text: isAlert ? wt('widget.balanceIsBelowCurrencyBelow') : wt('widget.observedTodayHasReachedTheBudgetCurrencyAmount'),
        i18nKey: isAlert ? 'widget.balanceIsBelowCurrencyBelow' : 'widget.observedTodayHasReachedTheBudgetCurrencyAmount',
        size: 7,
        bold: true
      }];
    }
    function usageRemindTtlMs(cfg) {
      cfg = cfg || ({});
      if (cfg.autoClose === false) return 0;
      var s = Number(cfg.ttlSec);
      if (cfg.ttlSec !== undefined && isFinite(s) && s > 0) return Math.max(500, Math.round(s * 1000));
      return USAGE_ALERT_TTL;
    }
    function usageRemindLinesOf(cfg, isAlert) {
      cfg = cfg || ({});
      if (Array.isArray(cfg.lines) && cfg.lines.length) return cfg.lines;
      return usageRemindDefaultLines(isAlert);
    }
    function usageFillText(txt, below, amount, currency) {
      return String(txt || '').replace(/\{currency\}/g, whaleCurrencySymbol()).replace(/\{below\}/g, below != null ? WhaleMoney.formatNumber(below, currency) : '').replace(/\{amount\}/g, amount != null ? WhaleMoney.formatNumber(amount, currency) : '');
    }
    function usageLineFontPx(level) {
      var n = Math.max(1, Math.min(50, Math.round(Number(level) || 7)));
      return Math.min(40, Math.round(12 + (n - 1) * 0.8));
    }
    function usageAppendLine(body, m, below, amount) {
      try {
        m = m || ({});
        var raw = localizedModuleField(m, 'text');
        var txt = usageFillText(raw, below, amount);
        var div = document.createElement('div');
        div.style.margin = '4px auto';
        div.style.maxWidth = '100%';
        if (!txt) {
          div.style.height = '8px';
          div.style.margin = '2px auto';
          body.appendChild(div);
          return;
        }
        var nativeCurrency = state.currency || 'USD';
        WhaleMoney.bind(div, function () { return usageFillText(m.i18nKey ? wt(m.i18nKey) : raw, below, amount, nativeCurrency); });
        div.style.display = 'inline-block';
        div.style.textAlign = 'center';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordBreak = 'break-word';
        div.style.fontSize = usageLineFontPx(m.size) + 'px';
        div.style.lineHeight = '1.4';
        if (m.bold) div.style.fontWeight = '700';
        if (m.italic) div.style.fontStyle = 'italic';
        if (m.ul) div.style.textDecoration = 'underline';
        if (m.fontFamily) div.style.fontFamily = m.fontFamily;
        var bg = m.bg ? String(m.bg) : '';
        if (bg) {
          div.style.background = bg;
          div.style.borderRadius = '7px';
          div.style.padding = '1px 8px';
        }
        var col = m.color ? String(m.color) : '';
        if (col && !m.rgb && !m.bgRgb) div.style.color = col;
        body.appendChild(div);
      } catch (err) {}
    }
    function checkUsageAlerts(balance, todayUsage) {
      try {
        if (!usageSet) return;
        var a = usageSet.alert;
        if (a && a.on) {
          var below = Number(a.below);
          if (isFinite(below) && typeof balance === 'number' && balance > 0 && balance <= below) {
            if (!usageAlertBelowFired) {
              usageAlertBelowFired = true;
              showUsagePopup(wm("widget.lowBalance"), usageRemindLinesOf(a, true), below, null, 2, a);
            }
          } else if (typeof balance === 'number' && balance > below) {
            usageAlertBelowFired = false;
          }
        }
        var b = usageSet.budget;
        if (b && b.on) {
          var amt = Number(b.amount);
          if (isFinite(amt) && amt > 0 && typeof todayUsage === 'number' && todayUsage >= amt) {
            var key = usageTodayKeyStr() + ':' + String(amt);
            if (usageBudgetFiredKey !== key) {
              usageBudgetFiredKey = key;
              showUsagePopup(wm("widget.dailyBudgetNotice"), usageRemindLinesOf(b, false), null, amt, 1, b);
            }
          }
        }
      } catch (err) {}
    }
    function usageAlertModsResolved(mods, below, amount) {
      var out = [];
      try {
        for (var i = 0; i < mods.length; i++) {
          var m0 = mods[i] || ({});
          var cp = JSON.parse(JSON.stringify(m0));
          var raw = localizedModuleField(m0, 'text');
          whaleMoneyTemplates.set(cp, { template: raw, i18nKey: m0.i18nKey || null, below: below, amount: amount, currency: state.currency || 'USD' });
          cp.text = raw.length ? usageFillText(raw, below, amount, state.currency || 'USD') : raw;
          out.push(cp);
        }
      } catch (err) {}
      return out;
    }
    function showUsagePopup(title, content, below, amount, rank, cfg) {
      try {
        var mods = [];
        if (typeof content === 'string') mods = [{
          type: 'text',
          text: content,
          size: 7,
          bold: true
        }]; else if (Array.isArray(content)) mods = content;
        if (mods.length && whaleSysPush({
          kind: 'alert',
          mods: usageAlertModsResolved(mods, below, amount),
          rank: rank === 1 || rank === 2 ? rank : 2,
          ttlMs: usageRemindTtlMs(cfg)
        })) return;
        usagePopupCard(title, content, below, amount);
      } catch (err) {}
    }
    function usagePopupCard(title, content, below, amount) {
      try {
        var mask = document.createElement('div');
        mask.className = 'dshwv-usage-mask';
        var card = document.createElement('div');
        card.className = 'dshwv-usage-card';
        card.style.width = 'min(380px,90vw)';
        var t = document.createElement('div');
        t.className = 'dshwv-usage-wintitle';
        wb(t, "textContent", (function(title){ return function(){ return title || wm("widget.notice"); }; })(title));
        card.appendChild(t);
        var body = document.createElement('div');
        body.className = 'dshwv-usage-windowbody';
        body.style.textAlign = 'center';
        if (typeof content === 'string') {
          body.textContent = usageFillText(content, below, amount);
          body.style.whiteSpace = 'pre-wrap';
        } else if (Array.isArray(content)) {
          for (var i = 0; i < content.length; i++) usageAppendLine(body, content[i], below, amount);
        } else {
          body.textContent = '';
        }
        card.appendChild(body);
        var btns = document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        btns.style.justifyContent = 'center';
        var ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        wb(ok, "textContent", (function(){ return function(){ return wm("widget.gotIt"); }; })());
        ok.addEventListener('click', function () {
          try {
            document.body.removeChild(mask);
          } catch (err) {}
        });
        btns.appendChild(ok);
        card.appendChild(btns);
        mask.appendChild(card);
        mask.addEventListener('click', function (e) {
          if (e.target === mask) {
            try {
              document.body.removeChild(mask);
            } catch (err) {}
          }
        });
        document.body.appendChild(mask);
      } catch (err) {}
    }
    var USAGE_PALETTE = [gptThemeColor('ink'), '#e0433f', '#2fa24c', '#b060c8', '#e89a2e', '#3aa6c8', '#d06a8a', '#7a8b2f', '#6a6ad0', '#c84a8a'];
    function usageAggModels(daysArr) {
      var map = {};
      (daysArr || []).forEach(function (day) {
        ;
        (day.models || []).forEach(function (mm) {
          var k = mm && mm.model ? mm.model : wm("widget.unknown");
          map[k] = (map[k] || 0) + (Number(mm.cost) || 0);
        });
      });
      return Object.keys(map).map(function (k) {
        return {
          model: k,
          cost: map[k]
        };
      }).sort(function (a, b) {
        return b.cost - a.cost;
      });
    }
    function usageRatioRows(body, secTitle, agg, totalLabel) {
      body.appendChild(uSectionTitle(secTitle, totalLabel));
      if (!agg.length) {
        var no = document.createElement('div');
        no.className = 'dshwv-usage-hint';
        wb(no, "textContent", (function(){ return function(){ return wm("widget.noModelDetailsYet"); }; })());
        body.appendChild(no);
        return;
      }
      var sum = agg.reduce(function (a, x) {
        return a + x.cost;
      }, 0) || 1;
      var costEls = [];
      agg.forEach(function (row, i) {
        var wr = document.createElement('div');
        wr.className = 'dshwv-usage-ratio';
        var lab = document.createElement('span');
        lab.className = 'dshwv-usage-ratio-label';
        lab.textContent = row.model;
        lab.title = row.model;
        wr.appendChild(lab);
        var track = document.createElement('div');
        track.className = 'dshwv-usage-ratio-track';
        var fill = document.createElement('div');
        fill.className = 'dshwv-usage-ratio-fill';
        fill.style.width = Math.round(row.cost / sum * 100) + '%';
        fill.style.background = USAGE_PALETTE[i % USAGE_PALETTE.length];
        track.appendChild(fill);
        wr.appendChild(track);
        var pct = document.createElement('span');
        pct.className = 'dshwv-usage-ratio-pct';
        pct.textContent = Math.round(row.cost / sum * 100) + '%';
        wr.appendChild(pct);
        var cost = document.createElement('span');
        cost.className = 'dshwv-usage-ratio-cost';
        bindUsageMoney(cost, row.cost);
        cost.title = cost.textContent;
        wr.appendChild(cost);
        costEls.push(cost);
        body.appendChild(wr);
      });
      try {
        var parW = costEls[0] && costEls[0].parentNode ? costEls[0].parentNode.clientWidth : 420;
        var capCost = Math.max(50, Math.floor(parW - 96 - 42 - 32));
        var maxCost = 40;
        for (var c1 = 0; c1 < costEls.length; c1++) {
          var cw1 = costEls[c1].scrollWidth || 40;
          if (cw1 > maxCost) maxCost = cw1;
        }
        var useCost = Math.min(maxCost, capCost);
        for (var c2 = 0; c2 < costEls.length; c2++) {
          costEls[c2].style.width = useCost + 'px';
          costEls[c2].style.textAlign = 'right';
          costEls[c2].style.overflow = 'hidden';
          costEls[c2].style.textOverflow = 'ellipsis';
        }
      } catch (err) {}
    }
    function usageDrawBarChart(body, secTitle, days, opts) {
      opts = opts || ({});
      var todayKey = String(opts.today || '');
      var onPick = opts.onPick || null;
      body.appendChild(uSectionTitle(secTitle, ''));
      if (!days || !days.length) {
        var no = document.createElement('div');
        no.className = 'dshwv-usage-hint';
        wb(no, "textContent", (function(){ return function(){ return wm("widget.noDailyDataYet"); }; })());
        body.appendChild(no);
        return;
      }
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-usage-chartwrap';
      var canvas = document.createElement('canvas');
      wrap.appendChild(canvas);
      var tip = document.createElement('div');
      tip.className = 'dshwv-usage-tip';
      tip.style.display = 'none';
      wrap.appendChild(tip);
      body.appendChild(wrap);
      var bars = [];
      function paint(hoverIdx) {
        var cw = Math.max(120, wrap && (wrap.clientWidth || (wrap.getBoundingClientRect ? wrap.getBoundingClientRect().width : 0)) || canvas.clientWidth || 520);
        var ch = 150;
        var dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.round(cw * dpr));
        canvas.height = Math.max(1, Math.round(ch * dpr));
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        var g = canvas.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, cw, ch);
        var padL = 42, padR = 10, padT = 10, padB = 22;
        var iw = cw - padL - padR;
        var ih = ch - padT - padB;
        var max = 1;
        for (var i = 0; i < days.length; i++) max = Math.max(max, Number(days[i].total) || 0);
        var step = iw / days.length;
        var bw = Math.max(3, Math.min(36, step * 0.62));
        bars = [];
        for (var k = 0; k < days.length; k++) {
          var unknown = days[k].total == null || !Number.isFinite(Number(days[k].total));
          var val = unknown ? 0 : Number(days[k].total);
          var h = val > 0 ? Math.max(2, val / max * ih) : 0;
          var x = padL + step * k + (step - bw) / 2;
          var y = padT + ih - h;
          var kToday = !!(todayKey && String(days[k].date || '') === todayKey);
          g.fillStyle = k === hoverIdx ? '#e0433f' : kToday ? '#2fa44c' : gptThemeColor('ink');
          if (k === hoverIdx) {
            g.globalAlpha = 0.9;
          }
          if (unknown) {
            g.fillStyle = gptThemeColor('muted'); g.font = '11px sans-serif'; g.textAlign = 'center';
            g.fillText('?', x + bw / 2, padT + ih - 3);
          } else if (h > 0) {
            g.fillRect(x, y, bw, h);
          } else {
            g.fillStyle = gptThemeAlpha('.25');
            g.fillRect(x, padT + ih - 3, bw, 3);
          }
          g.globalAlpha = 1;
          bars.push({
            x: x,
            w: bw,
            day: days[k]
          });
          if (days.length <= 16 || k % Math.ceil(days.length / 16) === 0) {
            g.fillStyle = gptThemeColor('muted');
            g.font = '10px sans-serif';
            g.textAlign = 'center';
            var dl = String(days[k].date || '').split('-');
            var lab = dl.length === 3 ? dl[1] + '-' + dl[2] : days[k].date;
            g.fillText(lab, x + bw / 2, ch - 8);
          }
        }
        g.fillStyle = gptThemeColor('muted');
        g.font = '10px sans-serif';
        g.textAlign = 'right';
        g.fillText(usageMoney(max), padL - 4, padT + 8);
        g.fillText(usageMoney(max / 2), padL - 4, padT + ih / 2 + 3);
        g.fillText(usageMoney(0), padL - 4, padT + ih + 4);
      }
      function move(ev) {
        var r = canvas.getBoundingClientRect();
        var x = ev.clientX - r.left;
        var hover = -1;
        for (var i = 0; i < bars.length; i++) {
          if (x >= bars[i].x && x <= bars[i].x + bars[i].w) {
            hover = i;
            break;
          }
        }
        paint(hover);
        if (hover >= 0) {
          tip.style.display = 'block';
          var day = bars[hover].day, currency = state.currency || 'USD';
          WhaleMoney.bind(tip, function () { return day.date + '  ' + (day.total == null ? wm("widget.totalUnknown") : usageMoney(day.total, currency)); });
          var wr = wrap.getBoundingClientRect();
          var tx = ev.clientX - wr.left + 10;
          if (tx + 130 > wr.width) tx = ev.clientX - wr.left - 140;
          var ty = ev.clientY - wr.top + 12;
          tip.style.left = Math.max(0, tx) + 'px';
          tip.style.top = Math.max(0, ty) + 'px';
        } else {
          tip.style.display = 'none';
        }
      }
      canvas.addEventListener('mousemove', move);
      canvas.addEventListener('mouseleave', function () {
        tip.style.display = 'none';
        paint(-1);
      });
      if (onPick) {
        canvas.addEventListener('click', function (ev) {
          try {
            var rc = canvas.getBoundingClientRect();
            var cx = ev.clientX - rc.left;
            for (var bi = 0; bi < bars.length; bi++) {
              if (cx >= bars[bi].x && cx <= bars[bi].x + bars[bi].w) {
                onPick(bars[bi].day.date);
                break;
              }
            }
          } catch (err) {}
        });
      }
      WhaleMoney.bind(canvas, function () { return WhaleMoney.state().displayCurrency; }, function () { paint(-1); tip.style.display = 'none'; });
      try {
        setTimeout(function () {
          try {
            paint(-1);
          } catch (err) {}
        }, 420);
      } catch (err) {}
    }
    function usageSlide(el, open) {
      try {
        if (!el) return;
        if (el.__dshwSlide) clearTimeout(el.__dshwSlide);
        el.style.transition = 'max-height .24s ease, opacity .16s ease';
        el.style.overflow = 'hidden';
        if (open) {
          el.style.display = 'block';
          var h0 = el.scrollHeight;
          if (h0 <= 0) h0 = 100;
          el.style.opacity = '0';
          el.style.maxHeight = '0px';
          void el.offsetHeight;
          el.style.opacity = '1';
          el.style.maxHeight = h0 + 'px';
          el.__dshwSlide = setTimeout(function () {
            el.style.maxHeight = '';
            el.style.overflow = '';
            el.style.transition = '';
            el.__dshwSlide = null;
          }, 260);
        } else {
          var ch = el.scrollHeight;
          if (ch <= 0) {
            el.style.display = 'none';
            el.style.transition = '';
            return;
          }
          el.style.maxHeight = ch + 'px';
          void el.offsetHeight;
          el.style.opacity = '0';
          el.style.maxHeight = '0px';
          el.__dshwSlide = setTimeout(function () {
            el.style.display = 'none';
            el.style.maxHeight = '';
            el.style.opacity = '';
            el.style.overflow = '';
            el.style.transition = '';
            el.__dshwSlide = null;
          }, 250);
        }
      } catch (err) {
        try {
          el.style.display = open ? 'block' : 'none';
        } catch (err2) {}
      }
    }
    function usageCollapseBlock(parent, label, openDefault, build) {
      var box = document.createElement('div');
      var hd = document.createElement('button');
      hd.type = 'button';
      hd.className = 'dshwv-usage-collapse';
      var inner = document.createElement('div');
      inner.className = 'dshwv-usage-collapse-body';
      inner.style.display = 'none';
      var opened = false;
      var st = false;
      function ensureBuild() {
        if (!opened) {
          opened = true;
          try {
            build(inner);
          } catch (err) {}
        }
      }
      function openNow() {
        st = true;
        inner.style.display = 'block';
        inner.style.maxHeight = '0px';
        inner.style.overflow = 'hidden';
        ensureBuild();
        usageSlide(inner, true);
        paint();
      }
      function closeNow() {
        st = false;
        usageSlide(inner, false);
        paint();
      }
      function paint() {
        hd.innerHTML = '';
        var l = document.createElement('span');
        wb(l, "textContent", (function(label){ return function(){ return label; }; })(label));
        hd.appendChild(l);
        var ch = document.createElement('span');
        ch.className = 'dshwv-usage-chev';
        ch.textContent = st ? '▾' : '▸';
        hd.appendChild(ch);
      }
      hd.addEventListener('click', function () {
        if (st) closeNow(); else openNow();
      });
      box.__open = openNow;
      box.__close = closeNow;
      paint();
      box.appendChild(hd);
      box.appendChild(inner);
      parent.appendChild(box);
      if (openDefault) openNow();
      return box;
    }
    function usageEvTime(ev) {
      try {
        var dd = new Date(ev.ts);
        var p2 = function (n) {
          return String(n).padStart(2, '0');
        };
        return p2(dd.getHours()) + ':' + p2(dd.getMinutes());
      } catch (err) {
        return '';
      }
    }
    function fillUsageRecordsWindow(d) {
      var card = usageMoreCard;
      card.innerHTML = '';
      var title = document.createElement('div');
      title.className = 'dshwv-usage-wintitle';
      wb(title, "textContent", (function(){ return function(){ return wm("widget.apiUsageHistory2"); }; })());
      card.appendChild(title);
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'dshwv-usage-close';
      closeBtn.textContent = '×';
      wb(closeBtn, "title", (function(){ return function(){ return wm("widget.close"); }; })());
      closeBtn.addEventListener('click', closeUsageRecordsWindow);
      card.appendChild(closeBtn);
      var body = document.createElement('div');
      body.className = 'dshwv-usage-windowbody';
      card.appendChild(body);
      if (!d || !d.ok) {
        wb(body, "textContent", (function(){ return function(){ return wm("widget.couldNotLoad2"); }; })());
        return;
      }
      var allDays = (d.all && d.all.days || []).slice().sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      });
      var evAll = (d.all && d.all.events || []).slice();
      var sumAll = 0;
      var maxDay = null;
      var missingDays = 0;
      for (var s1 = 0; s1 < allDays.length; s1++) {
        if (allDays[s1].total == null || !Number.isFinite(Number(allDays[s1].total))) { missingDays++; continue; }
        sumAll += Number(allDays[s1].total);
        if (!maxDay || Number(allDays[s1].total) > Number(maxDay.total)) maxDay = allDays[s1];
      }
      var totalIncomplete = missingDays > 0 || d.all && d.all.totalComplete === false;
      var ov = document.createElement('div');
      ov.className = 'dshwv-usage-oview';
      var ovL = document.createElement('div');
      wb(ovL, "textContent", (function(totalIncomplete){ return function(){ return totalIncomplete ? wm("widget.allUsageKnownSubtotal") : wm("widget.allUsage"); }; })(totalIncomplete));
      ov.appendChild(ovL);
      var ovN = document.createElement('div');
      ovN.className = 'dshwv-usage-oview-num';
      if (totalIncomplete && !maxDay) wb(ovN, "textContent", (function(){ return function(){ return wm("widget.unknown"); }; })());
      else bindUsageMoney(ovN, sumAll);
      ov.appendChild(ovN);
      var ovS = document.createElement('div');
      ovS.className = 'dshwv-usage-hint';
      var recordCurrency = state.currency || 'USD';
      WhaleMoney.bind(ovS, function () { return wc('widget.recentRecords', evAll.length) +
        (totalIncomplete ? ' · ' + missingDays + wm("widget.dailyTotalsAreUnknownAndExcluded") : '') +
        (maxDay ? wm("widget.knownPeak") + maxDay.date + ' ' + usageMoney(maxDay.total, recordCurrency) : ''); });
      ov.appendChild(ovS);
      body.appendChild(ov);
      var detailBox = null;
      usageCollapseBlock(body, wm("widget.chartsLast30DaysModelShare"), false, function (inner) {
        usageDrawBarChart(inner, wm("widget.last30DaysGreenIsTodayClickA"), allDays.slice(-30), {
          today: usageTodayKeyStr(),
          onPick: function (date) {
            try {
              if (!detailBox) return;
              detailBox.__open();
              setTimeout(function () {
                var tr = detailBox.querySelector('[data-usage-day="' + String(date) + '"]');
                if (tr) {
                  tr.scrollIntoView({
                    block: 'center',
                    behavior: 'smooth'
                  });
                  tr.style.boxShadow = 'inset 0 0 0 2px rgba(var(--gpt-ink-rgb),.55)';
                  setTimeout(function () {
                    tr.style.boxShadow = '';
                  }, 1400);
                }
              }, 120);
            } catch (err) {}
          }
        });
        var todayAgg = usageAggModels(d.today && d.today.models ? [{
          models: d.today.models
        }] : []);
        usageRatioRows(inner, wm("widget.todaySEstimatedModelShare"), todayAgg, usageMoneyText(d.today && d.today.total || 0));
        var sevenAgg = usageAggModels(d.days7 || []);
        usageRatioRows(inner, d.total7Complete === false ? wm("widget.last7DaysModelEstimatesIncomplete") : wm("widget.last7DaysEstimatedModelShare"), sevenAgg, usageMoneyText(d.total7));
      });
      detailBox = usageCollapseBlock(body, wm("widget.dailyTotalsAndRecords"), false, function (inner) {
        var search = document.createElement('input');
        search.type = 'text';
        search.className = 'dshwv-colnat';
        search.style.width = '100%';
        search.style.margin = '2px 0 6px';
        wb(search, "placeholder", (function(){ return function(){ return wm("widget.searchByDateEG0721Or"); }; })());
        inner.appendChild(search);
        var evMap = {};
        evAll.forEach(function (ev) {
          var day = ev.day || '';
          if (!day) {
            try {
              var dd2 = new Date(ev.ts);
              day = dd2.getFullYear() + '-' + String(dd2.getMonth() + 1).padStart(2, '0') + '-' + String(dd2.getDate()).padStart(2, '0');
            } catch (err) {}
          }
          if (!day) return;
          (evMap[day] = evMap[day] || []).push(ev);
        });
        var dayTot = {};
        allDays.forEach(function (dx) {
          dayTot[dx.date] = dx.total == null ? null : Number(dx.total);
        });
        var todayKeyStr2 = usageTodayKeyStr();
        function dayGroup(day, evs) {
          var row = document.createElement('div');
          row.className = 'dshwv-usage-row';
          row.style.cursor = 'pointer';
          row.setAttribute('data-usage-day', day);
          var name = document.createElement('span');
          name.style.flex = '1 1 auto';
          name.style.minWidth = '0';
          name.style.overflow = 'hidden';
          name.style.textOverflow = 'ellipsis';
          name.style.whiteSpace = 'nowrap';
          name.textContent = day + (evs.length ? ' (' + evs.length + ')' : '');
          row.appendChild(name);
          var c = document.createElement('span');
          c.style.flex = '0 0 auto';
          var dayV = dayTot[day];
          if (dayV === undefined && day === todayKeyStr2 && d.today && d.today.total != null && isFinite(Number(d.today.total))) dayV = Number(d.today.total);
          if (dayV == null || !isFinite(dayV)) {
            wb(c, "textContent", (function(){ return function(){ return wm("widget.unknown"); }; })());
            wb(c, "title", (function(){ return function(){ return wm("widget.olderTotalsAreMissingObservedTurnIntervalsCan"); }; })());
          } else bindUsageMoney(c, dayV);
          row.appendChild(c);
          var chev = document.createElement('span');
          chev.className = 'dshwv-usage-chev';
          chev.textContent = '▸';
          row.appendChild(chev);
          var detail = document.createElement('div');
          detail.className = 'dshwv-usage-daydetail';
          detail.style.display = 'none';
          var built = false;
          row.addEventListener('click', function (e) {
            var on = detail.style.display !== 'block';
            if (on) {
              if (!built) {
                built = true;
                var lim = Math.min(evs.length, 100);
                for (var i = 0; i < lim; i++) {
                  var ev = evs[i];
                  var r2 = document.createElement('div');
                  r2.className = 'dshwv-usage-row';
                  r2.style.padding = '2px 0 2px 6px';
                  var n2 = document.createElement('span');
                  n2.style.flex = '1 1 auto';
                  n2.style.minWidth = '0';
                  n2.style.overflow = 'hidden';
                  n2.style.textOverflow = 'ellipsis';
                  n2.style.whiteSpace = 'nowrap';
                  wb(n2, "textContent", (function(usageEvTime,ev){ return function(){ return (usageEvTime(ev) ? usageEvTime(ev) + '  ' : '') + (ev.model || wm("widget.unknown")); }; })(usageEvTime,ev));
                  n2.title = n2.textContent;
                  r2.appendChild(n2);
                  var c2 = document.createElement('span');
                  c2.style.flex = '0 0 auto';
                  bindUsageMoney(c2, ev.cost);
                  r2.appendChild(c2);
                  detail.appendChild(r2);
                }
                if (evs.length > lim) {
                  var moreTxt = document.createElement('div');
                  moreTxt.className = 'dshwv-usage-hint';
                  wb(moreTxt, "textContent", (function(evs,lim){ return function(){ return wm("widget.label2") + evs.length + wm("widget.recordsThisDayShowingTheFirst") + lim + wm("widget.records2"); }; })(evs,lim));
                  detail.appendChild(moreTxt);
                }
                if (!evs.length) {
                  var nd = document.createElement('div');
                  nd.className = 'dshwv-usage-hint';
                  wb(nd, "textContent", (function(){ return function(){ return wm("widget.dailyTotalOnlyEnableModelDetailsForIndividual"); }; })());
                  detail.appendChild(nd);
                }
              }
              chev.textContent = '▾';
            } else chev.textContent = '▸';
            usageSlide(detail, on);
          });
          row.appendChild(detail);
          return row;
        }
        var listWrap = document.createElement('div');
        inner.appendChild(listWrap);
        function renderGroups(q) {
          var ql = String(q || '').trim().toLowerCase();
          var groups = [];
          for (var gi = 0; gi < allDays.length; gi++) {
            var day0 = allDays[gi].date;
            var evs = evMap[day0] || [];
            var hit = !ql || day0.toLowerCase().indexOf(ql) >= 0;
            if (!hit) {
              for (var ei = 0; ei < evs.length && !hit; ei++) if (String(evs[ei].model || '').toLowerCase().indexOf(ql) >= 0) hit = true;
            }
            if (hit || day0 === usageTodayKeyStr() && !ql) groups.push(day0);
          }
          groups.sort(function (a, b) {
            return a < b ? 1 : a > b ? -1 : 0;
          });
          var step = 12;
          var shown = step;
          listWrap.innerHTML = '';
          if (!groups.length) {
            var noR = document.createElement('div');
            noR.className = 'dshwv-usage-hint';
            wb(noR, "textContent", (function(ql){ return function(){ return ql ? wm("widget.noMatchingRecords") : wm("widget.noDailyRecordsYet"); }; })(ql));
            listWrap.appendChild(noR);
            return;
          }
          function paintDays() {
            listWrap.innerHTML = '';
            var upto = Math.min(shown, groups.length);
            for (var k = 0; k < upto; k++) {
              var dayK = groups[k];
              listWrap.appendChild(dayGroup(dayK, evMap[dayK] || []));
            }
            if (shown < groups.length) {
              var mb = document.createElement('button');
              mb.type = 'button';
              mb.className = 'dshwv-usage-more';
              wb(mb, "textContent", (function(groups,shown){ return function(){ return wc('widget.loadEarlierDays', groups.length - shown); }; })(groups,shown));
              mb.addEventListener('click', function () {
                shown += step;
                paintDays();
              });
              listWrap.appendChild(mb);
            }
          }
          paintDays();
        }
        search.addEventListener('input', function () {
          renderGroups(search.value);
        });
        renderGroups('');
      });
    }
    document.body.appendChild(rolePanel);
    var SNAP_PREVIEW = 190;
    var snapPvW = SNAP_PREVIEW;
    var snapPvH = SNAP_PREVIEW;
    var snapEdit = null;
    var snapLineDrag = null;
    var snapMask = null;
    var snapCard = null;
    var snapRadio = {};
    var snapNum = {};
    var snapNumUnit = {};
    var snapPreview = null;
    function unitOf(mode) {
      return mode === 'px' ? 'px' : '%';
    }
    function ensureSnapPx(cfg) {
      try {
        if (!(cfg.px.F >= 0)) {
          cfg.px.L = 80;
          cfg.px.T = 0;
          cfg.px.R = 80;
          cfg.px.B = 80;
          cfg.px.F = Math.round(Math.max(1, viewport().w) / 2);
        }
      } catch (err) {}
    }
    function snapSetVal(key, val) {
      try {
        if (!snapEdit || snapEdit.mode === 'off') return;
        var m = snapEdit.mode;
        var vp = viewport();
        var set = m === 'px' ? snapEdit.px : snapEdit.ratio;
        var clamped = clampSnapKey(m, key, val, vp);
        set[key] = Math.max(0, Math.round(clamped));
      } catch (err) {}
    }
    function snapPvSize() {
      var vp = viewport();
      var maxW = 210, maxH = 190, minSide = 56;
      var ar = Math.max(0.05, vp.w / vp.h);
      var w, h;
      if (ar * maxH <= maxW) {
        h = maxH;
        w = maxH * ar;
      } else {
        w = maxW;
        h = maxW / ar;
      }
      w = Math.round(Math.max(minSide, Math.min(maxW, w)));
      h = Math.round(Math.max(minSide, Math.min(maxH, h)));
      return {
        w: w,
        h: h
      };
    }
    function snapFrac() {
      var vp = viewport();
      var f = {
        Lf: 0,
        Tf: 0,
        Rf: 1,
        Bf: 1,
        Ff: 0.5
      };
      try {
        var m = snapEdit.mode;
        var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
        if (m === 'ratio') {
          f.Lf = Math.min(100, Math.max(0, snapEdit.ratio.L)) / 100;
          f.Tf = Math.min(100, Math.max(0, snapEdit.ratio.T)) / 100;
          f.Rf = 1 - Math.min(100, Math.max(0, snapEdit.ratio.R)) / 100;
          f.Bf = 1 - Math.min(100, Math.max(0, snapEdit.ratio.B)) / 100;
          f.Ff = Math.min(100, Math.max(0, snapEdit.ratio.F)) / 100;
        } else if (m === 'px') {
          f.Lf = Math.min(w, Math.max(0, snapEdit.px.L)) / w;
          f.Tf = Math.min(h, Math.max(0, snapEdit.px.T)) / h;
          f.Rf = 1 - Math.min(w, Math.max(0, snapEdit.px.R)) / w;
          f.Bf = 1 - Math.min(h, Math.max(0, snapEdit.px.B)) / h;
          f.Ff = Math.min(w, Math.max(0, snapEdit.px.F)) / w;
        }
      } catch (err) {}
      return f;
    }
    function renderSnapPreview() {
      try {
        if (!snapEdit || !snapPreview) return;
        snapPreview.innerHTML = '';
        var W = snapPvW;
        var H = snapPvH;
        if (snapEdit.mode === 'off') {
          var off = document.createElement('div');
          off.className = 'dshwv-snapoff';
          wb(off, "textContent", (function(){ return function(){ return wm("widget.offFreePlacementNoSnappingOrFlipping"); }; })());
          snapPreview.appendChild(off);
          return;
        }
        var f = snapFrac();
        var Lx = Math.max(0, Math.min(W, f.Lf * W));
        var Rx = Math.max(0, Math.min(W, f.Rf * W));
        var Ty = Math.max(0, Math.min(H, f.Tf * H));
        var By = Math.max(0, Math.min(H, f.Bf * H));
        var Fx = Math.max(0, Math.min(W, f.Ff * W));
        var flipBg = document.createElement('div');
        flipBg.className = 'dshwv-snapflip';
        flipBg.style.width = Fx + 'px';
        flipBg.style.height = H + 'px';
        snapPreview.appendChild(flipBg);
        var zoneDefs = [{
          l: 0,
          t: 0,
          w: Lx,
          h: H,
          bg: 'rgba(120,101,165,.20)'
        }, {
          l: Rx,
          t: 0,
          w: Math.max(0, W - Rx),
          h: H,
          bg: 'rgba(245,158,11,.18)'
        }, {
          l: 0,
          t: 0,
          w: W,
          h: Ty,
          bg: 'rgba(16,185,129,.16)'
        }, {
          l: 0,
          t: By,
          w: W,
          h: Math.max(0, H - By),
          bg: 'rgba(239,68,68,.14)'
        }];
        var i, zd;
        for (i = 0; i < zoneDefs.length; i++) {
          zd = zoneDefs[i];
          if (zd.w < 1 || zd.h < 1) continue;
          var z = document.createElement('div');
          z.className = 'dshwv-snapzone';
          z.style.left = zd.l + 'px';
          z.style.top = zd.t + 'px';
          z.style.width = zd.w + 'px';
          z.style.height = zd.h + 'px';
          z.style.background = zd.bg;
          snapPreview.appendChild(z);
        }
        var lineDefs = [{
          key: 'L',
          x: Lx,
          horizontal: false,
          flip: false
        }, {
          key: 'R',
          x: Rx,
          horizontal: false,
          flip: false
        }, {
          key: 'T',
          y: Ty,
          horizontal: true,
          flip: false
        }, {
          key: 'B',
          y: By,
          horizontal: true,
          flip: false
        }, {
          key: 'F',
          x: Fx,
          horizontal: false,
          flip: true
        }];
        for (i = 0; i < lineDefs.length; i++) {
          var ld = lineDefs[i];
          var p = ld.horizontal ? Math.max(0, Math.min(H, ld.y)) : Math.max(0, Math.min(W, ld.x));
          var ln = document.createElement('div');
          ln.className = 'dshwv-snapline' + (ld.flip ? ' dshwv-snapline-flip' : '');
          if (ld.horizontal) {
            ln.style.left = '0px';
            ln.style.top = p + 'px';
            ln.style.width = W + 'px';
            ln.style.height = '2px';
          } else {
            ln.style.left = p + 'px';
            ln.style.top = '0px';
            ln.style.width = '2px';
            ln.style.height = H + 'px';
          }
          snapPreview.appendChild(ln);
          var hd = document.createElement('div');
          hd.className = 'dshwv-snaphandle' + (ld.flip ? ' dshwv-snaphandle-flip' : '') + (ld.horizontal ? ' dshwv-snaphandle-h' : '');
          hd.style.left = (ld.horizontal ? W / 2 : p) + 'px';
          hd.style.top = (ld.horizontal ? p : H / 2) + 'px';
          wb(hd, "title", (function(ld){ return function(){ return ld.key === 'F' ? wm("widget.flipBoundaryLeftSideIsFlipped") : wm("widget.snapBoundaryDragToAdjust"); }; })(ld));
          hd.addEventListener('pointerdown', (function (key, horizontal) {
            return function (e) {
              startSnapLineDrag(e, key, horizontal);
            };
          })(ld.key, ld.horizontal));
          snapPreview.appendChild(hd);
        }
      } catch (err) {}
    }
    function syncSnapInputs() {
      try {
        if (!snapEdit) return;
        var m = snapEdit.mode;
        var set = m === 'px' ? snapEdit.px : snapEdit.ratio;
        var keys = ['L', 'T', 'R', 'B', 'F'];
        var unit = unitOf(m);
        var i;
        for (i = 0; i < keys.length; i++) {
          var k = keys[i];
          snapNum[k].value = String(Math.round(set[k]));
          snapNum[k].disabled = m === 'off';
          snapNumUnit[k].textContent = unit;
        }
      } catch (err) {}
    }
    function renderSnapModes() {
      try {
        if (snapEdit && snapRadio[snapEdit.mode]) snapRadio[snapEdit.mode].checked = true;
      } catch (err) {}
    }
    function startSnapLineDrag(e, key, horizontal) {
      try {
        e.preventDefault();
        try {
          e.stopPropagation();
        } catch (err) {}
        if (!snapEdit || snapEdit.mode === 'off') return;
        var vp = viewport();
        var axis = horizontal ? vp.h : vp.w;
        var domain = snapEdit.mode === 'px' ? axis : 100;
        var set = snapEdit.mode === 'px' ? snapEdit.px : snapEdit.ratio;
        snapLineDrag = {
          key: key,
          horizontal: horizontal,
          sx: e.clientX,
          sy: e.clientY,
          factor: domain / (horizontal ? Math.max(1, snapPvH) : Math.max(1, snapPvW)),
          orig: set[key]
        };
        document.addEventListener('pointermove', onSnapLineMove, true);
        document.addEventListener('pointerup', onSnapLineUp, true);
        document.addEventListener('pointercancel', onSnapLineUp, true);
      } catch (err) {}
    }
    function onSnapLineMove(e) {
      try {
        if (!snapLineDrag) return;
        var d = snapLineDrag;
        var delta = d.horizontal ? e.clientY - d.sy : e.clientX - d.sx;
        var val;
        if (d.key === 'R' || d.key === 'B') val = d.orig - delta * d.factor; else val = d.orig + delta * d.factor;
        snapSetVal(d.key, val);
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function onSnapLineUp() {
      try {
        snapLineDrag = null;
        document.removeEventListener('pointermove', onSnapLineMove, true);
        document.removeEventListener('pointerup', onSnapLineUp, true);
        document.removeEventListener('pointercancel', onSnapLineUp, true);
      } catch (err) {}
    }
    function onSnapNumInput(key) {
      try {
        var v = Number(snapNum[key].value);
        if (!isFinite(v)) return;
        snapSetVal(key, v);
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function resetSnapEdit() {
      try {
        if (!snapEdit) return;
        var m = snapEdit.mode;
        if (m === 'ratio') {
          snapEdit.ratio = {
            L: 10,
            T: 0,
            R: 10,
            B: 15,
            F: 50
          };
        } else if (m === 'px') {
          snapEdit.px = {
            L: 80,
            T: 0,
            R: 80,
            B: 80,
            F: Math.round(Math.max(1, viewport().w) / 2)
          };
        }
        renderSnapModes();
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function openSnapModal() {
      try {
        closeRolePanel();
        closeAudioGroupPanel();
        var sz = snapPvSize();
        snapPvW = sz.w;
        snapPvH = sz.h;
        if (snapPreview) {
          snapPreview.style.width = snapPvW + 'px';
          snapPreview.style.height = snapPvH + 'px';
        }
        if (snapGrid) {
          snapGrid.style.gridTemplateColumns = '72px ' + snapPvW + 'px 72px';
          snapGrid.style.gridTemplateRows = '26px ' + snapPvH + 'px 26px';
        }
        snapEdit = cloneSnap(snapConfig);
        ensureSnapPx(snapEdit);
        renderSnapModes();
        renderSnapPreview();
        syncSnapInputs();
        snapMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeSnapModal(apply) {
      try {
        if (apply && snapEdit) {
          snapConfig = cloneSnap(snapEdit);
          fixSnapConfig(snapConfig);
          saveSnapConfig();
          applySnapConfigNow();
        }
        snapEdit = null;
        snapMask.style.display = 'none';
      } catch (err) {}
    }
    function applySnapConfigNow() {
      try {
        if (snapConfig.mode === 'off') {
          state.flip = false;
          express();
          return;
        }
        snapCheck();
        commitPosition();
      } catch (err) {}
    }
    snapMask = document.createElement('div');
    snapMask.className = 'dshwv-snapmask';
    snapMask.style.display = 'none';
    snapCard = document.createElement('div');
    snapCard.className = 'dshwv-snapwin';
    var snapTitle = document.createElement('div');
    snapTitle.className = 'dshwv-snaptitle';
    wb(snapTitle, "textContent", (function(){ return function(){ return wm("widget.snapFlipSettings"); }; })());
    snapCard.appendChild(snapTitle);
    var snapModes = document.createElement('div');
    snapModes.className = 'dshwv-snapmodes';
    var snapModeDefs = [['ratio', wm("widget.relativeSnapping")], ['px', wm("widget.pixelSnapping")], ['off', wm("widget.close")]];
    var mi;
    for (mi = 0; mi < snapModeDefs.length; mi++) {
      (function (k, label) {
        var lab = document.createElement('label');
        var inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'dshwv-snapmode';
        inp.value = k;
        inp.addEventListener('change', function () {
          if (!snapEdit) return;
          snapEdit.mode = k;
          if (k === 'px') ensureSnapPx(snapEdit);
          renderSnapModes();
          renderSnapPreview();
          syncSnapInputs();
        });
        var tx = document.createElement('span');
        wb(tx, "textContent", (function(label){ return function(){ return label; }; })(label));
        lab.appendChild(inp);
        lab.appendChild(tx);
        snapModes.appendChild(lab);
        snapRadio[k] = inp;
      })(snapModeDefs[mi][0], snapModeDefs[mi][1]);
    }
    snapCard.appendChild(snapModes);
    var snapGrid = document.createElement('div');
    snapGrid.className = 'dshwv-snapgrid';
    function snapMakeNum(key, labelText) {
      var cell = document.createElement('span');
      cell.className = 'dshwv-snapcell';
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.step = '1';
      inp.className = 'dshwv-snapnum';
      wb(inp, "title", (function(labelText){ return function(){ return labelText; }; })(labelText));
      inp.addEventListener('input', function () {
        onSnapNumInput(key);
      });
      inp.addEventListener('change', function () {
        onSnapNumInput(key);
      });
      var un = document.createElement('span');
      un.className = 'dshwv-snapunit';
      un.textContent = '%';
      cell.appendChild(inp);
      cell.appendChild(un);
      snapNum[key] = inp;
      snapNumUnit[key] = un;
      return cell;
    }
    snapPreview = document.createElement('div');
    snapPreview.className = 'dshwv-snappreview';
    var snapGridT = document.createElement('div');
    snapGridT.className = 'dshwv-snapcell';
    snapGridT.style.gridColumn = '2';
    snapGridT.style.gridRow = '1';
    snapGridT.appendChild(snapMakeNum('T', wm("widget.topSnapZoneDistanceFromTheTopEdge")));
    var snapGridL = document.createElement('div');
    snapGridL.className = 'dshwv-snapcell';
    snapGridL.style.gridColumn = '1';
    snapGridL.style.gridRow = '2';
    snapGridL.appendChild(snapMakeNum('L', wm("widget.leftSnapZoneDistanceFromTheLeftEdge")));
    var snapGridC = document.createElement('div');
    snapGridC.style.gridColumn = '2';
    snapGridC.style.gridRow = '2';
    snapGridC.style.lineHeight = '0';
    snapGridC.appendChild(snapPreview);
    var snapGridR = document.createElement('div');
    snapGridR.className = 'dshwv-snapcell';
    snapGridR.style.gridColumn = '3';
    snapGridR.style.gridRow = '2';
    snapGridR.appendChild(snapMakeNum('R', wm("widget.rightSnapZoneDistanceFromTheRightEdge")));
    var snapGridB = document.createElement('div');
    snapGridB.className = 'dshwv-snapcell';
    snapGridB.style.gridColumn = '2';
    snapGridB.style.gridRow = '3';
    snapGridB.appendChild(snapMakeNum('B', wm("widget.bottomSnapZoneDistanceFromTheBottomEdge")));
    snapGrid.appendChild(snapGridT);
    snapGrid.appendChild(snapGridL);
    snapGrid.appendChild(snapGridC);
    snapGrid.appendChild(snapGridR);
    snapGrid.appendChild(snapGridB);
    snapCard.appendChild(snapGrid);
    var snapFlipRow = document.createElement('div');
    snapFlipRow.className = 'dshwv-snapfliprow';
    var snapFlipLabel = document.createElement('span');
    wb(snapFlipLabel, "textContent", (function(){ return function(){ return wm("widget.flipBoundary"); }; })());
    snapFlipRow.appendChild(snapFlipLabel);
    snapFlipRow.appendChild(snapMakeNum('F', wm("widget.distanceFromTheLeftEdgeTheCharacterFlips")));
    snapCard.appendChild(snapFlipRow);
    var snapBtns = document.createElement('div');
    snapBtns.className = 'dshwv-snapbtns';
    function snapBtn(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-snapbtn ' + cls;
      wb(b, "textContent", (function(label){ return function(){ return label; }; })(label));
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      return b;
    }
    snapBtns.appendChild(snapBtn(wm("widget.cancel"), 'dshwv-snapbtn-no', function () {
      closeSnapModal(false);
    }));
    snapBtns.appendChild(snapBtn(wm("widget.reset"), 'dshwv-snapbtn-no', resetSnapEdit));
    snapBtns.appendChild(snapBtn(wm("widget.confirm"), 'dshwv-snapbtn-ok', function () {
      closeSnapModal(true);
    }));
    snapCard.appendChild(snapBtns);
    snapMask.appendChild(snapCard);
    document.body.appendChild(snapMask);
    var bubbleMask = null;
    var bubbleEditItems = [];
    var bubbleMoreListEl = null;
    var bubbleFirstChipEl = null;
    var BUBBLE_KIND_LABEL = {
      normal: wm("widget.balanceContent"),
      random: wm("widget.customRandomText"),
      custom: wm("widget.customContent")
    };
    function bubbleDefaultFirstModules() {
      return [{
        type: "text",
        text: "当前 API 余额",
        i18nKey: "widget.apiBalance",
        size: 8,
        bold: true,
        rgb: "",
        ul: false,
        italic: false,
        color: ""
      }, {
        type: "balance",
        size: 20,
        rgb: "",
        color: gptThemeColor('accent-strong'),
        tpl: "{balance_api}"
      }, {
        type: "today",
        size: 4,
        color: gptThemeColor('muted'),
        tpl: "今日已观测 {expense_api}",
        tplI18nKey: "widget.observedTodayExpenseApi"
      }];
    }
    function bubbleDefaultRandomLines() { return []; }
    function bubbleDefaultSecondModules() { return bubbleDefaultFirstModules(); }
    var BUBBLE_DEFAULT_ITEMS = [{ kind: 'custom', modules: bubbleDefaultFirstModules() }, { kind: 'custom', modules: [{type: 'image', imgId: 'bimg_petpet', size: 6}] }];
    function bubbleParseDefaultItems() {
      try {
        return JSON.parse(JSON.stringify(BUBBLE_DEFAULT_ITEMS));
      } catch (err) {
        return [];
      }
    }
    function bubbleDefaultQueue() { return bubbleParseDefaultItems(); }
    function bubbleKindLabel(kind) {
      return BUBBLE_KIND_LABEL[kind === 'random' ? 'random' : kind === 'custom' ? 'custom' : 'normal'];
    }
    function bubbleDefaultModules(kind) {
      if (kind === 'random') return bubbleDefaultSecondModules();
      if (kind === 'normal') return bubbleDefaultFirstModules();
      return [{
        type: 'text',
        text: wm("widget.newContent"),
        size: 6
      }];
    }
    function bubbleModuleSummary(m) {
      m = m || ({});
      if (m.type === 'balance') return wm("widget.balanceAmount");
      if (m.type === 'today') return wm("widget.observedToday2");
      if (m.type === 'image') return wm("widget.imageAnimation");
      if (m.type === 'random') return wm("widget.customRandomText") + ' (' + wc('widget.entryCount', m.lines && m.lines.length || 0) + ')';
      if (m.type === 'link') return wm("widget.link") + (localizedModuleField(m, 'text').slice(0, 14) || wm("widget.openLink"));
      return wm("widget.text") + localizedModuleField(m, 'text').slice(0, 14);
    }
    function bubbleModuleListLabel(m) {
      m = m || ({});
      if (m.type === 'text') return wm("widget.text") + (localizedModuleField(m, 'text').slice(0, 24) || wm("widget.empty"));
      if (m.type === 'link') return wm("widget.link") + (localizedModuleField(m, 'text').slice(0, 24) || wm("widget.openLink"));
      if (m.type === 'random') return m.name || wm("widget.customRandomText");
      if (m.type === 'balance') return wm("widget.balanceAmount");
      if (m.type === 'today') return wm("widget.observedToday2");
      if (m.type === 'image') return wm("widget.imageAnimation");
      return wm("widget.module");
    }
    function bubbleEditEnsureModules(item) {
      if (Array.isArray(item.modules)) return;
      if (item.kind === 'custom') {
        item.modules = [];
        return;
      }
      item.modules = bubbleDefaultModules(item.kind);
    }
    function bubbleRowLabel(it) {
      if (it.modules && it.modules.length) return bubbleKindLabel('custom') + ' · ' + wc('widget.moduleCount', it.modules.length);
      return bubbleKindLabel(it.kind);
    }
    function bubbleIsChoice(step) {
      return !!(step && step.kind === 'choice');
    }
    function bubbleChoiceOptions(step) {
      return step && step.kind === 'choice' && Array.isArray(step.options) ? step.options : [];
    }
    function bubbleChoiceWeight(o) {
      return Math.max(1, Math.round(Number(o && o.w) || 1));
    }
    function bubbleNamedItem(source, target) {
      if (source && typeof source.name === 'string') target.name = source.name;
      return target;
    }
    function bubbleSingleFromItem(itm) {
      return bubbleNamedItem(itm, {
        kind: 'custom',
        modules: itm && Array.isArray(itm.modules) ? itm.modules : []
      });
    }
    function bubbleStepToBubble(step) {
      if (bubbleIsChoice(step)) {
        var o0 = bubbleChoiceOptions(step)[0];
        step = o0 ? o0.item : null;
      }
      var mods = step && Array.isArray(step.modules) ? step.modules : bubbleDefaultModules(step && step.kind === 'random' ? 'random' : 'normal');
      return bubbleNamedItem(step, {
        kind: 'custom',
        modules: JSON.parse(JSON.stringify(mods))
      });
    }
    function renderBubbleFirst() {
      var it = bubbleEditItems[0] || ({
        kind: 'normal'
      });
      wb(bubbleFirstChipEl, "textContent", (function(){ return function(){ return wm("widget.firstClickEditContent"); }; })());
      wb(bubbleFirstChipEl, "title", (function(bubbleRowLabel,it){ return function(){ return wm("widget.editBubbleContent") + bubbleRowLabel(it) + ')'; }; })(bubbleRowLabel,it));
    }
    function renderBubbleMore() {
      bubbleMoreListEl.innerHTML = '';
      for (var i = 1; i < bubbleEditItems.length; i++) {
        (function (idx) {
          var step = bubbleEditItems[idx];
          var isChoice = bubbleIsChoice(step);
          var row = document.createElement('div');
          row.className = 'dshwv-bubrow dshwv-bubrow-drag';
          row.draggable = !isChoice;
          row.setAttribute('data-i', String(idx));
          row.addEventListener('dragstart', function (e) {
            if (bubbleIsChoice(bubbleEditItems[idx])) return;
            try {
              e.dataTransfer.setData('text/plain', 'row:' + idx);
            } catch (err) {}
            bubbleMainDragIdx = idx;
            bubbleMainDragSide = -1;
            bubbleDropZone = '';
          });
          row.addEventListener('dragover', function (e) {
            try {
              e.preventDefault();
            } catch (err) {}
            try {
              e.dataTransfer.dropEffect = 'move';
            } catch (err) {}
            if (bubbleMainDragIdx === idx && bubbleMainDragSide < 0) {
              bubbleDropZone = '';
              row.style.boxShadow = '';
              return;
            }
            var zone = bubbleRowZone(row, e);
            if (bubbleMainDragSide >= 0 && (zone === 'pairL' || zone === 'pairR')) zone = '';
            bubbleDropZone = zone;
            row.style.boxShadow = bubbleDropShadow(zone);
          });
          row.addEventListener('dragleave', function () {
            bubbleDropZone = '';
            row.style.boxShadow = '';
          });
          row.addEventListener('drop', function (e) {
            try {
              e.preventDefault();
            } catch (err) {}
            bubbleDropApply(idx, e);
          });
          var handle = document.createElement('span');
          handle.className = 'dshwv-bubdrag';
          handle.textContent = '⠿';
          if (isChoice) {
            handle.draggable = true;
            wb(handle, "title", (function(){ return function(){ return wm("widget.dragToReorderTheRowIncludingPairedA"); }; })());
            handle.addEventListener('dragstart', function (e) {
              try {
                e.dataTransfer.setData('text/plain', 'row:' + idx);
              } catch (err) {}
              bubbleMainDragIdx = idx;
              bubbleMainDragSide = -1;
              bubbleDropZone = '';
            });
          } else {
            wb(handle, "title", (function(){ return function(){ return wm("widget.dragToReorderMoveToARowS"); }; })());
          }
          row.appendChild(handle);
          if (isChoice) {
            bubbleChoiceRowUI(row, step, idx);
          } else {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'dshwv-bubchip dshwv-bubchip-btn';
            wb(chip, "textContent", (function(idx){ return function(){ return wm("widget.click2") + (idx + 1) + wm("widget.editContent"); }; })(idx));
            wb(chip, "title", (function(bubbleRowLabel,step){ return function(){ return wm("widget.editBubbleContent") + bubbleRowLabel(step) + wm("widget.dragAnotherRowToItsSideToPair"); }; })(bubbleRowLabel,step));
            chip.addEventListener('click', function (e) {
              e.stopPropagation();
              openBubbleItem(idx, -1);
            });
            row.appendChild(chip);
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-bubmini';
            del.textContent = '✕';
            wb(del, "title", (function(){ return function(){ return wm("widget.removeThisClick"); }; })());
            del.addEventListener('click', function () {
              bubbleDelMore(idx);
            });
            row.appendChild(del);
          }
          bubbleMoreListEl.appendChild(row);
        })(i);
      }
    }
    function bubbleRowZone(rowEl, ev) {
      try {
        var r = rowEl.getBoundingClientRect();
        if (!r || !r.width) return '';
        var x = ev.clientX - r.left;
        if (x < r.width * 0.22) return 'pairL';
        if (x > r.width * 0.78) return 'pairR';
        return ev.clientY - r.top < r.height / 2 ? 'before' : 'after';
      } catch (err) {
        return '';
      }
    }
    function bubbleDropShadow(zone) {
      if (zone === 'before') return '0 -3px 0 var(--gpt-ink)';
      if (zone === 'after') return '0 3px 0 var(--gpt-ink)';
      if (zone === 'pairL') return 'inset 3px 0 0 var(--gpt-ink)';
      if (zone === 'pairR') return 'inset -3px 0 0 var(--gpt-ink)';
      return '';
    }
    function bubbleDropApply(to, ev) {
      try {
        var from = bubbleMainDragIdx;
        var side = bubbleMainDragSide;
        bubbleMainDragIdx = null;
        bubbleMainDragSide = -1;
        var zone = bubbleDropZone || '';
        bubbleDropZone = '';
        var arr = bubbleEditItems;
        if (from === null || from === undefined || from < 1 || to < 1 || from >= arr.length || to >= arr.length) return;
        if (side >= 0) {
          if (zone !== 'before' && zone !== 'after') return;
          bubbleSideSplitDrop(from, side, to, zone);
          return;
        }
        if (from === to) return;
        if (zone === 'pairL' || zone === 'pairR') {
          bubblePairDrop(from, to, zone);
          return;
        }
        var target = arr[to];
        var removed = arr.splice(from, 1)[0];
        var ti = arr.indexOf(target);
        if (ti < 0) ti = arr.length - 1;
        var insertAt = zone === 'after' ? ti + 1 : ti;
        arr.splice(Math.max(1, Math.min(insertAt, arr.length)), 0, removed);
        renderBubbleMore();
      } catch (err) {}
    }
    function bubbleSideSplitDrop(from, side, to, zone) {
      try {
        var arr = bubbleEditItems;
        var step = arr[from];
        if (!bubbleIsChoice(step)) return;
        var opts = bubbleChoiceOptions(step);
        if (side < 0 || side >= opts.length) return;
        var movedItem = opts[side].item || ({});
        var movedStep = bubbleSingleFromItem(movedItem);
        var rest = [];
        for (var i = 0; i < opts.length; i++) if (i !== side) rest.push(opts[i]);
        if (from === to) {
          if (!rest.length) return;
          arr.splice(from, 1, bubbleSingleFromItem(rest[0].item));
          arr.splice(zone === 'before' ? from : from + 1, 0, movedStep);
          renderBubbleMore();
          return;
        }
        var target = arr[to];
        if (rest.length === 1) {
          arr.splice(from, 1, bubbleSingleFromItem(rest[0].item));
        } else {
          arr.splice(from, 1);
        }
        var ti = arr.indexOf(target);
        if (ti < 0) ti = arr.length - 1;
        var insertAt = zone === 'after' ? ti + 1 : ti;
        arr.splice(Math.max(1, Math.min(insertAt, arr.length)), 0, movedStep);
        renderBubbleMore();
      } catch (err) {}
    }
    function bubblePairDrop(from, to, zone) {
      try {
        var arr = bubbleEditItems;
        var src = arr[from];
        var dst = arr[to];
        if (!src || !dst) return;
        if (bubbleIsChoice(src)) return;
        var srcBubble = bubbleStepToBubble(src);
        if (bubbleIsChoice(dst)) {
          var sideIdx = zone === 'pairL' ? 0 : 1;
          showConfirm(wexpr((function(sideIdx){ return function(){ return wm("widget.replaceThePairedBubble") + (sideIdx === 0 ? wm("widget.aLeft") : wm("widget.bRight")) + wm("widget.withTheDraggedContent"); }; })(sideIdx)), function () {
            var d2 = arr[to];
            if (!d2 || !bubbleIsChoice(d2)) return;
            var opts2 = bubbleChoiceOptions(d2);
            if (!opts2.length) return;
            var oi3 = sideIdx < opts2.length ? sideIdx : 0;
            opts2[oi3].item = srcBubble;
            arr.splice(from, 1);
            renderBubbleMore();
          });
          return;
        }
        var dstBubble = bubbleStepToBubble(dst);
        var options = zone === 'pairL' ? [{
          w: 1,
          item: srcBubble
        }, {
          w: 1,
          item: dstBubble
        }] : [{
          w: 1,
          item: dstBubble
        }, {
          w: 1,
          item: srcBubble
        }];
        var choiceStep = {
          kind: 'choice',
          options: options
        };
        arr.splice(Math.max(from, to), 1);
        arr.splice(Math.min(from, to), 1);
        var insertAt = from < to ? to - 1 : to;
        arr.splice(Math.max(1, Math.min(insertAt, arr.length)), 0, choiceStep);
        renderBubbleMore();
      } catch (err) {}
    }
    function bubbleChoiceRowUI(row, step, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-choicerow';
      var opts = bubbleChoiceOptions(step);
      for (var s = 0; s < opts.length && s < 2; s++) {
        (function (si) {
          var opt = opts[si];
          var grp = document.createElement('div');
          grp.className = 'dshwv-choicegrp';
          var chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'dshwv-bubchip dshwv-bubchip-btn dshwv-choicechip';
          wb(chip, "textContent", (function(si){ return function(){ return (si === 0 ? 'A' : 'B') + wm("widget.editContent2"); }; })(si));
          wb(chip, "title", (function(bubbleRowLabel,opt){ return function(){ return wm("widget.editThisBubble") + bubbleRowLabel(opt.item) + wm("widget.dragItOutToSeparateIt"); }; })(bubbleRowLabel,opt));
          chip.draggable = true;
          chip.addEventListener('dragstart', function (e) {
            e.stopPropagation();
            try {
              e.dataTransfer.setData('text/plain', 'side:' + idx + ':' + si);
            } catch (err) {}
            bubbleMainDragIdx = idx;
            bubbleMainDragSide = si;
            bubbleDropZone = '';
          });
          chip.addEventListener('click', function (e) {
            e.stopPropagation();
            openBubbleItem(idx, si);
          });
          grp.appendChild(chip);
          var num = document.createElement('input');
          num.type = 'text';
          num.inputMode = 'numeric';
          num.maxLength = 2;
          num.className = 'dshwv-winput';
          num.value = String(bubbleChoiceWeight(opt));
          wb(num, "title", (function(si){ return function(){ return (si === 0 ? 'A' : 'B') + wm("widget.weight199Default11"); }; })(si));
          num.addEventListener('change', function () {
            var w = bubbleChoiceWeight({
              w: num.value
            });
            opt.w = w;
            num.value = String(w);
          });
          grp.appendChild(num);
          wrap.appendChild(grp);
        })(s);
        if (s === 0) {
          var split = document.createElement('button');
          split.type = 'button';
          split.className = 'dshwv-splitbtn';
          wb(split, "title", (function(){ return function(){ return wm("widget.separateIntoTwoBubblesEachRowCanThen"); }; })());
          var sp = document.createElement('span');
          split.appendChild(sp);
          split.addEventListener('click', function () {
            bubbleUnpairStep(idx);
          });
          wrap.appendChild(split);
        }
      }
      row.appendChild(wrap);
    }
    function bubbleDropToEnd() {
      try {
        var from = bubbleMainDragIdx;
        var side = bubbleMainDragSide;
        bubbleMainDragIdx = null;
        bubbleMainDragSide = -1;
        bubbleDropZone = '';
        var arr = bubbleEditItems;
        if (from === null || from === undefined || from < 1 || from >= arr.length) return;
        if (side >= 0) {
          var step = arr[from];
          if (!bubbleIsChoice(step)) return;
          var opts = bubbleChoiceOptions(step);
          if (side >= opts.length) return;
          var movedItem = opts[side].item || ({});
          var rest = [];
          for (var i = 0; i < opts.length; i++) if (i !== side) rest.push(opts[i]);
          if (rest.length === 1) arr.splice(from, 1, bubbleSingleFromItem(rest[0].item)); else if (rest.length >= 2) step.options = rest; else arr.splice(from, 1);
          arr.push(bubbleSingleFromItem(movedItem));
          renderBubbleMore();
          return;
        }
        if (arr.length <= 1) return;
        var removed = arr.splice(from, 1)[0];
        arr.push(removed);
        renderBubbleMore();
      } catch (err) {}
    }
    function bubbleUnpairStep(idx) {
      try {
        var arr = bubbleEditItems;
        var step = arr[idx];
        if (!bubbleIsChoice(step)) return;
        var items = bubbleChoiceOptions(step).map(function (o) {
          return bubbleStepToBubble(o.item);
        });
        if (!items.length) return;
        arr.splice(idx, 1);
        for (var i2 = items.length - 1; i2 >= 0; i2--) arr.splice(idx, 0, items[i2]);
        renderBubbleMore();
      } catch (err) {}
    }
    var bubbleMainDragIdx = null;
    var bubbleMainDragSide = -1;
    var bubbleDropZone = '';
    function renderBubbleEditor() {
      if (!bubbleEditItems.length) bubbleEditItems = [{
        kind: 'normal'
      }];
      renderBubbleFirst();
      renderBubbleMore();
    }
    function bubbleMoveMore(idx, dir) {
      var j = idx + dir;
      if (j < 1 || j >= bubbleEditItems.length) return;
      var t = bubbleEditItems[idx];
      bubbleEditItems[idx] = bubbleEditItems[j];
      bubbleEditItems[j] = t;
      renderBubbleMore();
    }
    function bubbleDelMore(idx) {
      if (bubbleEditItems.length <= 1) return;
      bubbleEditItems.splice(idx, 1);
      renderBubbleMore();
    }
    function bubbleAddMore() {
      bubbleEditItems.push({
        kind: 'custom',
        modules: []
      });
      renderBubbleMore();
    }
    var bubbleEditorSnap = null;
    function bubbleEditorDirty() {
      try {
        if (bubbleEditorSnap === null) return true;
        return bubbleEditorSnap !== JSON.stringify([bubbleEditItems, bubbleLib]);
      } catch (err) {
        return true;
      }
    }
    function openBubbleEditor() {
      if (bubbleOpening || bubbleMask.style.display === 'flex') return;
      bubbleOpening = true;
      loadBubbleCfg().then(function () {
        bubbleEditorRevision = bubbleRevision;
        buildBubbleEditor();
      }).catch(assetFailure).finally(function () { bubbleOpening = false; });
    }
    function buildBubbleEditor() {
      try {
        closeRolePanel();
        closeAudioGroupPanel();
        bubbleLib = bubbleCfg && bubbleCfg.lib && Array.isArray(bubbleCfg.lib) ? JSON.parse(JSON.stringify(bubbleCfg.lib)) : [];
        var list = [];
        if (bubbleCfg && Array.isArray(bubbleCfg.items) && bubbleCfg.items.length) {
          list = bubbleCfg.items.slice();
        } else {
          list = bubbleDefaultQueue();
        }
        bubbleEditItems = [];
        for (var k = 0; k < list.length; k++) {
          var src = list[k];
          if (src && src.kind === 'choice' && Array.isArray(src.options)) {
            var opts = [];
            for (var oi = 0; oi < src.options.length && oi < 2; oi++) {
              var oi2 = src.options[oi] || ({});
              var srcItem = oi2.item || ({});
              var srcMods = Array.isArray(srcItem.modules) ? JSON.parse(JSON.stringify(srcItem.modules)) : srcItem.kind === 'random' ? bubbleDefaultSecondModules() : [];
              opts.push(bubbleNamedItem(oi2, {
                w: bubbleChoiceWeight(oi2),
                item: bubbleNamedItem(srcItem, {
                  kind: 'custom',
                  modules: srcMods
                })
              }));
            }
            if (opts.length === 1) {
              bubbleEditItems.push(bubbleSingleFromItem(opts[0].item));
              continue;
            }
            if (opts.length >= 2) {
              bubbleEditItems.push(bubbleNamedItem(src, {
                kind: 'choice',
                options: opts
              }));
              continue;
            }
          }
          bubbleEditItems.push(bubbleNamedItem(src, {
            kind: src.kind === 'random' ? 'random' : src.kind === 'custom' ? 'custom' : 'normal',
            modules: src.modules ? JSON.parse(JSON.stringify(src.modules)) : undefined
          }));
        }
        bubbleEditorSnap = JSON.stringify([bubbleEditItems, bubbleLib]);
        renderBubbleEditor();
        bubbleMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeBubbleEditor() {
      bubbleMask.style.display = 'none';
      bubbleEditorSnap = null;
    }
    function bubbleEditorReset() {
      showConfirm(wm("widget.restoreTheDefaultSequenceBalanceThenGptAnimation"), function () {
        bubbleEditItems = bubbleDefaultQueue();
        renderBubbleEditor();
      });
    }
    function bubbleEditorSave() {
      try {
        var doSave = function () {
          var items = [];
          for (var i = 0; i < bubbleEditItems.length; i++) items.push(bubbleStepToSaved(bubbleEditItems[i]));
          saveBubbleCfg({
            expectedRevision: bubbleEditorRevision,
            v: 1,
            items: items,
            lib: bubbleLib
          }, function (ok) {
            if (ok !== false) closeBubbleEditor();
          });
        };
        if (bubbleEditorDirty()) showConfirm(wm("widget.saveThisClickSequenceUneditedRowsUseDefault"), doSave); else doSave();
      } catch (err) {}
    }
    function bubbleStepToSaved(step) {
      if (bubbleIsChoice(step)) {
        var opts = bubbleChoiceOptions(step).map(function (o) {
          var itm = o && o.item || ({});
          var mods = Array.isArray(itm.modules) ? itm.modules : bubbleDefaultModules(itm.kind === 'random' ? 'random' : 'normal');
          bubbleRowsCanon(mods);
          return bubbleNamedItem(o, {
            w: bubbleChoiceWeight(o),
            item: bubbleNamedItem(itm, {
              kind: 'custom',
              modules: mods
            })
          });
        });
        return bubbleNamedItem(step, {
          kind: 'choice',
          options: opts
        });
      }
      var mods = Array.isArray(step.modules) ? step.modules : bubbleDefaultModules(step.kind);
      bubbleRowsCanon(mods);
      return bubbleNamedItem(step, {
        kind: 'custom',
        modules: mods
      });
    }
    var bubbleItemMask = null;
    var bubbleEditItemIdx = -1;
    var bubbleEditSide = -1;
    var bubbleItemSnap = null;
    var bubbleItemTitleEl = null;
    var bubbleItemSideEl = null;
    var bubblePalEl = null;
    var bubblePvEl = null;
    function bubbleEditTarget() {
      var step = bubbleEditItems[bubbleEditItemIdx];
      if (!step) return null;
      if (bubbleIsChoice(step)) {
        var o = bubbleChoiceOptions(step)[bubbleEditSide === 0 || bubbleEditSide === 1 ? bubbleEditSide : 0];
        return o ? o.item : null;
      }
      return step;
    }
    function bubbleEditStepLabel(step, idx) {
      var base = wm("widget.click2") + (idx + 1) + wm("widget.click3");
      if (bubbleIsChoice(step)) return base + ' · ' + (bubbleEditSide === 1 ? wm("widget.bubbleB") : wm("widget.bubbleA"));
      return base;
    }
    function openBubbleItem(idx, side) {
      try {
        whaleZClean();
        var step = bubbleEditItems[idx];
        if (!step) return;
        bubbleEditItemIdx = idx;
        if (!bubbleIsChoice(step)) {
          bubbleEditSide = -1;
        } else {
          var want = side === 0 || side === 1 ? side : 0;
          if (!bubbleChoiceOptions(step)[want]) want = 0;
          bubbleEditSide = want;
        }
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        var it = bubbleEditTarget();
        if (!it) return;
        bubbleEditEnsureModules(it);
        bubbleRowsCanon(it.modules);
        wb(bubbleItemTitleEl, "textContent", (function(bubbleEditStepLabel,step,idx){ return function(){ return wm("widget.edit") + bubbleEditStepLabel(step, idx) + wm("widget.contentAddModulesBelow"); }; })(bubbleEditStepLabel,step,idx));
        renderBubbleItemSideSwitch(step);
        bubbleItemMask.style.display = 'flex';
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
    function renderBubbleItemSideSwitch(step) {
      if (!bubbleItemSideEl) return;
      bubbleItemSideEl.innerHTML = '';
      if (!bubbleIsChoice(step)) {
        bubbleItemSideEl.style.display = 'none';
        return;
      }
      bubbleItemSideEl.style.display = '';
      var opts = bubbleChoiceOptions(step);
      for (var s = 0; s < opts.length && s < 2; s++) {
        (function (si) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'dshwv-bubchip dshwv-bubchip-btn' + (si === bubbleEditSide ? ' dshwv-bubchip-cur' : '');
          wb(b, "textContent", (function(si,bubbleChoiceWeight,opts){ return function(){ return (si === 0 ? 'A' : 'B') + wm("widget.bubbleWeight") + bubbleChoiceWeight(opts[si]) + ')'; }; })(si,bubbleChoiceWeight,opts));
          wb(b, "title", (function(si){ return function(){ return wm("widget.edit3") + (si === 0 ? 'A' : 'B') + wm("widget.bubble"); }; })(si));
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            openBubbleItem(bubbleEditItemIdx, si);
          });
          bubbleItemSideEl.appendChild(b);
        })(s);
      }
    }
    function closeBubbleItem() {
      bubbleItemMask.style.display = 'none';
      bubbleEditItemIdx = -1;
      bubbleEditSide = -1;
      if (bubbleItemSideEl) bubbleItemSideEl.innerHTML = '';
    }
    var qeditEl = null;
    var qeditCtx = null;
    var QC_SCHEMES = [['macaron', wm("widget.macaron")], ['candy', wm("widget.candy")], ['rouge', wm("widget.burgundy")], ['bamboo', wm("widget.jade")], ['aurora', wm("widget.aurora")], ['deepsea', wm("widget.deepSea")], ['sunset', wm("widget.sunsetGold")], ['forest', wm("widget.forest")], ['champagne', wm("widget.champagne")], ['lavender', wm("widget.lavender")], ['mint', wm("widget.mint")], ['lava', wm("widget.lava")], ['galaxy', wm("widget.galaxy")], ['ink', wm("widget.monochrome")], ['indigo', wm("widget.indigo")]];
    function qeditEnsure() {
      if (qeditEl) return qeditEl;
      qeditEl = document.createElement('div');
      qeditEl.className = 'dshwv-qedit';
      qeditEl.style.display = 'none';
      document.body.appendChild(qeditEl);
      if (!window.__dshwQeditBound) {
        window.__dshwQeditBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!qeditEl || qeditEl.style.display === 'none') return;
          if (e.target && e.target.closest && (e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-rgbmenu') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-rgbhead') || e.target.closest('.dshwv-custbtn') || e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask'))) return;
          qeditClose();
        }, true);
        document.addEventListener('keydown', function (e) {
      if (whaleImeKey(e)) return;
          if (e.key === 'Escape') qeditClose();
        });
      }
      return qeditEl;
    }
    function qeditClose() {
      if (qeditEl) qeditEl.style.display = 'none';
      qeditCtx = null;
    }
    function qRow() {
      var d = document.createElement('div');
      d.className = 'dshwv-qedit-row';
      return d;
    }
    function qLabel(t) {
      var s = document.createElement('label');
      wb(s, "textContent", (function(t){ return function(){ return t; }; })(t));
      return s;
    }
    function qeditPlace(anchorRect, widthPx, preferAbove) {
      try {
        var vp = viewport();
        var box = qeditEl;
        var w = Math.max(180, Math.min(widthPx || 320, vp.w - 16));
        box.style.width = w + 'px';
        box.style.display = 'block';
        var h = box.offsetHeight || 200;
        var left = anchorRect.left + anchorRect.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, vp.w - w - 8));
        var top = preferAbove ? anchorRect.top - h - 8 : anchorRect.bottom + 6;
        if (preferAbove && top < 8) top = Math.min(8, anchorRect.bottom + 6);
        if (top + h > vp.h - 8) top = Math.max(8, vp.h - h - 8);
        if (top < 8) top = 8;
        box.style.left = Math.round(left) + 'px';
        box.style.top = Math.round(top) + 'px';
      } catch (err) {}
    }
    function qColorSelectBuild(current, onPick, opts) {
      opts = opts || ({});
      var allowNone = !!opts.allowNone;
      var oLabel = opts.label || wm("widget.color");
      var oHex = opts.defaultHex || gptThemeColor('ink');
      var oText = opts.defaultText || wm("widget.defaultColor");
      var row = qRow();
      row.appendChild(qLabel(oLabel));
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-rgbwrap dshwv-qcolwrap';
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      wb(head, "title", (function(){ return function(){ return wm("widget.colorSolidOrAnimatedGradient"); }; })());
      wrap.appendChild(head);
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-qcolmenu';
      wrap.appendChild(menu);
      var sw = document.createElement('span');
      sw.className = 'dshwv-qcolorhost';
      function modeOf(v) {
        if (v === 'none') return allowNone ? 'none' : 'solid';
        if (v === 'solid' || isScheme(v)) return v;
        return allowNone ? 'none' : 'solid';
      }
      var curMode = modeOf(current);
      function isScheme(v) {
        for (var i = 0; i < QC_SCHEMES.length; i++) if (QC_SCHEMES[i][0] === v) return true;
        return false;
      }
      function labelOf(v) {
        if (v === 'none') return wm("widget.none");
        if (v === 'solid') return wm("widget.solid");
        for (var i = 0; i < QC_SCHEMES.length; i++) if (QC_SCHEMES[i][0] === v) return QC_SCHEMES[i][1];
        return allowNone ? wm("widget.none") : wm("widget.solid");
      }
      function renderSolid(hex, onSet) {
        sw.innerHTML = '';
        var ci = document.createElement('input');
        ci.type = 'color';
        ci.value = hex;
        wb(ci, "title", (function(){ return function(){ return wm("widget.chooseSolidColor"); }; })());
        ci.addEventListener('input', function () {
          if (onSet) onSet(ci.value);
        });
        ci.addEventListener('change', function () {
          if (onSet) onSet(ci.value);
        });
        sw.appendChild(ci);
        var def = document.createElement('button');
        def.type = 'button';
        def.className = 'dshwv-bubmini';
        wb(def, "textContent", (function(oText){ return function(){ return oText; }; })(oText));
        wb(def, "title", (function(oText){ return function(){ return wm("widget.restore") + oText + wm("widget.colorValue"); }; })(oText));
        def.style.width = 'auto';
        def.style.padding = '0 6px';
        def.addEventListener('click', function () {
          if (onSet) onSet(oHex);
        });
        sw.appendChild(def);
      }
      function fill() {
        menu.innerHTML = '';
        function add(v, lab) {
          var o = document.createElement('div');
          o.className = 'dshwv-rgbopt' + (v === curMode ? ' dshwv-rgbcur' : '');
          if (v !== 'solid' && v !== 'none') {
            o.classList.add('optgrad');
            o.classList.add('opt-' + v);
          }
          wb(o, 'textContent', (function(value,label){return function(){return (value === curMode ? '✓ ' : '') + label;};})(v,lab));
          o.addEventListener('click', function () {
            curMode = v;
            closeMenu();
            if (onPick) onPick(v);
          });
          menu.appendChild(o);
        }
        if (allowNone) add('none', wm("widget.none"));
        add('solid', wm("widget.solid"));
        for (var i = 0; i < QC_SCHEMES.length; i++) add(QC_SCHEMES[i][0], QC_SCHEMES[i][1]);
      }
      var hexSetter = null;
      function sync(mode, hex, onSet) {
        curMode = modeOf(mode);
        hexSetter = onSet || null;
        wb(head, "textContent", (function(labelOf,curMode){ return function(){ return labelOf(curMode); }; })(labelOf,curMode));
        if (curMode === 'solid') renderSolid(hex || oHex, function (h) {
          if (hexSetter) hexSetter(h);
        }); else sw.innerHTML = '';
        fill();
      }
      function closeMenu() {
        menu.classList.remove('dshwv-rgbopen');
        bubbleColorOpenMenu = null;
      }
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        if (bubbleColorOpenMenu === menu) {
          closeMenu();
          return;
        }
        if (bubbleColorOpenMenu) bubbleColorOpenMenu.classList.remove('dshwv-rgbopen');
        fill();
        bubbleColorOpenMenu = menu;
        dshwDropOpen(menu, head);
      });
      if (!window.__dshwColorBound) {
        window.__dshwColorBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!bubbleColorOpenMenu) return;
          try {
            if (e.target && e.target.closest && (e.target.closest('.dshwv-qcolwrap') || e.target.closest('.dshwv-rgbmenu'))) return;
          } catch (err) {}
          bubbleColorOpenMenu.classList.remove('dshwv-rgbopen');
          bubbleColorOpenMenu = null;
        }, true);
      }
      row.appendChild(wrap);
      row.appendChild(sw);
      fill();
      return {
        row: row,
        sync: sync
      };
    }
    function qStyleChecksBuild(getBool, setBool) {
      var row = qRow();
      [[wm("widget.bold"), 'bold'], [wm("widget.italic"), 'italic'], [wm("widget.underline"), 'ul']].forEach(function (item) {
        var lab = document.createElement('label');
        lab.style.display = 'inline-flex';
        lab.style.alignItems = 'center';
        lab.style.gap = '3px';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!getBool(item[1]);
        cb.addEventListener('change', function () {
          setBool(item[1], cb.checked);
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(item[0]));
        row.appendChild(lab);
      });
      return row;
    }
    function openQuickTextEditor(m) {
      if (!m || m.type !== 'text' && m.type !== 'link') return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      qeditCtx = {
        kind: m.type === 'link' ? 'link' : 'text',
        m: m
      };
      function changed() {
        try {
          renderBubblePv();
        } catch (err) {}
      }
      var r0 = qRow();
      r0.appendChild(qLabel(m.type === 'link' ? wm("widget.linkText") : wm("widget.content")));
      var tx = document.createElement('input');
      tx.type = 'text';
      tx.maxLength = 60;
      tx.className = 'dshwv-qedit-content';
      tx.value = localizedModuleField(m, 'text');
      tx.addEventListener('input', function () {
        m.text = tx.value || ' '; delete m.i18nKey;
        changed();
      });
      r0.appendChild(tx);
      box.appendChild(r0);
      if (m.type === 'link') {
        var rUrl = qRow();
        rUrl.appendChild(qLabel(wm("widget.link2")));
        var uInp = document.createElement('input');
        uInp.type = 'text';
        uInp.className = 'dshwv-qedit-content';
        uInp.value = m.url || '';
        uInp.placeholder = 'https:// …';
        wb(uInp, "title", (function(){ return function(){ return wm("widget.opensOnClickMustStartWithHttpOr"); }; })());
        uInp.addEventListener('input', function () {
          m.url = uInp.value || '';
        });
        rUrl.appendChild(uInp);
        box.appendChild(rUrl);
      }
      box.appendChild(bubbleFontEditRow(function () {
        return m.fontFamily || '';
      }, function (v) {
        m.fontFamily = v || '';
        changed();
      }));
      var r1 = qRow();
      r1.appendChild(qLabel(wm("widget.fontSize")));
      var sz = document.createElement('input');
      sz.type = 'range';
      sz.min = '1';
      sz.max = '50';
      sz.step = '1';
      sz.className = 'dshwv-range';
      sz.style.flex = '1';
      sz.value = String(Math.max(1, Math.min(50, Math.round(Number(m.size) || 6))));
      var szNum = document.createElement('span');
      szNum.className = 'dshwv-volpct';
      szNum.textContent = sz.value;
      sz.addEventListener('input', function () {
        m.size = Math.round(Number(sz.value) || 3);
        szNum.textContent = sz.value;
        changed();
      });
      r1.appendChild(sz);
      r1.appendChild(szNum);
      box.appendChild(r1);
      box.appendChild(qStyleChecksBuild(function (k) {
        return m[k] === true;
      }, function (k, v) {
        m[k] = v;
        changed();
      }));
      var grpT = document.createElement('div');
      grpT.className = 'dshwv-stylerow';
      var curColor = m.rgb ? m.rgb : 'solid';
      var cc = qColorSelectBuild(curColor, function (v) {
        onPick(v);
      });
      grpT.appendChild(cc.row);
      function onPick(v) {
        if (v === 'solid') {
          m.rgb = '';
          if (!m.color) m.color = gptThemeColor('ink');
        } else {
          m.rgb = v;
          m.color = '';
        }
        cc.sync(v === 'solid' ? 'solid' : v, m.color, function (hex) {
          m.color = hex;
          changed();
        });
        changed();
      }
      var bgCurT = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
      var bgt = qColorSelectBuild(bgCurT, function (v) {
        if (v === 'none') {
          m.bgRgb = '';
          m.bg = '';
        } else if (v === 'solid') {
          m.bgRgb = '';
          if (!m.bg) m.bg = gptThemeColor('tint');
        } else {
          m.bgRgb = v;
          m.bg = '';
        }
        bgt.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
          m.bg = hex;
          changed();
        });
        changed();
      }, {
        label: wm("widget.background"),
        defaultHex: gptThemeColor('tint'),
        defaultText: wm("widget.default"),
        allowNone: true
      });
      grpT.appendChild(bgt.row);
      box.appendChild(grpT);
      cc.sync(curColor, m.color || gptThemeColor('ink'), function (hex) {
        m.color = hex;
        changed();
      });
      bgt.sync(bgCurT, m.bg || gptThemeColor('tint'), function (hex) {
        m.bg = hex;
        changed();
      });
      try {
        var pr = bubblePvPrevEl.getBoundingClientRect();
        qeditPlace(pr, Math.max(230, Math.round(pr.width - 24)), true);
      } catch (err) {
        qeditPlace({
          left: 40,
          right: 360,
          top: 200,
          bottom: 300,
          width: 320
        }, 320, false);
      }
    }
    function openQuickModuleEditor(m) {
      if (!m || m.type === 'image' || m.type === 'random' || m.type === 'text') return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      qeditCtx = {
        kind: 'module',
        m: m
      };
      function changed() {
        try {
          renderBubblePv();
        } catch (err) {}
      }
      function sizeRow() {
        var r = qRow();
        r.appendChild(qLabel(wm("widget.fontSize")));
        var sz = document.createElement('input');
        sz.type = 'range';
        sz.min = '1';
        sz.max = '50';
        sz.step = '1';
        sz.className = 'dshwv-range';
        sz.style.flex = '1';
        sz.value = String(Math.max(1, Math.min(50, Math.round(Number(m.size) || 6))));
        var num = document.createElement('span');
        num.className = 'dshwv-volpct';
        num.textContent = sz.value;
        sz.addEventListener('input', function () {
          m.size = Math.round(Number(sz.value) || 3);
          num.textContent = sz.value;
          changed();
        });
        r.appendChild(sz);
        r.appendChild(num);
        box.appendChild(r);
      }
      function glyphRow() {
        box.appendChild(qStyleChecksBuild(function (k) {
          return m[k] === true;
        }, function (k, v) {
          m[k] = v;
          changed();
        }));
      }
      function tplRow() {
        var r = qRow();
        r.appendChild(qLabel(wm("widget.content")));
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'dshwv-qedit-content';
        inp.value = localizedModuleField(m, 'tpl');
        wb(inp, "placeholder", (function(m){ return function(){ return m.type === 'balance' ? wm("widget.exampleBalanceApi") : m.type === 'today' ? wm("widget.exampleObservedTodayExpenseApi") : wm("widget.exampleCurrentStatus"); }; })(m));
        wb(inp, "title", (function(m){ return function(){ return wm("widget.availablePlaceholders") + (m.type === 'balance' ? '{balance_api}' : '{expense_api}'); }; })(m));
        inp.addEventListener('input', function () {
          m.tpl = inp.value; delete m.tplI18nKey;
          changed();
        });
        r.appendChild(inp);
        var qb2 = document.createElement('button');
        qb2.type = 'button';
        qb2.className = 'dshwv-tplq';
        qb2.textContent = '?';
        wb(qb2, "title", (function(){ return function(){ return wm("widget.placeholderHelp"); }; })());
        qb2.style.marginLeft = '4px';
        qb2.addEventListener('click', function (e) {
          e.stopPropagation();
          bubbleTplHelpToggle(m, qb2);
        });
        r.appendChild(qb2);
        box.appendChild(r);
      }
      tplRow();
      {
        box.appendChild(bubbleFontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
          changed();
        }));
        sizeRow();
        glyphRow();
        var grp2 = document.createElement('div');
        grp2.className = 'dshwv-stylerow';
        var curC = m.rgb ? m.rgb : 'solid';
        var ccA = qColorSelectBuild(curC, function (v) {
          if (v === 'solid') {
            m.rgb = '';
            if (!m.color) m.color = gptThemeColor('ink');
          } else {
            m.rgb = v;
            m.color = '';
          }
          ccA.sync(v === 'solid' ? 'solid' : v, m.color, function (hex) {
            m.color = hex;
            changed();
          });
          changed();
        });
        grp2.appendChild(ccA.row);
        var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
        var bgcA = qColorSelectBuild(bgCur, function (v) {
          if (v === 'none') {
            m.bgRgb = '';
            m.bg = '';
          } else if (v === 'solid') {
            m.bgRgb = '';
            if (!m.bg) m.bg = gptThemeColor('tint');
          } else {
            m.bgRgb = v;
            m.bg = '';
          }
          bgcA.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
            m.bg = hex;
            changed();
          });
          changed();
        }, {
          label: wm("widget.background"),
          defaultHex: gptThemeColor('tint'),
          defaultText: wm("widget.default"),
          allowNone: true
        });
        grp2.appendChild(bgcA.row);
        box.appendChild(grp2);
        ccA.sync(curC, m.color || gptThemeColor('ink'), function (hex) {
          m.color = hex;
          changed();
        });
        bgcA.sync(bgCur, m.bg || gptThemeColor('tint'), function (hex) {
          m.bg = hex;
          changed();
        });
      }
      try {
        var pr = bubblePvPrevEl.getBoundingClientRect();
        qeditPlace(pr, Math.max(260, Math.round(pr.width - 16)), true);
      } catch (err) {
        qeditPlace({
          left: 40,
          right: 360,
          top: 200,
          bottom: 300,
          width: 320
        }, 320, false);
      }
    }
    function openQuickSentenceEditor(line, mod, rowTx, anchorBtn) {
      if (!line) return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      qeditCtx = {
        kind: 'line',
        line: line,
        mod: mod
      };
      function lv(lk, mk, dft) {
        var v = line[lk];
        if (v !== undefined && v !== null) return v;
        var mv = mod[lk];
        if (mv !== undefined && mv !== null) return mv;
        return dft;
      }
      var r0 = qRow();
      r0.appendChild(qLabel(wm("widget.sentence")));
      var tx = document.createElement('input');
      tx.type = 'text';
      tx.className = 'dshwv-qedit-content';
      tx.value = line.t || '';
      tx.addEventListener('input', function () {
        line.t = tx.value || ' ';
        try {
          if (rowTx) rowTx.value = tx.value || '';
        } catch (err) {}
      });
      r0.appendChild(tx);
      box.appendChild(r0);
      box.appendChild(bubbleFontEditRow(function () {
        return lv('fontFamily', 'fontFamily', '') || '';
      }, function (v) {
        line.fontFamily = v || '';
      }));
      var r1 = qRow();
      r1.appendChild(qLabel(wm("widget.fontSize")));
      var sz = document.createElement('input');
      sz.type = 'range';
      sz.min = '1';
      sz.max = '50';
      sz.step = '1';
      sz.className = 'dshwv-range';
      sz.style.flex = '1';
      sz.value = String(Math.max(1, Math.min(50, Math.round(Number(lv('size', 'size', 6))))));
      var szNum = document.createElement('span');
      szNum.className = 'dshwv-volpct';
      szNum.textContent = sz.value;
      sz.addEventListener('input', function () {
        line.size = Math.round(Number(sz.value) || 3);
        szNum.textContent = sz.value;
      });
      r1.appendChild(sz);
      r1.appendChild(szNum);
      box.appendChild(r1);
      box.appendChild(qStyleChecksBuild(function (k) {
        return !!lv(k, k, false);
      }, function (k, v) {
        line[k] = v;
      }));
      var curColor = lv('rgb', 'rgb', '') || 'solid';
      var cc = qColorSelectBuild(curColor, function (v) {
        onPick(v);
      });
      box.appendChild(cc.row);
      function onPick(v) {
        if (v === 'solid') {
          line.rgb = '';
          if (!line.color) line.color = gptThemeColor('ink');
        } else {
          line.rgb = v;
          line.color = '';
        }
        cc.sync(v === 'solid' ? 'solid' : v, line.color, function (hex) {
          line.color = hex;
        });
      }
      cc.sync(curColor, line.color || mod.color || gptThemeColor('ink'), function (hex) {
        line.color = hex;
      });
      var lineBgV = line.bgRgb ? line.bgRgb : line.bg ? 'solid' : mod.bgRgb ? mod.bgRgb : mod.bg ? 'solid' : 'none';
      var lineBgHex0 = line.bg || mod.bg || gptThemeColor('tint');
      var bgcc2 = qColorSelectBuild(lineBgV, function (v) {
        if (v === 'none') {
          line.bgRgb = '';
          line.bg = '';
        } else if (v === 'solid') {
          line.bgRgb = '';
          if (!line.bg) line.bg = lineBgHex0;
        } else {
          line.bgRgb = v;
          line.bg = '';
        }
        bgcc2.sync(v === 'none' ? 'none' : v, line.bg || lineBgHex0, function (h) {
          line.bg = h;
        });
      }, {
        label: wm("widget.background"),
        defaultHex: lineBgHex0,
        defaultText: wm("widget.default"),
        allowNone: true
      });
      box.appendChild(bgcc2.row);
      bgcc2.sync(lineBgV, lineBgHex0, function (h) {
        line.bg = h;
      });
      var r = anchorBtn ? anchorBtn.getBoundingClientRect() : {
        left: 40,
        right: 360,
        top: 200,
        bottom: 260,
        width: 320
      };
      qeditPlace(r, 340, false);
    }
    function renderBubblePal() {
      bubblePalEl.innerHTML = '';
      var defs = [{
        key: 'text',
        label: wm("widget.text2"),
        cb: function () {
          bubbleModuleAdd({
            type: 'text',
            text: wm("widget.newContent"),
            size: 6,
            bold: true
          });
        }
      }, {
        key: 'balance',
        label: wm("widget.balanceAmount"),
        pin: true,
        cb: function () {
          bubbleModuleAdd({
            type: 'balance',
            size: 11,
            tpl: '{balance_api}'
          });
        }
      }, {
        key: 'today',
        label: wm("widget.observedToday2"),
        pin: true,
        cb: function () {
          bubbleModuleAdd({
            type: 'today',
            size: 1,
            tpl: "今日已观测 {expense_api}",
        tplI18nKey: "widget.observedTodayExpenseApi"
          });
        }
      }, {
        key: 'random',
        label: wm("widget.customRandomText"),
        cb: function () {
          bubbleModuleAdd({type:'random',lines:[],size:8});
        }
      }, {
        key: 'link',
        label: wm("widget.link3"),
        cb: function () {
          bubbleModuleAdd(bubblePaletteModule('link'));
        }
      }, {
        key: 'image',
        label: wm("widget.imageAnimation"),
        cb: function () {
          bubblePickImageToAdd();
        }
      }];
      for (var i = 0; i < defs.length; i++) {
        (function (d) {
          var chip = document.createElement('div');
          chip.className = 'dshwv-palchip';
          wb(chip, "textContent", (function(d){ return function(){ return d.label; }; })(d));
          wb(chip, "title", (function(d){ return function(){ return d.pin ? wm("widget.builtInValueContentIsAutomatic") : wm("widget.addToBubble"); }; })(d));
          chip.draggable = true;
          chip.addEventListener('click', function (e) {
            e.stopPropagation();
            d.cb();
          });
          chip.addEventListener('dragstart', function (e) {
            try {
              e.dataTransfer.setData('text/plain', d.key);
            } catch (err) {}
            bubbleDragKey = d.key;
          });
          bubblePalEl.appendChild(chip);
        })(defs[i]);
      }
      for (var li = 0; li < bubbleLib.length; li++) {
        (function (lb) {
          var chip = document.createElement('div');
          chip.className = 'dshwv-libchip';
          wb(chip, "title", (function(lb){ return function(){ return wm("widget.addFromModuleLibrary") + lb.name; }; })(lb));
          var body = document.createElement('div');
          body.className = 'dshwv-palchip';
          body.textContent = '▦ ' + lb.name;
          body.draggable = true;
          body.addEventListener('click', function (e) {
            e.stopPropagation();
            bubbleModuleAdd(bubbleCloneModule(lb.module));
          });
          body.addEventListener('dragstart', function (e) {
            try {
              e.dataTransfer.setData('text/plain', 'lib:' + lb.id);
            } catch (err) {}
            bubbleDragKey = 'lib:' + lb.id;
          });
          chip.appendChild(body);
          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'dshwv-libdel';
          del.textContent = '✕';
          wb(del, "title", (function(lb){ return function(){ return wm("widget.removeFromModuleLibrary") + lb.name; }; })(lb));
          del.addEventListener('click', function (e) {
            e.stopPropagation();
            showDeleteConfirm(wexpr((function(lb){ return function(){ return wm("widget.removeModule") + lb.name + '」?'; }; })(lb)), function () {
              bubbleLibDel(lb.id);
              if (bubblePalEl) renderBubblePal();
            });
          });
          chip.appendChild(del);
          bubblePalEl.appendChild(chip);
        })(bubbleLib[li]);
      }
      var newChip = document.createElement('div');
      newChip.className = 'dshwv-paladd';
      wb(newChip, "textContent", (function(){ return function(){ return wm("widget.newModule"); }; })());
      wb(newChip, "title", (function(){ return function(){ return wm("widget.chooseAModuleTypeTextCustomRandomText"); }; })());
      newChip.draggable = true;
      newChip.addEventListener('click', function (e) {
        e.stopPropagation();
        bubbleModuleWizard();
      });
      newChip.addEventListener('dragstart', function (e) {
        try {
          e.dataTransfer.setData('text/plain', 'wizard');
        } catch (err) {}
        bubbleDragKey = 'wizard';
      });
      bubblePalEl.appendChild(newChip);
    }
    function bubbleModuleWizard() {
      bubbleModuleAdd({
        type: 'text',
        text: wm("widget.newContent"),
        size: 6,
        bold: true
      });
    }
    function bubbleLibById(id) {
      for (var i = 0; i < bubbleLib.length; i++) if (bubbleLib[i].id === id) return bubbleLib[i];
      return null;
    }
    var bubbleDragKey = null;
    function bubbleItemHasImage() {
      try {
        var it = bubbleEditTarget();
        if (!it || !it.modules) return false;
        for (var i = 0; i < it.modules.length; i++) if (it.modules[i] && it.modules[i].type === 'image') return true;
      } catch (err) {}
      return false;
    }
    function bubbleWarnOneImage() {
      showConfirm(wm("widget.aBubbleSupportsOneImageEditOrRemove"), function () {}, wm("widget.gotIt"));
    }
    function bubbleModuleAdd(m) {
      try {
        var it = bubbleEditTarget();
        if (!it) return;
        if (!it.modules) it.modules = [];
        if (m && m.type === 'image' && bubbleItemHasImage()) {
          bubbleWarnOneImage();
          return;
        }
        if (bubbleRowsOf(it.modules).length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn(wm("widget.aBubbleSupportsAtMost") + BUBBLE_PV_ROW_MAX + wm("widget.rowsCannotAddAnotherRow"));
          return;
        }
        it.modules.push(m);
        renderBubblePv();
      } catch (err) {}
    }
    function bubbleModuleNew(m) {
      openModuleEditor(m, function (saved) {
        if (saved) bubbleModuleAdd(saved);
      });
    }
    function bubblePickImageToAdd() {
      if (bubbleItemHasImage()) {
        bubbleWarnOneImage();
        return;
      }
      bubbleModuleNew({
        type: 'image',
        imgId: '',
        size: 6
      });
    }
    var BUBBLE_PV_ROW_MAX = 6;
    var BUBBLE_PV_MOD_MAX = 6;
    var bubbleModDrag = null;
    var bubblePvZone = '';
    function bubblePvWarn(msg) {
      showConfirm(msg, function () {}, wm("widget.gotIt"));
    }
    function bubblePvRowModel() {
      var it = bubbleEditTarget();
      if (!it || !Array.isArray(it.modules)) return [];
      return bubbleRowsOf(it.modules);
    }
    function bubblePvRowCommit(rows) {
      var it = bubbleEditTarget();
      if (!it) return;
      it.modules = bubbleRowsFlat(rows);
      renderBubblePv();
    }
    function bubbleModuleEdit(m) {
      try {
        if (m && (m.type === 'text' || m.type === 'link')) {
          openQuickTextEditor(m);
          return;
        }
        if (m && (m.type === 'balance' || m.type === 'today')) {
          openQuickModuleEditor(m);
          return;
        }
        openModuleEditor(m, function (saved) {
          if (saved) renderBubblePv();
        });
      } catch (err) {}
    }
    function bubblePvDelBlock(ri, mi) {
      var rows = bubblePvRowModel();
      if (!rows[ri] || mi >= rows[ri].length) return;
      rows[ri].splice(mi, 1);
      if (!rows[ri].length) rows.splice(ri, 1);
      bubblePvRowCommit(rows);
    }
    function bubblePvMoveRow(fromRow, toRow, zone) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length || toRow < 0 || toRow >= rows.length || fromRow === toRow) return;
      var target = rows[toRow];
      var moved = rows.splice(fromRow, 1)[0];
      var t = rows.indexOf(target);
      if (t < 0) {
        rows.push(moved);
        bubblePvRowCommit(rows);
        return;
      }
      rows.splice(zone === 'after' ? t + 1 : t, 0, moved);
      bubblePvRowCommit(rows);
    }
    function bubblePvDropBlock(riFrom, miFrom, riTarget, zone) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[riFrom] || miFrom >= rows[riFrom].length || !rows[riTarget]) return;
        var m = rows[riFrom][miFrom];
        if (!m || typeof m !== 'object') return;
        var tRow = rows[riTarget];
        var imageInvolved = m.type === 'image' || tRow[0] && tRow[0].type === 'image';
        if (imageInvolved && (zone === 'pairL' || zone === 'pairR')) zone = 'before';
        rows[riFrom].splice(miFrom, 1);
        if (!rows[riFrom].length) rows.splice(riFrom, 1);
        var tIdx = -1;
        for (var i = 0; i < rows.length; i++) if (rows[i] === tRow) {
          tIdx = i;
          break;
        }
        if (tIdx >= 0 && (zone === 'pairL' || zone === 'pairR')) {
          var tgt = rows[tIdx];
          if (m.type !== 'image' && !(tgt[0] && tgt[0].type === 'image')) {
            if (tgt.length >= BUBBLE_PV_MOD_MAX) {
              bubblePvWarn(wm("widget.eachRowSupportsAtMost") + BUBBLE_PV_MOD_MAX + wm("widget.modulesCannotCombineMore"));
              return;
            }
            tgt.splice(zone === 'pairL' ? 0 : tgt.length, 0, m);
            bubblePvRowCommit(rows);
            return;
          }
          zone = 'before';
        }
        if (rows.length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn(wm("widget.aBubbleSupportsAtMost") + BUBBLE_PV_ROW_MAX + wm("widget.rowsCannotSplitIntoAnotherRow"));
          return;
        }
        var at = tIdx >= 0 ? zone === 'after' ? tIdx + 1 : tIdx : Math.min(riFrom, rows.length);
        rows.splice(at, 0, [m]);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
    function bubblePvDropBlockEnd(riFrom, miFrom) {
      var rows = bubblePvRowModel();
      if (!rows[riFrom] || miFrom >= rows[riFrom].length) return;
      var m = rows[riFrom][miFrom];
      rows[riFrom].splice(miFrom, 1);
      if (!rows[riFrom].length) rows.splice(riFrom, 1);
      if (rows.length >= BUBBLE_PV_ROW_MAX) {
        bubblePvWarn(wm("widget.aBubbleSupportsAtMost") + BUBBLE_PV_ROW_MAX + wm("widget.rowsCannotCreateAnotherRow"));
        return;
      }
      rows.push([m]);
      bubblePvRowCommit(rows);
    }
    function bubblePvMoveRowEnd(fromRow) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length) return;
      rows.push(rows.splice(fromRow, 1)[0]);
      bubblePvRowCommit(rows);
    }
    function bubblePvAddToRow(ri) {
      var rows = bubblePvRowModel();
      if (!rows[ri]) return;
      if (rows[ri].length >= BUBBLE_PV_MOD_MAX) {
        bubblePvWarn(wm("widget.eachRowSupportsAtMost") + BUBBLE_PV_MOD_MAX + wm("widget.modules2"));
        return;
      }
      rows[ri].push({
        type: 'text',
        text: wm("widget.newContent"),
        size: 6,
        bold: true
      });
      bubblePvRowCommit(rows);
    }
    function bubblePvPaletteToRow(key, ri) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[ri]) return;
        var tgt = rows[ri];
        if (tgt[0] && tgt[0].type === 'image') {
          bubblePvWarn(wm("widget.thisImageOccupiesAWholeRowDragInto"));
          return;
        }
        if (key === 'image') {
          bubblePvWarn(wm("widget.imagesOccupyAWholeRowDragIntoThe"));
          return;
        }
        if (key === 'wizard') key = 'text';
        var m = bubblePaletteModule(key);
        if (!m) return;
        if (tgt.length >= BUBBLE_PV_MOD_MAX) {
          bubblePvWarn(wm("widget.eachRowSupportsAtMost") + BUBBLE_PV_MOD_MAX + wm("widget.modulesCannotAddMore"));
          return;
        }
        tgt.push(m);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
    function bubblePaletteModule(key) {
      if (key === 'text') return {
        type: 'text',
        text: wm("widget.newContent"),
        size: 6,
        bold: true
      };
      if (key === 'balance') return {
        type: 'balance',
        size: 11,
        tpl: '{balance_api}'
      };
      if (key === 'today') return {
        type: 'today',
        size: 1,
        tpl: "今日已观测 {expense_api}",
        tplI18nKey: "widget.observedTodayExpenseApi"
      };
      if (key === 'link') return {
        type: 'link',
        text: wm("widget.openLink"),
        url: '',
        size: 6,
        color: gptThemeColor('accent-strong')
      };
      if (key === 'random') return {type:'random',lines:[],size:8};
      if (typeof key === 'string' && key.indexOf('lib:') === 0) {
        var lb = bubbleLibById(key.slice(4));
        return lb ? bubbleCloneModule(lb.module) : null;
      }
      return null;
    }
    function bubblePvFont(level) {
      var mult = bubbleModuleFontU(level);
      return Math.max(10, Math.round(mult * 0.42));
    }
    function renderBubblePv() {
      bubblePvEl.innerHTML = '';
      var it = bubbleEditTarget();
      if (!it) return;
      var rows = bubbleRowsOf(it.modules || []);
      for (var r = 0; r < rows.length; r++) {
        (function (ri, rowMods) {
          var isImgRow = !!(rowMods[0] && rowMods[0].type === 'image');
          var bar = document.createElement('div');
          bar.className = 'dshwv-pvrow dshwv-pvrowline';
          wb(bar, "title", (function(isImgRow){ return function(){ return isImgRow ? wm("widget.imageRowDragToReorder") : wm("widget.upTo6ModulesPerRowDragTo"); }; })(isImgRow));
          var grip = document.createElement('span');
          grip.className = 'dshwv-pvdrag';
          grip.textContent = '⠿';
          wb(grip, "title", (function(){ return function(){ return wm("widget.dragToReorderTheRow"); }; })());
          grip.draggable = true;
          grip.addEventListener('dragstart', function (e) {
            e.stopPropagation();
            try {
              e.dataTransfer.setData('text/plain', 'prow:' + ri);
            } catch (err) {}
            bubbleRowDragIdx = ri;
            bubbleModDrag = null;
            bubblePvZone = '';
          });
          grip.addEventListener('dragend', function () {
            bubbleRowDragIdx = null;
            bubblePvZone = '';
          });
          bar.appendChild(grip);
          for (var mi = 0; mi < rowMods.length; mi++) {
            (function (m, mIdx) {
              var blk = document.createElement('div');
              blk.className = 'dshwv-pvmod' + (m.type === 'image' ? ' dshwv-pvimg' : '');
              blk.draggable = true;
              wb(blk, "title", (function(isImgRow){ return function(){ return isImgRow ? wm("widget.imageAnimationOccupiesAWholeRow") : wm("widget.dragToARowSLeftRightEdge"); }; })(isImgRow));
              blk.addEventListener('dragstart', function (e) {
                e.stopPropagation();
                try {
                  e.dataTransfer.setData('text/plain', 'mod:' + ri + ':' + mIdx);
                } catch (err) {}
                bubbleRowDragIdx = null;
                bubbleModDrag = {
                  ri: ri,
                  mi: mIdx
                };
                bubblePvZone = '';
              });
              blk.addEventListener('dragend', function () {
                bubbleModDrag = null;
                bubblePvZone = '';
              });
              var lab = document.createElement('span');
              lab.className = 'dshwv-pvlab';
              wb(lab, 'textContent', (function(module){return function(){return bubbleModuleListLabel(module);};})(m));
              wb(lab, "title", (function(){ return function(){ return wm("widget.editModuleContentAndStyle"); }; })());
              lab.addEventListener('click', function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              });
              blk.appendChild(lab);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              wb(ed, "title", (function(){ return function(){ return wm("widget.editModuleContentAndStyle2"); }; })());
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              });
              blk.appendChild(ed);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-bubmini';
              del.textContent = '✕';
              wb(del, "title", (function(){ return function(){ return wm("widget.deleteModule"); }; })());
              del.addEventListener('click', function (e) {
                e.stopPropagation();
                bubblePvDelBlock(ri, mIdx);
              });
              blk.appendChild(del);
              bar.appendChild(blk);
            })(rowMods[mi], mi);
          }
          if (!isImgRow) {
            var add = document.createElement('button');
            add.type = 'button';
            add.className = 'dshwv-pvadd';
            add.textContent = '+';
            wb(add, "title", (function(){ return function(){ return wm("widget.addTextToThisRowDragOtherModule"); }; })());
            add.addEventListener('click', function (e) {
              e.stopPropagation();
              bubblePvAddToRow(ri);
            });
            bar.appendChild(add);
          }
          function highlight(zone) {
            bubblePvZone = zone;
            bar.style.boxShadow = '';
            bar.style.outline = '';
            if (zone === 'join') bar.style.outline = '2px solid rgba(var(--gpt-ink-rgb),.55)'; else {
              var sh = bubbleDropShadow(zone);
              if (sh) bar.style.boxShadow = sh;
            }
          }
          bar.addEventListener('dragover', function (e) {
            try {
              var isMod = !!bubbleModDrag;
              var isRow = bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined;
              var isPal = !isMod && !isRow && !!bubbleDragKey;
              if (!isMod && !isRow && !isPal) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              var rc = bar.getBoundingClientRect();
              if (!rc.width) return;
              if (isPal) {
                highlight('join');
                return;
              }
              var x = e.clientX - rc.left;
              if (isMod && x < rc.width * 0.2) {
                highlight('pairL');
                return;
              }
              if (isMod && x > rc.width * 0.8) {
                highlight('pairR');
                return;
              }
              highlight(e.clientY - rc.top < rc.height / 2 ? 'before' : 'after');
            } catch (err) {}
          });
          bar.addEventListener('dragleave', function () {
            bubblePvZone = '';
            bar.style.boxShadow = '';
            bar.style.outline = '';
          });
          bar.addEventListener('drop', function (e) {
            try {
              e.preventDefault();
              e.stopPropagation();
              var zone = bubblePvZone;
              bubblePvZone = '';
              bar.style.boxShadow = '';
              bar.style.outline = '';
              if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
                var fromRow = bubbleRowDragIdx;
                bubbleRowDragIdx = null;
                if (fromRow !== ri) bubblePvMoveRow(fromRow, ri, zone);
                return;
              }
              if (bubbleModDrag) {
                var md = bubbleModDrag;
                bubbleModDrag = null;
                if (zone === 'join') zone = 'after';
                bubblePvDropBlock(md.ri, md.mi, ri, zone);
                return;
              }
              if (bubbleDragKey) {
                var key = bubbleDragKey;
                bubbleDragKey = null;
                bubblePvPaletteToRow(key, ri);
                return;
              }
            } catch (err) {}
          });
          bubblePvEl.appendChild(bar);
        })(r, rows[r]);
      }
      try {
        var rw = root && (root.offsetWidth || root.getBoundingClientRect().width) || 280;
        bubblePreviewInto(bubblePvPrevEl, it.modules || [], Math.min(rw, 408));
      } catch (err) {}
    }
    var bubbleRowDragIdx = null;
    function bubbleItemDiscard() {
      try {
        var idx = bubbleEditItemIdx;
        var snap = bubbleItemSnap;
        bubbleItemSnap = null;
        if (idx >= 0 && idx < bubbleEditItems.length && snap) bubbleEditItems[idx] = snap;
      } catch (err) {}
      closeBubbleItem();
      renderBubbleFirst();
      renderBubbleMore();
    }
    function bubbleItemSave() {
      showConfirm(wm("widget.saveThisBubbleSContent"), function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = 'custom';
          if (!it.modules) it.modules = [];
        }
        bubbleItemSnap = null;
        closeBubbleItem();
        renderBubbleFirst();
        renderBubbleMore();
      });
    }
    function bubbleItemResetToDefault() {
      showConfirm(wm("widget.restoreThisBubbleSDefaultContent"), function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = it.kind === 'random' ? 'random' : 'normal';
          it.modules = undefined;
          bubbleEditEnsureModules(it);
        }
        renderBubblePv();
      });
    }
    bubbleMask = document.createElement('div');
    bubbleMask.className = 'dshwv-bubmask';
    bubbleMask.style.display = 'none';
    var bubbleCard = document.createElement('div');
    bubbleCard.className = 'dshwv-bubcard';
    var bubbleTitle = document.createElement('div');
    bubbleTitle.className = 'dshwv-bubtitle';
    wb(bubbleTitle, "textContent", (function(){ return function(){ return wm("widget.editBubbles"); }; })());
    bubbleCard.appendChild(bubbleTitle);
    var bubbleSecFirst = document.createElement('div');
    bubbleSecFirst.className = 'dshwv-bubsec dshwv-bubsec-first';
    wb(bubbleSecFirst, "textContent", (function(){ return function(){ return wm("widget.firstClickContent"); }; })());
    bubbleCard.appendChild(bubbleSecFirst);
    var bubbleFirstRow = document.createElement('div');
    bubbleFirstRow.className = 'dshwv-bubrow';
    bubbleFirstChipEl = document.createElement('div');
    bubbleFirstChipEl.className = 'dshwv-bubchip';
    wb(bubbleFirstChipEl, "title", (function(){ return function(){ return wm("widget.editThisBubbleSModules"); }; })());
    bubbleFirstChipEl.addEventListener('click', function (e) {
      e.stopPropagation();
      openBubbleItem(0);
    });
    bubbleFirstRow.appendChild(bubbleFirstChipEl);
    bubbleCard.appendChild(bubbleFirstRow);
    var bubbleSecMore = document.createElement('div');
    bubbleSecMore.className = 'dshwv-bubsec';
    wb(bubbleSecMore, "textContent", (function(){ return function(){ return wm("widget.subsequentClickContent"); }; })());
    bubbleCard.appendChild(bubbleSecMore);
    bubbleMoreListEl = document.createElement('div');
    bubbleMoreListEl.addEventListener('dragover', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
      } catch (err) {}
    });
    bubbleMoreListEl.addEventListener('drop', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
        bubbleDropToEnd();
      } catch (err) {}
    });
    bubbleCard.appendChild(bubbleMoreListEl);
    var bubbleAddBtn = document.createElement('button');
    bubbleAddBtn.type = 'button';
    bubbleAddBtn.className = 'dshwv-bubadd';
    wb(bubbleAddBtn, "textContent", (function(){ return function(){ return wm("widget.addNextBubble"); }; })());
    bubbleAddBtn.addEventListener('click', bubbleAddMore);
    bubbleCard.appendChild(bubbleAddBtn);
    var bubbleBtns = document.createElement('div');
    bubbleBtns.className = 'dshwv-bubbtns';
    function bubbleBtn(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-bubbtn ' + cls;
      wb(b, "textContent", (function(label){ return function(){ return label; }; })(label));
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      return b;
    }
    bubbleBtns.appendChild(bubbleBtn(wm("widget.cancel"), 'dshwv-bubbtn-no', function () {
      if (bubbleEditorDirty()) showConfirm(wm("widget.discardUnsavedChanges"), function () {
        closeBubbleEditor();
      }); else closeBubbleEditor();
    }));
    bubbleBtns.appendChild(bubbleBtn(wm("widget.reset"), 'dshwv-bubbtn-no', bubbleEditorReset));
    bubbleBtns.appendChild(bubbleBtn(wm("widget.save"), 'dshwv-bubbtn-ok', bubbleEditorSave));
    bubbleCard.appendChild(bubbleBtns);
    bubbleMask.appendChild(bubbleCard);
    document.body.appendChild(bubbleMask);
    bubbleItemMask = document.createElement('div');
    bubbleItemMask.className = 'dshwv-bubmask';
    bubbleItemMask.style.display = 'none';
    var bubbleItemCard = document.createElement('div');
    bubbleItemCard.className = 'dshwv-bubcard';
    bubbleItemTitleEl = document.createElement('div');
    bubbleItemTitleEl.className = 'dshwv-bubtitle';
    bubbleItemCard.appendChild(bubbleItemTitleEl);
    bubbleItemSideEl = document.createElement('div');
    bubbleItemSideEl.className = 'dshwv-sidebar';
    bubbleItemSideEl.style.display = 'none';
    bubbleItemCard.appendChild(bubbleItemSideEl);
    var bubbleSecPal = document.createElement('div');
    bubbleSecPal.className = 'dshwv-bubsec dshwv-bubsec-first';
    wb(bubbleSecPal, "textContent", (function(){ return function(){ return wm("widget.modulesClickOrDragIntoTheBubbleBelow"); }; })());
    bubbleItemCard.appendChild(bubbleSecPal);
    bubblePalEl = document.createElement('div');
    bubblePalEl.className = 'dshwv-bubpal';
    bubbleItemCard.appendChild(bubblePalEl);
    var bubbleSecPv = document.createElement('div');
    bubbleSecPv.className = 'dshwv-bubsec';
    wb(bubbleSecPv, "textContent", (function(){ return function(){ return wm("widget.bubblePreviewUpTo6ModulesPerRow"); }; })());
    bubbleItemCard.appendChild(bubbleSecPv);
    bubblePvEl = document.createElement('div');
    bubblePvEl.className = 'dshwv-bubpvbox';
    bubblePvEl.addEventListener('dragover', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
      } catch (err) {}
    });
    bubblePvEl.addEventListener('drop', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
        if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
          var fr = bubbleRowDragIdx;
          bubbleRowDragIdx = null;
          bubblePvMoveRowEnd(fr);
          return;
        }
        if (bubbleModDrag) {
          var mdd = bubbleModDrag;
          bubbleModDrag = null;
          bubblePvDropBlockEnd(mdd.ri, mdd.mi);
          return;
        }
        var key = bubbleDragKey;
        if (!key) return;
        bubbleDragKey = null;
        if (key === 'image') {
          bubblePickImageToAdd();
          return;
        }
        if (key === 'wizard') {
          bubbleModuleAdd({
            type: 'text',
            text: wm("widget.newContent"),
            size: 6,
            bold: true
          });
          return;
        }
        var m = bubblePaletteModule(key);
        if (m) bubbleModuleAdd(m);
      } catch (err) {}
    });
    bubbleItemCard.appendChild(bubblePvEl);
    var bubblePvPrevEl = document.createElement('div');
    bubblePvPrevEl.className = 'dshwv-bubprev';
    bubbleItemCard.appendChild(bubblePvPrevEl);
    var bubbleItemBtns = document.createElement('div');
    bubbleItemBtns.className = 'dshwv-bubbtns';
    bubbleItemBtns.appendChild(bubbleBtn(wm("widget.cancel"), 'dshwv-bubbtn-no', function () {
      showConfirm(wm("widget.discardChangesToThisBubble"), function () {
        bubbleItemDiscard();
      });
    }));
    bubbleItemBtns.appendChild(bubbleBtn(wm("widget.restoreDefaults"), 'dshwv-bubbtn-no', bubbleItemResetToDefault));
    bubbleItemBtns.appendChild(bubbleBtn(wm("widget.save"), 'dshwv-bubbtn-ok', bubbleItemSave));
    bubbleItemCard.appendChild(bubbleItemBtns);
    bubbleItemMask.appendChild(bubbleItemCard);
    document.body.appendChild(bubbleItemMask);
    var moduleMask = null;
    var moduleEditRef = null;
    var moduleOnSave = null;
    var moduleEditNew = false;
    var moduleTitleEl = null;
    var moduleTypeLabelEl = null;
    var moduleBodyEl = null;
    var moduleColorEl = null;
    var moduleSizeEl = null;
    var moduleImgListEl = null;
    var moduleImgSelect = null;
    var moduleImgPreviewEl = null;
    var bubbleImgList = [];
    function loadBubbleImgs(cb) {
      try {
        fetch('/dsh-whale/bubble-imgs.json', {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (d && d.ok && Array.isArray(d.images)) {
            bubbleImgList = d.images;
            assetWarning(d);
            if (cb) cb();
          }
        }).catch(function () {});
      } catch (err) {}
    }
    async function bubbleUploadImg(file, cb) {
      try {
        WhaleMediaGuard.checkFile(file, 'bubble');
        var bytes = await file.arrayBuffer();
        var media = WhaleMediaGuard.inspectImage(bytes, 'bubble');
        if (['png', 'apng', 'gif'].indexOf(media.format) < 0) throw new Error(wm("widget.chooseAPngOrGifForTheBubble"));
        var data = await mediaDataUrl(new Blob([bytes], { type: media.mime }));
        var response = await fetch('/dsh-whale/bubble-img-upload.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'upload',
              name: file.name || '',
              data: data
            })
          });
        var d = await response.json();
        if (!d || !d.ok || !Array.isArray(d.images)) throw new Error(d && d.error || wm("widget.couldNotSaveTheImageTryAgain"));
        bubbleImgList = d.images;
        assetWarning(d);
        if (cb) cb(true);
      } catch (err) {
        assetNotice(err.message);
        if (cb) cb(false);
      }
    }
    function cssToRgb(css) {
      var s = String(css || '').trim();
      var m = (/^#([0-9a-fA-F]{6})$/).exec(s);
      if (m) {
        var n = parseInt(m[1], 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
      }
      m = (/^rgb(s*(d+)s*,s*(d+)s*,s*(d+)s*)$/i).exec(s);
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      return [32, 49, 112];
    }
    function rgbToCss(r, g, b) {
      return 'rgb(' + Math.max(0, Math.min(255, Math.round(r))) + ',' + Math.max(0, Math.min(255, Math.round(g))) + ',' + Math.max(0, Math.min(255, Math.round(b))) + ')';
    }
    function bubbleColorEdit(container, getCss, setCss, label) {
      var row = document.createElement('div');
      row.className = 'dshwv-audiorow';
      var lb = document.createElement('span');
      wb(lb, "textContent", (function(label){ return function(){ return label || wm("widget.color"); }; })(label));
      row.appendChild(lb);
      var inp = document.createElement('input');
      inp.type = 'color';
      inp.className = 'dshwv-colnat';
      row.appendChild(inp);
      var def = document.createElement('button');
      def.type = 'button';
      def.className = 'dshwv-snapbtn dshwv-snapbtn-no';
      wb(def, "textContent", (function(){ return function(){ return wm("widget.defaultColor"); }; })());
      wb(def, "title", (function(){ return function(){ return wm("widget.restoreDefaultColor"); }; })());
      def.addEventListener('click', function () {
        setCss('');
        sync();
      });
      row.appendChild(def);
      container.appendChild(row);
      function sync() {
        try {
          var v = getCss();
          if ((/^#[0-9a-fA-F]{6}$/).test(v || '')) {
            inp.value = v;
            return;
          }
          if (v) {
            var a = cssToRgb(v);
            inp.value = '#' + ((1 << 24) + (a[0] << 16) + (a[1] << 8) + a[2]).toString(16).slice(1);
            return;
          }
          inp.value = gptThemeColor('ink');
        } catch (err) {}
      }
      inp.addEventListener('input', function () {
        setCss(inp.value);
      });
      inp.addEventListener('change', function () {
        setCss(inp.value);
      });
      sync();
    }
    var bubbleRgbOpenMenu = null;
    var bubbleFontOpenMenu = null;
    var bubbleColorOpenMenu = null;
    function visibleTopZ() {
      var top = 20500;
      var cand = [bubbleMask, bubbleItemMask, moduleMask, usageMoreMask, qeditEl, window.__dshwRemindMask];
      function eff(el) {
        try {
          if (!el) return 0;
          if (el.style && el.style.display === 'none') return 0;
          var s = el.style ? el.style.zIndex || '' : '';
          if (!s) {
            var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (cs) s = cs.zIndex;
          }
          var n = parseFloat(s);
          return isFinite(n) ? n : 0;
        } catch (err) {
          return 0;
        }
      }
      for (var i = 0; i < cand.length; i++) {
        var n = eff(cand[i]);
        if (n > top) top = n;
      }
      return top;
    }
    function whaleZClean() {
      try {
        var zsEl = document.getElementById('dshw-remind-overlay-z');
        if (zsEl) {
          try {
            document.head.removeChild(zsEl);
          } catch (err) {}
        }
        if (!window.__dshwRemindMask) {
          if (moduleMask && moduleMask.style.zIndex) moduleMask.style.zIndex = '';
          if (qeditEl && qeditEl.style.zIndex) qeditEl.style.zIndex = '';
        }
      } catch (err) {}
    }
    function dshwDropOpen(menuEl, anchorEl) {
      try {
        if (menuEl.parentNode !== document.body) document.body.appendChild(menuEl);
        menuEl.style.position = 'fixed';
        menuEl.style.minWidth = '0px';
        menuEl.style.left = '0px';
        menuEl.style.top = '0px';
        menuEl.classList.add('dshwv-rgbopen');
        var r = anchorEl.getBoundingClientRect();
        var vp = viewport();
        var w = Math.max(20, Math.round(r.width));
        if (menuEl.classList && menuEl.classList.contains('dshwv-qcolmenu')) {
          try {
            var rowHost = anchorEl && anchorEl.parentNode ? anchorEl.parentNode.parentNode : null;
            if (rowHost && rowHost.querySelector) {
              var swEl = rowHost.querySelector('.dshwv-qcolorhost');
              if (swEl && swEl.offsetWidth > 0) w = Math.max(w, Math.round(r.width + swEl.offsetWidth));
            }
          } catch (err) {}
        }
        if (w > vp.w - 16) w = Math.max(20, vp.w - 16);
        menuEl.style.width = w + 'px';
        menuEl.style.maxWidth = 'none';
        var left = r.left;
        if (left + w > vp.w - 8) left = Math.max(8, vp.w - w - 8);
        menuEl.style.left = Math.round(left) + 'px';
        menuEl.style.top = Math.round(r.bottom + 2) + 'px';
        var vTop = visibleTopZ();
        menuEl.style.zIndex = String(Math.max(26010, Math.round(vTop) + 10));
      } catch (err) {}
    }
    var bubbleSysFontList = [];
    var bubbleSysFontTried = false;
    function refreshSystemFonts(onDone) {
      if (bubbleSysFontTried) {
        if (onDone) onDone();
        return;
      }
      bubbleSysFontTried = true;
      if (!window.queryLocalFonts) {
        if (onDone) onDone();
        return;
      }
      try {
        window.queryLocalFonts().then(function (list) {
          try {
            var seen = {};
            var out = [];
            if (list && list.length) {
              for (var i = 0; i < list.length; i++) {
                var fam = String(list[i] && list[i].family || '');
                var lab = String(list[i] && (list[i].fullName || list[i].family) || fam);
                if (!fam) continue;
                if (fam.indexOf('"') >= 0 || fam.indexOf(',') >= 0) continue;
                var key = fam.toLowerCase();
                if (seen[key]) continue;
                seen[key] = true;
                out.push({
                  v: '"' + fam + '"',
                  l: lab
                });
              }
              out.sort(function (a, b) {
                return a.l < b.l ? -1 : a.l > b.l ? 1 : 0;
              });
            }
            bubbleSysFontList = out;
          } catch (err) {}
          if (onDone) onDone();
        }).catch(function () {
          if (onDone) onDone();
        });
      } catch (err) {
        if (onDone) onDone();
      }
    }
    function bubbleRgbSelect(current, cb) {
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-rgbwrap';
      var cur = current === true ? 'macaron' : current || '';
      var opts = [['', wm("widget.none")], ['macaron', wm("widget.macaron")], ['candy', wm("widget.candy")], ['rouge', wm("widget.burgundy")], ['bamboo', wm("widget.jade")], ['aurora', wm("widget.aurora")], ['deepsea', wm("widget.deepSea")], ['sunset', wm("widget.sunsetGold")], ['forest', wm("widget.forest")], ['champagne', wm("widget.champagne")], ['lavender', wm("widget.lavender")], ['mint', wm("widget.mint")], ['lava', wm("widget.lava")], ['galaxy', wm("widget.galaxy")], ['ink', wm("widget.monochrome")], ['indigo', wm("widget.indigo")]];
      function labelOf(v) {
        for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return opts[i][1];
        return wm("widget.none");
      }
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      wb(head, "textContent", (function(labelOf,cur){ return function(){ return labelOf(cur); }; })(labelOf,cur));
      wb(head, "title", (function(){ return function(){ return wm("widget.chooseAnAnimatedGradient"); }; })());
      wrap.appendChild(head);
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu';
      function fillMenu() {
        menu.innerHTML = '';
        for (var i = 0; i < opts.length; i++) {
          (function (v, lab) {
            var o = document.createElement('div');
            o.className = 'dshwv-rgbopt' + (v === cur ? ' dshwv-rgbcur' : '');
            wb(o, "textContent", (function(lab){ return function(){ return lab; }; })(lab));
            o.addEventListener('click', function (e) {
              e.stopPropagation();
              cur = v;
              wb(head, "textContent", (function(labelOf,cur){ return function(){ return labelOf(cur); }; })(labelOf,cur));
              closeRgbMenu();
              cb(v);
            });
            menu.appendChild(o);
          })(opts[i][0], opts[i][1]);
        }
      }
      fillMenu();
      wrap.appendChild(menu);
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        if (bubbleRgbOpenMenu === menu) {
          closeRgbMenu();
          return;
        }
        closeRgbMenu();
        menu.classList.add('dshwv-rgbopen');
        bubbleRgbOpenMenu = menu;
      });
      function closeRgbMenu() {
        if (bubbleRgbOpenMenu) bubbleRgbOpenMenu.classList.remove('dshwv-rgbopen');
        bubbleRgbOpenMenu = null;
      }
      if (!window.__dshwRgbDocBound) {
        window.__dshwRgbDocBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!bubbleRgbOpenMenu) return;
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-rgbwrap')) return;
          } catch (err) {}
          closeRgbMenu();
        }, true);
      }
      return wrap;
    }
    function bubbleFontEditRow(getVal, setVal) {
      var FONT_OPTIONS = [['', wm("widget.defaultFont")], ['"Microsoft YaHei",sans-serif', wm("widget.microsoftYahei")], ['"PingFang SC","Microsoft YaHei",sans-serif', wm("widget.pingfangYahei")], ['DengXian,"Microsoft YaHei",sans-serif', wm("widget.dengxian")], ['SimSun,serif', wm("widget.simsun")], ['SimHei,sans-serif', wm("widget.simhei")], ['KaiTi,serif', wm("widget.kaiti")], ['FangSong,serif', wm("widget.fangsong")], ['STKaiti,KaiTi,serif', wm("widget.stkaiti")], ['"Noto Sans SC",sans-serif', 'Noto Sans SC'], ['"Source Han Sans SC",sans-serif', wm("widget.sourceHanSans")], ['"Segoe UI",sans-serif', 'Segoe UI'], ['Arial,Helvetica,sans-serif', 'Arial'], ['Helvetica,Arial,sans-serif', 'Helvetica'], ['Verdana,sans-serif', 'Verdana'], ['Tahoma,sans-serif', 'Tahoma'], ['"Trebuchet MS",sans-serif', 'Trebuchet MS'], ['"Times New Roman",serif', 'Times New Roman'], ['Georgia,serif', 'Georgia'], ['"Courier New",monospace', 'Courier New'], ['Consolas,monospace', 'Consolas'], ['Impact,fantasy', 'Impact'], ['"Comic Sans MS",cursive', 'Comic Sans MS']];
      var row = document.createElement('div');
      row.className = 'dshwv-audiorow';
      var fl = document.createElement('span');
      wb(fl, "textContent", (function(){ return function(){ return wm("widget.font"); }; })());
      row.appendChild(fl);
      var box = document.createElement('div');
      box.className = 'dshwv-rgbwrap dshwv-fontwrap';
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      wb(head, "title", (function(){ return function(){ return wm("widget.chooseASystemFont"); }; })());
      box.appendChild(head);
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-fontmenu';
      function currentVal() {
        return getVal ? String(getVal() || '') : '';
      }
      function labelOf(v) {
        for (var i = 0; i < FONT_OPTIONS.length; i++) if (FONT_OPTIONS[i][0] === v) return FONT_OPTIONS[i][1];
        if (v) return String(v).slice(0, 14);
        return wm("widget.defaultFont");
      }
      function syncHead() {
        var v = currentVal();
        wb(head, "textContent", (function(labelOf,v){ return function(){ return labelOf(v); }; })(labelOf,v));
        head.style.fontFamily = v || '';
        wb(head, "title", (function(v){ return function(){ return wm("widget.current") + (v || wm("widget.defaultFont")) + wm("widget.clickToChooseASystemFont"); }; })(v));
      }
      function optionList() {
        var list = [];
        var seen = {};
        for (var i = 0; i < FONT_OPTIONS.length; i++) {
          list.push(FONT_OPTIONS[i]);
          seen[FONT_OPTIONS[i][0]] = true;
        }
        for (var s = 0; s < bubbleSysFontList.length; s++) {
          if (!seen[bubbleSysFontList[s].v]) {
            seen[bubbleSysFontList[s].v] = true;
            list.push([bubbleSysFontList[s].v, bubbleSysFontList[s].l]);
          }
        }
        return list;
      }
      function fill() {
        menu.innerHTML = '';
        var cur = currentVal();
        var all = optionList();
        for (var i = 0; i < all.length; i++) {
          (function (fv, flab) {
            var o = document.createElement('div');
            o.className = 'dshwv-rgbopt' + (fv === cur ? ' dshwv-rgbcur' : '');
            wb(o, "textContent", (function(flab){ return function(){ return flab; }; })(flab));
            o.style.fontFamily = fv || '';
            o.addEventListener('click', function () {
              if (setVal) setVal(fv);
              closeFontMenu();
              syncHead();
              fill();
            });
            menu.appendChild(o);
          })(all[i][0], all[i][1]);
        }
      }
      box.appendChild(menu);
      function closeFontMenu() {
        menu.classList.remove('dshwv-rgbopen');
        bubbleFontOpenMenu = null;
      }
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        if (bubbleFontOpenMenu === menu) {
          closeFontMenu();
          return;
        }
        if (bubbleFontOpenMenu) bubbleFontOpenMenu.classList.remove('dshwv-rgbopen');
        fill();
        bubbleFontOpenMenu = menu;
        dshwDropOpen(menu, head);
        refreshSystemFonts(function () {
          if (bubbleFontOpenMenu === menu && menu.classList.contains('dshwv-rgbopen')) {
            fill();
            dshwDropOpen(menu, head);
          }
        });
      });
      if (!window.__dshwFontDocBound) {
        window.__dshwFontDocBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!bubbleFontOpenMenu) return;
          try {
            if (e.target && e.target.closest && (e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-rgbmenu'))) return;
          } catch (err) {}
          bubbleFontOpenMenu.classList.remove('dshwv-rgbopen');
          bubbleFontOpenMenu = null;
        }, true);
      }
      row.appendChild(box);
      syncHead();
      fill();
      return row;
    }
    function moduleTypeName(t, m) {
      if (t === 'balance') return wm("widget.balanceAmount");
      if (t === 'today') return wm("widget.observedToday2");
      if (t === 'image') return wm("widget.imageAnimation");
      if (t === 'random') return wm("widget.customRandomText2");
      return wm("widget.textModule");
    }
    function renderModuleEditor() {
      var m = moduleEditRef;
      if (moduleEditNew && m.type === 'text' && m.bold === undefined) m.bold = true;
      moduleColorEl = null;
      moduleSizeEl = null;
      moduleBodyEl.innerHTML = '';
      wb(moduleTitleEl, "textContent", (function(moduleEditNew,moduleTypeName,m){ return function(){ return (moduleEditNew ? wm("widget.newModule2") : wm("widget.editModule")) + moduleTypeName(m.type, m); }; })(moduleEditNew,moduleTypeName,m));
      function moduleTplRow() {
        var row = document.createElement('div');
        row.className = 'dshwv-audiorow';
        var lab = document.createElement('span');
        wb(lab, "textContent", (function(){ return function(){ return wm("widget.content"); }; })());
        lab.style.flex = '0 0 auto';
        row.appendChild(lab);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.style.flex = '1';
        inp.style.minWidth = '0';
        inp.style.boxSizing = 'border-box';
        inp.style.border = '1px solid rgba(var(--gpt-ink-rgb),.4)';
        inp.style.borderRadius = '6px';
        inp.style.padding = '3px 6px';
        inp.style.fontSize = '12px';
        inp.style.color = gptThemeColor('ink');
        inp.style.background = gptThemeColor('surface');
        inp.value = localizedModuleField(m, 'tpl');
        function hintOf() {
          if (m.type === 'balance') return wm("widget.exampleBalanceApi");
          if (m.type === 'today') return wm("widget.exampleObservedTodayExpenseApi");
          return wm("widget.exampleCurrentStatus");
        }
        var hp = hintOf();
        wb(inp, "placeholder", (function(hp){ return function(){ return hp; }; })(hp));
        wb(inp, "title", (function(){ return function(){ return wm("widget.enterContentClickForPlaceholders"); }; })());
        inp.addEventListener('input', function () {
          m.tpl = inp.value; delete m.tplI18nKey;
        });
        row.appendChild(inp);
        var qb = document.createElement('button');
        qb.type = 'button';
        qb.className = 'dshwv-tplq';
        qb.textContent = '?';
        wb(qb, "title", (function(){ return function(){ return wm("widget.placeholderHelp"); }; })());
        qb.addEventListener('click', function (e) {
          e.stopPropagation();
          bubbleTplHelpToggle(m, qb);
        });
        row.appendChild(qb);
        moduleBodyEl.appendChild(row);
      }
      if (moduleEditNew) {
        var tr = document.createElement('div');
        tr.className = 'dshwv-audiorow';
        var tl = document.createElement('span');
        wb(tl, "textContent", (function(){ return function(){ return wm("widget.type"); }; })());
        tr.appendChild(tl);
        var tsel = document.createElement('select');
        tsel.className = 'dshwv-sound';
        var topts = [['text', wm("widget.text2")], ['random', wm("widget.customRandomText2")], ['image', wm("widget.imageAnimation")]];
        for (var ti2 = 0; ti2 < topts.length; ti2++) {
          var o2 = document.createElement('option');
          o2.value = topts[ti2][0];
          wb(o2, "textContent", (function(topts,ti2){ return function(){ return topts[ti2][1]; }; })(topts,ti2));
          tsel.appendChild(o2);
        }
        tsel.value = m.type;
        tsel.addEventListener('change', function () {
          m.type = tsel.value;
          if (m.type === 'random' && !Array.isArray(m.lines)) m.lines = [];
          if (m.type === 'random' && m.bold === undefined) m.bold = true;
          if (m.type === 'text' && m.bold === undefined) m.bold = true;
          if (m.type === 'image' && !m.imgId) m.imgId = '';
          renderModuleEditor();
        });
        tr.appendChild(tsel);
        dshwCustSel(tsel);
        moduleBodyEl.appendChild(tr);
      }
      if (bubbleLib.length) {
        var lr2 = document.createElement('div');
        lr2.className = 'dshwv-bubsec';
        wb(lr2, "textContent", (function(){ return function(){ return wm("widget.loadFromModuleLibrary"); }; })());
        moduleBodyEl.appendChild(lr2);
        for (var li3 = 0; li3 < bubbleLib.length; li3++) {
          (function (lb) {
            var lrow = document.createElement('div');
            lrow.className = 'dshwv-bublibrow';
            var lbtn = document.createElement('button');
            lbtn.type = 'button';
            lbtn.className = 'dshwv-bubnewbtn';
            wb(lbtn, "textContent", (function(lb){ return function(){ return lb.name; }; })(lb));
            wb(lbtn, "title", (function(){ return function(){ return wm("widget.loadThisModuleIntoTheCurrentEditor"); }; })());
            lbtn.addEventListener('click', function () {
              var c = bubbleCloneModule(lb.module);
              var oldKeys = Object.keys(m);
              for (var kk = 0; kk < oldKeys.length; kk++) {
                try {
                  delete m[oldKeys[kk]];
                } catch (err) {}
              }
              var nk = Object.keys(c);
              for (var j2 = 0; j2 < nk.length; j2++) m[nk[j2]] = c[nk[j2]];
              moduleColorEl = null;
              moduleSizeEl = null;
              renderModuleEditor();
            });
            lrow.appendChild(lbtn);
            var ldel = document.createElement('button');
            ldel.type = 'button';
            ldel.className = 'dshwv-bubmini';
            ldel.textContent = '✕';
            wb(ldel, "title", (function(){ return function(){ return wm("widget.removeFromLibrary"); }; })());
            ldel.addEventListener('click', function () {
              showDeleteConfirm(wexpr((function(lb){ return function(){ return wm("widget.removeModule") + lb.name + '」?'; }; })(lb)), function () {
                bubbleLibDel(lb.id);
                renderModuleEditor();
                if (bubblePalEl) renderBubblePal();
              });
            });
            lrow.appendChild(ldel);
            moduleBodyEl.appendChild(lrow);
          })(bubbleLib[li3]);
        }
      }
      if (m.type === 'text') {
        var ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'dshwv-cropname';
        ti.maxLength = 60;
        ti.value = localizedModuleField(m, 'text');
        wb(ti, "placeholder", (function(){ return function(){ return wm("widget.textContent"); }; })());
        ti.addEventListener('input', function () {
          m.text = ti.value || ' '; delete m.i18nKey;
        });
        moduleBodyEl.appendChild(ti);
      } else if (m.type === 'random') {
        var hint = document.createElement('div');
        hint.className = 'dshwv-linehead';
        var hw = document.createElement('span');
        hw.className = 'dshwv-lhw';
        wb(hw, "textContent", (function(){ return function(){ return wm("widget.weight"); }; })());
        hint.appendChild(hw);
        var hc = document.createElement('span');
        hc.className = 'dshwv-lhc';
        wb(hc, "textContent", (function(){ return function(){ return wm("widget.content"); }; })());
        hint.appendChild(hc);
        var ho = document.createElement('span');
        ho.className = 'dshwv-lho';
        wb(ho, "textContent", (function(){ return function(){ return wm("widget.actions"); }; })());
        hint.appendChild(ho);
        moduleBodyEl.appendChild(hint);
        if (!Array.isArray(m.lines)) m.lines = [];
        var listEl = document.createElement('div');
        listEl.className = 'dshwv-listbox';
        listEl.style.maxHeight = '240px';
        listEl.style.overflowY = 'auto';
        listEl.style.paddingRight = '2px';
        moduleBodyEl.appendChild(listEl);
        function linePanel(l, box) {
          box.innerHTML = '';
          function lineVal(lv, mv, dft) {
            return lv !== undefined && lv !== null ? lv : mv !== undefined && mv !== null ? mv : dft;
          }
          var r2 = document.createElement('div');
          r2.className = 'dshwv-audiorow';
          var c2 = document.createElement('span');
          wb(c2, "textContent", (function(){ return function(){ return wm("widget.fontSize"); }; })());
          r2.appendChild(c2);
          var ps = document.createElement('input');
          ps.type = 'range';
          ps.min = '1';
          ps.max = '50';
          ps.step = '1';
          ps.className = 'dshwv-cropzoom';
          ps.value = String(lineVal(l.size, m.size, 3));
          r2.appendChild(ps);
          var psNum = document.createElement('span');
          psNum.className = 'dshwv-volpct';
          psNum.textContent = String(lineVal(l.size, m.size, 3));
          ps.addEventListener('input', function () {
            l.size = Math.round(Number(ps.value) || 3);
            psNum.textContent = ps.value;
          });
          r2.appendChild(psNum);
          box.appendChild(r2);
          box.appendChild(bubbleFontEditRow(function () {
            return lineVal(l.fontFamily, m.fontFamily, '');
          }, function (v) {
            l.fontFamily = v || '';
          }));
          if (!l.rgb) bubbleColorEdit(box, function () {
            return lineVal(l.color, m.color, '');
          }, function (v) {
            l.color = v;
          }, wm("widget.color"));
          var lbgV = l.bgRgb ? l.bgRgb : l.bg ? 'solid' : m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
          var lbgHex0 = l.bg || m.bg || gptThemeColor('tint');
          var lbgc = qColorSelectBuild(lbgV, function (v) {
            if (v === 'none') {
              l.bgRgb = '';
              l.bg = '';
            } else if (v === 'solid') {
              l.bgRgb = '';
              if (!l.bg) l.bg = lbgHex0;
            } else {
              l.bgRgb = v;
              l.bg = '';
            }
            lbgc.sync(v === 'none' ? 'none' : v, l.bg || lbgHex0, function (h) {
              l.bg = h;
            });
          }, {
            label: wm("widget.background"),
            defaultHex: lbgHex0,
            defaultText: wm("widget.default"),
            allowNone: true
          });
          box.appendChild(lbgc.row);
          lbgc.sync(lbgV, lbgHex0, function (h) {
            l.bg = h;
          });
          var r3 = document.createElement('div');
          r3.className = 'dshwv-audiorow';
          function lb2(label, key) {
            var la = document.createElement('label');
            la.style.display = 'inline-flex';
            la.style.alignItems = 'center';
            la.style.gap = '3px';
            la.style.marginRight = '10px';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !!lineVal(l[key], m[key], false);
            cb.addEventListener('change', function () {
              l[key] = cb.checked;
            });
            var tx = document.createElement('span');
            wb(tx, "textContent", (function(label){ return function(){ return label; }; })(label));
            la.appendChild(cb);
            la.appendChild(tx);
            return la;
          }
          r3.appendChild(lb2(wm("widget.bold"), 'bold'));
          r3.appendChild(lb2(wm("widget.italic"), 'italic'));
          r3.appendChild(lb2(wm("widget.underline"), 'ul'));
          var r3l = document.createElement('span');
          wb(r3l, "textContent", (function(){ return function(){ return wm("widget.animatedGradient"); }; })());
          r3.appendChild(r3l);
          r3.appendChild(bubbleRgbSelect(l.rgb, function (v) {
            l.rgb = v;
            linePanel(l, box);
          }));
          box.appendChild(r3);
        }
        function renderLines() {
          listEl.innerHTML = '';
          for (var i = 0; i < m.lines.length; i++) {
            (function (idx) {
              var l = m.lines[idx];
              if (!l) return;
              var wrap = document.createElement('div');
              wrap.className = 'dshwv-linerow';
              var lr = document.createElement('div');
              lr.className = 'dshwv-audiorow';
              var wt = document.createElement('input');
              wt.type = 'number';
              wt.min = '1';
              wt.max = '99';
              wt.className = 'dshwv-linew';
              wt.value = String(l.w || 1);
              wb(wt, "title", (function(){ return function(){ return wm("widget.weight"); }; })());
              wt.addEventListener('input', function () {
                l.w = Math.max(1, Math.round(Number(wt.value) || 1));
              });
              lr.appendChild(wt);
              var tx = document.createElement('input');
              tx.type = 'text';
              tx.className = 'dshwv-linetx';
              tx.value = l.t;
              wb(tx, "placeholder", (function(){ return function(){ return wm("widget.sentence"); }; })());
              tx.addEventListener('input', function () {
                l.t = tx.value || ' ';
              });
              lr.appendChild(tx);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              wb(ed, "title", (function(){ return function(){ return wm("widget.editSentenceTextFontSizeFontColorAnd"); }; })());
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                openQuickSentenceEditor(l, m, tx, ed);
              });
              lr.appendChild(ed);
              var cp = document.createElement('button');
              cp.type = 'button';
              cp.className = 'dshwv-bubmini';
              cp.textContent = '⧉';
              wb(cp, "title", (function(){ return function(){ return wm("widget.duplicateThisRowAndItsStyle"); }; })());
              cp.addEventListener('click', function () {
                m.lines.splice(idx + 1, 0, JSON.parse(JSON.stringify(l)));
                renderLines();
              });
              lr.appendChild(cp);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-linedel';
              del.textContent = '✕';
              wb(del, "title", (function(){ return function(){ return wm("widget.deleteThisSentence"); }; })());
              del.addEventListener('click', function () {
                m.lines.splice(idx, 1);
                renderLines();
              });
              lr.appendChild(del);
              wrap.appendChild(lr);
              listEl.appendChild(wrap);
            })(i);
          }
        }
        renderLines();
        var addL = document.createElement('button');
        addL.type = 'button';
        addL.className = 'dshwv-addline';
        wb(addL, "textContent", (function(){ return function(){ return wm("widget.addSentence"); }; })());
        addL.addEventListener('click', function () {
          m.lines.push({
            t: wm("widget.newSentence"),
            w: 1
          });
          renderLines();
        });
        moduleBodyEl.appendChild(addL);
      } else if (m.type === 'image') {
        moduleImgSelect = document.createElement('select');
        moduleImgSelect.className = 'dshwv-sound';
        moduleBodyEl.appendChild(moduleImgSelect);
        moduleImgDrop = dshwCustSel(moduleImgSelect);
        moduleImgPreviewEl = document.createElement('img');
        moduleImgPreviewEl.className = 'dshwv-bubimgprev';
        moduleImgPreviewEl.alt = '';
        moduleBodyEl.appendChild(moduleImgPreviewEl);
        function fillImgSel() {
          moduleImgSelect.innerHTML = '';
          var opt0 = document.createElement('option');
          opt0.value = '';
          wb(opt0, "textContent", (function(){ return function(){ return wm("widget.chooseABubbleImage"); }; })());
          moduleImgSelect.appendChild(opt0);
          for (var i = 0; i < bubbleImgList.length; i++) {
            var o = document.createElement('option');
            o.value = bubbleImgList[i].id;
            wb(o,'textContent',(function(item){return function(){return item.id === 'bimg_petpet' ? wt('widget.gptPetpet') : item.name;};})(bubbleImgList[i]));
            moduleImgSelect.appendChild(o);
          }
          if (m.imgId) moduleImgSelect.value = m.imgId;
          moduleImgSelect.dispatchEvent(new Event('change'));
          if (moduleImgDrop) moduleImgDrop.refresh();
        }
        moduleImgSelect.addEventListener('change', function () {
          m.imgId = moduleImgSelect.value;
          if (m.imgId) {
            moduleImgPreviewEl.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(m.imgId);
            moduleImgPreviewEl.style.display = 'block';
          } else moduleImgPreviewEl.style.display = 'none';
        });
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/gif';
        fileInput.style.display = 'none';
        var upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'dshwv-snapbtn dshwv-snapbtn-no';
        wb(upBtn, "textContent", (function(){ return function(){ return wm("widget.uploadImagePngGif"); }; })());
        upBtn.addEventListener('click', function () {
          fileInput.click();
        });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          bubbleUploadImg(f, function (ok) {
            if (ok) fillImgSel();
            fileInput.value = '';
          });
        });
        moduleBodyEl.appendChild(upBtn);
        moduleBodyEl.appendChild(fileInput);
        var scRow = document.createElement('div');
        scRow.className = 'dshwv-audiorow';
        var scL = document.createElement('span');
        wb(scL, "textContent", (function(){ return function(){ return wm("widget.displaySize"); }; })());
        scRow.appendChild(scL);
        var scInit = Number(m.imgScale);
        if (!isFinite(scInit) || scInit <= 0) scInit = 1;
        var scInp = document.createElement('input');
        scInp.type = 'range';
        scInp.min = '10';
        scInp.max = '100';
        scInp.step = '5';
        scInp.className = 'dshwv-cropzoom';
        scInp.style.flex = '1';
        scInp.value = String(Math.round(scInit * 100));
        scInp.addEventListener('input', function () {
          m.imgScale = Math.max(0.1, Math.min(1, Number(scInp.value) / 100));
          scVal.textContent = scInp.value + '%';
          try {
            if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * m.imgScale) + 'px';
          } catch (err) {}
        });
        scRow.appendChild(scInp);
        var scVal = document.createElement('span');
        scVal.className = 'dshwv-volpct';
        scVal.textContent = scInp.value + '%';
        scRow.appendChild(scVal);
        moduleBodyEl.appendChild(scRow);
        try {
          if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * scInit) + 'px';
        } catch (err) {}
        if (!bubbleImgList.length) loadBubbleImgs(fillImgSel); else fillImgSel();
      } else {
        {
          var note = document.createElement('div');
          note.className = 'dshwv-bubhint';
          wb(note, "textContent", (function(){ return function(){ return wm("widget.thisValueUpdatesAutomaticallyCustomizeItsColorAnd"); }; })());
          moduleBodyEl.appendChild(note);
          moduleTplRow();
        }
      }
      if (m.type !== 'image' && m.type !== 'random') {
        var sec = document.createElement('div');
        sec.className = 'dshwv-bubsec';
        wb(sec, "textContent", (function(){ return function(){ return wm("widget.style"); }; })());
        moduleBodyEl.appendChild(sec);
        moduleBodyEl.appendChild(bubbleFontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
        }));
        var sizeRow = document.createElement('div');
        sizeRow.className = 'dshwv-audiorow';
        var sl = document.createElement('span');
        wb(sl, "textContent", (function(){ return function(){ return wm("widget.fontSize"); }; })());
        sizeRow.appendChild(sl);
        moduleSizeEl = document.createElement('input');
        moduleSizeEl.type = 'range';
        moduleSizeEl.min = '1';
        moduleSizeEl.max = '50';
        moduleSizeEl.step = '1';
        moduleSizeEl.className = 'dshwv-cropzoom';
        moduleSizeEl.value = String(m.size || 6);
        sizeRow.appendChild(moduleSizeEl);
        var sizeNum = document.createElement('span');
        sizeNum.className = 'dshwv-volpct';
        sizeNum.textContent = String(m.size || 6);
        moduleSizeEl.addEventListener('input', function () {
          sizeNum.textContent = moduleSizeEl.value;
        });
        sizeRow.appendChild(sizeNum);
        moduleBodyEl.appendChild(sizeRow);
        var glyphRow = document.createElement('div');
        glyphRow.className = 'dshwv-audiorow';
        function glyphBox(label, key) {
          var lab = document.createElement('label');
          lab.style.display = 'inline-flex';
          lab.style.alignItems = 'center';
          lab.style.gap = '3px';
          lab.style.marginRight = '10px';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!m[key];
          cb.addEventListener('change', function () {
            m[key] = cb.checked;
          });
          var tx = document.createElement('span');
          wb(tx, "textContent", (function(label){ return function(){ return label; }; })(label));
          lab.appendChild(cb);
          lab.appendChild(tx);
          return lab;
        }
        glyphRow.appendChild(glyphBox(wm("widget.bold"), 'bold'));
        glyphRow.appendChild(glyphBox(wm("widget.italic"), 'italic'));
        glyphRow.appendChild(glyphBox(wm("widget.underline"), 'ul'));
        moduleBodyEl.appendChild(glyphRow);
        {
          var w3cc = qColorSelectBuild(m.rgb ? m.rgb : 'solid', function (v) {
            if (v === 'solid') {
              m.rgb = '';
              if (!m.color) m.color = gptThemeColor('ink');
            } else {
              m.rgb = v;
              m.color = '';
            }
            var mode2 = v === 'solid' ? 'solid' : v;
            w3cc.sync(mode2, m.color, function (hex) {
              m.color = hex;
            });
          });
          moduleBodyEl.appendChild(w3cc.row);
          w3cc.sync(m.rgb ? m.rgb : 'solid', m.color || gptThemeColor('ink'), function (hex) {
            m.color = hex;
          });
        }
        {
          var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
          var bgcc = qColorSelectBuild(bgCur, function (v) {
            if (v === 'none') {
              m.bgRgb = '';
              m.bg = '';
            } else if (v === 'solid') {
              m.bgRgb = '';
              if (!m.bg) m.bg = gptThemeColor('tint');
            } else {
              m.bgRgb = v;
              m.bg = '';
            }
            bgcc.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
              m.bg = hex;
            });
          }, {
            label: wm("widget.background"),
            defaultHex: gptThemeColor('tint'),
            defaultText: wm("widget.default"),
            allowNone: true
          });
          moduleBodyEl.appendChild(bgcc.row);
          bgcc.sync(bgCur, m.bg || gptThemeColor('tint'), function (hex) {
            m.bg = hex;
          });
        }
      }
    }
    var moduleNamePromptModule = null;
    function openModuleNamePrompt(m) {
      try {
        moduleNamePromptModule = m || moduleEditRef || null;
        moduleNameInput.value = '';
        moduleNamePromptMask.style.display = 'flex';
        setTimeout(function () {
          try {
            moduleNameInput.focus();
          } catch (err) {}
        }, 30);
      } catch (err) {}
    }
    function closeModuleNamePrompt() {
      moduleNamePromptMask.style.display = 'none';
      moduleNamePromptModule = null;
    }
    function saveModuleNamePrompt() {
      var m = moduleNamePromptModule || moduleEditRef;
      if (!m) {
        closeModuleNamePrompt();
        return;
      }
      bubbleLibAdd(moduleNameInput.value, m);
      moduleNameInput.value = '';
      closeModuleNamePrompt();
      if (bubblePalEl) renderBubblePal();
    }
    function openModuleEditor(m, onSave, isNew) {
      try {
        whaleZClean();
        moduleEditRef = m;
        moduleOnSave = onSave || null;
        moduleEditNew = !!isNew;
        renderModuleEditor();
        moduleMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeModuleEditor(saved) {
      try {
        if (saved && moduleEditRef) {
          if (moduleColorEl) moduleEditRef.color = moduleColorEl.value === gptThemeColor('ink') && !moduleEditRef.color ? '' : moduleColorEl.value;
          if (moduleSizeEl) moduleEditRef.size = Math.max(1, Math.min(50, Math.round(Number(moduleSizeEl.value) || 6)));
          if (moduleEditRef.type === 'image' && !moduleEditRef.imgId) {
            showConfirm(wm("widget.chooseOrUploadAnImageFirst"), function () {});
            return;
          }
          if (moduleOnSave) moduleOnSave(moduleEditRef);
        }
        moduleMask.style.display = 'none';
        moduleEditRef = null;
        moduleOnSave = null;
        moduleEditNew = false;
      } catch (err) {
        moduleMask.style.display = 'none';
      }
    }
    moduleMask = document.createElement('div');
    moduleMask.className = 'dshwv-bubmask';
    moduleMask.style.display = 'none';
    var moduleCard = document.createElement('div');
    moduleCard.className = 'dshwv-bubcard';
    moduleTitleEl = document.createElement('div');
    moduleTitleEl.className = 'dshwv-bubtitle';
    moduleCard.appendChild(moduleTitleEl);
    moduleBodyEl = document.createElement('div');
    moduleCard.appendChild(moduleBodyEl);
    var moduleBtns = document.createElement('div');
    moduleBtns.className = 'dshwv-bubbtns';
    moduleBtns.appendChild(bubbleBtn(wm("widget.cancel"), 'dshwv-bubbtn-no', function () {
      closeModuleEditor(false);
    }));
    var saveAsBtn = document.createElement('button');
    saveAsBtn.type = 'button';
    saveAsBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
    wb(saveAsBtn, "textContent", (function(){ return function(){ return wm("widget.saveAs"); }; })());
    wb(saveAsBtn, "title", (function(){ return function(){ return wm("widget.saveThisModuleToTheLibraryForUse"); }; })());
    saveAsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openModuleNamePrompt(moduleEditRef);
    });
    moduleBtns.appendChild(saveAsBtn);
    moduleBtns.appendChild(bubbleBtn(wm("widget.save"), 'dshwv-bubbtn-ok', function () {
      closeModuleEditor(true);
    }));
    moduleCard.appendChild(moduleBtns);
    moduleMask.appendChild(moduleCard);
    document.body.appendChild(moduleMask);
    var moduleNamePromptMask = document.createElement('div');
    moduleNamePromptMask.className = 'dshwv-confirmmask';
    moduleNamePromptMask.style.display = 'none';
    var moduleNamePromptCard = document.createElement('div');
    moduleNamePromptCard.className = 'dshwv-audiowin';
    var moduleNamePromptTitle = document.createElement('div');
    moduleNamePromptTitle.className = 'dshwv-audiotitle';
    wb(moduleNamePromptTitle, "textContent", (function(){ return function(){ return wm("widget.saveToModuleLibrary"); }; })());
    moduleNamePromptCard.appendChild(moduleNamePromptTitle);
    var moduleNameInput = document.createElement('input');
    moduleNameInput.type = 'text';
    moduleNameInput.className = 'dshwv-audionameinput';
    moduleNameInput.maxLength = 20;
    wb(moduleNameInput, "placeholder", (function(){ return function(){ return wm("widget.moduleNameBlankAutomatic"); }; })());
    moduleNamePromptCard.appendChild(moduleNameInput);
    var moduleNameBtns = document.createElement('div');
    moduleNameBtns.className = 'dshwv-cropbtns';
    var moduleNameCancel = document.createElement('button');
    moduleNameCancel.type = 'button';
    moduleNameCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(moduleNameCancel, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    moduleNameCancel.addEventListener('click', closeModuleNamePrompt);
    var moduleNameOk = document.createElement('button');
    moduleNameOk.type = 'button';
    moduleNameOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(moduleNameOk, "textContent", (function(){ return function(){ return wm("widget.save"); }; })());
    moduleNameOk.addEventListener('click', saveModuleNamePrompt);
    moduleNameBtns.appendChild(moduleNameCancel);
    moduleNameBtns.appendChild(moduleNameOk);
    moduleNamePromptCard.appendChild(moduleNameBtns);
    moduleNamePromptMask.appendChild(moduleNamePromptCard);
    document.body.appendChild(moduleNamePromptMask);
    moduleNameInput.addEventListener('keydown', function (e) {
      if (whaleImeKey(e)) return;
      try {
        if (e.key === 'Enter') saveModuleNamePrompt(); else if (e.key === 'Escape') closeModuleNamePrompt();
      } catch (err) {}
    });
    var CROP_BOX = 260;
    var cropMask = document.createElement('div');
    cropMask.className = 'dshwv-cropmask';
    cropMask.style.display = 'none';
    var cropCard = document.createElement('div');
    cropCard.className = 'dshwv-cropwin';
    var cropTitle = document.createElement('div');
    cropTitle.className = 'dshwv-croptitle';
    wb(cropTitle, "textContent", (function(){ return function(){ return wm("widget.cropCharacterImage"); }; })());
    var cropBox = document.createElement('div');
    cropBox.className = 'dshwv-cropbox';
    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = CROP_BOX;
    cropCanvas.height = CROP_BOX;
    cropBox.appendChild(cropCanvas);
    var cropZoom = document.createElement('input');
    cropZoom.type = 'range';
    cropZoom.min = '0.3';
    cropZoom.max = '3';
    cropZoom.step = '0.01';
    cropZoom.value = '1';
    cropZoom.className = 'dshwv-cropzoom';
    var cropZoomWrap = document.createElement('div');
    cropZoomWrap.className = 'dshwv-cropctrl';
    var cropZoomLabel = document.createElement('span');
    cropZoomLabel.className = 'dshwv-croplabel';
    wb(cropZoomLabel, "textContent", (function(){ return function(){ return wm("widget.zoom"); }; })());
    var cropZoomNum = document.createElement('input');
    cropZoomNum.type = 'number';
    cropZoomNum.min = '30';
    cropZoomNum.max = '300';
    cropZoomNum.step = '1';
    cropZoomNum.value = '100';
    cropZoomNum.className = 'dshwv-cropnum';
    cropZoomWrap.appendChild(cropZoomLabel);
    cropZoomWrap.appendChild(cropZoom);
    cropZoomWrap.appendChild(cropZoomNum);
    var cropNameInput = document.createElement('input');
    cropNameInput.type = 'text';
    cropNameInput.className = 'dshwv-cropname';
    cropNameInput.maxLength = 16;
    wb(cropNameInput, "placeholder", (function(){ return function(){ return wm("widget.characterName"); }; })());
    var cropAngleWrap = document.createElement('div');
    cropAngleWrap.className = 'dshwv-cropctrl';
    var cropAngleLabel = document.createElement('span');
    cropAngleLabel.className = 'dshwv-croplabel';
    wb(cropAngleLabel, "textContent", (function(){ return function(){ return wm("widget.rotate"); }; })());
    var cropFlipHBtn = document.createElement('button');
    cropFlipHBtn.type = 'button';
    cropFlipHBtn.className = 'dshwv-cropflip';
    cropFlipHBtn.textContent = '⇋';
    wb(cropFlipHBtn, "title", (function(){ return function(){ return wm("widget.flipHorizontally"); }; })());
    var cropFlipVBtn = document.createElement('button');
    cropFlipVBtn.type = 'button';
    cropFlipVBtn.className = 'dshwv-cropflip';
    cropFlipVBtn.textContent = '⇅';
    wb(cropFlipVBtn, "title", (function(){ return function(){ return wm("widget.flipVertically"); }; })());
    var cropAngle = document.createElement('input');
    cropAngle.type = 'range';
    cropAngle.min = '-360';
    cropAngle.max = '360';
    cropAngle.step = '1';
    cropAngle.value = '0';
    cropAngle.className = 'dshwv-cropzoom';
    var cropAngleNum = document.createElement('input');
    cropAngleNum.type = 'number';
    cropAngleNum.min = '-360';
    cropAngleNum.max = '360';
    cropAngleNum.step = '1';
    cropAngleNum.value = '0';
    cropAngleNum.className = 'dshwv-cropnum';
    cropAngleWrap.appendChild(cropAngleLabel);
    cropAngleWrap.appendChild(cropFlipHBtn);
    cropAngleWrap.appendChild(cropFlipVBtn);
    cropAngleWrap.appendChild(cropAngle);
    cropAngleWrap.appendChild(cropAngleNum);
    var cropBtns = document.createElement('div');
    cropBtns.className = 'dshwv-cropbtns';
    var cropCancelBtn = document.createElement('button');
    cropCancelBtn.type = 'button';
    cropCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(cropCancelBtn, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    var cropResetBtn = document.createElement('button');
    cropResetBtn.type = 'button';
    cropResetBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(cropResetBtn, "textContent", (function(){ return function(){ return wm("widget.reset"); }; })());
    wb(cropResetBtn, "title", (function(){ return function(){ return wm("widget.resetZoomRotationAndPosition"); }; })());
    var cropOkBtn = document.createElement('button');
    cropOkBtn.type = 'button';
    cropOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(cropOkBtn, "textContent", (function(){ return function(){ return wm("widget.confirm"); }; })());
    cropBtns.appendChild(cropCancelBtn);
    cropBtns.appendChild(cropResetBtn);
    cropBtns.appendChild(cropOkBtn);
    cropCard.appendChild(cropTitle);
    cropCard.appendChild(cropBox);
    cropCard.appendChild(cropNameInput);
    cropCard.appendChild(cropZoomWrap);
    cropCard.appendChild(cropAngleWrap);
    cropCard.appendChild(cropBtns);
    cropMask.appendChild(cropCard);
    document.body.appendChild(cropMask);
    cropBox.addEventListener('pointerdown', onCropDown);
    cropBox.addEventListener('pointermove', onCropMove);
    cropBox.addEventListener('pointerup', onCropUp);
    cropBox.addEventListener('pointercancel', onCropUp);
    cropBox.addEventListener('pointerleave', onCropUp);
    cropBox.addEventListener('wheel', onCropWheel, {
      passive: false
    });
    cropAngle.addEventListener('input', function () {
      if (cropState) {
        cropState.rotation = clampAngle(Number(cropAngle.value));
        cropAngleNum.value = String(cropState.rotation);
        positionCrop();
      }
    });
    cropAngleNum.addEventListener('input', function () {
      if (cropState) {
        var v = Math.round(Number(cropAngleNum.value));
        if (!isFinite(v)) v = 0;
        cropState.rotation = clampAngle(v);
        cropAngle.value = String(cropState.rotation);
        positionCrop();
      }
    });
    cropAngleNum.addEventListener('change', function () {
      if (cropState) cropAngleNum.value = String(cropState.rotation);
    });
    cropZoom.addEventListener('input', function () {
      if (cropState) {
        cropState.zoom = Number(cropZoom.value);
        cropZoomNum.value = String(Math.round(cropState.zoom * 100));
        positionCrop();
      }
    });
    cropZoomNum.addEventListener('input', function () {
      if (cropState) {
        var pct = Number(cropZoomNum.value);
        if (!isFinite(pct)) pct = 100;
        cropState.zoom = Math.min(3, Math.max(0.3, pct / 100));
        cropZoom.value = String(cropState.zoom);
        positionCrop();
      }
    });
    cropZoomNum.addEventListener('change', function () {
      if (cropState) cropZoomNum.value = String(Math.round(cropState.zoom * 100));
    });
    cropCancelBtn.addEventListener('click', function () {
      hideCropModal();
    });
    cropResetBtn.addEventListener('click', function () {
      resetCrop();
    });
    cropOkBtn.addEventListener('click', function () {
      confirmCrop();
    });
    cropFlipHBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipCrop('H');
    });
    cropFlipVBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipCrop('V');
    });
    var gifMask = document.createElement('div');
    gifMask.className = 'dshwv-gifmask';
    gifMask.style.display = 'none';
    var gifCard = document.createElement('div');
    gifCard.className = 'dshwv-gifwin';
    var gifTitle = document.createElement('div');
    gifTitle.className = 'dshwv-giftitle';
    wb(gifTitle, "textContent", (function(){ return function(){ return wm("widget.importAnimatedCharacter"); }; })());
    var gifPreviewBox = document.createElement('div');
    gifPreviewBox.className = 'dshwv-gifpreview';
    var gifPreviewImg = document.createElement('img');
    gifPreviewImg.className = 'dshwv-gifpreviewimg';
    wb(gifPreviewImg, "alt", (function(){ return function(){ return wm("widget.animationPreview"); }; })());
    gifPreviewImg.draggable = false;
    gifPreviewBox.appendChild(gifPreviewImg);
    var gifHint = document.createElement('div');
    gifHint.className = 'dshwv-gifhint';
    wb(gifHint, "textContent", (function(){ return function(){ return wm("widget.gifFilesAreImportedAtTheirOriginalSize"); }; })());
    var gifNameInput = document.createElement('input');
    gifNameInput.type = 'text';
    gifNameInput.className = 'dshwv-gifname';
    gifNameInput.maxLength = 16;
    wb(gifNameInput, "placeholder", (function(){ return function(){ return wm("widget.characterName"); }; })());
    var gifBtns = document.createElement('div');
    gifBtns.className = 'dshwv-cropbtns';
    var gifCancelBtn = document.createElement('button');
    gifCancelBtn.type = 'button';
    gifCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(gifCancelBtn, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    var gifOkBtn = document.createElement('button');
    gifOkBtn.type = 'button';
    gifOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(gifOkBtn, "textContent", (function(){ return function(){ return wm("widget.confirm"); }; })());
    gifBtns.appendChild(gifCancelBtn);
    gifBtns.appendChild(gifOkBtn);
    gifCard.appendChild(gifTitle);
    gifCard.appendChild(gifPreviewBox);
    gifCard.appendChild(gifHint);
    gifCard.appendChild(gifNameInput);
    gifCard.appendChild(gifBtns);
    gifMask.appendChild(gifCard);
    document.body.appendChild(gifMask);
    gifCancelBtn.addEventListener('click', hideGifRoleModal);
    gifOkBtn.addEventListener('click', confirmGifRole);
    var gifRoleDataUrl = null;
    var gifRoleFileName = '';
    var gifRoleAnimType = 'gif';
    function openGifRoleModal(dataUrl, fileName, animType) {
      gifRoleDataUrl = dataUrl;
      gifRoleAnimType = animType === 'apng' ? 'apng' : 'gif';
      gifRoleFileName = (fileName || '').replace(/.[^.]+$/, '') || wm("widget.newCharacter");
      if (gifRoleAnimType === 'apng') {
        wb(gifTitle, "textContent", (function(){ return function(){ return wm("widget.importApngCharacter"); }; })());
        wb(gifHint, "textContent", (function(){ return function(){ return wm("widget.apngFilesAreImportedAtTheirOriginalSize"); }; })());
      } else {
        wb(gifTitle, "textContent", (function(){ return function(){ return wm("widget.importGifCharacter"); }; })());
        wb(gifHint, "textContent", (function(){ return function(){ return wm("widget.gifFilesAreImportedAtTheirOriginalSize"); }; })());
      }
      gifNameInput.value = '';
      gifPreviewImg.src = dataUrl;
      gifMask.style.display = 'flex';
    }
    function hideGifRoleModal() {
      gifMask.style.display = 'none';
      gifRoleDataUrl = null;
      gifRoleFileName = '';
      gifRoleAnimType = 'gif';
      gifPreviewImg.src = '';
    }
    function confirmGifRole() {
      try {
        var name = (gifNameInput.value || '').trim().slice(0, 16) || wm("widget.newCharacter");
        if (!gifRoleDataUrl) {
          hideGifRoleModal();
          return;
        }
        fetch(ROLE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            image: gifRoleDataUrl,
            format: gifRoleAnimType
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            roleList = d.roles;
            renderRolePanel();
            var newest = null;
            for (var i = 0; i < roleList.length; i++) {
              if (roleList[i].id !== 'default' && (!newest || roleList[i].createdAt > newest.createdAt)) newest = roleList[i];
            }
            if (newest) applyRole(newest.id, newest.name, roleUrl(newest.id));
            hideGifRoleModal();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var confirmMask = document.createElement('div');
    confirmMask.className = 'dshwv-confirmmask';
    confirmMask.style.display = 'none';
    var confirmCard = document.createElement('div');
    confirmCard.className = 'dshwv-confirmwin';
    var confirmText = document.createElement('div');
    confirmText.className = 'dshwv-confirmtext';
    var confirmBtns = document.createElement('div');
    confirmBtns.className = 'dshwv-confirmbtns';
    var confirmNoBtn = document.createElement('button');
    confirmNoBtn.type = 'button';
    confirmNoBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(confirmNoBtn, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    var confirmYesBtn = document.createElement('button');
    confirmYesBtn.type = 'button';
    confirmYesBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(confirmYesBtn, "textContent", (function(){ return function(){ return wm("widget.delete"); }; })());
    confirmBtns.appendChild(confirmNoBtn);
    confirmBtns.appendChild(confirmYesBtn);
    confirmCard.appendChild(confirmText);
    confirmCard.appendChild(confirmBtns);
    confirmMask.appendChild(confirmCard);
    document.body.appendChild(confirmMask);
    confirmNoBtn.addEventListener('click', hideConfirm);
    confirmYesBtn.addEventListener('click', function () {
      var cb = confirmCb;
      hideConfirm();
      if (cb) cb();
    });
    var audioEditMask = document.createElement('div');
    audioEditMask.className = 'dshwv-audiomask';
    audioEditMask.style.display = 'none';
    var audioEditCard = document.createElement('div');
    audioEditCard.className = 'dshwv-audiowin';
    var audioEditTitle = document.createElement('div');
    audioEditTitle.className = 'dshwv-audiotitle';
    wb(audioEditTitle, "textContent", (function(){ return function(){ return wm("widget.soundSet"); }; })());
    var audioEditName = document.createElement('input');
    audioEditName.type = 'text';
    audioEditName.className = 'dshwv-audionameinput';
    audioEditName.maxLength = 20;
    wb(audioEditName, "placeholder", (function(){ return function(){ return wm("widget.presetName"); }; })());
    var audioEditPressRow = document.createElement('div');
    audioEditPressRow.className = 'dshwv-audiorow';
    var audioEditPressLabel = document.createElement('span');
    audioEditPressLabel.className = 'dshwv-audioslotlabel';
    wb(audioEditPressLabel, "textContent", (function(){ return function(){ return wm("widget.press2"); }; })());
    var audioEditPressWrap = document.createElement('div');
    audioEditPressWrap.className = 'dshwv-slotwrap';
    var audioEditPressBtn = document.createElement('button');
    audioEditPressBtn.type = 'button';
    audioEditPressBtn.className = 'dshwv-slotbtn';
    wb(audioEditPressBtn, "textContent", (function(){ return function(){ return wm("widget.rubberDuckPress"); }; })());
    var audioEditPressPanel = document.createElement('div');
    audioEditPressPanel.className = 'dshwv-slotlist';
    audioEditPressWrap.appendChild(audioEditPressBtn);
    audioEditPressWrap.appendChild(audioEditPressPanel);
    var audioEditPressImport = document.createElement('button');
    audioEditPressImport.type = 'button';
    audioEditPressImport.className = 'dshwv-audiosmallimport';
    wb(audioEditPressImport, "textContent", (function(){ return function(){ return wm("widget.import"); }; })());
    wb(audioEditPressImport, "title", (function(){ return function(){ return wm("widget.importAndTrimPressSound"); }; })());
    audioEditPressRow.appendChild(audioEditPressLabel);
    audioEditPressRow.appendChild(audioEditPressWrap);
    audioEditPressRow.appendChild(audioEditPressImport);
    var audioEditReleaseRow = document.createElement('div');
    audioEditReleaseRow.className = 'dshwv-audiorow';
    var audioEditReleaseLabel = document.createElement('span');
    audioEditReleaseLabel.className = 'dshwv-audioslotlabel';
    wb(audioEditReleaseLabel, "textContent", (function(){ return function(){ return wm("widget.release2"); }; })());
    var audioEditReleaseWrap = document.createElement('div');
    audioEditReleaseWrap.className = 'dshwv-slotwrap';
    var audioEditReleaseBtn = document.createElement('button');
    audioEditReleaseBtn.type = 'button';
    audioEditReleaseBtn.className = 'dshwv-slotbtn';
    wb(audioEditReleaseBtn, "textContent", (function(){ return function(){ return wm("widget.rubberDuckRelease"); }; })());
    var audioEditReleasePanel = document.createElement('div');
    audioEditReleasePanel.className = 'dshwv-slotlist';
    audioEditReleaseWrap.appendChild(audioEditReleaseBtn);
    audioEditReleaseWrap.appendChild(audioEditReleasePanel);
    var audioEditReleaseImport = document.createElement('button');
    audioEditReleaseImport.type = 'button';
    audioEditReleaseImport.className = 'dshwv-audiosmallimport';
    wb(audioEditReleaseImport, "textContent", (function(){ return function(){ return wm("widget.import"); }; })());
    wb(audioEditReleaseImport, "title", (function(){ return function(){ return wm("widget.importAndTrimReleaseSound"); }; })());
    audioEditReleaseRow.appendChild(audioEditReleaseLabel);
    audioEditReleaseRow.appendChild(audioEditReleaseWrap);
    audioEditReleaseRow.appendChild(audioEditReleaseImport);
    var audioEditBtns = document.createElement('div');
    audioEditBtns.className = 'dshwv-cropbtns';
    var audioEditCancel = document.createElement('button');
    audioEditCancel.type = 'button';
    audioEditCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(audioEditCancel, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    var audioEditPlay = document.createElement('button');
    audioEditPlay.type = 'button';
    audioEditPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(audioEditPlay, "textContent", (function(){ return function(){ return wm("widget.preview"); }; })());
    wb(audioEditPlay, "title", (function(){ return function(){ return wm("widget.holdToPreviewThePressSoundReleaseTo"); }; })());
    var audioEditSave = document.createElement('button');
    audioEditSave.type = 'button';
    audioEditSave.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(audioEditSave, "textContent", (function(){ return function(){ return wm("widget.save"); }; })());
    audioEditBtns.appendChild(audioEditCancel);
    audioEditBtns.appendChild(audioEditPlay);
    audioEditBtns.appendChild(audioEditSave);
    audioEditCard.appendChild(audioEditTitle);
    audioEditCard.appendChild(audioEditName);
    audioEditCard.appendChild(audioEditPressRow);
    audioEditCard.appendChild(audioEditReleaseRow);
    audioEditCard.appendChild(audioEditBtns);
    audioEditMask.appendChild(audioEditCard);
    document.body.appendChild(audioEditMask);
    audioEditCancel.addEventListener('click', hideAudioEditor);
    audioEditPlay.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      audioEditPreviewDown();
    });
    audioEditPlay.addEventListener('pointerup', function (e) {
      e.stopPropagation();
      audioEditPreviewUp();
    });
    audioEditPlay.addEventListener('pointercancel', audioEditPreviewUp);
    audioEditPlay.addEventListener('pointerleave', audioEditPreviewUp);
    audioEditSave.addEventListener('click', saveAudioGroup);
    audioEditMask.addEventListener('click', function (e) {
      if (e.target === audioEditMask || e.target === audioEditCard) closeAudioSlotPanels();
    });
    var audioCropMask = document.createElement('div');
    audioCropMask.className = 'dshwv-audiomask';
    audioCropMask.style.display = 'none';
    var audioCropCard = document.createElement('div');
    audioCropCard.className = 'dshwv-audiowin';
    var audioCropTitle = document.createElement('div');
    audioCropTitle.className = 'dshwv-audiotitle';
    wb(audioCropTitle, "textContent", (function(){ return function(){ return wm("widget.trimAudio"); }; })());
    var audioCropCanvas = document.createElement('canvas');
    audioCropCanvas.width = 300;
    audioCropCanvas.height = 120;
    audioCropCanvas.className = 'dshwv-audiocropcanvas';
    var audioCropStart = document.createElement('input');
    audioCropStart.type = 'range';
    audioCropStart.min = '0';
    audioCropStart.max = '100';
    audioCropStart.step = '0.001';
    audioCropStart.value = '0';
    audioCropStart.className = 'dshwv-cropzoom';
    var audioCropStartNum = document.createElement('input');
    audioCropStartNum.type = 'number';
    audioCropStartNum.min = '0';
    audioCropStartNum.step = '0.001';
    audioCropStartNum.value = '0';
    audioCropStartNum.className = 'dshwv-cropnum';
    wb(audioCropStartNum, "title", (function(){ return function(){ return wm("widget.startTimeSeconds"); }; })());
    var audioCropStartRow = document.createElement('div');
    audioCropStartRow.className = 'dshwv-audiosliderrow';
    audioCropStartRow.appendChild(audioCropStart);
    audioCropStartRow.appendChild(audioCropStartNum);
    var audioCropEnd = document.createElement('input');
    audioCropEnd.type = 'range';
    audioCropEnd.min = '0';
    audioCropEnd.max = '100';
    audioCropEnd.step = '0.001';
    audioCropEnd.value = '100';
    audioCropEnd.className = 'dshwv-cropzoom';
    var audioCropEndNum = document.createElement('input');
    audioCropEndNum.type = 'number';
    audioCropEndNum.min = '0';
    audioCropEndNum.step = '0.001';
    audioCropEndNum.value = '0';
    audioCropEndNum.className = 'dshwv-cropnum';
    wb(audioCropEndNum, "title", (function(){ return function(){ return wm("widget.endTimeSeconds"); }; })());
    var audioCropEndRow = document.createElement('div');
    audioCropEndRow.className = 'dshwv-audiosliderrow';
    audioCropEndRow.appendChild(audioCropEnd);
    audioCropEndRow.appendChild(audioCropEndNum);
    audioCropStart.style.display = 'none';
    audioCropEnd.style.display = 'none';
    var audioCropDual = document.createElement('div');
    audioCropDual.className = 'dshwv-dualrange';
    var audioCropDualTrack = document.createElement('div');
    audioCropDualTrack.className = 'dshwv-dualrange-track';
    var audioCropDualFill = document.createElement('div');
    audioCropDualFill.className = 'dshwv-dualrange-fill';
    var audioCropDualStart = document.createElement('div');
    audioCropDualStart.className = 'dshwv-dualrange-thumb';
    var audioCropDualEnd = document.createElement('div');
    audioCropDualEnd.className = 'dshwv-dualrange-thumb';
    audioCropDual.appendChild(audioCropDualTrack);
    audioCropDual.appendChild(audioCropDualFill);
    audioCropDual.appendChild(audioCropDualStart);
    audioCropDual.appendChild(audioCropDualEnd);
    var audioCropDualRow = document.createElement('div');
    audioCropDualRow.className = 'dshwv-audiosliderrow';
    audioCropDualRow.appendChild(audioCropStartNum);
    audioCropDualRow.appendChild(audioCropDual);
    audioCropDualRow.appendChild(audioCropEndNum);
    var audioCropZoomLabel = document.createElement('span');
    audioCropZoomLabel.className = 'dshwv-zoomlabel';
    wb(audioCropZoomLabel, "textContent", (function(){ return function(){ return wm("widget.zoomLevel"); }; })());
    var audioCropZoomRange = document.createElement('input');
    audioCropZoomRange.type = 'range';
    audioCropZoomRange.min = '1';
    audioCropZoomRange.max = '50';
    audioCropZoomRange.step = '1';
    audioCropZoomRange.value = '1';
    audioCropZoomRange.className = 'dshwv-cropzoom';
    wb(audioCropZoomRange, "title", (function(){ return function(){ return wm("widget.waveformZoom"); }; })());
    var audioCropZoomNum = document.createElement('input');
    audioCropZoomNum.type = 'number';
    audioCropZoomNum.min = '1';
    audioCropZoomNum.max = '50';
    audioCropZoomNum.step = '1';
    audioCropZoomNum.value = '1';
    audioCropZoomNum.className = 'dshwv-cropnum';
    wb(audioCropZoomNum, "title", (function(){ return function(){ return wm("widget.zoomLevel2"); }; })());
    var audioCropZoomRow = document.createElement('div');
    audioCropZoomRow.className = 'dshwv-audiosliderrow';
    audioCropZoomRow.appendChild(audioCropZoomLabel);
    audioCropZoomRow.appendChild(audioCropZoomRange);
    audioCropZoomRow.appendChild(audioCropZoomNum);
    var audioCropTime = document.createElement('div');
    audioCropTime.className = 'dshwv-audiotime';
    audioCropTime.textContent = '0.0s – 0.0s';
    var audioCropNameRow = document.createElement('div');
    audioCropNameRow.className = 'dshwv-audiosliderrow';
    audioCropNameRow.style.justifyContent = 'center';
    audioCropNameRow.style.margin = '2px 0';
    var audioCropName = document.createElement('input');
    audioCropName.type = 'text';
    audioCropName.maxLength = 30;
    wb(audioCropName, "placeholder", (function(){ return function(){ return wm("widget.audioClipName"); }; })());
    wb(audioCropName, "title", (function(){ return function(){ return wm("widget.nameForTheTrimmedClipLeaveBlankTo"); }; })());
    audioCropName.style.cssText = 'width:min(60%,240px);flex:0 1 auto;margin:0;text-align:center;border:1px solid rgba(var(--gpt-ink-rgb),.4);border-radius:6px;padding:2px 6px;font-size:12px;color:var(--gpt-ink);background:var(--gpt-surface);box-sizing:border-box';
    audioCropNameRow.appendChild(audioCropName);
    audioCropNameRow.style.marginBottom = '12px';
    function updateAudioCropOkState() {
      try {
        audioCropOk.disabled = false;
      } catch (err) {}
    }
    audioCropName.addEventListener('input', updateAudioCropOkState);
    var audioCropBtns = document.createElement('div');
    audioCropBtns.className = 'dshwv-cropbtns';
    var audioCropCancel = document.createElement('button');
    audioCropCancel.type = 'button';
    audioCropCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(audioCropCancel, "textContent", (function(){ return function(){ return wm("widget.cancel"); }; })());
    var audioCropPlay = document.createElement('button');
    audioCropPlay.type = 'button';
    audioCropPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    wb(audioCropPlay, "textContent", (function(){ return function(){ return wm("widget.preview"); }; })());
    wb(audioCropPlay, "title", (function(){ return function(){ return wm("widget.previewTheTrimmedClip"); }; })());
    var audioCropOk = document.createElement('button');
    audioCropOk.type = 'button';
    audioCropOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    wb(audioCropOk, "textContent", (function(){ return function(){ return wm("widget.confirm"); }; })());
    audioCropOk.disabled = false;
    audioCropBtns.appendChild(audioCropCancel);
    audioCropBtns.appendChild(audioCropPlay);
    audioCropBtns.appendChild(audioCropOk);
    audioCropCard.appendChild(audioCropTitle);
    audioCropCard.appendChild(audioCropCanvas);
    audioCropCard.appendChild(audioCropDualRow);
    audioCropCard.appendChild(audioCropZoomRow);
    audioCropCard.appendChild(audioCropTime);
    audioCropCard.appendChild(audioCropNameRow);
    audioCropCard.appendChild(audioCropBtns);
    audioCropMask.appendChild(audioCropCard);
    document.body.appendChild(audioCropMask);
    audioCropCancel.addEventListener('click', hideAudioCrop);
    audioCropOk.addEventListener('click', confirmAudioCrop);
    audioCropPlay.addEventListener('click', previewAudioCrop);
    audioCropStart.addEventListener('input', onAudioCropStartInput);
    audioCropEnd.addEventListener('input', onAudioCropEndInput);
    audioCropStartNum.addEventListener('input', onAudioCropStartNumInput);
    audioCropStartNum.addEventListener('change', onAudioCropStartNumChange);
    audioCropEndNum.addEventListener('input', onAudioCropEndNumInput);
    audioCropEndNum.addEventListener('change', onAudioCropEndNumChange);
    audioCropZoomRange.addEventListener('input', onAudioCropZoomInput);
    audioCropZoomNum.addEventListener('input', onAudioCropZoomNumInput);
    audioCropZoomNum.addEventListener('change', onAudioCropZoomNumChange);
    audioCropCanvas.addEventListener('wheel', onAudioCropWheel, {
      passive: false
    });
    audioCropCanvas.addEventListener('pointerdown', onAudioCropSelDown);
    audioCropCanvas.addEventListener('pointermove', onAudioCropSelMove);
    audioCropCanvas.addEventListener('pointerup', onAudioCropSelUp);
    audioCropCanvas.addEventListener('pointercancel', onAudioCropSelUp);
    audioCropDual.addEventListener('pointerdown', onAudioCropDualDown);
    audioCropDual.addEventListener('pointermove', onAudioCropDualMove);
    audioCropDual.addEventListener('pointerup', onAudioCropDualUp);
    audioCropDual.addEventListener('pointercancel', onAudioCropDualUp);
    var textBox = document.createElement('div');
    textBox.className = 'dshwv-text';
    var bubbleFrames = new WhaleRendering.BubbleRenderer(textBox, GIF_URL);
    var bubbleTarget, labelEl, amountEl, hintEl, gifEl;
    var bubbleBuilding = false, bubbleSceneEpoch = 0;
    function bindBubbleParts(parts) {
      bubbleTarget = parts.root; labelEl = parts.label; amountEl = parts.amount;
      hintEl = parts.hint; gifEl = parts.gif;
    }
    bindBubbleParts(bubbleFrames.front);
    var bubbleBox = document.createElement('div');
    bubbleBox.className = 'dshwv-pop';
    bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + '<path class="dshwv-bshape" fill="var(--gpt-surface)" stroke="var(--gpt-ink)" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>' + '<ellipse class="dshwv-b1" cx="352" cy="561" rx="37.5" ry="26" fill="var(--gpt-surface)" stroke="var(--gpt-ink)" stroke-width="18"/>' + '<ellipse class="dshwv-b2" cx="442" cy="646" rx="24.5" ry="18" fill="var(--gpt-surface)" stroke="var(--gpt-ink)" stroke-width="18"/>' + '</svg>';
    bubbleBox.appendChild(textBox);
    bubbleBox.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!bubbleShown) return;
      if (costBubbleActive) {
        hideCostBubble();
        return;
      }
      bubbleNext();
    });
    var body = document.createElement('div');
    body.className = 'dshwv-body';
    body.appendChild(img);
    body.appendChild(bubbleBox);
    root.appendChild(body);
    root.appendChild(menuBtn);
    document.body.appendChild(positioner);
    document.body.appendChild(menuBox);
    var dshwCenterX = 44.25;
    var dshwCenterY = 36;
    function measureBubbleCenter() {
      try {
        var svg = bubbleBox && bubbleBox.querySelector('svg');
        var shape = svg && svg.querySelector('.dshwv-bshape');
        if (!shape || typeof shape.getBBox !== 'function') return;
        var bb = shape.getBBox();
        if (!bb || !isFinite(bb.x + bb.y + bb.width + bb.height) || bb.width <= 0 || bb.height <= 0) return;
        var cx = (bb.x + bb.width / 2) / 1026 * 100;
        var cy = (bb.y + bb.height / 2) / 700 * 100;
        if (!isFinite(cx) || !isFinite(cy)) return;
        dshwCenterX = cx;
        dshwCenterY = cy;
        try {
          var s = document.documentElement.style;
          s.setProperty('--dshw-vx', cx + '%');
          s.setProperty('--dshw-vy', cy + '%');
        } catch (err) {}
      } catch (err) {}
    }
    measureBubbleCenter();
    try {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measureBubbleCenter);
    } catch (err) {}
    setTimeout(measureBubbleCenter, 120);
    try {
      window.addEventListener('load', function () {
        measureBubbleCenter();
      });
    } catch (err) {}
    var state = {
      scale: 1.5,
      h: 'right',
      hOff: 0,
      v: 'bottom',
      vOff: 0,
      left: 0,
      top: 0,
      balance: null,
      currency: null,
      todayUsage: null,
      status: 'loading',
      message: '',
      flip: false
    };
    // Persist the intended edge distances, never a temporarily clamped frame.
    var positionIntent = null;
    var SNAP_KEY = 'dshw-snap';
    var SNAP_VER = 3;
    var SNAP_DEFAULTS = {
      mode: 'ratio',
      ratio: {
        L: 10,
        T: 0,
        R: 10,
        B: 15,
        F: 50
      },
      px: {
        L: 80,
        T: 0,
        R: 80,
        B: 80,
        F: -1
      }
    };
    var snapConfig = null;
    function cloneSnap(c) {
      return {
        mode: c.mode,
        ratio: {
          L: c.ratio.L,
          T: c.ratio.T,
          R: c.ratio.R,
          B: c.ratio.B,
          F: c.ratio.F
        },
        px: {
          L: c.px.L,
          T: c.px.T,
          R: c.px.R,
          B: c.px.B,
          F: c.px.F
        }
      };
    }
    function clampSnapKey(mode, key, val, vp) {
      try {
        if (mode === 'px') {
          var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
          var p = snapEdit ? snapEdit.px : snapConfig.px;
          if (key === 'L') return Math.max(0, Math.min(val, p.F >= 0 ? p.F : w / 2));
          if (key === 'R') return Math.max(0, Math.min(val, Math.max(0, w - (p.F >= 0 ? p.F : w / 2))));
          if (key === 'T') return Math.max(0, Math.min(val, Math.max(0, h - p.B)));
          if (key === 'B') return Math.max(0, Math.min(val, Math.max(0, h - p.T)));
          if (key === 'F') return Math.max(p.L, Math.min(val, Math.max(p.L, w - p.R)));
        } else {
          var r = snapEdit ? snapEdit.ratio : snapConfig.ratio;
          if (key === 'L') return Math.max(0, Math.min(val, r.F));
          if (key === 'R') return Math.max(0, Math.min(val, 100 - r.F));
          if (key === 'T') return Math.max(0, Math.min(val, 100 - r.B));
          if (key === 'B') return Math.max(0, Math.min(val, 100 - r.T));
          if (key === 'F') return Math.max(r.L, Math.min(val, 100 - r.R));
        }
      } catch (err) {}
      return val;
    }
    function fixSnapConfig(cfg, mode) {
      try {
        var m = mode || cfg.mode;
        if (m === 'off') return;
        var vp = viewport();
        if (m === 'px') {
          var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
          if (!(cfg.px.F >= 0)) {
            cfg.px.F = Math.round(w / 2);
            if (!(cfg.px.L > 0)) cfg.px.L = 80;
            if (!(cfg.px.R > 0)) cfg.px.R = 80;
            cfg.px.B = Math.max(0, cfg.px.B > 0 ? cfg.px.B : 80);
            cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
          }
          cfg.px.L = Math.max(0, Math.min(cfg.px.L, cfg.px.F));
          cfg.px.R = Math.max(0, Math.min(cfg.px.R, Math.max(0, w - cfg.px.F)));
          cfg.px.F = Math.max(cfg.px.L, Math.min(cfg.px.F, Math.max(cfg.px.L, w - cfg.px.R)));
          cfg.px.L = Math.max(0, Math.min(cfg.px.L, cfg.px.F));
          cfg.px.R = Math.max(0, Math.min(cfg.px.R, Math.max(0, w - cfg.px.F)));
          cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
          cfg.px.B = Math.max(0, Math.min(cfg.px.B, Math.max(0, h - cfg.px.T)));
          cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
        } else {
          cfg.ratio.L = Math.max(0, Math.min(cfg.ratio.L, cfg.ratio.F));
          cfg.ratio.R = Math.max(0, Math.min(cfg.ratio.R, 100 - cfg.ratio.F));
          cfg.ratio.F = Math.max(cfg.ratio.L, Math.min(cfg.ratio.F, 100 - cfg.ratio.R));
          cfg.ratio.L = Math.max(0, Math.min(cfg.ratio.L, cfg.ratio.F));
          cfg.ratio.R = Math.max(0, Math.min(cfg.ratio.R, 100 - cfg.ratio.F));
          cfg.ratio.T = Math.max(0, Math.min(cfg.ratio.T, 100 - cfg.ratio.B));
          cfg.ratio.B = Math.max(0, Math.min(cfg.ratio.B, 100 - cfg.ratio.T));
          cfg.ratio.T = Math.max(0, Math.min(cfg.ratio.T, 100 - cfg.ratio.B));
        }
      } catch (err) {}
    }
    function loadSnapConfig() {
      snapConfig = cloneSnap(SNAP_DEFAULTS);
      try {
        var raw = localStorage.getItem(SNAP_KEY);
        if (raw) {
          var d = JSON.parse(raw);
          if (d && d.v === SNAP_VER) {
            if (d.mode === 'ratio' || d.mode === 'px' || d.mode === 'off') snapConfig.mode = d.mode;
            var keys = ['L', 'T', 'R', 'B', 'F'];
            var i, k;
            if (d.ratio) for (i = 0; i < keys.length; i++) {
              k = keys[i];
              if (typeof d.ratio[k] === 'number' && isFinite(d.ratio[k])) snapConfig.ratio[k] = d.ratio[k];
            }
            if (d.px) for (i = 0; i < keys.length; i++) {
              k = keys[i];
              if (typeof d.px[k] === 'number' && isFinite(d.px[k])) snapConfig.px[k] = d.px[k];
            }
          }
        }
      } catch (err) {}
      fixSnapConfig(snapConfig, 'ratio');
      fixSnapConfig(snapConfig, 'px');
    }
    function saveSnapConfig() {
      try {
        var out = cloneSnap(snapConfig);
        out.v = SNAP_VER;
        localStorage.setItem(SNAP_KEY, JSON.stringify(out));
      } catch (err) {}
    }
    loadSnapConfig();
    var busy = false;


    var drag = null;


    var bubbleShown = false;

    var bubbleRandomActive = false;
    var bubbleRandomLines = null;
    var BUBBLE_STYLE_CLASS = {
      A: 'dshwv-label',
      B: 'dshwv-amount',
      P: 'dshwv-period',
      C: 'dshwv-hint'
    };
    function pickOne(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    function singleCenter(style, text, color, wrap) {
      return [null, {
        t: text,
        s: style,
        c: color || '',
        w: !!wrap
      }, null];
    }
    var RANDOM_GROUPS = [{ w: 1, lines: function () { return { gif: true }; } }];
    function pickRandomLines() {
      var total = 0;
      for (var i = 0; i < RANDOM_GROUPS.length; i++) total += RANDOM_GROUPS[i].w;
      var r = Math.random() * total;
      for (var i = 0; i < RANDOM_GROUPS.length; i++) {
        r -= RANDOM_GROUPS[i].w;
        if (r < 0) return RANDOM_GROUPS[i].lines();
      }
      return RANDOM_GROUPS[RANDOM_GROUPS.length - 1].lines();
    }
    function applyBubbleLines(lines) {
      if (lines && lines.gif) {
        gifEl.style.display = 'block';
        labelEl.style.display = 'none';
        amountEl.style.display = 'none';
        hintEl.style.display = 'none';
        return;
      }
      gifEl.style.display = 'none';
      var els = [labelEl, amountEl, hintEl];
      for (var i = 0; i < 3; i++) {
        var el = els[i], ln = lines && lines[i];
        el.style.display = ln ? '' : 'none';
        el.className = ln ? (BUBBLE_STYLE_CLASS[ln.s] || 'dshwv-label') + (ln.w ? ' dshwv-wrap' : '') : el.className;
        el.textContent = ln ? ln.t : '';
        el.style.color = ln ? ln.c || '' : '';
      }
    }




    
    
    function restoreBubbleLines() {
      gifEl.style.display = 'none';
      labelEl.style.display = '';
      labelEl.className = 'dshwv-label';
      wb(labelEl, "textContent", (function(){ return function(){ return wm("widget.apiBalance"); }; })());
      amountEl.style.display = '';
      hintEl.style.display = '';
      render();
    }

    var bubbleTtlTimer = null;
    var bubbleScene = null;
    var bubbleSeq = bubbleDefaultQueue();
    var bubbleSeqIdx = 0;
    var bubbleRoundOn = false;
    var bubbleCfg = null;
    var bubbleRevision = null;
    var bubbleEditorRevision = null;
    var bubbleOpening = false;
    var bubbleCfgReadSeq = 0;
    var bubbleLib = [];
    function bubbleCloneModule(m) {
      var copy = JSON.parse(JSON.stringify(m || ({})));
      if (m && whaleMoneyTemplates.has(m)) whaleMoneyTemplates.set(copy, whaleMoneyTemplates.get(m));
      return copy;
    }
    function bubbleLibAdd(name, module) {
      try {
        if (!module) return null;
        var id = 'bmod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        var it = {
          id: id,
          name: String(name || '').trim().slice(0, 20) || wm("widget.module") + (bubbleLib.length + 1),
          module: bubbleCloneModule(module)
        };
        bubbleLib.push(it);
        return it;
      } catch (err) {
        return null;
      }
    }
    function bubbleLibDel(id) {
      bubbleLib = bubbleLib.filter(function (x) {
        return x.id !== id;
      });
    }
    function applyBubbleCfgSeq() {
      try {
        if (!bubbleCfg || !Array.isArray(bubbleCfg.items) || !bubbleCfg.items.length) return;
        var seq = [];
        for (var i = 0; i < bubbleCfg.items.length; i++) {
          var it = bubbleCfg.items[i];
          if (it && it.kind === 'choice' && Array.isArray(it.options)) {
            var opts = [];
            for (var ci = 0; ci < it.options.length && ci < 2; ci++) {
              var co = it.options[ci] || ({});
              var cit = co.item || ({});
              var citem = null;
              if (cit.kind === 'custom' && Array.isArray(cit.modules)) citem = {
                kind: 'custom',
                modules: cit.modules
              }; else if (cit.kind === 'random') citem = {
                kind: 'random'
              }; else citem = {
                kind: 'normal'
              };
              bubbleNamedItem(cit, citem);
              opts.push(bubbleNamedItem(co, {
                w: bubbleChoiceWeight(co),
                item: citem
              }));
            }
            if (opts.length) {
              seq.push(bubbleNamedItem(it, {
                kind: 'choice',
                options: opts
              }));
              continue;
            }
          }
          if (it && it.kind === 'custom' && Array.isArray(it.modules)) seq.push({
            kind: 'custom',
            modules: it.modules
          }); else if (it && it.kind === 'random') seq.push({
            kind: 'random'
          }); else seq.push({
            kind: 'normal'
          });
          bubbleNamedItem(it, seq[seq.length - 1]);
        }
        if (seq.length) bubbleSeq = seq;
      } catch (err) {}
    }
    function loadBubbleCfg() {
        var readSeq = ++bubbleCfgReadSeq;
        return fetch(BUBBLE_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d.config !== null && (!d.config || typeof d.config !== 'object')) throw new Error(wt("widgetLevel7.bubbleReadFailed"));
          if (readSeq !== bubbleCfgReadSeq) return d;
          if (d && d.ok) {
            bubbleRevision = d.revision;
            bubbleCfg = d.config;
            bubbleLib = d.config && Array.isArray(d.config.lib) ? JSON.parse(JSON.stringify(d.config.lib)) : [];
            if (d.config === null) bubbleSeq = bubbleDefaultQueue();
            applyBubbleCfgSeq();
          }
          return d;
        });
    }
    function saveBubbleCfg(cfg, okFn) {
      try {
        fetch(BUBBLE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cfg)
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && d.config) {
            ++bubbleCfgReadSeq;
            bubbleRevision = d.revision;
            bubbleEditorRevision = d.revision;
            bubbleCfg = d.config;
            applyBubbleCfgSeq();
            if (okFn) okFn();
          } else if (okFn) okFn(false);
        }).catch(function (error) {
          assetFailure(error);
          if (okFn) okFn(false);
        });
      } catch (err) {
        if (okFn) okFn(false);
      }
    }
    function bubbleRowKeyOf(m) {
      try {
        m = m || ({});
        var n = m.row;
        if (typeof n === 'number' && isFinite(n) && Math.round(n) === n && n > 0) return n;
      } catch (err) {}
      return null;
    }
    function bubbleRowsOf(mods) {
      var out = [];
      if (!Array.isArray(mods)) return out;
      var cur = null;
      for (var i = 0; i < mods.length; i++) {
        var m = mods[i] || ({});
        if (m.type === 'image') {
          out.push([m]);
          cur = null;
          continue;
        }
        if (cur && cur.key !== null && bubbleRowKeyOf(m) === cur.key) {
          cur.row.push(m);
          continue;
        }
        cur = {
          key: bubbleRowKeyOf(m),
          row: [m]
        };
        out.push(cur.row);
      }
      return out;
    }
    function bubbleRowsFlat(rows) {
      var flat = [];
      try {
        if (!Array.isArray(rows)) return flat;
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          if (!row || !row.length) continue;
          var multi = row.length > 1;
          for (var i = 0; i < row.length; i++) {
            var m = row[i];
            if (!m || typeof m !== 'object') continue;
            if (multi) m.row = r + 1; else try {
              delete m.row;
            } catch (err) {}
            flat.push(m);
          }
        }
      } catch (err) {}
      return flat;
    }
    function bubbleRowsCanon(mods) {
      try {
        if (!Array.isArray(mods)) return;
        var flat = bubbleRowsFlat(bubbleRowsOf(mods));
        mods.length = 0;
        for (var i = 0; i < flat.length; i++) mods.push(flat[i]);
      } catch (err) {}
    }
    function bubbleClearAll() {
      ++bubbleSceneEpoch;
      bubbleFrames.cancel();
      if (bubbleTtlTimer) clearTimeout(bubbleTtlTimer);
      bubbleTtlTimer = null;
    }
    function bubbleCloseVisual() {
      bubbleFrames.close();
      bubbleBox.classList.remove('dshwv-pop-open');
    }
    
    function sceneOpen(kind, renderFn, ttlMs, systemItem) {
      if (bubbleScene && bubbleScene.pending && bubbleScene.systemItem && typeof bubbleScene.systemItem.onDiscard === 'function') bubbleScene.systemItem.onDiscard();
      // The queue owns the same generation as its scene. A pending render is
      // never a rollback target: only the last committed frame can be restored.
      var previousScene = bubbleScene && bubbleScene.pending ? bubbleScene.previousScene : bubbleScene;
      bubbleClearAll();
      var entry = bubbleSceneEpoch;
      var scene = { kind: kind, ttlMs: ttlMs || 0, deadline: 0,
        systemItem: systemItem || null, pending: true, previousScene: previousScene };
      bubbleScene = scene;
      whaleSysItem = scene.systemItem;
      bubbleShown = true;
      costBubbleActive = kind === 'cost';
      bubbleRandomActive = kind === 'random';
      function settled(committed) {
        if (entry !== bubbleSceneEpoch || bubbleScene !== scene) return;
        bindBubbleParts(bubbleFrames.front);
        if (!committed) {
          if (systemItem && typeof systemItem.onDiscard === 'function') systemItem.onDiscard();
          // Advancing a system queue consumes its former item. Do not restore
          // a dismissed permanent alert (or its already expired deadline).
          var restore = systemItem && previousScene && previousScene.systemItem ? null : previousScene;
          bubbleScene = restore;
          bubbleShown = !!restore;
          whaleSysItem = restore && restore.systemItem || null;
          costBubbleActive = !!restore && restore.kind === 'cost';
          bubbleRandomActive = !!restore && restore.kind === 'random';
          if (!restore) bubbleCloseVisual();
        } else {
          scene.pending = false;
          scene.previousScene = null;
          if (systemItem && typeof systemItem.isValid === 'function' && !systemItem.isValid()) {
            if (typeof systemItem.onDiscard === 'function') systemItem.onDiscard();
            bubbleScene = null; bubbleShown = false; whaleSysItem = null; costBubbleActive = false;
            bubbleCloseVisual(); whaleSysTick(); return;
          }
          if (systemItem && typeof systemItem.onShown === 'function') systemItem.onShown();
          try { WhaleMoney.refreshBindings(menuBox); } catch (error) {}
          if (ttlMs > 0) scene.deadline = Date.now() + ttlMs;
        }
        armBubbleDeadline();
        whaleSysTick();
      }
      // Build once at entry. Data callbacks cannot repaint either live buffer.
      var opening;
      try { opening = bubbleFrames.open(function (parts) {
        bubbleBuilding = true;
        bindBubbleParts(parts);
        try {
          WhaleMoney.applyLatestQuote({ refreshBindings: false });
          renderFn();
        }
        finally { bubbleBuilding = false; bindBubbleParts(bubbleFrames.front); }
      }, function () {
        if (entry !== bubbleSceneEpoch || bubbleScene !== scene) return;
        bubbleBox.classList.add('dshwv-pop-open');
        WhaleRendering.presentFor(650);
      }); } catch (error) { settled(false); return; }
      Promise.resolve(opening).then(settled, function () { settled(false); });
    }
    function armBubbleDeadline() {
      if (bubbleTtlTimer) clearTimeout(bubbleTtlTimer);
      bubbleTtlTimer = null;
      if (!bubbleScene || !bubbleScene.deadline) return;
      var epoch = bubbleSceneEpoch;
      var remaining = bubbleScene.deadline - Date.now();
      if (remaining <= 0) { bubbleAutoClose(); return; }
      bubbleTtlTimer = setTimeout(function () {
        if (epoch !== bubbleSceneEpoch) return;
        armBubbleDeadline();
      }, remaining);
    }
    window.addEventListener('focus', armBubbleDeadline);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) armBubbleDeadline(); });
    function bubbleAutoClose() {
      bubbleTtlTimer = null;
      if (bubbleScene && bubbleScene.kind === 'cost') {
        if (whaleSysSwapNext()) return;
        hideCostBubble();
        return;
      }
      if (bubbleScene && bubbleScene.kind === 'alert') {
        if (whaleSysSwapNext()) return;
        hideUsageAlertBubble();
        return;
      }
      hideBubble();
    }
    function bubbleResetTtl() {
      try {
        if (bubbleTtlTimer) {
          clearTimeout(bubbleTtlTimer);
          bubbleTtlTimer = null;
        }
      } catch (err) {}
      if (bubbleScene && bubbleScene.ttlMs > 0) bubbleScene.deadline = Date.now() + bubbleScene.ttlMs;
      armBubbleDeadline();
    }
    function bubbleRenderDefault() {
      restoreBubbleLines();
    }
    function bubbleRenderRandom(lines) {
      applyBubbleLines(lines);
    }
    function bubbleRenderCost(amount, notice) {
      notice = notice || WhaleTurnNotice.snapshot({ amount: amount }, state.currency);
      labelEl.style.display = '';
      labelEl.className = 'dshwv-label';
      wb(labelEl, "textContent", (function(notice){ return function(){
        var status = wt('widgetLevel7.' + (notice.completionKind === 'failed' ? 'failed' : notice.completionKind === 'cancelled' ? 'cancelled' : 'complete'));
        var conversation = notice.conversationRef ? wt('widgetLevel7.conversation', { ref: String(notice.conversationRef).slice(0, 12), status: status }) + '\n' : '';
        return conversation + (notice.labelKey ? wt(notice.labelKey) : window.WhaleI18n.message(notice.label));
      }; })(notice));
      labelEl.style.color = '';
      labelEl.style.width = '100%';
      labelEl.style.maxWidth = '100%';
      labelEl.style.whiteSpace = 'pre-line';
      labelEl.style.overflowWrap = 'anywhere';
      labelEl.style.fontSize = 'calc(var(--dshw-u) * 40)';
      labelEl.style.lineHeight = '1.2';
      labelEl.style.letterSpacing = '.02em';
      amountEl.style.display = '';
      amountEl.className = 'dshwv-amount';
      if (notice.amount === null) wb(amountEl, "textContent", (function(notice){ return function(){ return notice.tokens == null ? wt('widgetLevel7.usagePending') : window.WhaleI18n.number(notice.tokens) + ' tokens'; }; })(notice));
      else {
        WhaleMoney.bind(amountEl, (function (target) { return function () {
          var formatted = fmt(notice.amount, notice.currency);
          target.style.fontSize = 'calc(var(--dshw-u) * ' + Math.min(100, 760 / Math.max(8, formatted.length)) + ')';
          return formatted;
        }; })(amountEl));
      }
      amountEl.style.width = '100%';
      amountEl.style.maxWidth = '100%';
      amountEl.style.whiteSpace = 'nowrap';
      amountEl.style.lineHeight = '1.1';
      if (notice.amount === null) amountEl.style.fontSize = 'calc(var(--dshw-u) * 52)';
      wb(amountEl, "title", (function(notice){ return function(){ return notice.noteKey ? wt(notice.noteKey) : window.WhaleI18n.message(notice.note); }; })(notice));
      amountEl.style.color = '#e0433f';
      hintEl.style.display = '';
      wb(hintEl, "textContent", (function(notice){ return function(){ return (notice.amount > 0 && notice.amount < 0.01 ? wt('widgetLevel7.smallSpend') : '') +
        (notice.noticeType === 'account' ? wt('widgetLevel7.accountSinceLast') + wt(notice.concurrent ? 'widgetLevel7.accountConcurrent' : 'widgetLevel7.accountTotal') :
          notice.amount === null ? wt('widgetLevel7.roundUnconfirmed') : notice.costState === 'estimated' ? wt('widget.estimatedFromConfiguredPrices') : wt('widgetLevel7.billConfirmed'));
      }; })(notice));
      wb(hintEl, "title", (function(notice){ return function(){ return notice.noteKey ? wt(notice.noteKey) : window.WhaleI18n.message(notice.note); }; })(notice));
      hintEl.style.color = '';
      hintEl.style.width = '100%';
      hintEl.style.maxWidth = '100%';
      hintEl.style.whiteSpace = 'normal';
      hintEl.style.overflowWrap = 'anywhere';
      hintEl.style.fontSize = 'calc(var(--dshw-u) * 34)';
      hintEl.style.lineHeight = '1.2';
      hintEl.style.minHeight = '0';
    }
    function bubblePickChoiceStep(step) {
      var opts = bubbleChoiceOptions(step);
      if (!opts.length) return null;
      var total = 0;
      for (var i = 0; i < opts.length; i++) total += bubbleChoiceWeight(opts[i]);
      var r = Math.random() * total;
      var acc = 0;
      for (var j = 0; j < opts.length; j++) {
        acc += bubbleChoiceWeight(opts[j]);
        if (r < acc) return opts[j] && opts[j].item || null;
      }
      var last = opts[opts.length - 1];
      return last && last.item || null;
    }
    function bubbleShowSeqNext() {
      var step = bubbleSeq[bubbleSeqIdx];
      if (!step) {
        hideBubble();
        return;
      }
      bubbleSeqIdx++;
      var item = bubbleIsChoice(step) ? bubblePickChoiceStep(step) : step;
      if (!item) {
        hideBubble();
        return;
      }
      if (item.kind === 'random') {
        var lines = pickRandomLines();
        bubbleRandomLines = lines;
        sceneOpen('random', function () {
          bubbleRenderRandom(lines);
        }, BUBBLE_MS);
      } else if (item.kind === 'custom') {
        sceneOpen('custom', function () {
          bubbleRenderModules(item.modules || []);
        }, BUBBLE_MS);
      } else {
        sceneOpen('normal', bubbleRenderDefault, BUBBLE_MS);
      }
    }
    function bubbleModuleFontU(level) {
      var n = Number(level) || 6;
      n = Math.max(1, Math.min(50, Math.round(n)));
      return Math.round(40 + (n - 1) * 200 / 49);
    }
    function bubbleAmountText() {
      return state.balance === null ? '…' : fmt(state.balance, state.currency);
    }
    function bubbleTodayText() {
      return wm("widget.observedToday3") + (state.todayUsage !== null && state.todayUsage !== undefined ? fmt(state.todayUsage, state.currency) : '--');
    }
    function bubbleContentTokenMap(m, snapshot) {
      m = m || ({});
      var values = snapshot || state;
      var v = '';
      var map = {};
      if (m.type === 'balance') {
        v = values.balance === null ? '…' : fmt(values.balance, values.currency);
        map['balance_ds'] = v;
        map['balance_api'] = v;
      } else if (m.type === 'today') {
        v = values.todayUsage !== null && values.todayUsage !== undefined ? fmt(values.todayUsage, values.currency) : '--';
        map['expense_ds'] = v;
        map['expense_api'] = v;
      }
      return map;
    }
    function bubbleTplHelpItems(m) {
      m = m || ({});
      var arr = [];
      function add(k, d) {
        arr.push({
          k: '{' + k + '}',
          d: d
        });
      }
      if (m.type === 'balance') add('balance_ds', wm("widget.balanceAmount")); else if (m.type === 'today') add('expense_ds', wm("widget.observedAmountToday"));
      return arr;
    }
    var dshwvTplHelpEl = null;
    function bubbleTplHelpToggle(m, anchor) {
      try {
        if (!dshwvTplHelpEl) {
          dshwvTplHelpEl = document.createElement('div');
          dshwvTplHelpEl.className = 'dshwv-tplhelp';
          document.body.appendChild(dshwvTplHelpEl);
          document.addEventListener('pointerdown', function (e) {
            if (!dshwvTplHelpEl || dshwvTplHelpEl.style.display === 'none') return;
            try {
              if (e.target && e.target.closest && (e.target.closest('.dshwv-tplq') || e.target.closest('.dshwv-tplhelp'))) return;
            } catch (err) {}
            dshwvTplHelpEl.style.display = 'none';
          }, true);
          document.addEventListener('keydown', function (e) {
      if (whaleImeKey(e)) return;
            if (e.key === 'Escape') dshwvTplHelpEl.style.display = 'none';
          });
        }
        if (dshwvTplHelpEl.style.display === 'block') {
          dshwvTplHelpEl.style.display = 'none';
          return;
        }
        var items = bubbleTplHelpItems(m);
        wb(dshwvTplHelpEl, 'innerHTML', function(){
          var html = wt('widget.availablePlaceholders2');
          if (!items.length) html += wt('widget.noAutomaticPlaceholdersForThisModule');
          for (var i = 0; i < items.length; i++) html += '<div style="margin:1px 0"><b style="color:var(--gpt-accent-strong)">' + items[i].k + '</b> — ' + items[i].d + '</div>';
          return html + wt('widget.otherTextIsKeptAsEnteredLeaveBlank');
        });
        dshwvTplHelpEl.style.display = 'block';
        var r = anchor ? anchor.getBoundingClientRect() : {
          left: 60,
          top: 120,
          right: 180,
          width: 100
        };
        var w = 252;
        var vp = viewport();
        var left = Math.max(4, Math.min(r.right - w, vp.w - w - 4));
        var top = r.bottom + 4;
        var h = dshwvTplHelpEl.offsetHeight || 120;
        if (top + h > vp.h - 4) top = Math.max(4, r.top - h - 4);
        dshwvTplHelpEl.style.left = Math.round(left) + 'px';
        dshwvTplHelpEl.style.top = Math.round(top) + 'px';
      } catch (err) {}
    }
    function localizedModuleField(m, field) {
      var key = field === 'tpl' ? m.tplI18nKey : m.i18nKey;
      return key && /^[a-zA-Z][\w.-]+$/.test(key) && wt(key) !== key ? wt(key) : String(m[field] || '');
    }
    function bubbleContentText(m, autoTxt, snapshot) {
      m = m || ({});
      if (!m.tpl || !String(m.tpl).length) return autoTxt;
      var map = bubbleContentTokenMap(m, snapshot);
      var s = localizedModuleField(m, 'tpl');
      var keys = Object.keys(map).sort(function (a, b) {
        return b.length - a.length;
      });
      for (var i = 0; i < keys.length; i++) s = s.split('{' + keys[i] + '}').join(String(map[keys[i]]));
      return s;
    }
    function bubbleMarqueeDur() {
      return Math.round(1500 + Math.random() * 3000) + 'ms';
    }
    function bubblePickLine(lines, avoidIdx) {
      if (!Array.isArray(lines) || !lines.length) return null;
      if (lines.length === 1) return 0;
      var total = 0;
      for (var i = 0; i < lines.length; i++) total += Math.max(1, Number(lines[i].w) || 1);
      var pick;
      for (var guard = 0; guard < 6; guard++) {
        var r = Math.random() * total;
        var acc = 0;
        pick = lines.length - 1;
        for (var j = 0; j < lines.length; j++) {
          acc += Math.max(1, Number(lines[j].w) || 1);
          if (r < acc) {
            pick = j;
            break;
          }
        }
        if (pick !== avoidIdx) break;
      }
      return pick;
    }
    
    function bubbleRowContentOf(mod) {
      mod = mod || ({});
      if (mod.type === 'balance' || mod.type === 'today') {
        var captured = { balance: state.balance, todayUsage: state.todayUsage, currency: state.currency || 'USD' };
        var moneyText = function () {
          var value = mod.type === 'balance' ? captured.balance === null ? '…' : fmt(captured.balance, captured.currency) :
            wm("widget.observedToday3") + (captured.todayUsage != null ? fmt(captured.todayUsage, captured.currency) : '--');
          return bubbleContentText(mod, value, captured);
        };
        return { txt: moneyText(), line: null, moneyText: moneyText };
      }
      var reminder = whaleMoneyTemplates.get(mod);
      function reminderText(template) {
        return function () { return usageFillText(reminder.i18nKey ? wt(reminder.i18nKey) : template, reminder.below, reminder.amount, reminder.currency); };
      }
      if (mod.type === 'random' && Array.isArray(mod.lines)) {
        var pi = bubblePickLine(mod.lines, mod._lastPick);
        if (pi !== null && pi !== undefined && mod.lines[pi]) {
          mod._lastPick = pi;
          var selectedText = mod.lines[pi].t;
          var selectedMoney = reminder ? reminderText(selectedText) : null;
          return {
            txt: selectedMoney ? selectedMoney() : selectedText,
            line: mod.lines[pi],
            moneyText: selectedMoney
          };
        }
        return {
          txt: '',
          line: null
        };
      }
      var templateText = reminder ? reminderText(reminder.template) : null;
      var semanticText = mod.i18nKey ? function () { return localizedModuleField(mod, 'text'); } : null;
      return { txt: templateText ? templateText() : localizedModuleField(mod, 'text'), line: null, moneyText: templateText || semanticText };
    }
    function bubbleRowsTo(parentEl, mods, frozenRows) {
      if (!parentEl || !Array.isArray(mods)) return;
      if (!frozenRows) { var preview = bubbleSnapshot(mods, false); mods = preview.modules; frozenRows = preview.rows; }
      var old = parentEl.querySelectorAll('.dshwv-trow, .dshwv-mimg');
      for (var i = 0; i < old.length; i++) {
        try {
          WhaleMoney.clearBindings(old[i]);
          parentEl.removeChild(old[i]);
        } catch (err) {}
      }
      var ROW_MAX = 6;
      var MOD_MAX = 6;
      function blockOf(m, rowContent) {
        var line = rowContent ? rowContent.line : null;
        var fSize = m.size;
        var fColor = m.color;
        var fBold = m.bold;
        var fItalic = m.italic;
        var fUl = m.ul;
        var fRgb = m.rgb;
        if (line) {
          if (line.size) fSize = line.size;
          if (line.color) fColor = line.color;
          if (line.bold === false) fBold = false; else if (line.bold === true) fBold = true;
          if (line.italic === false) fItalic = false; else if (line.italic === true) fItalic = true;
          if (line.ul === false) fUl = false; else if (line.ul === true) fUl = true;
          if (line.rgb) fRgb = line.rgb;
        }
        if (m.type === 'random' && fBold !== false) fBold = true;
        var effBg = '';
        var effBgRgb = '';
        {
          if (line && line.bgRgb) effBgRgb = String(line.bgRgb); else if (line && line.bg) effBg = String(line.bg);
          if (!effBgRgb && !effBg) {
            if (m.bgRgb) effBgRgb = String(m.bgRgb); else if (m.bg) effBg = String(m.bg);
          }
        }
        if (effBgRgb === 'true') effBgRgb = 'macaron';
        var needBg = !!(effBgRgb || effBg);
        var row = document.createElement('div');
        row.className = 'dshwv-trow';
        row.dataset.bubbleModule = m.type || 'text';
        var tx = row;
        if (needBg) {
          row.style.padding = '1px 6px';
          row.style.borderRadius = '7px';
          row.style.textShadow = 'none';
          tx = document.createElement('span');
          tx.className = 'dshwv-trowtx';
          row.appendChild(tx);
        }
        tx.textContent = String(rowContent.txt);
        if (rowContent.moneyText) WhaleMoney.bind(tx, rowContent.moneyText);
        row.style.fontSize = 'calc(var(--dshw-u) * ' + bubbleModuleFontU(fSize) + ')';
        if (fBold) row.style.fontWeight = m.type === 'balance' ? '900' : '700'; else if (m.type === 'balance') row.style.fontWeight = '800';
        if (fItalic) row.style.fontStyle = 'italic';
        if (fUl) row.style.textDecoration = 'underline';
        var fFont = m.fontFamily || '';
        if (line && line.fontFamily) fFont = line.fontFamily;
        if (fFont) row.style.fontFamily = fFont;
        var marquee = fRgb;
        function applyTextGradient(target, g) {
          target.classList.add('dshwv-rgb');
          var scheme = g === true ? 'macaron' : String(g || 'macaron');
          if (scheme === 'candy' || scheme === 'rouge' || scheme === 'bamboo' || scheme === 'aurora' || scheme === 'deepsea' || scheme === 'sunset' || scheme === 'forest' || scheme === 'champagne' || scheme === 'lavender' || scheme === 'mint' || scheme === 'lava' || scheme === 'galaxy' || scheme === 'ink' || scheme === 'indigo') target.classList.add('dshwv-rgb-' + scheme);
        }
        if (marquee) {
          var mt = needBg ? tx : row;
          applyTextGradient(mt, marquee);
          mt.style.animationDuration = bubbleMarqueeDur();
        } else if (fColor) {
          row.style.color = fColor;
        }
        if (needBg) {
          if (effBgRgb) {
            row.classList.add('dshwv-bgrgb');
            if (effBgRgb === 'candy' || effBgRgb === 'rouge' || effBgRgb === 'bamboo' || effBgRgb === 'aurora' || effBgRgb === 'deepsea' || effBgRgb === 'sunset' || effBgRgb === 'forest' || effBgRgb === 'champagne' || effBgRgb === 'lavender' || effBgRgb === 'mint' || effBgRgb === 'lava' || effBgRgb === 'galaxy' || effBgRgb === 'ink' || effBgRgb === 'indigo' || effBgRgb === 'macaron') row.classList.add('dshwv-bgrgb-' + effBgRgb);
            row.style.animationDuration = bubbleMarqueeDur();
          } else if (effBg) {
            row.style.background = effBg;
          }
        }
        return {
          el: row,
          tx: tx,
          fSize: fSize,
          mod: m,
          bg: needBg
        };
      }
      function maybeWrap(blk) {
        if (!blk) return;
        try {
          var compFs = window.getComputedStyle ? parseFloat(window.getComputedStyle(blk.el).fontSize) : 0;
          var multNow = bubbleModuleFontU(blk.fSize);
          var capPx = compFs && multNow ? 560 * compFs / multNow : 0;
          if (capPx > 0 && blk.el.scrollWidth > capPx + 2) {
            blk.el.style.maxWidth = capPx + 'px';
            blk.el.style.whiteSpace = 'normal';
            blk.el.style.overflowWrap = 'anywhere';
            blk.el.style.wordBreak = 'break-word';
          } else {
            blk.el.style.whiteSpace = 'nowrap';
          }
        } catch (err) {}
      }
      function enableLinkRun(blk2) {
        try {
          var lmd = blk2 && blk2.mod;
          if (!lmd || lmd.type !== 'link') return;
          if (!parentEl || parentEl !== bubbleTarget) return;
          var u0 = String(lmd.url || '').trim();
          if (!(/^https?:\/\//i).test(u0)) return;
          var lel = blk2.el;
          lel.style.cursor = 'pointer';
          lel.style.pointerEvents = 'auto';
          lel.title = u0;
          lel.addEventListener('click', function (e) {
            try {
              e.preventDefault();
            } catch (err) {}
            try {
              e.stopPropagation();
            } catch (err) {}
            try {
              if (window.whaleDesktop && window.whaleDesktop.openExternal) window.whaleDesktop.openExternal(u0);
              else window.open(u0, '_blank', 'noopener');
            } catch (err) {}
          });
        } catch (err) {}
      }
      var groups = bubbleRowsOf(mods);
      var rows = 0;
      var imgDone = false;
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g];
        if (!grp || !grp.length) continue;
        if (grp[0].type === 'image') {
          var md = grp[0];
          if (imgDone || !md.imgId) continue;
          var im = document.createElement('img');
          im.className = 'dshwv-mimg';
          var scV2 = Number(md.imgScale);
          if (isFinite(scV2) && scV2 > 0) im.style.maxWidth = 'calc(var(--dshw-u) * ' + 540 * Math.max(0.1, Math.min(1, scV2)) + ')';
          im.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(md.imgId);
          im.alt = '';
          im.draggable = false;
          parentEl.appendChild(im);
          imgDone = true;
          continue;
        }
        for (var s = 0; s < grp.length && rows < ROW_MAX; s += MOD_MAX) {
          var chunk = [];
          for (var c = s; c < grp.length && c < s + MOD_MAX; c++) {
            var cm = grp[c] || ({});
            var rowContent = frozenRows.get(cm);
            if (!rowContent || rowContent.txt === '' || rowContent.txt === undefined || rowContent.txt === null) continue;
            chunk.push(blockOf(cm, rowContent));
          }
          if (!chunk.length) continue;
          if (chunk.length === 1) {
            var blk1 = chunk[0];
            parentEl.appendChild(blk1.el);
            enableLinkRun(blk1);
            maybeWrap(blk1);
            rows++;
            continue;
          }
          var capPx2 = 0;
          try {
            var uCss2 = window.getComputedStyle ? window.getComputedStyle(parentEl).getPropertyValue('--dshw-u') : '';
            var uVal2 = parseFloat(uCss2);
            if (uVal2 > 0) capPx2 = 560 * uVal2;
          } catch (err) {}
          var para = document.createElement('div');
          para.className = 'dshwv-trow dshwv-trowline';
          para.style.textAlign = 'center';
          if (capPx2 > 0) para.style.maxWidth = capPx2 + 'px';
          for (var p = 0; p < chunk.length; p++) {
            var pr = chunk[p];
            var pe = pr.el;
            pe.style.display = 'inline';
            pe.style.verticalAlign = 'baseline';
            pe.style.margin = '0 calc(var(--dshw-u) * 6) 0 0';
            if (!pr.bg) {
              pe.style.padding = '1px 0';
            }
            if (pr.bg) {
              pe.style.boxDecorationBreak = 'clone';
              pe.style.webkitBoxDecorationBreak = 'clone';
            }
            {
              pe.style.whiteSpace = 'normal';
              pe.style.overflowWrap = 'anywhere';
              pe.style.wordBreak = 'break-word';
              pe.style.maxWidth = '';
            }
            para.appendChild(pe);
            enableLinkRun(pr);
          }
          parentEl.appendChild(para);
          for (var p2 = 0; p2 < chunk.length; p2++) {}
          rows++;
        }
      }
    }

    
    function bubbleRenderModules(mods) {
      if (!bubbleBuilding) return; // Including switching: only the entry builder may write.
      var snapshot = bubbleSnapshot(mods, true);
      gifEl.style.display = 'none';
      labelEl.style.display = 'none';
      amountEl.style.display = 'none';
      hintEl.style.display = 'none';
      bubbleRowsTo(bubbleTarget, snapshot.modules, snapshot.rows);
    }
    var bubblePreviousPicks = new WeakMap();
    function bubbleSnapshot(mods, remember) {
      var rows = new Map();
      var copies = (Array.isArray(mods) ? mods : []).map(function (original) {
        var copy = bubbleCloneModule(original);
        if (copy.type === 'random') copy._lastPick = remember && original && typeof original === 'object' ? bubblePreviousPicks.get(original) : undefined;
        var content = bubbleRowContentOf(copy);
        if (remember && copy.type === 'random' && original && typeof original === 'object') bubblePreviousPicks.set(original, copy._lastPick);
        rows.set(copy, Object.freeze(content));
        return copy;
      });
      return { modules: copies, rows: rows };
    }
    function bubblePreviewInto(container, mods, widthPx) {
      try {
        if (!container) return;
        WhaleMoney.clearBindings(container);
        container.innerHTML = '';
        var B = Math.max(320, root && (root.offsetWidth || root.getBoundingClientRect().width) || 300);
        var hostW = Math.max(120, container.parentNode && (container.parentNode.clientWidth || container.parentNode.getBoundingClientRect().width) || 408);
        var W = Math.max(120, Math.min(B, hostW));
        container.style.width = W + 'px';
        container.style.transform = 'none';
        container.style.transformOrigin = '';
        container.style.setProperty('--dshw-u', W / 1026 + 'px');
        var halfGap = Math.max(0, (hostW - W) / 2);
        var shiftR = Math.min(10, Math.max(0, Math.round(halfGap)));
        container.style.marginLeft = Math.max(0, Math.round(halfGap)) + shiftR + 'px';
        container.style.marginRight = Math.max(0, Math.round(halfGap) - shiftR) + 'px';
        var pop = document.createElement('div');
        pop.className = 'dshwv-minipop';
        pop.style.aspectRatio = 'auto';
        var cropTop = Math.max(2, Math.round(W * 0.012));
        pop.style.height = Math.round(W * 560 / 1026) + cropTop + 'px';
        pop.style.overflow = 'hidden';
        var stage = document.createElement('div');
        stage.style.position = 'absolute';
        stage.style.left = '0';
        stage.style.top = cropTop + 'px';
        stage.style.width = '100%';
        stage.style.height = Math.round(W * 700 / 1026) + 'px';
        try {
          var svgEl = bubbleBox.querySelector('svg');
          if (svgEl) stage.innerHTML = svgEl.outerHTML;
        } catch (err) {}
        try {
          var tailEls = stage.querySelectorAll('.dshwv-b1, .dshwv-b2');
          for (var t1 = 0; t1 < tailEls.length; t1++) {
            try {
              tailEls[t1].style.display = 'none';
            } catch (err) {}
          }
        } catch (err) {}
        var tb = document.createElement('div');
        tb.className = 'dshwv-text';
        tb.style.opacity = '1';
        tb.style.transition = 'none';
        stage.appendChild(tb);
        pop.appendChild(stage);
        container.appendChild(pop);
        bubbleRowsTo(tb, mods || []);
        if (window.WhaleBubbleLayout) window.WhaleBubbleLayout.observe(tb, {preview:true});
      } catch (err) {}
    }
    function whaleClick() {
      try {
        if (!bubbleOn) return;
        if (window.WhaleAccountView?.mode === 'subscription') { window.WhaleAccountView.toggleBubble(root); return; }
        if (bubbleScene && (bubbleScene.kind === 'cost' || bubbleScene.kind === 'alert')) return;
        if (!bubbleShown) {
          bubbleRoundOn = true;
          bubbleSeqIdx = 0;
          bubbleShowSeqNext();
          return;
        }
        if (!bubbleRoundOn) return;
        if (bubbleSeqIdx <= 1) {
          bubbleResetTtl();
          return;
        }
        bubbleSeqIdx = 0;
        bubbleShowSeqNext();
      } catch (err) {}
    }
    function bubbleNext() {
      try {
        if (!bubbleShown) return;
        if (bubbleScene && bubbleScene.kind === 'cost') {
          hideCostBubble();
          return;
        }
        if (bubbleScene && bubbleScene.kind === 'alert') {
          hideUsageAlertBubble();
          return;
        }
        if (bubbleRoundOn && bubbleSeqIdx < bubbleSeq.length) {
          bubbleShowSeqNext();
          return;
        }
        hideBubble();
      } catch (err) {}
    }
    function showBubble() {
      if (window.WhaleAccountView?.mode === 'subscription') return;
      if (!bubbleOn) return;
      if (costBubbleActive) return;
      bubbleRoundOn = true;
      bubbleSeqIdx = 0;
      bubbleShowSeqNext();
    }
    function hideBubble() {
      for (var pendingItem of [whaleSysItem].concat(whaleSysQueue || [])) { if (pendingItem && typeof pendingItem.onDiscard === 'function') pendingItem.onDiscard(); }
      bubbleClearAll();
      costBubbleActive = false;
      whaleSysQueue = [];
      whaleSysItem = null;
      if (whaleSysTimer) clearTimeout(whaleSysTimer);
      whaleSysTimer = null;
      bubbleRoundOn = false;
      bubbleSeqIdx = 0;
      bubbleScene = null;
      bubbleShown = false;
      bubbleRandomActive = false;
      bubbleRandomLines = null;

      bubbleCloseVisual();
    }
    function showCostBubble(amount, notice) {
      notice = notice || WhaleTurnNotice.snapshot({ amount: amount }, state.currency);
      if (!bubbleOn || !WhaleTurnNotice.enabled(notice, {}, turnCostOn)) return;
      whaleSysPush({
        kind: 'cost',
        amount: amount,
        notice: notice,
        rank: 3
      });
    }
    function hideCostBubble() {
      if (whaleSysItem && typeof whaleSysItem.onDiscard === 'function') whaleSysItem.onDiscard();
      if (whaleSysSwapNext()) return;
      bubbleClearAll();
      costBubbleActive = false;
      bubbleScene = null;
      bubbleShown = false;
      bubbleRandomActive = false;
      bubbleRandomLines = null;
      bubbleCloseVisual();
      whaleSysDone();
    }
    var USAGE_ALERT_TTL = 6500;
    var whaleSysQueue = [];
    var whaleSysItem = null;
    var whaleSysTimer = null;
    function whaleSysPush(item) {
      try {
        if (!bubbleOn || !bubbleBox || !textBox) return false;
        if (!item || !item.kind) return false;
        var rank = Number(item.rank);
        if (!(rank >= 1)) rank = 2;
        item.rank = rank;
        var pos = whaleSysQueue.length;
        for (var i = 0; i < whaleSysQueue.length; i++) {
          if (whaleSysQueue[i].rank > rank) {
            pos = i;
            break;
          }
        }
        whaleSysQueue.splice(pos, 0, item);
        if (whaleSysTimer) {
          clearTimeout(whaleSysTimer);
          whaleSysTimer = null;
        }
        whaleSysTimer = setTimeout(whaleSysTick, 30);
        return true;
      } catch (err) {
        return false;
      }
    }
    function whaleSysTick() {
      if (whaleSysTimer) clearTimeout(whaleSysTimer);
      whaleSysTimer = null;
      try {
        if (!bubbleOn || !bubbleBox || !textBox) {
          for (var pendingItem of [whaleSysItem].concat(whaleSysQueue || [])) { if (pendingItem && typeof pendingItem.onDiscard === 'function') pendingItem.onDiscard(); }
          whaleSysQueue = [];
          whaleSysItem = null;
          return;
        }
        // Scene ownership is authoritative; obsolete booleans cannot strand
        // the queue after a failed, replaced or closed asynchronous render.
        whaleSysItem = bubbleScene && bubbleScene.systemItem || null;
        if (bubbleScene && (bubbleScene.pending || bubbleShown &&
            (bubbleScene.kind === 'cost' || bubbleScene.kind === 'alert'))) return;
        while (whaleSysQueue.length) {
          var item = whaleSysQueue.shift();
          if (item && whaleSysOpenItem(item)) return;
        }
      } catch (err) {}
    }
    function whaleSysOpenItem(item) {
      if (item.kind === 'cost' && !turnCostOn || typeof item.isValid === 'function' && !item.isValid()) {
        if (typeof item.onDiscard === 'function') item.onDiscard();
        return false;
      }
      if (item.kind === 'cost') {
        sceneOpen('cost', function () {
          bubbleRenderCost(item.amount, item.notice);
        }, turnCostCloseMs > 0 ? turnCostCloseMs : 0, item);
      } else {
        sceneOpen('alert', function () {
          bubbleRenderModules(item.mods || []);
        }, item.ttlMs != null ? item.ttlMs : USAGE_ALERT_TTL, item);
      }
      return true;
    }
    function whaleSysDone() {
      try {
        whaleSysItem = bubbleScene && bubbleScene.systemItem || null;
        if (whaleSysTimer) {
          clearTimeout(whaleSysTimer);
          whaleSysTimer = null;
        }
        whaleSysTick();
      } catch (err) {}
    }
    function whaleSysSwapNext() {
      try {
        if (!whaleSysQueue.length || !bubbleOn || !bubbleShown) return false;
        while (whaleSysQueue.length) {
          var item = whaleSysQueue.shift();
          if (item && whaleSysOpenItem(item)) return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    }
    function hideUsageAlertBubble() {
      if (whaleSysSwapNext()) return;
      bubbleClearAll();
      costBubbleActive = false;
      bubbleScene = null;
      bubbleShown = false;
      bubbleRandomActive = false;
      bubbleRandomLines = null;

      bubbleCloseVisual();
      whaleSysDone();
    }
    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }
    function viewport() {
      return {
        w: window.innerWidth || document.documentElement.clientWidth || 1280,
        h: window.innerHeight || document.documentElement.clientHeight || 800
      };
    }
    function rightGap() {
      if (!scrollGapOn) return 0;
      return scrollGapPx > 0 ? scrollGapPx : 0;
    }
    function fmt(balance, currency) {
      return WhaleMoney.formatMoney(balance, currency || state && state.currency || 'USD', true);
    }
    
    function render() {
      // Stopgap guard plus root fix: refresh() no longer calls this function.
      if (bubbleFrames.switching && !bubbleBuilding) return;
      if (!bubbleBuilding) return;
      var captured = { balance: state.balance, todayUsage: state.todayUsage, currency: state.currency || 'USD', status: state.status, message: state.message };
      WhaleMoney.bind(amountEl, function () { return captured.balance === null ? (captured.status === 'error' ? '--' : '…') : fmt(captured.balance, captured.currency); });
      WhaleMoney.bind(hintEl, function () { return captured.status === 'error' ? window.WhaleI18n.message(captured.message || wm("widget.couldNotFetchClickToRetry")) : captured.balance === null ? wm("widget.loading") : wm("widget.observedToday3") + (captured.todayUsage != null ? fmt(captured.todayUsage, captured.currency) : '--'); });
    }
    function express() {
      positioner.style.transform = 'translate3d(' + state.left + 'px,' + state.top + 'px,0)';
      root.classList.toggle('dshwv-left', !!state.flip);
      WhaleRendering.presentFor(drag && drag.active ? 0 : 200);
    }
    function settle() {
      var vp = viewport();
      var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
      var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
      if (drag && drag.active) {
        state.left = clamp(state.left, 0, Math.max(0, vp.w - w - rightGap()));
        state.top = clamp(state.top, 0, Math.max(0, vp.h - h));
        express();
        return;
      }
      if (state.h === 'right') {
        state.left = Math.max(0, vp.w - w - state.hOff - rightGap());
      } else if (state.h === 'left') {
        state.left = state.hOff;
      } else {
        state.left = clamp(state.left, 0, Math.max(0, vp.w - w - rightGap()));
      }
      if (state.v === 'bottom') {
        state.top = Math.max(0, vp.h - h - state.vOff);
      } else if (state.v === 'top') {
        state.top = state.vOff;
      } else {
        state.top = clamp(state.top, 0, Math.max(0, vp.h - h));
      }
      // A minimized/tiny host or an older saved anchor can have negative edge
      // distances. Keep the pet on screen after every viewport restoration.
      state.left = clamp(state.left, 0, Math.max(0, vp.w - w - rightGap()));
      state.top = clamp(state.top, 0, Math.max(0, vp.h - h));
      refreshFlip();
    }
    function snapBounds(vp) {
      var b = {
        L: 0,
        T: 0,
        R: vp.w,
        B: vp.h,
        F: vp.w / 2
      };
      try {
        var cfg = snapConfig;
        if (!cfg || cfg.mode === 'off') return b;
        if (cfg.mode === 'px') {
          b.L = cfg.px.L;
          b.T = cfg.px.T;
          b.R = vp.w - cfg.px.R;
          b.B = vp.h - cfg.px.B;
          b.F = cfg.px.F;
        } else {
          b.L = vp.w * cfg.ratio.L / 100;
          b.T = vp.h * cfg.ratio.T / 100;
          b.R = vp.w * (100 - cfg.ratio.R) / 100;
          b.B = vp.h * (100 - cfg.ratio.B) / 100;
          b.F = vp.w * cfg.ratio.F / 100;
        }
      } catch (err) {}
      return b;
    }
    function snapZones(cx, cyBox, cyImg, vp) {
      var out = {
        zH: null,
        zV: null,
        flip: false
      };
      try {
        var cfg = snapConfig;
        if (!cfg || cfg.mode === 'off') return out;
        var b = snapBounds(vp);
        out.flip = cx < b.F;
        if (cx < b.L) out.zH = 'left'; else if (cx > b.R) out.zH = 'right';
        if (cyBox < b.T) out.zV = 'top'; else if (cyImg > b.B) out.zV = 'bottom';
      } catch (err) {}
      return out;
    }
    function refreshFlip() {
      try {
        // A persistence anchor can describe a free position. Only an actual
        // edge overrides the configured flip line; disabled snapping never flips.
        if (!snapConfig || snapConfig.mode === 'off') {
          state.flip = false;
        } else if (state.h === 'left' && state.hOff === 0) {
          state.flip = true;
        } else if (state.h === 'right' && state.hOff === 0) {
          state.flip = false;
        } else {
          var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
          var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
          var ac = artCenterAt(state.left, state.top, w, h, !!state.flip);
          var vp = viewport();
          state.flip = ac.cx < snapBounds(vp).F;
        }
        express();
      } catch (err) {}
    }
    function artCenterAt(left, top, w, h, flipped) {
      var iw = Math.max(1, w * 0.5945);
      var cx = flipped ? left + iw / 2 : left + w - iw / 2;
      var cy = top + h - iw / 2;
      return {
        cx: cx,
        cy: cy
      };
    }
    function refresh(manual) {
      if (window.WhaleAccountView?.mode === 'subscription') { window.WhaleAccountView.refresh(); return; }
      if (busy) return;
      busy = true;
      if (manual || state.balance === null) state.status = 'loading';
      var ctrl = null;
      var timer = null;
      try {
        ctrl = new AbortController();
        timer = setTimeout(function () {
          try {
            ctrl.abort();
          } catch (err) {}
        }, FETCH_TIMEOUT_MS);
      } catch (err) {}
      fetch(BALANCE_URL + (manual ? '?refresh=1' : ''), {
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        return r.json();
      }).then(function (data) {
        if (data && data.ok) {
          var nb = data.unlimited ? Infinity : Number(data.totalBalance);
          var nc = String(data.currency || 'USD');
          state.balance = nb;
          state.currency = nc;
          WhaleMoney.setNativeCurrency(nc);
          state.message = '';
          state.todayUsage = data.todayUsage !== undefined ? data.todayUsage : null;
          state.unlimited = !!data.unlimited;
          state.providerName = data.providerName || '';
          state.balanceScope = data.balanceScope || '';
          state.stale = !!data.stale;
          wb(root, "title", (function(data){ return function(){ return (data.providerName || '') + ' · ' + (data.balanceLabel || wm("widget.availableApiBalance")) + (data.stale ? wm("widget.lastSuccessfulData") : ''); }; })(data));
          window.dispatchEvent(new CustomEvent('whale-balance', {
            detail: data
          }));
          checkUsageAlerts(nb, state.todayUsage);
          state.status = 'ok';
        } else {
          state.status = 'error';
          state.message = data && data.error ? String(data.error) : wm("widget.couldNotFetch");
          window.dispatchEvent(new CustomEvent('whale-balance', {
            detail: data || ({
              ok: false
            })
          }));
        }
      }).catch(function () {
        state.status = 'error';
        state.message = wm("widget.couldNotFetch");
      }).finally(function () {
        busy = false;
        if (timer) clearTimeout(timer);
      });
    }
    var soundOn = true;
    var soundVol = 0.9;
    var soundSet = 'duck';
    var usageMode = 'ledger';
    var bubbleOn = true;
    var turnCostOn = true;
    var turnCostCloseMs = 5000;
    var costBubbleActive = false;
    var scrollGapOn = false;
    var scrollGapPx = 17;
    var menuBtnHide = false;
    function configSnapshot() {
      return {
            scale: state.scale,
            sound: soundOn,
            vol: soundVol,
            soundSet: soundSet,
            usageMode: usageMode,
            bubbleOn: bubbleOn,
            turnCostOn: turnCostOn,
            turnCostCloseMs: turnCostCloseMs,
            scrollGapOn: scrollGapOn,
            scrollGapPx: scrollGapPx,
            menuBtnHide: menuBtnHide
      };
    }
    // Partial writes prevent defaults and delayed startup reads from erasing unrelated preferences.
    function createSettingsWriter(snapshot, write, failed) {
      var previous = Object.assign({}, snapshot), pending = {}, edited = {}, chain = Promise.resolve();
      return {
        loaded: function (server) {
          var merged = Object.assign({}, server);
          Object.keys(edited).forEach(function (key) { merged[key] = previous[key]; });
          previous = Object.assign({}, previous, merged);
          return merged;
        },
        save: function (current) {
          Object.keys(current).forEach(function (key) {
            if (current[key] !== previous[key]) { pending[key] = current[key]; edited[key] = true; }
          });
          previous = Object.assign({}, current);
          chain = chain.then(function () {
            var patch = Object.assign({}, pending);
            if (!Object.keys(patch).length) return;
            return write(patch).then(function () {
              Object.keys(patch).forEach(function (key) { if (pending[key] === patch[key]) delete pending[key]; });
            });
          }).catch(failed);
          return chain;
        }
      };
    }
    var settingsWriter = createSettingsWriter(configSnapshot(), function (patch) {
      return fetch(SIZE_URL, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
        .then(function (r) { return r.json(); }).then(requireSaved);
    }, assetFailure);
    function saveConfig() {
      return settingsWriter.save(configSnapshot());
    }
    function commitPosition() {
      // Only completed user position edits replace the saved intent.
      try {
        var vp = viewport();
        var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
        var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
        var leftDist = clamp(state.left, 0, Math.max(0, vp.w - w));
        var rightDist = Math.max(0, vp.w - leftDist - w);
        var topDist = clamp(state.top, 0, Math.max(0, vp.h - h));
        var bottomDist = Math.max(0, vp.h - topDist - h);
        var hAnchor = leftDist <= rightDist ? 'left' : 'right';
        var hDistRaw = Math.round(Math.min(leftDist, rightDist));
        var hDist = hAnchor === 'right' && scrollGapOn ? Math.max(0, hDistRaw - rightGap()) : hDistRaw;
        positionIntent = {
          v: 2,
          hAnchor: hAnchor,
          hDist: hDist,
          vAnchor: topDist <= bottomDist ? 'top' : 'bottom',
          vDist: Math.round(Math.min(topDist, bottomDist))
        };
        persistPositionIntent();
        applyAnchorPos();
      } catch (err) {}
    }
    function persistPositionIntent() {
      try {
        if (positionIntent) {
          localStorage.setItem('dshw-pos', JSON.stringify(positionIntent));
          window.dispatchEvent(new Event('whale-position-committed'));
        }
      } catch (err) {}
    }
    function setUsageMode(v) {
      usageMode = 'ledger';
      saveConfig();
      refresh(false);
    }
    function setBubbleOn(v) {
      bubbleOn = !!v;
      bubbleToggle.checked = bubbleOn;
      saveConfig();
      if (!bubbleOn) hideCostBubble();
    }
    function setTurnCostOn(v) {
      turnCostOn = !!v;
      turnCostToggle.checked = turnCostOn;
      turnCostCloseInput.disabled = !turnCostOn;
      saveConfig();
      if (!turnCostOn) hideCostBubble();
    }
    function setTurnCostClose(v) {
      if (!turnCostOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      turnCostCloseMs = n * 1000;
      turnCostCloseInput.value = String(n);
      saveConfig();
    }
    function setScrollGapOn(v) {
      scrollGapOn = !!v;
      scrollGapToggle.checked = scrollGapOn;
      scrollGapInput.disabled = !scrollGapOn;
      saveConfig();
      settle();
      persistPositionIntent();
    }
    function setScrollGapPx(v) {
      if (!scrollGapOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      scrollGapPx = n;
      scrollGapInput.value = String(n);
      saveConfig();
      settle();
      persistPositionIntent();
    }
    function applyMenuBtnHideUI() {
      try {
        menuBtn.classList.toggle('dshwv-menu-btn-hidden', menuBtnHide);
        if (menuBtnHide) resetMenuButtonHover();
      } catch (err) {}
    }
    function setMenuBtnHide(v) {
      menuBtnHide = !!v;
      if (menuHideToggle) menuHideToggle.checked = menuBtnHide;
      saveConfig();
      applyMenuBtnHideUI();
    }
    function scaleToDisplay(s) {
      return Math.round((s - MIN_SCALE) / ((MAX_SCALE - MIN_SCALE) / 19)) + 1;
    }
    function setScale(v) {
      var next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(v))) * 10) / 10;
      var prevTrans = positioner.style.transition;
      positioner.style.transition = 'none';
      var rect = whaleLayoutRect();
      var fx = state.flip ? rect.left : rect.right;
      var fy = rect.bottom;
      state.scale = next;
      root.style.setProperty('--dshw-scale', String(next));
      scaleInput.value = String(next);
      scaleNumber.value = String(scaleToDisplay(next));
      var r2 = whaleLayoutRect();
      var vp = viewport();
      if (state.flip) {
        state.left = Math.min(Math.max(fx, 0), Math.max(0, vp.w - r2.width));
      } else {
        state.left = Math.min(Math.max(fx - r2.width, 0), Math.max(0, vp.w - r2.width));
      }
      state.top = Math.min(Math.max(fy - r2.height, 0), Math.max(0, vp.h - r2.height));
      express();
      commitPosition();
      saveConfig();
      requestAnimationFrame(function () {
        positioner.style.transition = prevTrans;
      });
    }
    function setVol(v) {
      var next = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100;
      soundVol = next;
      soundOn = next > 0;
      volInput.value = String(next);
      volPct.textContent = Math.round(next * 100) + '%';
      try {
        if (pressAudio) pressAudio.volume = next;
        if (releaseAudio) releaseAudio.volume = next;
      } catch (err) {}
      saveConfig();
    }
    function setSoundSet(v) {
      soundSet = typeof v === 'string' && v ? v : 'duck';
      setAudioBtnText(audioGroupName(soundSet));
      applySoundSet();
      saveConfig();
    }
    var SQUISH = 'scaleY(0.88) scaleX(1.05)';
    var pressAudio = null;
    var releaseAudio = null;
    var pressing = false;
    var pressEnded = false;
    var releasePlayed = false;
    var releaseTimer = null;
    function applySoundSet() {
      try {
        if (pressAudio) { pressAudio.pause(); pressAudio.removeAttribute('src'); pressAudio.load(); }
        if (releaseAudio) { releaseAudio.pause(); releaseAudio.removeAttribute('src'); releaseAudio.load(); }
        if (window.WhaleAudio) { window.WhaleAudio.stop('gesture'); ['press', 'release'].forEach(function (slot) { if (!audioGroupSlotEmpty(soundSet, slot)) window.WhaleAudio.warm('/dsh-whale/sound/' + slot + '.mp3?set=' + encodeURIComponent(soundSet)).catch(function () {}); }); pressAudio = null; releaseAudio = null; return; }
        var pEmpty = audioGroupSlotEmpty(soundSet, 'press');
        var rEmpty = audioGroupSlotEmpty(soundSet, 'release');
        if (pEmpty) {
          pressAudio = null;
        } else {
          pressAudio = new Audio('/dsh-whale/sound/press.mp3?set=' + soundSet);
          pressAudio.preload = 'auto';
          pressAudio.volume = soundVol;
        }
        if (rEmpty) {
          releaseAudio = null;
        } else {
          releaseAudio = new Audio('/dsh-whale/sound/release.mp3?set=' + soundSet);
          releaseAudio.preload = 'auto';
          releaseAudio.volume = soundVol;
        }
      } catch (err) {}
    }
    function feedback(event) {
      var url = '/dsh-whale/sound/' + event + '.mp3?set=' + encodeURIComponent(soundSet);
      if (audioGroupSlotEmpty(soundSet, event)) url = '';
      window.WhaleFeedbackSources = window.WhaleFeedbackSources || {};
      window.WhaleFeedbackSources[event] = url;
      if (window.WhaleFeedback) return window.WhaleFeedback.play(event, url, soundOn ? soundVol : 0);
      return false;
    }
    function playPress() {
      releasePlayed = false;
      if (feedback('press')) return;
      if (!soundOn || !pressAudio) return;
      try { if (releaseAudio) releaseAudio.pause(); pressAudio.currentTime = 0; pressAudio.play().catch(function () {}); } catch (err) {}
    }
    function playRelease() {
      if (releasePlayed) return;
      releasePlayed = true;
      if (feedback('release')) return;
      if (!soundOn || !releaseAudio) return;
      try { if (pressAudio) pressAudio.pause(); releaseAudio.currentTime = 0; releaseAudio.play().catch(function () {}); } catch (err) {}
    }
    function pressDown() {
      if (window.WhaleGesture) window.WhaleGesture.apply(body, true, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { body.style.transitionDuration = '75ms'; body.style.transform = SQUISH; }
      pressing = true; playPress();
    }
    function pressUp() {
      if (window.WhaleGesture) window.WhaleGesture.apply(body, false, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { body.style.transitionDuration = '140ms'; body.style.transform = 'scaleY(1) scaleX(1)'; }
      pressing = false; playRelease();
    }    var menuOpen = false;
    var menuPositionFrame = 0;
    new ResizeObserver(function () {
      if (!menuOpen || menuPositionFrame) return;
      // Read/write menu geometry in the next frame, never while the browser is
      // delivering resize observations for that same menu.
      menuPositionFrame = requestAnimationFrame(function () {
        menuPositionFrame = 0;
        if (menuOpen) positionMenu();
      });
    }).observe(menuBox);
    function toggleMenu() {
      menuOpen = !menuOpen;
      if (menuOpen) positionMenu();
      menuBox.classList.toggle('dshwv-menu-open', menuOpen);
      if (menuOpen) showMenuButton();
      if (!menuOpen) { closeUsagePanel(); closeFxInfo(); }
    }
    function closeMenu() {
      menuOpen = false;
      closeFxInfo();
      if (menuPositionFrame) cancelAnimationFrame(menuPositionFrame);
      menuPositionFrame = 0;
      menuBox.classList.remove('dshwv-menu-open');
      closeRolePanel();
      closeAudioGroupPanel();
      closeUsagePanel();
      positioner.style.transition = '';
    }
    function snapCheck() {
      if (!snapConfig || snapConfig.mode === 'off') return;
      var rect = whaleLayoutRect();
      var vp = viewport();
      var w = rect.width, h = rect.height;
      var left = rect.left, top = rect.top;
      var ac = artCenterAt(left, top, w, h, !!state.flip);
      var z = snapZones(ac.cx, top + h / 2, ac.cy, vp);
      var moved = false;
      if (z.zH === 'left') {
        state.h = 'left';
        state.hOff = 0;
        left = 0;
        moved = true;
      } else if (z.zH === 'right') {
        state.h = 'right';
        state.hOff = 0;
        left = vp.w - w - rightGap();
        moved = true;
      } else {
        state.h = null;
        state.hOff = left;
      }
      if (z.zV === 'top') {
        state.v = 'top';
        state.vOff = 0;
        top = 0;
        moved = true;
      } else if (z.zV === 'bottom') {
        state.v = 'bottom';
        state.vOff = 0;
        top = Math.max(0, vp.h - h);
        moved = true;
      } else {
        state.v = 'bottom';
        state.vOff = Math.max(0, vp.h - top - h);
      }
      state.flip = z.flip;
      if (moved) {
        state.left = left;
        state.top = top;
        settle();
      } else {
        express();
      }
    }
    function positionMenu() {
      try {
        var r = positioner.getBoundingClientRect();
        var b = menuBtn.getBoundingClientRect();
        var vp = viewport();
        var onLeft = r.left + root.offsetWidth / 2 < vp.w / 2;
        var width = menuBox.offsetWidth, height = menuBox.offsetHeight;
        var assetTop = r.top + root.offsetHeight * (1 - 0.5945);
        var left = onLeft ? b.left : b.right - width;
        var top = assetTop - height - 10;
        if (top < 8) {
          if (b.right + 12 + width <= vp.w - 8) left = b.right + 12;
          else if (b.left - 12 - width >= 8) left = b.left - 12 - width;
          else if (b.bottom + height + 10 <= vp.h - 8) top = b.bottom + 10;
          if (top < 8) top = b.top - height / 2;
        }
        menuBox.style.left = clamp(left, 8, Math.max(8, vp.w - width - 8)) + 'px';
        menuBox.style.right = 'auto';
        menuBox.style.top = clamp(top, 8, Math.max(8, vp.h - height - 8)) + 'px';
        menuBox.style.bottom = 'auto';
        menuBox.style.transformOrigin = onLeft ? 'bottom left' : 'bottom right';
      } catch (err) {}
    }
    var ROLE_URL = '/dsh-whale/roles.json';
    var currentRole = {
      id: 'default',
      name: wm("widget.gptDragonGirl"),
      url: IMG_URL
    };
    var roleList = [];
    var badRoleIds = Object.create(null);
    var fallbackInProgress = false;
    function recoverBrokenRole() {
      if (fallbackInProgress || img.complete && img.naturalWidth > 0) return;
      var failedId = currentRole.id;
      try { failedId = localStorage.getItem('dshw-role') || failedId; } catch (err) {}
      if (failedId && failedId !== 'default') badRoleIds[failedId] = true;
      if (new URL(img.currentSrc || img.src, location.href).href === new URL(IMG_URL, location.href).href) {
        assetNotice(wm("widget.couldNotLoadTheBuiltInCharacterRestart"));
        return;
      }
      fallbackInProgress = true;
      applyRole('default', wm("widget.gptDragonGirl"), IMG_URL, true);
    }
    window.addEventListener('whale-role-fallback', recoverBrokenRole);
    function loadRoles() {
      try {
        fetch(ROLE_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (!d || !d.ok || !Array.isArray(d.roles)) return;
          roleList = d.roles;
          assetWarning(d);
          renderRolePanel();
          if (fallbackInProgress) return;
          var saved = '';
          try {
            saved = localStorage.getItem('dshw-role') || '';
          } catch (err) {}
          var found = null;
          for (var i = 0; i < roleList.length; i++) {
            if (roleList[i].id === saved) {
              found = roleList[i];
              break;
            }
          }
          if (found && !badRoleIds[found.id]) {
            if (currentRole.id !== found.id) applyRole(found.id, found.name, found.url); else renderRolePanel();
          } else if (saved && saved !== 'default') {
            applyRole('default', wm("widget.gptDragonGirl"), IMG_URL);
          }
        }).catch(function () {});
      } catch (err) {}
    }
    function setRoleBtnText(t) {
      try {
        wb(roleBtnLabel, "textContent", (function(t){ return function(){ return t; }; })(t));
      } catch (err) {}
    }
    function setAudioBtnText(t) {
      try {
        wb(audioGroupBtnLabel, "textContent", (function(t){ return function(){ return t; }; })(t));
      } catch (err) {}
    }
    var MARQ_SPEED = 40;
    function bindNameMarquee(item, nameEl) {
      try {
        if (!item || !nameEl) return;
        var timer = null;
        function stop() {
          try {
            if (timer) {
              clearTimeout(timer);
              timer = null;
            }
            var t = nameEl.querySelector('.dshwv-nameinner');
            if (!t) return;
            t.style.transitionTimingFunction = '';
            t.style.transitionDuration = '';
            t.style.transform = '';
            while (t.children && t.children.length > 1) t.removeChild(t.children[t.children.length - 1]);
          } catch (err) {}
        }
        function distOf() {
          try {
            var t = nameEl.querySelector('.dshwv-nameinner');
            if (!t) return 0;
            return t.scrollWidth / 2;
          } catch (err) {
            return 0;
          }
        }
        function textWOf() {
          try {
            var t = nameEl.querySelector('.dshwv-nameinner');
            if (!t || !t.children || !t.children.length) return 0;
            return t.children[0].offsetWidth || 0;
          } catch (err) {
            return 0;
          }
        }
        function ensureDup() {
          var t = nameEl.querySelector('.dshwv-nameinner');
          if (!t || !t.children || t.children.length >= 2) return t;
          var first = t.children[0];
          var c = document.createElement('span');
          c.className = 'dshwv-namecopy';
          wb(c,'textContent',function(){return first.textContent;});
          t.appendChild(c);
          return t;
        }
        function cycle() {
          var dist = distOf();
          var dur = Math.max(200, dist / MARQ_SPEED * 1000);
          timer = setTimeout(function () {
            try {
              cycle();
            } catch (err) {}
          }, dur + 40);
          var t = nameEl.querySelector('.dshwv-nameinner');
          if (!t) return;
          t.style.transitionTimingFunction = 'linear';
          t.style.transitionDuration = '0ms';
          t.style.transform = 'translateX(0px)';
          void t.offsetWidth;
          t.style.transitionDuration = dur + 'ms';
          t.style.transform = 'translateX(' + -dist + 'px)';
        }
        item.addEventListener('mouseenter', function () {
          try {
            stop();
            if (textWOf() <= nameEl.clientWidth + 1) return;
            ensureDup();
            cycle();
          } catch (err) {}
        });
        item.addEventListener('mouseleave', stop);
      } catch (err) {}
    }
    function makeNameCell(className, text) {
      var outer = document.createElement('span');
      outer.className = className;
      var inner = document.createElement('span');
      inner.className = 'dshwv-nameinner';
      var c = document.createElement('span');
      c.className = 'dshwv-namecopy';
      wb(c, "textContent", (function(text){ return function(){ return text; }; })(text));
      inner.appendChild(c);
      outer.appendChild(inner);
      return outer;
    }
    var roleLoadGeneration = 0;
    function applyRole(id, name, url, isFallback) {
      var generation = ++roleLoadGeneration;
      var readyImage = new Image();
      readyImage.src = url;
      return Promise.all([readyImage.decode(), WhaleRendering.hitCache.prepare(url)]).then(function () {
        if (generation !== roleLoadGeneration) return false;
        currentRole = {
        id: id,
        name: name,
        url: url
      };
      img.src = url;
      setRoleBtnText(name);
      try {
        localStorage.setItem('dshw-role', id);
      } catch (err) {}
      setupHitTest(url);
      closeRolePanel();
      renderRolePanel();
        WhaleRendering.presentFor(200);
        delete badRoleIds[id];
        fallbackInProgress = false;
        if (isFallback) assetNotice(wm("widget.thePreviousImageCouldNotLoadGptDragon"));
        return true;
      }).catch(function () {
        if (generation !== roleLoadGeneration) return false;
        badRoleIds[id] = true;
        fallbackInProgress = false;
        assetNotice(isFallback ? wm("widget.couldNotLoadTheBuiltInCharacterRestart") : wm("widget.couldNotReadTheImageTheCurrentCharacter"));
        if (!isFallback) recoverBrokenRole();
        return false;
      });
    }
    function roleUrl(id) {
      if (id === 'default') return IMG_URL;
      return '/dsh-whale/role-image.png?id=' + encodeURIComponent(id);
    }
    function toggleRolePanel() {
      if (rolePanel.classList.contains('dshwv-rolelist-open')) {
        closeRolePanel();
        return;
      }
      try {
        var b = roleBtn.getBoundingClientRect();
        var vp = viewport();
        var panelW = Math.max(200, Math.round(b.width));
        rolePanel.style.width = panelW + 'px';
        rolePanel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        rolePanel.style.top = b.bottom + 6 + 'px';
        rolePanel.style.display = 'block';
        rolePanel.classList.add('dshwv-rolelist-open');
      } catch (err) {}
    }
    function closeRolePanel() {
      rolePanel.classList.remove('dshwv-rolelist-open');
      rolePanel.style.display = 'none';
    }
    function renderRolePanel() {
      try {
        rolePanel.innerHTML = '';
        roleList.forEach(function (r) {
          var item = document.createElement('div');
          item.className = 'dshwv-roleitem' + (currentRole.id === r.id ? ' dshwv-roleitem-cur' : '');
          var thumb = document.createElement('img');
          thumb.className = 'dshwv-rolethumb';
          thumb.src = r.url;
          thumb.alt = '';
          thumb.draggable = false;
          var name = makeNameCell('dshwv-rolename', r.name);
          var nameWrap = document.createElement('span');
          nameWrap.className = 'dshwv-rolenamewrap';
          if (r.format === 'gif' || r.format === 'apng') {
            var gifTag = document.createElement('span');
            gifTag.className = 'dshwv-roleGifTag';
            gifTag.textContent = r.format === 'apng' ? 'APNG' : 'GIF';
            nameWrap.appendChild(gifTag);
          }
          nameWrap.appendChild(name);
          item.appendChild(thumb);
          item.appendChild(nameWrap);
          var pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'dshwv-rolepin' + (r.pinned ? ' on' : '');
          pin.textContent = '📌';
          wb(pin, "title", (function(r){ return function(){ return r.pinned ? wm("widget.unpin") : wm("widget.pin"); }; })(r));
          pin.addEventListener('click', function (e) {
            e.stopPropagation();
            togglePin(r.id, !r.pinned);
          });
          item.appendChild(pin);
          if (r.id !== 'default') {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-roledel';
            del.textContent = '✕';
            wb(del, "title", (function(){ return function(){ return wm("widget.deleteCharacter2"); }; })());
            del.addEventListener('click', function (e) {
              e.stopPropagation();
              deleteRole(r.id);
            });
            item.appendChild(del);
          }
          item.addEventListener('click', function () {
            applyRole(r.id, r.name, roleUrl(r.id));
          });
          bindNameMarquee(item, name);
          rolePanel.appendChild(item);
        });
      } catch (err) {}
    }
    function togglePin(id, pinned) {
      try {
        fetch('/dsh-whale/role-pin.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: id,
            pinned: pinned
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            roleList = d.roles;
            renderRolePanel();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var confirmCb = null;
    function showDeleteConfirm(text, cb) { return showConfirm(text, cb, wm("widget.delete")); }
    function showConfirm(text, cb, okLabel) {
      confirmCb = cb || null;
      wb(confirmText, "textContent", (function(text){ return function(){ return text; }; })(text));
      try {
        if (!okLabel) okLabel = wm("widget.confirm2");
        wb(confirmYesBtn, "textContent", function(){ return okLabel; });
      } catch (err) {}
      confirmMask.style.display = 'flex';
    }
    function hideConfirm() {
      confirmMask.style.display = 'none';
      confirmCb = null;
    }
    function deleteRole(id) {
      var r = null;
      for (var i = 0; i < roleList.length; i++) if (roleList[i].id === id) {
        r = roleList[i];
        break;
      }
      showDeleteConfirm(wexpr((function(r,id){ return function(){ return wm("widget.deleteCharacter") + (r ? r.name : id) + wm("widget.label"); }; })(r,id)), function () {
        try {
          fetch('/dsh-whale/role-delete.json', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: id
            })
          }).then(function (res) {
            return res.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.roles)) {
              roleList = d.roles;
              renderRolePanel();
              if (currentRole.id === id) applyRole('default', wm("widget.gptDragonGirl"), IMG_URL);
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    var cropState = null;
    function countGifFrames(bytes) {
      try {
        var head = '';
        for (var i = 0; i < 6; i++) head += String.fromCharCode(bytes[i]);
        if (head !== 'GIF87a' && head !== 'GIF89a') return 1;
        var flags = bytes[10];
        var hasGct = (flags & 0x80) !== 0;
        var gctSize = 3 * (1 << (flags & 0x07) + 1);
        var pos = 13 + (hasGct ? gctSize : 0);
        var frames = 0;
        while (pos + 1 < bytes.length) {
          var b = bytes[pos];
          if (b === 0x3b) break;
          if (b === 0x2c) {
            frames++;
            var lctFlag = bytes[pos + 9] & 0x80;
            var lctSize = lctFlag ? 3 * (1 << (bytes[pos + 9] & 0x07) + 1) : 0;
            pos += 10 + lctSize;
            if (pos >= bytes.length) break;
            pos++;
            while (pos < bytes.length) {
              var sz = bytes[pos];
              pos++;
              if (sz === 0) break;
              pos += sz;
            }
          } else if (b === 0x21) {
            pos += 2;
            while (pos < bytes.length) {
              var sz2 = bytes[pos];
              pos++;
              if (sz2 === 0) break;
              pos += sz2;
            }
          } else {
            break;
          }
        }
        return Math.max(1, frames);
      } catch (err) {
        return 1;
      }
    }
    function isAnimatedPng(bytes) {
      return WhaleMediaGuard.isAnimatedPng(bytes);
    }
    async function onRoleFileChosen(input) {
      try {
        var f = input && input.files && input.files[0];
        input.value = '';
        if (!f) return;
        WhaleMediaGuard.checkFile(f, 'role');
        var bytes = await f.arrayBuffer();
        var media = WhaleMediaGuard.inspectImage(bytes, 'role');
        var dataUrl = await mediaDataUrl(new Blob([bytes], { type: media.mime }));
        if (media.animated && (media.format === 'gif' || media.format === 'apng')) openGifRoleModal(dataUrl, f.name, media.format);
        else if (media.animated) throw new Error(wm("widget.chooseGifOrApngToPreserveAnimation"));
        else openCropModal(dataUrl, f.name);
      } catch (err) { assetNotice(err.message); }
    }
    function openCropModal(dataUrl, fileName) {
      try {
        var imgEl = new Image();
        imgEl.onload = function () {
          cropState = {
            img: imgEl,
            zoom: 1,
            ox: 0,
            oy: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            baseScale: Math.max(CROP_BOX / imgEl.width, CROP_BOX / imgEl.height)
          };
          cropNameInput.value = '';
          cropZoom.value = '1';
          cropZoomNum.value = '100';
          cropAngle.value = '0';
          cropAngleNum.value = '0';
          positionCrop();
          cropMask.style.display = 'flex';
        };
        imgEl.onerror = function () { assetNotice(wm("widget.couldNotDecodeTheImageChooseAnotherFile")); };
        imgEl.src = dataUrl;
      } catch (err) {}
    }
    function clampAngle(v) {
      var n = Number(v);
      if (!isFinite(n)) return 0;
      return Math.min(360, Math.max(-360, Math.round(n)));
    }
    function cropDisplaySize() {
      var s = cropState.baseScale * cropState.zoom;
      var w = cropState.img.width * s;
      var h = cropState.img.height * s;
      var rad = cropState.rotation * Math.PI / 180;
      var c = Math.abs(Math.cos(rad));
      var sn = Math.abs(Math.sin(rad));
      return {
        w: w * c + h * sn,
        h: w * sn + h * c,
        s: s
      };
    }
    function positionCrop() {
      if (!cropState) return;
      var d = cropDisplaySize();
      var maxOx = Math.max(0, (d.w - CROP_BOX) / 2);
      var maxOy = Math.max(0, (d.h - CROP_BOX) / 2);
      cropState.ox = Math.min(maxOx, Math.max(-maxOx, cropState.ox));
      cropState.oy = Math.min(maxOy, Math.max(-maxOy, cropState.oy));
      drawCrop();
    }
    function drawCrop() {
      try {
        if (!cropState) return;
        var ctx = cropCanvas.getContext('2d');
        var s = cropState.baseScale * cropState.zoom;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s;
        var h = cropState.img.height * s;
        ctx.clearRect(0, 0, CROP_BOX, CROP_BOX);
        ctx.save();
        ctx.translate(CROP_BOX / 2 + cropState.ox, CROP_BOX / 2 + cropState.oy);
        ctx.rotate(rad);
        ctx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        ctx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch (err) {}
    }
    var cropDrag = null;
    function onCropDown(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      cropDrag = {
        x: e.clientX,
        y: e.clientY,
        ox: cropState.ox,
        oy: cropState.oy
      };
    }
    function onCropMove(e) {
      if (!cropDrag || !cropState) return;
      cropState.ox = cropDrag.ox + (e.clientX - cropDrag.x);
      cropState.oy = cropDrag.oy + (e.clientY - cropDrag.y);
      positionCrop();
    }
    function onCropUp() {
      cropDrag = null;
    }
    function onCropWheel(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var delta = (e.deltaY > 0 ? -1 : 1) * 0.05;
      cropState.zoom = Math.min(3, Math.max(0.3, cropState.zoom + delta));
      cropZoom.value = String(Math.round(cropState.zoom * 100) / 100);
      cropZoomNum.value = String(Math.round(cropState.zoom * 100));
      positionCrop();
    }
    function resetCrop() {
      if (!cropState) return;
      cropState.zoom = 1;
      cropState.ox = 0;
      cropState.oy = 0;
      cropState.rotation = 0;
      cropState.flipH = false;
      cropState.flipV = false;
      cropZoom.value = '1';
      cropZoomNum.value = '100';
      cropAngle.value = '0';
      cropAngleNum.value = '0';
      cropFlipHBtn.classList.remove('dshwv-cropflip-on');
      cropFlipVBtn.classList.remove('dshwv-cropflip-on');
      positionCrop();
    }
    var cropFlipTimer = null;
    function flipCrop(axis) {
      if (!cropState) return;
      try {
        if (cropFlipTimer) {
          clearTimeout(cropFlipTimer);
          cropFlipTimer = null;
        }
      } catch (err) {}
      var flipTarget = axis === 'H' ? 'scaleX(-1)' : 'scaleY(-1)';
      cropCanvas.style.transition = 'transform .3s ease';
      cropCanvas.style.transform = flipTarget;
      cropFlipTimer = setTimeout(function () {
        cropFlipTimer = null;
        try {
          if (axis === 'H') {
            cropState.flipH = !cropState.flipH;
            cropFlipHBtn.classList.toggle('dshwv-cropflip-on', cropState.flipH);
          } else {
            cropState.flipV = !cropState.flipV;
            cropFlipVBtn.classList.toggle('dshwv-cropflip-on', cropState.flipV);
          }
          positionCrop();
          requestAnimationFrame(function () {
            cropCanvas.style.transition = '';
            cropCanvas.style.transform = '';
          });
        } catch (err) {}
      }, 300);
    }
    function confirmCrop() {
      try {
        if (!cropState) return;
        var name = (cropNameInput.value || '').trim().slice(0, 16) || wm("widget.newCharacter");
        var s = cropState.baseScale * cropState.zoom;
        var k = 610 / CROP_BOX;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s * k;
        var h = cropState.img.height * s * k;
        var out = document.createElement('canvas');
        out.width = 610;
        out.height = 610;
        var octx = out.getContext('2d');
        octx.translate(305 + cropState.ox * k, 305 + cropState.oy * k);
        octx.rotate(rad);
        octx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        octx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        var dataUrl = out.toDataURL('image/png');
        fetch(ROLE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            image: dataUrl
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            roleList = d.roles;
            renderRolePanel();
            var newest = null;
            for (var i = 0; i < roleList.length; i++) {
              if (roleList[i].id !== 'default' && (!newest || roleList[i].createdAt > newest.createdAt)) newest = roleList[i];
            }
            if (newest) applyRole(newest.id, newest.name, roleUrl(newest.id));
            hideCropModal();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    function hideCropModal() {
      cropMask.style.display = 'none';
      cropState = null;
      cropDrag = null;
    }
    var AUDIO_URL = '/dsh-whale/audio.json';
    var audioGroups = [];
    var audioFragments = [];
    var audioGroupPanelOpen = false;
    function loadAudio() {
      try {
        fetch(AUDIO_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (!d || !d.ok) return;
          if (Array.isArray(d.groups)) audioGroups = d.groups;
          if (Array.isArray(d.fragments)) audioFragments = d.fragments;
          assetWarning(d);
          var exists = false;
          for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === soundSet) {
            exists = true;
            break;
          }
          if (!exists) setSoundSet('duck'); else {
            setAudioBtnText(audioGroupName(soundSet));
            try {
              applySoundSet();
            } catch (err) {}
          }
          renderAudioGroupPanel();
          refreshTaskEndAfterAudio();
        }).catch(function () {});
      } catch (err) {}
    }
    function audioGroupName(id) {
      for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === id) return audioGroups[i].name;
      return id === 'duck' ? wm("widget.rubberDuck") : id === 'fx1' ? wm("widget.sound1") : id;
    }
    function audioGroupSlotEmpty(id, slot) {
      try {
        for (var i = 0; i < audioGroups.length; i++) {
          var g = audioGroups[i];
          if (g && g.id === id) return g[slot] === '';
        }
      } catch (err) {}
      return false;
    }
    function toggleAudioGroupPanel() {
      if (audioGroupPanelOpen) {
        closeAudioGroupPanel();
        return;
      }
      try {
        renderAudioGroupPanel();
        var b = audioGroupBtn.getBoundingClientRect();
        var vp = viewport();
        var panelW = Math.max(200, Math.round(b.width));
        audioGroupPanel.style.width = panelW + 'px';
        audioGroupPanel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        audioGroupPanel.style.top = b.bottom + 6 + 'px';
        audioGroupPanel.style.display = 'block';
        audioGroupPanel.classList.add('dshwv-audiolist-open');
        audioGroupPanelOpen = true;
      } catch (err) {}
    }
    function closeAudioGroupPanel() {
      audioGroupPanel.classList.remove('dshwv-audiolist-open');
      audioGroupPanel.style.display = 'none';
      audioGroupPanelOpen = false;
    }
    function renderAudioGroupPanel() {
      try {
        audioGroupPanel.innerHTML = '';
        audioGroups.forEach(function (g) {
          var item = document.createElement('div');
          item.className = 'dshwv-audioitem' + (soundSet === g.id ? ' dshwv-audioitem-cur' : '');
          var thumb = document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.textContent = '🎵';
          item.appendChild(thumb);
          var name = makeNameCell('dshwv-audioname', g.name);
          item.appendChild(name);
          if (g.preset) {
            var tag = document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            wb(tag, "textContent", (function(){ return function(){ return wm("widget.preset"); }; })());
            item.appendChild(tag);
          } else {
            var pin = document.createElement('button');
            pin.type = 'button';
            pin.className = 'dshwv-audiopin' + (g.pinned ? ' on' : '');
            pin.textContent = '📌';
            wb(pin, "title", (function(g){ return function(){ return g.pinned ? wm("widget.unpin") : wm("widget.pin"); }; })(g));
            pin.addEventListener('click', function (e) {
              e.stopPropagation();
              audioPinGroup(g.id, !g.pinned);
            });
            item.appendChild(pin);
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            wb(del, "title", (function(){ return function(){ return wm("widget.deleteSoundSet2"); }; })());
            del.addEventListener('click', function (e) {
              e.stopPropagation();
              audioDeleteGroup(g.id);
            });
            item.appendChild(del);
          }
          item.addEventListener('click', function () {
            setSoundSet(g.id);
            closeAudioGroupPanel();
          });
          bindNameMarquee(item, name);
          audioGroupPanel.appendChild(item);
        });
      } catch (err) {}
    }
    function audioPinGroup(id, pinned) {
      try {
        fetch(AUDIO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'pin-group',
            id: id,
            pinned: pinned
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            audioGroups = d.groups;
            renderAudioGroupPanel();
            refreshTaskEndAfterAudio();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    function audioDeleteGroup(id) {
      var g = null;
      for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === id) {
        g = audioGroups[i];
        break;
      }
      showDeleteConfirm(wexpr((function(g,id){ return function(){ return wm("widget.deleteSoundSet") + (g ? g.name : id) + wm("widget.label"); }; })(g,id)), function () {
        try {
          fetch(AUDIO_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-group',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.groups)) {
              audioGroups = d.groups;
              renderAudioGroupPanel();
              refreshTaskEndAfterAudio();
              if (soundSet === id) setSoundSet('duck');
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    var editingAudioGroupId = null;
    var activeSlotPanel = null;
    function audioSlotValue(slot) {
      return slot === 'press' ? audioEditPressVal || 'ya1' : audioEditReleaseVal || 'ya2';
    }
    var audioEditPressVal = 'ya1';
    var audioEditReleaseVal = 'ya2';
    function audioSlotName(id) {
      for (var i = 0; i < audioFragments.length; i++) if (audioFragments[i].id === id) return audioFragments[i].name;
      return id;
    }
    function audioSlotBtnText(btn, id) {
      try {
        var txt = audioSlotName(id);
        btn.style.opacity = txt ? '' : '.55';
        wb(btn, "textContent", (function(txt){ return function(){ return txt || wm("widget.silent"); }; })(txt));
        wb(btn, "title", (function(){ return function(){ return wm("widget.leaveBlankForSilenceClickToChooseAn"); }; })());
      } catch (err) {}
      return btn;
    }
    function openAudioGroupEditor(group) {
      editingAudioGroupId = group && group.id ? group.id : null;
      wb(audioEditTitle, "textContent", (function(editingAudioGroupId){ return function(){ return editingAudioGroupId ? wm("widget.editSoundSet") : wm("widget.newSoundSet"); }; })(editingAudioGroupId));
      audioEditName.value = group && group.name ? group.name : '';
      var isNewGroup = !(group && group.id);
      audioEditPressVal = group && typeof group.press === 'string' ? group.press : isNewGroup ? '' : 'ya1';
      audioEditReleaseVal = group && typeof group.release === 'string' ? group.release : isNewGroup ? '' : 'ya2';
      audioEditPressBtn.textContent = audioSlotName(audioEditPressVal);
      audioEditReleaseBtn.textContent = audioSlotName(audioEditReleaseVal);
      audioSlotBtnText(audioEditPressBtn, audioEditPressVal);
      audioSlotBtnText(audioEditReleaseBtn, audioEditReleaseVal);
      audioEditPreviewEnsure();
      audioEditMask.style.display = 'flex';
    }
    function toggleAudioSlotPanel(slot) {
      var btn = slot === 'press' ? audioEditPressBtn : audioEditReleaseBtn;
      var panel = slot === 'press' ? audioEditPressPanel : audioEditReleasePanel;
      if (activeSlotPanel === panel) {
        closeAudioSlotPanels();
        return;
      }
      closeAudioSlotPanels();
      activeSlotPanel = panel;
      renderAudioSlotPanel(slot);
      try {
        var b = btn.getBoundingClientRect();
        var vp = viewport();
        var panelW = Math.max(120, Math.round(b.width));
        panel.style.width = panelW + 'px';
        panel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        panel.style.top = b.bottom + 4 + 'px';
        panel.style.display = 'block';
      } catch (err) {}
    }
    function closeAudioSlotPanels() {
      if (audioEditPressPanel) audioEditPressPanel.style.display = 'none';
      if (audioEditReleasePanel) audioEditReleasePanel.style.display = 'none';
      activeSlotPanel = null;
    }
    function renderAudioSlotPanel(slot) {
      try {
        var panel = slot === 'press' ? audioEditPressPanel : audioEditReleasePanel;
        var current = slot === 'press' ? audioEditPressVal : audioEditReleaseVal;
        panel.innerHTML = '';
        var emptyItem = document.createElement('div');
        emptyItem.className = 'dshwv-audioitem' + (!current ? ' dshwv-audioitem-cur' : '');
        var emptyIcon = document.createElement('span');
        emptyIcon.className = 'dshwv-audiothumb';
        emptyIcon.textContent = '🚫';
        emptyItem.appendChild(emptyIcon);
        var emptyName = makeNameCell('dshwv-audioname', wm("widget.silentNoSound"));
        emptyItem.appendChild(emptyName);
        emptyItem.addEventListener('click', function () {
          if (slot === 'press') {
            audioEditPressVal = '';
            audioSlotBtnText(audioEditPressBtn, '');
          } else {
            audioEditReleaseVal = '';
            audioSlotBtnText(audioEditReleaseBtn, '');
          }
          audioEditPreviewEnsure(true);
          closeAudioSlotPanels();
        });
        bindNameMarquee(emptyItem, emptyName);
        panel.appendChild(emptyItem);
        audioFragments.forEach(function (f) {
          var item = document.createElement('div');
          item.className = 'dshwv-audioitem' + (current === f.id ? ' dshwv-audioitem-cur' : '');
          var thumb = document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.textContent = '🎵';
          item.appendChild(thumb);
          var name = makeNameCell('dshwv-audioname', f.name);
          item.appendChild(name);
          if (f.preset) {
            var tag = document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            wb(tag, "textContent", (function(){ return function(){ return wm("widget.preset"); }; })());
            item.appendChild(tag);
          } else {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            wb(del, "title", (function(){ return function(){ return wm("widget.deleteAudioClip2"); }; })());
            del.addEventListener('click', function (e) {
              e.stopPropagation();
              audioDeleteFragmentInSlot(slot, f.id);
            });
            item.appendChild(del);
          }
          item.addEventListener('click', function () {
            if (slot === 'press') {
              audioEditPressVal = f.id;
              audioSlotBtnText(audioEditPressBtn, f.id);
            } else {
              audioEditReleaseVal = f.id;
              audioSlotBtnText(audioEditReleaseBtn, f.id);
            }
            audioEditPreviewEnsure(true);
            closeAudioSlotPanels();
          });
          bindNameMarquee(item, name);
          panel.appendChild(item);
        });
      } catch (err) {}
    }
    function hideAudioEditor() {
      hideAudioCrop();
      stopAudioEditPreview();
      audioEditMask.style.display = 'none';
      editingAudioGroupId = null;
      closeAudioSlotPanels();
    }
    var audioEditPreviewEl = null;
    var audioEditPreviewRelease = null;
    var audioEditPreviewTimer = null;
    var audioEditPreviewReady = false;
    var audioEditPreviewPressing = false;
    var audioEditPreviewPressEnded = false;
    var audioEditPreviewReleasePlayed = false;
    function audioEditPreviewEnsure(force) {
      try {
        if (!force && audioEditPreviewReady) return true;
        var pressId = audioEditPressVal || '';
        var releaseId = audioEditReleaseVal || '';
        try {
          stopAudioEditPreview();
        } catch (err) {}
        try {
          if (audioEditPreviewEl) {
            audioEditPreviewEl.pause();
            audioEditPreviewEl = null;
          }
          if (audioEditPreviewRelease) {
            audioEditPreviewRelease.pause();
            audioEditPreviewRelease = null;
          }
        } catch (err) {}
        if (pressId) {
          audioEditPreviewEl = new Audio('/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(pressId));
          audioEditPreviewEl.preload = 'auto';
          audioEditPreviewEl.volume = soundVol;
        }
        if (releaseId) {
          audioEditPreviewRelease = new Audio('/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(releaseId));
          audioEditPreviewRelease.preload = 'auto';
          audioEditPreviewRelease.volume = soundVol;
        }
        audioEditPreviewReady = true;
        return true;
      } catch (err) {
        return false;
      }
    }
    function audioEditPreviewDown() {
      try {
        stopAudioEditPreview();
        if (!audioEditPreviewEnsure()) return;
        audioEditPreviewPressing = true;
        audioEditPreviewPressEnded = false;
        audioEditPreviewReleasePlayed = false;
        if (!audioEditPreviewEl) {
          audioEditPreviewPressEnded = true;
          return;
        }
        audioEditPreviewEl.onended = function () {
          audioEditPreviewPressEnded = true;
          if (!audioEditPreviewPressing && !audioEditPreviewReleasePlayed) audioEditPreviewUp();
        };
        var p = audioEditPreviewEl.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }
    function audioEditPreviewUp() {
      try {
        if (!audioEditPreviewPressing) return;
        audioEditPreviewPressing = false;
        if (!audioEditPreviewEl) {
          audioEditPreviewPlayRelease();
          return;
        }
        if (audioEditPreviewPressEnded) {
          audioEditPreviewPlayRelease();
          return;
        }
        var durKnown = false;
        var remainMs = 0;
        try {
          var dur = audioEditPreviewEl ? audioEditPreviewEl.duration : 0;
          if (isFinite(dur) && dur > 0) {
            durKnown = true;
            remainMs = (dur - audioEditPreviewEl.currentTime) * 1000;
          }
        } catch (err) {}
        if (durKnown) {
          audioEditPreviewTimer = setTimeout(function () {
            audioEditPreviewTimer = null;
            audioEditPreviewPlayRelease();
          }, Math.max(0, remainMs - 100));
        }
      } catch (err) {}
    }
    function audioEditPreviewPlayRelease() {
      try {
        if (audioEditPreviewReleasePlayed || !audioEditPreviewRelease) return;
        audioEditPreviewReleasePlayed = true;
        audioEditPreviewRelease.currentTime = 0;
        var p = audioEditPreviewRelease.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }
    function stopAudioEditPreview() {
      try {
        if (audioEditPreviewTimer) {
          clearTimeout(audioEditPreviewTimer);
          audioEditPreviewTimer = null;
        }
        if (audioEditPreviewEl) {
          audioEditPreviewEl.pause();
          audioEditPreviewEl.currentTime = 0;
        }
        if (audioEditPreviewRelease) {
          audioEditPreviewRelease.pause();
          audioEditPreviewRelease.currentTime = 0;
        }
        audioEditPreviewPressing = false;
        audioEditPreviewPressEnded = false;
        audioEditPreviewReleasePlayed = false;
      } catch (err) {}
    }
    function saveAudioGroup() {
      try {
        stopAudioEditPreview();
        var name = (audioEditName.value || '').trim().slice(0, 20);
        if (!name) {
          audioEditName.focus();
          return;
        }
        fetch(AUDIO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'save-group',
            id: editingAudioGroupId || '',
            name: name,
            press: audioEditPressVal || '',
            release: audioEditReleaseVal || ''
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            audioGroups = d.groups;
            renderAudioGroupPanel();
            refreshTaskEndAfterAudio();
            if (!editingAudioGroupId) {
              var newest = d.groups.filter(function (x) {
                return !x.preset;
              }).sort(function (a, b) {
                return (b.pinnedAt || 0) - (a.pinnedAt || 0);
              })[0];
              if (newest) setSoundSet(newest.id);
            } else if (soundSet === editingAudioGroupId) {
              try {
                applySoundSet();
              } catch (err) { assetFailure(err); }
            }
            hideAudioEditor();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var audioCropFileInput = document.createElement('input');
    audioCropFileInput.type = 'file';
    audioCropFileInput.accept = 'audio/*';
    audioCropFileInput.style.display = 'none';
    document.body.appendChild(audioCropFileInput);
    var audioCropTarget = null;
    // Decoding is offline; only an active preview owns an output-device context.
    var audioCropCtx = null;
    var audioCropGeneration = 0;
    var audioCropPreviewGeneration = 0;
    var audioCropBuffer = null;
    var audioCropFileBase = '';
    var audioCropZoom = 1;
    var audioCropOffset = 0;
    audioEditPressImport.addEventListener('click', function () {
      audioCropTarget = 'press';
      audioCropFileInput.click();
    });
    audioEditReleaseImport.addEventListener('click', function () {
      audioCropTarget = 'release';
      audioCropFileInput.click();
    });
    audioCropFileInput.addEventListener('change', async function () {
      var f = audioCropFileInput.files && audioCropFileInput.files[0];
      audioCropFileInput.value = '';
      if (!f) return;
      var ticket = ++audioCropGeneration;
      stopAudioCropPreview();
      try {
        await WhaleMediaGuard.validateAudioFile(f);
        var data = await f.arrayBuffer();
        if (ticket === audioCropGeneration) await openAudioCrop(data, f.name);
      } catch (err) { if (ticket === audioCropGeneration) assetNotice(err.message); }
    });
    function cancelAudioCropWork() {
      audioCropGeneration++;
      stopAudioCropPreview();
    }
    window.addEventListener('blur', cancelAudioCropWork);
    window.addEventListener('beforeunload', cancelAudioCropWork);
    document.addEventListener('visibilitychange', function () { if (document.hidden) cancelAudioCropWork(); });
    async function openAudioCrop(arrayBuf, fileName) {
      var ticket = ++audioCropGeneration;
      stopAudioCropPreview();
      audioCropBuffer = null;
      try {
        audioCropFileBase = (fileName || wm("widget.audioClip")).replace(/.[^.]+$/, '');
        audioCropZoom = 1;
        audioCropOffset = 0;
        var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Offline) {
          assetNotice(wm("widget.audioDecodingIsUnavailable"));
          return;
        }
        var decoder = new Offline(1, 1, 44100);
        var buf = await decoder.decodeAudioData(arrayBuf);
        if (ticket !== audioCropGeneration) return;
        var policy = WhaleMediaGuard.getPolicy();
        if (!isFinite(buf.duration) || buf.duration <= 0 || buf.duration > policy.maxAudioSeconds ||
            buf.numberOfChannels > policy.maxAudioChannels || buf.sampleRate > policy.maxAudioSampleRate) {
          assetNotice(wm("widget.audioExceedsDurationChannelOrSampleRateLimits"));
          return;
        }
        audioCropBuffer = buf;
        audioCropStart.value = '0';
        audioCropEnd.value = '100';
        audioCropStartNum.max = buf.duration.toFixed(3);
        audioCropEndNum.max = buf.duration.toFixed(3);
        audioCropZoomRange.value = '1';
        audioCropZoomNum.value = '1';
        drawAudioCrop();
        try {
          audioCropName.value = '';
        } catch (err) {}
        updateAudioCropOkState();
        audioCropMask.style.display = 'flex';
      } catch (err) { if (ticket === audioCropGeneration) assetNotice(wm("widget.couldNotDecodeAudio")); }
    }
    function audioCropRange() {
      var b = audioCropBuffer;
      if (!b) return null;
      var s = Number(audioCropStart.value) / 100;
      var e = Number(audioCropEnd.value) / 100;
      if (e < s) {
        var t = s;
        s = e;
        e = t;
      }
      return {
        start: b.duration * s,
        end: b.duration * e,
        s: s,
        e: e
      };
    }
    function onAudioCropWheel(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var maxOff = Math.max(0, 1 - 1 / audioCropZoom);
      if (maxOff <= 0) return;
      var dx = (e.deltaY || 0) + (e.deltaX || 0);
      if (dx === 0) return;
      var move = dx / audioCropCanvas.width / audioCropZoom;
      audioCropOffset = Math.min(maxOff, Math.max(0, audioCropOffset + move));
      drawAudioCrop();
    }
    function drawAudioCrop(skipSync) {
      try {
        if (!audioCropBuffer) return;
        var r = audioCropRange();
        wb(audioCropTime, "textContent", (function(r,audioCropBuffer,audioCropZoom){ return function(){ return r.start.toFixed(1) + 's – ' + r.end.toFixed(1) + 's' + wm("widget.total") + audioCropBuffer.duration.toFixed(1) + wm("widget.sZoom") + audioCropZoom.toFixed(1) + '）'; }; })(r,audioCropBuffer,audioCropZoom));
        var ctx = audioCropCanvas.getContext('2d');
        var W = audioCropCanvas.width, H = audioCropCanvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = gptThemeColor('soft');
        ctx.fillRect(0, 0, W, H);
        var ch = audioCropBuffer.getChannelData(0);
        var totalLen = ch.length;
        var viewStart = audioCropOffset;
        var viewSpan = 1 / audioCropZoom;
        ctx.strokeStyle = gptThemeColor('muted');
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x < W; x++) {
          var g0 = viewStart + x / W * viewSpan;
          var g1 = viewStart + (x + 1) / W * viewSpan;
          var i0 = Math.max(0, Math.floor(g0 * totalLen));
          var i1 = Math.max(i0 + 1, Math.min(totalLen - 1, Math.ceil(g1 * totalLen)));
          var mn = 0, mx = 0;
          for (var i = i0; i < i1; i++) {
            var v = ch[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
          var yTop = H / 2 - mx * H / 2;
          var yBot = H / 2 - mn * H / 2;
          ctx.moveTo(x, yTop);
          ctx.lineTo(x, yBot);
        }
        ctx.stroke();
        var vx0 = (r.s - viewStart) / viewSpan * W;
        var vx1 = (r.e - viewStart) / viewSpan * W;
        var drawX0 = Math.max(0, vx0);
        var drawX1 = Math.min(W, vx1);
        if (drawX1 > drawX0) {
          ctx.fillStyle = gptThemeAlpha('.25');
          ctx.fillRect(drawX0, 0, drawX1 - drawX0, H);
          ctx.strokeStyle = gptThemeColor('ink');
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX0 + 0.5, 0.5, drawX1 - drawX0, H - 1);
        }
        ctx.strokeStyle = gptThemeAlpha('.3');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.stroke();
        if (!skipSync) {
          audioCropStartNum.value = r.start.toFixed(3);
          audioCropEndNum.value = r.end.toFixed(3);
          audioCropZoomRange.value = String(audioCropZoom);
          audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
        }
        try {
          var trackW = audioCropDual.clientWidth || 200;
          var usable = Math.max(1, trackW - 8);
          audioCropDualStart.style.left = 4 + r.s * usable + 'px';
          audioCropDualEnd.style.left = 4 + r.e * usable + 'px';
          audioCropDualFill.style.left = 4 + r.s * usable + 'px';
          audioCropDualFill.style.width = Math.max(0, (r.e - r.s) * usable) + 'px';
        } catch (err) {}
      } catch (err) {}
    }
    function onAudioCropStartInput() {
      syncAudioCropStartNum();
      drawAudioCrop();
    }
    function syncAudioCropStartNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropStartNum.value = (b.duration * Number(audioCropStart.value) / 100).toFixed(3);
    }
    function onAudioCropEndInput() {
      syncAudioCropEndNum();
      drawAudioCrop();
    }
    function syncAudioCropEndNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropEndNum.value = (b.duration * Number(audioCropEnd.value) / 100).toFixed(3);
    }
    function onAudioCropStartNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
    function onAudioCropStartNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) v = 0;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
    function onAudioCropEndNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
    function onAudioCropEndNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) v = b.duration;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
    function applyAudioCropZoom(v, skipSync) {
      if (!audioCropBuffer) return;
      var next = Number(v);
      if (!isFinite(next) || next < 1) next = 1;
      if (next > 50) next = 50;
      var r = audioCropRange();
      var mid = (r.s + r.e) / 2;
      var viewSpan = 1 / audioCropZoom;
      var midInView = viewSpan > 0 ? (mid - audioCropOffset) / viewSpan : 0.5;
      audioCropZoom = next;
      var newSpan = 1 / audioCropZoom;
      audioCropOffset = mid - midInView * newSpan;
      audioCropOffset = Math.min(1 - 1 / audioCropZoom, Math.max(0, audioCropOffset));
      audioCropZoomRange.value = String(audioCropZoom);
      audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
      drawAudioCrop(skipSync);
    }
    function onAudioCropZoomInput() {
      applyAudioCropZoom(audioCropZoomRange.value);
    }
    function onAudioCropZoomNumInput() {
      var v = Number(audioCropZoomNum.value);
      if (!isFinite(v) || v < 1) return;
      if (v > 50) return;
      applyAudioCropZoom(v, true);
    }
    function onAudioCropZoomNumChange() {
      applyAudioCropZoom(audioCropZoomNum.value);
    }
    var audioCropSelDrag = null;
    function onAudioCropSelDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      audioCropSelDrag = {
        startRatio: globalRatio,
        moved: false
      };
      audioCropStart.value = String(globalRatio * 100);
      syncAudioCropStartNum();
      drawAudioCrop();
    }
    function onAudioCropSelMove(e) {
      if (!audioCropSelDrag || !audioCropBuffer) return;
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      if (Math.abs(globalRatio - audioCropSelDrag.startRatio) > 0.002) audioCropSelDrag.moved = true;
      if (audioCropSelDrag.moved) {
        var s = Math.min(audioCropSelDrag.startRatio, globalRatio);
        var en = Math.max(audioCropSelDrag.startRatio, globalRatio);
        audioCropStart.value = String(s * 100);
        audioCropEnd.value = String(en * 100);
        syncAudioCropStartNum();
        syncAudioCropEndNum();
        drawAudioCrop();
      }
    }
    function onAudioCropSelUp() {
      audioCropSelDrag = null;
    }
    var audioCropDualDrag = null;
    function onAudioCropDualDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var ratio = audioCropDualRatio(e);
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      var dStart = Math.abs(ratio - startV);
      var dEnd = Math.abs(ratio - endV);
      audioCropDualDrag = {
        side: dStart <= dEnd ? 'start' : 'end'
      };
      audioCropDualMoveTo(ratio);
    }
    function onAudioCropDualMove(e) {
      if (!audioCropDualDrag || !audioCropBuffer) return;
      audioCropDualMoveTo(audioCropDualRatio(e));
    }
    function audioCropDualRatio(e) {
      var rect = audioCropDual.getBoundingClientRect();
      var usable = Math.max(1, rect.width - 8);
      var ratio = (e.clientX - rect.left - 4) / usable;
      return Math.min(1, Math.max(0, ratio));
    }
    function audioCropDualMoveTo(ratio) {
      if (!audioCropDualDrag) return;
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      if (audioCropDualDrag.side === 'start') {
        if (ratio >= endV) ratio = Math.max(0, endV - 0.0001);
        audioCropStart.value = String(ratio * 100);
        syncAudioCropStartNum();
      } else {
        if (ratio <= startV) ratio = Math.min(1, startV + 0.0001);
        audioCropEnd.value = String(ratio * 100);
        syncAudioCropEndNum();
      }
      drawAudioCrop();
    }
    function onAudioCropDualUp() {
      audioCropDualDrag = null;
    }
    function hideAudioCrop() {
      cancelAudioCropWork();
      audioCropMask.style.display = 'none';
      audioCropBuffer = null;
      audioCropTarget = null;
      audioCropFileBase = '';
      try {
        audioCropName.value = '';
      } catch (err) {}
      updateAudioCropOkState();
    }
    var audioCropPreviewNode = null;
    function stopAudioCropPreview() {
      audioCropPreviewGeneration++;
      var node = audioCropPreviewNode, context = audioCropCtx;
      audioCropPreviewNode = null;
      audioCropCtx = null;
      if (node) {
        node.onended = null;
        try { node.stop(); } catch (err) {}
        try { node.disconnect(); } catch (err) {}
      }
      try { if (context && context.state !== 'closed') Promise.resolve(context.close()).catch(function () {}); } catch (err) {}
    }
    async function previewAudioCrop() {
      stopAudioCropPreview();
      var ticket = audioCropPreviewGeneration, generation = audioCropGeneration, context = null;
      try {
        if (!audioCropBuffer) return;
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) return;
        context = new (window.AudioContext || window.webkitAudioContext)();
        audioCropCtx = context;
        await context.resume();
        if (ticket !== audioCropPreviewGeneration || generation !== audioCropGeneration || audioCropCtx !== context) return;
        var srcNode = context.createBufferSource();
        srcNode.buffer = audioCropBuffer;
        srcNode.connect(context.destination);
        audioCropPreviewNode = srcNode;
        srcNode.onended = function () {
          if (audioCropPreviewNode === srcNode) stopAudioCropPreview();
        };
        srcNode.start(0, Math.floor(r.start * audioCropBuffer.sampleRate) / audioCropBuffer.sampleRate, len / audioCropBuffer.sampleRate);
      } catch (err) {
        if (ticket === audioCropPreviewGeneration) {
          stopAudioCropPreview();
          assetNotice(wt("widgetLevel7.audioPreviewFailed"));
        }
      }
    }
    // WAV encoding needs channel samples, not an AudioContext or output device.
    function audioCropSlice(buffer, start, len) {
      var offset = Math.floor(start * buffer.sampleRate);
      var channels = [];
      for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
        channels.push(buffer.getChannelData(channel).subarray(offset, offset + len));
      }
      return { numberOfChannels:buffer.numberOfChannels, length:len, sampleRate:buffer.sampleRate,
        getChannelData:function (channel) { return channels[channel]; } };
    }
    function encodeWav(buffer) {
      var numCh = buffer.numberOfChannels;
      var sampleRate = buffer.sampleRate;
      var len = buffer.length;
      var bytesPerSample = 2;
      var blockAlign = numCh * bytesPerSample;
      var dataSize = len * blockAlign;
      var ab = new ArrayBuffer(44 + dataSize);
      var dv = new DataView(ab);
      function writeStr(offset, s) {
        for (var i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      dv.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, numCh, true);
      dv.setUint32(24, sampleRate, true);
      dv.setUint32(28, sampleRate * blockAlign, true);
      dv.setUint16(32, blockAlign, true);
      dv.setUint16(34, 16, true);
      writeStr(36, 'data');
      dv.setUint32(40, dataSize, true);
      var offset = 44;
      var channels = [];
      for (var channel = 0; channel < numCh; channel++) channels.push(buffer.getChannelData(channel));
      for (var i = 0; i < len; i++) {
        for (var c = 0; c < numCh; c++) {
          var v = channels[c][i];
          var s = Math.max(-1, Math.min(1, v));
          dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([ab], {
        type: 'audio/wav'
      });
    }
    function confirmAudioCrop() {
      try {
        if (!audioCropBuffer) return;
        stopAudioCropPreview();
        var ticket = audioCropGeneration, target = audioCropTarget;
        var fragName = String(audioCropName.value || '').trim();
        if (!fragName) {
          try {
            audioCropName.style.borderColor = '#e0433f';
            audioCropName.style.boxShadow = '0 0 0 2px rgba(224,67,63,.25)';
            audioCropName.focus();
            setTimeout(function () {
              audioCropName.style.borderColor = 'rgba(32,49,112,.4)';
              audioCropName.style.boxShadow = 'none';
            }, 1200);
          } catch (err) {}
          return;
        }
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) {
          assetNotice(wm("widget.theSelectedClipIsEmpty"));
          return;
        }
        if (44 + len * audioCropBuffer.numberOfChannels * 2 > WhaleMediaGuard.getPolicy().audioBytes) {
          assetNotice(wm("widget.theSelectedClipIsTooLargeShortenIt"));
          return;
        }
        var slice = audioCropSlice(audioCropBuffer, r.start, len);
        var blob = encodeWav(slice);
        WhaleMediaGuard.checkFile(blob, 'wav');
        var reader = new FileReader();
        reader.onload = function () {
          if (ticket !== audioCropGeneration) return;
          uploadAudioFragment(reader.result, fragName, function (ok) {
            if (ok && ticket === audioCropGeneration) {
              if (target === 'press') {
                audioEditPressVal = lastUploadedFragmentId || audioEditPressVal;
                audioSlotBtnText(audioEditPressBtn, audioEditPressVal);
              } else if (target === 'release') {
                audioEditReleaseVal = lastUploadedFragmentId || audioEditReleaseVal;
                audioSlotBtnText(audioEditReleaseBtn, audioEditReleaseVal);
              }
              audioEditPreviewEnsure(true);
              hideAudioCrop();
            }
          });
        };
        reader.onerror = function () { if (ticket === audioCropGeneration) assetNotice(wm("widget.couldNotReadAudioTryAgain")); };
        reader.readAsDataURL(blob);
      } catch (err) { assetNotice(err.message); }
    }
    var lastUploadedFragmentId = null;
    function uploadAudioFragment(dataUrl, name, cb) {
      try {
        fetch(AUDIO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'upload-fragment',
            name: name,
            audio: dataUrl
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.fragments)) {
            audioFragments = d.fragments;
            lastUploadedFragmentId = d.id || null;
            refreshTaskEndAfterAudio();
            if (cb) cb(true);
          } else {
            if (cb) cb(false);
          }
        }).catch(function (error) {
          assetFailure(error);
          if (cb) cb(false);
        });
      } catch (err) {
        if (cb) cb(false);
      }
    }
    function audioDeleteFragmentInSlot(slot, id) {
      if (!id) return;
      var f = null;
      for (var i = 0; i < audioFragments.length; i++) if (audioFragments[i].id === id) {
        f = audioFragments[i];
        break;
      }
      if (!f || f.preset) return;
      showDeleteConfirm(wexpr((function(f){ return function(){ return wm("widget.deleteAudio") + f.name + wm("widget.label"); }; })(f)), function () {
        try {
          fetch(AUDIO_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-fragment',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.fragments)) {
              audioFragments = d.fragments;
              if (Array.isArray(d.groups)) audioGroups = d.groups;
              if (slot === 'press' && audioEditPressVal === id) {
                audioEditPressVal = 'ya1';
                audioSlotBtnText(audioEditPressBtn, 'ya1');
              }
              if (slot === 'release' && audioEditReleaseVal === id) {
                audioEditReleaseVal = 'ya2';
                audioSlotBtnText(audioEditReleaseBtn, 'ya2');
              }
              audioEditPreviewEnsure(true);
              renderAudioGroupPanel();
              if (activeSlotPanel) renderAudioSlotPanel(slot);
              refreshTaskEndAfterAudio();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    audioEditPressBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('press');
    });
    audioEditReleaseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('release');
    });

    function setupHitTest(url) {
      WhaleRendering.hitCache.prepare(url || IMG_URL);
    }
    function whaleLayoutRect() {
      // CSS transitions expose an intermediate painted rectangle, not intent.
      var width = root.offsetWidth, height = root.offsetHeight;
      return { left: state.left, top: state.top, right: state.left + width, bottom: state.top + height, width: width, height: height };
    }
    function isWhaleHit(e) {
      return !!e && (WhaleRendering.petInteraction ? WhaleRendering.petInteraction.hit(img, root, e.clientX, e.clientY) :
        WhaleRendering.hitCache.hit(img, e.clientX, e.clientY, WhaleRendering.mirrorScale(root) < 0));
    }
    function onDocPointerDown(e) {
      if (e.target && e.target.closest) {
        if (e.target.closest('.dshwv-fx-info')) return;
        if (e.target.closest('.dshwv-pop') || e.target.closest('.dshwv-menu-btn')) return;
        if (e.target.closest('.dshwv-rolelist') || e.target.closest('.dshwv-audiolist') || e.target.closest('.dshwv-cropmask') || e.target.closest('.dshwv-confirmmask') || e.target.closest('.dshwv-audiomask') || e.target.closest('.dshwv-snapmask') || e.target.closest('.dshwv-bubmask') || e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-custbtn')) return;
        if (e.target.closest('.dshwv-rolebtn') || e.target.closest('.dshwv-audiobtn') || e.target.closest('.dshwv-roleimport') || e.target.closest('.dshwv-audioimport')) return;
        if (e.target.closest('.dshwv-menu,.whale-account-card')) {
          closeRolePanel();
          closeAudioGroupPanel();
          return;
        }
      }
      if (menuOpen) {
        closeMenu();
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (!isWhaleHit(e)) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var vp = viewport();
      // A new user grab takes ownership of the currently painted position,
      // including a previous snap animation that has not reached its target.
      var rect = positioner.getBoundingClientRect();
      positioner.style.transition = 'none';
      state.left = rect.left;
      state.top = rect.top;
      express();
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    drag = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left,
        origTop: rect.top,
        w: root.offsetWidth,
        h: root.offsetHeight,
        moved: false,
        vp: vp
      };
      root.classList.add('dshwv-dragging');
      WhaleRendering.petInteraction?.begin(img, root, e.pointerId);
      pressDown();
      setWidgetCursor('grabbing');
      document.addEventListener('pointermove', onDocPointerMove, true);
      document.addEventListener('pointerup', onDocPointerUp, true);
      document.addEventListener('pointercancel', onDocPointerCancel, true);
    }
    function onDocPointerMove(e) {
      if (!drag || !drag.active) return;
      var dx = e.clientX - drag.startX;
      var dy = e.clientY - drag.startY;
      if (dx * dx + dy * dy >= CLICK_SQ) drag.moved = true;
      state.left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w));
      state.top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h));
      express();
    }
    function onDocPointerUp(e) {
      try {
        if (isWhaleHit(e)) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch (err) {}
      endDrag(e, true);
    }
    function onDocPointerCancel(e) {
      endDrag(e, false, true);
    }
    function onDocClickStopper(e) {
      if (e.target && e.target.closest) {
        if (e.target.closest('.dshwv-fx-info')) return;
        if (e.target.closest('.dshwv-pop') || e.target.closest('.dshwv-menu,.whale-account-card') || e.target.closest('.dshwv-menu-btn') || e.target.closest('.dshwv-rolelist') || e.target.closest('.dshwv-cropmask') || e.target.closest('.dshwv-confirmmask') || e.target.closest('.dshwv-audiolist') || e.target.closest('.dshwv-audiomask') || e.target.closest('.dshwv-snapmask') || e.target.closest('.dshwv-bubmask') || e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-custbtn')) return;
      }
      if (!isWhaleHit(e)) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
    }
    function onDocContextMenu(e) {
      try {
        if (!menuBtnHide) return;
        if (e.target && e.target.closest) {
          if (e.target.closest('.dshwv-pop') || e.target.closest('.dshwv-menu,.whale-account-card') || e.target.closest('.dshwv-menu-btn') || e.target.closest('.dshwv-rolelist') || e.target.closest('.dshwv-audiolist') || e.target.closest('.dshwv-cropmask') || e.target.closest('.dshwv-confirmmask') || e.target.closest('.dshwv-audiomask') || e.target.closest('.dshwv-snapmask') || e.target.closest('.dshwv-bubmask') || e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-custbtn')) return;
        }
        if (!isWhaleHit(e)) return;
        e.preventDefault();
        toggleMenu();
      } catch (err) {}
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('click', onDocClickStopper, true);
    document.addEventListener('contextmenu', onDocContextMenu, true);
    // Hover retention is visual only. Input still uses the sprite's alpha and
    // actual controls; crossing transparent space must never steal host clicks.
    var menuHoverTimer = null;
    function resetMenuButtonHover() {
      if (menuHoverTimer !== null) clearTimeout(menuHoverTimer);
      menuHoverTimer = null;
      menuBtn.classList.remove('dshwv-menu-btn-visible');
    }
    function showMenuButton() {
      if (menuHoverTimer !== null) clearTimeout(menuHoverTimer);
      menuHoverTimer = null;
      menuBtn.classList.toggle('dshwv-menu-btn-visible', !menuBtnHide);
    }
    function inMenuHoverArea(e) {
      if (!e || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || e.clientX < 0 || e.clientY < 0) return false;
      var pet = img.getBoundingClientRect(), button = menuBtn.getBoundingClientRect();
      var pad = 4;
      return e.clientX >= Math.min(pet.left, button.left) - pad && e.clientX <= Math.max(pet.right, button.right) + pad &&
        e.clientY >= Math.min(pet.top, button.top) - pad && e.clientY <= Math.max(pet.bottom, button.bottom) + pad;
    }
    function updateMenuButtonHover(e, overPet, overControl) {
      if (menuBtnHide) { resetMenuButtonHover(); return; }
      if (menuOpen || overPet || overControl || menuBtn.classList.contains('dshwv-menu-btn-visible') && inMenuHoverArea(e)) {
        showMenuButton();
      } else if (menuHoverTimer === null && menuBtn.classList.contains('dshwv-menu-btn-visible')) {
        menuHoverTimer = setTimeout(function () {
          menuHoverTimer = null;
          if (!menuOpen || menuBtnHide) menuBtn.classList.remove('dshwv-menu-btn-visible');
        }, 160);
      }
    }
    var widgetCursor = '';
    function setWidgetCursor(v) {
      if (v !== widgetCursor) {
        widgetCursor = v;
        try {
          document.documentElement.dataset.whaleCursor = v;
        } catch (err) {}
      }
    }
    function onDocPointerMoveCursor(e) {
      if (drag && drag.active) {
        setWidgetCursor('grabbing');
        return;
      }
      var el = null;
      try {
        el = document.elementFromPoint(e.clientX, e.clientY);
      } catch (err) {}
      var overControl = !!(el && el.closest && (el.closest('.dshwv-pop-open') || el.closest('.dshwv-menu-open,.whale-account-card') || el.closest('.dshwv-menu-btn-visible') || el.closest('.dshwv-rolelist') || el.closest('.dshwv-cropmask') || el.closest('.dshwv-confirmmask') || el.closest('.dshwv-audiolist') || el.closest('.dshwv-audiomask') || el.closest('.dshwv-snapmask') || el.closest('.dshwv-bubmask') || el.closest('.dshwv-qedit') || el.closest('.dshwv-usagepanel') || el.closest('.dshwv-usage-mask') || el.closest('.dshwv-resmask') || el.closest('.dshwv-custmenu') || el.closest('.dshwv-custbtn')));
      var over = !overControl && isWhaleHit(e);
      setWidgetCursor(over ? 'grab' : '');
      updateMenuButtonHover(e, over, overControl);
    }
    document.addEventListener('pointermove', onDocPointerMoveCursor, true);
    document.addEventListener('mousemove', onDocPointerMoveCursor, true);
    window.addEventListener('whale-hover', function (e) { onDocPointerMoveCursor({ clientX: e.detail.x, clientY: e.detail.y }); });
    root.addEventListener('lostpointercapture', function (e) { endDrag(e, false); });
    window.addEventListener('blur', function () { endDrag(null, false); });
    window.addEventListener('whale-mode-changing', function () { endDrag(null,false,true); closeMenu(); resetMenuButtonHover(); hideBubble(); window.getSelection()?.removeAllRanges(); setWidgetCursor(''); });
    window.addEventListener('whale-desktop-mode', function () { endDrag(null,false,true); closeMenu(); resetMenuButtonHover(); hideBubble(); applyAnchorPos(); settle(); window.getSelection()?.removeAllRanges(); setWidgetCursor(''); });
    window.addEventListener('whale-account-view', function () {
      // A display-mode switch updates this menu in place, retaining its open state.
      hideBubble(); refresh(true);
      requestAnimationFrame(function () { if (menuOpen) positionMenu(); });
    });
    function endDrag(e, clickAllowed, preserveIntent) {
      if (!drag || !drag.active) return;
      drag.active = false;
      var validEnd = e && Number.isFinite(e.clientX) && Number.isFinite(e.clientY);
      // Mark a successful release before native capture is relinquished. The
      // same finite geometry protects rapid clicks throughout the rebound.
      if (WhaleRendering.petInteraction) {
        if (clickAllowed && validEnd && !preserveIntent) {
          var feel = window.WhaleFeedback && window.WhaleFeedback.feel || 'balanced';
          var preset = window.WhaleGesture && window.WhaleGesture.presets[feel];
          WhaleRendering.petInteraction.end(e.pointerId, preset ? preset.release : 140);
        } else WhaleRendering.petInteraction.cancel();
      }
    try { if (e && root.hasPointerCapture(e.pointerId)) root.releasePointerCapture(e.pointerId); } catch (err) {}
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerCancel, true);
      pressUp();
      root.classList.remove('dshwv-dragging');
      positioner.style.transition = '';
      setWidgetCursor(isWhaleHit(e) ? 'grab' : '');
      // pointercancel/lost capture/blur never commit an unfinished gesture.
      // Restore the saved intent instead of interpreting zero/missing points.
      if (preserveIntent || !clickAllowed || !validEnd || !drag.moved) {
        applyAnchorPos(); settle();
        if (clickAllowed && validEnd && !drag.moved) { whaleClick(); refresh(true); }
        return;
      }
      var dx = e.clientX - drag.startX;
      var dy = e.clientY - drag.startY;
      var left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w));
      var top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h));
      var ac = artCenterAt(left, top, drag.w, drag.h, !!state.flip);
      var z = snapZones(ac.cx, top + drag.h / 2, ac.cy, drag.vp);
      if (z.zH === 'left') {
        state.h = 'left';
        state.hOff = 0;
      } else if (z.zH === 'right') {
        state.h = 'right';
        state.hOff = 0;
      } else {
        state.h = null;
        state.hOff = left;
      }
      if (z.zV === 'top') {
        state.v = 'top';
        state.vOff = 0;
      } else if (z.zV === 'bottom') {
        state.v = 'bottom';
        state.vOff = 0;
      } else {
        state.v = null;
        state.vOff = top;
      }
      state.flip = z.zH === 'left' ? true : z.zH === 'right' ? false : z.flip;
      state.left = left;
      state.top = top;
      settle();
      commitPosition();
      saveConfig();
    }
    function applyAnchorPos() {
      try {
        if (!positionIntent) {
          var saved = null;
          try { saved = JSON.parse(localStorage.getItem('dshw-pos') || 'null'); } catch (err) {}
          positionIntent = saved && saved.v === 2 && (saved.hAnchor === 'left' || saved.hAnchor === 'right') && Number.isFinite(saved.hDist) && saved.hDist >= 0 && (saved.vAnchor === 'top' || saved.vAnchor === 'bottom') && Number.isFinite(saved.vDist) && saved.vDist >= 0
            ? saved : {v:2,hAnchor:'right',hDist:0,vAnchor:'bottom',vDist:0};
        }
        var a = positionIntent;
        var vp = viewport();
        var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
        var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
        var effectiveRightDist = a.hAnchor === 'right' ? a.hDist + (scrollGapOn ? rightGap() : 0) : a.hDist;
        var l = a.hAnchor === 'left' ? a.hDist : vp.w - effectiveRightDist - w;
        var t = a.vAnchor === 'top' ? a.vDist : vp.h - a.vDist - h;
        state.left = clamp(l, 0, Math.max(0, vp.w - w));
        state.top = clamp(t, 0, Math.max(0, vp.h - h));
        state.h = a.hAnchor;
        state.hOff = a.hDist;
        state.v = a.vAnchor;
        state.vOff = a.vDist;
        refreshFlip();
        return true;
      } catch (err) {
        return false;
      }
    }
    window.addEventListener('resize', function () {
      // A shrinking viewport can put the old position wholly outside its new
      // region. Commit the clamped location directly, without interpolating
      // through invisible coordinates during desktop/follow or DPI changes.
      if (drag && drag.active) endDrag(null, false, true);
      positioner.style.transition = 'none';
      applyAnchorPos(); settle();
      void positioner.getBoundingClientRect();
      requestAnimationFrame(function () { positioner.style.transition = ''; });
    });
    // Resolve the intended anchor before the first frame, rather than painting
    // at the CSS wrapper origin and moving after the asynchronous size request.
    positioner.style.transition = 'none';
    state.left = Math.max(0, viewport().w - root.offsetWidth - rightGap());
    state.top = Math.max(0, viewport().h - root.offsetHeight);
    applyAnchorPos();
    express();
    void positioner.getBoundingClientRect();
    requestAnimationFrame(function () { positioner.style.transition = ''; });
    window.addEventListener('whale-reset-position', function () {
      endDrag(null, false); closeMenu(); hideBubble();
      positionIntent = {v:2,hAnchor:'right',hDist:12,vAnchor:'bottom',vDist:12};
      persistPositionIntent();
      applyAnchorPos(); settle();
    });
    applySoundSet();
    setupHitTest(initRoleUrl);
    loadRoles();
    loadAudio();
    loadUsageSettings(function () {
      try {
        if (usageSet && usageSet.taskEnd) {
          taskEndToggle.checked = !!usageSet.taskEnd.on;
          taskEndSel.disabled = !usageSet.taskEnd.on;
        }
        fillTaskEndOptions(usageSet && usageSet.taskEnd);
        setTimeout(function () {
          try {
            if (audioFragments && audioFragments.length) fillTaskEndOptions(usageSet && usageSet.taskEnd);
          } catch (err) {}
        }, 1500);
      } catch (err) {}
    });
    window.WhaleI18n.onChange(function () {
      // Refresh existing values only. Never recreate drafts, replay an image, or reset TTL.
      WhaleMoney.refreshBindings(document.body);
      updateFxButton();
      if (currencyDrop) currencyDrop.sync();
      if (taskEndDrop) taskEndDrop.sync();
      if (window.WhaleBubbleLayout && bubbleFrames && bubbleFrames.front) window.WhaleBubbleLayout.fit(bubbleFrames.front.text || bubbleFrames.front.root);
    });
    loadBubbleCfg().catch(assetFailure);
    if (window.whaleDesktop && window.whaleDesktop.testMode) {
      window.__whaleRenderTest = Object.freeze({
        refresh: refresh, usage: refreshUsageMain, next: bubbleNext, close: hideBubble,
        poll: pollLastTurn, importRole: onRoleFileChosen, importBubble: bubbleUploadImg,
        openHistory: openUsageRecordsWindow,
        showCost: showCostBubble,
        open: whaleClick,
        queue: function (items) { hideBubble(); bubbleSeq = items; },
        place: function (x, y, flip) { state.left = x; state.top = y; state.flip = !!flip; express(); },
        scale: setScale, role: applyRole,
        scene: function (modules, ttl) { sceneOpen('custom', function () { bubbleRenderModules(modules); }, ttl || 0); },
        cost: function (record) { var notice = WhaleTurnNotice.snapshot(record, state.currency); sceneOpen('cost', function () { bubbleRenderCost(notice.amount, notice); }, 0); },
        status: function () { return { switching: bubbleFrames.switching, busy: busy, shown: bubbleShown, scene: bubbleScene && bubbleScene.kind, epoch: bubbleSceneEpoch, balance: state.balance, today: state.todayUsage, status: state.status, front: bubbleFrames.front.root.dataset.buffer, randomPicks: bubbleFrames.front.root.innerText, hitCache: Object.assign({}, WhaleRendering.hitCache.stats), scale: state.scale, flip: state.flip }; }
      });
    }
    fetch(SIZE_URL, {
      cache: 'no-store'
    }).then(function (r) {
      return r.json();
    }).then(function (d) {
      positioner.style.transition = 'none';
      if (!d || d.ok === false) throw new Error(d && d.error || wt("widgetLevel7.settingsReadFailed"));
      d = settingsWriter.loaded(d);
      if (d && typeof d.scale === 'number' && d.scale >= MIN_SCALE - 0.1 && d.scale <= MAX_SCALE + 0.1) {
        state.scale = d.scale;
        root.style.setProperty('--dshw-scale', String(d.scale));
        scaleInput.value = String(d.scale);
        scaleNumber.value = String(scaleToDisplay(d.scale));
        settle();
      }
      if (d && typeof d.vol === 'number') {
        soundVol = d.vol;
        soundOn = soundVol > 0;
        volInput.value = String(soundVol);
        volPct.textContent = Math.round(soundVol * 100) + '%';
        try {
          if (pressAudio) pressAudio.volume = soundVol;
          if (releaseAudio) releaseAudio.volume = soundVol;
        } catch (err) {}
      }
      if (d && typeof d.soundSet === 'string' && d.soundSet) {
        soundSet = d.soundSet;
        setAudioBtnText(audioGroupName(soundSet));
        applySoundSet();
      }
      if (d && typeof d.usageMode === 'string') {
        usageMode = 'ledger';
      }
      if (d && typeof d.bubbleOn === 'boolean') {
        bubbleOn = d.bubbleOn;
        bubbleToggle.checked = bubbleOn;
      }
      if (d && typeof d.turnCostOn === 'boolean') {
        turnCostOn = d.turnCostOn;
        turnCostToggle.checked = turnCostOn;
        turnCostCloseInput.disabled = !turnCostOn;
      }
      if (d && typeof d.turnCostCloseMs === 'number') {
        turnCostCloseMs = d.turnCostCloseMs > 0 ? d.turnCostCloseMs : 0;
        turnCostCloseInput.value = String(Math.round(turnCostCloseMs / 1000));
      }
      if (d && typeof d.scrollGapOn === 'boolean') {
        scrollGapOn = d.scrollGapOn;
        scrollGapToggle.checked = scrollGapOn;
        scrollGapInput.disabled = !scrollGapOn;
      }
      if (d && typeof d.scrollGapPx === 'number') {
        scrollGapPx = d.scrollGapPx > 0 ? Math.round(d.scrollGapPx) : 0;
        scrollGapInput.value = String(scrollGapPx);
      }
      if (d && typeof d.menuBtnHide === 'boolean') {
        menuBtnHide = d.menuBtnHide;
        if (menuHideToggle) menuHideToggle.checked = menuBtnHide;
        applyMenuBtnHideUI();
      }
      applyAnchorPos(); settle();
      void positioner.getBoundingClientRect();
      requestAnimationFrame(function () { positioner.style.transition = ''; });
      refresh(false);
    }).catch(function (error) {
      assetFailure(error);
      refresh(false);
    });
    setInterval(function () {
      refresh(false);
    }, REFRESH_MS);
    window.addEventListener('whale-refresh', function () {
      refresh(true);
    });
    var LAST_TURN_URL = '/dsh-whale/last-turn.json';
    var accountNoticeClient = window.WhaleAccountNotices && window.WhaleAccountNotices.create({
      enabled: function () { return bubbleOn && turnCostOn && !document.hidden && (!window.WhaleAccountView || window.WhaleAccountView.mode !== 'subscription'); },
      enqueue: function (record, hooks) {
        var notice = Object.freeze({ noticeType: 'account', id: record.id, scope: record.scope,
          labelKey: "widgetLevel7.accountSpend", label: wt("widgetLevel7.accountSpend"), amount: record.amount, currency: record.currency, costState: 'observed',
          tokens: null, concurrent: record.concurrent,
          noteKey: "widgetLevel7.accountSpendNote", note: wt("widgetLevel7.accountSpendNote") });
        return whaleSysPush({ kind: 'cost', amount: notice.amount, notice: notice, rank: 2,
          isValid: hooks.valid, onShown: hooks.shown, onDiscard: hooks.discarded });
      }
    });
    function pollAccountNotices() { if (accountNoticeClient) return accountNoticeClient.poll(); }
    if (accountNoticeClient) {
      document.addEventListener('visibilitychange', function () { if (document.hidden) accountNoticeClient.invalidate(); else pollAccountNotices(); });
      window.addEventListener('whale-account-view', function () { accountNoticeClient.invalidate(); pollAccountNotices(); });
      window.addEventListener('whale-refresh', function () { accountNoticeClient.invalidate(); pollAccountNotices(); });
    }
    var lastCostSeq = 0;
    var lastCostAligned = false;
    var lastCostId = '';
    var lastCostPending = false;
    var costPollingStartedAt = Date.now();
    try {
      var lastCostStored = Number(localStorage.getItem('dshw-last-seq') || 0);
      if (isFinite(lastCostStored) && lastCostStored >= 0) lastCostSeq = lastCostStored;
      lastCostId = localStorage.getItem('dshw-last-turn-id') || '';
    } catch (err) {}
    function pollLastTurn() {
      if (lastCostPending) return;
      lastCostPending = true;
      try {
        fetch(LAST_TURN_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (!d || !d.ok || typeof d.seq !== 'number') return;
          if (d.seq < lastCostSeq) return;
          var firstPoll = !lastCostAligned;
          lastCostAligned = true;
          var fresh = WhaleTurnNotice.shouldNotify(d, { seq: lastCostSeq, id: lastCostId, firstPoll: firstPoll, startedAt: costPollingStartedAt });
          lastCostSeq = d.seq;
          if (d.id) lastCostId = d.id;
          try {
            localStorage.setItem('dshw-last-seq', String(lastCostSeq));
            localStorage.setItem('dshw-last-turn-id', lastCostId);
          } catch (err) {}
          if (!fresh) return;
          var notice = WhaleTurnNotice.snapshot(d, state.currency);
          window.dispatchEvent(new CustomEvent('whale-turn-notice', {detail:notice}));
          if (notice.completionKind === 'success') playTaskEndSound();
          else if (notice.completionKind === 'cancelled' && turnCostOn && usageSet && usageSet.taskEnd && usageSet.taskEnd.on && soundOn && soundVol > 0 && window.WhaleFeedback) window.WhaleFeedback.play('cancelled', '', soundVol);
          if (typeof window !== 'undefined' && window.WhaleAccountView?.mode === 'subscription') { if(turnCostOn)window.WhaleAccountView.notice(notice); return; }
          showCostBubble(notice.amount, notice);
        }).catch(function () {}).finally(function () { lastCostPending = false; });
      } catch (err) { lastCostPending = false; }
    }
    setInterval(pollLastTurn, 1000);
    setInterval(pollAccountNotices, 1000);
  }
  if (dshwEnabled) {
    try {
      dshwInit();
    } catch (err) {}
  }
})();
