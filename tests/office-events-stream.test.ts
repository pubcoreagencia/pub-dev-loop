import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';

describe('P5.8 / Phase 5 — Office Event Bus & Live Stream Foundation', () => {
  let bus: OfficeEventBus;

  beforeEach(() => {
    bus = new OfficeEventBus(10);
  });

  it('1. publishes events with unique IDs, sequential sequences, and ISO timestamps', () => {
    const evt1 = bus.publish({
      type: 'OBJECTIVE_SUBMITTED',
      actorId: 'ceo',
      targetId: 'chief-of-staff',
      project: 'pub-dev-loop',
      summary: 'Test objective submitted',
    });

    const evt2 = bus.publish({
      type: 'PLAN_FORMULATED',
      actorId: 'chief-of-staff',
      targetId: 'ceo',
      project: 'pub-dev-loop',
      summary: 'Plan formulated with 4 steps',
    });

    expect(evt1.id).toBeDefined();
    expect(evt1.sequence).toBe(1);
    expect(evt1.type).toBe('OBJECTIVE_SUBMITTED');
    expect(evt2.sequence).toBe(2);
    expect(evt2.id).not.toBe(evt1.id);
  });

  it('2. delivers events in real-time to active subscribers', () => {
    const received: any[] = [];
    const unsubscribe = bus.subscribe({ project: 'pub-dev-loop' }, (evt) => {
      received.push(evt);
    });

    bus.publish({
      type: 'STEP_DELEGATED',
      actorId: 'chief-of-staff',
      targetId: 'architect',
      project: 'pub-dev-loop',
      summary: 'Step 1 delegated to architect',
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('STEP_DELEGATED');
    expect(received[0].targetId).toBe('architect');

    unsubscribe();
    bus.publish({
      type: 'AGENT_STARTED_WORK',
      actorId: 'architect',
      project: 'pub-dev-loop',
      summary: 'Architect started work',
    });

    expect(received).toHaveLength(1); // No further events delivered after unsubscribe
  });

  it('3. filters events by project to prevent multi-tenant cross-talk', () => {
    const projectAReceived: any[] = [];
    const projectBReceived: any[] = [];

    bus.subscribe({ project: 'project-a' }, (evt) => projectAReceived.push(evt));
    bus.subscribe({ project: 'project-b' }, (evt) => projectBReceived.push(evt));

    bus.publish({
      type: 'OBJECTIVE_SUBMITTED',
      actorId: 'ceo',
      project: 'project-a',
      summary: 'Objective for Project A',
    });

    bus.publish({
      type: 'OBJECTIVE_SUBMITTED',
      actorId: 'ceo',
      project: 'project-b',
      summary: 'Objective for Project B',
    });

    expect(projectAReceived).toHaveLength(1);
    expect(projectAReceived[0].summary).toBe('Objective for Project A');
    expect(projectBReceived).toHaveLength(1);
    expect(projectBReceived[0].summary).toBe('Objective for Project B');
  });

  it('4. supports Last-Event-ID replay via getEventsSince()', () => {
    bus.publish({ type: 'OBJECTIVE_SUBMITTED', actorId: 'ceo', project: 'pub-dev-loop', summary: 'Evt 1' });
    bus.publish({ type: 'PLAN_FORMULATED', actorId: 'chief-of-staff', project: 'pub-dev-loop', summary: 'Evt 2' });
    bus.publish({ type: 'STEP_DELEGATED', actorId: 'chief-of-staff', targetId: 'architect', project: 'pub-dev-loop', summary: 'Evt 3' });
    bus.publish({ type: 'AGENT_STARTED_WORK', actorId: 'architect', project: 'pub-dev-loop', summary: 'Evt 4' });

    // Client disconnected at seq 2 and reconnects requesting events since seq 2
    const missedEvents = bus.getEventsSince(2, { project: 'pub-dev-loop' });
    expect(missedEvents).toHaveLength(2);
    expect(missedEvents[0].sequence).toBe(3);
    expect(missedEvents[1].sequence).toBe(4);
  });

  it('5. preserves ring buffer size limit and evicts oldest events', () => {
    for (let i = 1; i <= 15; i++) {
      bus.publish({
        type: 'AGENT_STARTED_WORK',
        actorId: 'developer',
        project: 'pub-dev-loop',
        summary: 'Task ' + i,
      });
    }

    const recent = bus.getRecentEvents(50);
    expect(recent).toHaveLength(10);
    expect(recent[0].summary).toBe('Task 6');
    expect(recent[9].summary).toBe('Task 15');
  });

  it('6. semantically distinguishes AGENT_HANDOFF from MESSAGE_SENT', () => {
    const handoffEvt = bus.publish({
      type: 'AGENT_HANDOFF',
      actorId: 'architect',
      targetId: 'developer',
      project: 'pub-dev-loop',
      summary: 'Handoff de ARCHITECT para DEVELOPER',
      payload: { isOperationalHandoff: true },
    });

    const messageEvt = bus.publish({
      type: 'MESSAGE_SENT',
      actorId: 'ceo',
      targetId: 'chief-of-staff',
      project: 'pub-dev-loop',
      summary: 'CEO message to Chief of Staff',
      payload: { isDirectCommunication: true },
    });

    expect(handoffEvt.type).toBe('AGENT_HANDOFF');
    expect(handoffEvt.payload?.isOperationalHandoff).toBe(true);
    expect(messageEvt.type).toBe('MESSAGE_SENT');
    expect(messageEvt.payload?.isDirectCommunication).toBe(true);
  });
});
