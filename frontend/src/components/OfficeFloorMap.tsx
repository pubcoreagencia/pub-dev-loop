import React from 'react';
import { useStore } from '../store/useStore';
import type { AgentDefinition } from '../types/office';

export const OfficeFloorMap: React.FC = () => {
  const { agents, selectAgent, selectedAgent, tasks } = useStore();

  const getAgentByRole = (roleOrId: string): AgentDefinition | undefined => {
    return agents.find((a) => a.id === roleOrId || a.role === roleOrId);
  };

  const chief = getAgentByRole('chief-of-staff');
  const architect = getAgentByRole('architect');
  const developer = getAgentByRole('developer');
  const reviewer = getAgentByRole('reviewer');
  const qa = getAgentByRole('qa-engineer');

  const getAgentStatus = (agentId: string) => {
    const isWorking = tasks.some((t) => t.agentId === agentId && t.status === 'RUNNING');
    if (isWorking) return { label: 'WORKING', cls: 'working' };
    const hasQueued = tasks.some((t) => t.agentId === agentId && t.status === 'QUEUED');
    if (hasQueued) return { label: 'ASSIGNED', cls: 'assigned' };
    return { label: 'STANDBY', cls: 'idle' };
  };

  const renderDesk = (agent?: AgentDefinition, icon = '💼') => {
    if (!agent) return null;
    const isSelected = selectedAgent?.id === agent.id;
    const status = getAgentStatus(agent.id);

    return (
      <div
        className={`agent-workstation ${isSelected ? 'selected' : ''} ${status.cls}`}
        onClick={() => selectAgent(agent)}
        title={`Click to inspect ${agent.name}'s desk`}
      >
        <div className="desk-surface">
          <div className="crt-monitor">
            <div className="crt-screen">
              <span className="crt-text">{agent.id.slice(0, 10).toUpperCase()}</span>
            </div>
          </div>
          <div className="desk-accessories">
            <span className="desk-icon">{icon}</span>
          </div>
        </div>

        <div className="workstation-info">
          <span className="agent-card-name">{agent.name}</span>
          <span className="agent-card-title">{agent.title}</span>
          <span className={`agent-status-badge ${status.cls}`}>● {status.label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="office-floor-container">
      <div className="floor-blueprint-header">
        <span className="blueprint-title">THE OFFICE • 3RD FLOOR WORKSPACE BLUEPRINT</span>
        <span className="blueprint-legend">WOOD &amp; STEEL DESKS • CRT TERMINALS</span>
      </div>

      <div className="floor-grid">
        {/* LEADERSHIP OFFICE */}
        <div className="office-department-zone leadership-zone">
          <div className="zone-tag">LEADERSHIP &amp; STRATEGY SUITE</div>
          <div className="zone-desks">
            {renderDesk(chief, '👔')}
          </div>
        </div>

        {/* ENGINEERING LAB */}
        <div className="office-department-zone engineering-zone">
          <div className="zone-tag">SOFTWARE ENGINEERING LAB</div>
          <div className="zone-desks">
            {renderDesk(architect, '📐')}
            {renderDesk(developer, '💻')}
          </div>
        </div>

        {/* QUALITY ASSURANCE LAB */}
        <div className="office-department-zone qa-zone">
          <div className="zone-tag">CODE REVIEW &amp; QA LAB</div>
          <div className="zone-desks">
            {renderDesk(reviewer, '🔍')}
            {renderDesk(qa, '🧪')}
          </div>
        </div>
      </div>
    </div>
  );
};
