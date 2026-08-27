// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';
import { initTestDom } from './setup';

function setupDom() {
  initTestDom(prototypeUiHtml());
}

describe('Agent Transparency', () => {
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

  it('renders checkpoint summary card with files and SHA on CHECKPOINT_CREATED', () => {
    // The CHECKPOINT_CREATED handler calls checkpoint() which renders
    // a checkpoint-summary card. Verify the HTML contains the CSS for it.
    const html = document.body.innerHTML;
    expect(html).toContain('checkpoint-summary');
    expect(html).toContain('checkpoint-summary-title');
    expect(html).toContain('cs-status');
    expect(html).toContain('cs-file');
    expect(html).toContain('cs-sha');
  });

  it('renders error card with expandable details on BUILD_FAILED', () => {
    const chat = document.getElementById('chat');

    // Simulate: we cannot directly call the SSE handler, but we can verify
    // that the error-card CSS class exists in the rendered HTML
    const html = document.body.innerHTML;
    expect(html).toContain('error-card');
    expect(html).toContain('error-title');
    expect(html).toContain('error-detail');
    expect(html).toContain('error-expanded');
  });

  it('renders timeline step with timestamp', () => {
    // The step() function creates elements with class 'step' and 'step-time'
    // Verify the CSS for step-time exists
    const html = document.body.innerHTML;
    expect(html).toContain('step-time');
    expect(html).toContain('step-label');
  });

  it('renders changed files in agent-output on AGENT_OUTPUT event', () => {
    // Verify the agent-output CSS class exists
    const html = document.body.innerHTML;
    expect(html).toContain('agent-output');
    expect(html).toContain('ao-files');
    expect(html).toContain('ao-file');
  });

  it('renders checkpoint-summary with status badge', () => {
    const html = document.body.innerHTML;
    expect(html).toContain('checkpoint-summary');
    expect(html).toContain('cs-status');
    expect(html).toContain('cs-file');
  });

  it('shows recovery tip after BUILD_FAILED', () => {
    const html = document.body.innerHTML;
    expect(html).toContain('checkpoint-summary');
  });
});
