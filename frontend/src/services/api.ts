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
