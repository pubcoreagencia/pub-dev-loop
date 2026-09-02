# THE OFFICE MASTER CONTEXT

## PUB DEV LOOP — The Office

**Status:** Product vision / master context  
**Version:** 1.0  
**Role:** Source of truth for the next evolution of PUB DEV LOOP's product, UX, agent orchestration and virtual-office experience.

---

## 1. PRODUCT THESIS

PUB DEV LOOP must not feel like a generic AI dashboard or a task-management SaaS.

The core product metaphor is an **AI company operating as a living shared office**.

Each AI agent is an employee with a specialty, desk, personality, responsibilities, memory and evolving skills. Agents collaborate with one another, receive work, debate decisions, delegate subtasks, execute projects and learn from what happens.

The human operator is the **CEO / decision maker**. The CEO does not micromanage ordinary execution. The office is designed so that agents autonomously move work forward and request human authorization only when a defined sensitivity or risk threshold is reached.

### Core promise

> **Give the office an objective. The team figures out how to execute it.**

The visual office is not decoration. It is the primary human interface for understanding what the autonomous organization is doing.

---

## 2. CURRENT PROBLEM TO SOLVE

The existing PUB DEV LOOP dashboard is visually confusing, task-heavy and operationally dense. A conventional list of tasks does not communicate:

- who is working;
- why they are working;
- how agents collaborate;
- where a decision came from;
- what is blocked;
- what the team learned;
- what the human needs to approve;
- how the project is progressing as an organization.

The redesign must transform the mental model from **"task dashboard"** into **"living AI workplace"**.

Task data remains available, but it becomes a secondary operational layer rather than the main visual experience.

---

## 3. EXPERIENCE PRINCIPLES

### 3.1 Office first

The default screen opens into the office, not a spreadsheet.

### 3.2 Conversation first

The global office chat is the main command surface for the CEO.

### 3.3 Autonomous by default

Agents should act without requiring approval for ordinary, reversible and authorized work.

### 3.4 Human approval by exception

Escalation is reserved for sensitive actions, high-risk decisions, irreversible operations, financial commitments, external publication, credential/security changes and other explicitly configured boundaries.

### 3.5 Visible collaboration

The CEO should be able to understand collaboration by watching the office and reading the conversation, without opening dozens of task panels.

### 3.6 Persistent memory

Projects, decisions, artifacts, failures, successful patterns and useful discoveries become organizational memory and reusable skills.

### 3.7 Personality without sacrificing truth

Agents may have personality, preferences, humor and reactions, but personality must never fabricate execution state, project results, permissions or technical facts.

### 3.8 Visual simplicity

The office should be rich, atmospheric and alive while the interaction layer remains extremely clear.

---

## 4. THE OFFICE WORLD

The office is a shared virtual workplace inspired by:

- 1990s office environments;
- vintage corporate interiors;
- rock'n'roll culture of the era;
- desks, CRT-era visual references, papers, coffee, posters and personal objects;
- a workplace atmosphere inspired by ensemble office comedies such as *The Office*, without copying copyrighted characters, sets or exact visual assets.

The aesthetic should feel **authentic, warm, slightly imperfect and lived-in**, not like a sterile futuristic SaaS dashboard.

### Visual direction

- warm vintage materials;
- wood, metal, paper, glass and old office furniture;
- period-inspired posters and music references;
- desks with personalized objects;
- monitors and work surfaces showing contextual activity;
- subtle ambient animation;
- believable lighting and depth;
- clear spatial separation between departments;
- restrained UI overlays so the environment remains the hero.

The visual style may evolve from 3D toward 2.5D/isometric or hybrid rendering if that materially improves performance and usability. **The office metaphor is mandatory; literal rendering technology is not.**

---

## 5. OFFICE LAYOUT

The office is organized into departments rather than a wall of task cards.

Suggested areas:

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

Departments are extensible. The architecture must not hard-code the current employee list.

---

## 6. AGENT MODEL

Every agent is an autonomous organizational actor.

Each agent should have, at minimum:

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
- `currentProject`
- `currentTask`
- `status`
- `availability`
- `performanceHistory`
- `learningHistory`
- `relationships`
- `preferences`

### Agent states

Examples:

- idle
- thinking
- in_meeting
- working
- reviewing
- collaborating
- waiting_for_dependency
- waiting_for_approval
- celebrating
- learning
- offline
- blocked

