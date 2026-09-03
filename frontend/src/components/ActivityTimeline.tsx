import React from 'react';
import { useStore } from '../store/useStore';

export const ActivityTimeline: React.FC = () => {
  const { activities } = useStore();

  return (
    <div className="office-timeline-container">
      <div className="timeline-header">
        <span className="timeline-icon">📡</span>
        <h3 className="timeline-title">WORKPLACE ACTIVITY STREAM</h3>
      </div>

      <div className="timeline-items-list">
        {activities.length === 0 ? (
          <div className="timeline-empty">Office stream idle. Awaiting CEO objectives.</div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className={`timeline-event-card ${act.type.toLowerCase()}`}>
              <div className="event-meta">
                <span className="event-time">{act.timestamp}</span>
                {act.agentId && <span className="event-agent">@{act.agentId}</span>}
              </div>
              <div className="event-title">{act.title}</div>
              {act.description && <div className="event-desc">{act.description}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
