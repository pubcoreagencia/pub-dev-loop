export function prototypeUiHtml(): string {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>PUB Prototype — AI App Builder</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{color-scheme:dark;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#fafafa;--bg-base:#0a0a0b;--bg-elevated:#111114;--bg-elevated-2:#18181b;--bg-elevated-3:#1f1f23;--border:#27272a;--border-strong:#3f3f46;--text-primary:#fafafa;--text-secondary:#a1a1aa;--text-tertiary:#71717a;--text-quaternary:#52525b;--accent:#fafafa;--accent-fg:#0a0a0b;--success:#22c55e;--success-bg:rgba(34,197,94,.1);--success-border:rgba(34,197,94,.3);--warning:#f59e0b;--warning-bg:rgba(245,158,11,.1);--warning-border:rgba(245,158,11,.3);--danger:#ef4444;--danger-bg:rgba(239,68,68,.1);--danger-border:rgba(239,68,68,.3);--info:#3b82f6;--info-bg:rgba(59,130,246,.1);--info-border:rgba(59,130,246,.3);--radius-sm:6px;--radius:8px;--radius-md:10px;--radius-lg:14px;--radius-xl:20px;--shadow-sm:0 1px 2px rgba(0,0,0,.4);--shadow:0 4px 12px rgba(0,0,0,.3);--shadow-lg:0 12px 32px rgba(0,0,0,.4);--transition:150ms cubic-bezier(.4,0,.2,1)}
*{box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
html,body{margin:0;height:100vh;overflow:hidden;background:var(--bg-base)}
body{font-size:14px;line-height:1.5}
button{font-family:inherit;font-size:inherit;cursor:pointer;border:0;background:none;color:inherit;padding:0}
input,textarea{font-family:inherit;font-size:inherit;color:inherit}
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--border-strong)}
.app{display:grid;grid-template-columns:280px 1fr 1.2fr;height:100vh;overflow:hidden;background:var(--bg-base)}
.sidebar{display:flex;flex-direction:column;border-right:1px solid var(--border);background:var(--bg-elevated);overflow:hidden}
.sidebar-header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--border);flex-shrink:0}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px;letter-spacing:-.01em}
.brand-mark{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#fafafa 0%,#d4d4d8 100%);display:grid;place-items:center;color:#0a0a0b;font-size:12px;font-weight:800;box-shadow:var(--shadow-sm)}
.icon-btn{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--radius);color:var(--text-secondary);transition:var(--transition)}
.icon-btn:hover{background:var(--bg-elevated-2);color:var(--text-primary)}
.icon-btn svg{width:16px;height:16px}
.projects-section{flex:1;display:flex;flex-direction:column;overflow:hidden;padding:12px}
.projects-header{display:flex;align-items:center;justify-content:space-between;padding:0 4px 8px;flex-shrink:0}
.projects-header-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-tertiary)}
.btn-new{display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:var(--radius);background:var(--bg-elevated-2);border:1px solid var(--border);color:var(--text-secondary);font-size:11px;font-weight:500;transition:var(--transition)}
.btn-new:hover{background:var(--bg-elevated-3);color:var(--text-primary);border-color:var(--border-strong)}
.btn-new svg{width:12px;height:12px}
.projects-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:0 2px}
.projects-list:empty::before{content:'Nenhum projeto ainda';display:block;text-align:center;color:var(--text-quaternary);font-size:12px;padding:20px 0}
.project-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius);cursor:pointer;border:1px solid transparent;transition:var(--transition);position:relative}
.project-item:hover{background:var(--bg-elevated-2)}
.project-item.active{background:var(--bg-elevated-2);border-color:var(--border-strong)}
.project-item.active::before{content:'';position:absolute;left:-12px;top:50%;transform:translateY(-50%);width:3px;height:20px;background:var(--accent);border-radius:2px}
.project-status{width:8px;height:8px;border-radius:50%;flex-shrink:0;position:relative}
.project-status.ready{background:var(--success);box-shadow:0 0 0 3px var(--success-bg)}
.project-status.building{background:var(--info);box-shadow:0 0 0 3px var(--info-bg);animation:pulse 1.5s ease-in-out infinite}
.project-status.failed{background:var(--danger);box-shadow:0 0 0 3px var(--danger-bg)}
.project-status.creating{background:var(--warning);box-shadow:0 0 0 3px var(--warning-bg);animation:pulse 1.5s ease-in-out infinite}
.project-info{flex:1;min-width:0}
.project-name{font-size:13px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
.project-meta{font-size:11px;color:var(--text-tertiary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px}
.project-meta .dot{width:2px;height:2px;background:var(--text-quaternary);border-radius:50%}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.sidebar-footer{padding:12px;border-top:1px solid var(--border);flex-shrink:0}
.session-info{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;word-break:break-all;line-height:1.4;padding:8px;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius)}
.conversation{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg-base)}
.chat-header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-elevated)}
.chat-header-title{font-size:14px;font-weight:600;color:var(--text-primary)}
.chat-header-meta{font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:6px}
.chat-header-meta .dot{width:6px;height:6px;border-radius:50%;background:var(--success)}
.chat{flex:1;overflow-y:auto;padding:24px 20px;display:flex;flex-direction:column;gap:16px}
.empty-chat{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px 20px;gap:16px}
.empty-chat-icon{width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--bg-elevated-2) 0%,var(--bg-elevated-3) 100%);display:grid;place-items:center;color:var(--text-tertiary);border:1px solid var(--border)}
.empty-chat-icon svg{width:28px;height:28px}
.empty-chat-title{font-size:18px;font-weight:600;color:var(--text-primary);letter-spacing:-.01em;margin:0}
.empty-chat-desc{font-size:14px;color:var(--text-secondary);max-width:380px;line-height:1.6;margin:0}
.empty-chat-examples{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:480px;margin-top:8px}
.empty-chat-example{padding:8px 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text-secondary);cursor:pointer;transition:var(--transition)}
.empty-chat-example:hover{background:var(--bg-elevated-2);color:var(--text-primary);border-color:var(--border-strong)}
.message{display:flex;gap:10px;max-width:100%;animation:messageIn .2s ease-out}
@keyframes messageIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.message-avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:600;background:var(--bg-elevated-2);color:var(--text-secondary);border:1px solid var(--border)}
.message.user .message-avatar{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.message-body{flex:1;min-width:0}
.message-meta{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.message-author{font-size:12px;font-weight:600;color:var(--text-primary)}
.message-time{font-size:11px;color:var(--text-tertiary)}
.message-content{font-size:14px;line-height:1.6;color:var(--text-primary);white-space:pre-wrap;overflow-wrap:break-word}
.message.system .message-content{color:var(--text-secondary);font-size:13px;font-style:italic}
.timeline{margin-top:4px;padding:14px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md)}
.timeline-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.timeline-title{font-size:12px;font-weight:600;color:var(--text-primary);text-transform:uppercase;letter-spacing:.04em}
.timeline-timer{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace}
.timeline-steps{display:flex;flex-direction:column;gap:6px}
.timeline-step{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text-tertiary);padding:4px 0}
.timeline-step .step-icon{width:16px;height:16px;display:grid;place-items:center;flex-shrink:0;color:var(--text-quaternary)}
.timeline-step .step-icon svg{width:14px;height:14px}
.timeline-step.done{color:var(--text-secondary)}
.timeline-step.done .step-icon{color:var(--success)}
.timeline-step.active{color:var(--text-primary);font-weight:500}
.timeline-step.active .step-icon{color:var(--info);animation:pulse 1.5s ease-in-out infinite}
.timeline-step.error{color:var(--danger)}
.timeline-step.error .step-icon{color:var(--danger)}
.timeline-step .step-detail{font-size:11px;color:var(--text-tertiary);margin-left:26px;margin-top:2px;font-family:'JetBrains Mono',monospace}
.files-changed{margin-top:10px;padding:10px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius)}
.files-changed-label{font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.files-changed-list{display:flex;flex-wrap:wrap;gap:4px}
.files-changed-file{font-size:11px;color:var(--text-secondary);background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-family:'JetBrains Mono',monospace}
.error-card{margin-top:8px;padding:12px 14px;background:var(--danger-bg);border:1px solid var(--danger-border);border-radius:var(--radius-md)}
.error-card-header{display:flex;align-items:flex-start;gap:8px}
.error-card-icon{width:18px;height:18px;color:var(--danger);flex-shrink:0;margin-top:1px}
.error-card-icon svg{width:18px;height:18px}
.error-card-body{flex:1;min-width:0}
.error-card-title{font-size:13px;font-weight:600;color:#fca5a5;margin-bottom:2px}
.error-card-desc{font-size:12px;color:#fecaca;line-height:1.5}
.error-card-actions{display:flex;gap:6px;margin-top:8px}
.error-card-action{padding:5px 10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius);font-size:11px;font-weight:500;color:var(--text-primary);transition:var(--transition)}
.error-card-action:hover{background:var(--bg-elevated-2);border-color:var(--border-strong)}
.error-card-toggle{font-size:11px;color:#fecaca;margin-top:6px;cursor:pointer;user-select:none}
.error-card-details{display:none;margin-top:8px;padding:8px 10px;background:rgba(0,0,0,.3);border-radius:var(--radius);font-size:11px;color:#fca5a5;font-family:'JetBrains Mono',monospace;white-space:pre-wrap;max-height:160px;overflow-y:auto;line-height:1.5}
.error-card-details.show{display:block}
.composer{padding:16px 20px 20px;border-top:1px solid var(--border);background:var(--bg-elevated);flex-shrink:0}
.compose-wrap{position:relative;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius-md);transition:var(--transition)}
.compose-wrap:focus-within{border-color:var(--border-strong);box-shadow:0 0 0 3px rgba(250,250,250,.04)}
.compose-wrap.disabled{opacity:.6}
.prompt{width:100%;min-height:56px;max-height:240px;resize:none;padding:12px 90px 12px 14px;background:transparent;border:0;outline:none;font-size:14px;line-height:1.5;color:var(--text-primary);font-family:inherit}
.prompt::placeholder{color:var(--text-quaternary)}
.prompt:disabled{cursor:not-allowed}
.compose-footer{display:flex;align-items:center;justify-content:space-between;padding:0 14px 8px;font-size:11px;color:var(--text-tertiary);min-height:24px}
.compose-hint{display:flex;align-items:center;gap:4px}
.kbd{font-family:'JetBrains Mono',monospace;font-size:10px;padding:1px 5px;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:4px;color:var(--text-secondary)}
.send{position:absolute;right:8px;bottom:8px;display:flex;align-items:center;gap:6px;padding:7px 12px;background:var(--accent);color:var(--accent-fg);border-radius:var(--radius);font-size:12px;font-weight:600;transition:var(--transition)}
.send:hover:not(:disabled){background:#e4e4e7}
.send:disabled{opacity:.4;cursor:not-allowed}
.send svg{width:12px;height:12px}
.send.sending{background:var(--info);color:#fff;pointer-events:none}
.send.sending svg{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.scroll-bottom{position:absolute;right:20px;bottom:140px;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:50%;width:36px;height:36px;display:none;align-items:center;justify-content:center;color:var(--text-primary);box-shadow:var(--shadow);transition:var(--transition);z-index:10}
.scroll-bottom:hover{background:var(--bg-elevated-3);border-color:var(--border-strong)}
.scroll-bottom.show{display:flex}
.scroll-bottom svg{width:16px;height:16px}
.preview{display:flex;flex-direction:column;background:var(--bg-base);overflow:hidden;border-left:1px solid var(--border)}
.preview-header{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-elevated);gap:12px}
.preview-title{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.preview-status{display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:var(--radius);font-size:11px;font-weight:500;flex-shrink:0}
.preview-status .status-dot{width:6px;height:6px;border-radius:50%;background:var(--text-quaternary)}
.preview-status.idle{background:var(--bg-elevated-2);color:var(--text-tertiary)}
.preview-status.idle .status-dot{background:var(--text-quaternary)}
.preview-status.loading{background:var(--info-bg);color:#93c5fd;border:1px solid var(--info-border)}
.preview-status.loading .status-dot{background:var(--info);animation:pulse 1.2s ease-in-out infinite}
.preview-status.ready{background:var(--success-bg);color:#86efac;border:1px solid var(--success-border)}
.preview-status.ready .status-dot{background:var(--success)}
.preview-status.error{background:var(--danger-bg);color:#fca5a5;border:1px solid var(--danger-border)}
.preview-status.error .status-dot{background:var(--danger)}
.preview-status.recovering{background:var(--warning-bg);color:#fcd34d;border:1px solid var(--warning-border)}
.preview-status.recovering .status-dot{background:var(--warning);animation:pulse .8s ease-in-out infinite}
.preview-actions{display:flex;align-items:center;gap:2px;flex-shrink:0}
.preview-actions button{width:32px;height:32px;display:grid;place-items:center;border-radius:var(--radius);color:var(--text-secondary);transition:var(--transition)}
.preview-actions button:hover:not(:disabled){background:var(--bg-elevated-2);color:var(--text-primary)}
.preview-actions button:disabled{opacity:.3;cursor:not-allowed}
.preview-actions button.active{background:var(--bg-elevated-2);color:var(--text-primary)}
.preview-actions button svg{width:16px;height:16px}
.preview-frame{flex:1;position:relative;background:var(--bg-base);overflow:hidden}
.preview-frame-content{position:absolute;inset:12px;border-radius:var(--radius-lg);overflow:hidden;background:#fff;border:1px solid var(--border);box-shadow:var(--shadow)}
.preview-frame-content.mobile-view{width:390px;height:844px;max-width:calc(100% - 24px);max-height:calc(100% - 24px);left:50%;top:50%;transform:translate(-50%,-50%);border-radius:36px;border:8px solid #1f1f23}
iframe{width:100%;height:100%;border:0;background:#fff;display:block}
.preview-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;gap:16px;background:radial-gradient(ellipse at center,var(--bg-elevated) 0%,var(--bg-base) 70%);z-index:2}
.preview-empty-icon{width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,var(--bg-elevated-2) 0%,var(--bg-elevated-3) 100%);display:grid;place-items:center;color:var(--text-tertiary);border:1px solid var(--border)}
.preview-empty-icon svg{width:32px;height:32px}
.preview-empty-title{font-size:16px;font-weight:600;color:var(--text-primary);letter-spacing:-.01em;margin:0}
.preview-empty-desc{font-size:13px;color:var(--text-secondary);max-width:320px;line-height:1.5;margin:0}
.preview-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(10,10,11,.9);backdrop-filter:blur(4px);z-index:5}
.preview-loading-spinner{width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--text-primary);border-radius:50%;animation:spin .8s linear infinite}
.preview-loading-text{font-size:13px;color:var(--text-secondary);font-weight:500}
.preview-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;gap:14px;background:var(--bg-elevated);z-index:5}
.preview-error-icon{width:64px;height:64px;border-radius:50%;background:var(--danger-bg);border:1px solid var(--danger-border);display:grid;place-items:center;color:var(--danger)}
.preview-error-icon svg{width:28px;height:28px}
.preview-error-title{font-size:16px;font-weight:600;color:var(--text-primary);margin:0}
.preview-error-desc{font-size:13px;color:var(--text-secondary);max-width:340px;line-height:1.5;margin:0}
.preview-error-actions{display:flex;gap:8px;margin-top:8px}
.preview-error-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--accent);color:var(--accent-fg);border-radius:var(--radius);font-size:12px;font-weight:600;transition:var(--transition)}
.preview-error-btn:hover{background:#e4e4e7}
.preview-error-btn.secondary{background:var(--bg-elevated-2);color:var(--text-primary);border:1px solid var(--border)}
.preview-error-btn.secondary:hover{background:var(--bg-elevated-3);border-color:var(--border-strong)}
.preview-error-btn svg{width:14px;height:14px}
.preview-url-bar{padding:8px 16px;border-top:1px solid var(--border);background:var(--bg-elevated);font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:32px}
.preview-url-bar a{color:var(--text-secondary);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.preview-url-bar a:hover{color:var(--text-primary)}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:3000;align-items:center;justify-content:center;padding:20px}
.modal-overlay.show{display:flex;animation:modalIn .15s ease-out}
@keyframes modalIn{from{opacity:0}to{opacity:1}}
.modal-content{background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-lg);padding:24px;width:420px;max-width:100%;box-shadow:var(--shadow-xl)}
.modal-title{font-size:16px;font-weight:600;color:var(--text-primary);margin:0 0 4px}
.modal-desc{font-size:13px;color:var(--text-secondary);margin:0 0 16px;line-height:1.5}
.modal-label{font-size:12px;font-weight:500;color:var(--text-secondary);margin-bottom:6px;display:block}
.modal-input{width:100%;border:1px solid var(--border-strong);background:var(--bg-base);color:var(--text-primary);border-radius:var(--radius);padding:10px 12px;outline:none;font-family:inherit;font-size:14px;margin-bottom:16px;transition:var(--transition)}
.modal-input:focus{border-color:var(--accent)}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}
.modal-actions button{padding:8px 16px;border-radius:var(--radius);font-size:13px;font-weight:500;transition:var(--transition);border:1px solid var(--border)}
.modal-actions button.ghost{background:transparent;color:var(--text-secondary)}
.modal-actions button.ghost:hover{background:var(--bg-elevated-2);color:var(--text-primary)}
.modal-actions button.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.modal-actions button.primary:hover{background:#e4e4e7}
.mobile-preview-btn{position:fixed;top:12px;right:12px;z-index:100;width:40px;height:40px;display:none;align-items:center;justify-content:center;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:50%;color:var(--text-primary);box-shadow:var(--shadow)}
.mobile-preview-btn svg{width:18px;height:18px}
.mobile-back-btn{position:fixed;top:12px;left:12px;z-index:100;width:40px;height:40px;display:none;align-items:center;justify-content:center;background:var(--bg-elevated-2);border:1px solid var(--border);border-radius:50%;color:var(--text-primary);box-shadow:var(--shadow)}
.mobile-back-btn svg{width:18px;height:18px}
@media(max-width:900px){
.app{grid-template-columns:1fr;grid-template-rows:1fr}
.sidebar,.preview,.splitter{display:none}
.conversation{display:flex}
.app.preview-mode .sidebar,.app.preview-mode .splitter,.app.preview-mode .conversation{display:none}
.app.preview-mode .preview{display:flex;position:fixed;inset:0;z-index:50;background:var(--bg-base)}
.app.preview-mode .mobile-back-btn{display:flex}
.app:not(.preview-mode) .mobile-preview-btn{display:flex}
.app:not(.preview-mode) .mobile-back-btn{display:none}
}
</style>
</head>
<body>
<div class="app" id="app">
<aside class="sidebar" id="sidebar" role="navigation" aria-label="Projetos">
<div class="sidebar-header">
<div class="brand"><div class="brand-mark">P</div><span>Prototype</span></div>
<button class="icon-btn" id="collapseSidebar" title="Recolher sidebar" aria-label="Recolher sidebar">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
</button>
</div>
<div class="projects-section">
<div class="projects-header">
<span class="projects-header-label">Projetos</span>
<button class="btn-new" id="newProject" aria-label="Novo projeto">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
Novo
</button>
</div>
<div class="projects-list" id="projectsList"></div>
</div>
<div class="sidebar-footer"><div class="session-info" id="sessionBox"></div></div>
</aside>
<section class="conversation" id="conversation">
<div class="chat-header">
<div class="chat-header-title" id="chatHeaderTitle">Sem projeto ativo</div>
<div class="chat-header-meta" id="chatHeaderMeta">
<span class="dot"></span>
<span id="chatHeaderStatus">Aguardando</span>
</div>
</div>
<div class="chat" id="chat"></div>
<div class="composer">
<div class="compose-wrap" id="composeWrap">
<textarea id="prompt" class="prompt" placeholder="Descreva o que você quer construir..." rows="2"></textarea>
<button id="send" class="send" disabled aria-label="Enviar">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
<span>Enviar</span>
</button>
</div>
<div class="compose-footer">
<div class="compose-hint">
<span class="kbd">Enter</span> para enviar
<span class="kbd">Shift+Enter</span> para nova linha
</div>
<div id="composeStatus"></div>
<div id="taskTimer" style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;margin-top:4px;display:none"></div>
</div>
<button id="scrollBottom" class="scroll-bottom" aria-label="Rolar para baixo">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
</button>
</div>
</section>
<div class="splitter" id="splitter"></div>
<section class="preview" id="preview" aria-label="Preview">
<div class="preview-header">
<div class="preview-title">
<div class="preview-status idle" id="previewStatus">
<span class="status-dot"></span>
<span id="previewStatusLabel">Aguardando projeto</span>
</div>
</div>
<div class="preview-actions">
<button id="mobilePreviewBtn" title="Visualização mobile" aria-label="Visualização mobile">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>
</button>
<button id="refresh" title="Recarregar preview" aria-label="Recarregar" disabled>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 12a9 9 0 0 0 15 6.7L21 16M21 3v5h-5M3 21v-5h5"/></svg>
</button>
<button id="open" title="Abrir em nova aba" aria-label="Abrir" disabled>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
</button>
<button id="fullscreen" title="Tela cheia" aria-label="Tela cheia" disabled>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
</button>
</div>
</div>
<div class="preview-frame">
<div class="preview-frame-content" id="frame">
<div class="preview-empty" id="previewEmpty">
<div class="preview-empty-icon">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
</div>
<h3 class="preview-empty-title" id="previewEmptyTitle">Aguardando projeto</h3>
<p class="preview-empty-desc" id="previewEmptyDesc">Descreva o que você quer criar e o PUB Prototype começa a construir.</p>
</div>
<div class="preview-loading" id="previewLoading" style="display:none">
<div class="preview-loading-spinner"></div>
<div class="preview-loading-text" id="previewLoadingText">Preparando preview...</div>
</div>
<div class="preview-error" id="previewError" style="display:none">
<div class="preview-error-icon">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
</div>
<h3 class="preview-error-title" id="previewErrorTitle">Preview indisponível</h3>
<p class="preview-error-desc" id="previewErrorDesc">O tunnel do preview expirou. Vamos reconectar.</p>
<div class="preview-error-actions">
<button class="preview-error-btn" id="previewErrorRetry">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 12a9 9 0 0 0 15 6.7L21 16M21 3v5h-5M3 21v-5h5"/></svg>
Reconectar preview
</button>
</div>
</div>
<iframe id="iframe" title="Preview do projeto" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
</div>
</div>
<div class="preview-url-bar" id="previewUrlBar" style="display:none">
<a id="previewUrl" target="_blank" rel="noopener noreferrer">—</a>
</div>
</section>
</div>
<button class="mobile-preview-btn" id="mobilePreviewShowBtn" aria-label="Mostrar preview">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
</button>
<button class="mobile-back-btn" id="mobileBackBtn" aria-label="Voltar">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
</button>
<div class="modal-overlay" id="newProjectModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
<div class="modal-content">
<h2 class="modal-title" id="modalTitle">Novo projeto</h2>
<p class="modal-desc">Dê um nome ao seu projeto. Você poderá descrevê-lo na próxima etapa.</p>
<label class="modal-label" for="newProjectName">Nome do projeto</label>
<input type="text" class="modal-input" id="newProjectName" placeholder="Ex: Sistema para Padaria" maxlength="60" autocomplete="off">
<div class="modal-actions">
<button id="cancelNewProject" class="ghost">Cancelar</button>
<button id="confirmNewProject" class="primary">Criar projeto</button>
</div>
</div>
</div>
<script>
let sessionId=null,source=null,currentUrl=null,activeTimeline=null,checkpoints=[],loadSessionAt=0;
let currentTaskId=null,activeTaskStatus=null,taskStartAt=null,timerInterval=null;
let projectsCache=[];
let previewState='idle';
let currentError=null;
const STORAGE_KEY='pub-prototype:last-session';
const STEP_ORDER=['USER_PROMPT','AGENT_STARTED','AGENT_OUTPUT','BUILD_STARTED','BUILD_PASSED','PREVIEW_STARTED','PREVIEW_READY'];
const STEP_LABELS={'USER_PROMPT':'Seu pedido','AGENT_STARTED':'Agente iniciado','AGENT_OUTPUT':'Gerando código','BUILD_STARTED':'Validando','BUILD_PASSED':'Build aprovado','PREVIEW_STARTED':'Subindo preview','PREVIEW_READY':'Pronto'};
function $(id){return document.getElementById(id)}
function $$(sel){return document.querySelectorAll(sel)}
function escapeHtml(s){if(s==null)return '';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}

// === STATE MANAGEMENT ===
function setPreviewState(state, opts={}) {
  previewState = state;
  const status = $('previewStatus');
  const label = $('previewStatusLabel');
  const empty = $('previewEmpty');
  const loading = $('previewLoading');
  const error = $('previewError');
  const iframe = $('iframe');
  status.className = 'preview-status ' + state;
  const labels = {idle: 'Aguardando projeto', loading: 'Carregando preview...', ready: 'Preview pronto', error: 'Preview indisponível', recovering: 'Reconectando preview...'};
  label.textContent = labels[state] || state;
  empty.style.display = state === 'idle' ? 'flex' : 'none';
  loading.style.display = (state === 'loading' || state === 'recovering') ? 'flex' : 'none';
  if (state === 'recovering') $('previewLoadingText').textContent = 'Reconectando preview...';
  else if (state === 'loading') $('previewLoadingText').textContent = 'Carregando preview...';
  error.style.display = state === 'error' ? 'flex' : 'none';
  iframe.style.display = state === 'ready' ? 'block' : 'none';
  if (state === 'error') {
    $('previewErrorTitle').textContent = opts.title || 'Preview indisponível';
    $('previewErrorDesc').textContent = opts.desc || 'Não foi possível conectar ao preview.';
  }
  $('refresh').disabled = !currentUrl && state !== 'error';
  $('open').disabled = !currentUrl;
}

function renderChatEmpty() {
  const chat = $('chat');
  if (!chat) return;
  chat.innerHTML = '';
  if (!sessionId) {
    chat.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><h2 class="empty-chat-title">Aguardando projeto</h2><p class="empty-chat-desc">Descreva o que você quer criar e o PUB Prototype começa a construir.</p><div class="empty-chat-examples"><button class="empty-chat-example" data-prompt="Crie um sistema de lista de tarefas com React">📝 Lista de tarefas</button><button class="empty-chat-example" data-prompt="Crie uma landing page para uma cafeteria">☕ Landing page cafeteria</button><button class="empty-chat-example" data-prompt="Crie um dashboard com gráfico de vendas">📊 Dashboard de vendas</button></div></div>';
    $$('.empty-chat-example').forEach(el => {
      el.onclick = () => { $('prompt').value = el.dataset.prompt; $('prompt').dispatchEvent(new Event('input')); };
    });
  } else if (currentTaskId) {
    chat.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div><h2 class="empty-chat-title">Construindo...</h2><p class="empty-chat-desc">O agente está implementando as alterações. O histórico aparecerá aqui.</p></div>';
  } else {
    chat.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9M12 4h9M3 20h18M3 4h18M3 12h18"/></svg></div><h2 class="empty-chat-title">Pronto para continuar</h2><p class="empty-chat-desc">Descreva o que você quer adicionar ou alterar neste projeto.</p></div>';
  }
}

function formatTime(iso){if(!iso)return '';const d=new Date(iso);const now=new Date();const diff=(now-d)/1000;if(diff<60)return 'agora';if(diff<3600)return Math.floor(diff/60)+'min';if(diff<86400)return Math.floor(diff/3600)+'h';if(diff<604800)return Math.floor(diff/86400)+'d';return d.toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}
function formatElapsed(ms){const s=Math.floor(ms/1000);if(s<60)return s+'s';return Math.floor(s/60)+'m'+(s%60)+'s'}
function startTaskTimer(){
  if(timerInterval)clearInterval(timerInterval);
  taskStartAt=Date.now();
  const el=$('taskTimer');
  if(el){el.style.display='block';el.textContent='0s';}
  timerInterval=setInterval(()=>{
    if(!taskStartAt)return;
    const elapsed=formatElapsed(Date.now()-taskStartAt);
    const el=$('taskTimer');
    if(el)el.textContent=elapsed;
    const status=$('composeStatus');
    if(status&&status.textContent==='Construindo...'){
      status.textContent='Construindo... '+elapsed;
    }
  },1000);
}
function stopTaskTimer(){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  taskStartAt=null;
  const el=$('taskTimer');
  if(el){el.style.display='none';el.textContent='';}
}
function getStatusClass(status){if(status==='READY')return 'ready';if(status==='BUILDING'||status==='CREATING')return 'building';if(status==='FAILED')return 'failed';return 'creating'}
function getStatusLabel(status){const labels={READY:'Pronto',BUILDING:'Construindo',CREATING:'Criando',FAILED:'Falhou'};return labels[status]||status}

// === PREVIEW ===
// State machine: idle → loading → ready | error
// "ready" is ONLY declared after iframe.onload fires (proves content actually rendered)
let previewLoadTimeout = null;
let previewLoadGeneration = 0;

function renderPreview(url) {
  if (!url) return;
  if (url === currentUrl) return;
  currentUrl = url;
  const iframe = $('iframe');
  // Go to LOADING first - do NOT declare ready until iframe.onload fires
  setPreviewState('loading');
  $('previewUrl').textContent = url;
  $('previewUrl').href = url;
  $('previewUrlBar').style.display = 'flex';
  // Bind load handlers BEFORE setting src
  const generation = ++previewLoadGeneration;
  const onLoad = () => {
    if (generation !== previewLoadGeneration) return; // stale callback
    if (previewLoadTimeout) { clearTimeout(previewLoadTimeout); previewLoadTimeout = null; }
    setPreviewState('ready');
  };
  const onError = () => {
    if (generation !== previewLoadGeneration) return;
    if (previewLoadTimeout) { clearTimeout(previewLoadTimeout); previewLoadTimeout = null; }
    // Keep URL but mark as error - user can retry
    showPreviewError({title: 'Preview indisponível', desc: 'O preview não pôde ser carregado. Tente reconectar.'});
  };
  // Replace iframe to drop stale listeners
  const newIframe = iframe.cloneNode(false);
  newIframe.src = url;
  newIframe.addEventListener('load', onLoad);
  newIframe.addEventListener('error', onError);
  iframe.parentNode.replaceChild(newIframe, iframe);
  // Update the reference so future renders use the new element
  // (UI bindings target $('iframe') which re-queries each time)
  // Timeout safety: if onload never fires (e.g. cloudflared tunnel expired),
  // probe the URL after a delay
  if (previewLoadTimeout) clearTimeout(previewLoadTimeout);
  previewLoadTimeout = setTimeout(() => {
    if (generation !== previewLoadGeneration) return;
    // Tunnel is likely expired - do not declare ready, leave in loading
    // and trigger recovery immediately (no user action needed)
    if (sessionId) triggerPreviewRecovery(sessionId);
  }, 3000);
}

function showPreviewError(opts) {
  if (previewLoadTimeout) { clearTimeout(previewLoadTimeout); previewLoadTimeout = null; }
  setPreviewState('error', opts);
}

async function triggerPreviewRecovery(sid) {
  setPreviewState('recovering');
  try {
    const r = await fetch('/prototype/sessions/' + encodeURIComponent(sid) + '/preview/refresh', { method: 'POST' });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      showPreviewError({title: 'Preview indisponível', desc: errData.error || 'Não foi possível reconectar.'});
      return;
    }
    const data = await r.json();
    if (data.session?.previewUrl) {
      currentUrl = null; // force update
      renderPreview(data.session.previewUrl);
    } else {
      showPreviewError({title: 'Falha na reconexão', desc: 'Tente novamente em alguns segundos.'});
    }
  } catch (e) {
    showPreviewError({title: 'Erro de conexão', desc: 'Não foi possível reconectar ao preview.'});
  }
}

async function verifyAndRefreshPreview(sessionId, url) {
  // Only run the probe if the iframe hasn't fired onload yet OR if the URL is recent.
  // If iframe.onload already fired and we're in 'ready' state, trust it.
  if (previewState === 'ready') return;
  // Probe: HEAD request with no-cors to detect DNS/connection failures.
  // Note: no-cors returns "opaque" for any HTTP response, so this only catches
  // hard failures (DNS error, connection refused, tunnel dead). That's enough
  // to detect a dead tunnel - the actual content load is verified by onload.
  let reachable = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    // opaque response = tunnel is up (even if 5xx)
    if (resp.type === 'opaque' || resp.ok) reachable = true;
  } catch {
    // aborted or network error = tunnel is likely dead
  }
  if (reachable) {
    // Tunnel is up - if iframe is in loading state, let onload decide.
    // If iframe already failed (error state), keep error.
    return;
  }
  // Tunnel is dead - trigger recovery
  await triggerPreviewRecovery(sessionId);
}

// === CHAT ===
function addMessage(role, content, ts) {
  const chat = $('chat');
  const empty = chat.querySelector('.empty-chat');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'message ' + role;
  const avatar = role === 'user' ? 'V' : role === 'system' ? 'i' : 'P';
  const author = role === 'user' ? 'Você' : role === 'system' ? 'Sistema' : 'Prototype';
  div.innerHTML = '<div class="message-avatar">' + avatar + '</div><div class="message-body"><div class="message-meta"><span class="message-author">' + author + '</span><span class="message-time">' + (ts ? formatTime(ts) : 'agora') + '</span></div><div class="message-content">' + escapeHtml(content) + '</div></div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addTimeline(steps, files, opts = {}) {
  const chat = $('chat');
  const empty = chat.querySelector('.empty-chat');
  if (empty) empty.remove();
  const doneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const activeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
  const stepsHtml = steps.map(s => '<div class="timeline-step ' + s.status + '"><div class="step-icon">' + (s.status === 'active' ? activeIcon : doneIcon) + '</div><span>' + s.label + '</span>' + (s.detail ? '<div class="step-detail">' + s.detail + '</div>' : '') + '</div>').join('');
  const filesHtml = files && files.length ? '<div class="files-changed"><div class="files-changed-label">' + files.length + ' arquivo' + (files.length !== 1 ? 's' : '') + '</div><div class="files-changed-list">' + files.map(f => '<span class="files-changed-file">' + escapeHtml(f) + '</span>').join('') + '</div></div>' : '';

  // Find existing active timeline to update in-place (avoids duplicate cards)
  const existing = chat.querySelector('.timeline[data-active]');
  if (existing) {
    existing.querySelector('.timeline-steps').innerHTML = stepsHtml;
    const filesEl = existing.querySelector('.files-changed');
    if (filesHtml) {
      if (filesEl) filesEl.outerHTML = filesHtml; else existing.insertAdjacentHTML('beforeend', filesHtml);
    }
    chat.scrollTop = chat.scrollHeight;
    return;
  }

  // No active timeline — create new one and mark as active
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = '<div class="message-avatar">i</div><div class="message-body" style="flex:1;min-width:0"><div class="timeline" data-active><div class="timeline-header"><div class="timeline-title">Progresso</div></div><div class="timeline-steps">' + stepsHtml + '</div>' + filesHtml + '</div></div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function addErrorCard(opts) {
  const chat = $('chat');
  const empty = chat.querySelector('.empty-chat');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'message system';
  const titles = {AGENT_ERROR: 'Não foi possível completar', BUILD_ERROR: 'Erro de validação', PREVIEW_ERROR: 'Preview indisponível', RECOVERY_ERROR: 'Erro de reconexão'};
  const descs = {AGENT_ERROR: 'O agente encontrou um problema. Tente reformular o pedido.', BUILD_ERROR: 'O código foi gerado mas não passou na validação.', PREVIEW_ERROR: 'O código foi criado, mas o preview não está respondendo.', RECOVERY_ERROR: 'Não foi possível reconectar ao preview.'};
  const actions = opts.actions || [];
  const actionHtml = actions.map((a, i) => '<button class="error-card-action" data-action="' + i + '">' + escapeHtml(a.label) + '</button>').join('');
  div.innerHTML = '<div class="message-avatar">!</div><div class="message-body" style="flex:1;min-width:0"><div class="error-card"><div class="error-card-header"><div class="error-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="error-card-body"><div class="error-card-title">' + (titles[opts.type] || 'Erro') + '</div><div class="error-card-desc">' + escapeHtml(opts.desc || descs[opts.type] || 'Algo deu errado.') + '</div>' + (actionHtml ? '<div class="error-card-actions">' + actionHtml + '</div>' : '') + (opts.detail ? '<div class="error-card-toggle">Ver detalhes</div><div class="error-card-details">' + escapeHtml(opts.detail) + '</div>' : '') + '</div></div></div></div>';
  chat.appendChild(div);
  actions.forEach((a, i) => { const btn = div.querySelector('[data-action="' + i + '"]'); if (btn && a.onClick) btn.onclick = a.onClick; });
  const toggle = div.querySelector('.error-card-toggle');
  const details = div.querySelector('.error-card-details');
  if (toggle && details) { toggle.onclick = () => { details.classList.toggle('show'); toggle.textContent = details.classList.contains('show') ? 'Ocultar detalhes' : 'Ver detalhes'; }; }
  chat.scrollTop = chat.scrollHeight;
}

function clearStaleErrors() { $$('.error-card').forEach(el => el.closest('.message')?.remove()); }

// === SIDEBAR ===
async function loadProjects() {
  try {
    const r = await fetch('/prototype/sessions');
    if (!r.ok) throw new Error('Failed');
    const data = await r.json();
    const sessions = Array.isArray(data) ? data : [];
    const projectMap = new Map();
    sessions.forEach(s => { const ex = projectMap.get(s.project); if (!ex || new Date(s.updatedAt) > new Date(ex.updatedAt)) projectMap.set(s.project, s); });
    projectsCache = Array.from(projectMap.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    renderProjects();
  } catch (e) { console.error('Failed to load projects:', e); projectsCache = []; renderProjects(); }
}

function renderProjects() {
  const list = $('projectsList');
  if (!list) return;
  list.innerHTML = '';
  if (!projectsCache.length) return;
  projectsCache.forEach(p => {
    const el = document.createElement('div');
    el.className = 'project-item' + (p.id === sessionId ? ' active' : '');
    el.innerHTML = '<span class="project-status ' + getStatusClass(p.status) + '"></span><div class="project-info"><div class="project-name">' + escapeHtml(p.project || 'Sem nome') + '</div><div class="project-meta">' + getStatusLabel(p.status) + '<span class="dot"></span>' + formatTime(p.updatedAt) + '</div></div>';
    el.onclick = () => selectProject(p.id);
    list.appendChild(el);
  });
}

async function selectProject(id) { if (id === sessionId) return; try { await loadSession(id); } catch (e) { addMessage('system', 'Erro ao carregar projeto: ' + (e?.message || String(e))); } }

// === MODAL ===
function showNewProjectModal() { $('newProjectModal').classList.add('show'); setTimeout(() => $('newProjectName').focus(), 100); }
function hideNewProjectModal() { $('newProjectModal').classList.remove('show'); $('newProjectName').value = ''; }
async function confirmNewProject() {
  const name = $('newProjectName').value.trim();
  if (!name) return;
  hideNewProjectModal();
  try {
    const r = await fetch('/prototype/sessions', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({project: name}) });
    if (!r.ok) throw new Error('Failed to create');
    const session = await r.json();
    localStorage.setItem(STORAGE_KEY, session.id);
    await loadProjects();
    await loadSession(session.id);
  } catch (e) { addMessage('system', 'Erro ao criar projeto: ' + (e?.message || String(e))); }
}

// === LOAD SESSION ===
async function loadSession(id) {
  loadSessionAt = Date.now();
  const r = await fetch('/prototype/sessions/' + encodeURIComponent(id));
  if (!r.ok) throw new Error('Sessão não encontrada');
  const data = await r.json();
  clearStaleErrors();
  sessionId = data.session.id;
  $('chatHeaderTitle').textContent = data.session.project || 'Sem nome';
  $('sessionBox').textContent = sessionId;
  $('chat').innerHTML = '';
  checkpoints = [...(data.checkpoints || [])];
  const messages = data.messages || [];
  messages.forEach(m => { const role = m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'agent'; addMessage(role, m.content || '', m.timestamp); });
  if (!messages.length) renderChatEmpty();
  $('chatHeaderStatus').textContent = data.session.status === 'READY' ? 'Pronto' : data.session.status;
  $('chatHeaderMeta').querySelector('.dot').style.background = data.session.status === 'FAILED' ? 'var(--danger)' : 'var(--success)';
  renderProjects();
  if (data.session.previewUrl) { currentUrl = null; renderPreview(data.session.previewUrl); verifyAndRefreshPreview(id, data.session.previewUrl); } else { setPreviewState('idle'); }
  const tasks = data.tasks || [];
  const activeTask = tasks.find(t => ['QUEUED','ASSIGNED','RUNNING','TESTING'].includes(t.status));
  if (activeTask) { currentTaskId = activeTask.id; activeTaskStatus = activeTask.status; $('send').classList.add('sending'); $('composeStatus').textContent = 'Construindo...'; startTaskTimer(); } else { currentTaskId = null; activeTaskStatus = null; $('send').classList.remove('sending'); $('composeStatus').textContent = ''; stopTaskTimer(); }
  attachEvents(id);
}

// === SSE ===
function attachEvents(id) {
  if (source) source.close();
  source = new EventSource('/prototype/sessions/' + encodeURIComponent(id) + '/events');
  const doneIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  const activeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

  source.addEventListener('USER_PROMPT', e => {
    addMessage('user', JSON.parse(e.data).payload?.prompt || '');
    $('composeStatus').textContent = 'Construindo...';
    $('send').classList.add('sending');
    $('prompt').value = '';
    $('prompt').disabled = true;
    $('send').disabled = true;
    startTaskTimer();
    addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'active'}]);
  });

  source.addEventListener('AGENT_STARTED', e => {
    addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'active'}]);
  });

  source.addEventListener('FILE_CHANGED', e => {
      const p = JSON.parse(e.data).payload;
      if (p?.files) {
        const existing = chat.querySelector('.timeline[data-active]');
        if (existing) {
          let filesEl = existing.querySelector('.files-changed');
          if (!filesEl) {
            filesEl = document.createElement('div');
            filesEl.className = 'files-changed';
            filesEl.innerHTML = '<div class="files-changed-label"></div><div class="files-changed-list"></div>';
            existing.appendChild(filesEl);
          }
          const list = filesEl.querySelector('.files-changed-list');
          const existingFiles = new Set(Array.from(list.querySelectorAll('.files-changed-file')).map(el => el.textContent));
          p.files.forEach(f => {
            if (!existingFiles.has(f)) {
              list.insertAdjacentHTML('beforeend', '<span class="files-changed-file">' + escapeHtml(f) + '</span>');
              existingFiles.add(f);
            }
          });
          const count = list.querySelectorAll('.files-changed-file').length;
          filesEl.querySelector('.files-changed-label').textContent = count + ' arquivo' + (count !== 1 ? 's' : '');
        }
      }
    });

  source.addEventListener('BUILD_STARTED', e => {
    addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'done'}, {label: 'Validando', status: 'active'}]);
  });

  source.addEventListener('BUILD_PASSED', e => {
    addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'done'}, {label: 'Build aprovado', status: 'done'}]);
  });

  source.addEventListener('BUILD_FAILED', e => {
    const p = JSON.parse(e.data).payload;
    addErrorCard({type: 'BUILD_ERROR', desc: p?.message || 'O código foi gerado mas não passou na validação.', detail: p?.stderr || p?.output || '', actions: [{label: 'Tentar novamente', onClick: () => { $('prompt').focus(); }}]});
    $('send').classList.remove('sending'); $('prompt').disabled = false; $('composeStatus').textContent = '';
    stopTaskTimer();
  });

  source.addEventListener('PREVIEW_STARTING', e => { setPreviewState('loading'); addTimeline([{label:'Iniciando preview',status:'active'}]); });
  source.addEventListener('PREVIEW_LOCAL_SERVER_READY', e => { const p=JSON.parse(e.data).payload; addTimeline([{label:'Servidor local pronto',status:'done',detail:p?.port?'porta '+p.port:''}]); });
  source.addEventListener('PREVIEW_TUNNEL_READY', e => { const p=JSON.parse(e.data).payload; addTimeline([{label:'Tunnel conectado',status:'done',detail:p?.url?'URL '+p.url:''}]); });
  source.addEventListener('PREVIEW_READY', e => {
      const ev = JSON.parse(e.data);
      const eventSessionId = ev.payload?.sessionId;
      if (eventSessionId && eventSessionId !== sessionId) return;
      const newUrl = ev.payload?.url || ev.payload?.previewUrl;
      if (!newUrl || newUrl === currentUrl) return;
      if (loadSessionAt && (Date.now() - loadSessionAt) < 2000) return;
      // Update timeline to show preview building (not yet ready)
      addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'done'}, {label: 'Build aprovado', status: 'done'}, {label: 'Subindo preview', status: 'active'}]);
      // renderPreview goes to 'loading' - it will transition to 'ready' on iframe.onload
      renderPreview(newUrl);
      // Poll for iframe.onload completion before declaring "Pronto"
      const checkLoaded = () => {
        if (previewState === 'ready') {
          addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'done'}, {label: 'Build aprovado', status: 'done'}, {label: 'Subindo preview', status: 'done'}, {label: 'Pronto', status: 'done'}]);
          $('send').classList.remove('sending'); $('prompt').disabled = false; $('composeStatus').textContent = 'Pronto';
          $('chatHeaderStatus').textContent = 'Pronto'; $('chatHeaderMeta').querySelector('.dot').style.background = 'var(--success)';
          currentTaskId = null; activeTaskStatus = null;
          stopTaskTimer();
        } else if (previewState === 'error') {
          // Show timeline with error state
          addTimeline([{label: 'Seu pedido', status: 'done'}, {label: 'Agente iniciado', status: 'done'}, {label: 'Gerando código', status: 'done'}, {label: 'Build aprovado', status: 'done'}, {label: 'Subindo preview', status: 'done'}, {label: 'Erro no preview', status: 'error'}]);
          $('send').classList.remove('sending'); $('prompt').disabled = false; $('composeStatus').textContent = 'Preview indisponível';
          $('chatHeaderStatus').textContent = 'Erro'; $('chatHeaderMeta').querySelector('.dot').style.background = 'var(--danger)';
          currentTaskId = null; activeTaskStatus = null;
          stopTaskTimer();
        } else {
          setTimeout(checkLoaded, 500);
        }
      };
      setTimeout(checkLoaded, 500);
    });

  source.addEventListener('PREVIEW_FAILED', e => {
    const p = JSON.parse(e.data).payload;
    showPreviewError({title: 'Erro no preview', desc: p?.message || 'O preview não pôde ser iniciado.'});
    addErrorCard({type: 'PREVIEW_ERROR', desc: p?.message, detail: p?.stderr || ''});
  });

  source.addEventListener('CHECKPOINT_CREATED', e => { loadProjects(); });

  const seenIds = new Set<string>();
    source.addEventListener('ERROR', e => {
      try {
        const ev = JSON.parse(e.data);
        if (seenIds.has(ev.id)) return;
        seenIds.add(ev.id);
        const p = ev.payload ?? ({} as Record<string, unknown>);
        if (p?.message && typeof p.message === 'string' && p.message.length > 0) {
          addErrorCard({ type: 'AGENT_ERROR', desc: p.message.slice(0, 300), detail: p.message, actions: [{ label: 'Tentar novamente', onClick: () => { $('prompt').focus(); } }] });
        } else {
          addErrorCard({ type: 'PREVIEW_ERROR', desc: 'O preview não respondeu. Verificar logs de runtime.', detail: JSON.stringify(p), actions: [{ label: 'Ver detalhes', onClick: () => { /* expand details */ } }] });
        }
      } catch { }
    });
}

