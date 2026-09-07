import { describe, it, expect } from 'vitest';
import {
  parseEngineeringTask,
  validateEngineeringTask,
  classifyTaskType,
  analyzeRequirements,
  createEngineeringPlan,
  engineeringTaskToTask,
  type EngineeringTask,
  type RawUserIntent,
} from '../src/office/intent.js';

describe('Phase 0: Intent -> Engineering Task', () => {
  describe('Intent & Extraction', () => {
    it('separates user observation from user proposed solution', () => {
      const input: RawUserIntent = {
        prompt: 'O checkout está quebrado na hora de pagar com cartão. Acho que precisa criar outra RPC para resolver.',
        project: 'pub-ecom',
      };

      const task = parseEngineeringTask(input);

      expect(task.user_observation).toContain('checkout está quebrado');
      expect(task.user_proposed_solution).toContain('criar outra RPC');
      expect(task.objective).not.toBe(task.user_proposed_solution);
      expect(task.objective).toContain('checkout');
      expect(task.task_type).toBe('BUG');
    });

    it('identifies project and scope from input or matches known repos', () => {
      const input: RawUserIntent = {
        prompt: 'Adicionar suporte a webhook na API do pub-leads para qualificação de leads.',
      };

      const task = parseEngineeringTask(input);

      expect(task.project).toBe('pub-leads');
      expect(task.domain).toBe('B2B_GROWTH_LEADS');
      expect(task.scope.length).toBeGreaterThan(0);
      expect(task.scope).toContain('api');
    });
  });

  describe('Task Classifier', () => {
    it('correctly classifies task types based on engineering intent', () => {
      expect(classifyTaskType('Descubra por que o checkout está falhando')).toBe('INVESTIGATION');
      expect(classifyTaskType('Corrija o bug que impede o checkout')).toBe('BUG');
      expect(classifyTaskType('Adicione Pix ao checkout com novo endpoint')).toBe('FEATURE');
      expect(classifyTaskType('Compare duas arquiteturas possíveis de microsserviços')).toBe('ARCHITECTURE');
      expect(classifyTaskType('Melhore a performance e latência da tela 3D')).toBe('OPTIMIZATION');
      expect(classifyTaskType('Veja se existe uma biblioteca melhor para Three.js')).toBe('EXPLORATION');
      expect(classifyTaskType('Como funciona a fila do worker?')).toBe('QUESTION');
      expect(classifyTaskType('Refatore a função de parsing para reduzir complexidade')).toBe('REFACTOR');
      expect(classifyTaskType('Corrigir vulnerabilidade de SQL injection')).toBe('SECURITY');
      expect(classifyTaskType('Atualizar dependências do package.json')).toBe('MAINTENANCE');
    });
  });

  describe('Requirement Analyzer', () => {
    it('identifies known, unknown, assumptions, constraints, and testable acceptance criteria', () => {
      const input: RawUserIntent = {
        prompt: 'Corrija o checkout.',
      };

      const task = parseEngineeringTask(input);
      const analysis = analyzeRequirements(task);

      expect(analysis.known_context.length).toBeGreaterThan(0);
      expect(analysis.unknowns.length).toBeGreaterThan(0);
      expect(analysis.assumptions.length).toBeGreaterThan(0);
      expect(analysis.constraints.length).toBeGreaterThan(0);
      expect(analysis.acceptance_criteria).toContain('npm run typecheck passes');
      expect(analysis.acceptance_criteria).toContain('Targeted automated tests pass');
      expect(analysis.acceptance_criteria).toContain('No regression in unrelated files or modules');
    });
  });

  describe('Risk Model & CEO Sovereignty', () => {
    it('flags CRITICAL for production deployment or destructive commands', () => {
      const task = parseEngineeringTask({
        prompt: 'Fazer deploy em produção do novo banco de dados com drop table se existir.',
      });

      expect(task.risk_level).toBe('CRITICAL');
      expect(task.human_approval_required).toBe(true);
    });

    it('flags HIGH for database migrations or financial/security operations', () => {
      const task = parseEngineeringTask({
        prompt: 'Adicionar tabela de pagamentos Pix com migração de schema no banco de dados.',
      });

      expect(task.risk_level).toBe('HIGH');
      expect(task.human_approval_required).toBe(true);
    });

    it('flags LOW for simple non-destructive investigation or documentation', () => {
      const task = parseEngineeringTask({
        prompt: 'Como funciona o ciclo do worker? Explicar o fluxo.',
      });

      expect(task.risk_level).toBe('LOW');
      expect(task.human_approval_required).toBe(false);
    });
  });

  describe('Validation', () => {
    it('rejects invalid or missing mandatory fields', () => {
      const invalidTask: any = {
        id: '',
        intent: '',
        domain: '',
        objective: '',
        task_type: 'INVALID_TYPE',
        risk_level: 'SUPER_HIGH',
      };

      const result = validateEngineeringTask(invalidTask);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Engineering Plan Contract', () => {
    it('creates canonical structured lifecycle phases', () => {
      const task = parseEngineeringTask({
        prompt: 'Corrigir bug de concorrência no worker-service.',
        project: 'pub-dev-loop',
      });

      const plan = createEngineeringPlan(task);

      expect(plan.phases.map(p => p.phase)).toEqual([
        'DISCOVERY',
        'ANALYSIS',
        'PLANNING',
        'IMPLEMENTATION',
        'TEST',
        'VALIDATION',
      ]);
      expect(plan.phases[0].actions.length).toBeGreaterThan(0);
      expect(plan.phases[4].actions.some(a => a.includes('test'))).toBe(true);
    });
  });

  describe('Worker & Task Compatibility', () => {
    it('converts EngineeringTask into existing domain Task seamlessly', () => {
      const engTask = parseEngineeringTask({
        prompt: 'Investigar e corrigir o checkout quebrado.',
        project: 'pub-ecom',
      });

      const runtimeTask = engineeringTaskToTask(engTask, {
        repository: 'https://github.com/pubcoreagencia/pub-ecom.git',
      });

      expect(runtimeTask.id).toBe(engTask.id);
      expect(runtimeTask.project).toBe('pub-ecom');
      expect(runtimeTask.objective).toBe(engTask.objective);
      expect(runtimeTask.prompt).toContain(engTask.objective);
      expect(runtimeTask.prompt).toContain('CRITÉRIOS DE ACEITE');
      expect(runtimeTask.status).toBe('QUEUED');
      expect(runtimeTask.result).toEqual(expect.objectContaining({
        engineeringTask: engTask,
      }));
    });
  });
});
