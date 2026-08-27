// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom() {
  initTestDom(prototypeUiHtml());
}

describe('Error cards and timestamps', () => {
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

  it('renders error-card CSS classes in HTML output', () => {
    const html = document.body.innerHTML;
    // The HTML template includes error-card styles
    expect(html).toContain('error-card');
    expect(html).toContain('error-title');
    expect(html).toContain('error-msg');
    expect(html).toContain('error-detail');
    expect(html).toContain('error-expanded');
  });

  it('renders step-time class for timestamps in timeline', () => {
    const html = document.body.innerHTML;
    expect(html).toContain('step-time');
  });

  it('renders msg-time class for message timestamps', () => {
    const html = document.body.innerHTML;
    expect(html).toContain('msg-time');
  });

  it('formatTime function exists in the inline script', () => {
    const html = document.body.innerHTML;
    expect(html).toContain('function formatTime');
  });

  it('error-detail has click handler for expanding', () => {
    // The UI code includes the onclick handler for expanding error details
    const html = document.body.innerHTML;
    expect(html).toContain('error-expanded');
    expect(html).toContain("classList.toggle('expanded')");
  });
});
