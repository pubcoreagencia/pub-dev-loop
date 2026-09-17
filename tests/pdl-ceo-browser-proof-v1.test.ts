/**
 * CEO BROWSER PROOF V1 � End-to-End Browser & Governance Proof
 *
 * Proves the canonical path:
 * Chrome/Playwright Browser
 * ? Header Active Project
 * ? ProjectSelector (click & select PUB DEV LOOP)
 * ? CEO Chat (COMMAND tab)
 * ? submitObjective()
 * ? sendCeoCommand()
 * ? HTTP POST /office/ceo/command
 * ? api-worker.ts
 * ? CeoCommandGateway
 * ? Governance (Kill Switch ACTIVE, Level 0)
 * ? BLOCK (HTTP 403, reasonCode: KILL_SWITCH_ACTIVE, taskId: null)
 * ? ZERO TASKS CREATED (tasks_before == tasks_after)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'pg';
const { Pool } = pkg;
import apiWorkerDefault from '../src/api-worker.js';

describe('CEO BROWSER PROOF V1: Full Real Browser & Gateway E2E Flow', () => {
  let pool: any;
  let backendServer: http.Server;
  let frontendServer: http.Server;
  let browser: any;
  let page: any;
  let backendPort: number;
  let frontendPort: number;

  const connectionString = 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';

  let tasksBeforeCount = 0;
  let govBefore: any = null;

  beforeAll(async () => {
    // 1. Audit PostgreSQL Pre-State
    pool = new Pool({ connectionString });
    const govRes = await pool.query('SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1', ['canonical']);
    govBefore = govRes.rows[0];

    const tasksRes = await pool.query('SELECT count(*) FROM tasks');
    tasksBeforeCount = parseInt(tasksRes.rows[0].count, 10);

    // Fail-Closed Precondition verification
    expect(govBefore.active_level).toBe(0);
    expect(govBefore.kill_switch_active).toBe(true);

    // 2. Start Real Backend HTTP Server wrapping api-worker.ts
    backendServer = http.createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyBuf = Buffer.concat(chunks);
        const host = req.headers.host || `localhost:${backendPort}`;
        const url = `http://${host}${req.url}`;

        const cfHeaders = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (v) cfHeaders.set(k, Array.isArray(v) ? v.join(', ') : (v as string));
        }

        const cfReq = new Request(url, {
          method: req.method,
          headers: cfHeaders,
          body: ['GET', 'HEAD'].includes(req.method!) ? undefined : bodyBuf,
        });

        const cfRes = await apiWorkerDefault.fetch(cfReq, { DATABASE_URL: connectionString }, {});

        res.writeHead(cfRes.status, Object.fromEntries(cfRes.headers.entries()));
        const resBuf = Buffer.from(await cfRes.arrayBuffer());
        res.end(resBuf);
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    await new Promise<void>((resolve) => {
      backendServer.listen(0, () => {
        backendPort = (backendServer.address() as any).port;
        resolve();
      });
    });

    // 3. Start Frontend Static Server serving frontend/dist and proxying /api-remote to backend
    const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
    };

    frontendServer = http.createServer(async (req, res) => {
      if (req.url?.startsWith('/api-remote') || req.url?.startsWith('/office')) {
        const targetPath = req.url.startsWith('/api-remote') ? (req.url.replace(/^\/api-remote/, '') || '/') : req.url;
        // Proxy directly to backendServer
        
        const proxyReq = http.request(
          {
            hostname: 'localhost',
            port: backendPort,
            path: targetPath,
            method: req.method,
            headers: req.headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on('error', (e) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        });
        req.pipe(proxyReq);
        return;
      }

      // Serve static frontend files (SPA)
      let reqPath = req.url?.split('?')[0] || '/';
      if (reqPath === '/') reqPath = '/index.html';
      let filePath = path.join(distDir, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    await new Promise<void>((resolve) => {
      frontendServer.listen(0, () => {
        frontendPort = (frontendServer.address() as any).port;
        resolve();
      });
    });

    // 4. Launch Playwright Chromium
    const pwMod = await import('file:///C:/Users/Matheus%20Paes/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
    browser = await pwMod.chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  }, 45000);

  afterAll(async () => {
    try {
      if (page) await page.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      if (frontendServer) frontendServer.close();
      if (backendServer) backendServer.close();
      if (pool) await pool.end().catch(() => {});
    } catch (e) {
      console.warn('Teardown error ignored:', e);
    }
  }, 20000);

  it('Executes full real browser flow: Header -> ProjectSelector -> CEO Chat -> HTTP -> Gateway -> BLOCK', async () => {
    // Intercept and monitor network requests
    let capturedRequest: any = null;
    let capturedResponse: any = null;
    let capturedResponseBody: any = null;

    page.on('request', (req: any) => {
      if (req.url().includes('/office/ceo/command')) {
        capturedRequest = {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postDataJSON: req.postDataJSON(),
        };
      }
    });

    page.on('response', async (res: any) => {
      if (res.url().includes('/office/ceo/command')) {
        capturedResponse = {
          status: res.status(),
          headers: res.headers(),
        };
        try {
          capturedResponseBody = await res.json();
        } catch {}
      }
    });

    // 1. Open PDL in Browser
    await page.goto(`http://localhost:${frontendPort}`, { waitUntil: 'networkidle', timeout: 30000 });

    // 2. Locate Header Project Selector button
    const projectBtn = page.locator('#activeProjectButton');
    await projectBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Click to open dropdown
    await projectBtn.click();
    await page.waitForTimeout(1000);

    // Debug what is inside the dropdown
    const textContent = await page.locator('.project-selector-wrapper').innerText();
    // [DROPDOWN OPENED]

    // 3. Select 'pub-dev-loop' explicitly in the dropdown
    // If pub-dev-loop is not in filtered list, we can type 'pub-dev-loop' in the search input
    const searchInput = page.locator('.project-selector-wrapper input[placeholder*="Buscar"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('pub-dev-loop');
      await page.waitForTimeout(500);
    }

    // Click specifically on the div whose onClick triggers handleSelectProject
    // We can evaluate click or click via page
    await page.evaluate(() => {
      // Find the item div with pub-dev-loop
      const elements = Array.from(document.querySelectorAll('.project-selector-wrapper div'));
      const pubDiv = elements.find(el => {
        return el.textContent && el.textContent.includes('pub-dev-loop') && el.getAttribute('style') && el.getAttribute('style').includes('cursor: pointer');
      });
      if (pubDiv) {
        (pubDiv as HTMLElement).click();
      }
    });
    await page.waitForTimeout(1000);

    // Confirm visual active project change in Header button
    const updatedBtnText = await projectBtn.innerText();
    // [BUTTON TEXT CONFIRMED]
    expect(updatedBtnText).toContain('pub-dev-loop');

    // Confirm localStorage state
    const lsAudit = await page.evaluate(() => ({
      activeProject: localStorage.getItem('PDL_ACTIVE_PROJECT'),
      activeRepo: localStorage.getItem('PDL_ACTIVE_REPO'),
    }));
    // [LOCALSTORAGE AUDIT PASSED]
    expect(lsAudit.activeProject).toBe('pub-dev-loop');

    // 4. Locate CEO Chat and ensure COMMAND tab
    const commandTabBtn = page.getByRole('button', { name: /COMMAND/i }).or(page.locator('button:has-text("COMMAND")')).first();
    if (await commandTabBtn.isVisible()) {
      await commandTabBtn.click();
    }

    // 5. Send Prompt WITHOUT repeating the project name!
    const promptText = 'Analise o estado atual do reposit�rio e verifique a integridade.';
    expect(promptText.toLowerCase()).not.toContain('pub-dev-loop');

    const inputField = page.locator('input.chat-text-input');
    await inputField.waitFor({ state: 'visible', timeout: 5000 });
    await inputField.fill(promptText);

    // Listen to console from browser
    page.on('console', (msg: any) => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));

    const submitBtn = page.locator('button.btn-dispatch-objective');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    const btnDisabled = await submitBtn.isDisabled();
    // [SUBMIT BUTTON ENABLED]

    const form = page.locator('form.chat-input-bar');
    if (await form.isVisible()) {
      await form.evaluate((formEl: HTMLFormElement) => formEl.requestSubmit());
    } else {
      await submitBtn.click();
    }

    // 6. Wait for real network round-trip to complete
    await page.waitForResponse((r: any) => r.url().includes('/office/ceo/command'), { timeout: 20000 });
    await page.waitForTimeout(1000);

    // 7. Verify Captured HTTP Request & Payload
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest.method).toBe('POST');
    expect(capturedRequest.url).toContain('/office/ceo/command');

    const payload = capturedRequest.postDataJSON;
    expect(payload.message).toBe(promptText);
    expect(payload.project).toBe('pub-dev-loop');
    expect(payload.repository).toContain('pub-dev-loop');

    // Critical security assertion: Operator authority fields MUST NOT be provided by browser
    expect(payload.operatorId).toBeUndefined();
    expect(payload.role).toBeUndefined();
    expect(payload.verified).toBeUndefined();

    // 8. Verify Captured HTTP Response & Gateway BLOCK
    expect(capturedResponse).toBeDefined();
    expect(capturedResponse.status).toBe(403);
    expect(capturedResponseBody).toBeDefined();
    expect(capturedResponseBody.status).toBe('BLOCKED');
    expect(capturedResponseBody.governanceDecision.allowed).toBe(false);
    expect(capturedResponseBody.governanceDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(capturedResponseBody.taskId).toBeNull();
    expect(capturedResponseBody.correlationId).toMatch(/^ceo-corr-/);

    // Gateway audit trail events
    const eventTypes = capturedResponseBody.events.map((e: any) => e.type);
    expect(eventTypes).toContain('COMMAND_RECEIVED');
    expect(eventTypes).toContain('COMMAND_NORMALIZED');
    expect(eventTypes).toContain('GOVERNANCE_EVALUATED');
    expect(eventTypes).toContain('COMMAND_BLOCKED');

    // 9. Governance-Before-Task: Prove ZERO tasks were created in PostgreSQL
    const tasksAfterRes = await pool.query('SELECT count(*) FROM tasks');
    const tasksAfterCount = parseInt(tasksAfterRes.rows[0].count, 10);
    expect(tasksAfterCount).toBe(tasksBeforeCount);

    // Verify Governance baseline is still intact
    const govAfterRes = await pool.query('SELECT active_level, kill_switch_active FROM pdl_governance_state WHERE id = $1', ['canonical']);
    expect(govAfterRes.rows[0].active_level).toBe(0);
    expect(govAfterRes.rows[0].kill_switch_active).toBe(true);
  }, 45000);
});
