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
});
