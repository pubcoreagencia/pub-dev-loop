import React from 'react';
import { useStore } from '../store/useStore';
import type { AgentDefinition, CeoIdentity } from '../types/office';
import { OPERATIONAL_STATE_LABELS_PT, SPATIAL_STATE_LABELS_PT } from '../config/officeLayout';
import { EmployeeAvatar } from './EmployeeAvatar';
import { getCurrentShift } from '../services/autonomousScheduleData';

export const OfficeFloorMap: React.FC = () => {
  const { agents, ceo, meetingRoom, selectedAgent, selectAgent, speechBubbles } = useStore();
  const currentShift = getCurrentShift();

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
      spatialState: 'idle',
      facingDirection: 'SOUTH',
    };
  };

  const chief = getAgentOrFallback('chief-of-staff', 'Chief of Staff', 'Orquestrador & Estratégia');
  const architect = getAgentOrFallback('architect', 'Architect', 'Arquiteto de Software');
  const developer = getAgentOrFallback('developer', 'Developer', 'Desenvolvedor Sênior');
  const reviewer = getAgentOrFallback('reviewer', 'Reviewer', 'Revisor de Código & Segurança');
  const qa = getAgentOrFallback('qa-engineer', 'QA Engineer', 'Engenheiro de QA & Testes');
  const videoEditor = getAgentOrFallback('video-editor', 'Cauã Martins', 'Audiovisual & Drone Director');
  const imageDesigner = getAgentOrFallback('image-designer', 'Maya Lin', '3D Artist & Visual Designer');
  const soundEngineer = getAgentOrFallback('sound-engineer', 'Gabriel Costa', 'Sound Designer & Music Producer');
  const growthOps = getAgentOrFallback('growth-ops', 'Renata Prado', 'Head of Growth & Lead Ops');

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
    const agentDef = employee as AgentDefinition;
    const stateInfo = isCeo
      ? { label: 'Comandante Ativo', tagCls: 'state-idle' }
      : OPERATIONAL_STATE_LABELS_PT[agentDef.operationalState || 'idle'];

    const spatialState = employee.spatialState || 'idle';
    const spatialInfo = SPATIAL_STATE_LABELS_PT[spatialState] || { label: 'Na Estação', tagCls: 'spatial-idle' };

    const avatar = employee.avatar || {
      avatarId: `avatar-${employee.id}`,
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
          className={`agent-workstation ${isSelected ? 'selected' : ''} ${stateInfo.tagCls} ${spatialInfo.tagCls} ${isCeo ? 'ceo-workstation' : ''}`}
          onClick={() => selectAgent(employee)}
          title={`Clique para inspecionar a estação de ${employee.name}`}
        >
          {/* PERSONAGEM RETRO VETORIAL + MONITOR CRT */}
          <EmployeeAvatar
            avatar={avatar}
            operationalState={agentDef.operationalState || 'idle'}
            spatialState={spatialState}
            facingDirection={employee.facingDirection || 'SOUTH'}
            isCeo={isCeo}
          />

          <div className="workstation-info">
            <div className="workstation-header-line">
              <span className="agent-card-name">{avatar.displayName}</span>
              <span className="workstation-desk-tag">
                {employee.position?.deskLabel || 'Bancada'}
              </span>
            </div>
            <span className="agent-card-title">{avatar.roleLabel}</span>

            {/* HANDOFF OPERACIONAL REAL */}
            {agentDef.lastHandoffFrom && (
              <div className="handoff-indicator-badge" title={`Recebeu dependência de ${agentDef.lastHandoffFrom.toUpperCase()}`}>
                <span className="handoff-arrow">➔</span>
                <span className="handoff-text">Handoff de <strong>{agentDef.lastHandoffFrom.toUpperCase()}</strong></span>
              </div>
            )}

            {/* ESTADO ESPACIAL REAL (QUANDO EM DESLOCAMENTO OU INTERAÇÃO) */}
            {spatialState !== 'idle' && (
              <div className={`spatial-movement-tag ${spatialInfo.tagCls}`}>
                <span className="spatial-dot"></span>
                <span>{spatialInfo.label}</span>
              </div>
            )}

            {/* PROJETO ATIVO DA ESTEIRA AUTÔNOMA */}
            {agentDef.currentProject && (
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid #0284c7',
                  borderRadius: '4px',
                  padding: '2px 5px',
                  marginTop: '3px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                }}
                title={`Projeto ativo na esteira 24h: ${agentDef.currentProject}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px' }}>📦</span>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#38bdf8' }}>
                    {agentDef.currentProject}
                  </span>
                </div>
                {agentDef.currentShiftTask && (
                  <span style={{ fontSize: '8px', color: '#94a3b8', lineHeight: 1.2 }}>
                    {agentDef.currentShiftTask.slice(0, 48)}...
                  </span>
                )}
              </div>
            )}

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
          <span className="blueprint-title">PLANTA DO ESCRITÓRIO • 50 FUNCIONÁRIOS (10 SQUADS)</span>
          <button
            onClick={() => useStore.getState().setFiftyAgentsModalOpen(true)}
            style={{
              marginLeft: 'auto',
              marginRight: '8px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.3))',
              border: '1px solid #38bdf8',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              color: '#38bdf8',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Ver Elenco Completo dos 50 Funcionários"
          >
            👥 50 Agentes
          </button>
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid #38bdf8',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '10px',
              color: '#38bdf8',
              fontWeight: 700,
            }}
          >
            ⏰ {currentShift.name} ({currentShift.timeRange})
          </span>
        </div>
        <span className="blueprint-legend">
          ESTEIRA 24H: {currentShift.focus}
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
                <div className="meeting-active-block">
                  <span className="meeting-topic-text">
                    📋 {meetingRoom.topic || 'Alinhamento Estratégico'}
                  </span>
                  <div className="meeting-attendees-row">
                    <span className="attendee-pill">👑 CEO</span>
                    <span className="attendee-separator">⚡</span>
                    <span className="attendee-pill">👔 CHIEF OF STAFF</span>
                  </div>
                </div>
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

        {/* ESTÚDIO MULTIMÍDIA, VÍDEO & 3D */}
        <div className="office-department-zone multimedia-zone" style={{ borderTop: '2px solid #e11d48' }}>
          <div className="zone-header">
            <span className="zone-tag" style={{ color: '#fb7185' }}>ESTÚDIO MULTIMÍDIA &amp; PRODUÇÃO 3D</span>
            <span className="zone-badge" style={{ background: '#881337', color: '#fecdd3' }}>MULTIMÍDIA</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(videoEditor)}
            {renderWorkstation(imageDesigner)}
          </div>
        </div>

        {/* ESTÚDIO MUSICAL PUB RECORDS & GROWTH HUB */}
        <div className="office-department-zone growth-zone" style={{ borderTop: '2px solid #06b6d4' }}>
          <div className="zone-header">
            <span className="zone-tag" style={{ color: '#22d3ee' }}>PUB RECORDS &amp; HUB DE GROWTH OPS</span>
            <span className="zone-badge" style={{ background: '#164e63', color: '#cffafe' }}>GROWTH &amp; AUDIO</span>
          </div>
          <div className="zone-desks">
            {renderWorkstation(soundEngineer)}
            {renderWorkstation(growthOps)}
          </div>
        </div>
      </div>
    </div>
  );
};
