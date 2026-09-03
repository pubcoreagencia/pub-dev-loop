import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { OfficeHeader } from '../components/OfficeHeader';
import { Office3DScene } from '../scenes/Office3DScene';
import { OfficeFloorMap } from '../components/OfficeFloorMap';
import { GlobalOfficeChat } from '../components/GlobalOfficeChat';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { AgentInspector } from '../components/AgentInspector';
import { AwarenessPanel } from '../components/AwarenessPanel';

export const Home: React.FC = () => {
  const { loadData, initStream, closeStream, streamStatus } = useStore();
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isFloorMapOpen, setIsFloorMapOpen] = useState(false);

  useEffect(() => {
    loadData();
    initStream();
    return () => {
      closeStream();
    };
  }, []);

  // Polling adaptativo
  useEffect(() => {
    const intervalMs = streamStatus === 'connected' ? 20000 : 3500;
    const timer = setInterval(loadData, intervalMs);
    return () => clearInterval(timer);
  }, [streamStatus]);

  return (
    <div className="the-office-app" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#020617' }}>
      {/* 1. CABEÇALHO DO ESCRITÓRIO */}
      <OfficeHeader />

      {/* 2. TELA PRINCIPAL: CENÁRIO 3D DO ESCRITÓRIO VIVO */}
      <div style={{ position: 'absolute', top: '56px', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <Office3DScene />
      </div>

      {/* 3. HUD FLUTUANTE ESQUERDO: CHAT GLOBAL & COMANDO DO CEO */}
      {isChatOpen && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            width: '430px',
            height: 'calc(100vh - 145px)',
            zIndex: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #334155',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GlobalOfficeChat />
        </div>
      )}

      {/* 4. HUD FLUTUANTE DIREITO: LINHA DO TEMPO DE ATIVIDADES */}
      {isTimelineOpen && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            right: '20px',
            width: '360px',
            maxHeight: 'calc(100vh - 145px)',
            zIndex: 20,
            boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #334155',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <ActivityTimeline />
        </div>
      )}

      {/* 5. MODAL DA PLANTA BAIXA 2D */}
      {isFloorMapOpen && (
        <div
          style={{
            position: 'fixed',
            top: '75px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '640px',
            maxHeight: '82vh',
            zIndex: 100,
            boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            borderRadius: '14px',
            overflow: 'auto',
            border: '1.5px solid #38bdf8',
            background: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(20px)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '14px', fontWeight: 700 }}>
              🗺️ PLANTA BAIXA 2D DO ESCRITÓRIO
            </h3>
            <button
              onClick={() => setIsFloorMapOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}
            >
              ✕
            </button>
          </div>
          <OfficeFloorMap />
        </div>
      )}

      {/* 6. DOCK BAR FLUTUANTE INFERIOR CENTRAL (NÃO COBRE NENHUM PAINEL) */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          padding: '8px 16px',
          borderRadius: '30px',
          border: '1px solid #334155',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Alternar Visibilidade do Chat"
          style={{
            background: isChatOpen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            border: `1px solid ${isChatOpen ? '#38bdf8' : 'transparent'}`,
            borderRadius: '20px',
            padding: '6px 14px',
            color: isChatOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>💬</span> Chat {isChatOpen ? 'Aberto' : 'Minimizado'}
        </button>

        <button
          onClick={() => setIsTimelineOpen(!isTimelineOpen)}
          title="Alternar Visibilidade das Atividades"
          style={{
            background: isTimelineOpen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            border: `1px solid ${isTimelineOpen ? '#38bdf8' : 'transparent'}`,
            borderRadius: '20px',
            padding: '6px 14px',
            color: isTimelineOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>⚡</span> Atividades {isTimelineOpen ? 'Aberto' : 'Minimizado'}
        </button>

        <button
          onClick={() => setIsFloorMapOpen(!isFloorMapOpen)}
          title="Abrir Planta Baixa 2D"
          style={{
            background: isFloorMapOpen ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            border: `1px solid ${isFloorMapOpen ? '#38bdf8' : 'transparent'}`,
            borderRadius: '20px',
            padding: '6px 14px',
            color: isFloorMapOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🗺️</span> Planta 2D
        </button>
      </div>

      {/* 7. MODAIS E PAINÉIS DE INSPEÇÃO */}
      <AgentInspector />
      <AwarenessPanel />
    </div>
  );
};

export default Home;
