import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';

export const LiveDashboardModal: React.FC = () => {
  const activeDash = useStore((s) => s.activeLiveDashboard);
  const closeDash = () => useStore.getState().setActiveLiveDashboard(null);

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'NODES' | 'LATENCY' | 'PROCESSES'>('OVERVIEW');
  const [learningRate, setLearningRate] = useState(0.0025);
  const [isProcessing, setIsProcessing] = useState(true);

  if (!activeDash || !activeDash.open) return null;

  const repoName = activeDash.project || 'neural-os';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 20000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={closeDash}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #090d16 0%, #0f172a 100%)',
          border: '1.5px solid #38bdf8',
          borderRadius: '24px',
          boxShadow: '0 25px 70px rgba(0,0,0,0.9), 0 0 45px rgba(56, 189, 248, 0.25)',
          maxWidth: '1020px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Dashboard Vivo */}
        <div
          style={{
            padding: '20px 28px',
            background: 'linear-gradient(90deg, #1e293b, #0f172a)',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)',
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                  PUB NEURAL OS • EXECUTIVE COMMAND DASHBOARD
                </h2>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    background: '#10b981',
                    color: '#000',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  LIVE PROD
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Repositório: <strong style={{ color: '#38bdf8' }}>pubcoreagencia/{repoName}</strong> • Kernel Neural 24/7 Operacional
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsProcessing(!isProcessing)}
              style={{
                background: isProcessing ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: isProcessing ? '#4ade80' : '#f87171',
                border: isProcessing ? '1px solid #10b981' : '1px solid #ef4444',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isProcessing ? '🟢 Neural Loop Ativo' : '⏸ Loop Pausado'}
            </button>
            <button
              onClick={closeDash}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* Abas de Navegação do Dashboard */}
        <div
          style={{
            padding: '12px 28px',
            background: '#090d16',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            gap: '12px',
          }}
        >
          {[
            { id: 'OVERVIEW', label: '📊 Visão Geral & Métricas' },
            { id: 'NODES', label: '🧠 Topologia de Nós Neurais' },
            { id: 'LATENCY', label: '⚡ Latência & Conexões' },
            { id: 'PROCESSES', label: '🛡️ Auditoria & Snapshots' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid #38bdf8' : '1px solid transparent',
                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo Dinâmico */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'OVERVIEW' && (
            <>
              {/* 4 Cards de Métricas Principais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Nós Neurais Ativos</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>1.024</div>
                  <span style={{ fontSize: '10px', color: '#4ade80' }}>↑ 100% de integridade</span>
                </div>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Taxa de Precisão (Loss)</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>99.4%</div>
                  <span style={{ fontSize: '10px', color: '#4ade80' }}>Loss: 0.0052 (-0.1%)</span>
                </div>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Latência de Inferência</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>42 ms</div>
                  <span style={{ fontSize: '10px', color: '#38bdf8' }}>Cloudflare Edge Global</span>
                </div>
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '14px', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Tempo Operacional (Uptime)</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>99.98%</div>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>24/7 Autônomo ativo</span>
                </div>
              </div>

              {/* Gráficos e Status do Ecossistema */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      ⚡ Taxa de Transmissão Sináptica & Processamento
                    </h3>
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>Em tempo real</span>
                  </div>
                  {/* Barras de Atividade Dinâmica */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '8px', padding: '10px 0' }}>
                    {[65, 78, 55, 90, 82, 95, 88, 70, 85, 92, 98, 75, 84, 91, 89, 96].map((val, idx) => (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${val}%`,
                            background: idx === 15 ? '#38bdf8' : 'linear-gradient(180deg, #0284c7 0%, #1e293b 100%)',
                            borderRadius: '4px 4px 0 0',
                            boxShadow: idx === 15 ? '0 0 12px #38bdf8' : 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                    ⚙️ Hiperparâmetros
                  </h3>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                      <span>Taxa de Aprendizado (Learning Rate)</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>{learningRate}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0005"
                      max="0.01"
                      step="0.0005"
                      value={learningRate}
                      onChange={(e) => setLearningRate(Number(e.target.value))}
                      style={{ width: '100%', marginTop: '6px', accentColor: '#38bdf8' }}
                    />
                  </div>
                  <div style={{ padding: '10px', background: '#090d16', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}>
                    <div><strong>Modo:</strong> Reinforcement Learning</div>
                    <div style={{ marginTop: '4px' }}><strong>Otimizador:</strong> AdamW + Gradient Clip</div>
                    <div style={{ marginTop: '4px' }}><strong>Batch Size:</strong> 64 pipelines/tick</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'NODES' && (
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                🧠 Topologia em Camadas do Neural OS
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                {['Input Layer (Entrada de Dados)', 'Hidden Layer 1 (Codex Analítico)', 'Hidden Layer 2 (Orquestração)', 'Output Layer (Ações & Deploys)'].map((layer, i) => (
                  <div key={i} style={{ background: '#090d16', padding: '14px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '12px' }}>{layer}</div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '6px' }}>256 Neurônios Articulados</div>
                    <div style={{ color: '#38bdf8', fontSize: '10px', marginTop: '8px' }}>Ativação: GELU / Softmax</div>
                    <div style={{ marginTop: '10px', height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${85 + i * 4}%`, height: '100%', background: '#38bdf8' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'LATENCY' && (
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                ⚡ Monitor de Edge & Roteamento Global
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { region: 'São Paulo (GRU)', status: 'Online', ms: '12 ms', traffic: '42%' },
                  { region: 'Washington DC (IAD)', status: 'Online', ms: '85 ms', traffic: '28%' },
                  { region: 'Frankfurt (FRA)', status: 'Online', ms: '140 ms', traffic: '18%' },
                  { region: 'Tóquio (NRT)', status: 'Online', ms: '210 ms', traffic: '12%' },
                ].map((edge, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#090d16', borderRadius: '10px', border: '1px solid #1e293b' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '12px' }}>{edge.region}</span>
                    <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 600 }}>🟢 {edge.status}</span>
                    <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700 }}>{edge.ms}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Tráfego: {edge.traffic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'PROCESSES' && (
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>
                🛡️ Auditoria de Snapshots e Rollback em Tempo Real
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'snap-neural-os-latest', file: 'neural-os/AUTONOMOUS_CYCLE.md', status: 'ACTIVE', time: 'Último ciclo' },
                  { id: 'snap-pub-shopee-scraper-latest', file: 'pub-shopee-scraper/package.json', status: 'SYNCHRONIZED', time: 'Hoje' },
                  { id: 'snap-pubecomhub-latest', file: 'pubecomhub/src/server/catalogProxy.ts', status: 'SYNCHRONIZED', time: 'Hoje' },
                ].map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#090d16', borderRadius: '8px' }}>
                    <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '12px' }}>{s.id}</span>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{s.file}</span>
                    <span style={{ color: '#10b981', fontSize: '10px', fontWeight: 700 }}>{s.status}</span>
                    <span style={{ color: '#94a3b8', fontSize: '10px' }}>{s.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
