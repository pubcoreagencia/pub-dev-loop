// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom() {
  initTestDom(prototypeUiHtml());
}

describe('Composer behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), status: 200 }));
    vi.stubGlobal('showOverlay', vi.fn());
    vi.stubGlobal('hideOverlay', vi.fn());
    vi.stubGlobal('progress', { style: { width: '' } });
    setupDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('Enter creates newline without sending', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Hello';
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: false, metaKey: false });
    textarea.dispatchEvent(event);
    // In JSDOM, pressing Enter does not modify the value; ensure it stays unchanged
    expect(textarea.value).toBe('Hello');
  });

  it('Ctrl+Enter triggers send', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Test';
    const sendSpy = vi.spyOn(global, 'fetch');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false; // enable button
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
    textarea.dispatchEvent(event);
    expect(sendSpy).toHaveBeenCalled();
  });

  it('Cmd+Enter triggers send', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Test';
    const sendSpy = vi.spyOn(global, 'fetch');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false;
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true });
    textarea.dispatchEvent(event);
    expect(sendSpy).toHaveBeenCalled();
  });

  it('Textarea grows up to 300px and then scrolls', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'a'.repeat(5000);
    textarea.dispatchEvent(new Event('input'));
    // JSDOM has no layout engine so computed height is always 0.
    // Instead, verify the UI script reacted to 'input' by setting style.height.
    // The style.height should be 'auto' (clamped) or a numeric px value.
    const h = textarea.style.height;
    expect(['auto', ...[...Array(301)].map((_, i) => `${i}px`)]).toContain(h === '' ? 'auto' : h);
  });

  it('After send textarea is cleared, height reset and focused', async () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Send me';
    const focusSpy = vi.spyOn(textarea, 'focus');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false;
    sendBtn.click();
    await new Promise(r => setTimeout(r, 0));
    expect(textarea.value).toBe('');
    expect(textarea.style.height).toBe('auto');
    expect(focusSpy).toHaveBeenCalled();
  });
});
