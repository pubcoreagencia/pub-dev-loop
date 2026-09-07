import React from 'react';
import { useStore } from '../store/useStore';
import { TurntablePlayer } from './TurntablePlayer';
import { ProjectSelector } from './ProjectSelector';
import { getCurrentShift } from '../services/autonomousScheduleData';
import { PUB_HOLDING_SECTORS } from '../config/squadsData';

export const OfficeHeader: React.FC = () => {
  const { agents, tasks, activeGateway, selectedSectorId, setSelectedSectorId } = useStore();

  const runningTasks = tasks.filter((t) => t.status === 'RUNNING').length;

  return (
    <header className="office-header">
      <div className="header-brand">
        <div className="vintage-logo-box">
          <span className="logo-symbol">🏢</span>
          <div>
            <h1 className="logo-title">THE OFFICE</h1>
            <span className="logo-subtitle">PUB DEV LOOP • ESCRITÓRIO 3D VIVO</span>
          </div>
        </div>
      </div>

      <div className="header-status-ribbon">
        {/* Toca-Discos SoundCloud Pub Records */}
        <TurntablePlayer />

        {/* Botão de Acesso Direto à PUB DAW Multitrack */}
        <button
          onClick={() => useStore.getState().setActiveStudioModal('daw')}
          title="Abrir PUB DAW Multitrack"
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            border: '1px solid #38bdf8',
            borderRadius: '20px',
            padding: '4px 12px',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 0 14px rgba(56, 189, 248, 0.4)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🎛️</span>
          <span>PUB DAW</span>
        </button>

        {/* Gateway Dinâmico em Tempo Real */}
        <div className="status-badge" title="Gateway ativo em tempo real">
          <span className={`status-dot ${activeGateway === '9ROUTER' ? 'blue' : 'green'}`}></span>
          <span>GATEWAY: <strong style={{ color: activeGateway === '9ROUTER' ? '#60a5fa' : '#34d399' }}>{activeGateway}</strong></span>
        </div>

        <div
          className="status-badge"
          title="Equipe de 50 Especialistas • Clique para abrir o Elenco Completo das 10 Squads"
          onClick={() => useStore.getState().setFiftyAgentsModalOpen(true)}
          style={{ cursor: 'pointer', border: '1px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}
        >
          <span className="badge-icon">👥</span>
          <span>FUNCIONÁRIOS: <strong style={{ color: '#38bdf8' }}>{Math.max(agents.length, 50)} AGENTES (10 SQUADS)</strong></span>
        </div>

        {/* Fila / Ciclos Autônomos em Tempo Real */}
        <div className="status-badge" title="Esteira de desenvolvimento autônomo 24h em tempo real">
          <span className="badge-icon">⚡</span>
          <span>EM EXECUÇÃO: <strong style={{ color: runningTasks > 0 ? '#34d399' : '#fbbf24' }}>
            {runningTasks > 0 ? `${runningTasks} TAREFA(S) ATIVA(S)` : 'CICLO AUTÔNOMO ATIVO'}
          </strong></span>
        </div>

        {/* Turno Operacional do Cronograma 24h */}
        {(() => {
          const shift = getCurrentShift();
          return (
            <div
              className="status-badge"
              title={`Turno 24h: ${shift.focus}`}
              style={{ border: '1px solid #38bdf8', background: 'rgba(56, 189, 248, 0.08)' }}
            >
              <span style={{ fontSize: '11px' }}>⏰</span>
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{shift.name.split(':')[1] || shift.name}</span>
            </div>
          );
        })()}

        {/* Seletor de Setor / Squad Ativa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>🏛️ SQUAD:</span>
          <select
            value={selectedSectorId}
            onChange={(e) => setSelectedSectorId(e.target.value)}
            style={{
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              padding: '4px 10px',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              maxWidth: '210px',
            }}
            title="Selecione o Setor para focar a Squad de 5 agentes no escritório"
          >
            <option value="executive">🏢 Liderança Geral (Holding)</option>
            {PUB_HOLDING_SECTORS.map((sec, idx) => (
              <option key={sec.id} value={sec.id}>
                {`Setor ${idx + 1}: ${sec.name.split(':')[1]?.trim().slice(0, 24) || sec.name}`}
              </option>
            ))}
          </select>
        </div>

        <ProjectSelector />
      </div>
    </header>
  );
};
