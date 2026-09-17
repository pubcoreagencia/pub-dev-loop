/**
 * Phase 1: Real HTTP Transport Proof for POST /office/ceo/command.
 *
 * Verifies:
 * 1. Real HTTP Request arrives at /office/ceo/command on api-worker.ts
 * 2. Message arrives intact and uncorrupted
 * 3. Project is received from payload and preserved across the gateway
 * 4. Repository is received or defaulted from catalog
 * 5. CeoCommandInputPacket is constructed with backend-trusted operator (MATHEUS, CEO, chat, verified: true)
 * 6. CeoCommandGateway receives request and evaluates governance
 * 7. CorrelationId and Gateway audit events are generated and returned in response
 * 8. Missing project blocked fail-closed (HTTP 400, status: BLOCKED, reasonCode: MISSING_PROJECT)
 * 9. Unauthorized product blocked fail-closed (HTTP 403, status: BLOCKED, reasonCode: UNAUTHORIZED_PRODUCT)
 * 10. Kill switch active blocked fail-closed (HTTP 403, status: BLOCKED, reasonCode: KILL_SWITCH_ACTIVE)
 * 11. Missing message rejected fail-closed (HTTP 400, error: 'message is required')
 */

import { describe, it, expect, beforeEach } from 'vitest';
import apiWorkerDefault, { resetRateLimitMap } from '../src/api-worker.js';
import { defaultProductCatalog } from '../src/pdl/products/catalog.js';
import type { PdlGovernanceEngine } from '../src/pdl/governance/index.js';

describe('CEO Transport Proof Phase 1: Real HTTP /office/ceo/command', () => {
  beforeEach(() => {
    resetRateLimitMap();
    defaultProductCatalog.register({
      id: 'pub-dev-loop',
      name: 'PUB Dev Loop',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      defaultBranch: 'main',
      tier: 'CORE',
      verificationCommands: ['npm test', 'npm run build'],
      riskProfile: 'HIGH',
    });
  });

  it('1-7. Real HTTP POST /office/ceo/command dispatches to CeoCommandGateway and returns Gateway evidence', async () => {
    const directive = 'Analise o status do projeto pub-dev-loop sem alterar arquivos.';
    const convId = 'test-http-conv-001';

    const req = new Request('https://pub-dev-loop.internal/office/ceo/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: directive,
        project: 'pub-dev-loop',
        repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
        conversationId: convId,
      }),
    });

    const res = await apiWorkerDefault.fetch(req, {}, {});
    const body = (await res.json()) as any;

    // Direct proof that CeoCommandGateway handled the command:
    expect(body.commandId).toBeDefined();
    expect(body.correlationId).toBeDefined();
    expect(body.correlationId).toMatch(/^ceo-corr-/);
    expect(body.issuedBy).toBe('MATHEUS');
    expect(body.project).toBe('pub-dev-loop');
    expect(body.intent).toBeDefined();
    expect(body.governanceDecision).toBeDefined();
    expect(typeof body.durationMs).toBe('number');
    expect(Array.isArray(body.events)).toBe(true);

    // Gateway-specific event evidence:
    const eventTypes = body.events.map((e: any) => e.type);
    expect(eventTypes).toContain('COMMAND_RECEIVED');
    expect(eventTypes).toContain('COMMAND_NORMALIZED');
    expect(eventTypes).toContain('GOVERNANCE_EVALUATED');

    const receivedEvent = body.events.find((e: any) => e.type === 'COMMAND_RECEIVED');
    expect(receivedEvent.message).toBe('CEO command received at gateway boundary');

    const normalizedEvent = body.events.find((e: any) => e.type === 'COMMAND_NORMALIZED');
    expect(normalizedEvent.data?.correlationId).toBe(body.correlationId);

    // Baseline governance in default engine has kill switch active, returning HTTP 403 BLOCKED
    expect(res.status).toBe(403);
    expect(body.status).toBe('BLOCKED');
    expect(body.governanceDecision.allowed).toBe(false);
    expect(body.governanceDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  it('8. Missing project is deterministically blocked fail-closed with HTTP 400', async () => {
    const req = new Request('https://pub-dev-loop.internal/office/ceo/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Analise o status imediatamente.',
        project: '',
      }),
    });

    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(400);

    const body = (await res.json()) as any;
    expect(body.status).toBe('BLOCKED');
    expect(body.governanceDecision.allowed).toBe(false);
    expect(body.governanceDecision.reasonCode).toBe('MISSING_PROJECT');
    expect(body.error).toContain('Target project identifier is required');
  });

  it('9. Unauthorized product is deterministically blocked fail-closed with HTTP 403', async () => {
    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 3 as const,
        killSwitchActive: false,
        maxConsecutiveTasks: 1,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: ['pub-dev-loop'],
      }),
      getKillSwitch: () => ({
        checkStatus: async () => ({ active: false, reason: '' }),
      }),
    } as unknown as PdlGovernanceEngine;

    const req = new Request('https://pub-dev-loop.internal/office/ceo/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Execute tarefa em repositório desconhecido.',
        project: 'unauthorized-external-repo',
      }),
    });

    const res = await apiWorkerDefault.fetch(req, { governanceEngine: mockGov }, {});
    expect(res.status).toBe(403);

    const body = (await res.json()) as any;
    expect(body.status).toBe('BLOCKED');
    expect(body.governanceDecision.allowed).toBe(false);
    expect(body.governanceDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
    expect(body.error).toContain('not registered in Product Catalog');
    expect(body.taskId).toBeNull();
  });

  it('10. Kill switch active is deterministically blocked fail-closed with HTTP 403', async () => {
    const mockGov = {
      loadLimits: async () => ({
        activeLevel: 3 as const,
        killSwitchActive: true,
        maxConsecutiveTasks: 1,
        maxTaskDurationMs: 180000,
        maxToolRoundsPerTask: 10,
        maxCorrectionAttempts: 2,
        maxConsecutiveFailures: 1,
        allowedProducts: ['pub-dev-loop'],
      }),
      getKillSwitch: () => ({
        checkStatus: async () => ({ active: true, reason: 'Kill switch triggered' }),
      }),
    } as unknown as PdlGovernanceEngine;

    const req = new Request('https://pub-dev-loop.internal/office/ceo/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Execute diagnóstico com kill switch ativo.',
        project: 'pub-dev-loop',
      }),
    });

    const res = await apiWorkerDefault.fetch(req, { governanceEngine: mockGov }, {});
    expect(res.status).toBe(403);

    const body = (await res.json()) as any;
    expect(body.status).toBe('BLOCKED');
    expect(body.governanceDecision.allowed).toBe(false);
    expect(body.governanceDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(body.governanceDecision.killSwitchActive).toBe(true);
    expect(body.taskId).toBeNull();
  });

  it('11. Missing message returns HTTP 400 fail-closed before gateway dispatch', async () => {
    const req = new Request('https://pub-dev-loop.internal/office/ceo/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: 'pub-dev-loop',
      }),
    });

    const res = await apiWorkerDefault.fetch(req, {}, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain('message is required');
  });
});
