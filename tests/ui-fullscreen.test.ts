// @vitest-environment jsdom
// UI Fullscreen tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom(withFullscreen = false) {
  initTestDom(prototypeUiHtml());
  const preview = document.getElementById('preview') as HTMLElement;
  if (!withFullscreen) {
    (preview as any).requestFullscreen = undefined;
    (preview as any).webkitRequestFullscreen = undefined;
  }
}

describe('Fullscreen behavior', () => {
  beforeEach(() => {
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

  it('shows toast when Fullscreen API unavailable', () => {
    setupDom(false);
    const btn = document.getElementById('fullscreen') as HTMLElement;
    btn.click();
    // The toast is a dynamically created element with class 'processing-overlay'
    const toasts = document.querySelectorAll('.processing-overlay');
    const toastWithMessage = Array.from(toasts).find(t => t.textContent?.includes('Fullscreen API não suportada'));
    expect(toastWithMessage).toBeTruthy();
    expect(toastWithMessage?.textContent).toContain('Fullscreen API não suportada');
  });

  it('calls requestFullscreen when available', () => {
    setupDom(true);
    const preview = document.getElementById('preview') as any;
    const requestMock = vi.fn().mockResolvedValue(undefined);
    preview.requestFullscreen = requestMock;
    const btn = document.getElementById('fullscreen') as HTMLElement;
    btn.click();
    expect(requestMock).toHaveBeenCalled();
  });
});
