import { describe, it, expect, vi } from 'vitest';
import type { ContextBundle } from '../../src/task/context-discovery.js';
import type { TaskIntake } from '../../src/task/intake.js';
import type { Preflight, PreflightResult, PreflightCategory, PreflightFinding, PreflightConfidence, ResearchResult } from '../../src/task/preflight.js';
import { StructuredPreflight, PreflightError, PreflightFailure, PreflightFailureCategory, PreflightStatus } from '../../src/task/preflight.js';

describe('Preflight', () => {
  const mockDependencies: {
    repositoryInspector?: { inspect: vi.Mock };
    documentationLookup?: { lookup: vi.Mock };
    skillDiscovery?: { discover: vi.Mock };
    externalResearcher?: { research: vi.Mock };
  } = {};

  const structuredPreflight = new StructuredPreflight(mockDependencies, {
    timeoutMs: 50,
    maxFindingsPerCategory: 5,
  });

  const mockTaskIntake: TaskIntake = {
    rawRequest: 'test',
    normalizedRequest: 'test',
    objective: 'test objective',
    constraints: [],
    requestedOutcome: null,
    ambiguityFlags: [],
    source: 'test',
    createdAt: new Date().toISOString(),
    intakeVersion: '1.0.0',
  };

  const mockContextBundle: ContextBundle = {
    version: '1.0.0',
    authoritativeContext: [],
    repositoryContext: [],
    operationalContext: [],
    relevantDocumentation: [],
    knownConstraints: [],
    limitations: [],
  };

  describe('run', () => {
    it('should return COMPLETED when all categories succeed', async () => {
      mockDependencies.repositoryInspector = { inspect: vi.fn().mockResolvedValue([
        { category: 'REPOSITORY_INSPECTION' as PreflightCategory, key: 'files', value: '10', source: 'git', confidence: 'HIGH' }
      ]) };
      mockDependencies.documentationLookup = { lookup: vi.fn().mockResolvedValue([
        { category: 'DOCUMENTATION_LOOKUP' as PreflightCategory, key: 'guide', value: 'User guide', source: 'docs', confidence: 'HIGH' }
      ]) };
      mockDependencies.skillDiscovery = { discover: vi.fn().mockResolvedValue([
        { category: 'SKILL_DISCOVERY' as PreflightCategory, key: 'skills', value: '5', source: 'registry', confidence: 'MEDIUM' }
      ]) };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { categories: ['REPOSITORY_INSPECTION', 'DOCUMENTATION_LOOKUP', 'SKILL_DISCOVERY'] }
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.findings).toHaveLength(3);
      expect(result.failures).toHaveLength(0);
      expect(result.categoryResults).toHaveLength(3);
      expect(result.categoryResults[0]).toMatchObject({
        category: 'REPOSITORY_INSPECTION',
        status: 'COMPLETED',
        findings: expect.arrayContaining([
          expect.objectContaining({ key: 'files', value: '10' })
        ])
      });
    });

    it('should return PARTIAL when some categories return empty results', async () => {
      mockDependencies.repositoryInspector = { inspect: vi.fn().mockResolvedValue([]) };
      mockDependencies.documentationLookup = { lookup: vi.fn().mockResolvedValue([
        { category: 'DOCUMENTATION_LOOKUP' as PreflightCategory, key: 'guide', value: 'User guide', source: 'docs', confidence: 'HIGH' }
      ]) };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { categories: ['REPOSITORY_INSPECTION', 'DOCUMENTATION_LOOKUP'] }
      );

      expect(result.status).toBe('PARTIAL');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        category: 'EMPTY_RESULT',
        message: 'Preflight category returned no findings: REPOSITORY_INSPECTION',
        source: 'REPOSITORY_INSPECTION'
      });
      expect(result.warnings).toContain('Preflight category REPOSITORY_INSPECTION returned no findings');
      expect(result.findings).toHaveLength(1);
    });

    it('should return FAILED when a category capability throws', async () => {
      mockDependencies.repositoryInspector = { inspect: vi.fn().mockRejectedValue(new Error('Git not available')) };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { categories: ['REPOSITORY_INSPECTION'] }
      );

      expect(result.status).toBe('FAILED');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        category: 'CAPABILITY_UNAVAILABLE',
        message: 'Git not available',
        source: 'REPOSITORY_INSPECTION'
      });
      expect(result.categoryResults[0]).toMatchObject({
        category: 'REPOSITORY_INSPECTION',
        status: 'FAILED',
        findings: [],
      });
    });

    it('should handle EXTERNAL_RESEARCH category with findings', async () => {
      mockDependencies.externalResearcher = { 
        research: vi.fn().mockResolvedValue({
          findings: [
            { category: 'EXTERNAL_RESEARCH' as PreflightCategory, key: 'trend', value: 'AI adoption rising', source: 'web', confidence: 'MEDIUM' }
          ],
          conflicts: []
        }) 
      };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { 
          categories: ['EXTERNAL_RESEARCH'],
          externalResearchQueries: ['latest auth trends']
        }
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: 'EXTERNAL_RESEARCH',
        key: 'trend',
        value: 'AI adoption rising',
        source: 'web',
        confidence: 'MEDIUM'
      });
    });

    it('should handle EXTERNAL_RESEARCH with conflicting information', async () => {
      mockDependencies.externalResearcher = { 
        research: vi.fn().mockResolvedValue({
          findings: [],
          conflicts: ['Study A says X', 'Study B says not X']
        }) 
      };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { 
          categories: ['EXTERNAL_RESEARCH'],
          externalResearchQueries: ['controversial topic']
        }
      );

      expect(result.status).toBe('FAILED');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        category: 'CONFLICTING_INFORMATION',
        message: 'Study A says X; Study B says not X',
        source: 'EXTERNAL_RESEARCH'
      });
    });

    it('should handle EXTERNAL_RESEARCH timeout', async () => {
      mockDependencies.externalResearcher = { 
        research: vi.fn().mockImplementation(() => 
          new Promise((resolve) => setTimeout(() => resolve({ findings: [], conflicts: [] }), 200))
        ) 
      };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { 
          categories: ['EXTERNAL_RESEARCH'],
          externalResearchQueries: ['slow query'],
          timeoutMs: 50
        }
      );

      expect(result.status).toBe('FAILED');
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        category: 'RESEARCH_TIMEOUT',
        message: 'Preflight capability timed out: RESEARCH_TIMEOUT',
        source: 'EXTERNAL_RESEARCH'
      });
    });

    it('should respect maxFindingsPerCategory option', async () => {
      mockDependencies.repositoryInspector = { inspect: vi.fn().mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({
        category: 'REPOSITORY_INSPECTION' as PreflightCategory,
        key: `file${i}`,
        value: `content${i}`,
        source: 'git',
        confidence: 'HIGH'
      }))) };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { categories: ['REPOSITORY_INSPECTION'] }
      );

      expect(result.findings).toHaveLength(5);
    });
  });

  describe('isPreflightResult (implicit via usage)', () => {
    it('should structure results correctly', async () => {
      mockDependencies.repositoryInspector = { inspect: vi.fn().mockResolvedValue([]) };

      const result = await structuredPreflight.run(
        mockTaskIntake,
        mockContextBundle,
        { categories: ['REPOSITORY_INSPECTION'] }
      );

      expect(result).toHaveProperty('version', '1.0.0');
      expect(result).toHaveProperty('status');
      expect(Array.isArray(result.findings)).toBe(true);
      expect(Array.isArray(result.failures)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.categoryResults)).toBe(true);
    });
  });
});