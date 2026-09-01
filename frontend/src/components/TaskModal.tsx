import React, { useState } from "react";
import { useStore } from "../store/useStore";
import type { CreateTaskInput } from "../types/task";
import { STATE_LABELS_PT } from "../services/agentAdapter";

export const TaskModal: React.FC = () => {
  const {
    activeModal,
    modalPayload,
    activeProject,
    activeSession,
    closeModal,
    handleCreateTask,
    handleCancelTask,
    handleRetryTask,
    actionLoading,
    selectedTask,
    selectedAgent,
  } = useStore();

  const [formData, setFormData] = useState<CreateTaskInput>({
    project: activeProject?.project || "pub-dev-loop",
    repository: activeSession?.repository || activeProject?.latestSession?.repository || "https://github.com/pubcoreagencia/pub-dev-loop.git",
    objective: "",
    prompt: "",
    priority: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Sync default form data when activeProject/activeModal changes
  React.useEffect(() => {
    if (activeModal === "CREATE_TASK") {
      setFormData({
        project: activeProject?.project || "pub-dev-loop",
        repository: activeSession?.repository || activeProject?.latestSession?.repository || "https://github.com/pubcoreagencia/pub-dev-loop.git",
        objective: "",
        prompt: "",
        priority: 0,
      });
      setFormError(null);
    }
  }, [activeModal, activeProject, activeSession]);

  if (!activeModal) return null;

  const currentTask = modalPayload || selectedTask;

  const onSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.project || !formData.repository || !formData.objective || !formData.prompt) {
      setFormError("Todos os campos obrigatórios devem ser preenchidos.");
      return;
    }
    setFormError(null);
    try {
      await handleCreateTask(formData);
    } catch (err: any) {
      setFormError(err.message || "Erro ao submeter tarefa");
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">PUB DEV LOOP</span>
            <h3>
              {activeModal === "CREATE_TASK" && "Nova Tarefa de Desenvolvimento"}
              {activeModal === "VIEW_TASK" && "Detalhes Completos da Tarefa"}
              {activeModal === "VIEW_LOGS" && "Registros de Execução e Logs"}
              {activeModal === "VIEW_RESULT" && "Resultado e Diagnóstico da Tarefa"}
              {activeModal === "CONFIRM_CANCEL" && "Confirmação de Cancelamento"}
              {activeModal === "CONFIRM_RETRY" && "Confirmação de Reexecução"}
            </h3>
          </div>
          <button className="close-btn" onClick={closeModal} title="Fechar">
            ✖
          </button>
        </div>

        <div className="modal-body">
          {/* 1. CREATE TASK MODAL */}
          {activeModal === "CREATE_TASK" && (
            <form onSubmit={onSubmitCreate} className="task-form">
              {formError && <div className="error-card">{formError}</div>}

              <div className="form-group">
                <label>PROJETO *</label>
                <input
                  type="text"
                  value={formData.project}
                  onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                  placeholder="ex: pub-dev-loop"
                  required
                />
              </div>

              <div className="form-group">
                <label>REPOSITÓRIO GIT *</label>
                <input
                  type="text"
                  value={formData.repository}
                  onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                  placeholder="https://github.com/org/repo.git"
                  required
                />
              </div>

              <div className="form-group">
                <label>OBJETIVO DA TAREFA *</label>
                <input
                  type="text"
                  value={formData.objective}
                  onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                  placeholder="ex: Implementar validação de campos no webhook"
                  required
                />
              </div>

              <div className="form-group">
                <label>PROMPT / INSTRUÇÃO DETALHADA *</label>
                <textarea
                  rows={5}
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="Descreva exatamente o que o agente autônomo 9Router deve realizar..."
                  required
                />
              </div>

              <div className="form-group">
                <label>PRIORIDADE (0 = Normal, 10 = Alta)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  {actionLoading ? "Enviando à Fila..." : "Criar e Enfileirar Tarefa"}
                </button>
              </div>
            </form>
          )}

          {/* 2. VIEW TASK DETAILS */}
          {activeModal === "VIEW_TASK" && currentTask && (
            <div className="view-details-content">
              <div className="details-grid-modal">
                <div className="detail-item full-width">
                  <span className="detail-label">ID DA TAREFA</span>
                  <span className="detail-value mono-text">{currentTask.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">ESTADO</span>
                  <span className={`status-pill status-${(currentTask.status || "").toLowerCase()}`}>
                    {STATE_LABELS_PT[currentTask.status as keyof typeof STATE_LABELS_PT] ?? currentTask.status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">WORKER / AGENTE</span>
                  <span className="detail-value highlight">{currentTask.worker || "Aguardando worker"}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">PROJETO</span>
                  <span className="detail-value">{currentTask.project}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">PRIORIDADE</span>
                  <span className="detail-value">{currentTask.priority}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">REPOSITÓRIO</span>
                  <span className="detail-value mono-text">{currentTask.repository}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">OBJETIVO</span>
                  <span className="detail-value">{currentTask.objective}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">PROMPT</span>
                  <pre className="code-box">{currentTask.prompt}</pre>
                </div>
                {currentTask.commitSha && (
                  <div className="detail-item full-width">
                    <span className="detail-label">COMMIT GERADO</span>
                    <span className="detail-value mono-text">{currentTask.commitSha}</span>
                  </div>
                )}
                {currentTask.branch && (
                  <div className="detail-item">
                    <span className="detail-label">BRANCH</span>
                    <span className="detail-value mono-text">{currentTask.branch}</span>
                  </div>
                )}
                {currentTask.gitStatus && (
                  <div className="detail-item">
                    <span className="detail-label">STATUS GIT</span>
                    <span className="detail-value">{currentTask.gitStatus}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">CRIADA EM</span>
                  <span className="detail-value text-muted">{new Date(currentTask.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">ATUALIZADA EM</span>
                  <span className="detail-value text-muted">{new Date(currentTask.updatedAt).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. VIEW LOGS */}
          {activeModal === "VIEW_LOGS" && currentTask && (
            <div className="view-logs-content">
              <div className="log-section">
                <span className="detail-label">SAÍDA DO AGENTE (STDOUT)</span>
                <pre className="log-terminal">
                  {currentTask.result?.stdout || "Nenhum stdout registrado para esta execução."}
                </pre>
              </div>

              {currentTask.result?.stderr && (
                <div className="log-section">
                  <span className="detail-label error-label">ERROS / DIAGNÓSTICOS (STDERR)</span>
                  <pre className="log-terminal error-terminal">
                    {currentTask.result?.stderr}
                  </pre>
                </div>
              )}

              {currentTask.error && (
                <div className="log-section">
                  <span className="detail-label error-label">MENSAGEM DE ERRO REGISTRADA</span>
                  <pre className="log-terminal error-terminal">
                    {currentTask.error}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 4. VIEW RESULT */}
          {activeModal === "VIEW_RESULT" && currentTask && (
            <div className="view-result-content">
              <div className="details-grid-modal">
                <div className="detail-item">
                  <span className="detail-label">STATUS FINAL</span>
                  <span className={`status-pill status-${(currentTask.status || "").toLowerCase()}`}>
                    {STATE_LABELS_PT[currentTask.status as keyof typeof STATE_LABELS_PT] ?? currentTask.status}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">PROVEDOR / MODELO</span>
                  <span className="detail-value">
                    {currentTask.result?.provider || selectedAgent?.provider || "9Router"} • {currentTask.result?.model || selectedAgent?.model || "gemini-3.7-flash"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">DURAÇÃO TOTAL</span>
                  <span className="detail-value">
                    {currentTask.result?.durationMs ? `${Math.round(Number(currentTask.result.durationMs) / 1000)}s` : selectedAgent?.duration || "-"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">COMMIT GERADO</span>
                  <span className="detail-value mono-text">{currentTask.commitSha || "-"}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">RESUMO DE EXECUÇÃO</span>
                  <pre className="code-box">
                    {JSON.stringify(currentTask.result?.execution || currentTask.result?.summary || currentTask.result || "Nenhum detalhe adicional.", null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* 5. CONFIRM CANCEL */}
          {activeModal === "CONFIRM_CANCEL" && currentTask && (
            <div className="confirm-content">
              <p className="confirm-warning">
                ⚠️ <strong>Atenção:</strong> Você está prestes a cancelar a execução da tarefa:
              </p>
              <div className="confirm-card">
                <p><strong>ID:</strong> <span className="mono-text">{currentTask.id}</span></p>
                <p><strong>Objetivo:</strong> {currentTask.objective}</p>
                <p><strong>Estado Atual:</strong> {STATE_LABELS_PT[currentTask.status as keyof typeof STATE_LABELS_PT] ?? currentTask.status}</p>
              </div>
              <p className="confirm-note">
                O worker irá interromper o ciclo e liberar quaisquer recursos alocados.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={actionLoading}
                  onClick={() => handleCancelTask(currentTask.id)}
                >
                  {actionLoading ? "Cancelando..." : "Confirmar Cancelamento"}
                </button>
              </div>
            </div>
          )}

          {/* 6. CONFIRM RETRY */}
          {activeModal === "CONFIRM_RETRY" && currentTask && (
            <div className="confirm-content">
              <p className="confirm-info">
                🔄 Deseja reenviar esta tarefa para a fila de execução do 9Router?
              </p>
              <div className="confirm-card">
                <p><strong>ID:</strong> <span className="mono-text">{currentTask.id}</span></p>
                <p><strong>Objetivo:</strong> {currentTask.objective}</p>
                <p><strong>Estado Atual:</strong> {STATE_LABELS_PT[currentTask.status as keyof typeof STATE_LABELS_PT] ?? currentTask.status}</p>
              </div>
              <p className="confirm-note">
                A tarefa será marcada como <strong>EM FILA</strong> e assumida pelo próximo ciclo do worker.
              </p>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Voltar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={actionLoading}
                  onClick={() => handleRetryTask(currentTask.id)}
                >
                  {actionLoading ? "Reenviando..." : "Confirmar Reexecução"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
