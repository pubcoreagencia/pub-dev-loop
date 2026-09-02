# THE OFFICE MASTER CONTEXT

## PUB DEV LOOP — The Office

**Status:** Product vision / master context
**Version:** 1.1
**Role:** Source of truth for the next evolution of PUB DEV LOOP product, UX, agent orchestration, model routing, memory, learning and virtual-office experience.

---

## 1. PRODUCT THESIS

PUB DEV LOOP must not feel like a generic AI dashboard, chatbot wrapper or task-management SaaS.

The core product metaphor is an **AI company operating as a living shared office**.

Each AI agent is an employee with a specialty, desk, personality, responsibilities, memory and evolving skills. Agents collaborate, debate, delegate, execute projects, review work and learn from what happens.

The human operator is the **CEO / decision maker**. The CEO does not micromanage ordinary execution. Agents autonomously move work forward and request human authorization only when a defined sensitivity or risk threshold is reached.

### Core promise

> **Give the office an objective. The team figures out how to execute it.**

The visual office is not decoration. It is the primary human interface for understanding what the autonomous organization is doing.

---

## 2. PRODUCT SHIFT — FROM TASK LOOP TO AI WORKFORCE

The original PUB DEV LOOP foundation is a persistent execution loop:

`HTTP/API → queue → worker → provider → execution → validation → finalization → Git/audit`

The Office phase adds an organizational layer above that foundation:

`CEO → Global Office Chat → Chief of Staff → Alignment Meeting → Planning → Delegation → Specialist Agents → Tools/Execution → Review → Validation → Project State → Memory/Learning`

The existing execution infrastructure remains valuable. The new product does **not** replace the worker/runtime foundation; it gives it an organizational brain, identity, context and user experience.

The system must evolve from:

> **task → worker → model → result**

to:

> **objective → organization → specialists → collaboration → verified outcome → organizational learning**

---

## 3. CURRENT PROBLEM TO SOLVE

The existing dashboard is visually confusing, task-heavy and operationally dense. A conventional list of tasks does not communicate:

- who is working;
- why they are working;
- how agents collaborate;
- where a decision came from;
- what is blocked;
- what the team learned;
- what the human needs to approve;
- how a project is progressing as an organization.

The redesign transforms the mental model from **task dashboard** into **living AI workplace**.

Task data remains available, but becomes a secondary operational layer rather than the main visual experience.

---

## 4. EXPERIENCE PRINCIPLES

### 4.1 Office first
The default screen opens into the office, not a spreadsheet.

### 4.2 Conversation first
The global office chat is the main command surface for the CEO.

### 4.3 Autonomous by default
Agents act without approval for ordinary, reversible and authorized work.

### 4.4 Human approval by exception
Escalation is reserved for sensitive actions, high-risk decisions, irreversible operations, financial commitments, external publication, credential/security changes and other explicitly configured boundaries.

### 4.5 Visible collaboration
The CEO should understand collaboration by watching the office and reading the conversation without opening dozens of task panels.

### 4.6 Persistent memory
Projects, decisions, artifacts, failures, successful patterns and useful discoveries become organizational memory and reusable skills.

### 4.7 Personality without sacrificing truth
Agents may have personality, preferences, humor and reactions, but personality must never fabricate execution state, project results, permissions or technical facts.

### 4.8 Visual simplicity
The office should be rich, atmospheric and alive while the interaction layer remains extremely clear.

### 4.9 Model independence
An agent is not a model. The agent owns identity, memory, skills, permissions and relationships; the model is the cognitive engine selected to perform a role.

---

## 5. THE OFFICE WORLD

The office is a shared virtual workplace inspired by:

- 1990s office environments;
- vintage corporate interiors;
- rock'n'roll culture of the era;
- desks, CRT-era visual references, papers, coffee, posters and personal objects;
- ensemble workplace-comedy energy without copying copyrighted characters, sets or exact assets.

The aesthetic should feel authentic, warm, slightly imperfect and lived-in, not sterile or futuristic.

The rendering technology may be 3D, 2.5D, isometric or hybrid. **The office metaphor is mandatory; literal rendering technology is not.**

Visual direction:

- warm vintage materials;
- wood, metal, paper and glass;
- personalized desks;
- contextual monitors/work surfaces;
- subtle ambient animation;
- believable lighting and depth;
- spatial department separation;
- restrained UI overlays.

---

