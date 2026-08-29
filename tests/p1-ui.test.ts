import { describe, it, expect } from 'vitest';
import { prototypeUiHtml } from '../src/prototype/ui.js';

describe('P1 UI — Empty States', () => {
  const html = prototypeUiHtml();

  it('renders the empty preview state', () => {
    expect(html).toContain('preview-empty');
    expect(html).toContain('Aguardando projeto');
  });

  it('renders the empty chat state structure', () => {
    expect(html).toContain('empty-chat');
  });

  it('renders example prompts in empty state', () => {
    expect(html).toContain('empty-chat-example');
  });

  it('has the preview status pill', () => {
    expect(html).toContain('preview-status');
    expect(html).toContain('previewStatusLabel');
  });
});

describe('P1 UI — Preview States', () => {
  const html = prototypeUiHtml();

  it('has loading state', () => {
    expect(html).toContain('preview-loading');
    expect(html).toContain('previewLoadingText');
  });

  it('has error state with retry button', () => {
    expect(html).toContain('preview-error');
    expect(html).toContain('previewErrorRetry');
    expect(html).toContain('Reconectar preview');
  });

  it('has iframe element', () => {
    expect(html).toContain('<iframe');
    expect(html).toContain('id="iframe"');
  });

  it('has preview controls (refresh, open, fullscreen, mobile)', () => {
    expect(html).toContain('id="refresh"');
    expect(html).toContain('id="open"');
    expect(html).toContain('id="fullscreen"');
    expect(html).toContain('id="mobilePreviewBtn"');
  });
});

describe('P1 UI — Composer', () => {
  const html = prototypeUiHtml();

  it('has composer with send button', () => {
    expect(html).toContain('id="prompt"');
    expect(html).toContain('id="send"');
    expect(html).toContain('Enviar');
  });

  it('shows keyboard shortcuts', () => {
    expect(html).toContain('kbd');
    expect(html).toContain('Enter');
    expect(html).toContain('Shift+Enter');
  });

  it('has placeholder text', () => {
    expect(html).toContain('Descreva o que você quer construir');
  });
});

describe('P1 UI — Sidebar / Multi-Project', () => {
  const html = prototypeUiHtml();

  it('has projects list', () => {
    expect(html).toContain('projectsList');
    expect(html).toContain('project-item');
  });

  it('has new project button', () => {
    expect(html).toContain('id="newProject"');
    expect(html).toContain('Novo');
  });

  it('has new project modal', () => {
    expect(html).toContain('newProjectModal');
    expect(html).toContain('newProjectName');
    expect(html).toContain('confirmNewProject');
  });

  it('has collapse sidebar button', () => {
    expect(html).toContain('collapseSidebar');
  });
});

describe('P1 UI — Error Cards', () => {
  const html = prototypeUiHtml();

  it('has error card structure', () => {
    expect(html).toContain('error-card');
    expect(html).toContain('error-card-title');
    expect(html).toContain('error-card-desc');
  });

  it('has error card action button', () => {
    expect(html).toContain('error-card-action');
  });

  it('has expandable error details', () => {
    expect(html).toContain('error-card-details');
  });
});

describe('P1 UI — Timeline', () => {
  const html = prototypeUiHtml();

  it('has timeline structure', () => {
    expect(html).toContain('timeline-step');
  });

  it('has files changed section', () => {
    expect(html).toContain('files-changed');
    expect(html).toContain('files-changed-file');
  });
});

describe('P1 UI — Mobile', () => {
  const html = prototypeUiHtml();

  it('has mobile preview button', () => {
    expect(html).toContain('mobilePreviewShowBtn');
  });

  it('has mobile back button', () => {
    expect(html).toContain('mobileBackBtn');
  });

  it('has mobile view CSS class', () => {
    expect(html).toContain('mobile-view');
    expect(html).toContain('preview-mode');
  });
});

describe('P1 UI — Design Tokens', () => {
  const html = prototypeUiHtml();

  it('uses Inter font', () => {
    expect(html).toContain('Inter');
  });

  it('uses JetBrains Mono for code', () => {
    expect(html).toContain('JetBrains Mono');
  });

  it('has dark color scheme', () => {
    expect(html).toContain('color-scheme:dark');
  });

  it('has CSS custom properties for design tokens', () => {
    expect(html).toContain('--bg-base');
    expect(html).toContain('--text-primary');
    expect(html).toContain('--accent');
    expect(html).toContain('--success');
    expect(html).toContain('--danger');
  });
});
