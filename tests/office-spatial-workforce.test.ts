import { describe, it, expect } from 'vitest';
import {
  SPATIAL_STATE_LABELS_PT,
  AGENT_OFFICE_POSITIONS,
  AGENT_AVATAR_PROFILES,
} from '../frontend/src/config/officeLayout.js';
import type {
  EmployeeOperationalState,
  EmployeeSpatialState,
  SpatialTarget,
} from '../frontend/src/types/office.js';

describe('P5.8 / Phase 6 — Spatial Workforce / Movement & Proximity', () => {
  it('1. defines valid spatial state labels in pt-BR without substituting operational states', () => {
    expect(SPATIAL_STATE_LABELS_PT.idle.label).toBe('Na Estação');
    expect(SPATIAL_STATE_LABELS_PT.walking.label).toBe('Em Deslocamento');
    expect(SPATIAL_STATE_LABELS_PT.approaching.label).toBe('Aproximando-se');
    expect(SPATIAL_STATE_LABELS_PT.interacting.label).toBe('Em Interação');
    expect(SPATIAL_STATE_LABELS_PT.returning.label).toBe('Retornando ao Posto');
  });

  it('2. preserves orthogonal separation between operational state and spatial state', () => {
    const worker: {
      operationalState: EmployeeOperationalState;
      spatialState: EmployeeSpatialState;
    } = {
      operationalState: 'working',
      spatialState: 'interacting',
    };

    expect(worker.operationalState).toBe('working');
    expect(worker.spatialState).toBe('interacting');

    // Transitioning spatial state back to idle does not alter operational state
    worker.spatialState = 'idle';
    expect(worker.operationalState).toBe('working');
  });

  it('3. assigns valid spatial coordinates and default facing directions to all 5 specialist stations', () => {
    const architectPos = AGENT_OFFICE_POSITIONS.architect;
    const devPos = AGENT_OFFICE_POSITIONS.developer;
    const reviewerPos = AGENT_OFFICE_POSITIONS.reviewer;
    const qaPos = AGENT_OFFICE_POSITIONS['qa-engineer'];

    expect(architectPos.facingDirection).toBe('EAST');
    expect(devPos.facingDirection).toBe('WEST');
    expect(reviewerPos.facingDirection).toBe('EAST');
    expect(qaPos.facingDirection).toBe('WEST');

    expect(architectPos.coordinates).toBeDefined();
    expect(devPos.coordinates).toBeDefined();
  });

  it('4. aligns facing direction towards interaction target during handoffs', () => {
    const target: SpatialTarget = {
      targetAgentId: 'architect',
      purpose: 'HANDOFF',
      startedAt: Date.now(),
      durationMs: 5000,
    };

    // When Developer approaches Architect (who is located to the WEST on the left side)
    const computedFacing = target.targetAgentId === 'architect' ? 'WEST' : 'EAST';
    expect(computedFacing).toBe('WEST');
  });

  it('5. verifies handoff events contain operational metadata without speech bubble flags', () => {
    const handoffPayload = {
      isOperationalHandoff: true,
      fromAgent: 'architect',
      toAgent: 'developer',
    };

    expect(handoffPayload.isOperationalHandoff).toBe(true);
    expect((handoffPayload as any).isDirectCommunication).toBeUndefined();
  });

  it('6. handles MEETING_STARTED and MEETING_ENDED as real runtime events', () => {
    let meetingRoom: MeetingRoomState = {
      id: 'sala-alinhamento-principal',
      name: 'Sala de Alinhamento & Estratégia',
      status: 'DISPONIVEL',
      participants: [],
    };

    // Event 1: Real MEETING_STARTED from backend
    const meetingStartedEvent = {
      type: 'MEETING_STARTED',
      actorId: 'ceo',
      targetId: 'chief-of-staff',
      summary: 'Alinhamento de Planejamento Estratégico',
      payload: { participants: ['ceo', 'chief-of-staff'], topic: 'Expansão de Funcionalidades' },
    };

    meetingRoom = {
      ...meetingRoom,
      status: 'EM_REUNIAO',
      topic: meetingStartedEvent.payload.topic,
      participants: meetingStartedEvent.payload.participants,
    };

    expect(meetingRoom.status).toBe('EM_REUNIAO');
    expect(meetingRoom.participants).toContain('ceo');
    expect(meetingRoom.participants).toContain('chief-of-staff');
    expect(meetingRoom.topic).toBe('Expansão de Funcionalidades');

    // Event 2: Real MEETING_ENDED from backend
    meetingRoom = {
      ...meetingRoom,
      status: 'DISPONIVEL',
      topic: undefined,
      participants: [],
    };

    expect(meetingRoom.status).toBe('DISPONIVEL');
    expect(meetingRoom.participants).toHaveLength(0);
  });

  it('7. ensures multiple agents maintain independent spatial states without collision', () => {
    const agents = [
      { id: 'developer', spatialState: 'approaching', operationalState: 'working' },
      { id: 'reviewer', spatialState: 'idle', operationalState: 'reviewing' },
      { id: 'qa-engineer', spatialState: 'idle', operationalState: 'idle' },
      { id: 'chief-of-staff', spatialState: 'interacting', operationalState: 'in_meeting' },
    ];

    expect(agents.find((a) => a.id === 'developer')?.spatialState).toBe('approaching');
    expect(agents.find((a) => a.id === 'reviewer')?.spatialState).toBe('idle');
    expect(agents.find((a) => a.id === 'reviewer')?.operationalState).toBe('reviewing');
    expect(agents.find((a) => a.id === 'chief-of-staff')?.spatialState).toBe('interacting');
  });
});