// === COMPOSER ===
const sendBtn = $('send');
const promptEl = $('prompt');
const composeWrap = $('composeWrap');
function updateSendButton() {
  const hasText = promptEl.value.trim().length > 0;
  const isActive = activeTaskStatus === 'RUNNING' || activeTaskStatus === 'QUEUED';
  sendBtn.disabled = !hasText || isActive || !sessionId;
  composeWrap.classList.toggle('disabled', isActive);
}
promptEl.addEventListener('input', () => { promptEl.style.height = 'auto'; promptEl.style.height = Math.min(promptEl.scrollHeight, 240) + 'px'; updateSendButton(); });
promptEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) send(); } });
sendBtn.addEventListener('click', send);
async function send() {
  const text = promptEl.value.trim();
  if (!text || !sessionId) return;
  try {
    sendBtn.classList.add('sending'); promptEl.value = ''; promptEl.style.height = 'auto'; updateSendButton();
    const r = await fetch('/prototype/sessions/' + encodeURIComponent(sessionId) + '/prompts', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({prompt: text}) });
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.error || 'Failed to send'); }
    const data = await r.json();
    currentTaskId = data.task?.id; activeTaskStatus = 'QUEUED'; updateSendButton();
  } catch (e) { sendBtn.classList.remove('sending'); promptEl.value = text; updateSendButton(); addErrorCard({type: 'AGENT_ERROR', desc: e?.message || 'Erro ao enviar'}); }
}

