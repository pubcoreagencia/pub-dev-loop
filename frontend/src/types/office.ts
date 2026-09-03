export type AgentDepartment = 'EXECUTIVE' | 'ENGINEERING' | 'QA';

export type AgentRole =
  | 'CHIEF_OF_STAFF'
  | 'ARCHITECT'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'QA_ENGINEER'
  | 'CEO';

export type AgentRoutingProfile =
  | 'reasoning'
  | 'coding'
  | 'review'
  | 'fast_prototype'
  | 'general';

export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'DEPRECATED';

export type EmployeeOperationalState =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'reviewing'
  | 'collaborating'
  | 'in_meeting'
  | 'waiting_for_dependency'
  | 'waiting_for_approval'
  | 'celebrating'
  | 'learning'
  | 'offline'
  | 'blocked';

export type EmployeeSpatialState =
  | 'idle'
  | 'walking'
  | 'approaching'
  | 'interacting'
  | 'returning';

export interface SpatialTarget {
  targetDeskId?: string;
  targetAgentId?: string;
  targetZoneId?: 'CEO_SUITE' | 'LEADERSHIP' | 'ENGINEERING' | 'QA' | 'MEETING_ROOM';
  coordinates?: { x: number; y: number };
  purpose?: 'HANDOFF' | 'MEETING' | 'APPROVAL' | 'RETURN';
  startedAt: number;
  durationMs: number;
}

export interface OfficePosition {
  zoneId: 'CEO_SUITE' | 'LEADERSHIP' | 'ENGINEERING' | 'QA' | 'MEETING_ROOM';
  zoneName: string;
  deskId: string;
  deskLabel: string;
  floor: number;
  facingDirection?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  coordinates?: { x: number; y: number };
}

export interface AvatarProfile {
  avatarId: string;
  displayName: string;
  roleLabel: string;
  badgeIcon: string;
  accentColor: string;
  initials: string;
  hairColor?: string;
  suitColor?: string;
  tieColor?: string;
  accessory?: string;
  avatarStyle?: 'EXECUTIVE' | 'STRATEGY' | 'ARCHITECT' | 'CODER' | 'REVIEWER' | 'QA';
}

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  department: AgentDepartment;
  role: AgentRole;
  specialty: string;
  personalitySummary: string;
  responsibilities: string[];
  capabilities: string[];
  routingProfile: AgentRoutingProfile;
  preferredModel?: string;
  systemPromptBase?: string;
  isManager?: boolean;
  reportsTo?: string | null;
  status: AgentStatus;
  position?: OfficePosition;
  avatar?: AvatarProfile;
  operationalState?: EmployeeOperationalState;
  spatialState?: EmployeeSpatialState;
  spatialTarget?: SpatialTarget;
  facingDirection?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
  lastHandoffFrom?: string;
}

export interface CeoIdentity {
  id: 'ceo';
  name: string;
  title: string;
  role: 'CEO';
  status: 'ACTIVE';
  personalitySummary: string;
  specialty: string;
  position: OfficePosition;
  avatar: AvatarProfile;
  operationalState?: EmployeeOperationalState;
  spatialState?: EmployeeSpatialState;
  spatialTarget?: SpatialTarget;
  facingDirection?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';
}

export interface MeetingRoomState {
  id: string;
  name: string;
  status: 'DISPONIVEL' | 'EM_REUNIAO';
  topic?: string;
  participants: string[];
  activePlanId?: string;
  startedAt?: string;
}

export interface SpeechBubbleItem {
  id: string;
  senderId: string;
  senderName: string;
  targetId?: string;
  content: string;
  timestamp: string;
  durationMs: number;
  type: 'CHAT' | 'PLAN' | 'TASK' | 'MEETING';
}

export type PlanStepStatus = 'PENDING' | 'READY' | 'ASSIGNED' | 'UNRESOLVED';

export interface PlanStep {
  id: string;
  description: string;
  prompt: string;
  agentId: string | null;
  assignmentSource: 'EXPLICIT' | 'ORGANIZATIONAL_SUGGESTION' | 'UNRESOLVED';
  compatibility: {
    compatible: boolean;
    score: number;
    reasons: string[];
  };
  dependsOn: string[];
  status: PlanStepStatus;
}

export type OrganizationalPlanStatus = 'DRAFT' | 'READY' | 'INVALID';

export interface OrganizationalPlan {
  id: string;
  objective: string;
  project: string;
  repository: string;
  createdBy: 'chief-of-staff';
  steps: PlanStep[];
  status: OrganizationalPlanStatus;
  validationErrors: string[];
  createdAt: string;
}

export interface TaskTraceAttempt {
  attempt: number;
  provider: string;
  model: string;
  status: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
}

export interface TaskTrace {
  provider: string;
  model: string;
  attempts?: TaskTraceAttempt[];
  fallbackUsed?: boolean;
}

export interface TaskResult {
  provider?: string;
  model?: string;
  summary?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  fallbackUsed?: boolean;
  trace?: TaskTrace;
}

export interface Task {
  id: string;
  project: string;
  repository: string;
  objective: string;
  prompt: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'BLOCKED';
  priority: number;
  worker: string;
  agentId: string | null;
  result: TaskResult | null;
  error: string | null;
  branch: string | null;
  commitSha: string | null;
  gitStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'CEO' | 'CHIEF_OF_STAFF' | 'AGENT' | 'SYSTEM';
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  type: 'TEXT' | 'PLAN' | 'EXECUTION' | 'RESULT' | 'ERROR' | 'SYSTEM';
  plan?: OrganizationalPlan;
  task?: Task;
  stepId?: string;
}

