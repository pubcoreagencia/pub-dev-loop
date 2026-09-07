import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { SCHEDULED_PROJECTS, getCurrentShift } from '../services/autonomousScheduleData';

export const ActivityTimeline: React.FC = () => {
  const { activities, officeEvents } = useStore();
  const [activeTab, setActiveTab] = useState<'EVENTS' | 'TASKS' | 'SCHEDULE'>('EVENTS');
  const currentShift = getCurrentShift();

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
          <button
            className={`tab-btn ${activeTab === 'SCHEDULE' ? 'active' : ''}`}
            onClick={() => setActiveTab('SCHEDULE')}
            title="Esteira contínua de 52 projetos"
          >
            CRONOGRAMA (52)
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
        ) : activeTab === 'TASKS' ? (
          activities.length === 0 ? (
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
          )
        ) : (
          /* ABA CRONOGRAMA AUTÔNOMO 24H (52 PROJETOS) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                padding: '8px 10px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #0284c7',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            >
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '2px' }}>
                ⏰ {currentShift.name} ({currentShift.timeRange})
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '10px' }}>
                {currentShift.focus}
              </div>
            </div>

            {SCHEDULED_PROJECTS.map((proj) => (
              <div
                key={proj.name}
                className="timeline-event-card"
                style={{
                  borderLeft: `3px solid ${
                    proj.priority === 'P0' ? '#ef4444' : proj.priority === 'P1' ? '#f59e0b' : '#38bdf8'
                  }`,
                }}
              >
                <div className="event-meta-line" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '11px' }}>
                    📦 {proj.name}
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: proj.priority === 'P0' ? '#7f1d1d' : proj.priority === 'P1' ? '#78350f' : '#0c4a6e',
                      color: '#ffffff',
                      fontWeight: 700,
                    }}
                  >
                    {proj.priority} • {proj.stage}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#e2e8f0', marginTop: '3px', fontWeight: 600 }}>
                  ⚡ {proj.currentTask}
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                  Responsável: <strong style={{ color: '#facc15' }}>{proj.ownerAgent.toUpperCase()}</strong> • Cadência: {proj.cadence}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