## 6. OFFICE LAYOUT

### Engineering
- Backend Developer
- Frontend Developer
- Fullstack Developer
- DevOps / Infrastructure
- QA / Testing

### Creative
- Product Designer / UI UX
- Graphic Designer
- Video Editor
- Creative Director

### Growth
- SEO Analyst
- Media Buyer
- Social Media Manager
- Growth Analyst
- Researcher

### Communication
- Copywriter
- Customer Support / Atendimento
- Community / Relationship

### Business
- Product Manager
- Project / Operations Manager
- Finance
- Data / Analytics

### Leadership / Coordination
- Orchestrator / Chief of Staff
- CEO interface (human)

Departments and employees must be configurable. The orchestration engine must not hard-code the initial roster.

---

## 7. AGENT MODEL

Every agent is an autonomous organizational actor.

Minimum agent model:

- `id`
- `name`
- `role`
- `department`
- `specialties`
- `personality`
- `communicationStyle`
- `skills`
- `memory`
- `permissions`
- `approvalPolicy`
- `modelProfile`
- `currentProject`
- `currentTask`
- `status`
- `availability`
- `performanceHistory`
- `learningHistory`
- `relationships`
- `preferences`

Agent states include:

- `idle`
- `thinking`
- `in_meeting`
- `working`
- `reviewing`
- `collaborating`
- `waiting_for_dependency`
- `waiting_for_approval`
- `celebrating`
- `learning`
- `offline`
- `blocked`

The visual state must correspond to real runtime state whenever possible. Never animate an agent as working if the backend knows it is idle.

---

## 8. MODEL IS NOT THE AGENT

This is a foundational architectural rule.

The agent is the persistent organizational identity:

`Agent = Identity + Role + Personality + Memory + Skills + Permissions + Relationships + Model Profile`

The model is replaceable infrastructure.

Example:

```text
Agent: Chief of Staff
Role: Orchestrator
Primary model: NVIDIA Nemotron 3 Ultra (free)
Fallbacks: GPT-OSS 120B (free), configured router fallback
Memory: organizational + project
Skills: planning, delegation, risk assessment
Permissions: orchestration/tool routing
```

If a better model appears tomorrow, the office should be able to replace the cognitive engine without destroying the employee's identity, history or learned skills.

This prevents vendor/model lock-in and makes the workforce durable.

---

## 9. FREE MODEL WORKFORCE STRATEGY — OPENROUTER

For the current free-first phase, OpenRouter is the model access layer and the workforce uses **role-based model assignment**, not one model for every employee.

OpenRouter currently lists NVIDIA Nemotron 3 Ultra as a free model with up to 1M context, tool calling and explicit suitability for long-running agentic workflows, orchestration, coding agents, deep research and complex tasks. urlOpenRouter — Nemotron 3 Ultra freehttps://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free

### 9.1 Chief of Staff / Orchestrator

**Primary:** `nvidia/nemotron-3-ultra-550b-a55b:free`

Responsibilities:

- interpret CEO objectives;
- understand project context;
- identify required capabilities;
- create alignment meetings;
- select specialists;
- decompose work;
- establish dependencies;
- assess risk;
- coordinate execution;
- resolve or escalate conflicts;
- synthesize results;
- update project state;
- trigger memory and learning.

Nemotron 3 Ultra is the preferred free-first cognitive engine for this role because its published positioning directly targets reasoning, planning and agent orchestration. It also supports tool calling. citeturn0search10turn0search14

### 9.2 Engineering workforce

Preferred family:

**Qwen3-Coder free endpoint when available and healthy**, with other configured coding-capable free models as fallbacks.

Roles:

- Backend
- Frontend
- Fullstack
- DevOps
- QA

The engineering model profile must prioritize repository reasoning, coding, tool use, testing and multi-step implementation rather than conversational personality.

### 9.3 Generalist / research workforce

Preferred profile:

**GPT-OSS 120B free endpoint and other validated generalist free models.**

Suitable for:

- Researcher
- Product Manager
- SEO/Growth
- Copywriter
- Social Media
- Atendimento
- Finance analysis
- general analysis
- backup cognition

### 9.4 Specialized workers

Design, image, video, audio and other multimodal work should use specialized models/tools when available rather than forcing a text-only model to perform every function.

### 9.5 Model registry

The PDL must maintain a model registry containing at minimum:

