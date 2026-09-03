import React from 'react';
import { useStore } from '../store/useStore';
import type { AgentDefinition } from '../types/office';
import { OPERATIONAL_STATE_LABELS_PT } from '../config/officeLayout';

export const AgentInspector: React.FC = () => {
  const { selectedAgent, selectAgent, tasks, skills } = useStore();

  if (!selectedAgent) return null;

  const isCeo = selectedAgent.role === 'CEO';
  const agent = selectedAgent as AgentDefinition;

  const agentSkills = !isCeo
    ? (skills || []).filter((s) => s.applicableRoles?.includes(agent.id) && s.status === 'ACTIVE')
    : [];

  const activeTask = !isCeo
    ? tasks.find((t) => t.agentId === agent.id && t.status === 'RUNNING')
    : undefined;

  const lastTask = !isCeo
    ? tasks.find((t) => t.agentId === agent.id && t.status === 'COMPLETED')
    : undefined;

  const stateInfo = isCeo
    ? { label: 'Comandante Ativo', tagCls: 'state-idle' }
    : OPERATIONAL_STATE_LABELS_PT[agent.operationalState || 'idle'];

  return (
    <div className="agent-inspector-modal-backdrop" onClick={() => selectAgent(undefined)}>
      <div className="agent-inspector-modal" onClick={(e) => e.stopPropagation()}>
        {/* CABEÇALHO DO DOSSIÊ */}
        <div className="inspector-header">
          <div className="inspector-profile-header">
            <div
              className="inspector-avatar-badge"
              style={{ borderColor: selectedAgent.avatar?.accentColor || '#f59e0b' }}
            >
              <span className="inspector-avatar-icon">
                {selectedAgent.avatar?.badgeIcon || (isCeo ? '👑' : '💼')}
              </span>
            </div>
            <div>
              <h2 className="inspector-agent-name">{selectedAgent.name}</h2>
              <span className="inspector-agent-title">{selectedAgent.title}</span>
            </div>
          </div>

          <button className="btn-close-inspector" onClick={() => selectAgent(undefined)}>
            ✕
          </button>
        </div>

        {/* CONTEÚDO DO DOSSIÊ */}
        <div className="inspector-body">
          <div className="inspector-status-banner">
            <span className="status-label">STATUS OPERACIONAL:</span>
            <span className={`status-badge-inline ${stateInfo.tagCls}`}>
              {stateInfo.label}
            </span>
            <span className="desk-location-tag">
              📍 {selectedAgent.position?.zoneName || 'Escritório'} • {selectedAgent.position?.deskLabel || 'Bancada'}
            </span>
          </div>

          <div className="inspector-section">
            <h4 className="section-title">PERFIL &amp; PERSONALIDADE CORPORATIVA</h4>
            <p className="section-text">{selectedAgent.personalitySummary}</p>
          </div>

          {/* DOSSIÊ DE VIDA, GOSTOS & RIXAS DE ESCRITÓRIO */}
          {selectedAgent.avatar && (
            <div className="inspector-section" style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '6px', padding: '10px', border: '1px solid #334155' }}>
              <h4 className="section-title" style={{ color: selectedAgent.avatar.accentColor }}>
                🎭 DOSSIÊ HUMANO &amp; HÁBITOS DE ESCRITÓRIO
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
                {selectedAgent.avatar.age && (
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Idade:</strong> <span style={{ color: '#f8fafc' }}>{selectedAgent.avatar.age} anos</span>
                  </div>
                )}
                {selectedAgent.avatar.nickname && (
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Codinome:</strong> <span style={{ color: '#38bdf8', fontWeight: 600 }}>"{selectedAgent.avatar.nickname}"</span>
                  </div>
                )}
                {selectedAgent.avatar.drinkPreference && (
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Bebida Favorita:</strong> <span style={{ color: '#f8fafc' }}>☕ {selectedAgent.avatar.drinkPreference}</span>
                  </div>
                )}
                {selectedAgent.avatar.musicTaste && (
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Gosto Musical:</strong> <span style={{ color: '#f8fafc' }}>🎧 {selectedAgent.avatar.musicTaste}</span>
                  </div>
                )}
              </div>

              {selectedAgent.avatar.catchphrase && (
                <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(15, 23, 42, 0.6)', borderLeft: `3px solid ${selectedAgent.avatar.accentColor}`, borderRadius: '4px', fontStyle: 'italic', fontSize: '12px', color: '#cbd5e1' }}>
                  💬 "{selectedAgent.avatar.catchphrase}"
                </div>
              )}

              {selectedAgent.avatar.rivalries && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#fca5a5' }}>
                  ⚡ <strong>Dinâmica / Rixas:</strong> {selectedAgent.avatar.rivalries}
                </div>
              )}

              {selectedAgent.avatar.backgroundLore && (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                  📖 <strong>Histórico:</strong> {selectedAgent.avatar.backgroundLore}
                </div>
              )}
            </div>
          )}

          <div className="inspector-section">
            <h4 className="section-title">ESPECIALIDADE PRINCIPAL</h4>
            <p className="section-text-highlight">{selectedAgent.specialty}</p>
          </div>

          {!isCeo && (
            <>
              <div className="inspector-section">
                <h4 className="section-title">RESPONSABILIDADES DE CARGO</h4>
                <ul className="inspector-list">
                  {agent.responsibilities?.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="inspector-section">
                <h4 className="section-title">CAPACIDADES TÉCNICAS DECLARADAS</h4>
                <div className="capabilities-tag-cloud">
                  {agent.capabilities?.map((c, i) => (
                    <span key={i} className="capability-tag">{c}</span>
                  ))}
                </div>
              </div>

              <div className="inspector-section">
                <h4 className="section-title">PERFIL COGNITIVO &amp; MODELO</h4>
                <div className="model-profile-details">
                  <div className="detail-item">
                    <span className="detail-key">Perfil de Roteamento:</span>
                    <span className="detail-val">{agent.routingProfile}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-key">Modelo Preferencial:</span>
                    <span className="detail-val">{agent.preferredModel || 'DualGateway Router'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-key">Autoridade de Gestão:</span>
                    <span className="detail-val">{agent.isManager ? 'Sim (Gerente)' : 'Especialista'}</span>
                  </div>
                </div>
              </div>

              {/* SKILLS ORGANIZACIONAIS DOMINADAS */}
              {agentSkills.length > 0 && (
                <div className="inspector-section">
                  <h4 className="section-title">🧠 SKILLS ORGANIZACIONAIS DOMINADAS ({agentSkills.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {agentSkills.map((sk) => (
                      <div key={sk.id} style={{ padding: '8px', background: '#1e293b', borderRadius: '4px', border: '1px solid #334155' }}>
                        <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '13px' }}>
                          ⚡ {sk.name} <span style={{ fontSize: '11px', color: '#94a3b8' }}>(v{sk.version})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>{sk.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAREFA ATIVA */}
          {activeTask && (
            <div className="inspector-section active-task-section">
              <h4 className="section-title">⚡ TAREFA EM EXECUÇÃO AGORA</h4>
              <div className="active-task-card">
                <div className="task-obj">{activeTask.objective}</div>
                <div className="task-meta-row">
                  <span>ID: {activeTask.id.slice(0, 16)}</span>
                  <span>Worker: {activeTask.worker}</span>
                </div>
              </div>
            </div>
          )}

          {/* ÚLTIMA ENTREGA */}
          {lastTask && (
            <div className="inspector-section">
              <h4 className="section-title">✅ ÚLTIMO ENTREGÁVEL CONCLUÍDO</h4>
              <div className="completed-task-card">
                <div className="task-obj">{lastTask.objective}</div>
                {lastTask.result?.summary && (
                  <p className="task-summary">{lastTask.result.summary}</p>
                )}
                <span className="task-completed-time">
                  Concluído em: {new Date(lastTask.updatedAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
