import { describe, it, expect, vi } from 'vitest';
import { normalizeTaskIntake, type TaskIntakeInput, TaskIntakeError, type TaskIntake } from '../../src/task/intake.js';

describe('TaskIntake', () => {
  const baseInput: TaskIntakeInput = {
    rawRequest: 'Create a user authentication system with JWT tokens',
    source: 'test',
    createdAt: new Date().toISOString(),
  };

  describe('normalizeTaskIntake', () => {
    it('should accept a valid raw task', () => {
      const result = normalizeTaskIntake(baseInput);
      expect(result).toHaveProperty('intakeVersion');
      expect(result.rawRequest).toBe(baseInput.rawRequest);
      expect(result.objective).toBe('Create a user authentication system with JWT tokens');
      expect(result.constraints).toEqual([]);
      expect(result.requestedOutcome).toBeNull();
    });

    it('should reject empty input', () => {
      expect(() => normalizeTaskIntake({ ...baseInput, rawRequest: '' }))
        .toThrowError(TaskIntakeError);
    });

    it('should reject whitespace-only input', () => {
      expect(() => normalizeTaskIntake({ ...baseInput, rawRequest: '   \n\t  ' }))
        .toThrowError(TaskIntakeError);
    });

    it('should normalize line endings and collapse extra blank lines', () => {
      const input = { ...baseInput, rawRequest: '  Create a user system\r\n\n\n\n  With JWT\r\n' };
      const result = normalizeTaskIntake(input);
      expect(result.normalizedRequest).toBe('Create a user system\n\nWith JWT');
    });

    it('should reject missing source', () => {
      expect(() => normalizeTaskIntake({ ...baseInput, source: '' }))
        .toThrowError(TaskIntakeError);
    });

    it('should reject invalid createdAt', () => {
      expect(() => normalizeTaskIntake({ ...baseInput, createdAt: 'not-a-date' }))
        .toThrowError(TaskIntakeError);
    });

    it('should extract objective from first line', () => {
      const input = { ...baseInput, rawRequest: '# Create API\n\nWith JWT support' };
      const result = normalizeTaskIntake(input);
      expect(result.objective).toBe('Create API');
    });

    it('should extract objective ignoring markdown and blockquote prefixes', () => {
      const input = { ...baseInput, rawRequest: '> Create user system\n\n- With login' };
      const result = normalizeTaskIntake(input);
      expect(result.objective).toBe('Create user system');
    });

    it('should parse constraints from bullet points and numbered lists', () => {
      const input = { 
        ...baseInput, 
        rawRequest: '- Use PostgreSQL\n* Add logging\n1. Include tests\n2. Use TypeScript\n- Use PostgreSQL' 
      };
      const result = normalizeTaskIntake(input);
      expect(result.constraints).toEqual([
        'Use PostgreSQL',
        'Add logging',
        'Include tests',
        'Use TypeScript'
      ]);
    });

    it('should extract requested outcome from various labels', () => {
      const input = { 
        ...baseInput, 
        rawRequest: 'Create login system\nRequested outcome: JWT middleware\nDefinition of done: Token validation' 
      };
      const result = normalizeTaskIntake(input);
      expect(result.requestedOutcome).toBe('JWT middleware');
    });

    it('should detect ambiguity flags', () => {
      const input = { 
        ...baseInput, 
        rawRequest: 'Maybe create something etc\n- ' 
      };
      const result = normalizeTaskIntake(input);
      expect(result.ambiguityFlags).toContain('AMBIGUOUS_OBJECTIVE');
      expect(result.ambiguityFlags).toContain('MISSING_REQUESTED_OUTCOME');
      expect(result.ambiguityFlags).toContain('MISSING_CONSTRAINTS');
    });

    it('should return TaskIntake with correct shape', () => {
      const result = normalizeTaskIntake(baseInput);
      expect(result).toMatchObject<TaskIntake>({
        intakeVersion: '1.0.0',
        rawRequest: baseInput.rawRequest,
        source: baseInput.source,
        createdAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
      });
    });
  });
});