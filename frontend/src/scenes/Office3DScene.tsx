import React, { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/useStore';
import {
  OfficeFloor,
  OfficeWalls,
  WorkstationTable,
  MeetingRoomArea,
  LoungeCoffeeArea,
  OfficePlant,
  ClassicWatercooler,
} from './Office3DFurniture';
import { TurntableVinyl } from './TurntableVinyl';
import { Office3DAvatar } from './Office3DAvatar';
import { AGENT_AVATAR_PROFILES } from '../config/officeLayout';
import { VinylJukeboxModal, VINYL_ALBUMS, type VinylAlbum } from '../components/VinylJukeboxModal';
import { defaultAudioEngine } from '../services/audioEngine';

export const Office3DScene: React.FC = () => {
  const { agents, ceo, selectedAgent, selectAgent, speechBubbles } = useStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [isPlayingVinyl, setIsPlayingVinyl] = useState(true);
  const [isJukeboxOpen, setIsJukeboxOpen] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<VinylAlbum>(VINYL_ALBUMS[0]);

  // Mapeamento das posições 3D no espaço do escritório
  const positions: Record<string, { table: [number, number, number]; avatar: [number, number, number]; rot?: [number, number, number] }> = {
    ceo: {
      table: [0, 0, -8],
      avatar: [0, 0, -8.6],
      rot: [0, 0, 0],
    },
    'chief-of-staff': {
      table: [0, 0, -1],
      avatar: [0, 0, -1.6],
      rot: [0, 0, 0],
    },
    architect: {
      table: [-5.5, 0, 5],
      avatar: [-5.5, 0, 4.4],
      rot: [0, Math.PI, 0],
    },
    developer: {
      table: [5.5, 0, 5],
      avatar: [5.5, 0, 4.4],
      rot: [0, Math.PI, 0],
    },
    reviewer: {
      table: [-5.5, 0, 10],
      avatar: [-5.5, 0, 9.4],
      rot: [0, Math.PI, 0],
    },
    'qa-engineer': {
      table: [5.5, 0, 10],
      avatar: [5.5, 0, 9.4],
      rot: [0, Math.PI, 0],
    },
  };

  const getSpeechForEntity = (entityId: string): string | undefined => {
    return speechBubbles.find((b) => b.senderId === entityId)?.content;
  };

  const getAgentOperationalState = (id: string) => {
    return agents.find((a) => a.id === id)?.operationalState || 'idle';
  };

  const handleCameraFocus = (target: [number, number, number]) => {
    if (controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1] + 1.0, target[2]);
      controlsRef.current.update();
    }
  };

  return (
    <div className="office-3d-viewport" style={{ width: '100%', height: '100%', position: 'relative', background: '#020617' }}>
      {/* Botões Flutuantes de Câmera Rápida no Topo Central */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(10px)',
          padding: '6px 14px',
          borderRadius: '24px',
          border: '1px solid #334155',
        }}
      >
        <button
          onClick={() => handleCameraFocus([0, 0, 2])}
          style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
        >
          🌐 Visão Geral
        </button>
        <button
          onClick={() => handleCameraFocus([0, 0, -8])}
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}
        >
          👑 Gabinete CEO
        </button>
        <button
          onClick={() => handleCameraFocus([0, 0, -1])}
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}
        >
          👔 Chief of Staff
        </button>
        <button
          onClick={() => handleCameraFocus([5.5, 0, 5])}
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}
        >
          💻 Bancada Dev
        </button>
        <button
          onClick={() => {
            handleCameraFocus([-12, 0, -2]);
            setIsJukeboxOpen(true);
          }}
          style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
        >
          🎵 Lounge &amp; Vinil
        </button>
      </div>

      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 18, 22]} fov={40} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={6}
          maxDistance={38}
          target={[0, 1.0, 2]}
        />

        {/* Iluminação Ambiente Suave e Luzes Direcionais */}
        <ambientLight intensity={0.65} color="#e2e8f0" />
        <directionalLight
          position={[10, 20, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, 15, -10]} intensity={0.4} color="#38bdf8" />

        {/* Chão, Paredes e Áreas Corporativas */}
        <OfficeFloor />
        <OfficeWalls />
        <MeetingRoomArea />
        <LoungeCoffeeArea />

        {/* Plantas de Escritório Decorativas */}
        <OfficePlant position={[-6, 0, -3]} />
        <OfficePlant position={[6, 0, -3]} />
        <OfficePlant position={[-16, 0, 6]} />
        <OfficePlant position={[16, 0, 6]} />

        {/* O Clássico Bebedouro / Watercooler The Office */}
        <ClassicWatercooler position={[-8, 0, 2]} />

        {/* Toca-Discos de Vinil Interativo */}
        <TurntableVinyl
          isPlaying={isPlayingVinyl}
          labelColor={activeAlbum.labelColor}
          onClick={() => {
            setIsJukeboxOpen(true);
            if (!isPlayingVinyl) {
              setIsPlayingVinyl(true);
              defaultAudioEngine.play(activeAlbum.id);
            }
          }}
        />

        {/* 1. MESA E AVATAR DO CEO (Matheus Paes) */}
        <WorkstationTable
          position={positions.ceo.table}
          glowColor="#8b5cf6"
          isCeo={true}
          onClick={() => selectAgent(ceo)}
        />
        <Office3DAvatar
          position={positions.ceo.avatar}
          avatar={ceo.avatar || AGENT_AVATAR_PROFILES['chief-of-staff']}
          operationalState={ceo.operationalState || 'idle'}
          isCeo={true}
          speechBubble={getSpeechForEntity('ceo')}
          isSelected={selectedAgent?.id === 'ceo'}
          onClick={() => selectAgent(ceo)}
        />

        {/* 2. MESA E AVATAR DO CHIEF OF STAFF (Dr. Arthur Vance) */}
        <WorkstationTable
          position={positions['chief-of-staff'].table}
          glowColor="#f59e0b"
          accessoryType="CLIPBOARD"
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />
        <Office3DAvatar
          position={positions['chief-of-staff'].avatar}
          avatar={AGENT_AVATAR_PROFILES['chief-of-staff']}
          operationalState={getAgentOperationalState('chief-of-staff')}
          speechBubble={getSpeechForEntity('chief-of-staff')}
          isSelected={selectedAgent?.id === 'chief-of-staff'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />

        {/* 3. MESA E AVATAR DA PRINCIPAL ARCHITECT (Helena Rostova) */}
        <WorkstationTable
          position={positions.architect.table}
          rotation={positions.architect.rot}
          glowColor="#3b82f6"
          accessoryType="NONE"
          onClick={() => selectAgent(agents.find((a) => a.id === 'architect'))}
        />
        <Office3DAvatar
          position={positions.architect.avatar}
          avatar={AGENT_AVATAR_PROFILES.architect}
          operationalState={getAgentOperationalState('architect')}
          speechBubble={getSpeechForEntity('architect')}
          isSelected={selectedAgent?.id === 'architect'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'architect'))}
        />

        {/* 4. MESA E AVATAR DO SENIOR DEVELOPER (Lucas Silveira) */}
        <WorkstationTable
          position={positions.developer.table}
          rotation={positions.developer.rot}
          glowColor="#0ea5e9"
          accessoryType="HEADPHONES"
          onClick={() => selectAgent(agents.find((a) => a.id === 'developer'))}
        />
        <Office3DAvatar
          position={positions.developer.avatar}
          avatar={AGENT_AVATAR_PROFILES.developer}
          operationalState={getAgentOperationalState('developer')}
          speechBubble={getSpeechForEntity('developer')}
          isSelected={selectedAgent?.id === 'developer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'developer'))}
        />

        {/* 5. MESA E AVATAR DA CODE REVIEWER (Beatriz Mendes) */}
        <WorkstationTable
          position={positions.reviewer.table}
          rotation={positions.reviewer.rot}
          glowColor="#10b981"
          accessoryType="NONE"
          onClick={() => selectAgent(agents.find((a) => a.id === 'reviewer'))}
        />
        <Office3DAvatar
          position={positions.reviewer.avatar}
          avatar={AGENT_AVATAR_PROFILES.reviewer}
          operationalState={getAgentOperationalState('reviewer')}
          speechBubble={getSpeechForEntity('reviewer')}
          isSelected={selectedAgent?.id === 'reviewer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'reviewer'))}
        />

        {/* 6. MESA E AVATAR DO QA ENGINEER (Tiago Rocha) */}
        <WorkstationTable
          position={positions['qa-engineer'].table}
          rotation={positions['qa-engineer'].rot}
          glowColor="#059669"
          accessoryType="RUBBER_DUCKS"
          onClick={() => selectAgent(agents.find((a) => a.id === 'qa-engineer'))}
        />
        <Office3DAvatar
          position={positions['qa-engineer'].avatar}
          avatar={AGENT_AVATAR_PROFILES['qa-engineer']}
          operationalState={getAgentOperationalState('qa-engineer')}
          speechBubble={getSpeechForEntity('qa-engineer')}
          isSelected={selectedAgent?.id === 'qa-engineer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'qa-engineer'))}
        />
      </Canvas>

      {/* Modal Jukebox de Vinis */}
      <VinylJukeboxModal
        isOpen={isJukeboxOpen}
        onClose={() => setIsJukeboxOpen(false)}
        selectedAlbumId={activeAlbum.id}
        onSelectAlbum={(album) => {
          setActiveAlbum(album);
          setIsPlayingVinyl(true);
          defaultAudioEngine.play(album.id);
        }}
        isPlaying={isPlayingVinyl}
        onTogglePlay={() => {
          const next = !isPlayingVinyl;
          setIsPlayingVinyl(next);
          if (next) {
            defaultAudioEngine.play(activeAlbum.id);
          } else {
            defaultAudioEngine.stop();
          }
        }}
      />
    </div>
  );
};
