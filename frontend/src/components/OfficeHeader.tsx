import React from 'react';
import { useStore } from '../store/useStore';

export const OfficeHeader: React.FC = () => {
  const { agents, tasks, health, activeProject, setActiveProject, streamStatus } = useStore();

  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <header className="office-header">
      <div className="header-brand">
        <div className="vintage-logo-box">
          <span className="logo-symbol">🏢</span>
          <div>
            <h1 className="logo-title">THE OFFICE</h1>
            <span className="logo-subtitle">PUB DEV LOOP • FORÇA DE TRABALHO AUTÔNOMA</span>
          </div>
        </div>
      </div>

      <div className="header-status-ribbon">
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

        <div className="project-selector-wrapper">
          <label className="project-label">PROJETO:</label>
          <input
            type="text"
            className="project-input"
            value={activeProject}
            onChange={(e) => setActiveProject(e.target.value)}
            placeholder="ex: pub-dev-loop"
            title="Projeto ativo no escritório"
          />
        </div>
      </div>
    </header>
  );
};
