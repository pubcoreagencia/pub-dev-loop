import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeTaskIntake } from '../src/task/intake.js';
import { PdlRepositoryInspector } from '../src/pdl/research/repository-inspector.js';
import { PdlDocumentationLookup } from '../src/pdl/research/documentation-lookup.js';
import { PdlSkillDiscovery } from '../src/pdl/research/skill-discovery.js';
import { PdlContextSource } from '../src/pdl/research/context-source.js';
import { PdlPreflightEngine } from '../src/pdl/research/preflight-engine.js';
import { TaskIntakeService } from '../src/pdl/service/task-intake-service.js';
import { DailySkillEngine } from '../src/office/skills.js';

describe('Gate 3D.1 — Bounded Context Discovery & Preflight Engine', () => {
  const baseIntake = normalizeTaskIntake({
    rawRequest: 'Implement user auth endpoints with JWT validation',
    source: 'pdl-api-test',
    createdAt: new Date().toISOString(),
  });

  describe('PdlRepositoryInspector', () => {
    it('inspects current workspace and extracts package & toolchain findings', async () => {
      const inspector = new PdlRepositoryInspector({ workspaceRoot: process.cwd() });
      const dummyBundle: any = { version: '1.0.0' };
      const findings = await inspector.inspect(baseIntake, dummyBundle);

      expect(findings.length).toBeGreaterThan(0);
      const pkgNameFinding = findings.find((f) => f.key === 'package:name');
      expect(pkgNameFinding).toBeDefined();
      expect(pkgNameFinding?.value).toBe('pub-dev-loop');
      expect(pkgNameFinding?.confidence).toBe('HIGH');

      const testCommandFinding = findings.find((f) => f.key === 'test:command');
      expect(testCommandFinding).toBeDefined();
      expect(testCommandFinding?.confidence).toBe('HIGH');
    });
  });

  describe('PdlDocumentationLookup', () => {
    it('discovers project README and docs references', async () => {
      const lookup = new PdlDocumentationLookup({ workspaceRoot: process.cwd() });
      const references = lookup.discoverReferences();

      expect(references.length).toBeGreaterThan(0);
      const readme = references.find((r) => r.path === 'README.md');
      expect(readme).toBeDefined();

      const dummyBundle: any = { version: '1.0.0' };
      const findings = await lookup.lookup(baseIntake, dummyBundle);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe('DOCUMENTATION_LOOKUP');
    });
  });

  describe('PdlSkillDiscovery', () => {
    let skillEngine: DailySkillEngine;

    beforeEach(() => {
      skillEngine = new DailySkillEngine();
      skillEngine.registerSkill({
        id: 'skill-jwt-validation',
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        name: 'JWT Auth Standard',
        description: 'Enforce JWT bearer token validation',
        capability: 'SECURITY_ENFORCEMENT',
        sourceExperiences: [],
        confidence: 'HIGH',
        version: 1,
        applicableRoles: ['developer', 'architect'],
        applicableContexts: ['PROJECT'],
        limitations: [],
        executableGuideline: 'Validate HMAC SHA-256 signature on Authorization header',
        status: 'ACTIVE',
        provenance: {
          tenantId: 'pub-dev-loop',
          projectId: 'pub-dev-loop',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    });

    it('queries active daily skills matching project and role', async () => {
      const discovery = new PdlSkillDiscovery({
        skillEngine,
        projectId: 'pub-dev-loop',
        agentRole: 'developer',
      });
      const dummyBundle: any = { version: '1.0.0' };
      const findings = await discovery.discover(baseIntake, dummyBundle);

      expect(findings.length).toBeGreaterThan(0);
      const skillFinding = findings.find((f) => f.key === 'skill:SECURITY_ENFORCEMENT');
      expect(skillFinding).toBeDefined();
      expect(skillFinding?.value).toContain('JWT Auth Standard');
      expect(skillFinding?.confidence).toBe('HIGH');
    });
  });

  describe('PdlContextSource & BoundedContextDiscovery', () => {
    it('generates authoritative, repository, operational, and documentation facts', async () => {
      const source = new PdlContextSource({
        project: 'pub-dev-loop',
        repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      });

      const authFacts = await source.getAuthoritativeContext(baseIntake);
      expect(authFacts.some((f) => f.key === 'project' && f.value === 'pub-dev-loop')).toBe(true);

      const repoFacts = await source.getRepositoryContext(baseIntake);
      expect(repoFacts.some((f) => f.key === 'repository')).toBe(true);

      const docRefs = await source.getRelevantDocumentation(baseIntake);
      expect(docRefs.length).toBeGreaterThan(0);
    });
  });

  describe('PdlPreflightEngine', () => {
    it('executes discovery and preflight research, enriching context bundle', async () => {
      const engine = new PdlPreflightEngine({
        project: 'pub-dev-loop',
        workspaceRoot: process.cwd(),
      });

      const result = await engine.run(baseIntake);

      expect(result.context).toBeDefined();
      expect(result.preflight).toBeDefined();
      expect(result.preflight.status).toBe('COMPLETED');
      expect(result.preflight.gateStatus).toBe('READY');

      // ContextBundle should have relevant documentation from preflight
      expect(result.context.relevantDocumentation.length).toBeGreaterThan(0);

      // ContextBundle should have operational findings
      expect(result.context.operationalContext.length).toBeGreaterThan(0);
    });
  });

  describe('TaskIntakeService Integration with Preflight', () => {
    it('enriches the sealed ExecutionSpec with preflight research facts', async () => {
      let createdSpec: any = null;
      let sealedSpec: any = null;

      // Mock database client for atomic intake
      const mockPool: any = {
        connect: async () => ({
          query: async (sql: string, params?: unknown[]) => {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rows: [] };
            }
            if (sql.includes('INSERT INTO tasks')) {
              return {
                rows: [
                  {
                    id: 'task-test-3d1',
                    project: params?.[0],
                    repository: params?.[1],
                    objective: params?.[2],
                    prompt: params?.[3],
                    priority: params?.[4],
                    status: 'QUEUED',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                ],
              };
            }
            if (sql.includes('SELECT status FROM execution_specs')) {
              return {
                rows: [{ status: 'UNSEALED' }],
              };
            }
            if (sql.includes('SELECT * FROM execution_specs WHERE task_id')) {
              if (createdSpec) {
                return {
                  rows: [
                    {
                      id: 'spec-test-draft',
                      task_id: params?.[0],
                      spec_version: '1.0.0',
                      spec_hash: '',
                      objective: 'test',
                      lineage: {},
                      status: 'UNSEALED',
                      created_at: new Date(),
                      spec_content_json: createdSpec,
                    },
                  ],
                };
              }
              return { rows: [] };
            }
            if (sql.includes('INSERT INTO execution_specs')) {
              createdSpec = params?.[9];
              return {
                rows: [
                  {
                    id: params?.[0],
                    task_id: params?.[1],
                    spec_version: params?.[2],
                    spec_hash: params?.[3],
                    objective: params?.[4],
                    lineage: typeof params?.[5] === 'string' ? JSON.parse(params?.[5]) : params?.[5],
                    status: 'UNSEALED',
                    created_at: new Date(),
                    spec_content_json: params?.[9],
                  },
                ],
              };
            }
            if (sql.includes('UPDATE execution_specs')) {
              return {
                rows: [
                  {
                    id: 'spec-test-1',
                    task_id: params?.[4],
                    spec_version: '1.0.0',
                    spec_hash: params?.[2],
                    objective: 'test',
                    lineage: {},
                    status: params?.[0] || 'SEALED',
                    created_at: new Date(),
                    sealed_at: new Date(),
                    spec_content_json: createdSpec,
                  },
                ],
              };
            }
            return { rows: [] };
          },
          release: () => {},
        }),
      };

      const intakeService = new TaskIntakeService(mockPool);
      const res = await intakeService.processIntake({
        rawRequest: 'Build new notification service',
        project: 'pub-dev-loop',
      });

      expect(res.task).toBeDefined();
      expect(res.task.id).toBe('task-test-3d1');
      expect(res.executionSpec).toBeDefined();
      expect(res.executionSpec.status).toBe('SEALED');

      // Assert sealed spec contains real preflight context
      const spec = JSON.parse(res.executionSpec.spec_content_json);
      expect(spec.context.relevantDocumentation.length).toBeGreaterThan(0);
      expect(spec.context.operationalContext.length).toBeGreaterThan(0);
      expect(spec.context.repositoryContext.length).toBeGreaterThan(0);
    });
  });
});
