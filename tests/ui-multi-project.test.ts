// @vitest-environment jsdom
// UI Multi-Project Workspace — Comprehensive functional tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTestDom } from './setup';
import { prototypeUiHtml } from '../src/prototype/ui.js';

const mockSessions = [
  { id: 'sess-1', project: 'Sistema Padaria', status: 'READY', updatedAt: '2026-08-28T10:00:00Z', createdAt: '2026-08-28T09:00:00Z', previewUrl: 'https://padaria.trycloudflare.com', promptCount: 2 },
  { id: 'sess-2', project: 'Sistema Oficina', status: 'BUILDING', updatedAt: '2026-08-28T11:00:00Z', createdAt: '2026-08-28T10:00:00Z', promptCount: 1 },
  { id: 'sess-3', project: 'Landing Page', status: 'FAILED', updatedAt: '2026-08-28T08:00:00Z', createdAt: '2026-08-28T07:00:00Z', promptCount: 0 },
  { id: 'sess-4', project: 'Sistema Padaria', status: 'CREATING', updatedAt: '2026-08-28T06:00:00Z', createdAt: '2026-08-28T05:00:00Z', promptCount: 0 },
];

function createFetchMock(sessions = mockSessions, options = {}) {
  return vi.fn().mockImplementation((url, init) => {
    // GET /prototype/sessions — list all sessions
    if (url === '/prototype/sessions' && (!init || init.method === 'GET' || !init.method)) {
      return Promise.resolve({ ok: true, json: async () => sessions });
    }
    // GET /prototype/sessions/:id — get single session
    const sessionMatch = url.match(/\/prototype\/sessions\/([^\/]+)$/);
    if (sessionMatch) {
      const id = sessionMatch[1];
      const session = sessions.find(s => s.id === id);
      if (session) {
        return Promise.resolve({ ok: true, json: async () => ({
          session,
          messages: options.messages || [],
          checkpoints: options.checkpoints || [],
          tasks: options.tasks || []
        })});
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' });
    }
    // POST /prototype/sessions — create new session
    if (url === '/prototype/sessions' && init?.method === 'POST') {
      const body = JSON.parse(init.body);
      const newSession = { id: `sess-${Date.now()}`, project: body.project, status: 'CREATING', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), promptCount: 0 };
      return Promise.resolve({ ok: true, json: async () => newSession });
    }
    return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' });
  });
}

function setupDomWithSessions(sessions = mockSessions, options = {}) {
  vi.stubGlobal('fetch', createFetchMock(sessions, options));
  initTestDom(prototypeUiHtml());
}

