import React from 'react';
import type { OrganizationalPlan, PlanStep } from '../types/office';
import { useStore } from '../store/useStore';

interface PlanViewerProps {
  plan: OrganizationalPlan;
}

export const PlanViewer: React.FC<PlanViewerProps> = ({ plan }) => {
  const { executeStep, executeAllSteps, actionLoading, agents } = useStore();

  const getAgentLabel = (agentId: string | null) => {
    if (!agentId) return 'Não atribuído';
    const a = agents.find((ag) => ag.id === agentId);
    return a ? `${a.name} (${a.title})` : agentId.toUpperCase();
  };

  return (
    <div className="plan-viewer-card">
      <div className="plan-header">
        <div className="plan-badge">PLANO ORGANIZACIONAL • CHIEF OF STAFF</div>
        <span className="plan-id">ID: {plan.id}</span>
      </div>

      <div className="plan-objective-title">
        <strong>Objetivo:</strong> {plan.objective}
      </div>

      <div className="plan-steps-container">
        {plan.steps.map((step: PlanStep, idx: number) => (
          <div key={step.id} className="plan-step-card">
            <div className="step-card-header">
              <span className="step-number">ETAPA {idx + 1}</span>
              <span className="step-agent-badge">
                👤 {getAgentLabel(step.agentId)}
              </span>
              <span className="step-compat-score">
                Afinidade: {(step.compatibility.score * 100).toFixed(0)}%
              </span>
            </div>

            <div className="step-description">{step.description}</div>

            {step.dependsOn.length > 0 && (
              <div className="step-dependencies">
                <span className="dep-label">Depende de:</span>
                {step.dependsOn.map((dep) => (
                  <span key={dep} className="dep-tag">{dep}</span>
                ))}
              </div>
            )}

            <div className="step-action-bar">
              <span className={`step-status-tag ${step.status.toLowerCase()}`}>
                {step.status === 'READY' ? 'PRONTA P/ EXECUÇÃO' : step.status === 'PENDING' ? 'PENDENTE' : step.status}
              </span>

              <button
                className="btn-execute-step"
                onClick={() => executeStep(plan, step.id)}
                disabled={actionLoading}
              >
                Executar Etapa
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="plan-actions-footer">
        <button
          className="btn-execute-all"
          onClick={() => executeAllSteps(plan)}
          disabled={actionLoading}
        >
          ⚡ EXECUTAR TODAS AS ETAPAS
        </button>
      </div>
    </div>
  );
};