export interface CodeReviewFinding {
  ruleId: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  reviewId: string;
  taskId: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'BLOCKED';
  iteration: number;
  findings: CodeReviewFinding[];
  summary: string;
}

export type ApprovalType = 'CRITICAL_ARCHITECTURE_CHANGE' | 'PRODUCTION_PROMOTION' | 'SECURITY_OVERRIDE';
export type ApprovalStatus = 'PENDING' | 'GRANTED' | 'REJECTED';

export interface ApprovalItem {
  id: string;
  planId?: string;
  taskId?: string;
  project: string;
  type: ApprovalType;
  title: string;
  rationale: string;
  requestedBy: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNotes?: string;
  createdAt: string;
}

export type OfficeEventType =
  | 'MESSAGE_SENT'
  | 'MESSAGE_RECEIVED'
  | 'AGENT_RESPONDED'
  | 'OBJECTIVE_SUBMITTED'
  | 'PLAN_FORMULATED'
  | 'STEP_DELEGATED'
  | 'AGENT_STARTED_WORK'
  | 'AGENT_FINISHED_WORK'
  | 'AGENT_FAILED_WORK'
  | 'AGENT_COLLABORATING'
  | 'AGENT_HANDOFF'
  | 'AGENT_COMMUNICATION'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'REVIEW_REQUESTED'
  | 'REVIEW_STARTED'
  | 'REVIEW_FINDING'
  | 'REVIEW_CHANGES_REQUESTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_BLOCKED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED';

export interface OfficeEvent {
  id: string;
  sequence?: number;
  type: OfficeEventType;
  timestamp: string;
  actorId: string;
  targetId?: string;
  project?: string;
  taskId?: string;
  planId?: string;
  stepId?: string;
  summary: string;
  payload?: Record<string, any>;
}

export interface OfficeActivityEvent {
  id: string;
  timestamp: string;
  type: 'OBJECTIVE_RECEIVED' | 'PLAN_CREATED' | 'AGENT_ASSIGNED' | 'TASK_RUNNING' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'FALLBACK_TRIGGERED';
  title: string;
  description: string;
  agentId?: string;
  taskId?: string;
  meta?: Record<string, any>;
}

export interface AwarenessPulse {
  status: 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN';
  badgeLabel: string;
  badgeColor: 'green' | 'amber' | 'red' | 'gray';
  summary: string;
}

export interface AwarenessHealth {
  status: 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN';
  summary: string;
  successRateText: string;
  failureRateText: string;
  tasksCompleted: number;
  tasksFailed: number;
  tasksBlocked: number;
  evaluatedAt: string;
}

export interface AwarenessRisk {
  id: string;
  riskType: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string[];
  firstObservedAt: string;
  status: 'ACTIVE' | 'MITIGATED' | 'DISMISSED';
}

export interface AwarenessTrend {
  metricName: string;
  direction: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'VOLATILE' | 'UNKNOWN';
  currentValueText: string;
  previousValueText?: string;
  reason: string;
}

export interface AwarenessBottleneck {
  id: string;
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedRole?: string;
}

export interface AwarenessAgentLoad {
  role: string;
  taskCount: number;
  failureCount: number;
  blockedCount: number;
  reviewCount: number;
  qaCount: number;
}

export interface AwarenessInsight {
  id: string;
  category: 'OBSERVED' | 'INFERRED';
  title: string;
  description: string;
  evidence: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AwarenessRecommendation {
  id: string;
  title: string;
  description: string;
  suggestedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  targetRole?: string;
  requiresHumanDecision: true;
}

export interface OrganizationAwareness {
  pulse: AwarenessPulse;
  health: AwarenessHealth;
  risks: AwarenessRisk[];
  trends: AwarenessTrend[];
  bottlenecks: AwarenessBottleneck[];
  agentLoad: Record<string, AwarenessAgentLoad>;
  insights: AwarenessInsight[];
  recommendations: AwarenessRecommendation[];
  metadata: {
    tenantId: string;
    projectId?: string;
    sampleSize: number;
    evaluatedAt: string;
    isReadOnly: true;
  };
}

export type SkillStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';

export interface SkillRecord {
  id: string;
  tenantId: string;
  projectId?: string;
  name: string;
  description: string;
  capability: string;
  sourceLessonId?: string;
  sourceExperiences: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  version: number;
  applicableRoles: string[];
  applicableContexts: string[];
  limitations: string[];
  executableGuideline: string;
  status: SkillStatus;
  provenance: {
    tenantId: string;
    projectId?: string;
    createdAt: string;
    updatedAt: string;
    compiledFromLessonId?: string;
    validatedBy?: string;
  };
}

export type PipelineStatus =
  | 'PLANNING'
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepStatus =
  | 'PENDING'
  | 'WAITING_DEPENDENCY'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type CheckpointType =
  | 'SECURITY_AUDIT'
  | 'SCHEMA_MIGRATION'
  | 'ARCHITECTURE_GATE'
  | 'PRODUCTION_DEPLOY'
  | 'BUDGET_THRESHOLD';

export interface PipelineCheckpoint {
  id: string;
  stepId: string;
  type: CheckpointType;
  title: string;
  rationale: string;
  requiresCEOApproval: true;
  approvalId?: string;
  status: 'PENDING' | 'GRANTED' | 'REJECTED';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface PipelineStep {
  id: string;
  title: string;
  description: string;
  targetRole: string;
  assignedAgentId?: string;
  requiredSkills: string[];
  dependsOnStepIds: string[];
  status: StepStatus;
  taskId?: string;
  checkpoint?: PipelineCheckpoint;
  outputSummary?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AutonomousPipeline {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  ceoObjective: string;
  status: PipelineStatus;
  steps: PipelineStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
