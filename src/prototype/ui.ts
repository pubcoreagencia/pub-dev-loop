export function prototypeUiHtml(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>PUB Prototype</title>
<style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#09090b;color:#fafafa}
*{box-sizing:border-box}body{margin:0;height:100vh;overflow:hidden;background:#09090b}
.app{display:grid;grid-template-columns:minmax(320px,420px) 1fr;height:100vh}
.sidebar{display:flex;flex-direction:column;border-right:1px solid #27272a;background:#111113;min-width:0}
.header{height:60px;display:flex;align-items:center;padding:0 18px;border-bottom:1px solid #27272a;font-weight:700;letter-spacing:.2px}
.brand{display:flex;align-items:center;gap:10px}.dot{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 14px rgba(255,255,255,.6)}
.meta{padding:14px 16px;border-bottom:1px solid #27272a}.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.field{display:flex;flex-direction:column;gap:6px}
label{font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em}input,textarea{width:100%;border:1px solid #3f3f46;background:#18181b;color:#fff;border-radius:10px;padding:10px 11px;outline:none}input:focus,textarea:focus{border-color:#71717a}
.chat{flex:1;overflow:auto;padding:18px}.message{margin-bottom:16px}.role{font-size:11px;color:#a1a1aa;margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em}.bubble{border:1px solid #27272a;background:#18181b;border-radius:12px;padding:12px;line-height:1.5;white-space:pre-wrap}
.agent .bubble{background:#0f0f10}.system{font-size:12px;color:#a1a1aa;padding:6px 0}
.composer{padding:14px;border-top:1px solid #27272a}.compose-wrap{position:relative}.prompt{min-height:92px;resize:none;padding-right:78px}.send{position:absolute;right:8px;bottom:8px;border:0;border-radius:9px;background:#fafafa;color:#111;padding:9px 14px;font-weight:700;cursor:pointer}.send:disabled{opacity:.45;cursor:not-allowed}
.preview{min-width:0;display:flex;flex-direction:column;background:#0a0a0b}.preview-header{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #27272a}.status{font-size:12px;color:#a1a1aa}.preview-frame{flex:1;padding:14px}.frame{height:100%;border:1px solid #27272a;border-radius:14px;overflow:hidden;background:#fff;position:relative}.empty{position:absolute;inset:0;display:grid;place-items:center;color:#71717a;background:radial-gradient(circle at center,#18181b 0,#0b0b0c 48%,#09090b 100%)}iframe{width:100%;height:100%;border:0;background:#fff;display:none}
@media(max-width:900px){.app{grid-template-columns:1fr}.preview{display:none}.sidebar{border-right:0}}
</style>
</head>
<body>
<div class="app">
  <section class="sidebar">
    <div class="header"><div class="brand"><span class="dot"></span>PUB Prototype</div></div>
    <div class="meta">
      <div class="row">
        <div class="field"><label>Projeto</label><input id="project" placeholder="barber-pro" /></div>
        <div class="field"><label>Repositório</label><input id="repository" placeholder="https://github.com/org/repo.git" /></div>
      </div>
      <div style="margin-top:8px" class="field"><label>Sessão</label><input id="session" placeholder="Será criada ao iniciar" readonly /></div>
    </div>
    <div class="chat" id="chat"><div class="system">Crie uma sessão e comece com uma ideia. Cada prompt será enviado ao Prototype Mode.</div></div>
    <div class="composer">
      <div class="compose-wrap">
        <textarea id="prompt" class="prompt" placeholder="Monte um sistema para gerenciamento de uma barbearia..."></textarea>
        <button id="send" class="send">Enviar</button>
      </div>
    </div>
  </section>
  <section class="preview">
    <div class="preview-header"><strong>Live Preview</strong><span class="status" id="status">Aguardando sessão</span></div>
    <div class="preview-frame"><div class="frame"><div id="empty" class="empty">O preview aparecerá aqui quando a sessão tiver uma URL ativa.</div><iframe id="iframe" title="PUB Prototype live preview"></iframe></div></div>
  </section>
</div>
<script>
let sessionId = null;
let source = null;
const $ = id => document.getElementById(id);
const chat = $('chat');
const statusEl = $('status');
function add(role, text){
  const wrap=document.createElement('div'); wrap.className='message ' + (role==='PP'?'agent':'');
  const roleEl=document.createElement('div'); roleEl.className='role'; roleEl.textContent=role;
  const bubble=document.createElement('div'); bubble.className='bubble'; bubble.textContent=text;
  wrap.append(roleEl,bubble); chat.appendChild(wrap); chat.scrollTop=chat.scrollHeight;
}
function setStatus(text){statusEl.textContent=text}
function attachEvents(id){
  if(source) source.close();
  source=new EventSource('/prototype/sessions/'+encodeURIComponent(id)+'/events');
  source.onmessage=e=>{
    const event=JSON.parse(e.data); setStatus(event.type.replaceAll('_',' '));
    if(['ERROR','BUILD_FAILED','PREVIEW_FAILED'].includes(event.type)) add('PP', event.payload?.message || event.type);
    if(event.type==='PREVIEW_READY' && event.payload?.url){
      $('iframe').src=event.payload.url; $('iframe').style.display='block'; $('empty').style.display='none';
    }
  };
  source.onerror=()=>setStatus('stream reconectando...');
}
async function createSession(){
  const project=$('project').value.trim(), repository=$('repository').value.trim();
  if(!project||!repository) throw new Error('Informe projeto e repositório para iniciar a sessão');
  const r=await fetch('/prototype/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({project,repository})});
  if(!r.ok) throw new Error(await r.text());
  const s=await r.json(); sessionId=s.id; $('session').value=sessionId; setStatus('sessão criada'); attachEvents(sessionId); add('PP','Sessão criada. Pronto para prototipar.'); return s;
}
async function send(){
  const text=$('prompt').value.trim(); if(!text) return;
  $('send').disabled=true; add('Você',text); $('prompt').value='';
  try{
    if(!sessionId) await createSession();
    const r=await fetch('/prototype/sessions/'+encodeURIComponent(sessionId)+'/prompts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({objective:'Prototype MVP iteration',prompt:text})});
    if(!r.ok) throw new Error(await r.text());
    const data=await r.json(); setStatus('tarefa enfileirada'); add('PP','Tarefa '+data.task.id+' enviada ao PDL. Aguardando execução...');
  }catch(e){ add('PP','Erro: '+(e?.message||String(e))); setStatus('erro'); }
  finally{$('send').disabled=false}
}
$('send').addEventListener('click',send); $('prompt').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')send()});
</script>
</body>
</html>`;
}