The visual state must correspond to real runtime state whenever possible. Never animate an agent as working if the backend knows it is idle.

---

## 7. INITIAL SPECIALIST TEAM

The initial team should include at least:

1. **Orchestrator / Chief of Staff** — decomposes objectives, organizes meetings, assigns work, resolves dependencies and monitors the whole project.
2. **Backend Developer** — APIs, services, databases, server logic and integrations.
3. **Frontend Developer** — UI implementation, browser behavior, state and accessibility.
4. **Fullstack Developer** — cross-layer implementation and integration.
5. **Designer** — visual systems, UX, UI and creative direction.
6. **Copywriter** — copy, messaging, positioning and content.
7. **SEO / Growth Analyst** — organic acquisition, search strategy and growth analysis.
8. **Media Buyer** — paid acquisition, campaigns, experiments and performance analysis.
9. **Social Media Manager** — social strategy, publishing plans and community-facing content.
10. **Video Editor** — video production and editing workflows.
11. **Customer Support / Atendimento** — customer communication, support and issue triage.
12. **Finance** — financial analysis, budgets, costs and financial controls.
13. **QA Engineer** — validation, regression, quality gates and acceptance criteria.
14. **DevOps / Infrastructure** — environments, deployment, observability and infrastructure.
15. **Product Manager** — product scope, prioritization, requirements and product decisions.
16. **Researcher** — external research, evidence gathering and competitive/context analysis.

New specialists can be added through configuration rather than rewriting the orchestration engine.

---

## 8. GLOBAL OFFICE CHAT

The global chat is the primary command center.

The CEO can:

1. open the global chat;
2. select a project;
3. describe an objective in natural language;
4. submit the request.

The request becomes a first-class event in the office conversation.

Example:

> CEO: "Projeto PUB ECOM — precisamos melhorar a experiência de importação de produtos e deixar o fluxo pronto para validação."

The office receives the request as a project objective, not merely as a task-card creation.

### Chat participants

The CEO can converse with:

- all agents;
- a department;
- a selected agent;
- the active project team;
- the Orchestrator.

Agents can address each other explicitly and the system should make the communication graph visible without becoming noisy.

### Chat rules

The chat must distinguish:

- human messages;
- agent messages;
- system events;
- decisions;
- approvals;
- warnings;
- meeting events;
- task assignments;
- execution results;
- learning events.

Do not flood the CEO with internal machine chatter. The system needs an **intelligent communication layer** that summarizes low-value internal events while preserving the complete audit trail.

---

## 9. AUTOMATIC ALIGNMENT MEETING

When the CEO creates a meaningful project objective, the Orchestrator automatically evaluates the request.

### Meeting flow

**1. Intake**

Capture objective, project, constraints, desired outcome and urgency.

**2. Team selection**

Select specialists based on required capabilities.

**3. Alignment meeting**

Create an internal meeting in the office.

**4. Decomposition**

Break the objective into outcomes, work packages and dependencies.

**5. Assignment**

Assign each work package to the best specialist or specialist pair.

**6. Dependency graph**

Establish execution order and parallelizable work.

**7. Risk assessment**

Identify sensitive actions and approval requirements.

**8. Execution**

Agents begin work autonomously.

**9. Review**

Agents review each other's work where appropriate.

**10. Synthesis**

Orchestrator consolidates results and updates the project state.

### Meeting artifact

Every meeting produces a durable record containing:

- objective;
- participants;
- assumptions;
- decisions;
- assignments;
- dependencies;
- risks;
- approvals required;
- expected deliverables;
- follow-up actions.

---

## 10. PROJECTS ARE THE ORGANIZATIONAL UNIT

A project is more important than an isolated task.

Each project should maintain:

- objective;
- business context;
- repository/repositories;
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
- final outcomes.

Tasks exist inside this project context.

This prevents the system from becoming a disconnected task queue.

---

## 11. AUTONOMY MODEL

Agents operate autonomously within explicit boundaries.

### Agents may normally do without human approval

- analyze project context;
- inspect repositories;
- create implementation plans;
- create and assign internal tasks;
- write code in authorized workspaces;
- run tests;
- review other agents' work;
- revise failed work;
- create drafts;
- research information;
- update internal project documentation;
- communicate with other agents;
- improve internal skills and memory;
- perform reversible project actions within granted permissions.

