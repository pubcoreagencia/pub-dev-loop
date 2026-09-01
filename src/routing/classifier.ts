// src/routing/classifier.ts
import type { Task } from '../domain.js';
import type { TaskRoutingProfile } from './types.js';

const FAST_PROTOTYPE_KEYWORDS = [
  'prototype', 'prototipo', 'protótipo', 'preview', 'mvp', 'mockup',
  'interface', 'layout', 'landing page', 'landingpage', 'ui', 'tela',
  'dashboard', 'formulario', 'formulário', 'componente visual'
];

const REASONING_KEYWORDS = [
  'architecture', 'arquitetura', 'migration', 'migração', 'audit',
  'auditoria', 'investigate', 'investigar', 'root cause', 'causa raiz',
  'redesign', 'large refactor', 'security review', 'forensic', 'forense',
  'concurrency', 'deadlock', 'memory leak', 'benchmark'
];

const CODING_KEYWORDS = [
  'implementation', 'implement', 'implementar', 'code', 'coding', 'codigo', 'código',
  'typescript', 'javascript', 'react', 'next.js', 'nextjs', 'api', 'backend',
  'frontend', 'database', 'banco de dados', 'sql', 'postgres', 'integration',
  'integração', 'test', 'teste', 'bugfix', 'fix', 'correção', 'endpoint',
  'route', 'component', 'componente', 'refactor', 'refatoração', 'function',
  'função', 'class', 'service', 'worker', 'handler', 'schema', 'migration'
];

/**
 * Deterministic, zero-token local task classifier.
 * Evaluates task properties (prototypeSessionId, objective, prompt) to assign a TaskRoutingProfile.
 */
export function classifyTaskProfile(task: Partial<Task>): TaskRoutingProfile {
  // 1. If linked to prototypeSessionId or explicit prototype objective, prioritize fast_prototype
  if (task.prototypeSessionId) {
    return 'fast_prototype';
  }

  const textToAnalyze = [
    task.objective ?? '',
    task.prompt ?? '',
    task.project ?? '',
  ].join(' ').toLowerCase();

  // Check for reasoning indicators first (high complexity/structural tasks)
  const hasReasoning = REASONING_KEYWORDS.some(kw => textToAnalyze.includes(kw));
  if (hasReasoning) {
    return 'reasoning';
  }

  // Check for prototype / UI indicators
  const hasPrototype = FAST_PROTOTYPE_KEYWORDS.some(kw => textToAnalyze.includes(kw));
  if (hasPrototype) {
    return 'fast_prototype';
  }

  // Check for coding indicators
  const hasCoding = CODING_KEYWORDS.some(kw => textToAnalyze.includes(kw));
  if (hasCoding) {
    return 'coding';
  }

  // Fallback default
  return 'general';
}
