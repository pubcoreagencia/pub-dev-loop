export type AgentDepartment = 'EXECUTIVE' | 'ENGINEERING' | 'QA';

export type AgentRole =
  | 'CHIEF_OF_STAFF'
  | 'ARCHITECT'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'QA_ENGINEER';

export type AgentRoutingProfile =
  | 'reasoning'
  | 'coding'
  | 'review'
  | 'fast_prototype'
  | 'general';

export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'DEPRECATED';

export interface AgentDefinition {
  /** Unique agent identifier (e.g., 'chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer') */
  id: string;
  /** Human-friendly name of the agent */
  name: string;
  /** Formal job title */
  title: string;
  /** Organizational department */
  department: AgentDepartment;
  /** Functional organizational role */
  role: AgentRole;
  /** Technical or strategic area of expertise */
  specialty: string;
  /** High-level summary of personality and communication style */
  personalitySummary: string;
  /** Canonical list of core responsibilities */
  responsibilities: string[];
  /** Capabilities declared by this agent */
  capabilities: string[];
  /** Cognitive routing profile associated with the agent's work */
  routingProfile: AgentRoutingProfile;
  /** Reference to preferred model in MODEL_REGISTRY (optional) */
  preferredModel?: string;
  /** Base persona or system instruction template */
  systemPromptBase?: string;
  /** Whether the agent has managerial / task delegation authority */
  isManager?: boolean;
  /** Identifier of the supervising agent within the registry (null/undefined if reports to human CEO) */
  reportsTo?: string | null;
  /** Operational lifecycle status */
  status: AgentStatus;
}