// === PREVIEW CONTROLS ===
$('refresh').addEventListener('click', () => {
  if (currentUrl) {
    // Force re-render with onload detection
    const saved = currentUrl;
    currentUrl = null;
    renderPreview(saved);
  }
});

$('open').addEventListener('click', () => { if (currentUrl) window.open(currentUrl, '_blank', 'noopener,noreferrer'); });

$('fullscreen').addEventListener('click', () => { const frame = $('frame'); if (frame.requestFullscreen) frame.requestFullscreen(); });

$('mobilePreviewBtn').addEventListener('click', () => { $('frame').classList.toggle('mobile-view'); $('mobilePreviewBtn').classList.toggle('active'); });

$('previewErrorRetry').addEventListener('click', () => {
  if (sessionId) triggerPreviewRecovery(sessionId);
});

// === CHAT SCROLL ===
const chat = $('chat');
const scrollBottom = $('scrollBottom');
chat.addEventListener('scroll', () => { const dist = chat.scrollHeight - chat.scrollTop - chat.clientHeight; scrollBottom.classList.toggle('show', dist > 200); });
scrollBottom.addEventListener('click', () => { chat.scrollTo({top: chat.scrollHeight, behavior: 'smooth'}); });

// === SIDEBAR ===
$('newProject').addEventListener('click', showNewProjectModal);
$('cancelNewProject').addEventListener('click', hideNewProjectModal);
$('confirmNewProject').addEventListener('click', confirmNewProject);
$('newProjectName').addEventListener('keydown', e => { if (e.key === 'Enter') confirmNewProject(); if (e.key === 'Escape') hideNewProjectModal(); });
$('newProjectModal').addEventListener('click', e => { if (e.target === $('newProjectModal')) hideNewProjectModal(); });
$('collapseSidebar').addEventListener('click', () => { $('sidebar').classList.toggle('collapsed'); const app = document.querySelector('.app'); if ($('sidebar').classList.contains('collapsed')) app.style.gridTemplateColumns = '40px 1fr 1.2fr'; else app.style.gridTemplateColumns = '280px 1fr 1.2fr'; });

