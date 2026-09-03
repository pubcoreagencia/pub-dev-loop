import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/useStore';
import {
  OfficeFloor,
  OfficeWalls,
  WorkstationTable,
  MeetingRoomArea,
  DunderBreakroom,
  ClassicWatercooler,
  LoungeSofa,
  OfficePlant,
} from './Office3DFurniture';
import { TurntableVinyl } from './TurntableVinyl';
import { Office3DAvatar } from './Office3DAvatar';
import { AGENT_AVATAR_PROFILES } from '../config/officeLayout';
import { VinylJukeboxModal, VINYL_ALBUMS } from '../components/VinylJukeboxModal';

export const Office3DScene: React.FC = () => {
  const {
    agents,
    ceo,
    selectedAgent,
    selectAgent,
    speechBubbles,
    isPlayingVinyl,
    activeAlbumId,
    togglePlayVinyl,
    selectVinylAlbum,
    isJukeboxOpen,
    setJukeboxOpen,
  } = useStore();

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const activeAlbum = VINYL_ALBUMS.find((a) => a.id === activeAlbumId) || VINYL_ALBUMS[0];

  // Coordenadas calculadas milimetricamente para cada personagem sentar NA CADEIRA e de FRENTE PARA O PC
  const positions: Record<
    string,
    {
      table: [number, number, number];
      avatar: [number, number, number];
      tableRot?: [number, number, number];
      avatarRot: [number, number, number];
    }
  > = {
    ceo: {
      table: [0, 0, -8],
      avatar: [0, 0, -7.28], // Sentado na cadeira do CEO (z = -7.28), de frente para o monitor (olhando em -z)
      tableRot: [0, 0, 0],
      avatarRot: [0, 0, 0],
    },
    'chief-of-staff': {
      table: [0, 0, -1],
      avatar: [0, 0, -0.28], // Sentado na cadeira do Chief (z = -0.28), de frente para o monitor
      tableRot: [0, 0, 0],
      avatarRot: [0, 0, 0],
    },
    architect: {
      table: [-6, 0, 5],
      avatar: [-6, 0, 4.28], // Sentado na cadeira (z = 4.28), rotacionado 180° olhando em +z para o monitor
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    developer: {
      table: [6, 0, 5],
      avatar: [6, 0, 4.28], // Sentado na cadeira (z = 4.28), rotacionado 180° olhando em +z para o monitor
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    reviewer: {
      table: [-6, 0, 10],
      avatar: [-6, 0, 9.28], // Sentado na cadeira (z = 9.28), rotacionado 180° olhando em +z para o monitor
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    'qa-engineer': {
      table: [6, 0, 10],
      avatar: [6, 0, 9.28], // Sentado na cadeira (z = 9.28), rotacionado 180° olhando em +z para o monitor
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
  };

  const getSpeechForEntity = (entityId: string): string | undefined => {
    return speechBubbles.find((b) => b.senderId === entityId)?.content;
  };

  const getAgentOperationalState = (id: string) => {
    return agents.find((a) => a.id === id)?.operationalState || 'idle';
  };

  const handleCameraFocus = (target: [number, number, number], camPos?: [number, number, number]) => {
    if (controlsRef.current) {
      controlsRef.current.target.set(target[0], target[1], target[2]);
      if (camPos && controlsRef.current.object) {
        controlsRef.current.object.position.set(camPos[0], camPos[1], camPos[2]);
      }
      controlsRef.current.update();
    }
  };

  return (
    <div className="office-3d-viewport" style={{ width: '100%', height: '100%', position: 'relative', background: '#020617' }}>
      {/* Barra Superior de Câmeras com Foco Imediato e Ultra-Zoom */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          padding: '6px 14px',
          borderRadius: '24px',
          border: '1px solid #334155',
          boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
        }}
      >
        <button
          onClick={() => handleCameraFocus([0, 1.0, 2], [0, 18, 22])}
          style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
        >
          🌐 Visão Geral
        </button>
        <button
          onClick={() => handleCameraFocus([0, 1.0, -7.6], [0, 2.3, -5.2])}
          style={{ background: 'transparent', border: 'none', color: '#facc15', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          title="Zoom na Caneca World's Best Boss do CEO"
        >
          👑 Gabinete CEO &amp; Caneca
        </button>
        <button
          onClick={() => handleCameraFocus([0, 1.0, -0.6], [0, 2.2, 1.8])}
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}
        >
          👔 Chief of Staff
        </button>
        <button
          onClick={() => handleCameraFocus([6, 1.1, 4.8], [6, 2.2, 2.8])}
          style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}
        >
          💻 Bancada Dev &amp; CRT
        </button>
        <button
          onClick={() => handleCameraFocus([12, 1.2, 0], [12, 2.8, 4.2])}
          style={{ background: 'transparent', border: 'none', color: '#f97316', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
          title="Zoom na Cafeteria, Expresso, Vapor e Watercooler"
        >
          ☕ Cafeteria &amp; Vapor
        </button>
        <button
          onClick={() => {
            handleCameraFocus([-12, 1.2, 0], [-12, 2.4, 3.2]);
          }}
          style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
          title="Zoom na Vitrola de Vinil, Braço Mecânico e Ondas Sonoras"
        >
          🎵 Lounge &amp; Vitrola
        </button>
      </div>

      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 18, 22]} fov={40} />
        {/* OrbitControls com Zoom Mínimo de 0.5 para permitir ver qualquer detalhe */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={0.5}
          maxDistance={50}
          target={[0, 1.0, 2]}
        />

        {/* Iluminação Quente de Design de Interiores */}
        <ambientLight intensity={0.75} color="#fef3c7" />
        <directionalLight
          position={[12, 24, 16]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-12, 16, -10]} intensity={0.5} color="#38bdf8" />
        <directionalLight position={[14, 14, 4]} intensity={0.6} color="#f59e0b" />

        {/* Chão de Madeira Nobre, Tapetes Ricos, Persianas e Painéis Ripados */}
        <OfficeFloor />
        <OfficeWalls />
        <MeetingRoomArea />

        {/* ☕ A CAFETERIA & BREAKROOM DUNDER MIFFLIN */}
        <DunderBreakroom position={[12, 0, 0]} />

        {/* O Bebedouro / Watercooler The Office */}
        <ClassicWatercooler position={[10, 0, 2.4]} />

        {/* Plantas Decorativas */}
        <OfficePlant position={[-5, 0, -3]} />
        <OfficePlant position={[5, 0, -3]} />
        <OfficePlant position={[-18, 0, 6]} />
        <OfficePlant position={[18, 0, 6]} />

        {/* 🎵 O TOCA-DISCOS DE VINIL VINTAGE */}
        <TurntableVinyl
          isPlaying={isPlayingVinyl}
          labelColor={activeAlbum.labelColor}
          albumTitle={activeAlbum.title}
          onClick={() => setJukeboxOpen(true)}
        />
        <LoungeSofa position={[-12, 0, 3.2]} />

        {/* 1. MESA E AVATAR DO CEO (Matheus Paes) */}
        <WorkstationTable
          position={positions.ceo.table}
          rotation={positions.ceo.tableRot}
          glowColor="#8b5cf6"
          isCeo={true}
          onClick={() => selectAgent(ceo)}
        />
        <Office3DAvatar
          position={positions.ceo.avatar}
          rotation={positions.ceo.avatarRot}
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
          rotation={positions['chief-of-staff'].tableRot}
          glowColor="#f59e0b"
          accessoryType="CLIPBOARD"
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />
        <Office3DAvatar
          position={positions['chief-of-staff'].avatar}
          rotation={positions['chief-of-staff'].avatarRot}
          avatar={AGENT_AVATAR_PROFILES['chief-of-staff']}
          operationalState={getAgentOperationalState('chief-of-staff')}
          speechBubble={getSpeechForEntity('chief-of-staff')}
          isSelected={selectedAgent?.id === 'chief-of-staff'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />

        {/* 3. MESA E AVATAR DA PRINCIPAL ARCHITECT (Helena Rostova) */}
        <WorkstationTable
          position={positions.architect.table}
          rotation={positions.architect.tableRot}
          glowColor="#3b82f6"
          accessoryType="NONE"
          onClick={() => selectAgent(agents.find((a) => a.id === 'architect'))}
        />
        <Office3DAvatar
          position={positions.architect.avatar}
          rotation={positions.architect.avatarRot}
          avatar={AGENT_AVATAR_PROFILES.architect}
          operationalState={getAgentOperationalState('architect')}
          speechBubble={getSpeechForEntity('architect')}
          isSelected={selectedAgent?.id === 'architect'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'architect'))}
        />

        {/* 4. MESA E AVATAR DO SENIOR DEVELOPER (Lucas Silveira) */}
        <WorkstationTable
          position={positions.developer.table}
          rotation={positions.developer.tableRot}
          glowColor="#0ea5e9"
          accessoryType="HEADPHONES"
          onClick={() => selectAgent(agents.find((a) => a.id === 'developer'))}
        />
        <Office3DAvatar
          position={positions.developer.avatar}
          rotation={positions.developer.avatarRot}
          avatar={AGENT_AVATAR_PROFILES.developer}
          operationalState={getAgentOperationalState('developer')}
          speechBubble={getSpeechForEntity('developer')}
          isSelected={selectedAgent?.id === 'developer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'developer'))}
        />

        {/* 5. MESA E AVATAR DA CODE REVIEWER (Beatriz Mendes) */}
        <WorkstationTable
          position={positions.reviewer.table}
          rotation={positions.reviewer.tableRot}
          glowColor="#10b981"
          accessoryType="NONE"
          onClick={() => selectAgent(agents.find((a) => a.id === 'reviewer'))}
        />
        <Office3DAvatar
          position={positions.reviewer.avatar}
          rotation={positions.reviewer.avatarRot}
          avatar={AGENT_AVATAR_PROFILES.reviewer}
          operationalState={getAgentOperationalState('reviewer')}
          speechBubble={getSpeechForEntity('reviewer')}
          isSelected={selectedAgent?.id === 'reviewer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'reviewer'))}
        />

        {/* 6. MESA E AVATAR DO QA ENGINEER (Tiago Rocha) */}
        <WorkstationTable
          position={positions['qa-engineer'].table}
          rotation={positions['qa-engineer'].tableRot}
          glowColor="#059669"
          accessoryType="RUBBER_DUCKS"
          onClick={() => selectAgent(agents.find((a) => a.id === 'qa-engineer'))}
        />
        <Office3DAvatar
          position={positions['qa-engineer'].avatar}
          rotation={positions['qa-engineer'].avatarRot}
          avatar={AGENT_AVATAR_PROFILES['qa-engineer']}
          operationalState={getAgentOperationalState('qa-engineer')}
          speechBubble={getSpeechForEntity('qa-engineer')}
          isSelected={selectedAgent?.id === 'qa-engineer'}
          onClick={() => selectAgent(agents.find((a) => a.id === 'qa-engineer'))}
        />
      </Canvas>

      {/* Modal Jukebox de Vinis Conectado ao Store */}
      <VinylJukeboxModal
        isOpen={isJukeboxOpen}
        onClose={() => setJukeboxOpen(false)}
        selectedAlbumId={activeAlbum.id}
        onSelectAlbum={(album) => {
          selectVinylAlbum(album.id);
        }}
        isPlaying={isPlayingVinyl}
        onTogglePlay={togglePlayVinyl}
      />
    </div>
  );
};
