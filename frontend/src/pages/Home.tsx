import React, { useEffect, useState } from "react";
import { OfficeScene } from "../scenes/OfficeScene";
import { SidePanel } from "../components/SidePanel";
import { TaskModal } from "../components/TaskModal";
import { useStore } from "../store/useStore";

export const Home: React.FC = () => {
  const { loadData, selectedAgent, agents, tasks, projects, activeProject, openModal } = useStore();
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    loadData();
    // Controlled polling every 3s to capture real-time state transitions
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const activeTaskCount = tasks.filter((t) =>
    ["RUNNING", "TESTING", "ASSIGNED"].includes(t.status)
  ).length;

  return (
    <div className="virtual-office-root">
      {/* Top Navigation Bar Overlay */}
      <header className="top-nav-overlay">
        <div className="brand-group">
          <span className="brand-badge">PUB DEV LOOP</span>
          <span className="brand-title">Escritório Virtual • Central de Comando</span>
        </div>

        <div className="status-indicators">
          <div className="indicator-pill">
            <span className="pulse-dot-green" />
            <span>9Router: <strong>ONLINE</strong></span>
          </div>
          <div className="indicator-pill">
            <span>Projetos: <strong>{projects.length}</strong></span>
          </div>
          {activeProject && (
            <div className="indicator-pill" style={{ border: "1px solid rgba(59,130,246,0.5)", background: "rgba(59,130,246,0.15)" }}>
              <span>Ativo: <strong style={{ color: "#93c5fd" }}>{activeProject.project}</strong></span>
            </div>
          )}
          <div className="indicator-pill">
            <span>Agentes: <strong>{agents.length}</strong></span>
          </div>
          <div className="indicator-pill">
            <span>Tarefas Ativas: <strong>{activeTaskCount}</strong></span>
          </div>
          <button
            className="btn-create-nav"
            onClick={() => openModal("CREATE_TASK")}
          >
            ➕ Nova Tarefa
          </button>
          {!showPanel && (
            <button className="toggle-panel-btn" onClick={() => setShowPanel(true)}>
              Abrir Painel 📋
            </button>
          )}
        </div>
      </header>

      {/* 3D Scene Viewport */}
      <main className="scene-viewport">
        <OfficeScene />
      </main>

      {/* Collapsible Command Side Panel */}
      {showPanel && (
        <SidePanel
          selectedAgent={selectedAgent}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Operations Modal (Create, View, Logs, Confirmations) */}
      <TaskModal />
    </div>
  );
};

export default Home;
