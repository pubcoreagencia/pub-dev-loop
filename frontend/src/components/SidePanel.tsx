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
    projects,
    sessions,
    activeProject,
    activeSession,
    selectProject,
    selectSession,
    projectSearch,
    setProjectSearch,
    tasks,
    agents,
    selectAgent,
    selectTask,
    selectedTask,
    openModal,
    loadData,
    loading,
    error,
    projectsError,
    successMessage,
    setSuccessMessage,
  } = useStore();

  const currentTask = selectedTask || (selectedAgent ? tasks.find((t) => t.id === selectedAgent.taskId) : undefined);

  // Filter projects by search query
  const filteredProjects = projects.filter((p) => {
    if (!projectSearch.trim()) return true;
    const query = projectSearch.trim().toLowerCase();
    return p.normalizedProject.includes(query) || p.project.toLowerCase().includes(query);
  });

  const isCancellable = currentTask && ["QUEUED", "ASSIGNED", "RUNNING", "TESTING"].includes(currentTask.status);
  const isRetriable = currentTask && ["FAILED", "CANCELLED", "BLOCKED", "COMPLETED", "NEEDS_REVIEW"].includes(currentTask.status);

  // Effective session for the active project
  const currentSession = activeSession || activeProject?.latestSession;

  // Project-level metrics
  const projectTasks = activeProject
    ? tasks.filter((t) => {
        if (t.prototypeSessionId && activeProject.sessions.some((s) => s.id === t.prototypeSessionId)) return true;
        if (t.project) {
          const tNorm = t.project.trim().toLowerCase().replace(/\s+/g, " ");
          return tNorm === activeProject.normalizedProject;
        }
        return false;
      })
    : [];

  const sessionTasks = currentSession
    ? tasks.filter((t) => {
        if (t.prototypeSessionId) return t.prototypeSessionId === currentSession.id;
        if (t.project && activeProject) {
          const tNorm = t.project.trim().toLowerCase().replace(/\s+/g, " ");
          return tNorm === activeProject.normalizedProject;
        }
        return false;
      })
    : [];

  // P3.3 AI Trace & Diagnostics extraction from most relevant task in session
  const sortedSessionTasks = [...sessionTasks].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
  const latestTask = sortedSessionTasks[0];
  const rawResult = (latestTask?.result || {}) as Record<string, any>;
  const trace = rawResult.trace as Record<string, any> | undefined;

  const latestModel =
    (rawResult.model as string) ||
    (trace?.attempts?.[0]?.model as string) ||
    (trace?.model as string) ||
    (latestTask ? "gemini-3.7-flash" : "—");

  const latestProvider =
    (rawResult.provider as string) ||
    (trace?.attempts?.[0]?.provider as string) ||
    (trace?.provider as string) ||
    (latestTask ? "9Router" : "—");

  const latestWorker = latestTask?.worker || (latestTask ? "9Router Worker" : "—");
  const latestTaskStatus = latestTask?.status || "—";

  const durationMs = rawResult.durationMs
    ? Number(rawResult.durationMs)
    : latestTask
    ? Math.max(0, new Date(latestTask.updatedAt).getTime() - new Date(latestTask.createdAt).getTime())
    : 0;

  const lastDuration = latestTask
    ? durationMs > 0
      ? `${Math.round(durationMs / 1000)}s`
      : "< 1s"
    : "—";

  const hasFallback = Boolean(
    trace?.attempts && Array.isArray(trace.attempts) && trace.attempts.length > 1
  );

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
        {projectsError && <div className="error-card">{projectsError}</div>}

        {/* Global Action: New Task */}
        <div className="primary-action-bar">
          <button
            className="btn-create-task"
            onClick={() => openModal("CREATE_TASK")}
          >
            ➕ Nova Tarefa
          </button>
        </div>

        {/* PROJETOS (Logical Projects 1:N Sessions) */}
        <section className="panel-section">
          <div className="section-title-row">
            <h4>Projetos</h4>
            <span className="count-tag">{projects.length} ({sessions.length} sessões)</span>
          </div>

          {/* Quick Search */}
          <div style={{ marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="🔍 Buscar projetos..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(15,23,42,0.6)",
                color: "#f8fafc",
                fontSize: "12px",
                boxSizing: "border-box",
                outline: "none"
              }}
            />
          </div>

          {filteredProjects.length === 0 ? (
            <p className="empty-text">Nenhum projeto encontrado.</p>
          ) : (
            <div className="project-cards-list" style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {filteredProjects.map((p) => {
                const isActive = activeProject?.normalizedProject === p.normalizedProject;
                const sessCount = p.sessionCount;
                const sessLabel = sessCount === 1 ? "1 sessão" : `${sessCount} sessões`;
                return (
                  <div
                    key={p.normalizedProject}
                    className={`task-item ${isActive ? "active-task-item" : ""}`}
                    style={{
                      cursor: "pointer",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: isActive ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                      background: isActive ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)"
                    }}
                    onClick={() => selectProject(p)}
                  >
                    <div className="task-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="task-title" style={{ fontWeight: 600, color: isActive ? "#93c5fd" : "#f1f5f9" }}>
                        {p.project || "Sem nome"}
                      </span>
                      <span className={`status-badge-inline status-${(p.latestSession.status || "ready").toLowerCase()}`}>
                        {p.latestSession.status || "READY"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                      <span>{sessLabel}</span>
                      <span>{new Date(p.latestSession.updatedAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* DETALHES E AÇÕES DO PROJETO ATIVO */}
        {activeProject && currentSession && (
          <section className="task-control-card" style={{ border: "1px solid rgba(59,130,246,0.35)", background: "rgba(15,23,42,0.75)" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="badge-category" style={{ background: "#2563eb" }}>Projeto Ativo</span>
                <h3 style={{ margin: "4px 0 0 0", color: "#f8fafc" }}>{activeProject.project}</h3>
              </div>
              <span className={`status-pill status-${(currentSession.status || "ready").toLowerCase()}`}>
                {currentSession.status || "READY"}
              </span>
            </div>

            {/* P3.2 — Métricas Operacionais Detalhadas do Projeto / Sessão */}
            {(() => {
              const completedTasks = sessionTasks.filter((t) => t.status === "COMPLETED").length;
              const failedTasks = sessionTasks.filter((t) => t.status === "FAILED").length;
              const runningTasks = sessionTasks.filter((t) => ["RUNNING", "TESTING"].includes(t.status)).length;
              const totalFinished = completedTasks + failedTasks;
              const successRate = totalFinished > 0 ? `${Math.round((completedTasks / totalFinished) * 100)}%` : "—";

              return (
                <div className="project-metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", margin: "10px 0", background: "rgba(30,41,59,0.5)", padding: "8px 10px", borderRadius: "6px" }}>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Proj. Tasks</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: "#93c5fd" }}>{projectTasks.length}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Sess. Tasks</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: "#60a5fa" }}>{sessionTasks.length}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Concluídas</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: "#34d399" }}>{completedTasks}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Taxa Sucesso</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: totalFinished > 0 ? "#38bdf8" : "#94a3b8" }}>{successRate}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Em Execução</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: runningTasks > 0 ? "#fbbf24" : "#94a3b8" }}>{runningTasks}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Falhas</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: failedTasks > 0 ? "#f87171" : "#94a3b8" }}>{failedTasks}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Prompts</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: "#c084fc" }}>{currentSession.promptCount ?? "—"}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label" style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", display: "block" }}>Duração</span>
                    <span className="metric-val" style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>{lastDuration}</span>
                  </div>
                </div>
              );
            })()}

            {/* P2.1 — Seletor de Sessões Históricas (quando houver múltiplas sessões) */}
            {activeProject.sessionCount > 1 && (
              <div style={{ margin: "12px 0 8px 0" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#94a3b8", marginBottom: "4px", textTransform: "uppercase" }}>
                  Sessões / Iterações ({activeProject.sessionCount})
                </label>
                <div className="session-selector-list" style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "130px", overflowY: "auto" }}>
                  {activeProject.sessions.map((sess, idx) => {
                    const isSelected = sess.id === currentSession.id;
                    const isLatest = sess.id === activeProject.latestSession.id;
                    return (
                      <div
                        key={sess.id}
                        className="session-selector-item"
                        onClick={() => selectSession(sess)}
                        style={{
                          cursor: "pointer",
                          padding: "6px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isSelected ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.04)",
                          border: isSelected ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)",
                          color: isSelected ? "#bfdbfe" : "#cbd5e1"
                        }}
                      >
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontWeight: 600 }}>
                            {isLatest ? "⭐ Sessão Atual" : `Sessão #${activeProject.sessionCount - idx}`}
                          </span>
                          <span style={{ fontSize: "10px", color: "#64748b" }}>({sess.id.slice(0, 8)})</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span className={`status-badge-inline status-${(sess.status || "ready").toLowerCase()}`} style={{ fontSize: "9px", padding: "1px 4px" }}>
                            {sess.status}
                          </span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                            {new Date(sess.updatedAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* P2.3 — Card de Detalhes da Sessão Ativa */}
            <div className="details-grid" style={{ marginTop: "8px" }}>
              <div className="detail-item full-width">
                <span className="detail-label">SESSÃO ATIVA (ID)</span>
                <span className="detail-value task-id" title={currentSession.id}>
                  {currentSession.id}
                </span>
              </div>

              {currentSession.branch && (
                <div className="detail-item full-width">
                  <span className="detail-label">BRANCH</span>
                  <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "11px" }}>
                    {currentSession.branch}
                  </span>
                </div>
              )}

              {currentSession.lastCheckpointSha && (
                <div className="detail-item">
                  <span className="detail-label">CHECKPOINT SHA</span>
                  <span className="detail-value commit-hash">
                    {currentSession.lastCheckpointSha.slice(0, 8)}
                  </span>
                </div>
              )}

              {currentSession.createdAt && (
                <div className="detail-item">
                  <span className="detail-label">CRIADO EM</span>
                  <span className="detail-value">{new Date(currentSession.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              )}

              <div className="detail-item">
                <span className="detail-label">ÚLTIMA ATUALIZAÇÃO</span>
                <span className="detail-value">{new Date(currentSession.updatedAt).toLocaleTimeString("pt-BR")}</span>
              </div>
            </div>

            {/* P3.3 — Diagnóstico / Trace da IA da Sessão */}
            <div style={{ marginTop: "12px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "8px 10px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                Diagnóstico de IA & Trace
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#94a3b8", fontSize: "10px", display: "block" }}>MODELO</span>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{latestModel}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", fontSize: "10px", display: "block" }}>PROVEDOR</span>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{latestProvider}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", fontSize: "10px", display: "block" }}>WORKER</span>
                  <span style={{ color: "#cbd5e1" }}>{latestWorker}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8", fontSize: "10px", display: "block" }}>STATUS ÚLTIMA TASK</span>
                  <span style={{ fontWeight: 600, color: latestTaskStatus === "COMPLETED" ? "#34d399" : latestTaskStatus === "FAILED" ? "#f87171" : "#60a5fa" }}>
                    {latestTaskStatus}
                  </span>
                </div>
                {hasFallback && (
                  <div style={{ gridColumn: "1 / -1", color: "#fbbf24", fontSize: "10px" }}>
                    ⚠️ Tentativa com Fallback detectada no trace
                  </div>
                )}
              </div>
            </div>

            {/* P3.4 — Ações Operacionais da Sessão Ativa */}
            <div className="task-action-buttons" style={{ marginTop: "12px" }}>
              {currentSession.previewUrl ? (
                <a
                  href={currentSession.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-action-tool"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    textDecoration: "none",
                    background: "rgba(37,99,235,0.2)",
                    border: "1px solid #3b82f6",
                    color: "#93c5fd",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "12px"
                  }}
                  title="Abrir URL pública de pré-visualização da sessão ativa"
                >
                  🌐 Abrir Preview (Sessão)
                </a>
              ) : null}

              {currentSession.repository ? (
                <a
                  href={currentSession.repository.replace(/\.git$/, "")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-action-tool"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    textDecoration: "none",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#e2e8f0",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "12px"
                  }}
                  title="Abrir repositório Git da sessão ativa"
                >
                  🐙 Ver Repositório (Sessão)
                </a>
              ) : null}
            </div>
          </section>
        )}

        {/* CONTROLE DA TAREFA SELECIONADA */}
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
              >
                🔍 Detalhes
              </button>

              <button
                className="btn-action-tool"
                onClick={() => openModal("VIEW_LOGS", currentTask)}
              >
                📜 Logs
              </button>

              {currentTask.result && (
                <button
                  className="btn-action-tool"
                  onClick={() => openModal("VIEW_RESULT", currentTask)}
                >
                  📊 Resultado
                </button>
              )}

              {isCancellable && (
                <button
                  className="btn-action-tool btn-danger"
                  onClick={() => openModal("CONFIRM_CANCEL", currentTask)}
                >
                  🛑 Cancelar
                </button>
              )}

              {isRetriable && (
                <button
                  className="btn-action-tool btn-warn"
                  onClick={() => openModal("CONFIRM_RETRY", currentTask)}
                >
                  🔄 Reexecutar
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

        {/* P2.2 — Real Tasks Tracking (Contextual à Sessão Selecionada) */}
        {(() => {
          // Strict session isolation: tasks of currentSession
          const contextualTasks = activeProject ? sessionTasks : tasks;

          const contextRunning = contextualTasks.filter((t: Task) => ["RUNNING", "TESTING"].includes(t.status));
          const contextQueued = contextualTasks.filter((t: Task) => ["QUEUED", "ASSIGNED"].includes(t.status));
          const contextFinished = contextualTasks.filter((t: Task) =>
            ["COMPLETED", "FAILED", "NEEDS_REVIEW", "BLOCKED", "CANCELLED"].includes(t.status)
          );

          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {activeProject && currentSession ? `Tarefas (Sessão ${currentSession.id.slice(0, 8)})` : "Tarefas Globais"}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {contextualTasks.length} de {tasks.length} total
                </span>
              </div>

              {/* Running Tasks */}
              <section className="panel-section">
                <div className="section-title-row">
                  <h4>Tarefas em Execução</h4>
                  <span className="count-tag">{contextRunning.length}</span>
                </div>
                {contextRunning.length === 0 ? (
                  <p className="empty-text">
                    {activeProject ? "Nenhuma tarefa em execução para este projeto." : "Nenhuma tarefa em execução ativa."}
                  </p>
                ) : (
                  <ul className="task-list">
                    {contextRunning.map((t: Task) => (
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

              {/* Queued Tasks */}
              <section className="panel-section">
                <div className="section-title-row">
                  <h4>Fila de Espera</h4>
                  <span className="count-tag">{contextQueued.length}</span>
                </div>
                {contextQueued.length === 0 ? (
                  <p className="empty-text">
                    {activeProject ? "Fila vazia para este projeto." : "Fila de espera vazia."}
                  </p>
                ) : (
                  <ul className="task-list">
                    {contextQueued.map((t: Task) => (
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

              {/* Recent Tasks */}
              <section className="panel-section">
                <div className="section-title-row">
                  <h4>Histórico do Projeto</h4>
                  <span className="count-tag">{contextFinished.length}</span>
                </div>
                {contextFinished.length === 0 ? (
                  <p className="empty-text">
                    {activeProject ? "Nenhuma tarefa finalizada registrada para este projeto." : "Nenhuma tarefa finalizada no histórico."}
                  </p>
                ) : (
                  <ul className="task-list">
                    {contextFinished.slice(0, 10).map((t: Task) => (
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
            </>
          );
        })()}
      </div>
    </aside>
  );
};
