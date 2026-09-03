import React from 'react';
import { useStore } from '../store/useStore';

export const OfficeHeader: React.FC = () => {
  const { agents, tasks, health, activeProject, setActiveProject } = useStore();

  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <header className="office-header">
      <div className="header-brand">
        <div className="vintage-logo-box">
          <span className="logo-symbol">🏢</span>
          <div>
            <h1 className="logo-title">THE OFFICE</h1>
            <span className="logo-subtitle">PUB DEV LOOP • AUTONOMOUS WORKFORCE</span>
          </div>
        </div>
      </div>

      <div className="header-status-ribbon">
        <div className="status-badge" title="Gateway Hierarchy">
          <span className="status-dot green"></span>
          <span>GATEWAY: <strong>DUAL (OR+9R)</strong></span>
        </div>
        <div className="status-badge" title="Runtime Health">
          <span className="status-dot green"></span>
          <span>SYSTEM: <strong>{health?.status?.toUpperCase() || 'ONLINE'}</strong></span>
        </div>
        <div className="status-badge" title="Active Workforce">
          <span className="badge-icon">👥</span>
          <span>AGENTS: <strong>{agents.length || 5}</strong></span>
        </div>
        <div className="status-badge" title="Task Queue">
          <span className="badge-icon">⚡</span>
          <span>RUNNING: <strong style={{ color: '#fbbf24' }}>{runningTasks}</strong></span>
          <span style={{ margin: '0 4px', color: '#64748b' }}>|</span>
          <span>DONE: <strong style={{ color: '#34d399' }}>{completedTasks}</strong></span>
        </div>

        <div className="project-selector-wrapper">
          <label className="project-label">PROJECT:</label>
          <input
            type="text"
            className="project-input"
            value={activeProject}
            onChange={(e) => setActiveProject(e.target.value)}
            placeholder="e.g. pub-dev-loop"
          />
        </div>
      </div>
    </header>
  );
};
