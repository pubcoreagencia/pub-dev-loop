import React from "react";
import { useStore } from "../store/useStore";
import type { Agent } from "../types/agent";
import type { Task } from "../types/task";
import { STATE_LABELS_PT } from "../services/agentAdapter";

interface Props {
  selectedAgent?: Agent;
  onClose: () => void;
}

export const SidePanel: React.FC<Props> = ({ selectedAgent, onClose }) => {
  const { tasks, agents, selectAgent, loading, error } = useStore();

  const queuedTasks = tasks.filter((t: Task) => ["QUEUED", "ASSIGNED"].includes(t.status));
  const runningTasks = tasks.filter((t: Task) => ["RUNNING", "TESTING"].includes(t.status));
  const finishedTasks = tasks.filter((t: Task) =>
    ["COMPLETED", "FAILED", "NEEDS_REVIEW", "BLOCKED", "CANCELLED"].includes(t.status)
  );

  return (
    <aside className="side-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="live-dot" />
          <h2>Central de Comando</h2>
        </div>
        <button className="close-btn" onClick={onClose} title="Fechar painel">
          ✖
        </button>
      </div>

      <div className="panel-content">
        {loading && <div className="loading-bar">Atualizando dados em tempo real...</div>}
        {error && <div className="error-card">{error}</div>}

        {/* Selected Agent Details (Requisito 9) */}
        {selectedAgent && (
          <section className="agent-details-card">
            <div className="card-header">
              <span className="badge-category">Escritório Virtual</span>
              <h3>DETALHES DO AGENTE</h3>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">AGENTE</span>
                <span className="detail-value highlight">{selectedAgent.name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">FUNÇÃO</span>
                <span className="detail-value">{selectedAgent.role}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">ESTADO</span>
                <span className={`status-pill status-${selectedAgent.state.toLowerCase()}`}>
                  {STATE_LABELS_PT[selectedAgent.state] ?? selectedAgent.state}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">SALA ATUAL</span>
                <span className="detail-value room-name">{selectedAgent.room}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">PROVEDOR</span>
                <span className="detail-value provider-badge">{selectedAgent.provider}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">MODELO</span>
                <span className="detail-value model-badge">{selectedAgent.model}</span>
              </div>

              <div className="detail-item full-width">
                <span className="detail-label">TAREFA</span>
                <span className="detail-value task-id" title={selectedAgent.taskId}>
                  {selectedAgent.taskId}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">PROJETO</span>
                <span className="detail-value">{selectedAgent.project}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">REPOSITÓRIO</span>
                <span className="detail-value repo-url" title={selectedAgent.repository}>
                  {selectedAgent.repository.split("/").pop() || selectedAgent.repository}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">TEMPO DE EXECUÇÃO</span>
                <span className="detail-value">{selectedAgent.duration}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">INÍCIO</span>
                <span className="detail-value text-muted">{selectedAgent.startedAt}</span>
              </div>

              <div className="detail-item full-width">
                <span className="detail-label">ÚLTIMO EVENTO</span>
                <span className="detail-value event-text">{selectedAgent.lastEvent}</span>
              </div>

              <div className="detail-item full-width">
                <span className="detail-label">COMMIT</span>
                <span className="detail-value commit-hash">
                  {selectedAgent.commitSha ? selectedAgent.commitSha.slice(0, 10) : "-"}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Active Agents Section */}
        <section className="panel-section">
          <div className="section-title-row">
            <h4>Agentes em Operação</h4>
            <span className="count-tag">{agents.length}</span>
          </div>
          {agents.length === 0 ? (
            <p className="empty-text">Nenhum agente ativo no momento.</p>
          ) : (
            <div className="agent-cards-list">
              {agents.map((agent: Agent) => (
                <div
                  key={agent.id}
                  className={`agent-card-item ${
                    selectedAgent?.id === agent.id ? "active-agent" : ""
                  }`}
                  onClick={() => selectAgent(agent)}
                >
                  <div className="agent-card-top">
                    <span className="agent-name">{agent.name}</span>
                    <span className={`status-pill-sm status-${agent.state.toLowerCase()}`}>
                      {STATE_LABELS_PT[agent.state] ?? agent.state}
                    </span>
                  </div>
                  <div className="agent-card-meta">
                    <span>Sala: <strong>{agent.room}</strong></span>
                    <span>Mod: {agent.model}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Real Tasks Tracking */}
        <section className="panel-section">
          <div className="section-title-row">
            <h4>Tarefas em Execução</h4>
            <span className="count-tag">{runningTasks.length}</span>
          </div>
          {runningTasks.length === 0 ? (
            <p className="empty-text">Nenhuma tarefa em execução ativa.</p>
          ) : (
            <ul className="task-list">
              {runningTasks.map((t: Task) => (
                <li key={t.id} className="task-item">
                  <div className="task-row">
                    <span className="task-title">{t.objective || t.prompt || t.id}</span>
                    <span className={`status-badge-inline status-${t.status.toLowerCase()}`}>
                      {STATE_LABELS_PT[t.status] ?? t.status}
                    </span>
                  </div>
                  <span className="task-sub">{t.project} • {t.repository.split("/").pop()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title-row">
            <h4>Fila de Espera</h4>
            <span className="count-tag">{queuedTasks.length}</span>
          </div>
          {queuedTasks.length === 0 ? (
            <p className="empty-text">Fila de espera vazia.</p>
          ) : (
            <ul className="task-list">
              {queuedTasks.map((t: Task) => (
                <li key={t.id} className="task-item">
                  <div className="task-row">
                    <span className="task-title">{t.objective || t.prompt || t.id}</span>
                    <span className="status-badge-inline status-queued">EM FILA</span>
                  </div>
                  <span className="task-sub">{t.project} • Prioridade: {t.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-section">
          <div className="section-title-row">
            <h4>Histórico Recente</h4>
            <span className="count-tag">{finishedTasks.length}</span>
          </div>
          {finishedTasks.length === 0 ? (
            <p className="empty-text">Nenhuma tarefa finalizada no histórico.</p>
          ) : (
            <ul className="task-list">
              {finishedTasks.slice(0, 5).map((t: Task) => (
                <li key={t.id} className="task-item">
                  <div className="task-row">
                    <span className="task-title">{t.objective || t.prompt || t.id}</span>
                    <span className={`status-badge-inline status-${t.status.toLowerCase()}`}>
                      {STATE_LABELS_PT[t.status] ?? t.status}
                    </span>
                  </div>
                  <span className="task-sub">
                    {t.commitSha ? `Commit: ${t.commitSha.slice(0, 7)}` : t.project}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
};
