import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { PUB_HOLDING_SECTORS, FIFTY_SPECIALIZED_AGENTS } from '../config/squadsData';

export const FiftyAgentsModal: React.FC = () => {
  const isOpen = useStore((s) => s.isFiftyAgentsModalOpen);
  const setOpen = useStore((s) => s.setFiftyAgentsModalOpen);
  const selectAgent = useStore((s) => s.selectAgent);
  const setSelectedSectorId = useStore((s) => s.setSelectedSectorId);
  const activeGateway = useStore((s) => s.activeGateway);

  const [selectedFilterSector, setSelectedFilterSector] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredAgents = useMemo(() => {
    return FIFTY_SPECIALIZED_AGENTS.filter((agent: any) => {
      const matchSector = selectedFilterSector === 'all' || agent.sectorId === selectedFilterSector;
      if (!matchSector) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (agent.name || '').toLowerCase();
      const title = (agent.title || '').toLowerCase();
      const spec = (agent.specialty || '').toLowerCase();
      const secName = (agent.sectorName || '').toLowerCase();
      const model = (agent.preferredModel || '').toLowerCase();
      return name.includes(q) || title.includes(q) || spec.includes(q) || secName.includes(q) || model.includes(q);
    });
  }, [selectedFilterSector, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="agent-inspector-modal-backdrop" onClick={() => setOpen(false)} style={{ zIndex: 10000 }}>
      <div
        className="agent-inspector-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1200px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #090d16 0%, #0f172a 100%)',
          border: '1px solid #1e293b',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
          borderRadius: '16px',
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>👥</span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
                FORÇA DE TRABALHO AUTÔNOMA • 50 FUNCIONÁRIOS (10 SQUADS)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 34px', fontSize: '12px', color: '#94a3b8' }}>
              Ecossistema Pub Core • 52 Repositórios Ativos • Benchmarking de Modelos de IA Grátis (OpenRouter &amp; 9Router Fallback)
            </p>
          </div>

          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#94a3b8',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s',
            }}
            title="Fechar Modal"
          >
            ✕
          </button>
        </div>

        {/* METRICS & BENCHMARK RIBBON */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 24px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid #1e293b',
            alignItems: 'center',
          }}
        >
          <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}>
            👥 Total Funcionários: <strong style={{ color: '#38bdf8' }}>50 Especialistas</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}>
            🏢 Setores Ativos: <strong style={{ color: '#34d399' }}>10 Squads Completas</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}>
            🌐 Repositórios Cobertos: <strong style={{ color: '#facc15' }}>52 Projetos</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', color: '#cbd5e1' }}>
            ⚡ Rotação IA: <strong style={{ color: '#a855f7' }}>{activeGateway} ➔ 9Router Fallback</strong>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Buscar:</span>
            <input
              type="text"
              placeholder="Nome, cargo, modelo ou setor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#f8fafc',
                width: '240px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* SECTOR FILTER TABS */}
        <div
          style={{
            padding: '10px 24px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            borderBottom: '1px solid #1e293b',
            background: 'rgba(10, 15, 29, 0.7)',
          }}
        >
          <button
            onClick={() => setSelectedFilterSector('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: selectedFilterSector === 'all' ? '#38bdf8' : '#1e293b',
              color: selectedFilterSector === 'all' ? '#0f172a' : '#94a3b8',
              border: selectedFilterSector === 'all' ? '1px solid #38bdf8' : '1px solid #334155',
              transition: 'all 0.15s',
            }}
          >
            🏢 Todos (50)
          </button>
          {PUB_HOLDING_SECTORS.map((sec, idx) => (
            <button
              key={sec.id}
              onClick={() => setSelectedFilterSector(sec.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedFilterSector === sec.id ? '#0284c7' : '#1e293b',
                color: selectedFilterSector === sec.id ? '#ffffff' : '#94a3b8',
                border: selectedFilterSector === sec.id ? '1px solid #38bdf8' : '1px solid #334155',
                transition: 'all 0.15s',
              }}
            >
              {`Setor ${idx + 1}: ${sec.name.split(':')[1]?.trim().split(',')[0] || sec.name}`}
            </button>
          ))}
        </div>

        {/* AGENTS GRID */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}
        >
          {filteredAgents.map((agent: any) => {
            const avatar = agent.avatar || {};
            const accentColor = agent.accentColor || avatar.accentColor || '#38bdf8';

            return (
              <div
                key={agent.id}
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: `1px solid ${accentColor}44`,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  transition: 'transform 0.15s, border-color 0.15s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* TOPO DO CARD */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '10px',
                      background: `linear-gradient(135deg, ${accentColor}33 0%, #0f172a 100%)`,
                      border: `2px solid ${accentColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0,
                    }}
                  >
                    {avatar.badgeIcon || '💼'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {agent.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: 'rgba(52, 211, 153, 0.15)',
                          color: '#34d399',
                          border: '1px solid #34d399',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        🟢 ATIVO
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 600, color: accentColor, marginTop: '2px' }}>
                      {agent.title}
                    </div>

                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                      {agent.sectorName}
                    </div>
                  </div>
                </div>

                {/* BENCHMARKING DE MODELO IA */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    border: '1px solid #334155',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>⚡ Modelo Benchmark:</span>
                    <strong style={{ color: '#38bdf8', fontSize: '10px' }}>
                      {agent.preferredModel || 'openrouter/free'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>🛡️ Fallback Secundário:</span>
                    <span style={{ color: '#a855f7', fontSize: '10px', fontWeight: 600 }}>
                      9Router (gemini-3.6-flash)
                    </span>
                  </div>
                </div>

                {/* PERFIL PESSOAL & GOSTOS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                  <div style={{ color: '#cbd5e1' }}>
                    <span style={{ color: '#64748b' }}>Idade:</span> {avatar.age} anos ({avatar.gender === 'F' ? 'Fem' : 'Masc'})
                  </div>
                  <div style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ color: '#64748b' }}>☕</span> {avatar.drinkPreference}
                  </div>
                  <div style={{ gridColumn: 'span 2', color: '#94a3b8', fontStyle: 'italic', fontSize: '10px', marginTop: '2px' }}>
                    💬 "{avatar.catchphrase}"
                  </div>
                </div>

                {/* AÇÕES */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                  <button
                    onClick={() => {
                      selectAgent(agent);
                      setOpen(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    🔍 Inspecionar Dossiê
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSectorId(agent.sectorId);
                      setOpen(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      border: '1px solid #38bdf8',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    🏢 Ver na Bancada 3D
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