### Human approval is required when configured thresholds are crossed

Examples:

- spending money;
- publishing externally;
- sending sensitive external communications;
- deleting production data;
- destructive infrastructure actions;
- changing security credentials or secrets;
- granting new privileges;
- deploying to protected production environments;
- legally or financially binding actions;
- actions involving sensitive user data;
- actions explicitly marked `approval_required`.

Approval policies must be configurable by project, agent, action type and environment.

---

## 12. DECISION SYSTEM

Agents should not merely execute instructions mechanically.

They should:

1. understand the objective;
2. inspect relevant context;
3. identify uncertainty;
4. propose a course of action;
5. consult specialists when necessary;
6. execute;
7. verify;
8. communicate the result;
9. record important decisions.

When specialists disagree, the system should preserve the disagreement and reasoning summary rather than hiding it.

The Orchestrator is responsible for convergence, not for pretending every decision was unanimous.

---

## 13. MEMORY ENGINE

PUB DEV LOOP should develop an organizational memory layer.

### Memory classes

- company memory;
- project memory;
- agent memory;
- conversation memory;
- decision memory;
- technical memory;
- customer/context memory;
- failure memory;
- success patterns;
- reusable procedures;
- skills.

### Memory lifecycle

`experience → extraction → validation → memory → retrieval → application → feedback`

Not everything should become permanent memory. Memory must have relevance, confidence and provenance.

---

## 14. DAILY SKILL LEARNING

Every workday becomes a learning opportunity.

Agents should identify useful lessons from:

- completed tasks;
- failed tasks;
- code reviews;
- successful campaigns;
- customer interactions;
- design iterations;
- research;
- project decisions;
- corrections from humans;
- agent-to-agent feedback.

### Skill promotion

A temporary lesson can become a reusable skill only after sufficient evidence or explicit validation.

Each skill should track:

- name;
- description;
- capability;
- source experiences;
- confidence;
- version;
- last validated date;
- applicable contexts;
- known limitations.

The goal is **organizational compounding**: the PUB team becomes better because it remembers what it has learned.

---

## 15. MUSIC SYSTEM — THE OFFICE TURNTABLE

The office contains a shared virtual turntable / record player.

The CEO can:

1. upload audio files;
2. see the office music library;
3. select a track;
4. press play;
5. make the track audible to everyone in the office.

The selected track becomes an environmental event.

### Agent interaction with music

Agents may have musical preferences as part of personality configuration.

While music plays, agents can produce lightweight contextual reactions such as:

- liking the song;
- disliking it;
- recognizing a genre;
- commenting on the mood;
- changing conversational tone;
- suggesting another track.

These reactions must be **non-blocking ambient behavior**. Music must never distract the core work experience.

### Music memory

The system may optionally learn:

- tracks frequently played;
- team favorites;
- individual agent preferences;
- contextual associations such as "focus music" or "celebration music".

Audio files remain governed by storage, access and copyright policies. The system should not imply that uploaded music is licensed for redistribution.

---

## 16. OFFICE PERSONALITY

The office should feel alive, but not chaotic.

Possible ambient behaviors:

- an agent asks another agent a quick question;
- two agents discuss a technical choice;
- a designer shows a draft to the copywriter;
- QA reports a regression to engineering;
- finance comments on a proposed spend;
- agents react to project completion;
- an agent takes a break / becomes idle;
- the Orchestrator calls a meeting;
- agents celebrate a major milestone.

Ambient interactions must be generated from actual state and relationships whenever possible.

The system must never create fake operational activity merely to make the office look busy.

---

## 17. AGENT RELATIONSHIPS

Agents may build lightweight organizational relationships based on actual collaboration.

Examples:

- frequently collaborating;
- reviewer/reviewee;
- mentor/learner;
- dependency partner;
- department colleague.

Relationships can influence communication style and collaboration routing, but must never override project permissions or objective-based assignment.

---

## 18. VISUAL TASK SYSTEM

The task system should remain available but move into contextual views.

Instead of a giant dashboard of cards, use:

- project timeline;
- active work indicators at desks;
- task details on selecting an agent;
- dependency visualization when needed;
- project room / war room for complex initiatives;
- compact status overlays;
- filters and search.

