import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/useStore';
import {
  OfficeFloor,
  OfficeWalls,
  WorkstationTable,
  DunderBreakroom,
  ClassicWatercooler,
  LoungeSofa,
  OfficePlant,
} from './Office3DFurniture';
import {
  StudioAcousticTreatment,
  StudioMixingConsole,
  StudioInstruments,
  DrumRecordingBooth,
} from './Studio3DFurniture';
import { TurntableVinyl } from './TurntableVinyl';
import { Office3DAvatar } from './Office3DAvatar';
import { OfficeAuditorium } from './OfficeAuditorium';
import { OfficeGameRoom } from './OfficeGameRoom';
import { OfficeDrivableKart } from './OfficeDrivableKart';
import { AGENT_AVATAR_PROFILES } from '../config/officeLayout';
import { VinylJukeboxModal, VINYL_ALBUMS } from '../components/VinylJukeboxModal';
import { PlayableArcadeModal } from '../components/PlayableArcadeModal';

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
    isConferenceActive,
    setConferenceActive,
    isKartActive,
    setKartActive,
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
      avatar: [0, 0, -7.28],
      tableRot: [0, 0, 0],
      avatarRot: [0, 0, 0],
    },
    'chief-of-staff': {
      table: [0, 0, -1],
      avatar: [0, 0, -0.28],
      tableRot: [0, 0, 0],
      avatarRot: [0, 0, 0],
    },
    architect: {
      table: [-6, 0, 5],
      avatar: [-6, 0, 4.28],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    developer: {
      table: [6, 0, 5],
      avatar: [6, 0, 4.28],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    reviewer: {
      table: [-6, 0, 10],
      avatar: [-6, 0, 9.28],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
    'qa-engineer': {
      table: [6, 0, 10],
      avatar: [6, 0, 9.28],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, Math.PI, 0],
    },
  };

  // Coordenadas no Auditório: Agentes sentados nas cadeiras da Fileira 1 e CEO no púlpito do palco
  const conferencePositions: Record<
    string,
    { pos: [number, number, number]; rot: [number, number, number] }
  > = {
    ceo: {
      pos: [0, 0.72, 27.8], // No púlpito central do palco de frente para a plateia
      rot: [0, Math.PI, 0],
    },
    'chief-of-staff': {
      pos: [-3.2, 0.44, 22.5], // Cadeira da Fileira 1 voltada para o palco
      rot: [0, 0, 0],
    },
    architect: {
      pos: [-1.6, 0.44, 22.5], // Cadeira da Fileira 1 voltada para o palco
      rot: [0, 0, 0],
    },
    developer: {
      pos: [0, 0.44, 22.5], // Cadeira da Fileira 1 voltada para o palco
      rot: [0, 0, 0],
    },
    reviewer: {
      pos: [1.6, 0.44, 22.5], // Cadeira da Fileira 1 voltada para o palco
      rot: [0, 0, 0],
    },
    'qa-engineer': {
      pos: [3.2, 0.44, 22.5], // Cadeira da Fileira 1 voltada para o palco
      rot: [0, 0, 0],
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
          onClick={() => handleCameraFocus([0, 1.2, -7.8], [0, 2.4, -4.8])}
          style={{ background: 'transparent', border: 'none', color: '#facc15', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
          title="Zoom no Estúdio de Produção Musical, Mesa de Som e Monitores do CEO"
        >
          🎙️ Estúdio PUB Records (CEO)
        </button>
        <button
          onClick={() => handleCameraFocus([-11.5, 1.2, -8.0], [-11.5, 2.6, -4.2])}
          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
          title="Zoom no Aquário Acústico de Bateria de Gravação"
        >
          🥁 Aquário de Bateria
        </button>
        <button
          onClick={() => handleCameraFocus([0, 2.0, 25], [0, 7, 14])}
          style={{
            background: isConferenceActive ? '#38bdf8' : 'transparent',
            color: isConferenceActive ? '#020617' : '#38bdf8',
            border: 'none',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 800,
          }}
          title="Zoom no Auditório de Eventos, Palco, Telão LED e Plateia"
        >
          🏛️ Auditório &amp; Palco
        </button>
        <button
          onClick={() => handleCameraFocus([-14, 1.5, 16], [-14, 10, 24])}
          style={{ background: 'transparent', border: 'none', color: '#a855f7', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
          title="Zoom na Sala de Jogos Retrô, Fliperamas e Mobis do Habbo"
        >
          🕹️ Arcade Zone (Habbo)
        </button>
        <button
          onClick={() => setKartActive(!isKartActive)}
          style={{
            background: isKartActive ? '#dc2626' : 'transparent',
            color: isKartActive ? '#ffffff' : '#f87171',
            border: 'none',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
          title="Pilotar Kart pelo escritório estilo Gather"
        >
          🏎️ {isKartActive ? 'Sair do Kart' : 'Pilotar Kart'}
        </button>
        <button
          onClick={() => {
            setConferenceActive(!isConferenceActive, 'Alinhamento Estratégico com CEO Matheus Paes');
            handleCameraFocus([0, 2.0, 25], [0, 7, 14]);
          }}
          style={{
            background: isConferenceActive ? '#10b981' : '#1e293b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
          title="Convocar todos os agentes para o auditório"
        >
          {isConferenceActive ? '✅ Em Conferência' : '📢 Convocar Reunião'}
        </button>
      </div>

      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 18, 22]} fov={40} />
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={0.5}
          maxDistance={55}
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

        {/* Chão de Madeira Nobre Expandido e Paredes com Painéis */}
        <OfficeFloor />
        <OfficeWalls />

        {/* 🎙️ PUB RECORDS • SALA TÉCNICA, TRATAMENTO ACÚSTICO E AQUÁRIO DE GRAVAÇÃO */}
        <StudioAcousticTreatment />
        <DrumRecordingBooth position={[-11.5, 0, -8.0]} isRecording={isPlayingVinyl} />
        <StudioInstruments position={[4.8, 0, -8.5]} />

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

        {/* 🏛️ AUDITÓRIO DE EVENTOS, PALCO, TELÃO LED PUB REC E PLATEIA */}
        <OfficeAuditorium position={[0, 0, 0]} />

        {/* 🕹️ SALA DE JOGOS RETRÔ COM OS 4 FLIPERAMAS E MOBIS HABBO HOTEL */}
        <OfficeGameRoom position={[-14, 0, 16]} />

        {/* 🏎️ KART PILOTÁVEL (GATHER.TOWN STYLE) */}
        <OfficeDrivableKart initialPosition={[-15, 0, 11]} />

        {/* 1. MESA DE SOM / CONSOLE E AVATAR DO CEO (Matheus Paes) */}
        <StudioMixingConsole
          position={positions.ceo.table}
          rotation={positions.ceo.tableRot}
          isPlaying={isPlayingVinyl}
        />
        <Office3DAvatar
          position={positions.ceo.avatar}
          rotation={positions.ceo.avatarRot}
          conferencePosition={conferencePositions.ceo.pos}
          conferenceRotation={conferencePositions.ceo.rot}
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
          conferencePosition={conferencePositions['chief-of-staff'].pos}
          conferenceRotation={conferencePositions['chief-of-staff'].rot}
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
          conferencePosition={conferencePositions.architect.pos}
          conferenceRotation={conferencePositions.architect.rot}
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
          conferencePosition={conferencePositions.developer.pos}
          conferenceRotation={conferencePositions.developer.rot}
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
          conferencePosition={conferencePositions.reviewer.pos}
          conferenceRotation={conferencePositions.reviewer.rot}
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
          conferencePosition={conferencePositions['qa-engineer'].pos}
          conferenceRotation={conferencePositions['qa-engineer'].rot}
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

      {/* Modal de Fliperama Retrô Jogável com Highscores */}
      <PlayableArcadeModal />
    </div>
  );
};
