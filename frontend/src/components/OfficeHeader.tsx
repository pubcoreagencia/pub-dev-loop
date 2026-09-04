import React from 'react';
import { useStore } from '../store/useStore';
import { TurntablePlayer } from './TurntablePlayer';
import { ProjectSelector } from './ProjectSelector';

export const OfficeHeader: React.FC = () => {
  const { agents, tasks, activeGateway } = useStore();

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
        {/* Toca-Discos SoundCloud Pub Records */}
        <TurntablePlayer />

        {/* Gateway Dinâmico em Tempo Real */}
        <div className="status-badge" title="Gateway ativo em tempo real">
          <span className={`status-dot ${activeGateway === '9ROUTER' ? 'blue' : 'green'}`}></span>
          <span>GATEWAY: <strong style={{ color: activeGateway === '9ROUTER' ? '#60a5fa' : '#34d399' }}>{activeGateway}</strong></span>
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

        <ProjectSelector />
      </div>
    </header>
  );
};
