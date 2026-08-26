// @vitest-environment jsdom
// UI Sidebar tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTestDom } from './setup';
import { prototypeUiHtml } from '../src/prototype/ui.js';

function setupDom(persisted = false) {
  if (persisted) {
    localStorage.setItem('pub-prototype:sidebar-collapsed', '1');
  }
  initTestDom(prototypeUiHtml());
}

describe('Sidebar behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
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

  it('starts expanded by default', () => {
    setupDom();
    const sidebar = document.getElementById('sidebar');
    expect(sidebar?.classList.contains('collapsed')).toBe(false);
  });

  it('collapses and persists state', () => {
    setupDom();
    const btn = document.getElementById('collapseSidebar');
    const sidebar = document.getElementById('sidebar');
    btn?.click();
    expect(sidebar?.classList.contains('collapsed')).toBe(true);
    expect(localStorage.getItem('pub-prototype:sidebar-collapsed')).toBe('1');
  });

  it('restores collapsed state on reload', () => {
    setupDom(true);
    const sidebar = document.getElementById('sidebar');
    expect(sidebar?.classList.contains('collapsed')).toBe(true);
  });
});
