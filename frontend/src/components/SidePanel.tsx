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
  const {
    tasks,
    agents,
    selectAgent,
    selectTask,
    selectedTask,
    openModal,
    loadData,
    loading,
    error,
    successMessage,
    setSuccessMessage,
  } = useStore();

  const currentTask = selectedTask || (selectedAgent ? tasks.find((t) => t.id === selectedAgent.taskId) : undefined);

  const queuedTasks = tasks.filter((t: Task) => ["QUEUED", "ASSIGNED"].includes(t.status));
  const runningTasks = tasks.filter((t: Task) => ["RUNNING", "TESTING"].includes(t.status));
  const finishedTasks = tasks.filter((t: Task) =>
    ["COMPLETED", "FAILED", "NEEDS_REVIEW", "BLOCKED", "CANCELLED"].includes(t.status)
  );

  const isCancellable = currentTask && ["QUEUED", "ASSIGNED", "RUNNING", "TESTING"].includes(currentTask.status);
  const isRetriable = currentTask && ["FAILED", "CANCELLED", "BLOCKED", "COMPLETED", "NEEDS_REVIEW"].includes(currentTask.status);

  return (
    <aside className="side-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="live-dot" />
          <h2>Central de Comando</h2>
        </div>
        <div className="panel-header-actions">
          <button
            className="action-btn-sm"
            onClick={() => {
              setSuccessMessage(undefined);
              loadData();
            }}
            title="Atualizar dados agora"
          >
            🔄 Atualizar
          </button>
          <button className="close-btn" onClick={onClose} title="Fechar painel">
            ✖
          </button>
        </div>
      </div>

      <div className="panel-content">
        {/* Success / Notification banner */}
        {successMessage && (
          <div className="success-card">
            <span>{successMessage}</span>
            <button className="dismiss-btn" onClick={() => setSuccessMessage(undefined)}>✖</button>
          </div>
        )}

        {loading && <div className="loading-bar">Atualizando dados em tempo real...</div>}
        {error && <div className="error-card">{error}</div>}

        {/* Global Action: New Task */}
        <div className="primary-action-bar">
          <button
            className="btn-create-task"
            onClick={() => openModal("CREATE_TASK")}
          >
            ➕ Nova Tarefa
          </button>
        </div>

        {/* CONTROLE DA TAREFA (Requisito 2) */}
        {currentTask && (
          <section className="task-control-card">
            <div className="card-header">
              <span className="badge-category">Operação</span>
              <h3>CONTROLE DA TAREFA</h3>
            </div>

            <div className="details-grid">
              <div className="detail-item full-width">
                <span className="detail-label">ID DA TAREFA</span>
                <span className="detail-value task-id" title={currentTask.id}>{currentTask.id}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">PROJETO</span>
                <span className="detail-value">{currentTask.project}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">ESTADO</span>
                <span className={`status-pill status-${currentTask.status.toLowerCase()}`}>
                  {STATE_LABELS_PT[currentTask.status] ?? currentTask.status}
                </span>
              </div>

              <div className="detail-item full-width">
                <span className="detail-label">OBJETIVO</span>
                <span className="detail-value">{currentTask.objective}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">AGENTE</span>
                <span className="detail-value highlight">{currentTask.worker || selectedAgent?.name || "-"}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">PROVEDOR</span>
                <span className="detail-value provider-badge">
                  {(currentTask.result as any)?.provider || selectedAgent?.provider || "9Router"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">MODELO</span>
                <span className="detail-value model-badge">
                  {(currentTask.result as any)?.model || selectedAgent?.model || "gemini-3.7-flash"}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">DURAÇÃO</span>
                <span className="detail-value">
                  {selectedAgent?.duration || ((currentTask.result as any)?.durationMs ? `${Math.round(Number((currentTask.result as any).durationMs) / 1000)}s` : "-")}
                </span>
              </div>

              <div className="detail-item full-width">
                <span className="detail-label">REPOSITÓRIO</span>
                <span className="detail-value repo-url" title={currentTask.repository}>
                  {currentTask.repository}
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">COMMIT</span>
                <span className="detail-value commit-hash">
                  {currentTask.commitSha ? currentTask.commitSha.slice(0, 10) : "-"}
                </span>
              </div>

              {currentTask.error && (
                <div className="detail-item full-width">
                  <span className="detail-label error-label">ERRO REGISTRADO</span>
                  <span className="detail-value error-text">{currentTask.error}</span>
                </div>
              )}
            </div>

            {/* Ações Rápidas da Tarefa */}
            <div className="task-action-buttons">
              <button
                className="btn-action-tool"
                onClick={() => openModal("VIEW_TASK", currentTask)}
                title="Ver detalhes completos da tarefa"
              >
                📄 Ver Tarefa
              </button>

              <button
                className="btn-action-tool"
                onClick={() => openModal("VIEW_LOGS", currentTask)}
                title="Ver logs de execução"
              >
                📋 Ver Registros
              </button>

              <button
                className="btn-action-tool"
                onClick={() => openModal("VIEW_RESULT", currentTask)}
                title="Ver resultado da execução"
              >
                📊 Ver Resultado
              </button>

              {currentTask.commitSha && (
                <button
                  className="btn-action-tool"
                  onClick={() => openModal("VIEW_TASK", currentTask)}
                  title="Ver commit gerado"
                >
                  🔗 Ver Commit
                </button>
              )}

              {isCancellable && (
                <button
                  className="btn-action-danger"
                  onClick={() => openModal("CONFIRM_CANCEL", currentTask)}
                  title="Cancelar execução da tarefa"
                >
                  🛑 Cancelar Tarefa
                </button>
              )}

              {isRetriable && (
                <button
                  className="btn-action-primary"
                  onClick={() => openModal("CONFIRM_RETRY", currentTask)}
                  title="Reexecutar esta tarefa"
                >
                  🔄 Reexecutar Tarefa
                </button>
              )}
            </div>
          </section>
        )}

        {/* Selected Agent Details Card (Requisito 1) */}
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
                <span className="detail-label">ÚLTIMO EVENTO</span>
                <span className="detail-value event-text">{selectedAgent.lastEvent}</span>
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
                <li
                  key={t.id}
                  className={`task-item ${selectedTask?.id === t.id ? "active-task-item" : ""}`}
                  onClick={() => selectTask(t)}
                >
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
                <li
                  key={t.id}
                  className={`task-item ${selectedTask?.id === t.id ? "active-task-item" : ""}`}
                  onClick={() => selectTask(t)}
                >
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
              {finishedTasks.slice(0, 8).map((t: Task) => (
                <li
                  key={t.id}
                  className={`task-item ${selectedTask?.id === t.id ? "active-task-item" : ""}`}
                  onClick={() => selectTask(t)}
                >
                  <div className="task-row">
                    <span className="task-title">{t.objective || t.prompt || t.id}</span>
                    <span className={`status-badge-inline status-${t.status.toLowerCase()}`}>
                      {STATE_LABELS_PT[t.status] ?? t.status}
                    </span>
                  </div>
                  <span className="task-sub">
                    {t.commitSha ? `Commit: ${t.commitSha.slice(0, 7)}` : t.project} • {new Date(t.createdAt).toLocaleDateString("pt-BR")}
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