- model id;
- provider;
- free/paid status;
- capabilities;
- context window;
- tool-calling support;
- structured-output support;
- latency/availability observations;
- role suitability;
- health status;
- fallback priority;
- last validation;
- known limitations.

The registry must be data-driven so model changes do not require rewriting orchestration logic.

---

## 10. DO NOT USE `OPENROUTER/FREE` AS THE AGENT IDENTITY

The generic `openrouter/free` router may be useful as an emergency or exploratory fallback, but it must not define the persistent identity of an employee.

The reason is consistency: a persistent employee needs predictable cognitive behavior, model provenance and reproducibility.

Recommended hierarchy:

```text
Agent
  ↓
Role Model Profile
  ↓
Primary Model
  ↓
Fallback Model
  ↓
Emergency Router
  ↓
Human escalation
```

Every execution must record the actual model used.

This makes failures, performance and learning auditable.

---

## 11. MODEL ROUTING CONTRACT

Every model invocation should carry enough metadata to explain why that model was selected.

Conceptual request:

```text
agent_id
project_id
objective_id
task_id
role
required_capabilities
model_profile
primary_model
fallback_models
approval_scope
tool_scope
context_refs
memory_refs
```

Runtime result should record:

```text
selected_model
provider
attempt
latency
usage
finish_reason
tool_calls
validation_result
fallback_used
error_class
```

Model routing must remain observable and deterministic enough to debug.

---

## 12. INITIAL SPECIALIST TEAM

1. **Orchestrator / Chief of Staff** — objective decomposition, meetings, delegation, dependencies and synthesis.
2. **Backend Developer** — APIs, services, databases, server logic and integrations.
3. **Frontend Developer** — UI, browser behavior, state and accessibility.
4. **Fullstack Developer** — cross-layer implementation and integration.
5. **Designer** — visual systems, UX, UI and creative direction.
6. **Copywriter** — copy, messaging, positioning and content.
7. **SEO / Growth Analyst** — organic acquisition, search strategy and growth analysis.
8. **Media Buyer** — paid acquisition, campaigns and performance analysis.
9. **Social Media Manager** — social strategy and publishing plans.
10. **Video Editor** — video production and editing workflows.
11. **Customer Support / Atendimento** — customer communication and triage.
12. **Finance** — financial analysis, budgets, costs and controls.
13. **QA Engineer** — validation, regression and quality gates.
14. **DevOps / Infrastructure** — environments, deployment and observability.
15. **Product Manager** — scope, prioritization and requirements.
16. **Researcher** — evidence gathering and contextual research.

---

## 13. GLOBAL OFFICE CHAT

The global chat is the primary command center.

The CEO:

1. selects a project;
2. describes an objective in natural language;
3. submits the request.

The request becomes a first-class office event.

The CEO can address:

- all agents;
- a department;
- a selected agent;
- the active project team;
- the Orchestrator.

Chat distinguishes:

- human messages;
- agent messages;
- system events;
- decisions;
- approvals;
- warnings;
- meeting events;
- assignments;
- execution results;
- learning events.

Low-value internal chatter is summarized for the CEO while the full audit trail remains available.

---

## 14. AUTOMATIC ALIGNMENT MEETING

A meaningful CEO objective triggers automatic organizational intake.

Flow:

`Intake → Team Selection → Alignment Meeting → Decomposition → Assignment → Dependency Graph → Risk Assessment → Execution → Review → Synthesis`

Every meeting creates a durable artifact containing:

- objective;
- participants;
- assumptions;
- decisions;
- assignments;
- dependencies;
- risks;
- approvals;
- deliverables;
- follow-ups.

The meeting is not cosmetic. It is the organizational planning boundary before autonomous execution.

---

## 15. PROJECTS ARE THE ORGANIZATIONAL UNIT

Each project maintains:

- objective;
- business context;
- repositories;
- active team;
- project memory;
- task graph;
- decisions;
- artifacts;
- execution history;
- approvals;
- risks;
- metrics;
- learned skills;
- outcomes.

Tasks exist inside project context.

---

## 16. AUTONOMY MODEL

Agents may normally perform without approval:

- analysis;
- repository inspection;
- planning;
- internal task creation/assignment;
- code changes in authorized workspaces;
- tests;
- reviews;
- revisions;
- drafts;
- research;
- internal documentation;
- agent communication;
- memory/skill updates;
- reversible authorized actions.

Human approval is required when configured thresholds are crossed, including:

- spending money;
- external publication;
- sensitive external communications;
- production data deletion;
- destructive infrastructure actions;
- security credential/secret changes;
- privilege changes;
- protected production deployment;
- legally or financially binding actions;
- sensitive user data;
- explicit `approval_required` actions.

Approval policy is configurable by project, agent, action, environment and risk.

---

## 17. DECISION SYSTEM

Agents should:

1. understand the objective;
2. inspect context;
3. identify uncertainty;
4. propose action;
5. consult specialists;
6. execute;
7. verify;
8. communicate;
9. record important decisions.

Disagreements should remain attributable and auditable. The Orchestrator is responsible for convergence, not for pretending consensus.

---

## 18. MEMORY ENGINE

Memory classes:

- company;
- project;
- agent;
- conversation;
- decision;
- technical;
- customer/context;
- failure;
- success patterns;
- procedures;
- skills.

Lifecycle:

`experience → extraction → validation → memory → retrieval → application → feedback`

Memory must carry relevance, confidence and provenance.

The system should distinguish durable institutional knowledge from temporary conversational context.

---

## 19. DAILY SKILL LEARNING

Work becomes organizational learning.

Lessons can originate from:

- completed tasks;
- failures;
- reviews;
- campaigns;
- customer interactions;
- design iterations;
- research;
- decisions;
- human corrections;
- agent feedback.

A lesson becomes a reusable skill only after sufficient evidence or explicit validation.

Skill record:

- name;
- description;
- capability;
- source experiences;
- confidence;
- version;
- last validation;
- applicable contexts;
- limitations.

Goal: **organizational compounding**.

---

## 20. MUSIC SYSTEM — THE OFFICE TURNTABLE

The office has a shared virtual turntable.

CEO capabilities:

- upload audio;
- manage office library;
- select track;
- play for the office.

Agents may have musical preferences and lightweight reactions. Reactions are ambient and non-blocking.

The system may learn team favorites and contextual associations such as focus or celebration music.

Audio remains subject to storage, access and copyright policies. The product must not imply licensing rights that do not exist.

---

## 21. OFFICE PERSONALITY

The office should feel alive but never fake operational activity.

Examples:

- agents ask one another questions;
- specialists review work;
- designers show drafts;
- QA reports regressions;
- finance comments on proposed spend;
- agents react to milestones;
- agents become idle or learning;
- the Orchestrator calls meetings.

Ambient behavior must originate from real state, relationships or permitted personality behavior.

---

## 22. AGENT RELATIONSHIPS

Relationships may represent actual collaboration:

- frequent collaborators;
- reviewer/reviewee;
- mentor/learner;
- dependency partners;
- department colleagues.

Relationships influence communication and collaboration routing but never override permissions or objective-based assignment.

---

## 23. VISUAL TASK SYSTEM

Tasks move into contextual views:

- project timeline;
- active work at desks;
- task details when selecting an agent;
- dependency visualization;
- project war room;
- compact status overlays;
- filters/search.

Default CEO question:

> **What is everyone doing, what matters now, and do you need me?**

Not:

> **How many task cards are in each column?**

---

## 24. CEO CONTROL SURFACE

Minimal persistent controls:

- project selector;
- global chat;
- new objective;
- office map;
- approvals;
- alerts;
- search;
- memory/knowledge;
- projects;
- settings.

Approval inbox exposes:

- requested action;
- requesting agent;
- reason;
- impact;
- risk;
- evidence/context;
- approve/reject/modify.

---

## 25. OBSERVABILITY WITHOUT NOISE

Backend telemetry remains complete while frontend uses progressive disclosure.

### Ambient
Simple status and visual cues.

### Project
Objective, progress, active agents and blockers.

### Agent
Task, model, tools, dependencies, recent decisions.

### Audit
Full event history, execution logs, model selection, retries, validation and Git artifacts.

The office UI is not the source of truth. **Durable backend state and event history are the source of truth.**

---

## 26. EVENT-DRIVEN OFFICE

Core events include:

- `PROJECT_CREATED`
- `OBJECTIVE_RECEIVED`
- `MEETING_CREATED`
- `AGENT_INVITED`
- `TASK_ASSIGNED`
- `TASK_STARTED`
- `TASK_BLOCKED`
- `AGENT_MESSAGE`
- `DECISION_PROPOSED`
- `DECISION_RECORDED`
- `APPROVAL_REQUESTED`
- `APPROVAL_GRANTED`
- `APPROVAL_REJECTED`
- `ARTIFACT_CREATED`
- `REVIEW_REQUESTED`
- `REVIEW_COMPLETED`
- `TASK_COMPLETED`
- `PROJECT_MILESTONE`
- `PROJECT_COMPLETED`
- `LEARNING_CAPTURED`
- `SKILL_PROMOTED`
- `MODEL_SELECTED`
- `MODEL_FALLBACK`
- `MODEL_ERROR`
- `MUSIC_STARTED`
- `MUSIC_CHANGED`

Events must be attributable, durable and replayable where practical.

---

## 27. MULTI-AGENT COLLABORATION

Collaboration requires:

- attributable messages;
- clear ownership;
- turn limits where appropriate;
- dependency tracking;
- escalation rules;
- timeouts;
- retries;
- conflict resolution;
- duplicate-work prevention;
- context boundaries.

Agents should not endlessly debate. The Orchestrator must enforce convergence and escalate meaningful uncertainty.

---

## 28. QUALITY CONTROL

A successful task requires verified outcome, not merely model output.

Validation may include:

- typecheck;
- unit tests;
- integration tests;
- build;
- lint;
- browser validation;
- API contract validation;
- visual validation;
- security checks;
- Git diff inspection.

Reviews and validation results become project evidence and learning input.

---

## 29. GIT AND ARTIFACTS

Git remains the engineering audit mechanism.

The office should expose Git context only when useful:

- branch;
- commit;
- changed files;
- validation result;
- review status;
- merge readiness.

Agents must never claim a commit, deployment, test or external action that did not actually occur.

---

## 30. PROJECT HANDOFFS

Every completed or paused work package should preserve:

- completed work;
- remaining work;
- files/artifacts;
- assumptions;
- risks;
- tests;
- validation evidence;
- next action.

Handoffs must be structured enough for another agent to continue without reconstructing the entire history.

---

## 31. FAILURE AND RECOVERY

Failures are first-class organizational events.

The system should:

1. record the failure;
2. classify it;
3. determine whether retry is safe;
4. retry with bounded policy when appropriate;
5. consult another specialist/model when useful;
6. preserve evidence;
7. escalate meaningful blockers;
8. capture reusable lessons.

Repeated failures should influence model routing, skills and future planning.

---

## 32. SECURITY AND TRUST

Principles:

- least privilege;
- explicit tools;
- project-scoped credentials;
- environment separation;
- approval gates;
- auditability;
- secret redaction;
- provenance;
- durable decisions;
- no fabricated execution claims.

**Important free-model rule:** confidential information, secrets, personal data and sensitive project material must not be sent to free endpoints unless the applicable privacy/data-processing policy explicitly permits it. OpenRouter's current Nemotron 3 Ultra free endpoint page explicitly warns users not to upload confidential or personal information and states that free-endpoint use is logged for security/improvement purposes. citeturn0search12

Therefore the PDL must implement data classification before model routing.

Conceptually:

```text
PUBLIC / NON-SENSITIVE
  → free models allowed

INTERNAL
  → free only if policy allows

CONFIDENTIAL / PERSONAL / SECRETS
  → restricted provider/model or local execution
```

This policy is mandatory before production autonomy.

---

## 33. MODEL HEALTH AND FALLBACK

Free models are useful for prototyping and early validation but are rate-limited and availability can vary. OpenRouter documents a broad free-model roster and common free-model constraints. citeturn0search11turn0search16

The PDL must therefore treat model availability as runtime state.

Fallback chain:

`Primary → validated fallback → alternate specialist → emergency router → human escalation`

Fallback must preserve:

- agent identity;
- project context;
- task ownership;
- tool permissions;
- audit trail.

Only the cognitive engine changes.

The system must record whether fallback was used and why.

---

## 34. TECHNICAL ARCHITECTURE DIRECTION

The target architecture is:

```text
CEO / Office UI
      ↓
Global Office Chat
      ↓
Project Context
      ↓
Chief of Staff / Orchestrator
      ↓
Alignment Meeting + Planning
      ↓
Delegation / Dependency Graph
      ↓
Agent Runtime
      ↓
Model Registry + Model Router
      ↓
Tools / Repositories / APIs / Browsers / Execution
      ↓
Validation / Review / Finalization
      ↓
Project State + Audit Events
      ↓
Memory + Skill Learning
      ↺
```

