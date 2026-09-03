# THE OFFICE MASTER CONTEXT

## PUB DEV LOOP — The Office

**Status:** Product vision / master context
**Version:** 1.2
**Role:** Source of truth for the next evolution of PUB DEV LOOP product, UX, agent orchestration, model routing, memory, learning and virtual-office experience.

---

## 1. PRODUCT THESIS

PUB DEV LOOP must not feel like a generic AI dashboard, chatbot wrapper or task-management SaaS.

The core product metaphor is an **AI company operating as a living shared office**.

Each AI agent is an employee with a specialty, desk, personality, responsibilities, memory and evolving skills. Agents collaborate, debate, delegate, execute projects, review work and learn from what happens.

The human operator is the **CEO / decision maker**. The CEO is also a visible participant in the office through a persistent CEO avatar. The CEO does not micromanage ordinary execution. Agents autonomously move work forward and request human authorization only when a defined sensitivity or risk threshold is reached.

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

## 3. CURRENT PRODUCT DIRECTION

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

### Current priority

The immediate product evolution is to make **The Office** a real-time visual representation of the agent workforce rather than a static dashboard with decorative characters.

The office must communicate real organizational activity: work, thinking, collaboration, conversations, delegation, waiting, approvals, meetings and project progress.

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

### 4.10 Real-time truth
Visual activity must be driven by actual runtime state and events whenever available. The renderer must not invent work, conversations or progress merely to make the office look busy.

### 4.11 CEO presence
The CEO is a first-class office actor, not merely an external controller. The CEO has a persistent avatar and can eventually move through the office, approach employees and participate spatially in conversations and meetings.

### 4.12 Portuguese-first interface
The entire user-facing Office experience must be in **Brazilian Portuguese (pt-BR)**. Internal identifiers, APIs and code may remain in English when appropriate, but visible labels, statuses, controls, empty states, system messages and interaction copy must not be inconsistently mixed with English.

---

## 5. THE OFFICE WORLD

The office is a shared virtual workplace inspired by:

- 1990s office environments;
- vintage corporate interiors;
- rock'n'roll culture of the era;
- desks, CRT-era visual references, papers, coffee, posters and personal objects;
- ensemble workplace-comedy energy without copying copyrighted characters, sets or exact assets;
- spatial virtual-office experiences such as Gather for avatar presence, movement, desks and social interaction.

The product may take **UX inspiration from Gather**, especially the sense of presence created by avatars, personal desks, spatial proximity and lightweight conversation. It must not copy Gather's proprietary assets, branding or exact visual implementation.

The rendering technology may be 3D, 2.5D, isometric or hybrid. **The office metaphor is mandatory; literal rendering technology is not.** The first implementation decision must be based on an audit of the renderer already present in the repository, not on an assumption that the project must use a new graphics engine.

Visual direction:

- warm vintage materials;
- wood, metal, paper and glass;
- personalized desks;
- contextual monitors/work surfaces;
- subtle ambient animation;
- believable lighting and depth;
- spatial department separation;
- restrained UI overlays;
- readable characters at normal desktop zoom;
- speech bubbles that are legible without dominating the scene.

The office should feel like a real workplace that happens to be operated by autonomous AI employees.

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

Every employee should have a stable office identity and a configurable desk/location. Desk position must not be treated as merely decorative metadata: it is part of the visual identity of the employee and can later support spatial interaction.

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
- `officePosition`
- `avatarProfile`

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

The renderer should expose a mapping from runtime state to visual state/animation, but the backend remains the source of truth for whether work is actually occurring.

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

OpenRouter currently lists NVIDIA Nemotron 3 Ultra as a free model with up to 1M context, tool calling and explicit suitability for long-running agentic workflows, orchestration, coding agents, deep research and complex tasks.

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

### 13.1 Chat-to-office event contract

Every meaningful chat message should be representable as a first-class event that the Office renderer can consume.

At minimum:

```text
MESSAGE_SENT
MESSAGE_RECEIVED
AGENT_STARTED_WORK
AGENT_FINISHED_WORK
AGENT_DELEGATED
AGENT_RESPONDED
AGENT_STATUS_CHANGED
MEETING_STARTED
MEETING_ENDED
APPROVAL_REQUESTED
APPROVAL_GRANTED
APPROVAL_REJECTED
```

