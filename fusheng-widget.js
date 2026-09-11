// 浮生 · 全站右下角陪伴小窗
(function(){
  if(window.__fswidget) return; window.__fswidget = 1;
  var ROOT = (location.pathname.indexOf('/jing/')!==-1) ? '../' : '';
  var SB_URL = window.SB_URL || "https://nvlaprxcuyokolpfwoto.supabase.co";
  var SB_KEY = window.SB_KEY || "sb_publishable_Cf-3X6qJB_f441y47_GOUw_92Ak2ZV5";
  var API = SB_URL + "/functions/v1/fusheng-chat";

  var hasTabbar = !!document.querySelector('.tabbar');
  var lift = hasTabbar ? 78 : 0;

  var css = ''+
  '#fsw-btn{position:fixed;right:18px;bottom:calc('+(18+lift)+'px + env(safe-area-inset-bottom));z-index:9990;'+
    'width:54px;height:54px;border-radius:50%;border:1px solid rgba(66,54,38,.3);cursor:pointer;'+
    'background:#2c251c;color:#f7f2e7;font-family:"Noto Serif TC",serif;font-size:20px;font-weight:600;'+
    'box-shadow:0 4px 18px rgba(44,37,28,.28);transition:.2s}'+
  '#fsw-btn:hover{background:#a8412f}'+
  '#fsw-panel{position:fixed;right:18px;bottom:calc('+(82+lift)+'px + env(safe-area-inset-bottom));z-index:9991;'+
    'width:min(370px,calc(100vw - 36px));height:min(520px,calc(100vh - '+(120+lift)+'px));display:none;flex-direction:column;'+
    'background:#f4efe5;border:1px solid rgba(66,54,38,.3);box-shadow:0 10px 40px rgba(44,37,28,.3);'+
    'font-family:"Noto Sans TC",sans-serif;color:#2c251c}'+
  '#fsw-panel.open{display:flex}'+
  '#fsw-head{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;'+
    'border-bottom:1px solid rgba(66,54,38,.16)}'+
  '#fsw-head b{font-family:"Noto Serif TC",serif;font-weight:600;letter-spacing:.18em;font-size:15px}'+
  '#fsw-head div{display:flex;gap:14px;align-items:center}'+
  '#fsw-head a{font-size:12px;color:#6b6254;text-decoration:none;letter-spacing:.08em}'+
  '#fsw-head a:hover{color:#a8412f}'+
  '#fsw-x{border:0;background:none;color:#6b6254;font-size:17px;cursor:pointer;padding:0 2px}'+
  '#fsw-log{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px}'+
  '.fsw-m{max-width:84%;line-height:1.8;font-size:14.5px;padding:10px 13px;white-space:pre-wrap;word-break:break-word}'+
  '.fsw-me{align-self:flex-end;background:#e9e0cc;border:1px solid rgba(66,54,38,.16)}'+
  '.fsw-fs{align-self:flex-start;background:#faf6ec;border:1px solid rgba(66,54,38,.16)}'+
  '.fsw-hello{align-self:center;text-align:center;color:#6b6254;font-family:"Noto Serif TC",serif;'+
    'font-size:13.5px;line-height:2;letter-spacing:.04em;margin:10px 0 2px}'+
  '.fsw-wait:after{content:"…";animation:fswd 1.2s steps(4,end) infinite}'+
  '@keyframes fswd{0%{content:""}25%{content:"·"}50%{content:"· ·"}75%{content:"· · ·"}}'+
  '#fsw-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));'+
    'border-top:1px solid rgba(66,54,38,.16)}'+
  '#fsw-in{flex:1;resize:none;border:1px solid rgba(66,54,38,.3);background:#fff;color:#2c251c;'+
    'font-family:"Noto Sans TC",sans-serif;font-size:14.5px;line-height:1.6;padding:9px 11px;height:40px}'+
  '#fsw-in:focus{outline:none;border-color:#a8412f}'+
  '#fsw-go{border:0;background:#2c251c;color:#f7f2e7;font-size:13.5px;letter-spacing:.1em;'+
    'padding:0 16px;cursor:pointer;font-family:"Noto Sans TC",sans-serif}'+
  '#fsw-go:hover{background:#a8412f}#fsw-go:disabled{opacity:.4;cursor:default}';

  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.id='fsw-btn'; btn.type='button'; btn.title='跟浮生說說話'; btn.textContent='浮';
  document.body.appendChild(btn);

  var panel = document.createElement('div'); panel.id='fsw-panel';
  panel.innerHTML =
    '<div id="fsw-head"><b>浮生</b><div><a href="'+ROOT+'chat.html">完整頁面</a>'+
    '<button id="fsw-x" type="button" aria-label="關閉">×</button></div></div>'+
    '<div id="fsw-log"><p class="fsw-hello">我是浮生。<br>想到哪說到哪就可以。</p></div>'+
    '<form id="fsw-form"><textarea id="fsw-in" rows="1" maxlength="2000" placeholder="想說什麼都可以…"></textarea>'+
    '<button id="fsw-go" type="submit">說</button></form>';
  document.body.appendChild(panel);

  var hist=[], logEl=panel.querySelector('#fsw-log'), inp=panel.querySelector('#fsw-in'),
      go=panel.querySelector('#fsw-go');
  var GUEST_LIMIT=10, gated=false;

  function memberToken(){
    try{
      var ref=SB_URL.split('//')[1].split('.')[0];
      var raw=localStorage.getItem('sb-'+ref+'-auth-token');
      if(!raw) return null;
      var s=JSON.parse(raw);
      return (s&&s.access_token)?s.access_token:null;
    }catch(e){return null}
  }
  function showGate(){
    if(gated) return; gated=true;
    var d=document.createElement('div');
    d.className='fsw-m fsw-fs';
    d.innerHTML='今天聊到這裡了。想繼續的話，加入會員（免費，只要 Email）就可以不限句數地聊。<br>'+
      '<a href="'+ROOT+'login.html?mode=up&next=chat" style="color:#a8412f">→ 免費加入會員</a>'+
      '<span style="color:#8a8172">　或　</span>'+
      '<a href="'+ROOT+'login.html?next=chat" style="color:#7a5630">登入</a>';
    logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight;
    inp.disabled=true; go.disabled=true;
    inp.placeholder='加入會員後可以繼續聊';
  }

  btn.addEventListener('click', function(){ panel.classList.toggle('open'); if(panel.classList.contains('open')) inp.focus(); });
  panel.querySelector('#fsw-x').addEventListener('click', function(){ panel.classList.remove('open'); });

  function add(role, text, wait){
    var d=document.createElement('div');
    d.className='fsw-m '+(role==='user'?'fsw-me':'fsw-fs')+(wait?' fsw-wait':'');
    d.textContent=text; logEl.appendChild(d); logEl.scrollTop=logEl.scrollHeight; return d;
  }

  function send(){
    var text=inp.value.trim(); if(!text) return;
    var tok=memberToken();
    if(!tok && hist.filter(function(m){return m.role==='user'}).length>=GUEST_LIMIT){ showGate(); return; }
    inp.value='';
    add('user',text); hist.push({role:'user',content:text});
    go.disabled=true;
    var w=add('fs','',true);
    fetch(API,{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+(tok||SB_KEY),'apikey':SB_KEY},
      body:JSON.stringify({messages:hist.slice(-80)})})
    .then(function(r){return r.json().then(function(d){return {ok:r.ok,st:r.status,d:d}})})
    .then(function(res){
      w.classList.remove('fsw-wait');
      if(res.st===403 && res.d.error==='limit_guest'){ w.remove(); showGate(); return; }
      if(res.ok && res.d.reply){ w.textContent=res.d.reply; hist.push({role:'assistant',content:res.d.reply}); }
      else throw new Error();
    })
    .catch(function(){ w.classList.remove('fsw-wait'); w.textContent='抱歉，我這邊好像斷線了，稍等一下再試一次好嗎？'; })
    .then(function(){ go.disabled=false; logEl.scrollTop=logEl.scrollHeight; });
  }

  panel.querySelector('#fsw-form').addEventListener('submit',function(e){e.preventDefault();send()});
  inp.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}
  });
})();
