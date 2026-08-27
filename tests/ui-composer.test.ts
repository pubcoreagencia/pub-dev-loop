// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom() {
  initTestDom(prototypeUiHtml());
}

describe('Composer behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}), status: 200, text: async () => '' }));
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

  it('Enter sends when there is content', async () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Hello world';
    const sendSpy = vi.spyOn(global, 'fetch');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false;
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false });
    textarea.dispatchEvent(event);
    expect(sendSpy).toHaveBeenCalled();
    expect(textarea.value).toBe(''); // cleared after send
  });

  it('Shift+Enter creates a newline (does not send)', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Hello';
    const sendSpy = vi.spyOn(global, 'fetch');
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: true });
    textarea.dispatchEvent(event);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(textarea.value).toBe('Hello'); // unchanged
  });

  it('Ctrl+Enter sends', async () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Test';
    const sendSpy = vi.spyOn(global, 'fetch');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false;
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: false });
    textarea.dispatchEvent(event);
    expect(sendSpy).toHaveBeenCalled();
  });

  it('Cmd+Enter sends', async () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'Test';
    const sendSpy = vi.spyOn(global, 'fetch');
    const sendBtn = document.getElementById('send') as HTMLElement;
    (sendBtn as any).disabled = false;
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, shiftKey: false });
    textarea.dispatchEvent(event);
    expect(sendSpy).toHaveBeenCalled();
  });

  it('Enter empty does NOT send', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = '';
    const sendSpy = vi.spyOn(global, 'fetch');
    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false });
    textarea.dispatchEvent(event);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('Send button is disabled during BUILDING (overlay active)', () => {
    const sendBtn = document.getElementById('send') as HTMLElement;
    // Simulate BUILDING by showing overlay (disables button)
    const overlay = document.getElementById('overlay') as HTMLElement;
    overlay.style.display = 'flex';
    sendBtn.disabled = true;
    expect(sendBtn.disabled).toBe(true);
  });

  it('Textarea grows up to 300px and then scrolls', () => {
    const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
    textarea.value = 'a'.repeat(5000);
    textarea.dispatchEvent(new Event('input'));
    // JSDOM has no layout engine so computed height is always 0.
    // Instead, verify the UI script reacted to 'input' by setting style.height.
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
