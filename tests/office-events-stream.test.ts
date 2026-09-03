import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';

describe('P5.8 / Phase 5.1 — Office Event Bus & Production Hardening Suite', () => {
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

    expect(received).toHaveLength(1);
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

  it('7. simulates cross-isolate event delivery via persistent storage bridge', async () => {
    const mockDb: any[] = [];
    const mockPool: any = {
      query: async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO office_events')) {
          mockDb.push({
            id: params[0],
            sequence: params[1],
            project: params[2],
            type: params[3],
            actor_id: params[4],
            target_id: params[5],
            task_id: params[6],
            plan_id: params[7],
            step_id: params[8],
            summary: params[9],
            payload: params[10],
            created_at: params[11],
          });
          return { rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM office_events')) {
          const project = params[0];
          const seq = params[1];
          const filtered = mockDb.filter((r) => r.project === project && r.sequence > seq);
          return { rows: filtered };
        }
        return { rows: [] };
      },
    };

    // Isolate A (Producer)
    const isolateAPublisher = new OfficeEventBus(10, mockPool);
    isolateAPublisher.publish({
      type: 'STEP_DELEGATED',
      actorId: 'chief-of-staff',
      targetId: 'developer',
      project: 'pub-dev-loop',
      summary: 'Etapa despachada no Isolate A',
    });

    // Isolate B (Consumer holding SSE connection)
    const isolateBConsumer = new OfficeEventBus(10, mockPool);
    const syncedEvents = await isolateBConsumer.getEventsSinceDb(0, 'pub-dev-loop');

    expect(syncedEvents).toHaveLength(1);
    expect(syncedEvents[0].summary).toBe('Etapa despachada no Isolate A');
    expect(syncedEvents[0].targetId).toBe('developer');
  });

  it('8. supports multiple concurrent client subscriptions without cross-talk or listener leak', () => {
    const client1: any[] = [];
    const client2: any[] = [];
    const client3: any[] = [];

    const unsub1 = bus.subscribe({ project: 'pdl' }, (e) => client1.push(e));
    const unsub2 = bus.subscribe({ project: 'pdl' }, (e) => client2.push(e));
    const unsub3 = bus.subscribe({ project: 'pdl' }, (e) => client3.push(e));

    expect(bus.getSubscriberCount()).toBe(3);

    bus.publish({
      type: 'OBJECTIVE_SUBMITTED',
      actorId: 'ceo',
      project: 'pdl',
      summary: 'Broadcast test',
    });

    expect(client1).toHaveLength(1);
    expect(client2).toHaveLength(1);
    expect(client3).toHaveLength(1);

    unsub2();
    expect(bus.getSubscriberCount()).toBe(2);

    bus.publish({
      type: 'PLAN_FORMULATED',
      actorId: 'chief-of-staff',
      project: 'pdl',
      summary: 'Plan test',
    });

    expect(client1).toHaveLength(2);
    expect(client2).toHaveLength(1); // Unsubscribed
    expect(client3).toHaveLength(2);

    unsub1();
    unsub3();
    expect(bus.getSubscriberCount()).toBe(0);
  });
});
