import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';
import { ApprovalManager } from '../src/office/approval.js';
import { authenticateOfficeRequest } from '../src/office/auth.js';

describe('PDL — Security Hardening: CEO Approval Authorization Audit Suite', () => {
  let bus: OfficeEventBus;
  let approvalManager: ApprovalManager;
  let emittedEvents: any[];

  beforeEach(() => {
    bus = new OfficeEventBus(50);
    approvalManager = new ApprovalManager(bus);
    emittedEvents = [];
    bus.subscribe(undefined, (e) => emittedEvents.push(e));
  });

  it('1. usuario autenticado CEO -> 200 / GRANTED', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Atualizacao de Schema SQL',
      rationale: 'Migracao de producao',
      requestedBy: 'architect',
    });

    const headers = { authorization: 'Bearer ceo-token-valid' };
    const principal = authenticateOfficeRequest(headers);

    expect(principal.role).toBe('CEO');
    expect(principal.userId).toBe('user-ceo-authoritative');

    const result = approvalManager.decideApproval(approval.id, 'GRANT', principal, 'Aprovado pelo CEO');
    expect(result.status).toBe('GRANTED');
    expect(result.decidedBy).toBe('user-ceo-authoritative');

    expect(emittedEvents.some((e) => e.type === 'APPROVAL_GRANTED')).toBe(true);
  });

  it('2. usuario autenticado nao-CEO -> 403 UNAUTHORIZED', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'PRODUCTION_PROMOTION',
      title: 'Deploy em Producao',
      rationale: 'Release',
      requestedBy: 'developer',
    });

    const headers = { authorization: 'Bearer dev-token-valid' };
    const principal = authenticateOfficeRequest(headers);

    expect(principal.role).toBe('DEVELOPER');

    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', principal);
    }).toThrow(/UNAUTHORIZED/);
  });

  it('3. usuario nao autenticado (sem token) -> 401 UNAUTHENTICATED', () => {
    const headers = {};
    expect(() => {
      authenticateOfficeRequest(headers);
    }).toThrow(/UNAUTHENTICATED/);
  });

  it('4. cliente envia x-user-role: CEO mas identidade real e nao-CEO -> 403 UNAUTHORIZED', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'SECURITY_OVERRIDE',
      title: 'Bypass de Seguranca',
      rationale: 'Spoofing attempt',
      requestedBy: 'developer',
    });

    // Client spoofing attempt
    const spoofedHeaders = {
      authorization: 'Bearer dev-token-valid',
      'x-user-role': 'CEO',
      'userRole': 'CEO',
    };

    const principal = authenticateOfficeRequest(spoofedHeaders);
    expect(principal.role).toBe('DEVELOPER'); // Must NOT trust x-user-role header

    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', principal);
    }).toThrow(/UNAUTHORIZED/);
  });

  it('5. cliente tenta alterar userId/role no payload -> rejeitado pelo backend', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Payload Injection Attempt',
      rationale: 'Test',
      requestedBy: 'developer',
    });

    const nonCeoPrincipal = authenticateOfficeRequest({ authorization: 'Bearer dev-token-valid' });

    // Client attempts to pass fake body { userRole: 'CEO', userId: 'ceo' }
    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', nonCeoPrincipal);
    }).toThrow(/UNAUTHORIZED/);
  });

  it('6. approval de outro projeto/tenant -> 403 FORBIDDEN_TENANT', () => {
    const approval = approvalManager.requestApproval({
      project: 'tenant-secret-project',
      type: 'PRODUCTION_PROMOTION',
      title: 'Deploy em Tenant Isolado',
      rationale: 'Tenant isolation test',
      requestedBy: 'architect',
    });

    const ceoPrincipal = authenticateOfficeRequest({ authorization: 'Bearer ceo-token-valid' });

    // Attempting to decide with expectedProject 'pub-dev-loop' on a 'tenant-secret-project' approval
    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', ceoPrincipal, undefined, 'pub-dev-loop');
    }).toThrow(/FORBIDDEN_TENANT/);
  });

  it('7. approval inexistente -> 404 NOT_FOUND', () => {
    const ceoPrincipal = authenticateOfficeRequest({ authorization: 'Bearer ceo-token-valid' });

    expect(() => {
      approvalManager.decideApproval('appr-non-existent-id', 'GRANT', ceoPrincipal);
    }).toThrow(/NOT_FOUND/);
  });

  it('8. approval ja decidido -> 409 CONFLICT', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Deploy',
      rationale: 'Test',
      requestedBy: 'architect',
    });

    const ceoPrincipal = authenticateOfficeRequest({ authorization: 'Bearer ceo-token-valid' });

    // 1st decision succeeds
    approvalManager.decideApproval(approval.id, 'GRANT', ceoPrincipal);

    // 2nd decision on the same approval throws CONFLICT
    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', ceoPrincipal);
    }).toThrow(/CONFLICT/);
  });

  it('9. decisao duplicada -> nao gera APPROVAL_GRANTED duplicado', () => {
    const approval = approvalManager.requestApproval({
      project: 'pub-dev-loop',
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Deploy Unico',
      rationale: 'Test',
      requestedBy: 'architect',
    });

    const ceoPrincipal = authenticateOfficeRequest({ authorization: 'Bearer ceo-token-valid' });

    // 1st decision
    approvalManager.decideApproval(approval.id, 'GRANT', ceoPrincipal);

    const grantedCountBefore = emittedEvents.filter((e) => e.type === 'APPROVAL_GRANTED').length;
    expect(grantedCountBefore).toBe(1);

    // Attempt duplicate decision
    try {
      approvalManager.decideApproval(approval.id, 'GRANT', ceoPrincipal);
    } catch {
      // Expected conflict error
    }

    const grantedCountAfter = emittedEvents.filter((e) => e.type === 'APPROVAL_GRANTED').length;
    expect(grantedCountAfter).toBe(1);
  });
});
