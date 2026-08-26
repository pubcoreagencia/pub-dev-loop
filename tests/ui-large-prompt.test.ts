// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom() {
  initTestDom(prototypeUiHtml());
}

describe('Large prompt handling', () => {
  beforeEach(() => {
    // Stub network calls
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

  const sizes = [500, 2000, 10000, 20000];

  for (const sz of sizes) {
    it(`accepts prompt of ${sz} characters without breaking layout`, async () => {
      const textarea = document.getElementById('prompt') as HTMLTextAreaElement;
      const longText = 'x'.repeat(sz);
      textarea.value = longText;
      // trigger input to resize
      textarea.dispatchEvent(new Event('input'));
      const height = parseInt(textarea.style.height);
      expect(height).toBeLessThanOrEqual(300);
      // send the prompt
      // trigger send via button click
      const sendBtn = document.getElementById('send') as HTMLElement;
      (sendBtn as any).disabled = false;
      sendBtn.click();
      // wait for UI update
      await new Promise(r => setTimeout(r, 0));
      // message should be rendered in chat
      const chat = document.getElementById('chat');
      const chatText = chat?.textContent ?? '';
      expect(chatText).toContain(longText.slice(0, 30)); // part of it appears
    });
  }
});