The visual layer must subscribe to these events without becoming responsible for orchestration logic.

---

## 14. REAL-TIME OFFICE SIMULATION

The Office is a **live visualization of organizational state**, not a pre-scripted animation.

### 14.1 Runtime → visual pipeline

```text
Agent Runtime
    ↓
Runtime State / Events
    ↓
Office State Store
    ↓
Office Renderer
    ↓
Avatar State + Animation + Movement + Speech Bubble
```

The office should update in near real time when an agent changes state, receives work, sends a message, starts a meeting, delegates work or completes a meaningful action.

### 14.2 Agent visual states

At minimum the visual system should support:

- idle — seated/available;
- thinking — reasoning/considering;
- working — actively executing work;
- collaborating — interacting with another employee;
- in meeting — participating in a meeting;
- reviewing — inspecting another agent's work;
- waiting for dependency — blocked on another employee/system;
- waiting for approval — awaiting CEO authorization;
- learning — processing a validated lesson/skill update;
- celebrating — successful meaningful outcome;
- blocked — execution cannot continue;
- offline — unavailable.

Visual animations must be subtle and informative. They must never imply an execution state that the runtime does not support.

### 14.3 Conversations in the physical office

When a meaningful message is sent by the CEO or an agent, a **speech/message bubble appears above the corresponding character**.

Examples:

```text
CEO → Agent
Agent → CEO
Agent → Agent
Agent → Department
Agent → Project Team
```

The bubble should:

- identify the speaker when necessary;
- show concise message content;
- appear near the character who sent it;
- have a short, readable display lifetime;
- avoid covering important UI or characters;
- allow the full message to remain available in the chat/audit trail;
- be driven by the real message event rather than scripted text.

If several messages occur rapidly, the renderer should queue, collapse or summarize bubbles rather than creating visual noise.

### 14.4 Agent-to-agent interaction

The visual office must eventually represent real collaboration between agents.

Conceptual flow:

```text
CEO objective
    ↓
Chief of Staff
    ↓
Developer
    ↕
Designer
    ↕
QA
    ↓
Project result
```

The physical representation may initially be lightweight (look/gesture/bubble/status) and later evolve into spatial movement between desks, meeting areas and departments.

### 14.5 CEO avatar

The CEO must have a persistent avatar with a dedicated position in the office.

The CEO avatar should be visually distinguishable from AI employees while fitting the same world.

The architecture must allow future capabilities such as:

- keyboard/click movement;
- camera following;
- approaching an employee;
- opening a direct conversation;
- participating in meetings;
- observing a workstation;
- selecting/interacting with desks and rooms.

The CEO avatar is part of the Office state model, not merely a decorative overlay.

---

## 15. CHARACTER / AVATAR SYSTEM

Characters should be inspired by the **functional UX of virtual-office platforms such as Gather**: recognizable avatar identity, personal presence, spatial positioning, desk ownership and lightweight social interaction.

Do not copy proprietary Gather assets or exact character designs.

### Avatar requirements

Each agent avatar should have:

- stable identity;
- role/personality visual cues;
- configurable appearance;
- persistent office position;
- animation states mapped to runtime state;
- speech bubble anchor point;
- interaction target;
- accessibility-friendly label/name.

The visual system must support adding/removing/reassigning employees without requiring hard-coded character logic.

### Character rendering decision

Before introducing a new rendering engine, the implementation agent must audit the current repository and determine whether the existing renderer can support the desired experience.

Preferred order:

1. reuse existing renderer and architecture when viable;
2. extend the existing renderer with the minimum necessary primitives;
3. introduce a new graphics dependency only when justified by concrete limitations.

The choice between 3D, 2.5D, isometric and hybrid must be evidence-based.

---

## 16. OFFICE STATE MODEL

The frontend should have a normalized office state derived from durable backend state and live events.

Conceptual model:

```text
OfficeState
  ├── employees[]
  ├── ceo
  ├── departments[]
  ├── rooms[]
  ├── projects[]
  ├── activeConversations[]
  ├── speechBubbles[]
  ├── meetings[]
  ├── officeEvents[]
  └── lastUpdated
```

