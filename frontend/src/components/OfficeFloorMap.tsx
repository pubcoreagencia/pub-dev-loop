import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { AgentDefinition, CeoIdentity } from '../types/office';
import { OPERATIONAL_STATE_LABELS_PT, SPATIAL_STATE_LABELS_PT } from '../config/officeLayout';
import { EmployeeAvatar } from './EmployeeAvatar';
import { getCurrentShift } from '../services/autonomousScheduleData';
import { PUB_HOLDING_SECTORS, FIFTY_SPECIALIZED_AGENTS } from '../config/squadsData';
import { SECTOR_ROOM_CONFIGS } from '../scenes/Office3DScene';
import { SECTOR_COLORS, SECTOR_ICONS } from '../scenes/SectorRoom3D';

type WingFilter = 'ALL' | 'CORE' | 'OESTE' | 'LESTE' | 'NORTE' | 'SUL';

export const OfficeFloorMap: React.FC = () => {
  const {
    agents,
    ceo,
    meetingRoom,
    selectedAgent,
    selectAgent,
    speechBubbles,
    selectedSectorId,
    setSelectedSectorId,
    setFiftyAgentsModalOpen,
  } = useStore();

  const [activeWing, setActiveWing] = useState<WingFilter>('ALL');
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
      : OPERATIONAL_STATE_LABELS_PT[agentDef.operationalState || 'idle'] || { label: 'Operando', tagCls: 'state-idle' };

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
          title={`Clique para inspecionar ${employee.name} (${avatar.roleLabel})`}
        >
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
                {employee.position?.deskLabel || agentDef.role || 'Baia'}
              </span>
            </div>
            <span className="agent-card-title">{avatar.roleLabel}</span>

            {/* MODELO DE IA ASSOCIADO */}
            {agentDef.preferredModel && (
              <div
                style={{
                  fontSize: '8.5px',
                  color: '#facc15',
                  fontWeight: 700,
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span>⚡</span>
                <span>{agentDef.preferredModel.split('/')[1] || agentDef.preferredModel}</span>
              </div>
            )}

            {/* PROJETO ATIVO / TAREFA ATUAL */}
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

  // Filtrar setores por Ala
  const filteredSectors = PUB_HOLDING_SECTORS.filter((sec) => {
    const cfg = SECTOR_ROOM_CONFIGS[sec.id];
    if (activeWing === 'ALL') return true;
    if (!cfg) return false;
    return cfg.wing === activeWing;
  });

  return (
    <div className="office-floor-container">
      {/* CABEÇALHO DA PLANTA BAIXA */}
      <div className="floor-blueprint-header">
        <div className="blueprint-title-row">
          <span className="blueprint-icon">🏢</span>
          <span className="blueprint-title">CAMPUS PUB CORE • 10 SALAS SETORIAIS (50 AGENTES)</span>
          <button
            onClick={() => setFiftyAgentsModalOpen(true)}
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
          ESTEIRA 24H: 10 Squads Alocadas nas Alas Periféricas • Núcleo Central Ativo
        </span>

        {/* NAVEGAÇÃO ENTRE ALAS E NÚCLEO */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginTop: '8px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {[
            { key: 'ALL', label: '🌐 Todas as Salas' },
            { key: 'CORE', label: '🏛️ Núcleo Central' },
            { key: 'OESTE', label: '⬅️ Ala Oeste (Set. 1, 2, 8)' },
            { key: 'LESTE', label: '➡️ Ala Leste (Set. 3, 6, 7)' },
            { key: 'NORTE', label: '⬆️ Ala Norte (Set. 4, 10)' },
            { key: 'SUL', label: '⬇️ Ala Sul (Set. 5, 9)' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveWing(tab.key as WingFilter)}
              style={{
                background: activeWing === tab.key ? '#0284c7' : 'rgba(15, 23, 42, 0.6)',
                border: activeWing === tab.key ? '1px solid #38bdf8' : '1px solid #334155',
                color: activeWing === tab.key ? '#ffffff' : '#94a3b8',
                borderRadius: '8px',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: activeWing === tab.key ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="floor-grid">
        {/* ========================================================================= */}
        {/* NÚCLEO CENTRAL (DIRETORIA, ORQUESTRAÇÃO & ENGENHARIA PRINCIPAL) */}
        {/* ========================================================================= */}
        {(activeWing === 'ALL' || activeWing === 'CORE') && (
          <>
            {/* GABINETE EXECUTIVO DO CEO */}
            <div className="office-department-zone ceo-zone">
              <div className="zone-header">
                <span className="zone-tag">GABINETE EXECUTIVO &amp; PUB RECORDS</span>
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
          </>
        )}

        {/* ========================================================================= */}
        {/* AS 10 SALAS DOS SETORES ESPALHADAS NO ENTORNO (ALAS OESTE, LESTE, NORTE, SUL) */}
        {/* ========================================================================= */}
        {activeWing !== 'CORE' &&
          filteredSectors.map((sec) => {
            const cfg = SECTOR_ROOM_CONFIGS[sec.id];
            const accentColor = SECTOR_COLORS[sec.id] || '#38bdf8';
            const icon = SECTOR_ICONS[sec.id] || '🏢';
            const isSelected = selectedSectorId === sec.id;
            const squadAgents = FIFTY_SPECIALIZED_AGENTS.filter((a) => a.sectorId === sec.id);

            return (
              <div
                key={sec.id}
                className={`office-department-zone sector-room-zone ${isSelected ? 'selected-sector' : ''}`}
                style={{
                  borderTop: `3px solid ${accentColor}`,
                  borderLeft: isSelected ? `4px solid ${accentColor}` : undefined,
                  background: isSelected
                    ? 'linear-gradient(180deg, rgba(20, 30, 55, 0.95) 0%, rgba(10, 15, 29, 0.98) 100%)'
                    : 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 12, 24, 0.95) 100%)',
                  boxShadow: isSelected ? `0 0 25px ${accentColor}44` : undefined,
                  transition: 'all 0.2s',
                }}
              >
                {/* CABEÇALHO DA SALA DO SETOR */}
                <div
                  className="zone-header"
                  onClick={() => setSelectedSectorId(sec.id)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  title="Clique para selecionar este setor"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{icon}</span>
                    <div>
                      <span className="zone-tag" style={{ color: accentColor, fontWeight: 900, fontSize: '11px' }}>
                        SETOR {cfg ? cfg.sectorNumber : ''}: {sec.name.split(':')[1]?.trim() || sec.name}
                      </span>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                        Sala Dedicada 3D • {cfg ? `Ala ${cfg.wing}` : 'Perímetro'} • 5 Especialistas
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        fontWeight: 700,
                      }}
                    >
                      ALA {cfg?.wing}
                    </span>
                    <span
                      className="zone-badge"
                      style={{
                        background: `${accentColor}22`,
                        color: accentColor,
                        border: `1px solid ${accentColor}55`,
                        fontWeight: 800,
                      }}
                    >
                      5/5 ONLINE
                    </span>
                  </div>
                </div>

                {/* REPOSITÓRIOS DESIGNADOS */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '4px 0' }}>
                  {sec.repos.map((repo) => (
                    <span
                      key={repo}
                      style={{
                        fontSize: '8.5px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        color: '#7dd3fc',
                        fontWeight: 600,
                      }}
                    >
                      📦 {repo}
                    </span>
                  ))}
                </div>

                {/* OS 5 ESPECIALISTAS DA SALA */}
                <div
                  className="zone-desks"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '6px',
                  }}
                >
                  {squadAgents.map((agent) => renderWorkstation(agent))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