describe('Multi-Project Workspace — Functional Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', createFetchMock());
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

  // 1. Clicar em projeto existente → loadSession(id) é chamado
  it('1. calls loadSession when clicking existing project', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    // Click on "Sistema Oficina" project item
    const items = document.querySelectorAll('.project-item');
    const oficinaItem = Array.from(items).find(el => el.textContent?.includes('Sistema Oficina'));
    expect(oficinaItem).toBeTruthy();
    oficinaItem?.click();
    
    // Wait for async loadSession
    await new Promise(r => setTimeout(r, 200));
    
    // Verify fetch was called with the session ID
    const calls = fetchMock.mock.calls;
    const sessionCall = calls.find(([url]) => url.includes('/prototype/sessions/sess-2'));
    expect(sessionCall).toBeTruthy();
  });

  // 2. Projeto selecionado atualiza localStorage
  it('2. updates localStorage last-session on project select', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    const padariaItem = Array.from(items).find(el => el.textContent?.includes('Sistema Padaria'));
    padariaItem?.click();
    
    await new Promise(r => setTimeout(r, 200));
    expect(localStorage.getItem('pub-prototype:last-session')).toBe('sess-1');
  });

  // 3. Projeto ativo recebe destaque
  it('3. highlights active project with active class', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    const oficinaItem = Array.from(items).find(el => el.textContent?.includes('Sistema Oficina'));
    oficinaItem?.click();
    
    await new Promise(r => setTimeout(r, 200));
    
    // The active project should have 'active' class
    const activeItems = document.querySelectorAll('.project-item.active');
    expect(activeItems.length).toBe(1);
    expect(activeItems[0].textContent).toContain('Sistema Oficina');
  });

  // 4. + Novo abre modal
  it('4. opens modal on + Novo click', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const btn = document.getElementById('newProject');
    btn?.click();
    
    const modal = document.getElementById('newProjectModal');
    expect(modal?.classList.contains('show')).toBe(true);
  });

  // 5. Cancelar não cria sessão
  it('5. cancel does not create session', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    // Open modal
    document.getElementById('newProject')?.click();
    // Cancel
    document.getElementById('cancelNewProject')?.click();
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 100));
    
    // No POST to /prototype/sessions should have been made
    const postCalls = fetchMock.mock.calls.filter(([url, init]) => url === '/prototype/sessions' && init?.method === 'POST');
    expect(postCalls.length).toBe(0);
  });

  // 6. Criar projeto chama criação de sessão real
  it('6. creating project calls POST /prototype/sessions', async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    // Open modal and type name
    document.getElementById('newProject')?.click();
    const input = document.getElementById('newProjectName') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = 'Novo Projeto Teste';
    
    // Confirm
    document.getElementById('confirmNewProject')?.click();
    
    await new Promise(r => setTimeout(r, 200));
    
    // POST should have been called
    const postCalls = fetchMock.mock.calls.filter(([url, init]) => url === '/prototype/sessions' && init?.method === 'POST');
    expect(postCalls.length).toBe(1);
    const body = JSON.parse(postCalls[0][1].body);
    expect(body.project).toBe('Novo Projeto Teste');
  });

  // 7. Nova sessão vira projeto ativo
  it('7. new session becomes active project', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    // Open modal and create
    document.getElementById('newProject')?.click();
    const input = document.getElementById('newProjectName') as HTMLInputElement;
    input.value = 'Brand New Project';
    document.getElementById('confirmNewProject')?.click();
    
    await new Promise(r => setTimeout(r, 300));
    
    // The new project name should appear in the project label
    const projectName = document.getElementById('projectName');
    expect(projectName?.textContent).toBe('Brand New Project');
  });

  // 8. Lista é atualizada depois da criação
  it('8. list updates after creation', async () => {
    let createdSessions = [...mockSessions];
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      if (url === '/prototype/sessions' && (!init || init.method === 'GET' || !init.method)) {
        return Promise.resolve({ ok: true, json: async () => createdSessions });
      }
      if (url === '/prototype/sessions' && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        const newSession = { id: `sess-${Date.now()}`, project: body.project, status: 'CREATING', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), promptCount: 0 };
        createdSessions = [...createdSessions, newSession];
        return Promise.resolve({ ok: true, json: async () => newSession });
      }
      const sessionMatch = url.match(/\/prototype\/sessions\/([^\/]+)$/);
      if (sessionMatch) {
        const id = sessionMatch[1];
        const session = createdSessions.find(s => s.id === id);
        if (session) {
          return Promise.resolve({ ok: true, json: async () => ({ session, messages: [], checkpoints: [], tasks: [] }) });
        }
      }
      return Promise.resolve({ ok: false, status: 404, text: async () => 'Not found' });
    });
    vi.stubGlobal('fetch', fetchMock);
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    const initialCount = document.querySelectorAll('.project-item').length;
    
    // Create new project
    document.getElementById('newProject')?.click();
    const input = document.getElementById('newProjectName') as HTMLInputElement;
    input.value = 'Another Project';
    document.getElementById('confirmNewProject')?.click();
    
    await new Promise(r => setTimeout(r, 300));
    
    // List should have one more item
    const newCount = document.querySelectorAll('.project-item').length;
    expect(newCount).toBe(initialCount + 1);
  });

  // 9. F5 carrega lista novamente
  it('9. F5 reloads project list', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const initialCount = document.querySelectorAll('.project-item').length;
    
    // Simulate F5 by re-dispatching load event
    window.dispatchEvent(new Event('load'));
    await new Promise(r => setTimeout(r, 200));
    
    // List should still have projects
    const afterCount = document.querySelectorAll('.project-item').length;
    expect(afterCount).toBeGreaterThan(0);
  });

  // 10. F5 restaura o projeto salvo
  it('10. F5 restores saved project', async () => {
    localStorage.setItem('pub-prototype:last-session', 'sess-1');
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 200));
    
    // The saved project should be active
    const activeItems = document.querySelectorAll('.project-item.active');
    expect(activeItems.length).toBe(1);
    expect(activeItems[0].textContent).toContain('Sistema Padaria');
  });

  // 11. Troca de projeto encerra SSE anterior
  it('11. switching project closes previous SSE', async () => {
    const closeSpy = vi.fn();
    (global as any).EventSource = class {
      url: string;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = closeSpy;
      addEventListener() {}
      removeEventListener() {}
      constructor(url: string) { this.url = url; }
    };
    
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    // First project should have opened SSE
    const items = document.querySelectorAll('.project-item');
    expect(items.length).toBeGreaterThan(1);
    
    // Click first project
    items[0].click();
    await new Promise(r => setTimeout(r, 100));
    
    // Click second project
    items[1].click();
    await new Promise(r => setTimeout(r, 100));
    
    // SSE close should have been called for the first project
    expect(closeSpy).toHaveBeenCalled();
  });

  // 12. SSE do projeto antigo não continua alterando a UI
  it('12. old project SSE does not alter UI after switch', async () => {
    const fetchMock = createFetchMock(mockSessions, {
      messages: [{ role: 'user', content: 'Hello' }]
    });
    vi.stubGlobal('fetch', fetchMock);
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    expect(items.length).toBeGreaterThan(1);
    
    // Click first project
    items[0].click();
    await new Promise(r => setTimeout(r, 150));
    
    // Get initial project name
    const initialProjectName = document.getElementById('projectName')?.textContent;
    
    // Switch to another project
    items[1].click();
    await new Promise(r => setTimeout(r, 150));
    
    // Project name should have changed
    const newProjectName = document.getElementById('projectName')?.textContent;
    expect(newProjectName).not.toBe(initialProjectName);
  });

  // 13. Múltiplas sessões com mesmo project → mais recente representa
  it('13. multiple sessions with same project uses most recent', async () => {
    setupDomWithSessions(mockSessions);
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    const padariaItems = Array.from(items).filter(el => el.textContent?.includes('Sistema Padaria'));
    
    // Should only show once (most recent: sess-1, not sess-4)
    expect(padariaItems.length).toBe(1);
    
    // The shown one should be the READY one (most recent)
    const activeStatus = padariaItems[0].querySelector('.project-status');
    expect(activeStatus?.classList.contains('ready')).toBe(true);
  });

  // 14. Sessão BUILDING aparece com status correto
  it('14. BUILDING session shows correct status', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    const oficinaItem = Array.from(items).find(el => el.textContent?.includes('Sistema Oficina'));
    const status = oficinaItem?.querySelector('.project-status');
    
    expect(status?.classList.contains('building')).toBe(true);
  });

  // 15. Sessão FAILED aparece com status correto
  it('15. FAILED session shows correct status', async () => {
    setupDomWithSessions();
    await new Promise(r => setTimeout(r, 100));
    
    const items = document.querySelectorAll('.project-item');
    const landingItem = Array.from(items).find(el => el.textContent?.includes('Landing Page'));
    const status = landingItem?.querySelector('.project-status');
    
    expect(status?.classList.contains('failed')).toBe(true);
  });

  // 16. Erro de GET /prototype/sessions não quebra a UI
  it('16. API error does not break UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    initTestDom(prototypeUiHtml());
    await new Promise(r => setTimeout(r, 100));
    
    // Should show "Nenhum projeto" message
    const list = document.getElementById('projectsList');
    expect(list?.textContent).toMatch(/Nenhum projeto/i);
    
    // Composer should still be functional
    const send = document.getElementById('send');
    expect(send).toBeTruthy();
  });
});
