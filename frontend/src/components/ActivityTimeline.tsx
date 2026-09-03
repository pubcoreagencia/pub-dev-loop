import React, { useState } from 'react';
import { useStore } from '../store/useStore';

export const ActivityTimeline: React.FC = () => {
  const { activities, officeEvents } = useStore();
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'TASKS'>('EVENTS');

  return (
    <div className="office-timeline-container">
      <div className="timeline-header">
        <div className="timeline-title-row">
          <span className="timeline-icon">📡</span>
          <h3 className="timeline-title">STREAM ORGANIZACIONAL</h3>
        </div>
        <div className="timeline-tab-switch">
          <button
            className={`tab-btn ${activeTab === 'EVENTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVENTS')}
            title="Eventos semânticos do escritório"
          >
            EVENTOS ({officeEvents.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'TASKS' ? 'active' : ''}`}
            onClick={() => setActiveTab('TASKS')}
            title="Fila de execução de tarefas"
          >
            TAREFAS ({activities.length})
          </button>
        </div>
      </div>

      <div className="timeline-items-list">
        {activeTab === 'EVENTS' ? (
          officeEvents.length === 0 ? (
            <div className="timeline-empty">
              <span>Nenhum evento registrado ainda. Envie um objetivo ao escritório.</span>
            </div>
          ) : (
            officeEvents.map((evt) => (
              <div key={evt.id} className="timeline-event-card event-semantic">
                <div className="event-meta-line">
                  <span className="event-time">{evt.timestamp}</span>
                  <span className="event-type-pill">{evt.type}</span>
                </div>
                <div className="event-actors-line">
                  <span className="actor-tag">👤 {evt.actorId.toUpperCase()}</span>
                  {evt.targetId && (
                    <>
                      <span className="arrow-tag">➔</span>
                      <span className="target-tag">👤 {evt.targetId.toUpperCase()}</span>
                    </>
                  )}
                </div>
                <div className="event-title">{evt.summary}</div>
              </div>
            ))
          )
        ) : activities.length === 0 ? (
          <div className="timeline-empty">
            <span>Nenhuma tarefa registrada no momento.</span>
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
