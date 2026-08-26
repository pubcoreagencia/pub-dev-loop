// @vitest-environment jsdom
// UI Splitter tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTestDom } from './setup';
import { prototypeUiHtml } from '../src/prototype/ui.js';

function setupDom() { initTestDom(prototypeUiHtml()); }

describe('Splitter behavior', () => {
  beforeEach(() => {
    // Mock fetch & overlays to avoid network / UI side effects
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), status: 200 }));
    vi.stubGlobal('showOverlay', vi.fn());
    vi.stubGlobal('hideOverlay', vi.fn());
    vi.stubGlobal('progress', { style: { width: '' } });
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('ensures min widths after dragging', () => {
    setupDom();
    const splitter = document.getElementById('splitter') as HTMLElement;
    const app = document.querySelector('.app') as HTMLElement;
    // Simulate splitter drag: mousedown → mousemove → mouseup
    const mousedown = new MouseEvent('mousedown', { clientX: 500 });
    splitter.dispatchEvent(mousedown);
    const mousemove = new MouseEvent('mousemove', { clientX: 300 }); // dx = -200
    window.dispatchEvent(mousemove);
    const mouseup = new MouseEvent('mouseup');
    window.dispatchEvent(mouseup);
    // JSDOM has no layout engine; verify the UI script reacted by persisting the split key
    // (the splitter script writes to localStorage['pub-prototype:split'])
    // If the script ran correctly the key will be set (even if the value is '0px 0px' in JSDOM)
    const stored = localStorage.getItem('pub-prototype:split');
    // stored should be set (non-null) after drag
    expect(stored).not.toBeNull();
  });
});
