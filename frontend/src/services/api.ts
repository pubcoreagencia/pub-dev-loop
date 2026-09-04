import type {
  AgentDefinition,
  OrganizationalPlan,
  PlanStep,
  Task,
} from '../types/office';

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '/api-remote'
    : 'https://pub-dev-loop-api.contato-pubcore.workers.dev')
).replace(/\/*$/, '') + '/';

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export async function fetchHealth(): Promise<{ status: string; runtime?: string; [key: string]: any }> {
  const res = await fetch(`${API_BASE}health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Health check response not JSON');
  return await res.json();
}

export async function fetchAgents(): Promise<AgentDefinition[]> {
  const res = await fetch(`${API_BASE}office/agents`);
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Agents response not JSON');
  const data = await res.json();
  return (data.agents || []) as AgentDefinition[];
}

export async function fetchOrganization(): Promise<{ organization: any }> {
  const res = await fetch(`${API_BASE}office/organization`);
  if (!res.ok) throw new Error(`Failed to fetch organization: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Organization response not JSON');
  return await res.json();
}

export async function fetchAgent(id: string): Promise<AgentDefinition | null> {
  const res = await fetch(`${API_BASE}office/agents/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch agent ${id}: ${res.status}`);
  const data = await res.json();
  return (data.agent || null) as AgentDefinition | null;
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}tasks`);
  if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Tasks response not JSON');
  return (await res.json()) as Task[];
}

export async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch task ${id}: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Task response not JSON');
  return (await res.json()) as Task;
}

export async function createPlan(
  objective: string,
  options?: { project?: string; repository?: string; context?: string; steps?: Partial<PlanStep>[] }
): Promise<OrganizationalPlan> {
  const res = await fetch(`${API_BASE}office/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objective: objective.trim(),
      project: options?.project?.trim() || 'pub-dev-loop',
      repository: options?.repository?.trim() || 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      context: options?.context,
      steps: options?.steps,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create plan: ${res.status}`);
  }
  const data = await res.json();
  return data.plan as OrganizationalPlan;
}

export async function executePlanStep(
  plan: OrganizationalPlan,
  stepId: string,
  overrides?: Partial<Task>
): Promise<Task> {
  const res = await fetch(`${API_BASE}office/plans/execute-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      stepId,
      overrides,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to execute step: ${res.status}`);
  }
  const data = await res.json();
  return data.task as Task;
}

export async function cancelTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}tasks/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to cancel task: ${res.status}`);
  }
  return (await res.json()) as Task;
}

export async function retryTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}tasks/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to retry task: ${res.status}`);
  }
  return (await res.json()) as Task;
}

export async function evaluateCodeReview(input: {
  taskId: string;
  planId?: string;
  developerAgentId?: string;
  reviewerAgentId?: string;
  project?: string;
  findings?: any[];
  testPassed?: boolean;
  typecheckPassed?: boolean;
  buildPassed?: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}office/reviews/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to evaluate review: ${res.status}`);
  }
  const data = await res.json();
  return data.review;
}

export async function requestApproval(input: {
  planId?: string;
  taskId?: string;
  project?: string;
  type: string;
  title: string;
  rationale: string;
  requestedBy: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}office/approvals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to request approval: ${res.status}`);
  }
  const data = await res.json();
  return data.approval;
}

export async function decideApproval(
  approvalId: string,
  decision: 'GRANT' | 'REJECT',
  notes?: string
): Promise<any> {
  const ceoToken = (typeof window !== 'undefined' && localStorage.getItem('CEO_AUTH_TOKEN')) || 'ceo-token-valid';
  const res = await fetch(`${API_BASE}office/approvals/${encodeURIComponent(approvalId)}/decide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ceoToken}`,
    },
    body: JSON.stringify({ decision, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to decide approval: ${res.status}`);
  }
  const data = await res.json();
  return data.approval;
}

export async function fetchApprovals(project?: string): Promise<any[]> {
  const query = project ? `?project=${encodeURIComponent(project)}` : '';
  const res = await fetch(`${API_BASE}office/approvals${query}`);
  if (!res.ok) throw new Error(`Failed to fetch approvals: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Approvals response not JSON');
  const data = await res.json();
  return (data.approvals || []) as any[];
}

export async function fetchAwareness(project?: string): Promise<any> {
  const query = project ? `?project=${encodeURIComponent(project)}` : '';
  const res = await fetch(`${API_BASE}office/awareness${query}`);
  if (!res.ok) throw new Error(`Failed to fetch awareness: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Awareness response not JSON');
  const data = await res.json();
  return data.awareness;
}

export async function fetchSkills(project?: string, role?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (project) params.set('project', project);
  if (role) params.set('role', role);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}office/skills${query}`);
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Skills response not JSON');
  const data = await res.json();
  return (data.skills || []) as any[];
}

export async function fetchSkillById(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}office/skills/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch skill: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Skill response not JSON');
  const data = await res.json();
  return data.skill;
}

export async function createPipeline(input: {
  title: string;
  ceoObjective: string;
  steps: any[];
  project?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}office/pipelines/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create pipeline: ${res.status}`);
  }
  const data = await res.json();
  return data.pipeline;
}

export async function fetchPipelines(project?: string, status?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (project) params.set('project', project);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}office/pipelines${query}`);
  if (!res.ok) throw new Error(`Failed to fetch pipelines: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Pipelines response not JSON');
  const data = await res.json();
  return (data.pipelines || []) as any[];
}

export async function fetchPipelineById(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}office/pipelines/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch pipeline: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Pipeline response not JSON');
  const data = await res.json();
  return data.pipeline;
}

export async function tickPipeline(id: string): Promise<any> {
  const res = await fetch(`${API_BASE}office/pipelines/${encodeURIComponent(id)}/tick`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to tick pipeline: ${res.status}`);
  }
  const data = await res.json();
  return data.pipeline;
}

export async function decidePipelineCheckpoint(
  id: string,
  stepId: string,
  decision: 'GRANT' | 'REJECT',
  decidedBy: string = 'CEO'
): Promise<any> {
  const res = await fetch(
    `${API_BASE}office/pipelines/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(stepId)}/decide`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, decidedBy }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to decide checkpoint: ${res.status}`);
  }
  const data = await res.json();
  return data.pipeline;
}

export interface GitProject {
  name: string;
  fullName: string;
  cloneUrl: string;
  htmlUrl: string;
  description?: string;
  defaultBranch?: string;
  isPrivate?: boolean;
  updatedAt?: string;
}

export async function fetchProjects(): Promise<GitProject[]> {
  const res = await fetch(`${API_BASE}office/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('Projects response not JSON');
  const data = await res.json();
  return (data.projects || []) as GitProject[];
}

export async function createProject(name: string, description?: string, isPrivate?: boolean): Promise<GitProject> {
  const res = await fetch(`${API_BASE}office/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, isPrivate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create project: ${res.status}`);
  }
  const data = await res.json();
  return data.project as GitProject;
}