An employee visual record may contain:

```text
employeeId
position
facing
status
currentProject
currentTask
activeConversation
avatarProfile
speechBubble
```

This state should be derived from the existing canonical agent/project/chat stores where possible rather than duplicated as a second source of truth.

---

## 17. AUTOMATIC ALIGNMENT MEETING

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

The Office should eventually visualize active meetings as real spatial events rather than merely as text in the chat.

---

## 18. PROJECTS ARE THE ORGANIZATIONAL UNIT

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

The Office should make the active project visible without turning the entire screen into a task board.

---

## 19. AUTONOMY MODEL

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

## 20. DECISION SYSTEM

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

## 21. MEMORY ENGINE

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

### Implementation Status:
* **Phase 8.1 (Real Memory Engine):** PostgreSQL `organizational_memories` table, `OrganizationalMemoryStore`, `MemoryIngestPipeline`, deterministic `MemoryRetrievalEngine`, authenticated `GET /office/memory` endpoint.
* **Phase 8.2A / 8.2B (Developer Memory Integration):** `enrichDeveloperTaskWithMemory` connects verified organizational memories (`TASK_RESULT`, `REVIEW_FINDING`, `LESSON`, `PROJECT_CONTEXT`) to Developer execution before `provider.execute()` with strict tenant authority, project isolation, max 5 memories cap, 500 chars limit, failure isolation and precedence notice.
* **Phase 8.3A (Architect Memory Integration):** `enrichArchitectTaskWithMemory` connects verified organizational memories (`DECISION`, `PLAN`, `REVIEW_FINDING`, `PROJECT_CONTEXT`) to Architect execution before `provider.execute()` adhering strictly to the same security boundaries.
* **Phase 8.3B (Reviewer Memory Integration):** `enrichReviewerTaskWithMemory` connects verified organizational memories (`REVIEW_FINDING`, `TASK_RESULT`, `PROJECT_CONTEXT`) to Reviewer execution before `provider.execute()` as supplementary historical context under absolute precedence of current execution/review evidence (`MAX_REVIEW_ITERATIONS = 3` guardrail strictly preserved).
* **Phase 8.3C (QA Engineer Memory Integration):** `enrichQaTaskWithMemory` connects verified organizational memories (`TASK_RESULT`, `REVIEW_FINDING`, `LESSON`, `PROJECT_CONTEXT`) to QA Engineer execution before `provider.execute()` as supplementary historical context under absolute precedence of current test execution evidence / regression results.
* **Pending Next Phases:** Chief of Staff integration.

---

## 22. DAILY SKILL LEARNING

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

## 23. MUSIC SYSTEM — THE OFFICE TURNTABLE

The office has a shared virtual turntable.

CEO capabilities:

- upload audio;
- manage office library;
- select track;
- play for the office.

Agents may have musical preferences and lightweight reactions. Reactions are ambient and non-blocking.

The system may learn team favorites and adapt ambient behavior without affecting execution logic.

---

## 24. UI / LANGUAGE STANDARD

The Office user experience is **pt-BR first**.

Visible text must be translated consistently, including:

- navigation;
- buttons;
- chat labels;
- agent statuses;
- project labels;
- timeline labels;
- empty states;
- errors;
- approval prompts;
- system events;
- tooltips;
- accessibility labels;
- onboarding/help copy.

Examples:

```text
Office → Escritório
Agents → Agentes / Funcionários
Working → Trabalhando
Thinking → Pensando
Idle → Ocioso
Reviewing → Revisando
Collaborating → Colaborando
Waiting for approval → Aguardando aprovação
Projects → Projetos
Activity → Atividade
Timeline → Linha do tempo
Send → Enviar
```

English may remain in code-level identifiers and technical metadata when that is the project's established convention.

---

## 25. IMPLEMENTATION RULES FOR THE OFFICE

### 25.1 Audit before rewriting
Before changing the rendering architecture, inspect:

- `THEOFFICEMASTERCONTEXT.md`;
- frontend entry points;
- `scenes/`;
- `components/`;
- `store/`;
- chat implementation;
- agent state implementation;
- event/state synchronization;
- existing graphics dependencies;
- CSS/layout constraints;
- current browser/runtime validation tooling.