### Default CEO question

The interface should answer at a glance:

> **What is everyone doing, what matters now, and do you need me?**

Not:

> **How many task cards are in each column?**

---

## 19. CEO CONTROL SURFACE

The CEO needs a persistent but minimal command bar.

Core controls:

- current project selector;
- global chat;
- new objective;
- office map;
- approvals;
- alerts;
- search;
- memory / knowledge;
- projects;
- settings.

### Approval inbox

If the autonomous system reaches a sensitive action, the office should make this visually obvious.

The CEO sees:

- what action is requested;
- which agent requested it;
- why it is necessary;
- expected impact;
- risk level;
- evidence/context;
- approve / reject / modify options.

---

## 20. OBSERVABILITY WITHOUT VISUAL NOISE

The backend must preserve complete observability while the frontend presents progressive disclosure.

### Level 1 — Ambient

Simple status and visual cues.

### Level 2 — Project

Current project objective, progress, active agents and blockers.

### Level 3 — Agent

Current task, reasoning summary, recent actions, outputs and dependencies.

### Level 4 — Audit

Full event history, tool calls, execution metadata, test results and Git trail where authorized.

This separation is essential. **Rich telemetry belongs in the system; visual clutter does not.**

---

## 21. TECHNICAL ARCHITECTURE DIRECTION

The current PUB DEV LOOP already centers around a controlled engineering loop: HTTP API → PostgreSQL queue → worker → agent execution → Git/result persistence. The current repository documents Codex as the operational worker and explicit provider selection as part of the existing system.

The Office evolution must preserve that operational foundation while introducing an organizational orchestration layer.

### Proposed logical layers

```text
CEO / Office UI
        ↓
Global Office Chat
        ↓
Project Context
        ↓
Orchestrator / Chief of Staff
        ↓
Meeting + Planning + Delegation
        ↓
Agent Runtime / Specialist Agents
        ↓
Tools / Repositories / APIs / Browsers / Execution
        ↓
Validation / Review / Finalization
        ↓
Project State + Audit Trail
        ↓
Memory Engine + Skill Learning
        ↺
```

### Important architectural rule

The 3D office UI must not become the source of truth.

The source of truth remains backend state and durable project/event data.

The office is a projection of that state.

---

## 22. EVENT-DRIVEN OFFICE

The Office should eventually operate around durable events.

Examples:

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
- `MUSIC_STARTED`
- `MUSIC_CHANGED`

The visual layer subscribes to these events and renders the office accordingly.

---

## 23. MULTI-AGENT COLLABORATION RULES

Agents should communicate through structured project context whenever possible.

Every important agent-to-agent exchange should be attributable to:

- sender;
- receiver(s);
- project;
- task or objective;
- message type;
- timestamp;
- decision relevance;
- resulting action.

Avoid uncontrolled agent loops.

The orchestration layer must implement:

- turn limits;
- task ownership;
- dependency management;
- escalation rules;
- timeout handling;
- retry policies;
- conflict resolution;
- duplicate-work prevention.

---

## 24. QUALITY CONTROL

Autonomy does not remove engineering discipline.

Agents must validate their work using the strongest available evidence.

Examples:

- typecheck;
- unit tests;
- integration tests;
- build;
- lint;
- browser validation;
- API contract validation;
- visual validation where applicable;
- security checks;
- Git diff inspection.

An agent should not report success merely because a command completed. Success means the requested outcome has been verified according to the project's acceptance criteria.

---

## 25. GIT AND ARTIFACTS

Git remains a durable audit mechanism for software projects.

The Office should expose Git activity contextually:

- branch;
- commit;
- changed files;
- validation status;
- review status;
- merge readiness.

The visual office should not require the CEO to understand Git internals to know whether work is healthy.

---

## 26. PROJECT HANDOFFS

Agents should be able to hand work to another specialist explicitly.

A handoff should include:

- what was completed;
- what remains;
- relevant files/artifacts;
- assumptions;
- risks;
- tests performed;
- recommended next action.

This prevents the common failure mode where one agent says "done" and another agent has to reconstruct the entire context.

---

## 27. FAILURE BEHAVIOR

Failure is an expected part of autonomous work.

When an agent fails:

1. record the failure;
2. classify it;
3. attempt recovery when authorized;
4. ask another specialist when useful;
5. retry with changed strategy when appropriate;
6. escalate only after autonomous recovery paths are exhausted or policy requires it.

