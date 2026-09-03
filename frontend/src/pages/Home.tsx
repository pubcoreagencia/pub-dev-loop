import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { OfficeHeader } from '../components/OfficeHeader';
import { OfficeFloorMap } from '../components/OfficeFloorMap';
import { GlobalOfficeChat } from '../components/GlobalOfficeChat';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { AgentInspector } from '../components/AgentInspector';
import { AwarenessPanel } from '../components/AwarenessPanel';

export const Home: React.FC = () => {
  const { loadData, initStream, closeStream, streamStatus } = useStore();

  useEffect(() => {
    loadData();
    initStream();
    return () => {
      closeStream();
    };
  }, []);

  // Polling adaptativo: 20s como reconciliação quando SSE está saudável; 3.5s como fallback de contingência
  useEffect(() => {
    const intervalMs = streamStatus === 'connected' ? 20000 : 3500;
    const timer = setInterval(loadData, intervalMs);
    return () => clearInterval(timer);
  }, [streamStatus]);

  return (
    <div className="the-office-app">
      <OfficeHeader />

      <main className="the-office-main-layout">
        {/* Left Column: Spatial Floor Map + Agent Desks */}
        <section className="left-workspace-column">
          <OfficeFloorMap />
        </section>

        {/* Center Column: Global Office Chat (CEO Command Surface) */}
        <section className="center-command-column">
          <GlobalOfficeChat />
        </section>

        {/* Right Column: Activity Stream */}
        <section className="right-timeline-column">
          <ActivityTimeline />
        </section>
      </main>

      {/* Slide-out / Modal Inspector for selected Agent */}
      <AgentInspector />

      {/* Discreet Organizational Awareness Overlay (Phase 8.6-F) */}
      <AwarenessPanel />
    </div>
  );
};

export default Home;
