export function prototypeUiHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PUB Prototype</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#09090b;color:#fafafa}
*{box-sizing:border-box}
body{margin:0;height:100vh;overflow:hidden;background:#09090b}
.app{display:grid;grid-template-columns:minmax(60px,260px) minmax(360px,1fr) minmax(500px,2fr);height:100vh;overflow:hidden}
/* Sidebar */
.sidebar{display:flex;flex-direction:column;border-right:1px solid #27272a;background:#111113;overflow:auto}
.sidebar.collapsed{width:40px;padding:0;border:none;display:flex;overflow:hidden}
.sidebar.collapsed .brand,.sidebar.collapsed .project-label,.sidebar.collapsed .session,.sidebar.collapsed .versions {display:none}
.sidebar .header{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #27272a;font-weight:700}
.sidebar .brand{display:flex;align-items:center;gap:8px}
.sidebar .dot{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 14px rgba(255,255,255,.6)}
.sidebar .toolbar button{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:6px 8px;cursor:pointer;font-size:10px}
.sidebar .project-label{margin:12px;padding:8px 12px;color:#a1a1aa;font-size:12px;border-bottom:1px solid #27272a}
.sidebar .session{margin:12px;padding:8px 12px;border:1px solid #27272a;border-radius:9px;color:#a1a1aa;font-size:11px;word-break:break-all}
.sidebar .versions{margin:12px;border-top:1px solid #27272a;padding-top:12px}
.sidebar .versions-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa}
.sidebar .version{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 9px;margin-bottom:6px;border:1px solid #27272a;background:#151517;border-radius:9px}
.sidebar .version-main{min-width:0}
.sidebar .version-name{font-size:12px;color:#e4e4e7}
.sidebar .version-meta{font-size:10px;color:#71717a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sidebar .version button{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:6px 8px;cursor:pointer;font-size:10px}
.sidebar .version button:disabled{opacity:.4;cursor:not-allowed}
/* Conversation */
.conversation{display:flex;flex-direction:column;height:100vh;overflow:hidden}
.chat{flex:1;overflow:auto;padding:12px}
.message{margin-bottom:12px}
.role{font-size:11px;color:#a1a1aa;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em}
.bubble{border:1px solid #27272a;background:#18181b;border-radius:12px;padding:10px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.user .bubble{background:#202024}
.agent .bubble{background:#0f0f10}
.system{font-size:12px;color:#a1a1aa;padding:6px 0}
.timeline{margin:8px 0 16px 4px;padding-left:16px;border-left:1px solid #3f3f46}
.step{position:relative;display:flex;gap:9px;padding:5px 0;color:#a1a1aa;font-size:12px}
.step:before{content:'';width:7px;height:7px;border-radius:50%;background:#52525b;position:absolute;left:-20px;top:10px}
.step.done{color:#e4e4e7}
.step.done:before{background:#fafafa;box-shadow:0 0 8px rgba(255,255,255,.35)}
.step.active{color:#fafafa}
.step.active:before{background:#fff;box-shadow:0 0 10px rgba(255,255,255,.75)}
.step.error{color:#fca5a5}
.step.error:before{background:#ef4444}
.step .step-label{font-weight:600}
.step .step-time{color:#71717a;font-size:10px;margin-left:6px;opacity:.7}
.step .step-detail{color:#71717a;font-size:11px;margin-top:2px;max-width:90%}
.checkpoint{margin:6px 0 16px;padding:9px 11px;border:1px solid #27272a;border-radius:10px;background:#0f0f10;font-size:11px;color:#a1a1aa}
.checkpoint .checkpoint-title{font-weight:600;color:#e4e4e7;margin-bottom:4px}
.checkpoint .checkpoint-files{display:flex;flex-wrap:gap:4px;margin-top:4px}
.checkpoint .checkpoint-file{font-size:10px;color:#71717a;background:#18181b;border:1px solid #27272a;border-radius:4px;padding:1px 6px}
.checkpoint .checkpoint-sha{font-size:10px;color:#71717a;margin-top:2px}
/* Agent output (changed files summary) */
.agent-output{border:1px solid #27272a;border-radius:10px;background:#111113;padding:8px 10px;margin:8px 0 16px}
.agent-output .ao-title{font-weight:600;color:#e4e4e7;font-size:11px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
.agent-output .ao-files{display:flex;flex-wrap:gap:3px;margin-top:3px}
.agent-output .ao-file{font-size:10px;color:#a1a1aa;background:#18181b;border:1px solid #27272a;border-radius:3px;padding:1px 5px}
.agent-output .ao-summary{font-size:10px;color:#71717a;margin-top:3px;max-height:60px;overflow:auto}
/* Error card */
.error-card{border:1px solid #ef4444;border-radius:10px;background:#2a1010;padding:8px 10px;margin:8px 0 16px;color:#fca5a5;font-size:12px}
.error-card .error-title{font-weight:600;margin-bottom:4px}
.error-card .error-msg{color:#fecaca;font-size:11px;margin-top:2px}
.error-card .error-detail{color:#fca5a5;font-size:10px;margin-top:4px;cursor:pointer}
.error-card .error-detail:hover{color:#fff}
.error-card .error-expanded{color:#fecaca;font-size:10px;margin-top:4px;white-space:pre-wrap;max-height:0;overflow:hidden;transition:max-height .3s ease}
.error-card .error-expanded.expanded{max-height:300px}
/* Checkpoint summary card */
.checkpoint-summary{border:1px solid #27272a;border-radius:10px;background:#111113;padding:8px 10px;margin:8px 0 16px;font-size:12px;color:#a1a1aa}
.checkpoint-summary .cs-title{font-weight:600;color:#e4e4e7;margin-bottom:2px}
.checkpoint-summary .cs-status{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600}
.checkpoint-summary .cs-status.passed{background:#14532d;color:#bbf7d0;border:1px solid #16a34a}
.checkpoint-summary .cs-status.failed{background:#7f1d1d;color:#fecaca;border:1px solid #ef4444}
.checkpoint-summary .cs-sha{font-size:10px;color:#71717a;margin-top:2px}
.checkpoint-summary .cs-files{display:flex;flex-wrap:gap:3px;margin-top:3px}
.checkpoint-summary .cs-file{font-size:10px;color:#a1a1aa;background:#18181b;border:1px solid #27272a;border-radius:3px;padding:1px 5px}
/* Composer */
.composer{padding:12px;border-top:1px solid #27272a;position:relative}
.compose-wrap{position:relative}
.prompt{min-height:80px;max-height:300px;resize:none;padding-right:78px;overflow:auto;width:100%;border:1px solid #3f3f46;background:#18181b;color:#fff;border-radius:10px;padding:8px 10px;outline:none;font-family:inherit;font-size:13px}
.prompt::placeholder{color:#71717a}
.send{position:absolute;right:8px;bottom:8px;border:0;border-radius:9px;background:#fafafa;color:#111;padding:6px 12px;font-weight:700;cursor:pointer;font-size:12px}
.send:disabled{opacity:.45;cursor:not-allowed}
.send.hint{background:#202024;color:#a1a1aa;cursor:not-allowed;font-size:11px}
.scroll-bottom{position:absolute;right:16px;bottom:80px;background:#fafafa;color:#111;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;display:none;z-index:10}
/* Preview */
.preview{display:flex;flex-direction:column;background:#0a0a0b;overflow:hidden}
.preview-header{min-height:40px;height:auto;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #27272a}
.preview-title{display:flex;gap:8px;align-items:center}
.status{font-size:12px;color:#a1a1aa}
.preview-actions button{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:11px;margin-left:4px}
.preview-frame{flex:1;position:relative}
.frame{height:100%;border:1px solid #27272a;border-radius:14px;overflow:hidden;background:#fff;position:relative}
.empty{position:absolute;inset:0;display:grid;place-items:center;color:#71717a;background:radial-gradient(circle at center,#18181b 0,#0b0b0c 48%,#09090b 100%);padding:20px;text-align:center}
.preview-url{display:none;padding:9px 14px;font-size:11px;color:#a1a1aa;border-top:1px solid #27272a;word-break:break-all}
.preview-url a{color:#e4e4e7}
.progress{height:2px;background:#27272a;position:absolute;left:0;right:0;top:59px}
.progress span{display:block;height:100%;width:0;background:#fafafa;transition:width .3s ease}
iframe{width:100%;height:100%;border:0;background:#fff;display:none}
.splitter{width:4px;cursor:col-resize;background:#27272a;position:relative}
/* Mobile */
@media(max-width:900px){
  .app{grid-template-columns:1fr}
  .sidebar{display:none}
  .sidebar-toggle{position:fixed;top:12px;left:12px;z-index:100;background:#18181b;border:1px solid #27272a;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;color:#d4d4d8}
  .preview-toggle{position:fixed;top:12px;right:12px;z-index:100;background:#18181b;border:1px solid #27272a;border-radius:7px;padding:6px 10px;cursor:pointer;font-size:12px;color:#d4d4d8}
}
/* Processing overlay */
.processing-overlay{display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;position:absolute;inset:0;background:rgba(9,9,11,.91);z-index:10;text-align:center;color:#fff;padding:24px}
.spinner{width:40px;height:40px;border:4px solid rgba(255,255,255,.1);border-left-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.overlay-title{font-weight:700;font-size:16px}
.overlay-desc{font-size:13px;color:#a1a1aa}
.overlay-tips{font-size:11px;color:#71717a;margin-top:8px}
</style>
</head>
<body>
<div class="app">
  <!-- Sidebar -->
  <section class="sidebar" id="sidebar" role="navigation" aria-label="Sidebar navigation">
    <div class="header">
      <div class="brand"><span class="dot"></span>PUB Prototype</div>
      <button id="collapseSidebar" title="Recolher" aria-label="Collapse sidebar">☰</button>
    </div>
    <div class="toolbar"><button id="newProject" aria-label="New project">Novo</button></div>
    <div class="project-label" id="projectLabel" aria-label="Current project">Projeto: <span id="projectName"></span></div>
    <div class="session" id="sessionBox" aria-label="Current session"></div>
    <div class="versions" id="versions" aria-label="Version history">
      <div class="versions-title"><span>Version History</span><span> (Histórico de versões)</span><span id="versionCount"></span></div>
      <div id="versionList"></div>
    </div>
  </section>

  <!-- Conversation column -->
  <section class="conversation" id="conversation">
    <div class="chat" id="chat"></div>
    <div class="composer">
      <div class="compose-wrap">
        <textarea id="prompt" class="prompt" placeholder="Descreva uma ideia e o PP cria o MVP — ex: um sistema para gerenciamento de barbearia"></textarea>
        <button id="send" class="send" disabled>Enviar</button>
      </div>
      <button id="scrollBottom" class="scroll-bottom">↓</button>
    </div>
  </section>

  <!-- Splitter -->
  <div class="splitter" id="splitter"></div>

  <!-- Preview column -->
  <section class="preview" id="preview">
    <div class="preview-header">
      <div class="preview-title"><strong>Live Preview</strong> <span class="status" id="status">Aguardando ideia</span></div>
      <div class="preview-actions">
        <button id="refresh" disabled>Recarregar</button>
        <button id="open" disabled>Abrir</button>
        <button id="fullscreen" title="Fullscreen">⛶</button>
        <button id="mobileToggle" title="Mostrar/ocultar preview">📱</button>
      </div>
      <div class="progress"><span id="progress"></span></div>
    </div>
    <div class="preview-frame">
      <div class="frame" id="frame">
        <div id="empty" class="empty">O produto aparecerá aqui conforme o PP construir e validar o MVP.</div>
        <iframe id="iframe" title="PUB Prototype live preview"></iframe>
      </div>
    </div>
    <div class="preview-url" id="previewUrl"></div>
  </section>
</div>
<script>
let sessionId=null,source=null,currentUrl=null,activeTimeline=null,checkpoints=[];
const STORAGE_KEY='pub-prototype:last-session';
const LAST_SEQ_KEY='pub-prototype:last-seq';
const SPLIT_KEY='pub-prototype:split';
const SIDEBAR_KEY='pub-prototype:sidebar-collapsed';
const MOBILE_KEY='pub-prototype:mobile-active';
function $(id){return document.getElementById(id)}
let sendBtn=document.getElementById('send'),chat=document.getElementById('chat'),progress=document.getElementById('progress');

function formatTime(date){
  if(!date) return '';
  try {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return diffMin + 'm';
    if (diffDay < 1) return d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    if (diffDay < 2) return 'ontem ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  } catch { return ''; }
}

function add(label,text,timestamp){
  const el=document.createElement('div');
  el.className='message '+(label==='Você'?'user':label==='PP'?'agent':'system');
  const role=document.createElement('div');
  role.className='role';
  role.textContent=label;
  if(timestamp){
    const ts=document.createElement('span');
    ts.className='msg-time';
    ts.style.cssText='font-size:10px;color:#71717a;margin-left:6px;opacity:.7';
    ts.textContent=formatTime(timestamp);
    role.appendChild(ts);
  }
  const bubble=document.createElement('div');
  bubble.className='bubble';
  bubble.textContent=text;
  el.append(role,bubble);
  chat.appendChild(el);
}

function system(txt){const el=document.createElement('div');el.className='system';el.textContent=txt;chat.appendChild(el);}

function setStatus(txt){$('status').textContent=txt}

function showOverlay(title,desc){
  $('overlay').style.display='flex';
  $('overlayTitle').textContent=title;
  $('overlayDesc').textContent=desc;
  sendBtn.disabled=true;
  $('prompt').disabled=true;
  sendBtn.textContent='Processando...';
}

function hideOverlay(){
  $('overlay').style.display='none';
  sendBtn.disabled=false;
  $('prompt').disabled=false;
  sendBtn.textContent='Enviar';
}

function renderVersions(){
  const box=$('versions'),list=$('versionList');
  if(!checkpoints.length){box.style.display='none';return}
  box.style.display='block';
  $('versionCount').textContent=checkpoints.length;
  list.innerHTML='';
  checkpoints.slice().sort((a,b)=>a.promptIndex-b.promptIndex).forEach(cp=>{
    const row=document.createElement('div');
    row.className='version';
    const main=document.createElement('div');
    main.className='version-main';
    const name=document.createElement('div');
    name.className='version-name';
    name.textContent='v'+cp.promptIndex+' · '+(cp.prompt.length>42?cp.prompt.slice(0,42)+'…':cp.prompt);
    const meta=document.createElement('div');
    meta.className='version-meta';
    meta.textContent=(cp.commitSha?cp.commitSha.slice(0,8):'sem commit')+' · '+(cp.buildPassed?'válida':'falhou');
    main.append(name,meta);
    const btn=document.createElement('button');
    btn.textContent='Restaurar';
    btn.disabled=!cp.buildPassed||!cp.commitSha;
    btn.onclick=()=>restore(cp);
    row.append(main,btn);
    list.appendChild(row);
  });
}

function checkpoint(payload,renderPrompt=false){
  const cp={...payload};
  if(cp.id&&!checkpoints.some(x=>x.id===cp.id))checkpoints.push(cp);

  // Render agent-output summary card (files changed)
  const files = cp.changedFiles || [];
  if(renderPrompt && cp.prompt){
    add('Você',cp.prompt);
  }

  // Checkpoint summary card
  const card=document.createElement('div');
  card.className='checkpoint-summary';
  const title=document.createElement('div');
  title.className='checkpoint-summary-title';
  title.textContent='Checkpoint v'+(cp.promptIndex||'')+' concluído';
  const statusBadge=document.createElement('span');
  statusBadge.className='checkpoint-summary-status cs-status '+(cp.buildPassed?'passed':'failed');
  statusBadge.textContent=cp.buildPassed?'Build OK':'Build falhou';
  title.appendChild(statusBadge);
  card.appendChild(title);

  if(files.length > 0){
    const filesEl=document.createElement('div');
    filesEl.className='checkpoint-summary-files';
    const label=document.createElement('div');
    label.className='checkpoint-summary-file-label';
    label.style.cssText='font-size:10px;color:#a1a1aa;margin-bottom:3px';
    label.textContent='Arquivos ('+files.length+')';
    filesEl.appendChild(label);
    files.forEach(f => {
      const fEl=document.createElement('span');
      fEl.className='cs-file';
      fEl.textContent=f;
      filesEl.appendChild(fEl);
    });
    card.appendChild(filesEl);
  }

  if(cp.commitSha){
    const shaEl=document.createElement('div');
    shaEl.className='checkpoint-summary-sha';
    shaEl.textContent=cp.commitSha.slice(0,8);
    card.appendChild(shaEl);
  }

  chat.appendChild(card);
  activeTimeline=null;
  chat.scrollTop=chat.scrollHeight;
}

function renderPreview(url){
  if(!url)return;
  currentUrl=url;
  $('iframe').src=url;
  $('iframe').style.display='block';
  $('empty').style.display='none';
  $('refresh').disabled=false;
  $('open').disabled=false;
  $('previewUrl').style.display='block';
  $('previewUrl').innerHTML = '<a href="' + url + '" target="_blank" rel="noreferrer">' + url + '</a>';
}

function attachEvents(id){
  if(source)source.close();
  source=new EventSource('/prototype/sessions/'+encodeURIComponent(id)+'/events');

  source.addEventListener('USER_PROMPT',e=>{
    const p=JSON.parse(e.data).payload;
    step('USER_PROMPT');
    if(p?.prompt&&!p.prompt.startsWith('Restaurar v'))add('Você',p.prompt,p.timestamp);
  });

  source.addEventListener('AGENT_STARTED',e=>{
    step('AGENT_STARTED');
    setStatus('Construindo');
    showOverlay('Construindo...','Seu aplicativo está sendo construído.');
  });

  source.addEventListener('AGENT_OUTPUT',e=>{
    const p=JSON.parse(e.data).payload;
    step('AGENT_OUTPUT');
    setStatus('Implementando');
    showOverlay('Implementando...','Escrevendo arquivos de código.');

    // Render changed files summary
    const files = p?.changedFiles || [];
    if(files.length > 0){
      const ao=document.createElement('div');
      ao.className='agent-output';
      const title=document.createElement('div');
      title.className='ao-title';
      title.textContent='Arquivos alterados ('+files.length+')';
      ao.appendChild(title);
      const filesEl=document.createElement('div');
      filesEl.className='ao-files';
      files.forEach(f => {
        const fEl=document.createElement('span');
        fEl.className='ao-file';
        fEl.textContent=f;
        filesEl.appendChild(fEl);
      });
      ao.appendChild(filesEl);
      if(p?.summary){
        const summary=document.createElement('div');
        summary.className='ao-summary';
        summary.textContent=p.summary.slice(-500);
        ao.appendChild(summary);
      }
      chat.appendChild(ao);
      chat.scrollTop=chat.scrollHeight;
    }
  });

  source.addEventListener('BUILD_STARTED',e=>{
    step('BUILD_STARTED');
    setStatus('Validando');
    showOverlay('Validando...','Executando testes e checagem de tipos.');
  });

  source.addEventListener('BUILD_PASSED',e=>{
    step('BUILD_PASSED');
    setStatus('Build aprovado');
    showOverlay('Sucesso!','Build aprovado. Preparando preview.');
  });

  source.addEventListener('PREVIEW_STARTED',e=>{
    step('PREVIEW_STARTED');
    setStatus('Subindo preview');
    showOverlay('Preparando preview...','Publicando sua aplicação online.');
  });

  source.addEventListener('CHECKPOINT_CREATED',e=>{
    const p=JSON.parse(e.data).payload;
    checkpoint(p,false);
  });

  source.addEventListener('PREVIEW_READY',e=>{
    const ev=JSON.parse(e.data);
    renderPreview(ev.payload?.url||ev.payload?.previewUrl);
    step('PREVIEW_READY');
    setStatus('Pronto');
    hideOverlay();
    localStorage.setItem(STORAGE_KEY,sessionId);
  });

  source.addEventListener('ERROR',e=>{
    const p=JSON.parse(e.data).payload;
    step('ERROR',p?.message);
    setStatus('Erro');
    hideOverlay();

    const card=document.createElement('div');
    card.className='error-card';
    const title=document.createElement('div');
    title.className='error-title';
    title.textContent='⚠ Erro durante a execução';
    const msg=document.createElement('div');
    msg.className='error-msg';
    msg.textContent=p?.message||'Sem detalhes';
    card.append(title,msg);

    if(p?.message){
      const detail=document.createElement('div');
      detail.className='error-detail';
      detail.textContent='Detalhes ▸';
      const expanded=document.createElement('div');
      expanded.className='error-expanded';
      expanded.textContent=p.message;
      detail.onclick=()=>{expanded.classList.toggle('expanded');};
      card.append(detail,expanded);
    }

    chat.appendChild(card);
    chat.scrollTop=chat.scrollHeight;
  });

  source.addEventListener('BUILD_FAILED',e=>{
    const p=JSON.parse(e.data).payload;
    step('BUILD_FAILED',p?.message);
    setStatus('Falha no build');
    hideOverlay();

    const card=document.createElement('div');
    card.className='error-card';
    const title=document.createElement('div');
    title.className='error-title';
    title.textContent='⚠ Falha na validação';
    const msg=document.createElement('div');
    msg.className='error-msg';
    msg.textContent=p?.message||'Build falhou. Verifique os logs.';
    card.append(title,msg);

    if(p?.message){
      const detail=document.createElement('div');
      detail.className='error-detail';
      detail.textContent='Detalhes ▸';
      const expanded=document.createElement('div');
      expanded.className='error-expanded';
      expanded.textContent=p.message;
      detail.onclick=()=>{expanded.classList.toggle('expanded');};
      card.append(detail,expanded);
    }

    // Add recovery message
    const recovery=document.createElement('div');
    recovery.className='checkpoint-summary';
    recovery.style.borderColor='#71717a';
    recovery.style.background='#0f0f10';
    const recTitle=document.createElement('div');
    recTitle.className='checkpoint-summary-title';
    recTitle.textContent='💡 Dica';
    const recMsg=document.createElement('div');
    recMsg.style.cssText='font-size:10px;color:#a1a1aa';
    recMsg.textContent='O build falhou. Tente corrigir o erro acima e envie um novo prompt para continuar.';
    recovery.append(recTitle,recMsg);
    chat.appendChild(recovery);

    add('PP','A validação de build falhou: '+(p?.message||'Erro durante tsc/vitest.'));
    chat.scrollTop=chat.scrollHeight;
  });

  source.onerror=()=>{setStatus('Reconectando...')};
}

function step(event,detail){
  const wrap=document.createElement('div');
  wrap.className='step '+event.toLowerCase();
  const label=document.createElement('span');
  label.className='step-label';
  label.textContent=event;
  if(detail){
    label.textContent=event+': '+detail;
  }
  const time=document.createElement('span');
  time.className='step-time';
  time.textContent=formatTime(new Date());
  wrap.append(label,time);
  activeTimeline=wrap;
  chat.appendChild(wrap);
}

function clearChat(){chat.replaceChildren();activeTimeline=null}

async function loadSession(id){
  const r=await fetch('/prototype/sessions/'+encodeURIComponent(id));
  if(!r.ok)throw new Error('Sessão não encontrada');
  const data=await r.json();
  sessionId=data.session.id;
  $('projectName').textContent=data.session.project;
  $('sessionBox').style.display='block';
  $('sessionBox').textContent='Sessão '+sessionId;
  checkpoints=[...(data.checkpoints||[])];
  clearChat();

  const messages=(data.messages||[]);
  if(messages.length){
    messages.forEach(m=>{
      const lbl=m.role==='assistant'?'PP':m.role==='user'?'Você':m.role;
      add(lbl,m.content,m.createdAt);
    });
  }else{
    system('Sessão restaurada. Histórico e versões recuperados do PDL.');
    checkpoints.slice().sort((a,b)=>a.promptIndex-b.promptIndex).forEach(cp=>checkpoint(cp,true));
  }

  renderVersions();
  if(data.session.previewUrl)renderPreview(data.session.previewUrl);
  setStatus(data.session.status==='READY'?'Pronto':data.session.status.replaceAll('_',' '));
  attachEvents(id);
  localStorage.setItem(STORAGE_KEY,id);
  hideOverlay();

  if(['BUILDING','PREVIEWING','CREATING'].includes(data.session.status)){
    showOverlay('Construindo seu aplicativo...','Seu projeto continua sendo processado no servidor.');
    step('AGENT_STARTED');
  }
}

async function createSession(){
  const project=$('projectName').textContent.trim()||'untitled-prototype';
  const r=await fetch('/prototype/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project})});
  if(!r.ok)throw new Error(await r.text());
  const s=await r.json();
  sessionId=s.id;
  checkpoints=[];
  renderVersions();
  localStorage.setItem(STORAGE_KEY,s.id);
  localStorage.removeItem(LAST_SEQ_KEY);
  $('sessionBox').style.display='block';
  $('sessionBox').textContent='Sessão '+s.id;
  attachEvents(sessionId);
  add('PP','Sessão criada. Descreva sua ideia e o PP constrói o MVP.');
  return s;
}

async function send(){
  const text=$('prompt').value.trim();
  if(!text||sendBtn.disabled)return;

  showOverlay('Construindo...','Seu aplicativo está sendo construído.');
  add('Você',text);
  $('prompt').value='';
  $('prompt').style.height='auto';
  $('prompt').focus();
  activeTimeline=null;
  progress.style.width='4%';

  try{
    if(!sessionId)await createSession();
    fetch('/prototype/sessions/'+encodeURIComponent(sessionId)+'/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'user',content:text})}).catch(()=>{});

    const r=await fetch('/prototype/sessions/'+encodeURIComponent(sessionId)+'/prompts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:text})});
    if(!r.ok){
      const err=await r.text();
      let parsed={error:err};
      try{parsed=JSON.parse(err)}catch{}
      if(parsed.error?.includes('already processing')){
        throw new Error('Seu projeto ainda está sendo construído. Aguarde a conclusão da tarefa ativa.');
      }
      throw new Error(parsed.error||err);
    }

    // Show hint in send button while processing
    sendBtn.textContent='Enviado';
    sendBtn.classList.add('hint');

    setStatus('Tarefa enfileirada');
  }catch(e){
    add('PP','Erro: '+(e?.message||String(e)));
    setStatus('Erro');
    hideOverlay();
    progress.style.width='100%';
    sendBtn.textContent='Enviar';
    sendBtn.classList.remove('hint');
  }
}

function restore(cp){
  if(!sessionId||sendBtn.disabled)return;
  if(!window.confirm('Restaurar a v'+cp.promptIndex+'? Isso cria uma nova versão a partir desse snapshot e preserva o histórico.'))return;
  showOverlay('Restaurando v'+cp.promptIndex+'...','Aguarde o carregamento do checkpoint.');
  add('Você','Restaurar v'+cp.promptIndex);
  activeTimeline=null;
  progress.style.width('8%');
  fetch('/prototype/sessions/'+encodeURIComponent(sessionId)+'/restore/'+encodeURIComponent(cp.id),{method:'POST'})
    .then(r=>{
      if(!r.ok)throw new Error(r.statusText);
      setStatus('Restaurando');
    })
    .catch(e=>{
      add('PP','Erro ao restaurar: '+(e?.message||String(e)));
      setStatus('Erro');
      hideOverlay();
    });
}

function toggleSidebar(){
  const sb=$('sidebar');
  sb.classList.toggle('collapsed');
  const collapsed=sb.classList.contains('collapsed');
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
}

function toggleMobilePreview(){
  const preview=$('preview');
  const conv=$('conversation');
  const current = localStorage.getItem(MOBILE_KEY)||'conversation';
  if(preview.style.display==='none' || current==='conversation'){
    preview.style.display='flex';
    conv.style.gridColumn='auto';
    localStorage.setItem(MOBILE_KEY,'preview');
  }else{
    preview.style.display='none';
    conv.style.gridColumn='1 / -1';
    localStorage.setItem(MOBILE_KEY,'conversation');
  }
}

function enterFullscreen(){
  const el=$('preview');
  if(el.requestFullscreen){
    el.requestFullscreen();
  }else if(el.webkitRequestFullscreen){
    el.webkitRequestFullscreen();
  }else{
    const tips=$('overlayTips');
    if(tips){
      tips.textContent='Fullscreen API não suportada neste navegador.';
      $('overlay').style.display='flex';
    }
  }
}

function exitFullscreen(){if(document.exitFullscreen){document.exitFullscreen();}else if(document.webkitExitFullscreen){document.webkitExitFullscreen();}}

function initSplitter(){
  const splitter=$('splitter');
  let dragging=false;let startX=0;let startConv=0;let startPrev=0;
  splitter.addEventListener('mousedown',e=>{
    dragging=true;startX=e.clientX;
    const cols=getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ');
    startConv=parseInt(cols[1]);startPrev=parseInt(cols[2]);
    document.body.style.userSelect='none';
  });
  window.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const dx=e.clientX-startX;
    let newConv=startConv+dx;
    let newPrev=startPrev-dx;
    const minConv=360;const minPrev=500;
    if(newConv<minConv){newConv=minConv;newPrev=startConv+startPrev-minConv;}
    if(newPrev<minPrev){newPrev=minPrev;newConv=startConv+startPrev-minPrev;}
    document.querySelector('.app').style.gridTemplateColumns='260px ' + newConv + 'px ' + newPrev + 'px';
  });
  window.addEventListener('mouseup',()=>{
    if(dragging){
      dragging=false;
      document.body.style.userSelect='auto';
      localStorage.setItem(SPLIT_KEY,document.querySelector('.app').style.gridTemplateColumns);
    }
  });
  const saved=localStorage.getItem(SPLIT_KEY);
  if(saved){document.querySelector('.app').style.gridTemplateColumns=saved;}
}

$('prompt').addEventListener('input',function(){
  this.style.height='auto';
  this.style.height=Math.min(this.scrollHeight,300)+'px';
});

chat.addEventListener('scroll',()=>{
  if(chat.scrollTop+chat.clientHeight<chat.scrollHeight-50){
    $('scrollBottom').style.display='block';
  }else{
    $('scrollBottom').style.display='none';
  }
});

$('scrollBottom').addEventListener('click',()=>{chat.scrollTop=chat.scrollHeight;});
$('send').addEventListener('click',send);

$('refresh').addEventListener('click',()=>{if(currentUrl)$('iframe').src=currentUrl});
$('open').addEventListener('click',()=>{if(currentUrl)window.open(currentUrl,'_blank','noopener,noreferrer')});

$('newProject').addEventListener('click',()=>{
  if(source)source.close();
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LAST_SEQ_KEY);
  location.reload();
});

$('collapseSidebar').addEventListener('click',toggleSidebar);
$('mobileToggle').addEventListener('click',toggleMobilePreview);

$('fullscreen').addEventListener('click',()=>{
  if(!document.fullscreenElement){enterFullscreen();}else{exitFullscreen();}
});

// Composer: Enter = send, Shift+Enter = newline, Ctrl/Cmd+Enter = send
$('prompt').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    if(e.shiftKey){
      // Shift+Enter: insert newline (let default happen)
      return;
    }
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();
      send();
      return;
    }
    // Plain Enter: send
    e.preventDefault();
    send();
  }
});

window.addEventListener('load',async()=>{
  system('Descreva uma ideia e o PP cria a sessão, constrói o MVP e abre o preview ao lado.');
  const last=localStorage.getItem(STORAGE_KEY);
  if(last){
    try{await loadSession(last)}catch{localStorage.removeItem(STORAGE_KEY)}
  }
  hideOverlay();
  const sbCollapsed = localStorage.getItem(SIDEBAR_KEY);
  if(sbCollapsed==='1'){$('sidebar').classList.add('collapsed');}
  const mobileActive = localStorage.getItem(MOBILE_KEY)||'conversation';
  if(window.innerWidth<=900){
    if(mobileActive==='preview'){
      $('preview').style.display='flex';
      $('conversation').style.gridColumn='auto';
    }else{
      $('preview').style.display='none';
      $('conversation').style.gridColumn='1 / -1';
    }
  }
  initSplitter();
});
</script>
<div class="processing-overlay" id="overlay"><div class="spinner"></div><div class="overlay-title" id="overlayTitle"></div><div class="overlay-desc" id="overlayDesc"></div><div class="overlay-tips" id="overlayTips"></div></div>
</body>
</html>`;
}