The office should visibly communicate meaningful blockers without turning every transient retry into an alarm.

Failures should feed the learning system when they reveal reusable lessons.

---

## 28. SECURITY AND TRUST

The Office must make autonomy understandable and controllable.

Required concepts:

- least privilege;
- explicit tool permissions;
- project-scoped credentials;
- environment separation;
- approval policies;
- audit logs;
- secret redaction;
- action provenance;
- immutable or durable decision records where appropriate.

An agent must never claim to have executed an action that the runtime did not actually execute.

---

## 29. UX NORTH STAR

The ideal CEO session looks like this:

1. CEO opens the office.
2. Sees agents at their desks.
3. Selects a project.
4. Sends a natural-language objective in global chat.
5. Orchestrator acknowledges.
6. Relevant specialists gather for an alignment meeting.
7. Meeting appears visually in the office.
8. Work is divided.
9. Agents return to their desks and begin working.
10. Agents communicate when dependencies arise.
11. The office shows meaningful activity.
12. CEO watches progress through conversation and high-level status.
13. A sensitive decision triggers an approval request.
14. CEO approves/rejects.
15. Agents continue autonomously.
16. Results are reviewed and validated.
17. Project is completed.
18. Lessons are extracted.
19. Useful lessons become memory/skills.
20. Office returns to a calm state, ready for the next objective.

That is the product loop.

---

## 30. MVP / IMPLEMENTATION PHASING

### Phase A — Foundation

- Replace dashboard-first mental model.
- Establish Office shell.
- Define agent registry.
- Define project/team state.
- Implement global chat.
- Connect real backend task state to UI.

### Phase B — Orchestration

- objective intake;
- specialist selection;
- automatic meeting creation;
- task decomposition;
- assignment;
- dependencies;
- agent-to-agent communication.

### Phase C — Autonomous execution

- runtime agent workers;
- tool permissions;
- execution state;
- validation;
- handoffs;
- recovery;
- approval gates.

### Phase D — Memory and learning

- project memory;
- organizational memory;
- learning events;
- skill extraction;
- skill validation;
- retrieval into future projects.

### Phase E — Living Office

- richer agent animations;
- personalities;
- relationships;
- ambient interactions;
- music/turntable;
- environmental events;
- office customization.

### Phase F — Advanced organization

- dynamic hiring / specialist creation;
- role evolution;
- performance analytics;
- organizational knowledge graph;
- deeper adaptive orchestration.

Do not attempt to build every visual feature before the underlying autonomous collaboration loop works.

---

## 31. NON-GOALS

The Office must not become:

- a decorative 3D screensaver;
- a game that hides real execution state;
- a noisy Slack clone;
- a Kanban board with avatars pasted on top;
- a fake simulation where agents appear to work without backend execution;
- a system requiring human approval for every tiny action;
- an uncontrolled multi-agent conversation loop.

---

## 32. SUCCESS CRITERIA

The redesign is successful when a new user can answer these questions within seconds:

1. What projects are active?
2. What is the office working on right now?
3. Which agents are involved?
4. What decisions are being made?
5. Is anything blocked?
6. Does the team need me?
7. What did the team learn?

And the CEO can initiate new work using one natural-language conversation rather than manually constructing a task graph.

---

## 33. MASTER PRODUCT PRINCIPLE

The deepest idea behind PUB DEV LOOP is not the 3D office.

It is the creation of a **persistent AI organization**.

The office is its body.

The agents are its employees.

The global chat is its communication system.

The Orchestrator is its coordination layer.

Projects are its missions.

Memory is its institutional knowledge.

Skills are its accumulated capability.

Git and execution logs are its audit trail.

The CEO is its strategic human authority.

Music, personality and environmental behavior give the organization a sense of life — but the underlying system must remain real, observable, autonomous and trustworthy.

> **PUB DEV LOOP is not a dashboard for watching agents. It is the operating environment where the PUB AI workforce works.**

---

## 34. DECISION LOCK

From this context forward, major frontend/product decisions for the PUB DEV LOOP Office experience should be evaluated against the following question:

> **Does this make the system feel more like a clear, trustworthy, autonomous AI workplace — or does it merely add another dashboard feature?**

Prefer the former.