### 25.2 Do not create fake activity
No random “working” loops, fake conversations or fake progress should be presented as real agent activity.

Ambient animations are allowed only when clearly decorative and must not be confused with execution state.

### 25.3 Keep the office and orchestration decoupled
The renderer observes organizational state/events. It must not become the owner of agent orchestration, model routing, task execution or business rules.

### 25.4 Preserve existing execution infrastructure
The Office evolution must not replace the proven queue/worker/provider/finalization foundation merely to achieve visual effects.

### 25.5 Prefer incremental implementation
The recommended sequence is:

`Audit → Renderer Contract → Office State → CEO Avatar → Agent Avatars → Real-time Status → Chat Bubbles → Agent-to-Agent Events → Spatial Movement → Meetings/Rooms → Polish`

### 25.6 Validate at real desktop resolutions
The Office must be validated at multiple desktop resolutions and browser conditions. Layout changes must preserve the already-fixed CEO chat input behavior.

---

## 26. CURRENT P5.8 BASELINE

The most recent completed Office hotfix is:

**P5.8 — THE OFFICE GLOBAL CHAT INPUT VISIBILITY**

Commit:

`9633e70300cfadcd2e8307d51605576357542602`

The fix corrected Grid/Flex sizing so the CEO chat input remains visible across desktop resolutions.

Validated resolutions:

- 1920×1080;
- 1650×900;
- 1366×768.

Validation included frontend/backend builds, typecheck, 178/178 tests and browser DOM measurements.

The working tree was clean and `origin/main` matched HEAD at completion.

**This baseline must be preserved while implementing the next Office evolution.**

---

## 27. CURRENT NEXT PHASE — LIVE VIRTUAL WORKFORCE

The next Office phase is not a generic visual redesign.

### Objective

Transform the existing Office visualization into a **live virtual workplace where the CEO and AI employees visibly exist, work and communicate in real time**.

### Required capabilities

1. Entire visible Office interface in pt-BR.
2. Audit and reuse the existing renderer where technically viable.
3. Persistent character for every configured agent.
4. Persistent CEO character.
5. Persistent desk/location for each employee.
6. Runtime-driven employee states.
7. Real-time synchronization between backend events and Office state.
8. CEO chat messages represented visually above the CEO avatar.
9. Agent messages represented visually above the sending agent.
10. Agent-to-agent communication represented visually.
11. Speech bubbles with sensible queuing/collapsing to avoid clutter.
12. Future-ready movement and spatial interaction inspired by Gather's UX patterns.
13. Office view remains the primary interface; operational panels remain secondary.
14. No fake execution state.
15. No unnecessary renderer rewrite without an audit and technical justification.

### First engineering task

Before implementing the full experience, the implementation agent must perform a repository-level audit and return:

- current renderer technology;
- relevant renderer files;
- current agent data model;
- current office/scene model;
- current chat/event flow;
- current store architecture;
- existing animation/character support;
- existing dependencies that can be reused;
- gaps between current implementation and this Master Context;
- recommended implementation architecture;
- incremental migration plan;
- risks and compatibility concerns.

The audit should **not modify production code** unless explicitly instructed after the plan is approved.

---

## 28. NON-NEGOTIABLE PRODUCT RULES

1. **The Office is the product experience, not decoration.**
2. **Agents are employees, not interchangeable chat sessions.**
3. **The CEO is a visible participant with an avatar.**
4. **Runtime truth drives visual state.**
5. **Meaningful messages create visible communication events.**
6. **Agent-to-agent collaboration must be observable.**
7. **The global chat remains the CEO command surface.**
8. **Portuguese is the user-facing language.**
9. **Gather is a UX inspiration, not an asset/source-code dependency.**
10. **Do not rewrite the renderer before auditing what already exists.**
11. **Do not fake agent activity.**
12. **Do not compromise the proven execution/runtime foundation for visual effects.**
13. **Every visual interaction must remain secondary to organizational truth and usability.**
14. **The office should become more alive as the underlying workforce becomes more autonomous, not through artificial animation.**
