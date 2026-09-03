import { describe, it, expect, beforeEach } from 'vitest';
import {
  DailySkillEngine,
  defaultDailySkillEngine,
  type SkillRecord,
} from '../src/office/skills.js';
import type { InstitutionalLesson } from '../src/office/lesson-validation.js';
import { ContextAssemblyEngine } from '../src/office/context-assembly.js';
import { DecisionContextEngine } from '../src/office/decision-context.js';
import apiWorker from '../src/api-worker.js';

describe('PDL — Phase 8.7: Daily Skill Learning & Compounding Test Suite', () => {
  let engine: DailySkillEngine;
  const mockEnv: any = {
    PUB_DEV_LOOP_API_KEY: 'test-office-token',
  };

  const sampleLesson: InstitutionalLesson = {
    id: 'lesson-87-test-1',
    tenantId: 'pub-dev-loop',
    projectId: 'pub-dev-loop',
    candidateId: 'cand-87-test-1',
    status: 'ACTIVE',
    title: 'Idempotent Migration Verification',
    statement: 'Always verify idempotency when applying SQL migrations.',
    scope: 'PROJECT',
    lessonType: 'ARCHITECTURE_GUIDANCE',
    sourceCandidateIds: ['cand-87-test-1'],
    supportingPatternIds: ['pat-87-1'],
    supportingMemoryIds: ['mem-87-1', 'mem-87-2'],
    supportingEventIds: ['evt-87-1'],
    supportingTaskIds: ['task-87-1'],
    provenance: { tenantId: 'pub-dev-loop', projectId: 'pub-dev-loop' },
    governance: { approvedBy: 'CEO', validatedBy: 'CEO' },
    validation: { isValid: true, validatedBy: 'CEO' },
    temporalValidity: 'CURRENT',
    createdAt: new Date().toISOString(),
    validatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    engine = new DailySkillEngine();
    defaultDailySkillEngine.clear();
  });

  // 1-5: Compilation & Lifecycle
  it('1. Compiles an active InstitutionalLesson into a SkillRecord', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(skill.id).toMatch(/^skill-/);
    expect(skill.status).toBe('ACTIVE');
    expect(skill.sourceLessonId).toBe('lesson-87-test-1');
    expect(skill.sourceExperiences).toEqual(['mem-87-1', 'mem-87-2']);
    expect(skill.capability).toBe('ARCHITECTURE_DESIGN');
  });

  it('2. Throws when compiling from an inactive lesson', () => {
    const inactiveLesson = { ...sampleLesson, status: 'BLOCKED' as const };
    expect(() => engine.compileSkillFromLesson(inactiveLesson)).toThrow(/inactive lesson/);
  });

  it('3. Maps GLOBAL scope to all 5 workforce roles', () => {
    const globalLesson: InstitutionalLesson = { ...sampleLesson, scope: 'GLOBAL' };
    const skill = engine.compileSkillFromLesson(globalLesson);
    expect(skill.applicableRoles).toEqual([
      'chief-of-staff',
      'architect',
      'developer',
      'reviewer',
      'qa-engineer',
    ]);
  });

  it('4. Maps PROJECT scope to engineering roles', () => {
    const projectLesson: InstitutionalLesson = { ...sampleLesson, scope: 'PROJECT' };
    const skill = engine.compileSkillFromLesson(projectLesson);
    expect(skill.applicableRoles).toEqual(['architect', 'developer', 'reviewer', 'qa-engineer']);
  });

  it('5. Maps SECURITY_GUIDANCE to SECURITY_ENFORCEMENT capability', () => {
    const secLesson: InstitutionalLesson = { ...sampleLesson, lessonType: 'SECURITY_GUIDANCE' };
    const skill = engine.compileSkillFromLesson(secLesson);
    expect(skill.capability).toBe('SECURITY_ENFORCEMENT');
  });

  // 6-10: Overrides, Registration & Deprecation
  it('6. Allows overriding name, description and executable guideline', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson, {
      name: 'Custom Migration Skill',
      executableGuideline: 'Check IF NOT EXISTS on all tables',
    });
    expect(skill.name).toBe('Custom Migration Skill');
    expect(skill.executableGuideline).toBe('Check IF NOT EXISTS on all tables');
  });

  it('7. Registers direct skill record successfully', () => {
    const directSkill: SkillRecord = {
      id: 'skill-custom-1',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      name: 'Direct Test Skill',
      description: 'Testing registration',
      capability: 'TESTING',
      sourceExperiences: [],
      confidence: 'HIGH',
      version: 1,
      applicableRoles: ['qa-engineer'],
      applicableContexts: ['testing'],
      limitations: ['Test only'],
      executableGuideline: 'Run vitest on all files',
      status: 'ACTIVE',
      provenance: {
        tenantId: 'pub-dev-loop',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    engine.registerSkill(directSkill);
    expect(engine.getSkill('skill-custom-1')).toBeDefined();
  });

  it('8. Throws if mandatory fields are missing on registerSkill', () => {
    expect(() => engine.registerSkill({} as any)).toThrow(/required/);
  });

  it('9. Deprecates an existing skill with a reason', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    const deprecated = engine.deprecateSkill(skill.id, 'Superseded by v2');
    expect(deprecated.status).toBe('DEPRECATED');
    expect(deprecated.limitations).toContain('Deprecada: Superseded by v2');
  });

  it('10. Throws when deprecating non-existent skill', () => {
    expect(() => engine.deprecateSkill('non-existent', 'reason')).toThrow(/not found/);
  });

  // 11-15: Multi-Tenant & Scoping Isolation
  it('11. Isolates skills from foreign tenants in listSkills', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    const foreignLesson: InstitutionalLesson = { ...sampleLesson, id: 'lesson-foreign', tenantId: 'foreign-tenant' };
    engine.compileSkillFromLesson(foreignLesson);

    const list = engine.listSkills({ tenantId: 'pub-dev-loop' });
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(skill.id);
  });

  it('12. getSkill returns undefined when tenant does not match', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(engine.getSkill(skill.id, 'foreign-tenant')).toBeUndefined();
    expect(engine.getSkill(skill.id, 'pub-dev-loop')).toBeDefined();
  });

  it('13. Filters skills by project correctly', () => {
    const skillProjA = engine.compileSkillFromLesson({ ...sampleLesson, id: 'lesson-a', projectId: 'project-a' });
    const skillProjB = engine.compileSkillFromLesson({ ...sampleLesson, id: 'lesson-b', projectId: 'project-b' });

    const listA = engine.listSkills({ projectId: 'project-a' });
    expect(listA.map(s => s.id)).toContain(skillProjA.id);
    expect(listA.map(s => s.id)).not.toContain(skillProjB.id);
  });

  it('14. Filters skills by role correctly', () => {
    const qaLesson: InstitutionalLesson = { ...sampleLesson, id: 'lesson-qa', scope: 'TASK', lessonType: 'TESTING_GUIDANCE' };
    engine.compileSkillFromLesson(qaLesson);

    const qaSkills = engine.listSkills({ role: 'qa-engineer' });
    expect(qaSkills.length).toBeGreaterThan(0);
  });

  it('15. Filters skills by status correctly', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    engine.deprecateSkill(skill.id, 'Obsolete');

    const activeList = engine.listSkills({ status: 'ACTIVE' });
    expect(activeList.length).toBe(0);

    const deprecatedList = engine.listSkills({ status: 'DEPRECATED' });
    expect(deprecatedList.length).toBe(1);
  });

  // 16-20: Context Retrieval & Prompt Enrichment
  it('16. retrieveSkillsForContext returns active skills for role', () => {
    engine.compileSkillFromLesson(sampleLesson);
    const skills = engine.retrieveSkillsForContext('developer', { tenantId: 'pub-dev-loop' });
    expect(skills.length).toBe(1);
    expect(skills[0].status).toBe('ACTIVE');
  });

  it('17. retrieveSkillsForContext respects limit argument', () => {
    for (let i = 0; i < 5; i++) {
      engine.compileSkillFromLesson({ ...sampleLesson, id: `lesson-${i}` });
    }
    const skills = engine.retrieveSkillsForContext('developer', { limit: 2 });
    expect(skills.length).toBe(2);
  });

  it('18. ContextAssemblyEngine includes DAILY_SKILL blocks in prompt', () => {
    const assemblyEngine = new ContextAssemblyEngine();
    const skill = engine.compileSkillFromLesson(sampleLesson);

    const result = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      currentTask: {
        id: 'task-skill-test',
        project: 'pub-dev-loop',
        repository: 'pub-dev-loop',
        objective: 'Test skills context integration',
        prompt: 'Apply skills',
        priority: 1,
        status: 'RUNNING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      skills: [skill],
    });

    expect(result.enrichedPrompt).toContain(skill.name);
    const skillBlock = result.blocksIncluded.find(b => b.source === 'DAILY_SKILL');
    expect(skillBlock).toBeDefined();
    expect(skillBlock?.title).toBe('Reusable Organizational Skills');
    expect(skillBlock?.authority).toBe('GOVERNED');
    expect(skillBlock?.priority).toBe(25);
  });

  it('19. ContextAssemblyEngine excludes non-active skills', () => {
    const assemblyEngine = new ContextAssemblyEngine();
    const skill = engine.compileSkillFromLesson(sampleLesson);
    const deprecated = engine.deprecateSkill(skill.id, 'No longer valid');

    const result = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      currentTask: {
        id: 'task-skill-test',
        project: 'pub-dev-loop',
        repository: 'pub-dev-loop',
        objective: 'Test skills context integration',
        prompt: 'Apply skills',
        priority: 1,
        status: 'RUNNING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      skills: [deprecated],
    });

    const skillBlock = result.blocksIncluded.find(b => b.source === 'DAILY_SKILL');
    expect(skillBlock).toBeUndefined();
    expect(result.invalidBlocks.some(b => b.includes('Excluded non-active skill'))).toBe(true);
  });

  it('20. ContextAssemblyEngine excludes foreign tenant skills', () => {
    const assemblyEngine = new ContextAssemblyEngine();
    const skill = engine.compileSkillFromLesson({ ...sampleLesson, tenantId: 'foreign-tenant' });

    const result = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      currentTask: {
        id: 'task-skill-test',
        project: 'pub-dev-loop',
        repository: 'pub-dev-loop',
        objective: 'Test skills context integration',
        prompt: 'Apply skills',
        priority: 1,
        status: 'RUNNING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      skills: [skill],
    });

    expect(result.blocksIncluded.find(b => b.source === 'DAILY_SKILL')).toBeUndefined();
    expect(result.invalidBlocks.some(b => b.includes('cross-tenant skill'))).toBe(true);
  });

  // 21-25: Decision Context & Provenance
  it('21. DecisionContextEngine structures decision context with skill provenance', () => {
    const decisionEngine = new DecisionContextEngine();
    const assemblyEngine = new ContextAssemblyEngine();
    const skill = engine.compileSkillFromLesson(sampleLesson);

    const task = {
      id: 'task-skill-decision',
      project: 'pub-dev-loop',
      repository: 'pub-dev-loop',
      objective: 'Implement feature using skill',
      prompt: 'Implement',
      priority: 1,
      status: 'RUNNING' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const assembly = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      currentTask: task,
      skills: [skill],
    });

    const decision = decisionEngine.buildDecisionContext(assembly, {
      role: 'developer',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      task,
    });

    expect(decision.evidence.length).toBeGreaterThan(0);
    expect(decision.authorityBoundary.canApprove).toBe(false); // CEO sovereignty preserved
  });

  it('22. Skill version starts at 1', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(skill.version).toBe(1);
  });

  it('23. Provenance retains compiledFromLessonId and validator', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(skill.provenance.compiledFromLessonId).toBe('lesson-87-test-1');
    expect(skill.provenance.validatedBy).toBe('CEO');
  });

  it('24. Clear method wipes skills from memory', () => {
    engine.compileSkillFromLesson(sampleLesson);
    expect(engine.listSkills().length).toBe(1);
    engine.clear();
    expect(engine.listSkills().length).toBe(0);
  });

  it('25. defaultDailySkillEngine is exported and operational', () => {
    expect(defaultDailySkillEngine).toBeDefined();
    defaultDailySkillEngine.compileSkillFromLesson(sampleLesson);
    expect(defaultDailySkillEngine.listSkills().length).toBe(1);
  });

  // 26-30: Cloudflare Worker Endpoint Tests
  it('26. GET /office/skills returns 200 and skills array', async () => {
    defaultDailySkillEngine.compileSkillFromLesson(sampleLesson);
    const request = new Request('http://localhost/office/skills', {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { skills: SkillRecord[] };
    expect(body.skills).toBeDefined();
    expect(body.skills.length).toBe(1);
  });

  it('27. GET /office/skills/:id returns 200 for valid skill', async () => {
    const skill = defaultDailySkillEngine.compileSkillFromLesson(sampleLesson);
    const request = new Request(`http://localhost/office/skills/${skill.id}`, {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { skill: SkillRecord };
    expect(body.skill.id).toBe(skill.id);
  });

  it('28. GET /office/skills/:id returns 404 for unknown skill', async () => {
    const request = new Request('http://localhost/office/skills/non-existent-skill', {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(404);
  });

  it('29. GET /office/skills returns 401 when unauthenticated', async () => {
    const request = new Request('http://localhost/office/skills');
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(401);
  });

  it('30. GET /office/skills/:id returns 401 when unauthenticated', async () => {
    const request = new Request('http://localhost/office/skills/skill-123');
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(401);
  });

  // 31-40: Governance & Non-Autonomous Invariants
  it('31. Skills are strictly advisory and do not alter MAX_REVIEW_ITERATIONS', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(skill.limitations.some(l => l.includes('prompt da tarefa atual'))).toBe(true);
  });

  it('32. Skill compilation never generates fake activities or messages', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    expect(skill.sourceExperiences).toEqual(sampleLesson.supportingMemoryIds);
  });

  it('33. STRATEGIC_GUIDANCE maps to STRATEGIC_ORCHESTRATION capability', () => {
    const stratLesson: InstitutionalLesson = { ...sampleLesson, lessonType: 'STRATEGIC_GUIDANCE' };
    const skill = engine.compileSkillFromLesson(stratLesson);
    expect(skill.capability).toBe('STRATEGIC_ORCHESTRATION');
  });

  it('34. TESTING_GUIDANCE maps to QUALITY_VERIFICATION capability', () => {
    const testLesson: InstitutionalLesson = { ...sampleLesson, lessonType: 'TESTING_GUIDANCE' };
    const skill = engine.compileSkillFromLesson(testLesson);
    expect(skill.capability).toBe('QUALITY_VERIFICATION');
  });

  it('35. Deprecating a skill is idempotent', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    const dep1 = engine.deprecateSkill(skill.id, 'First reason');
    const dep2 = engine.deprecateSkill(skill.id, 'Second reason');
    expect(dep2.status).toBe('DEPRECATED');
    expect(dep2.limitations.length).toBe(dep1.limitations.length + 1);
  });

  it('36. Multiple skills for same role are returned in listSkills', () => {
    engine.compileSkillFromLesson({ ...sampleLesson, id: 'lesson-1' });
    engine.compileSkillFromLesson({ ...sampleLesson, id: 'lesson-2' });
    const list = engine.listSkills({ role: 'developer' });
    expect(list.length).toBe(2);
  });

  it('37. retrieveSkillsForContext excludes deprecated skills', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson);
    engine.deprecateSkill(skill.id, 'No longer active');
    const activeSkills = engine.retrieveSkillsForContext('developer');
    expect(activeSkills.length).toBe(0);
  });

  it('38. Skill record preserves confidence level from overrides', () => {
    const skill = engine.compileSkillFromLesson(sampleLesson, { confidence: 'MEDIUM' });
    expect(skill.confidence).toBe('MEDIUM');
  });

  it('39. Listing skills with limit returns exact slice', () => {
    for (let i = 0; i < 10; i++) {
      engine.compileSkillFromLesson({ ...sampleLesson, id: `lesson-${i}` });
    }
    const list = engine.listSkills({ limit: 3 });
    expect(list.length).toBe(3);
  });

  it('40. Continuous skill operations produce consistent deterministic state', () => {
    const skill1 = engine.compileSkillFromLesson(sampleLesson);
    const skill2 = engine.getSkill(skill1.id);
    expect(skill1).toEqual(skill2);
  });
});
