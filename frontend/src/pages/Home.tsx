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
            width: '420px',
            height: 'calc(100vh - 90px)',
            zIndex: 10,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #334155',
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(12px)',
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
            maxHeight: 'calc(100vh - 90px)',
            zIndex: 10,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #334155',
            background: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ActivityTimeline />
        </div>
      )}

      {/* 5. MODAL / GAVETA DA PLANTA BAIXA 2D (OPCIONAL) */}
      {isFloorMapOpen && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            maxHeight: '80vh',
            zIndex: 20,
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
            borderRadius: '12px',
            overflow: 'auto',
            border: '1px solid #38bdf8',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '14px' }}>🗺️ PLANTA BAIXA 2D DO ESCRITÓRIO</h3>
            <button
              onClick={() => setIsFloorMapOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
          <OfficeFloorMap />
        </div>
      )}

      {/* 6. BOTÕES RÁPIDOS DE CONTROLE DO HUD (CANTO INFERIOR ESQUERDO) */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 15,
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Alternar Chat do Escritório"
          style={{
            background: isChatOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${isChatOpen ? '#38bdf8' : '#334155'}`,
            borderRadius: '8px',
            padding: '8px 12px',
            color: isChatOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          💬 Chat {isChatOpen ? 'Visível' : 'Oculto'}
        </button>

        <button
          onClick={() => setIsTimelineOpen(!isTimelineOpen)}
          title="Alternar Linha do Tempo"
          style={{
            background: isTimelineOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${isTimelineOpen ? '#38bdf8' : '#334155'}`,
            borderRadius: '8px',
            padding: '8px 12px',
            color: isTimelineOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          ⚡ Atividades {isTimelineOpen ? 'Visível' : 'Oculto'}
        </button>

        <button
          onClick={() => setIsFloorMapOpen(!isFloorMapOpen)}
          title="Abrir Planta Baixa 2D"
          style={{
            background: isFloorMapOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            border: `1px solid ${isFloorMapOpen ? '#38bdf8' : '#334155'}`,
            borderRadius: '8px',
            padding: '8px 12px',
            color: isFloorMapOpen ? '#38bdf8' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          🗺️ Planta 2D
        </button>
      </div>

      {/* 7. MODAIS E PAINÉIS DE INSPEÇÃO */}
      <AgentInspector />
      <AwarenessPanel />
    </div>
  );
};

export default Home;
