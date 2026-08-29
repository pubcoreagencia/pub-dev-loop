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
.sidebar.collapsed .brand,.sidebar.collapsed .project-label,.sidebar.collapsed .session,.sidebar.collapsed .versions,.sidebar.collapsed .projects-section {display:none}
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
/* Projects list */
.projects-section{margin:12px;border-top:1px solid #27272a;padding-top:12px}
.projects-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.projects-title button{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:4px 8px;cursor:pointer;font-size:10px}
.projects-title button:hover{background:#27272a}
.project-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;cursor:pointer;border:1px solid transparent;margin-bottom:4px;transition:background .15s,border-color .15s}
.project-item:hover{background:#18181b;border-color:#27272a}
.project-item.active{background:#18181b;border-color:#3b82f6}
.project-item .project-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.project-item .project-status.ready{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.5)}
.project-item .project-status.building{background:#3b82f6;box-shadow:0 0 6px rgba(59,130,246,.5);animation:pulse 1.5s infinite}
.project-item .project-status.failed{background:#ef4444;box-shadow:0 0 6px rgba(239,68,68,.5)}
.project-item .project-status.creating{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.5)}
.project-item .project-info{flex:1;min-width:0}
.project-item .project-name{font-size:12px;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.project-item .project-meta{font-size:10px;color:#71717a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
/* Modal */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:3000;align-items:center;justify-content:center}
.modal-overlay.show{display:flex}
.modal-content{background:#18181b;border:1px solid #27272a;border-radius:14px;padding:24px;width:400px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.modal-title{font-size:16px;font-weight:600;color:#e4e4e7;margin-bottom:16px}
.modal-label{font-size:12px;color:#a1a1aa;margin-bottom:6px}
.modal-input{width:100%;border:1px solid #3f3f46;background:#111113;color:#fff;border-radius:8px;padding:10px 12px;outline:none;font-family:inherit;font-size:13px;margin-bottom:16px}
.modal-input:focus{border-color:#3b82f6}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}
.modal-actions button{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:8px 16px;cursor:pointer;font-size:12px}
.modal-actions button.primary{background:#3b82f6;border-color:#3b82f6;color:#fff}
.modal-actions button:hover{opacity:.9}
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
.checkpoint .checkpoint-file{font-size:10px;color:#a1a1aa;background:#18181b;border:1px solid #27272a;border-radius:4px;padding:1px 6px}
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
/* Processing overlay — non-blocking progress panel */
.processing-overlay{display:none;position:fixed;bottom:24px;right:24px;flex-direction:column;gap:12px;background:#18181b;border:1px solid #27272a;border-radius:14px;padding:16px 20px;max-width:340px;z-index:2000;box-shadow:0 20px 60px rgba(0,0,0,.5);transition:transform .2s ease,opacity .2s ease}
.processing-overlay.show{transform:translateY(0);opacity:1}
.processing-overlay.hide{transform:translateY(20px);opacity:0}
.processing-spinner{width:14px;height:14px;border:3px solid rgba(255,255,255,.1);border-left-color:#fff;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.processing-steps{margin-top:8px}
.processing-step{display:flex;align-items:center;gap:6px;font-size:11px;color:#a1a1aa}
.processing-step .dot{width:5px;height:5px;border-radius:50%;background:#52525b;flex-shrink:0}
.processing-step.done .dot{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,.5)}
.processing-step.done{color:#a1a1aa}
.processing-step.active .dot{background:#3b82f6;box-shadow:0 0 8px rgba(59,130,246,.6);color:#fafafa;font-weight:600}
.processing-files{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px}
.processing-file{font-size:10px;color:#a1a1aa;background:#111113;border:1px solid #27272a;border-radius:3px;padding:1px 5px}
.processing-footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
.timer{font-size:11px;color:#71717a}
.processing-cancel{border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:4px 10px;cursor:pointer;font-size:11px}
.processing-cancel:hover{background:#27272a}
.processing-cancel:disabled{opacity:.4;cursor:not-allowed}
</style>
</head>
<body>
<div class="app">
  <section class="sidebar" id="sidebar" role="navigation" aria-label="Sidebar navigation">
    <div class="header">
      <div class="brand"><span class="dot"></span>PUB Prototype</div>
      <button id="collapseSidebar" title="Recolher" aria-label="Collapse sidebar">☰</button>
    </div>
    <div class="projects-section">
      <div class="projects-title"><span>PROJETOS</span><button id="newProject" aria-label="New project">+ Novo</button></div>
      <div id="projectsList"></div>
    </div>
    <div class="project-label" id="projectLabel" aria-label="Current project">Projeto: <span id="projectName"></span></div>
    <div class="session" id="sessionBox" aria-label="Current session"></div>
    <div class="versions" id="versions" aria-label="Version history">
      <div class="versions-title"><span>Version History</span><span> (Histórico de versões)</span><span id="versionCount"></span></div>
      <div id="versionList"></div>
    </div>
  </section>

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

  <div class="splitter" id="splitter"></div>

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

<!-- Modal for new project -->
<div class="modal-overlay" id="newProjectModal">
  <div class="modal-content">
    <div class="modal-title">Novo projeto</div>
    <div class="modal-label">Nome do projeto</div>
    <input type="text" class="modal-input" id="newProjectName" placeholder="Ex: Sistema para Padaria" maxlength="60">
    <div class="modal-actions">
      <button id="cancelNewProject">Cancelar</button>
      <button id="confirmNewProject" class="primary">Criar projeto</button>
    </div>
  </div>
</div>

<script>
let sessionId=null,source=null,currentUrl=null,activeTimeline=null,checkpoints=[],loadSessionAt=0;
let currentTaskId=null,activeTaskStatus=null,taskStartAt=null,timerInterval=null;
let projectsCache=[];
const STORAGE_KEY='pub-prototype:last-session';
const LAST_SEQ_KEY='pub-prototype:last-seq';
const SPLIT_KEY='pub-prototype:split';
const SIDEBAR_KEY='pub-prototype:sidebar-collapsed';
const MOBILE_KEY='pub-prototype:mobile-active';
function $(id){return document.getElementById(id)}
let sendBtn=document.getElementById('send'),chat=document.getElementById('chat'),progress=document.getElementById('progress');
let cancelBtn,timerEl,stepsEl,filesEl;

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

function formatElapsed(ms){
  const s=Math.floor(ms/1000);
  if(s<60) return s+'s';
  const m=Math.floor(s/60);
  const rem=s%60;
  return m+'m ' + rem + 's';
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

// --- Progress Panel (non-blocking) ---
const STEP_ORDER=['USER_PROMPT','AGENT_STARTED','AGENT_OUTPUT','BUILD_STARTED','BUILD_PASSED','PREVIEW_STARTED','PREVIEW_READY'];
let stepStates={};

function renderProgressSteps(){
  if(!stepsEl)return;
  stepsEl.innerHTML='';
  STEP_ORDER.forEach(s=>{
    const div=document.createElement('div');
    div.className='processing-step '+(stepStates[s]||'');
    div.innerHTML='<span class="dot"></span><span class="step-label">'+s.replace('_',' ')+'</span>';
    stepsEl.appendChild(div);
  });
}

function setStepStatus(step,status){
  stepStates[step]=status; // 'done' | 'active'
  renderProgressSteps();
}

function startTimer(){
  if(timerInterval)return;
  taskStartAt=Date.now();
  timerInterval=setInterval(()=>{
    if(timerEl){timerEl.textContent=formatElapsed(Date.now()-taskStartAt);}
  },500);
}

function stopTimer(){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  taskStartAt=null;
}

function showProcessing(title,desc){
  const overlay=$('overlay');
  overlay.classList.remove('hide');
  overlay.classList.add('show');
  overlay.style.display='block';
  $('overlayTitle').textContent=title;
  $('overlayDesc').textContent=desc;
  sendBtn.disabled=true;
  $('prompt').disabled=true;
  cancelBtn.disabled=false;
  startTimer();
}

function hideProcessing(){
  const overlay=$('overlay');
  overlay.classList.add('hide');
  setTimeout(()=>{overlay.style.display='none';},200);
  sendBtn.disabled=false;
  $('prompt').disabled=false;
  cancelBtn.disabled=true;
  sendBtn.textContent='Enviar';
  sendBtn.classList.remove('hint');
  stopTimer();
  // Reset step states
  stepStates={};
}

function setProcessingFiles(files){
  if(!filesEl)return;
  filesEl.innerHTML='';
  if(!files||!files.length)return;
  files.forEach(f=>{
    const span=document.createElement('span');
    span.className='processing-file';
    span.textContent=f;
    filesEl.appendChild(span);
  });
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
  const files = cp.changedFiles || [];
  if(renderPrompt && cp.prompt){
    add('Você',cp.prompt);
  }
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
  if (url === currentUrl) return;
  currentUrl=url;
  $('iframe').src=url;
  $('iframe').style.display='block';
  $('empty').style.display='none';
  $('refresh').disabled=false;
  $('open').disabled=false;
  $('previewUrl').style.display='block';
  $('previewUrl').innerHTML = '<a href="' + url + '" target="_blank" rel="noreferrer">' + url + '</a>';
}

async function verifyAndRefreshPreview(sessionId, url){
  try {
    const resp = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    if (resp.ok || resp.status === 0) return; // status 0 = no-cors opaque response (likely ok)
  } catch {}

  // Preview is dead, try to refresh
  system('Reconectando preview...');
  try {
    const r = await fetch('/prototype/sessions/' + encodeURIComponent(sessionId) + '/preview/refresh', { method: 'POST' });
    if (!r.ok) throw new Error('Refresh failed');
    const data = await r.json();
    if (data.session?.previewUrl) {
      renderPreview(data.session.previewUrl);
      system('Preview pronto');
    }
  } catch {
    system('Não foi possível recuperar o preview');
  }
}

function attachEvents(id){
  if(source)source.close();
  source=new EventSource('/prototype/sessions/'+encodeURIComponent(id)+'/events');

  source.addEventListener('USER_PROMPT',e=>{
    const p=JSON.parse(e.data).payload;
    setStepStatus('USER_PROMPT','done');
    if(p?.prompt&&!p.prompt.startsWith('Restaurar v'))add('Você',p.prompt,p.timestamp);
  });

  source.addEventListener('AGENT_STARTED',e=>{
    setStepStatus('AGENT_STARTED','done');
    setStepStatus('AGENT_OUTPUT','active');
    setStatus('Construindo');
    showProcessing('Construindo seu aplicativo','Agente iniciado. Implementando alterações...');
  });

  source.addEventListener('AGENT_OUTPUT',e=>{
    const p=JSON.parse(e.data).payload;
    setStepStatus('AGENT_OUTPUT','done');
    setStepStatus('BUILD_STARTED','active');
    setStatus('Validando');
    showProcessing('Validando build','Executando testes e checagem de tipos.');
    const files = p?.changedFiles || [];
    setProcessingFiles(files);
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
    if(!stepStates['AGENT_OUTPUT'])setStepStatus('AGENT_OUTPUT','done');
    if(!stepStates['BUILD_STARTED'])setStepStatus('BUILD_STARTED','active');
    setStatus('Validando');
    showProcessing('Validando build','Executando testes e checagem de tipos.');
  });

  source.addEventListener('BUILD_PASSED',e=>{
    setStepStatus('BUILD_STARTED','done');
    setStepStatus('BUILD_PASSED','done');
    setStepStatus('PREVIEW_STARTED','active');
    setStatus('Build aprovado');
    showProcessing('Preparando preview','Build aprovado. Subindo ao ar.');
  });

  source.addEventListener('PREVIEW_STARTED',e=>{
    setStepStatus('PREVIEW_STARTED','done');
    setStepStatus('PREVIEW_READY','active');
    setStatus('Subindo preview');
    showProcessing('Preparando preview','Publicando sua aplicação online.');
  });

  source.addEventListener('CHECKPOINT_CREATED',e=>{
    const p=JSON.parse(e.data).payload;
    checkpoint(p,false);
  });

  source.addEventListener('PREVIEW_READY',e=>{
    const ev=JSON.parse(e.data);
    // Only apply if the event is for the current session.
    const eventSessionId = ev.payload?.sessionId;
    if (eventSessionId && eventSessionId !== sessionId) return;
    const newUrl = ev.payload?.url || ev.payload?.previewUrl;
    if (!newUrl || newUrl === currentUrl) return;
    // Ignore events that arrive within 2 seconds of loadSession - these are
    // SSE replay events from the database (stale events from previous tasks/sessions).
    // The loadSession already set the correct iframe URL.
    if (loadSessionAt && (Date.now() - loadSessionAt) < 2000) return;
    renderPreview(newUrl);
    setStepStatus('PREVIEW_READY','done');
    setStatus('Pronto');
    hideProcessing();
    localStorage.setItem(STORAGE_KEY,sessionId);
  });

  source.addEventListener('ERROR',e=>{
    const p=JSON.parse(e.data).payload;
    setStepStatus('AGENT_STARTED','done');
    setStepStatus('AGENT_OUTPUT','done');
    setStatus('Erro');
    hideProcessing();

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
    setStepStatus('BUILD_STARTED','done');
    setStatus('Falha no build');
    hideProcessing();

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

  source.onerror=()=>{setStatus('Reconectando...') };
}

async function loadSession(id){
  const r=await fetch('/prototype/sessions/'+encodeURIComponent(id));
  if(!r.ok)throw new Error('Sessão não encontrada');
  const data=await r.json();
  // Mark the time of this loadSession so we can ignore PREVIEW_READY events
  // that arrive from SSE replay (stale events from previous sessions/tasks).
  loadSessionAt = Date.now();
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
  if(data.session.previewUrl){
    const url = data.session.previewUrl;
    // Reset currentUrl to force iframe update with the new session's previewUrl
    currentUrl=null;
    renderPreview(url);
    // Verify preview is reachable, refresh if dead
    verifyAndRefreshPreview(id, url);
  }

  // Check for active task to reconstruct processing state
  const tasks=(data.tasks||[]);
  const activeTask=tasks.find(t=>['QUEUED','ASSIGNED','RUNNING','TESTING'].includes(t.status));
  if(activeTask){
    currentTaskId=activeTask.id;
    activeTaskStatus=activeTask.status;
    taskStartAt=new Date(activeTask.createdAt).getTime();
    // Reconstruct timeline based on task status
    if(activeTask.status==='QUEUED'){
      setStepStatus('USER_PROMPT','done');
      setStepStatus('AGENT_STARTED','active');
      setStatus('Na fila');
      showProcessing('Processo na fila','Sua tarefa está aguardando uma unidade de processamento.');
    }else if(activeTask.status==='RUNNING'){
      setStepStatus('USER_PROMPT','done');
      setStepStatus('AGENT_STARTED','done');
      setStepStatus('AGENT_OUTPUT','active');
      setStatus('Implementando');
      showProcessing('Construindo seu aplicativo','Agente está implementando alterações.');
    }
  }else if(['BUILDING','PREVIEWING','CREATING'].includes(data.session.status)){
    // Fallback: session status indicates active processing but no task found
    setStepStatus('USER_PROMPT','done');
    setStepStatus('AGENT_STARTED','active');
    setStatus(data.session.status==='BUILDING'?'Construindo':data.session.status.replaceAll('_',' '));
    showProcessing('Construindo seu aplicativo...','Seu projeto continua sendo processado no servidor.');
  }

  // Set session status
  if(!activeTask){
    setStatus(data.session.status==='READY'?'Pronto':(data.session.status||'Criando').replaceAll('_',' '));
    hideProcessing();
  }

  attachEvents(id);
  localStorage.setItem(STORAGE_KEY,id);
  // Update projects list to highlight active project
  renderProjects();
}

async function createSession(projectName){
  const r=await fetch('/prototype/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project:projectName})});
  if(!r.ok)throw new Error(await r.text());
  const s=await r.json();
  sessionId=s.id;
  checkpoints=[];
  renderVersions();
  localStorage.setItem(STORAGE_KEY,s.id);
  localStorage.removeItem(LAST_SEQ_KEY);
  $('sessionBox').style.display='block';
  $('sessionBox').textContent='Sessão '+s.id;
  $('projectName').textContent=projectName;
  attachEvents(sessionId);
  add('PP','Sessão criada. Descreva sua ideia e o PP constrói o MVP.');
  return s;
}

function clearChat(){chat.replaceChildren();activeTimeline=null;}

async function send(){
  const text=$('prompt').value.trim();
  if(!text||sendBtn.disabled)return;

  showProcessing('Enviando...','Sua solicitação está sendo processada.');
  setStepStatus('USER_PROMPT','active');
  add('Você',text);
  $('prompt').value='';
  $('prompt').style.height='auto';
  $('prompt').focus();
  activeTimeline=null;
  progress.style.width='4%';

  try{
    if(!sessionId)await createSession($('projectName').textContent.trim()||'untitled-prototype');
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

    const result=await r.json();

    // Store task ID for cancellation
    if(result?.task?.id){
      currentTaskId=result.task.id;
    }

    // Update send button to show "Enviado"
    sendBtn.textContent='Enviado';
    sendBtn.classList.add('hint');
    sendBtn.disabled=false; // Still allow seeing the button text

    setStepStatus('USER_PROMPT','done');
    setStatus('Tarefa enfileirada');
  }catch(e){
    add('PP','Erro: '+(e?.message||String(e)));
    setStatus('Erro');
    hideProcessing();
    progress.style.width='100%';
    sendBtn.textContent='Enviar';
    sendBtn.classList.remove('hint');
  }
}

async function cancelTask(){
  if(!currentTaskId)return;
  cancelBtn.disabled=true;
  try{
    const r=await fetch('/prototype/tasks/'+encodeURIComponent(currentTaskId)+'?action=cancel',{method:'POST'});
    if(r.ok){
      add('PP','Tarefa cancelada pelo usuário.');
      setStatus('Cancelado');
      hideProcessing();
      step('CANCELLED');
    }else{
      const err=await r.text();
      add('PP','Erro ao cancelar: '+err);
    }
  }catch(e){
    add('PP','Erro ao cancelar: '+(e?.message||String(e)));
  }finally{
    cancelBtn.disabled=false;
  }
}

function restore(cp){
  if(!sessionId||sendBtn.disabled)return;
  if(!window.confirm('Restaurar a v'+cp.promptIndex+'? Isso cria uma nova versão a partir desse snapshot e preserva o histórico.'))return;
  showProcessing('Restaurando...','Carregando checkpoint v'+(cp.promptIndex||cp.id?.slice(0,8)));
  add('Você','Restaurar v'+cp.promptIndex);
  activeTimeline=null;
  progress.style.width='8%';
  fetch('/prototype/sessions/'+encodeURIComponent(sessionId)+'/restore/'+encodeURIComponent(cp.id),{method:'POST'})
    .then(r=>{
      if(!r.ok)throw new Error(r.statusText);
      setStatus('Restaurando');
    })
    .catch(e=>{
      add('PP','Erro ao restaurar: '+(e?.message||String(e)));
      setStatus('Erro');
      hideProcessing();
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
    showToast('Fullscreen API não suportada neste navegador.');
  }
}

function showToast(message, duration=3000){
  const toast=document.createElement('div');
  toast.className='processing-overlay show';
  toast.style.cssText='position:fixed;top:24px;left:50%;transform:translateX(-50%);right:auto;bottom:auto;max-width:400px;text-align:center;display:flex;flex-direction:column;gap:4px;padding:12px 16px;z-index:3000';
  toast.innerHTML='<div class="processing-title" style="font-size:12px">'+message+'</div>';
  document.body.appendChild(toast);
  setTimeout(()=>{toast.remove();},duration);
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

// --- Projects list ---
async function loadProjects(){
  try{
    const r=await fetch('/prototype/sessions');
    if(!r.ok)throw new Error('Failed to load sessions');
    const data=await r.json();
    const sessions=Array.isArray(data)?data:[];
    // Group by project, keep most recent session per project
    const projectMap=new Map();
    sessions.forEach(s=>{
      const existing=projectMap.get(s.project);
      if(!existing||new Date(s.updatedAt)>new Date(existing.updatedAt)){
        projectMap.set(s.project,s);
      }
    });
    projectsCache=Array.from(projectMap.values()).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    renderProjects();
  }catch(e){
    console.error('Failed to load projects:',e);
    projectsCache=[];
    renderProjects();
  }
}

function getStatusLabel(status){
  if(!status) return '';
  const map={
    'READY':'Pronto',
    'BUILDING':'Construindo',
    'PREVIEWING':'Preparando preview',
    'CREATING':'Criando',
    'FAILED':'Falhou',
    'CANCELLED':'Cancelado',
    'ARCHIVED':'Arquivado'
  };
  return map[status]||status;
}

function getStatusClass(status){
  if(status==='READY')return 'ready';
  if(status==='BUILDING'||status==='PREVIEWING'||status==='CREATING')return 'building';
  if(status==='FAILED')return 'failed';
  return 'creating';
}

function renderProjects(){
  const list=$('projectsList');
  if(!list)return;
  list.innerHTML='';
  if(!projectsCache.length){
    list.innerHTML='<div style="font-size:11px;color:#71717a;padding:8px 10px">Nenhum projeto ainda. Clique em + Novo para começar.</div>';
    return;
  }
  projectsCache.forEach(p=>{
    const el=document.createElement('div');
    el.className='project-item'+(p.id===sessionId?' active':'');
    el.innerHTML='<span class="project-status '+getStatusClass(p.status)+'"></span>'+
      '<div class="project-info">'+
        '<div class="project-name">'+escapeHtml(p.project||'Sem nome')+'</div>'+
        '<div class="project-meta">'+getStatusLabel(p.status)+' · '+formatTime(p.updatedAt)+'</div>'+
      '</div>';
    el.onclick=()=>selectProject(p.id);
    list.appendChild(el);
  });
}

function escapeHtml(str){
  const div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

async function selectProject(id){
  if(id===sessionId)return;
  try{
    await loadSession(id);
  }catch(e){
    add('PP','Erro ao carregar projeto: '+(e?.message||String(e)));
  }
}

function showNewProjectModal(){
  const modal=$('newProjectModal');
  const input=$('newProjectName');
  modal.classList.add('show');
  input.value='';
  setTimeout(()=>input.focus(),100);
}

function hideNewProjectModal(){
  $('newProjectModal').classList.remove('show');
}

async function confirmNewProject(){
  const input=$('newProjectName');
  const name=input.value.trim();
  if(!name)return;
  hideNewProjectModal();
  try{
    const s=await createSession(name);
    await loadProjects();
    await loadSession(s.id);
  }catch(e){
    add('PP','Erro ao criar projeto: '+(e?.message||String(e)));
  }
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

// New project button - show modal
$('newProject').addEventListener('click',showNewProjectModal);
$('cancelNewProject').addEventListener('click',hideNewProjectModal);
$('confirmNewProject').addEventListener('click',confirmNewProject);
$('newProjectName').addEventListener('keydown',e=>{
  if(e.key==='Enter')confirmNewProject();
  if(e.key==='Escape')hideNewProjectModal();
});
$('newProjectModal').addEventListener('click',e=>{
  if(e.target===$('newProjectModal'))hideNewProjectModal();
});

$('collapseSidebar').addEventListener('click',toggleSidebar);
$('mobileToggle').addEventListener('click',toggleMobilePreview);

$('fullscreen').addEventListener('click',()=>{
  if(!document.fullscreenElement){enterFullscreen();}else{exitFullscreen();}
});

// Composer: Enter = send, Shift+Enter = newline, Ctrl/Cmd+Enter = send
$('prompt').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    if(e.shiftKey){return;}
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();
      send();
      return;
    }
    e.preventDefault();
    send();
  }
});

window.addEventListener('load',async()=>{
  // Lazy-init elements that appear after the script tag in the DOM
  cancelBtn=document.getElementById('cancelBtn');
  timerEl=document.getElementById('timer');
  stepsEl=document.getElementById('processingSteps');
  filesEl=document.getElementById('processingFiles');
  // Attach cancel button event listener after DOM is ready
  cancelBtn.addEventListener('click',cancelTask);

  system('Descreva uma ideia e o PP cria a sessão, constrói o MVP e abre o preview ao lado.');

  // Synchronous UI setup (must run before async operations for test compatibility)
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
  // Ensure composer is enabled on fresh load
  hideProcessing();

  // Async: load projects list
  await loadProjects();

  // Determine which session to open
  const last=localStorage.getItem(STORAGE_KEY);
  let targetId=last;

  // If no last session in localStorage, use most recent project
  // If last session is set but not in cache (cache may be stale or still loading),
  // still try to load it directly - the session might exist in the DB
  // even if the projects list endpoint doesn't include it yet.
  if(!targetId){
    targetId=projectsCache.length>0?projectsCache[0].id:null;
  }

  if(targetId){
    try{await loadSession(targetId)}catch(e){
      console.error('Failed to load session:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }
});
</script>
<div class="processing-overlay" id="overlay"><div class="processing-header"><div class="processing-spinner"></div><div class="processing-title" id="overlayTitle"></div></div><div class="processing-desc" id="overlayDesc"></div><div class="processing-steps" id="processingSteps"></div><div class="processing-files" id="processingFiles"></div><div class="processing-footer"><span class="timer" id="timer">0s</span><button class="processing-cancel" id="cancelBtn" disabled>Cancelar</button></div></div>
</body>
</html>`;
}
