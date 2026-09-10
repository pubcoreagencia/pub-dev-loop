import { describe, it, expect, vi } from 'vitest';
import type { TaskIntake } from '../../src/task/intake.js';
import {
  BoundedContextDiscovery,
  ContextDiscoveryError,
  isContextBundle,
} from '../../src/task/context-discovery.js';

describe('ContextDiscovery', () => {
  const mockContextSource: {
    getAuthoritativeContext: vi.Mock;
    getRepositoryContext: vi.Mock;
    getOperationalContext: vi.Mock;
    getRelevantDocumentation: vi.Mock;
    getKnownConstraints: vi.Mock;
  } = {
    getAuthoritativeContext: vi.fn(),
    getRepositoryContext: vi.fn(),
    getOperationalContext: vi.fn(),
    getRelevantDocumentation: vi.fn(),
    getKnownConstraints: vi.fn(),
  };

  const boundedDiscovery = new BoundedContextDiscovery(mockContextSource, {
    maxFactsPerSection: 2,
    maxDocumentationReferences: 1,
    maxConstraintLength: 50,
    maxFactValueLength: 5,
  });

  const mockTaskIntake: TaskIntake = {
    rawRequest: 'test',
    normalizedRequest: 'test',
    objective: 'test objective',
    constraints: ['constraint1'],
    requestedOutcome: null,
    ambiguityFlags: [],
    source: 'test',
    createdAt: new Date().toISOString(),
    intakeVersion: '1.0.0',
  };

  describe('discover', () => {
    it('should return a ContextBundle with bounded sections', async () => {
      mockContextSource.getAuthoritativeContext.mockResolvedValue([
        { key: 'auth1', value: 'value1', source: 'source1' },
        { key: 'auth2', value: 'value2', source: 'source2' },
        { key: 'auth3', value: 'value3', source: 'source3' },
      ]);
      mockContextSource.getRepositoryContext.mockResolvedValue([
        { key: 'repo1', value: 'short', source: 'src' },
        { key: 'repo2', value: 'also short', source: 'src' },
        { key: 'repo3', value: 'this is a very long value that should be truncated', source: 'src' },
      ]);
      mockContextSource.getOperationalContext.mockResolvedValue([]);
      mockContextSource.getRelevantDocumentation.mockResolvedValue([
        { title: 'Doc 1', path: '/doc1.md', relevance: 'high' },
        { title: 'Doc 2', path: '/doc2.md', relevance: 'medium' },
        { title: 'Doc 3', path: '/doc3.md', relevance: 'low' },
      ]);
      mockContextSource.getKnownConstraints.mockResolvedValue([
        'short constraint',
        'this is a very long constraint that should be truncated',
        'another one',
      ]);

      const result = await boundedDiscovery.discover(mockTaskIntake);

      expect(result).toHaveProperty('version', '1.0.0');
      expect(result.authoritativeContext).toHaveLength(2);
      expect(result.repositoryContext).toHaveLength(2);
      expect(result.operationalContext).toHaveLength(0);
      expect(result.relevantDocumentation).toHaveLength(1);
      expect(result.knownConstraints).toHaveLength(3);

      expect(result.repositoryContext[0].value).toBe('short');
      expect(result.repositoryContext[1].value).toBe('also…');
      expect(result.relevantDocumentation[0].title).toBe('Doc 1');
      expect(result.knownConstraints[0]).toBe('short constraint');
      expect(result.knownConstraints[1]).toBe('this is a very long constraint that should be tru…');
      expect(result.knownConstraints[2]).toBe('another one');
    });

    it('should add MISSING_CONTEXT limitations when sections are empty', async () => {
      mockContextSource.getAuthoritativeContext.mockResolvedValue([]);
      mockContextSource.getRepositoryContext.mockResolvedValue([]);
      mockContextSource.getOperationalContext.mockResolvedValue([]);
      mockContextSource.getRelevantDocumentation.mockResolvedValue([]);
      mockContextSource.getKnownConstraints.mockResolvedValue([]);

      const result = await boundedDiscovery.discover(mockTaskIntake);

      expect(result.limitations).toContainEqual({
        category: 'MISSING_CONTEXT',
        message: 'No authoritativeContext was returned by the context source',
        source: 'authoritativeContext',
      });
      expect(result.limitations).toContainEqual({
        category: 'MISSING_CONTEXT',
        message: 'No repositoryContext was returned by the context source',
        source: 'repositoryContext',
      });
      expect(result.limitations).toContainEqual({
        category: 'MISSING_CONTEXT',
        message: 'No operationalContext was returned by the context source',
        source: 'operationalContext',
      });
      expect(result.limitations).toContainEqual({
        category: 'MISSING_CONTEXT',
        message: 'No relevantDocumentation was returned by the context source',
        source: 'relevantDocumentation',
      });
      expect(result.limitations).toContainEqual({
        category: 'MISSING_CONTEXT',
        message: 'No known constraints were returned by the context source',
        source: 'knownConstraints',
      });
    });

    it('should throw ContextDiscoveryError when any source fails', async () => {
      mockContextSource.getAuthoritativeContext.mockRejectedValue(new Error('DB connection failed'));

      await expect(boundedDiscovery.discover(mockTaskIntake))
        .rejects.toThrow(ContextDiscoveryError);
    });
  });

  describe('isContextBundle', () => {
    it('should return true for valid ContextBundle', () => {
      const bundle = {
        version: '1.0.0',
        authoritativeContext: [],
        repositoryContext: [],
        operationalContext: [],
        relevantDocumentation: [],
        knownConstraints: [],
        limitations: [],
      };
      expect(isContextBundle(bundle)).toBe(true);
    });

    it('should return false for missing version', () => {
      const invalid = {
        authoritativeContext: [],
        repositoryContext: [],
        operationalContext: [],
        relevantDocumentation: [],
        knownConstraints: [],
        limitations: [],
      } as unknown;
      expect(isContextBundle(invalid)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isContextBundle(null)).toBe(false);
      expect(isContextBundle('string')).toBe(false);
      expect(isContextBundle(123)).toBe(false);
    });
  });
});