// === MOBILE ===
$('mobilePreviewShowBtn').addEventListener('click', () => { document.getElementById('app').classList.add('preview-mode'); });
$('mobileBackBtn').addEventListener('click', () => { document.getElementById('app').classList.remove('preview-mode'); });

// === INIT ===
window.addEventListener('load', async () => {
  initSplitter();
  setPreviewState('idle');
  renderChatEmpty();
  await loadProjects();
  const last = localStorage.getItem(STORAGE_KEY);
  let targetId = last;
  if (!targetId) { targetId = projectsCache.length > 0 ? projectsCache[0].id : null; }
  if (targetId) { try { await loadSession(targetId); } catch (e) { console.error('Failed to load session:', e); localStorage.removeItem(STORAGE_KEY); } } else { updateSendButton(); }
});

// === SPLITTER ===
function initSplitter() {
  const splitter = $('splitter'); if (!splitter) return;
  let isResizing = false;
  splitter.addEventListener('mousedown', e => { isResizing = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
  window.addEventListener('mousemove', e => { if (!isResizing) return; const app = document.querySelector('.app'); const rect = app.getBoundingClientRect(); const cw = e.clientX - rect.left - 280; if (cw > 200) app.style.gridTemplateColumns = '280px ' + cw + 'px 1fr'; });
  window.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; } });
}
</script>
</body>
</html>`;

  return html.trim();
}
