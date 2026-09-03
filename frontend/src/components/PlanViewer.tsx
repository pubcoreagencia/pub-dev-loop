import React from 'react';
import type { OrganizationalPlan } from '../types/office';
import { useStore } from '../store/useStore';

interface Props {
  plan: OrganizationalPlan;
}

export const PlanViewer: React.FC<Props> = ({ plan }) => {
  const { executeStep, executeAllSteps, actionLoading, selectAgent, agents } = useStore();

  const getAgentAvatar = (agentId: string | null) => {
    switch (agentId) {
      case 'chief-of-staff': return '👔';
      case 'architect': return '📐';
      case 'developer': return '💻';
      case 'reviewer': return '🔍';
      case 'qa-engineer': return '🧪';
      default: return '🤖';
    }
  };

  return (
    <div className="plan-viewer-card">
      <div className="plan-card-header">
        <div className="plan-header-left">
          <span className="plan-badge">ORGANIZATIONAL PLAN #{plan.id.slice(-6)}</span>
          <span className={`plan-status-pill ${plan.status.toLowerCase()}`}>{plan.status}</span>
        </div>
        <button
          className="btn-execute-all"
          onClick={() => executeAllSteps(plan)}
          disabled={actionLoading}
        >
          ⚡ EXECUTE ALL STEPS
        </button>
      </div>

      <div className="plan-steps-grid">
        {plan.steps.map((step, idx) => {
          const matchingAgent = agents.find((a) => a.id === step.agentId);
          return (
            <div key={step.id} className="plan-step-item">
              <div className="step-item-header">
                <div className="step-num">STAGE {idx + 1}</div>
                <div
                  className="step-agent-badge clickable"
                  onClick={() => matchingAgent && selectAgent(matchingAgent)}
                  title="Click to view Agent dossier"
                >
                  <span>{getAgentAvatar(step.agentId)}</span>
                  <span className="agent-name">{step.agentId?.toUpperCase() || 'UNRESOLVED'}</span>
                </div>
                <span className="step-score" title="Compatibility Score">
                  {Math.round(step.compatibility.score * 100)}% MATCH
                </span>
              </div>

              <div className="step-description">{step.description}</div>

              {step.dependsOn.length > 0 && (
                <div className="step-dependencies">
                  <span className="dep-label">Depends on:</span>
                  {step.dependsOn.map((dep) => (
                    <code key={dep} className="dep-tag">{dep}</code>
                  ))}
                </div>
              )}

              <div className="step-footer">
                <span className={`step-status-tag ${step.status.toLowerCase()}`}>{step.status}</span>
                <button
                  className="btn-execute-step"
                  onClick={() => executeStep(plan, step.id)}
                  disabled={actionLoading}
                >
                  Run Step ⚙️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
