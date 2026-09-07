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

          {/* TELEMETRIA EM TEMPO REAL & PROJETO ATIVO */}
          {!isCeo && (
            <div className="inspector-section" style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px', borderRadius: '8px', border: '1px solid #0284c7' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h4 className="section-title" style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                  ⚡ EXECUÇÃO EM TEMPO REAL (BACKEND / EDGE)
                </h4>
                <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '12px', border: '1px solid #10b981' }}>
                  LIVE TELEMETRY
                </span>
              </div>

              {agent.currentProject && (
                <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: '6px', border: '1px solid #334155', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Repositório Ativo no GitHub:</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#facc15' }}>pubcoreagencia/{agent.currentProject}</span>
                  </div>
                  {agent.currentShiftTask && (
                    <div style={{ fontSize: '11px', color: '#f8fafc', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>🚀</span> <span>{agent.currentShiftTask}</span>
                    </div>
                  )}
                </div>
              )}

              {/* MÉTRICAS DE EXECUÇÃO */}
              {agent.executionMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px', textAlign: 'center' }}>
                  <div style={{ background: '#0f172a', padding: '6px 4px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>ENTREGAS HOJE</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>{agent.executionMetrics.tasksCompletedToday}</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: '6px 4px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>LINHAS/ASSETS</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>{agent.executionMetrics.linesOfCodeOrAssets}</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: '6px 4px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>UPTIME 24H</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>{agent.executionMetrics.uptimePercent}%</div>
                  </div>
                  <div style={{ background: '#0f172a', padding: '6px 4px', borderRadius: '4px', border: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>LATÊNCIA EDGE</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#f59e0b' }}>{agent.executionMetrics.activeLatencyMs}ms</div>
                  </div>
                </div>
              )}

              {/* TERMINAL DO CÓDIGO PROCESSADO PELO AGENTE */}
              {agent.currentCodeSnippet && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                    💻 CÓDIGO / ARQUIVO EM PROCESSO:
                  </div>
                  <pre style={{
                    background: '#0a0e17',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#34d399',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '10.5px',
                    lineHeight: 1.4,
                    overflowX: 'auto',
                    margin: 0
                  }}>
                    {agent.currentCodeSnippet}
                  </pre>
                </div>
              )}

              {/* LOGS HISTÓRICOS EM TEMPO REAL */}
              {agent.realtimeLogs && agent.realtimeLogs.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px' }}>
                    📜 HISTÓRICO DE LOGS DE EXECUÇÃO:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {agent.realtimeLogs.map((lg) => (
                      <div key={lg.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#090d16',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        borderLeft: `2px solid ${lg.level === 'exec' ? '#38bdf8' : lg.level === 'success' ? '#10b981' : '#eab308'}`
                      }}>
                        <span style={{ color: '#64748b', fontFamily: 'monospace' }}>{lg.timestamp}</span>
                        <span style={{ color: lg.level === 'exec' ? '#7dd3fc' : lg.level === 'success' ? '#86efac' : '#fef08a', fontFamily: 'monospace' }}>
                          {lg.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AÇÃO DIRETA DO CEO PARA A BANCADA DESTE AGENTE */}
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid #0284c7', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🎯</span> ENVIAR ORDEM DIRETA PARA A BANCADA ({selectedAgent.name})
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    id="direct-agent-task-input"
                    placeholder={`Ex: ${selectedAgent.id === 'image-designer' ? 'Gerar render 3D de pinscher...' : selectedAgent.id === 'video-editor' ? 'Cortar teaser de drone 4K...' : 'Executar demanda técnica...'}`}
                    style={{
                      flex: 1,
                      background: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      padding: '6px 10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        if (val.trim()) {
                          useStore.getState().submitObjective(`[Direcionado para ${selectedAgent.name}]: ${val.trim()}`);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <button
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 14px',
                      fontWeight: 700,
                      fontSize: '11px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      const inp = document.getElementById('direct-agent-task-input') as HTMLInputElement;
                      if (inp && inp.value.trim()) {
                        useStore.getState().submitObjective(`[Direcionado para ${selectedAgent.name}]: ${inp.value.trim()}`);
                        inp.value = '';
                      }
                    }}
                  >
                    🚀 Despachar
                  </button>
                </div>
              </div>
            </div>
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
