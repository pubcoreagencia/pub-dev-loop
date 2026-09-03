import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { OfficeHeader } from '../components/OfficeHeader';
import { OfficeFloorMap } from '../components/OfficeFloorMap';
import { GlobalOfficeChat } from '../components/GlobalOfficeChat';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { AgentInspector } from '../components/AgentInspector';

export const Home: React.FC = () => {
  const { loadData } = useStore();

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3500);
    return () => clearInterval(timer);
  }, []);

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
    </div>
  );
};

export default Home;