The existing PUB DEV LOOP queue/worker/provider foundation remains underneath this organizational layer.

The 3D/2.5D office UI is a projection of state, not the state itself.

---

## 35. MVP PHASES

### Phase A — Foundation

- office shell;
- agent registry;
- project/team state;
- global chat;
- real backend task state;
- model registry;
- role-based model profiles.

### Phase B — Orchestration

- objective intake;
- specialist selection;
- automatic meetings;
- decomposition;
- assignment;
- dependencies;
- communication.

### Phase C — Autonomous execution

- workers;
- permissions;
- model routing;
- tool execution;
- validation;
- handoffs;
- recovery;
- approval gates.

### Phase D — Memory and learning

- project memory;
- agent memory;
- organizational memory;
- lesson extraction;
- skill promotion;
- model-performance learning.

### Phase E — Living Office

- desks;
- animations;
- personalities;
- relationships;
- music/turntable;
- environmental events;
- customization.

### Phase F — Advanced organization

- dynamic hiring/specialist creation;
- role evolution;
- performance analytics;
- knowledge graph;
- adaptive orchestration;
- model optimization by role and workload.

---

## 36. NON-GOALS

The Office must not become:

- a decorative 3D screensaver;
- a game that hides operational truth;
- a Slack clone;
- a Kanban board with avatars;
- a collection of fake agents;
- a system that asks approval for every tiny action;
- an uncontrolled autonomous loop;
- a model-dependent identity system.

---

## 37. SUCCESS CRITERIA

The CEO should quickly answer:

- What projects are active?
- What is the office working on?
- Which agents are responsible?
- What decisions were made?
- What is blocked?
- Does the office need me?
- What did the organization learn?
- Which model actually executed the work?
- Was fallback required?
- Was the result validated?

The CEO should be able to initiate meaningful work using natural language without constructing a technical task graph manually.

---

## 38. THE OFFICE NORTH STAR

The CEO opens the office.

The CEO selects a project and states an objective.

The Orchestrator acknowledges the objective, creates the alignment meeting, selects specialists and divides the work.

Agents move to their desks, collaborate, execute, review and communicate.

The CEO observes the organization without micromanaging it.

A sensitive action triggers an approval request.

The CEO approves, rejects or modifies it.

Agents continue.

The project reaches validation.

The Orchestrator synthesizes the result.

The organization records what it learned.

The office returns to a calm working state, ready for the next objective.

---

## 39. MASTER PRODUCT PRINCIPLE

> **The office is the body.**
>
> **Agents are the employees.**
>
> **The global chat is the communication system.**
>
> **The Chief of Staff is the organizational brain.**
>
> **Projects are the missions.**
>
> **Memory is institutional knowledge.**
>
> **Skills are accumulated capability.**
>
> **Models are replaceable cognitive engines.**
>
> **Git and execution logs are the audit trail.**
>
> **The CEO is the human authority.**
>
> **Music and personality give the workplace life.**
>
> **The backend remains the source of truth.**
>
> **The organization learns from every verified experience.**

---

## 40. DECISION LOCK

Every major product, UX or architecture decision should be evaluated by one question:

> **Does this make PUB DEV LOOP more like a clear, trustworthy autonomous AI workplace, or does it merely add another dashboard feature?**

If a feature increases visual complexity without increasing organizational clarity, autonomy, collaboration, memory, learning or trust, it should not be prioritized.

If a feature strengthens the organization's ability to understand objectives, select the right specialists, execute work, verify outcomes and compound knowledge, it belongs in The Office.

---

## 41. IMPLEMENTATION PRIORITY AFTER THIS CONTEXT

The immediate engineering priority is **not** to build every visual detail at once.

First establish the organizational contract:

1. Agent Registry
2. Project Context
3. Model Registry
4. Model Profile / Role Routing
5. Global Office Chat
6. Objective Intake
7. Chief of Staff / Orchestrator
8. Alignment Meeting artifact
9. Task decomposition + dependencies
10. Real agent execution state
11. Approval gates
12. Event/audit stream
13. Memory hooks
14. Skill-learning hooks
15. Office visual projection
16. Personality/music/ambient systems

The office UI should grow on top of real state rather than inventing state first.

---

## 42. FINAL RULE

**Never optimize The Office to look intelligent. Optimize it to actually become an increasingly capable organization, then make that reality visible.**
