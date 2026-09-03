import React from 'react';
import { useStore } from '../store/useStore';

export const AgentInspector: React.FC = () => {
  const { selectedAgent, selectAgent, tasks } = useStore();

  if (!selectedAgent) return null;

  const agentTasks = tasks.filter((t) => t.agentId === selectedAgent.id);
  const activeTask = agentTasks.find((t) => t.status === 'RUNNING' || t.status === 'QUEUED');
  const latestCompleted = agentTasks.find((t) => t.status === 'COMPLETED');

  const getDepartmentColor = (dept: string) => {
    switch (dept) {
      case 'EXECUTIVE': return '#f59e0b';
      case 'ENGINEERING': return '#3b82f6';
      case 'QA': return '#10b981';
      default: return '#94a3b8';
    }
  };

  return (
    <div className="agent-inspector-overlay">
      <div className="agent-dossier-card">
        <div className="dossier-header" style={{ borderTop: `4px solid ${getDepartmentColor(selectedAgent.department)}` }}>
          <div className="dossier-title-row">
            <div>
              <span className="dossier-dept">{selectedAgent.department} DEPARTMENT</span>
              <h2 className="dossier-name">{selectedAgent.name}</h2>
              <span className="dossier-job-title">{selectedAgent.title}</span>
            </div>
            <button className="btn-close-dossier" onClick={() => selectAgent(undefined)}>✕</button>
          </div>
        </div>

        <div className="dossier-body">
          <div className="dossier-section">
            <h4 className="section-heading">EMPLOYEE SUMMARY & PERSONALITY</h4>
            <p className="personality-summary">{selectedAgent.personalitySummary}</p>
            <div className="specialty-pill">Specialty: <strong>{selectedAgent.specialty}</strong></div>
          </div>

          <div className="dossier-section">
            <h4 className="section-heading">CORE RESPONSIBILITIES</h4>
            <ul className="dossier-list">
              {selectedAgent.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="dossier-section">
            <h4 className="section-heading">DECLARED CAPABILITIES</h4>
            <div className="caps-wrap">
              {selectedAgent.capabilities.map((c, i) => (
                <span key={i} className="cap-tag">{c}</span>
              ))}
            </div>
          </div>

          <div className="dossier-section">
            <h4 className="section-heading">COGNITIVE MODEL PROFILE</h4>
            <div className="profile-grid">
              <div>Routing Profile: <code>{selectedAgent.routingProfile}</code></div>
              <div>Preferred Model: <code>{selectedAgent.preferredModel || 'Role-Based Gateway'}</code></div>
              <div>Manager Authority: <code>{selectedAgent.isManager ? 'YES' : 'NO'}</code></div>
              <div>Reports To: <code>{selectedAgent.reportsTo || 'Human CEO'}</code></div>
            </div>
          </div>

          {activeTask && (
            <div className="dossier-section active-task-box">
              <h4 className="section-heading" style={{ color: '#fbbf24' }}>CURRENT ACTIVE ASSIGNMENT</h4>
              <div className="active-task-desc">{activeTask.objective}</div>
              <div className="active-task-meta">
                <span>Task #{activeTask.id.slice(0, 16)}</span>
                <span>Status: <strong>{activeTask.status}</strong></span>
              </div>
            </div>
          )}

          {latestCompleted && !activeTask && (
            <div className="dossier-section latest-completed-box">
              <h4 className="section-heading" style={{ color: '#34d399' }}>LATEST COMPLETED DELIVERABLE</h4>
              <div className="active-task-desc">{latestCompleted.objective}</div>
              {latestCompleted.result?.summary && (
                <div className="task-summary-text">{latestCompleted.result.summary}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
