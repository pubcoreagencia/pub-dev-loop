import React from 'react';
import { useStore } from '../store/useStore';
import type { AgentDefinition, CeoIdentity } from '../types/office';
import { OPERATIONAL_STATE_LABELS_PT } from '../config/officeLayout';

export const OfficeFloorMap: React.FC = () => {
  const { agents, ceo, meetingRoom, selectedAgent, selectAgent, speechBubbles } = useStore();

  const getAgentOrFallback = (id: string, defaultName: string, defaultTitle: string): AgentDefinition => {
    const existing = agents.find((a) => a.id === id);
    if (existing) return existing;
    return {
      id,
      name: defaultName,
      title: defaultTitle,
      department: id === 'chief-of-staff' ? 'EXECUTIVE' : id === 'architect' || id === 'developer' ? 'ENGINEERING' : 'QA',
      role: id.toUpperCase().replace(/-/g, '_') as any,
      specialty: defaultTitle,
      personalitySummary: '',
      responsibilities: [],
      capabilities: [],
      routingProfile: 'general',
      status: 'ACTIVE',
      operationalState: 'idle',
    };
  };

  const chief = getAgentOrFallback('chief-of-staff', 'Chief of Staff', 'Orquestrador & Estratégia');
  const architect = getAgentOrFallback('architect', 'Architect', 'Arquiteto de Software');
  const developer = getAgentOrFallback('developer', 'Developer', 'Desenvolvedor Sênior');
  const reviewer = getAgentOrFallback('reviewer', 'Reviewer', 'Revisor de Código & Segurança');
  const qa = getAgentOrFallback('qa-engineer', 'QA Engineer', 'Engenheiro de QA & Testes');

  const renderSpeechBubble = (entityId: string) => {
    const bubble = speechBubbles.find((b) => b.senderId === entityId);
    if (!bubble) return null;

    return (
      <div className="spatial-speech-bubble" key={bubble.id}>
        <div className="bubble-content">{bubble.content}</div>
        <div className="bubble-pointer"></div>
      </div>
    );
  };

  const renderWorkstation = (
    employee?: AgentDefinition | CeoIdentity,
    isCeo = false
  ) => {
    if (!employee) return null;
    const isSelected = selectedAgent?.id === employee.id;
    const stateInfo = isCeo
      ? { label: 'Comandante Ativo', tagCls: 'state-idle' }
      : OPERATIONAL_STATE_LABELS_PT[(employee as AgentDefinition).operationalState || 'idle'];

    const avatar = employee.avatar || {
      badgeIcon: isCeo ? '👑' : '💼',
      displayName: employee.name,
      roleLabel: employee.title,
      accentColor: isCeo ? '#8b5cf6' : '#f59e0b',
      initials: isCeo ? 'CEO' : employee.name.slice(0, 2).toUpperCase(),
    };

    return (
      <div className="workstation-anchor-wrapper" key={employee.id}>
        {renderSpeechBubble(employee.id)}
        <div
          className={`agent-workstation ${isSelected ? 'selected' : ''} ${stateInfo.tagCls} ${isCeo ? 'ceo-workstation' : ''}`}
          onClick={() => selectAgent(employee)}
          title={`Clique para inspecionar a estação de ${employee.name}`}
        >
          <div
            className="avatar-badge-avatar"
            style={{ borderColor: avatar.accentColor }}
          >
            <span className="avatar-icon">{avatar.badgeIcon}</span>
            <span className="avatar-initials">{avatar.initials}</span>
          </div>

          <div className="workstation-info">
            <div className="workstation-header-line">
              <span className="agent-card-name">{avatar.displayName}</span>
              <span className="workstation-desk-tag">
                {employee.position?.deskLabel || 'Bancada'}
              </span>
            </div>
            <span className="agent-card-title">{avatar.roleLabel}</span>
            <div className="status-indicator-row">
              <span className="status-pulse-dot"></span>
              <span className="status-label-text">{stateInfo.label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="office-floor-container">
      <div className="floor-blueprint-header">
        <div className="blueprint-title-row">
          <span className="blueprint-icon">🏢</span>
          <span className="blueprint-title">PLANTA DO ESCRITÓRIO • 3º ANDAR</span>
        </div>
        <span className="blueprint-legend">
          BANCADAS EM MOGNO &amp; AÇO • MONITORES CRT • SALAS CORPORATIVAS
        </span>
      </div>

      <div className="floor-grid">
        {/* GABINETE EXECUTIVO DO CEO */}
        <div className="office-department-zone ceo-zone">
          <div className="zone-header">
            <span className="zone-tag">GABINETE EXECUTIVO</span>
            <span className="zone-badge">DIRETORIA</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(ceo, true)}
          </div>
        </div>

        {/* SUÍTE DE LIDERANÇA & ORQUESTRAÇÃO */}
        <div className="office-department-zone leadership-zone">
          <div className="zone-header">
            <span className="zone-tag">SUÍTE DE LIDERANÇA &amp; ESTRATÉGIA</span>
            <span className="zone-badge">ORQUESTRAÇÃO</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(chief)}
          </div>
        </div>

        {/* SALA DE ALINHAMENTO & ESTRATÉGIA */}
        <div className="office-department-zone meeting-room-zone">
          <div className="zone-header">
            <span className="zone-tag">SALA DE ALINHAMENTO &amp; REUNIÕES</span>
            <span className={`zone-badge ${meetingRoom.status === 'EM_REUNIAO' ? 'in-meeting' : 'available'}`}>
              {meetingRoom.status === 'EM_REUNIAO' ? '🔴 EM REUNIÃO' : '🟢 DISPONÍVEL'}
            </span>
          </div>
          <div className="meeting-table-container">
            <div className="meeting-conference-table">
              <span className="table-label">MESA DE CONFERÊNCIA</span>
              {meetingRoom.status === 'EM_REUNIAO' ? (
                <span className="meeting-topic-text">
                  📋 {meetingRoom.topic || 'Alinhamento Estratégico'}
                </span>
              ) : (
                <span className="meeting-idle-text">
                  Aguardando convocação de alinhamento pelo Chief of Staff
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LABORATÓRIO DE ENGENHARIA DE SOFTWARE */}
        <div className="office-department-zone engineering-zone">
          <div className="zone-header">
            <span className="zone-tag">LABORATÓRIO DE ENGENHARIA DE SOFTWARE</span>
            <span className="zone-badge">DEV LAB</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(architect)}
            {renderWorkstation(developer)}
          </div>
        </div>

        {/* LABORATÓRIO DE REVISÃO & QUALIDADE */}
        <div className="office-department-zone qa-zone">
          <div className="zone-header">
            <span className="zone-tag">LABORATÓRIO DE CODE REVIEW &amp; QA</span>
            <span className="zone-badge">QUALIDADE</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(reviewer)}
            {renderWorkstation(qa)}
          </div>
        </div>
      </div>
    </div>
  );
};
