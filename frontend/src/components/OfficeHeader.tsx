import React from 'react';
import { useStore } from '../store/useStore';
import { TurntablePlayer } from './TurntablePlayer';
import { ProjectSelector } from './ProjectSelector';

export const OfficeHeader: React.FC = () => {
  const { agents, tasks, health, streamStatus } = useStore();

  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <header className="office-header">
      <div className="header-brand">
        <div className="vintage-logo-box">
          <span className="logo-symbol">🏢</span>
          <div>
            <h1 className="logo-title">THE OFFICE</h1>
            <span className="logo-subtitle">PUB DEV LOOP • ESCRITÓRIO 3D VIVO</span>
          </div>
        </div>
      </div>

      <div className="header-status-ribbon">
        {/* Toca-Discos Lo-Fi / Synthwave do Escritório */}
        <TurntablePlayer />

        <div className="status-badge" title="Canal de Eventos em Tempo Real">
          <span className={`status-dot ${streamStatus === 'connected' ? 'green' : streamStatus === 'connecting' ? 'amber' : 'red'}`}></span>
          <span>STREAM: <strong>{streamStatus === 'connected' ? 'LIVE (SSE)' : streamStatus === 'connecting' ? 'CONECTANDO...' : 'FALLBACK'}</strong></span>
        </div>
        <div className="status-badge" title="Hierarquia de Roteamento de Modelos">
          <span className="status-dot green"></span>
          <span>GATEWAY: <strong>DUAL (OR+9R)</strong></span>
        </div>
        <div className="status-badge" title="Saúde do Runtime">
          <span className="status-dot green"></span>
          <span>SISTEMA: <strong>{health?.status === 'ok' || health?.status === 'online' ? 'OPERACIONAL' : health?.status?.toUpperCase() || 'OPERACIONAL'}</strong></span>
        </div>
        <div className="status-badge" title="Equipe de Especialistas">
          <span className="badge-icon">👥</span>
          <span>FUNCIONÁRIOS: <strong>{agents.length || 5}</strong></span>
        </div>
        <div className="status-badge" title="Fila de Execução">
          <span className="badge-icon">⚡</span>
          <span>EM EXECUÇÃO: <strong style={{ color: '#fbbf24' }}>{runningTasks}</strong></span>
          <span style={{ margin: '0 4px', color: '#64748b' }}>|</span>
          <span>CONCLUÍDAS: <strong style={{ color: '#34d399' }}>{completedTasks}</strong></span>
        </div>

        <button
          className={`status-badge awareness-pulse-btn ${useStore.getState().isAwarenessPanelOpen ? 'active' : ''}`}
          onClick={() => useStore.getState().toggleAwarenessPanel()}
          title="Clique para abrir a Consciência Organizacional (Phase 8.6-F)"
          style={{ cursor: 'pointer', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '4px 8px' }}
        >
          <span className={`status-dot ${useStore.getState().awareness?.pulse.badgeColor === 'green' ? 'green' : useStore.getState().awareness?.pulse.badgeColor === 'amber' ? 'amber' : useStore.getState().awareness?.pulse.badgeColor === 'red' ? 'red' : 'gray'}`}></span>
          <span>ORGANIZAÇÃO: <strong style={{ color: useStore.getState().awareness?.pulse.badgeColor === 'green' ? '#34d399' : useStore.getState().awareness?.pulse.badgeColor === 'amber' ? '#fbbf24' : useStore.getState().awareness?.pulse.badgeColor === 'red' ? '#f87171' : '#94a3b8' }}>{useStore.getState().awareness?.pulse.badgeLabel || 'HEALTHY'}</strong></span>
        </button>

        <ProjectSelector />
      </div>
    </header>
  );
};
