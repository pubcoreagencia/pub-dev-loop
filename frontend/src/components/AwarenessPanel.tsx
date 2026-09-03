import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';

export const AwarenessPanel: React.FC = () => {
  const {
    awareness,
    skills,
    pipelines,
    isAwarenessPanelOpen,
    toggleAwarenessPanel,
    fetchAwarenessData,
    fetchSkillsData,
    fetchPipelinesData,
    decidePipelineCheckpointAction,
  } = useStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAwarenessPanelOpen) {
        toggleAwarenessPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAwarenessPanelOpen, toggleAwarenessPanel]);

  if (!isAwarenessPanelOpen) return null;

  const pulseColor = awareness?.pulse.badgeColor === 'green' ? '#34d399' :
    awareness?.pulse.badgeColor === 'amber' ? '#fbbf24' :
    awareness?.pulse.badgeColor === 'red' ? '#f87171' : '#94a3b8';

  return (
    <div className="awareness-modal-overlay" onClick={() => toggleAwarenessPanel(false)} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div
        className="awareness-panel-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #1e293b, #0f172a)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>👁️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '0.05em', color: '#f8fafc' }}>
                CONSCIÊNCIA ORGANIZACIONAL
              </h2>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                THE OFFICE • CAMADA DIAGNÓSTICA READ-ONLY (PHASE 8.6-F)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => {
                fetchAwarenessData();
                fetchSkillsData();
                fetchPipelinesData();
              }}
              title="Atualizar dados"
              style={{
                background: 'transparent',
                border: '1px solid #475569',
                color: '#cbd5e1',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              🔄 Atualizar
            </button>
            <button
              onClick={() => toggleAwarenessPanel(false)}
              title="Fechar (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Health & Pulse */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: `1px solid ${pulseColor}40`,
            borderRadius: '6px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: pulseColor, display: 'inline-block' }}></span>
                <strong style={{ fontSize: '16px', color: pulseColor }}>
                  ESTADO ORGANIZACIONAL: {awareness?.pulse.badgeLabel || 'HEALTHY'}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>
                {awareness?.health.summary || 'Diagnóstico operacional normal.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', textAlign: 'right', fontSize: '12px' }}>
              <div>
                <div style={{ color: '#94a3b8' }}>Taxa Sucesso</div>
                <strong style={{ color: '#34d399', fontSize: '15px' }}>{awareness?.health.successRateText || '100%'}</strong>
              </div>
              <div>
                <div style={{ color: '#94a3b8' }}>Taxa Falha</div>
                <strong style={{ color: '#f87171', fontSize: '15px' }}>{awareness?.health.failureRateText || '0%'}</strong>
              </div>
              <div>
                <div style={{ color: '#94a3b8' }}>Bloqueadas</div>
                <strong style={{ color: '#fbbf24', fontSize: '15px' }}>{awareness?.health.tasksBlocked ?? 0}</strong>
              </div>
            </div>
          </div>

          {/* Section 2: Active Risks */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
              ⚠️ Riscos Organizacionais Detectados
            </h3>
            {(!awareness?.risks || awareness.risks.length === 0) ? (
              <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '8px' }}>
                Nenhum risco crítico ou de alta severidade ativo no momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {awareness.risks.map((risk) => (
                  <div key={risk.id} style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '4px',
                    padding: '10px 14px',
                    fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ color: '#fca5a5' }}>{risk.riskType}</strong>
                      <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '3px' }}>
                        {risk.severity} ({risk.confidence} Confiança)
                      </span>
                    </div>
                    <div style={{ color: '#cbd5e1' }}>{risk.evidence.join(' | ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Bottlenecks & Trends */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Bottlenecks */}
            <div>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
                🚦 Gargalos de Fluxo
              </h3>
              {(!awareness?.bottlenecks || awareness.bottlenecks.length === 0) ? (
                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '8px' }}>
                  Fluxo de trabalho fluindo sem gargalos operacionais.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {awareness.bottlenecks.map((b) => (
                    <div key={b.id} style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '4px',
                      padding: '10px 12px',
                      fontSize: '13px',
                    }}>
                      <strong style={{ color: '#fcd34d' }}>{b.title}</strong>
                      <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '12px' }}>{b.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Trends */}
            <div>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
                📈 Tendências Temporais
              </h3>
              {(!awareness?.trends || awareness.trends.length === 0) ? (
                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', padding: '8px' }}>
                  Amostras em coleta para cálculo de tendências.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {awareness.trends.map((t, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(30, 41, 59, 0.5)',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      padding: '10px 12px',
                      fontSize: '13px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>{t.metricName}</span>
                        <strong style={{
                          color: t.direction === 'IMPROVING' ? '#34d399' :
                            t.direction === 'DEGRADING' ? '#f87171' :
                            t.direction === 'STABLE' ? '#38bdf8' : '#94a3b8'
                        }}>
                          {t.direction}
                        </strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>{t.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Workforce Distribution (No Ranking/Scores) */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
              👥 Visibilidade da Força de Trabalho (Distribuição de Tarefas)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              {Object.entries(awareness?.agentLoad || {}).map(([role, load]) => (
                <div key={role} style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '12px',
                }}>
                  <strong style={{ color: '#38bdf8', textTransform: 'capitalize' }}>{role}</strong>
                  <div style={{ marginTop: '6px', color: '#94a3b8' }}>
                    <div>Tarefas: <span style={{ color: '#f8fafc' }}>{load.taskCount}</span></div>
                    <div>Falhas: <span style={{ color: load.failureCount > 0 ? '#f87171' : '#f8fafc' }}>{load.failureCount}</span></div>
                    <div>Bloqueios: <span style={{ color: load.blockedCount > 0 ? '#fbbf24' : '#f8fafc' }}>{load.blockedCount}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Insights & Advisory Recommendations */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
              💡 Insights & Recomendações Consultivas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {awareness?.recommendations?.map((rec) => (
                <div key={rec.id} style={{
                  background: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  borderRadius: '4px',
                  padding: '10px 14px',
                  fontSize: '13px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#38bdf8' }}>{rec.title}</strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Decisão Humana Necessária (Advisory)
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', color: '#cbd5e1' }}>{rec.description}</p>
                  <div style={{ fontSize: '12px', color: '#93c5fd' }}>
                    👉 <em>Sugestão:</em> {rec.suggestedAction}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 6: Daily Skills Catalog */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
              🧠 Catálogo de Skills Organizacionais ({skills?.length || 0})
            </h3>
            {(!skills || skills.length === 0) ? (
              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                Nenhuma skill consolidada no momento. Lições institucionais validadas são compiladas em skills práticas reutilizáveis.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                {skills.map((sk) => (
                  <div key={sk.id} style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '12px',
                  }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8' }}>
                      ⚡ {sk.name} <span style={{ fontSize: '10px', color: '#94a3b8' }}>(v{sk.version})</span>
                    </div>
                    <div style={{ marginTop: '4px', color: '#cbd5e1' }}>{sk.description}</div>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8' }}>
                      Papéis: <span style={{ color: '#f8fafc' }}>{sk.applicableRoles.join(', ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 7: Autonomous Pipelines & Adaptive Flow */}
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', margin: '0 0 10px 0' }}>
              🚀 Pipelines Autônomos & Fluxo Adaptativo ({pipelines?.length || 0})
            </h3>
            {(!pipelines || pipelines.length === 0) ? (
              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                Nenhum pipeline ativo no momento. O Chief of Staff orquestra objetivos estratégicos do CEO em DAGs de execução.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pipelines.map((pipe) => (
                  <div key={pipe.id} style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '12px',
                    fontSize: '12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#38bdf8', fontSize: '13px' }}>📋 {pipe.title}</strong>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: pipe.status === 'COMPLETED' ? 'rgba(52, 211, 153, 0.2)' :
                          pipe.status === 'WAITING_APPROVAL' ? 'rgba(251, 191, 36, 0.2)' :
                          pipe.status === 'FAILED' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: pipe.status === 'COMPLETED' ? '#34d399' :
                          pipe.status === 'WAITING_APPROVAL' ? '#fbbf24' :
                          pipe.status === 'FAILED' ? '#f87171' : '#38bdf8',
                      }}>
                        {pipe.status} ({pipe.completedSteps}/{pipe.totalSteps})
                      </span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', color: '#cbd5e1' }}>{pipe.ceoObjective}</p>

                    {/* Steps list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
                      {pipe.steps.map((st) => (
                        <div key={st.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 8px',
                          background: 'rgba(15, 23, 42, 0.5)',
                          borderRadius: '4px',
                        }}>
                          <div>
                            <span style={{ color: '#f8fafc', fontWeight: 500 }}>{st.title}</span>
                            <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: '8px' }}>({st.targetRole})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              backgroundColor: st.status === 'COMPLETED' ? '#065f46' :
                                st.status === 'WAITING_APPROVAL' ? '#78350f' :
                                st.status === 'READY' ? '#1e3a8a' : '#1e293b',
                              color: st.status === 'COMPLETED' ? '#6ee7b7' :
                                st.status === 'WAITING_APPROVAL' ? '#fde68a' :
                                st.status === 'READY' ? '#93c5fd' : '#94a3b8',
                            }}>
                              {st.status}
                            </span>
                            {st.checkpoint && st.checkpoint.status === 'PENDING' && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => decidePipelineCheckpointAction(pipe.id, st.id, 'GRANT')}
                                  style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => decidePipelineCheckpointAction(pipe.id, st.id, 'REJECT')}
                                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '3px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
                                >
                                  Rejeitar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #334155',
          background: '#0b1120',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b',
        }}>
          <span>Soberania do CEO preservada • Sem execução autônoma</span>
          <span>Avaliado em: {awareness?.metadata?.evaluatedAt || 'Agora'}</span>
        </div>
      </div>
    </div>
  );
};
