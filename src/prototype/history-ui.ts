export function prototypeHistoryUiScript(): string {
  return `<script>
(() => {
  const root = document.querySelector('.meta');
  if (!root) return;
  let state = { sessionId: localStorage.getItem('pub-prototype:last-session'), checkpoints: [] };
  const panel = document.createElement('div');
  panel.id = 'pp-history';
  panel.innerHTML = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #27272a"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa"><span>Version History</span><span id="pp-version-count"></span></div><div id="pp-version-list"></div><pre id="pp-diff" style="display:none;max-height:260px;overflow:auto;margin-top:8px;padding:10px;border:1px solid #27272a;border-radius:9px;background:#09090b;color:#d4d4d8;font-size:10px;white-space:pre-wrap"></pre></div>';
  root.appendChild(panel);
  const list = panel.querySelector('#pp-version-list');
  const count = panel.querySelector('#pp-version-count');
  const diff = panel.querySelector('#pp-diff');
  const render = () => {
    count.textContent = state.checkpoints.length;
    if (!state.checkpoints.length) { list.innerHTML = '<span style="font-size:11px;color:#71717a">Nenhum checkpoint ainda.</span>'; return; }
    list.innerHTML = state.checkpoints.slice().sort((a,b) => b.promptIndex-a.promptIndex).map(cp =>
      '<div style="display:flex;align-items:center;gap:7px;padding:8px 9px;margin-bottom:6px;border:1px solid #27272a;background:#151517;border-radius:9px"><div style="min-width:0;flex:1"><div style="font-size:12px;color:#e4e4e7">v'+cp.promptIndex+' · '+String(cp.prompt).slice(0,42).replace(/[&<>\\"] /g,'')+'</div><div style="font-size:10px;color:#71717a;margin-top:2px">'+(cp.commitSha?cp.commitSha.slice(0,8):'sem commit')+'</div></div><button data-diff="'+cp.id+'" style="border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:5px 7px;font-size:10px;cursor:pointer">Diff</button><button data-restore="'+cp.id+'" style="border:1px solid #3f3f46;background:#18181b;color:#d4d4d8;border-radius:7px;padding:5px 7px;font-size:10px;cursor:pointer" '+(cp.commitSha?'':'disabled')+'>Restaurar</button></div>'
    ).join('');
  };
  const sync = async () => {
    if (!state.sessionId) return;
    const r = await fetch('/prototype/sessions/'+encodeURIComponent(state.sessionId));
    if (!r.ok) return;
    const data = await r.json(); state.checkpoints = data.checkpoints || []; render();
  };
  const showDiff = async id => {
    const sorted = state.checkpoints.slice().sort((a,b)=>a.promptIndex-b.promptIndex);
    const idx = sorted.findIndex(x=>x.id===id);
    if (idx < 1) { diff.style.display='block'; diff.textContent='A primeira versão não possui uma versão anterior para comparação.'; return; }
    const from=sorted[idx-1], to=sorted[idx];
    const r=await fetch('/prototype/sessions/'+encodeURIComponent(state.sessionId)+'/diff?from='+encodeURIComponent(from.id)+'&to='+encodeURIComponent(to.id));
    const data=await r.json(); diff.style.display='block'; diff.textContent=data.diff||'(sem diferenças)';
  };
  const restore = async id => {
    const cp=state.checkpoints.find(x=>x.id===id); if(!cp) return;
    if(!confirm('Restaurar a v'+cp.promptIndex+'? O histórico será preservado e uma nova versão será criada.')) return;
    const r=await fetch('/prototype/sessions/'+encodeURIComponent(state.sessionId)+'/restore/'+encodeURIComponent(id),{method:'POST'});
    if(!r.ok){alert('Falha ao restaurar a versão.');return;} await sync();
  };
  list.addEventListener('click',e=>{const d=e.target.closest('[data-diff]');if(d)showDiff(d.dataset.diff);const r=e.target.closest('[data-restore]');if(r)restore(r.dataset.restore);});
  window.addEventListener('pp:session',e=>{state.sessionId=e.detail?.id||state.sessionId;sync();});
  if (state.sessionId) sync();
  window.addEventListener('storage', e => { if (e.key==='pub-prototype:last-session') { state.sessionId=e.newValue; sync(); } });
})();
</script>`;
}
