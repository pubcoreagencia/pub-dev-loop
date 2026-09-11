import { describe, expect, it } from 'vitest';
import { classifyTaskProfile } from '../src/routing/classifier.js';
import { buildRoutingPolicy } from '../src/routing/engine.js';
import type { ProviderTaskInput } from '../src/providers/types.js';

describe('Phase 5K: Routing Profile Neutrality & Provider Contract', () => {
  // A) Explicit routing profile
  it('A) honors explicit routingProfile = "fast_prototype" on ProviderTaskInput', () => {
    const input: ProviderTaskInput = {
      id: 'TASK-1',
      objective: 'Do something',
      prompt: 'Do it',
      routingProfile: 'fast_prototype',
    };
    expect(classifyTaskProfile(input)).toBe('fast_prototype');
    const policy = buildRoutingPolicy(input);
    expect(policy.profile).toBe('fast_prototype');
  });

  // B) Sem routing profile -> não existe inferência automática de prototype
  it('B) defaults to general or technical profile when routingProfile is omitted', () => {
    const input: ProviderTaskInput = {
      id: 'TASK-2',
      objective: 'Generic operation',
      prompt: 'Process files',
    };
    expect(classifyTaskProfile(input)).not.toBe('fast_prototype');
    const policy = buildRoutingPolicy(input);
    expect(policy.profile).not.toBe('fast_prototype');
  });

  // C) Objective contendo "prototype" -> NÃO ativa fast_prototype
  it('C) does NOT activate fast_prototype even if objective contains prototype/preview terms', () => {
    const objectives = [
      'Create prototype web application',
      'Build UI preview and prototype dashboard',
      'Deploy interactive prototype',
      'Protótipo de landing page',
    ];
    for (const objective of objectives) {
      const input: ProviderTaskInput = {
        id: 'TASK-3',
        objective,
        prompt: 'Build it',
      };
      expect(classifyTaskProfile(input)).not.toBe('fast_prototype');
      const policy = buildRoutingPolicy(input);
      expect(policy.profile).not.toBe('fast_prototype');
    }
  });

  // D) prototypeSessionId presente na origem -> NÃO é lido pelo routing infrastructure
  it('D) ignores prototypeSessionId completely in routing classifier and engine', () => {
    const taskWithSession = {
      id: 'TASK-4',
      objective: 'Run worker task',
      prompt: 'Run',
      prototypeSessionId: 'session-xyz-999',
    };
    expect(classifyTaskProfile(taskWithSession as any)).not.toBe('fast_prototype');
    const policy = buildRoutingPolicy(taskWithSession as any);
    expect(policy.profile).not.toBe('fast_prototype');
  });

  // E) ProviderTaskInput aceita routingProfile
  it('E) ProviderTaskInput accepts valid TaskRoutingProfile values', () => {
    const profiles: Array<ProviderTaskInput['routingProfile']> = [
      'coding',
      'reasoning',
      'fast_prototype',
      'general',
      undefined,
    ];
    for (const p of profiles) {
      const task: ProviderTaskInput = {
        id: 'TASK-5',
        objective: 'Test',
        prompt: 'Test',
        routingProfile: p,
      };
      if (p) {
        expect(classifyTaskProfile(task)).toBe(p);
      }
    }
  });

  // F) Explicit profileHint takes precedence
  it('F) profileHint argument directly overrides task properties in classifier', () => {
    const task = { objective: 'Implement typescript algorithm' }; // would normally classify as coding
    expect(classifyTaskProfile(task, 'fast_prototype')).toBe('fast_prototype');
    expect(classifyTaskProfile(task, 'reasoning')).toBe('reasoning');
  });
});
