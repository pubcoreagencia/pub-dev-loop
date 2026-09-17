import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('--- STARTING CEO BROWSER PROOF V1 HARNESS ---');

  // 1. Check PostgreSQL pre-state
  const { default: pkg } = await import('pg');
  const { Pool } = pkg;
  const connectionString = 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';
  const pool = new Pool({ connectionString });

  const govBeforeRes = await pool.query('SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1', ['canonical']);
  const govBefore = govBeforeRes.rows[0];
  console.log('[Postgres Pre-State] Governance:', JSON.stringify(govBefore));

  const tasksBeforeRes = await pool.query('SELECT count(*) FROM tasks');
  const tasksBeforeCount = parseInt(tasksBeforeRes.rows[0].count, 10);
  console.log('[Postgres Pre-State] Tasks Count:', tasksBeforeCount);

  // Assert fail-closed baseline
  if (govBefore.active_level !== 0 || !govBefore.kill_switch_active) {
    throw new Error('PRE-CHECK FAILED: Baseline governance must be Level 0 and Kill Switch ACTIVE');
  }

  // 2. Start Real Backend Bridge for api-worker
  console.log('[Backend] Initializing real api-worker backend bridge...');
  
  const workerPath = path.join(rootDir, 'dist', 'api-worker.js');
  if (!fs.existsSync(workerPath)) {
    throw new Error('dist/api-worker.js not found. Run npm run build first.');
  }
  const mod = await import('file:///' + workerPath.replace(/\\/g, '/'));
  const apiWorker = mod.default;

  const backendServer = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = Buffer.concat(chunks);
      const host = req.headers.host || 'localhost:3001';
      const url = 'http://' + host + req.url;
      
      const cfHeaders = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v) cfHeaders.set(k, Array.isArray(v) ? v.join(', ') : v);
      }

      const cfReq = new Request(url, {
        method: req.method,
        headers: cfHeaders,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyBuf,
      });

      const cfRes = await apiWorker.fetch(cfReq, { DATABASE_URL: connectionString }, {});
      
      res.writeHead(cfRes.status, Object.fromEntries(cfRes.headers.entries()));
      const resBuf = Buffer.from(await cfRes.arrayBuffer());
      res.end(resBuf);
    } catch (err) {
      console.error('[Backend Bridge Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise((resolve) => backendServer.listen(3001, resolve));
  console.log('[Backend Bridge] Real api-worker listening on http://localhost:3001');

  // 3. Launch Vite Dev Server on port 5173 with proxy pointing to localhost:3001
  console.log('[Frontend] Launching Vite development server...');
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: path.join(rootDir, 'frontend'),
    server: {
      port: 5173,
      proxy: {
        '/api-remote': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-remote/, ''),
        },
      },
    },
  });
  await vite.listen();
  console.log('[Frontend] Vite server listening on http://localhost:5173');

  // 4. Launch Playwright Chromium
  console.log('[Browser] Launching real Playwright Chromium browser...');
  const pwMod = await import('file:///C:/Users/Matheus%20Paes/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
  const browser = await pwMod.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Network interception/monitoring
  let capturedRequest = null;
  let capturedResponse = null;
  let capturedResponseBody = null;

  page.on('request', (req) => {
    if (req.url().includes('/office/ceo/command')) {
      console.log('[Network Monitor] Observed Request to /office/ceo/command:');
      console.log('  Method:', req.method());
      console.log('  URL:', req.url());
      console.log('  Headers:', JSON.stringify(req.headers()));
      console.log('  Payload:', req.postData());
      capturedRequest = {
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData(),
        postDataJSON: req.postDataJSON(),
      };
    }
  });

  page.on('response', async (res) => {
    if (res.url().includes('/office/ceo/command')) {
      console.log('[Network Monitor] Observed Response from /office/ceo/command:');
      console.log('  Status:', res.status());
      try {
        const text = await res.text();
        console.log('  Body:', text);
        capturedResponse = {
          status: res.status(),
          headers: res.headers(),
        };
        capturedResponseBody = JSON.parse(text);
      } catch (e) {
        console.warn('  Could not read response text:', e.message);
      }
    }
  });

  try {
    // 5. Navigate to PDL Frontend
    console.log('[Browser] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('[Browser] Page loaded successfully.');

    // 6. Header Interaction: Select Project PUB DEV LOOP
    console.log('[Browser Step 1] Locating Header Project Selector button...');
    const projectBtn = page.locator('#activeProjectButton');
    await projectBtn.waitFor({ state: 'visible', timeout: 10000 });
    
    // Initial active project text
    const initialText = await projectBtn.innerText();
    console.log('[Browser Step 1] Initial Button Text:\n', initialText.trim());

    // Click to open dropdown
    console.log('[Browser Step 2] Clicking Project Selector to open dropdown...');
    await projectBtn.click();
    await page.waitForTimeout(500);

    // Find and click 'pub-dev-loop' in the dropdown
    console.log('[Browser Step 2] Selecting "pub-dev-loop" in project list...');
    const projectItem = page.locator('div').filter({ hasText: /^pub-dev-loop$/ }).first();
    if (await projectItem.isVisible()) {
      await projectItem.click();
    } else {
      await page.getByText('pub-dev-loop', { exact: true }).first().click();
    }
    await page.waitForTimeout(500);

    // Verify Active Project in UI
    const updatedText = await projectBtn.innerText();
    console.log('[Browser Step 3] Active project button updated text:\n', updatedText.trim());

    // Verify Zustand and localStorage in page context
    const stateAudit = await page.evaluate(() => {
      const lsProject = localStorage.getItem('PDL_ACTIVE_PROJECT');
      const lsRepo = localStorage.getItem('PDL_ACTIVE_REPO');
      return { lsProject, lsRepo };
    });
    console.log('[Browser Step 3] LocalStorage state audit:', JSON.stringify(stateAudit));

    // 7. Locate CEO Chat & Ensure COMMAND tab is active
    console.log('[Browser Step 4] Locating CEO Chat & ensuring COMMAND tab is active...');
    const commandTabBtn = page.getByRole('button', { name: /COMMAND/i }).or(page.locator('button:has-text("COMMAND")')).first();
    if (await commandTabBtn.isVisible()) {
      await commandTabBtn.click();
      console.log('[Browser Step 4] COMMAND tab confirmed active.');
    }

    // 8. Type prompt into input (WITHOUT project name!)
    const promptText = 'Analise o estado atual do repositório e verifique a integridade.';
    console.log('[Browser Step 5] Typing directive without project name: "' + promptText + '"');
    
    const inputField = page.locator('input.chat-text-input');
    await inputField.waitFor({ state: 'visible', timeout: 5000 });
    await inputField.fill(promptText);

    // 9. Dispatch Command
    console.log('[Browser Step 6] Clicking DESPACHAR button...');
    const submitBtn = page.locator('button.btn-dispatch-objective');
    await submitBtn.click();

    // 10. Wait for network response
    console.log('[Browser Step 7] Waiting for /office/ceo/command network response...');
    await page.waitForResponse((r) => r.url().includes('/office/ceo/command'), { timeout: 15000 });
    await page.waitForTimeout(1000);

    // 11. Assertions on Network Data
    console.log('\n--- NETWORK CAPTURE VERIFICATION ---');
    if (!capturedRequest) throw new Error('FAIL: No HTTP request captured for /office/ceo/command');
    if (!capturedResponse) throw new Error('FAIL: No HTTP response captured for /office/ceo/command');

    const payload = capturedRequest.postDataJSON;
    console.log('[Verification 1] Captured Payload:', JSON.stringify(payload));
    
    if (payload.project !== 'pub-dev-loop') {
      throw new Error(`FAIL: Payload project is '${payload.project}', expected 'pub-dev-loop'`);
    }
    if (payload.message !== promptText) {
      throw new Error(`FAIL: Payload message does not match prompt text`);
    }
    if (payload.operatorId || payload.role || payload.verified) {
      throw new Error(`FAIL: Browser payload attempts to inject operator authority!`);
    }
    console.log('? Payload accurately carried activeProject="pub-dev-loop" without project name in text.');
    console.log('? Browser did not provide operator authority fields.');

    console.log('[Verification 2] Captured Response Status:', capturedResponse.status);
    console.log('[Verification 2] Captured Response Body:', JSON.stringify(capturedResponseBody));

    if (capturedResponse.status !== 403) {
      throw new Error(`FAIL: HTTP Status is ${capturedResponse.status}, expected 403 (BLOCKED)`);
    }
    if (capturedResponseBody.status !== 'BLOCKED') {
      throw new Error(`FAIL: Response status is '${capturedResponseBody.status}', expected 'BLOCKED'`);
    }
    if (capturedResponseBody.governanceDecision?.reasonCode !== 'KILL_SWITCH_ACTIVE') {
      throw new Error(`FAIL: ReasonCode is '${capturedResponseBody.governanceDecision?.reasonCode}', expected 'KILL_SWITCH_ACTIVE'`);
    }
    if (capturedResponseBody.taskId !== null && capturedResponseBody.taskId !== undefined) {
      throw new Error(`FAIL: Task was created! taskId = ${capturedResponseBody.taskId}`);
    }
    if (!capturedResponseBody.correlationId || !capturedResponseBody.correlationId.startsWith('ceo-corr-')) {
      throw new Error(`FAIL: Invalid correlationId: ${capturedResponseBody.correlationId}`);
    }

    const eventTypes = capturedResponseBody.events?.map((e) => e.type) || [];
    console.log('[Verification 3] Gateway Audit Events:', eventTypes.join(' -> '));
    if (!eventTypes.includes('COMMAND_RECEIVED') ||
        !eventTypes.includes('COMMAND_NORMALIZED') ||
        !eventTypes.includes('GOVERNANCE_EVALUATED') ||
        !eventTypes.includes('COMMAND_BLOCKED')) {
      throw new Error('FAIL: Missing mandatory Gateway audit events in response');
    }
    console.log('? Gateway audit events confirmed: COMMAND_RECEIVED -> COMMAND_NORMALIZED -> GOVERNANCE_EVALUATED -> COMMAND_BLOCKED');

    // 12. Query PostgreSQL Post-State
    console.log('\n--- POSTGRESQL POST-STATE AUDIT ---');
    const tasksAfterRes = await pool.query('SELECT count(*) FROM tasks');
    const tasksAfterCount = parseInt(tasksAfterRes.rows[0].count, 10);
    console.log(`Tasks Count: Before = ${tasksBeforeCount}, After = ${tasksAfterCount}`);

    if (tasksAfterCount !== tasksBeforeCount) {
      throw new Error(`FAIL: Tasks count changed from ${tasksBeforeCount} to ${tasksAfterCount}!`);
    }
    console.log('? ZERO TASKS CREATED IN DATABASE (tasks_before == tasks_after).');

    const govAfterRes = await pool.query('SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1', ['canonical']);
    const govAfter = govAfterRes.rows[0];
    console.log('Governance Post-State:', JSON.stringify(govAfter));

    if (govAfter.active_level !== 0 || !govAfter.kill_switch_active) {
      throw new Error('FAIL: Governance state altered unexpectedly!');
    }
    console.log('? Governance baseline preserved intact (Level 0, Kill Switch ACTIVE).');

    console.log('\n>>> CEO BROWSER PROOF V1: ALL ASSERTIONS PASSED (100% PROVEN) <<<');
  } finally {
    await page.close();
    await browser.close();
    await vite.close();
    await new Promise((resolve) => backendServer.close(resolve));
    await pool.end();
  }
}

main().catch((err) => {
  console.error('\n*** CEO BROWSER PROOF V1 FAILED ***\n', err);
  process.exit(1);
});
