// @vitest-environment jsdom

// ── localStorage mock (avoids opaque-origin SecurityError in JSDOM) ──────────
const _ls: Record<string, string> = {};
const localStorageMock = {
  _data: _ls,
  getItem(key: string) { return _ls[key] ?? null; },
  setItem(key: string, value: any) { _ls[key] = String(value); },
  removeItem(key: string) { delete _ls[key]; },
  clear() { Object.keys(_ls).forEach(k => delete _ls[k]); },
  key(index: number) { return Object.keys(_ls)[index] ?? null; },
  get length() { return Object.keys(_ls).length; },
} as Storage;
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true, configurable: true });

// ── EventSource stub (UI inline script uses it; not available in JSDOM) ──────
class EventSourceStub {
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
  addEventListener() {}
  removeEventListener() {}
  constructor(url: string) { this.url = url; }
}
(global as any).EventSource = EventSourceStub;

// ── getComputedStyle guard ────────────────────────────────────────────────────
if (typeof global.getComputedStyle === 'undefined') {
  (global as any).getComputedStyle = (_el: Element) => ({
    gridTemplateColumns: '',
    height: '0px',
    getPropertyValue: () => '',
  });
}

// ── $ helper ─────────────────────────────────────────────────────────────────
(global as any).$ = (id: string) => document.getElementById(id);

// ── Expose element IDs as globals (browser does this automatically) ───────────
function exposeGlobals() {
  const ids = ['chat', 'send', 'progress', 'overlay', 'overlayTitle', 'overlayDesc', 'overlayTips'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) (global as any)[id] = el;
  }
  // sendBtn alias used by UI inline script functions
  const sendBtn = document.getElementById('send');
  if (sendBtn) (global as any).sendBtn = sendBtn;
}

// ── Main init helper exported for all UI tests ───────────────────────────────
export function initTestDom(html: string) {
  document.body.innerHTML = html;
  exposeGlobals();
  const script = document.querySelector('script');
  if (script?.textContent) {
    // eslint-disable-next-line no-eval
    eval(script.textContent);
  }
  // Dispatch load event so window.onload / window.addEventListener('load') runs
  window.dispatchEvent(new Event('load'));
}
process.env.ROUTER_PROVIDER_CHAIN = 'mock';
process.env.PROTOTYPE_PROVIDER_CHAIN = 'mock';
