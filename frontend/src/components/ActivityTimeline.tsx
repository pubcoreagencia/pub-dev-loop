import React from 'react';
import { useStore } from '../store/useStore';

export const ActivityTimeline: React.FC = () => {
  const { activities } = useStore();

  return (
    <div className="office-timeline-container">
      <div className="timeline-header">
        <span className="timeline-icon">📡</span>
        <h3 className="timeline-title">STREAM DE ATIVIDADES DO ESCRITÓRIO</h3>
      </div>

      <div className="timeline-items-list">
        {activities.length === 0 ? (
          <div className="timeline-empty">
            <span>Escritório em repouso. Aguardando novos objetivos do CEO.</span>
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="timeline-event-card">
              <div className="event-meta-line">
                <span className="event-time">{act.timestamp}</span>
                {act.agentId && (
                  <span className="event-agent-tag">[{act.agentId.toUpperCase()}]</span>
                )}
              </div>
              <div className="event-title">{act.title}</div>
              <div className="event-desc">{act.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
