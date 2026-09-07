import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/useStore';
import {
  OfficeFloor,
  OfficeWalls,
  WorkstationTable,
  OfficeChair,
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
import { PUB_HOLDING_SECTORS, FIFTY_SPECIALIZED_AGENTS, getSectorById } from '../config/squadsData';
import { SectorRoom3D } from './SectorRoom3D';
import { VinylJukeboxModal, VINYL_ALBUMS } from '../components/VinylJukeboxModal';
import { PlayableArcadeModal } from '../components/PlayableArcadeModal';
import { MusicStudioModal } from '../components/MusicStudioModal';
import { LogicProDawModal } from '../components/LogicProDawModal';
import { LiveDashboardModal } from '../components/LiveDashboardModal';

export const SECTOR_ROOM_CONFIGS: Record<
  string,
  {
    sectorNumber: number;
    wing: 'OESTE' | 'LESTE' | 'NORTE' | 'SUL';
    position: [number, number, number];
    rotation: [number, number, number];
    cameraTarget: [number, number, number];
    cameraPos: [number, number, number];
  }
> = {
  // === EXTREMO OESTE (ALA OESTE - 3 SALAS LADO A LADO) ===
  'b2b-growth-leads': {
    sectorNumber: 1,
    wing: 'OESTE',
    position: [-27, 0, -8],
    rotation: [0, -Math.PI / 2, 0],
    cameraTarget: [-27, 1.5, -8],
    cameraPos: [-18, 7.5, -8],
  },
  'machine-saas-automation': {
    sectorNumber: 2,
    wing: 'OESTE',
    position: [-27, 0, 4],
    rotation: [0, -Math.PI / 2, 0],
    cameraTarget: [-27, 1.5, 4],
    cameraPos: [-18, 7.5, 4],
  },
  'igaming-pubet': {
    sectorNumber: 8,
    wing: 'OESTE',
    position: [-27, 0, 16],
    rotation: [0, -Math.PI / 2, 0],
    cameraTarget: [-27, 1.5, 16],
    cameraPos: [-18, 7.5, 16],
  },

  // === EXTREMO LESTE (ALA LESTE - 3 SALAS LADO A LADO) ===
  'ecommerce-food-retail': {
    sectorNumber: 3,
    wing: 'LESTE',
    position: [27, 0, -8],
    rotation: [0, Math.PI / 2, 0],
    cameraTarget: [27, 1.5, -8],
    cameraPos: [18, 7.5, -8],
  },
  'physical-3d-pets': {
    sectorNumber: 6,
    wing: 'LESTE',
    position: [27, 0, 4],
    rotation: [0, Math.PI / 2, 0],
    cameraTarget: [27, 1.5, 4],
    cameraPos: [18, 7.5, 4],
  },
  'real-estate-hospitality': {
    sectorNumber: 7,
    wing: 'LESTE',
    position: [27, 0, 16],
    rotation: [0, Math.PI / 2, 0],
    cameraTarget: [27, 1.5, 16],
    cameraPos: [18, 7.5, 16],
  },

  // === EXTREMO NORTE (ALA NORTE - 2 SALAS LADO A LADO) ===
  'audiovisual-cinema-music': {
    sectorNumber: 4,
    wing: 'NORTE',
    position: [-13, 0, -22],
    rotation: [0, 0, 0],
    cameraTarget: [-13, 1.5, -22],
    cameraPos: [-13, 7.5, -14],
  },
  'neural-kernel-infra': {
    sectorNumber: 10,
    wing: 'NORTE',
    position: [13, 0, -22],
    rotation: [0, 0, 0],
    cameraTarget: [13, 1.5, -22],
    cameraPos: [13, 7.5, -14],
  },

  // === EXTREMO SUL (ALA SUL - 2 SALAS LADO A LADO) ===
  'immersive-3d-games': {
    sectorNumber: 5,
    wing: 'SUL',
    position: [-16, 0, 31],
    rotation: [0, Math.PI, 0],
    cameraTarget: [-16, 1.5, 31],
    cameraPos: [-16, 7.5, 23],
  },
  'web3-crypto-fintech': {
    sectorNumber: 9,
    wing: 'SUL',
    position: [16, 0, 31],
    rotation: [0, Math.PI, 0],
    cameraTarget: [16, 1.5, 31],
    cameraPos: [16, 7.5, 23],
  },
};

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
    activeStudioModal,
    selectedSectorId,
    setSelectedSectorId,
    setFiftyAgentsModalOpen,
  } = useStore();

  const activeSector = selectedSectorId !== 'executive' ? getSectorById(selectedSectorId) : null;
  const activeSectorCfg = activeSector ? SECTOR_ROOM_CONFIGS[activeSector.id] : null;

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const activeAlbum = VINYL_ALBUMS.find((a) => a.id === activeAlbumId) || VINYL_ALBUMS[0];

  // Coordenadas das Estações de Trabalho (Mesas, Cadeiras e Avatares voltados para seus monitores)
  const positions: Record<
    string,
    {
      table: [number, number, number];
      avatar: [number, number, number];
      tableRot?: [number, number, number];
      avatarRot: [number, number, number];
      chair: [number, number, number];
      chairRot: [number, number, number];
    }
  > = {
    ceo: {
      table: [0, 0, -8],
      avatar: [0, 0.04, -7.3],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [0, 0, -7.3],
      chairRot: [0, Math.PI, 0],
    },
    // =========================================================================
    // 🏢 GRANDE BANCADA CENTRAL DE COWORKING (Mesas Juntas / Open-Space Cohesivo)
    // Fileira Norte (z = 3.2): 4 agentes lado a lado, voltados para o Sul
    // Fileira Sul   (z = 5.8): 4 agentes lado a lado, voltados para o Norte
    // Cabeceira     (x = 0, z = -0.5): Chief of Staff coordenando o centro
    // =========================================================================

    // Cabeceira da Bancada de Operações
    'chief-of-staff': {
      table: [0, 0, 0.2],
      avatar: [0, 0.04, 0.75],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [0, 0, 0.75],
      chairRot: [0, Math.PI, 0],
    },

    // FILEIRA 1 (Lado A da grande mesa compartilhada - z = 3.6, olhando para z+)
    architect: {
      table: [-4.2, 0, 3.6],
      avatar: [-4.2, 0.04, 4.15],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [-4.2, 0, 4.15],
      chairRot: [0, Math.PI, 0],
    },
    reviewer: {
      table: [-1.4, 0, 3.6],
      avatar: [-1.4, 0.04, 4.15],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [-1.4, 0, 4.15],
      chairRot: [0, Math.PI, 0],
    },
    'video-editor': {
      table: [1.4, 0, 3.6],
      avatar: [1.4, 0.04, 4.15],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [1.4, 0, 4.15],
      chairRot: [0, Math.PI, 0],
    },
    'sound-engineer': {
      table: [4.2, 0, 3.6],
      avatar: [4.2, 0.04, 4.15],
      tableRot: [0, 0, 0],
      avatarRot: [0, Math.PI, 0],
      chair: [4.2, 0, 4.15],
      chairRot: [0, Math.PI, 0],
    },

    // FILEIRA 2 (Lado B da grande mesa compartilhada - z = 6.2, olhando para z-)
    developer: {
      table: [-4.2, 0, 6.2],
      avatar: [-4.2, 0.04, 5.65],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, 0, 0],
      chair: [-4.2, 0, 5.65],
      chairRot: [0, 0, 0],
    },
    'qa-engineer': {
      table: [-1.4, 0, 6.2],
      avatar: [-1.4, 0.04, 5.65],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, 0, 0],
      chair: [-1.4, 0, 5.65],
      chairRot: [0, 0, 0],
    },
    'image-designer': {
      table: [1.4, 0, 6.2],
      avatar: [1.4, 0.04, 5.65],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, 0, 0],
      chair: [1.4, 0, 5.65],
      chairRot: [0, 0, 0],
    },
    'growth-ops': {
      table: [4.2, 0, 6.2],
      avatar: [4.2, 0.04, 5.65],
      tableRot: [0, Math.PI, 0],
      avatarRot: [0, 0, 0],
      chair: [4.2, 0, 5.65],
      chairRot: [0, 0, 0],
    },
  };

  // Coordenadas no Auditório: Agentes sentados nas cadeiras da Fileira 1 e CEO no palco ATRÁS do púlpito
  const conferencePositions: Record<
    string,
    { pos: [number, number, number]; rot: [number, number, number] }
  > = {
    ceo: {
      pos: [0, 0.74, 28.6], // Atrás do púlpito (z=27.8) no palco voltado para o auditório
      rot: [0, Math.PI, 0],
    },
    'chief-of-staff': {
      pos: [-3.2, 0.04, 22.5],
      rot: [0, 0, 0],
    },
    architect: {
      pos: [-1.6, 0.04, 22.5],
      rot: [0, 0, 0],
    },
    developer: {
      pos: [0, 0.04, 22.5],
      rot: [0, 0, 0],
    },
    reviewer: {
      pos: [1.6, 0.04, 22.5],
      rot: [0, 0, 0],
    },
    'qa-engineer': {
      pos: [3.2, 0.04, 22.5],
      rot: [0, 0, 0],
    },
    'video-editor': {
      pos: [-4.0, 0.04, 20.5],
      rot: [0, 0, 0],
    },
    'image-designer': {
      pos: [-1.5, 0.04, 20.5],
      rot: [0, 0, 0],
    },
    'sound-engineer': {
      pos: [1.5, 0.04, 20.5],
      rot: [0, 0, 0],
    },
    'growth-ops': {
      pos: [4.0, 0.04, 20.5],
      rot: [0, 0, 0],
    },
  };

  const getSpeechForEntity = (entityId: string): string | undefined => {
    return speechBubbles.find((b) => b.senderId === entityId)?.content;
  };

  const getAgentOperationalState = (id: string) => {
    return agents.find((a) => a.id === id)?.operationalState || 'idle';
  };

  const getAgentData = (id: string) => {
    return agents.find((a) => a.id === id) || (FIFTY_SPECIALIZED_AGENTS as any[]).find((a) => a.id === id);
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
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          padding: '4px 12px',
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

      {/* 🏢 BARRA DE NAVEGAÇÃO DE SQUADS (10 SETORES + LIDERANÇA EXECUTIVA) */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(10, 15, 29, 0.92)',
          backdropFilter: 'blur(16px)',
          padding: '3px 8px',
          borderRadius: '20px',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: '0 8px 25px rgba(0,0,0,0.7)',
          maxWidth: '96vw',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => {
            setSelectedSectorId('executive');
            handleCameraFocus([0, 1.0, 4.5], [0, 14, 18]);
          }}
          style={{
            background: selectedSectorId === 'executive' ? '#38bdf8' : 'transparent',
            color: selectedSectorId === 'executive' ? '#020617' : '#94a3b8',
            border: 'none',
            borderRadius: '12px',
            padding: '3px 8px',
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          🏛️ Liderança Geral
        </button>

        {PUB_HOLDING_SECTORS.map((sec, idx) => {
          const isSelected = selectedSectorId === sec.id;
          const cfg = SECTOR_ROOM_CONFIGS[sec.id];
          return (
            <button
              key={sec.id}
              onClick={() => {
                setSelectedSectorId(sec.id);
                if (cfg) {
                  handleCameraFocus(cfg.cameraTarget, cfg.cameraPos);
                }
              }}
              style={{
                background: isSelected ? '#0284c7' : 'transparent',
                color: isSelected ? '#ffffff' : '#94a3b8',
                border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              title={`${sec.name} (${cfg ? `Ala ${cfg.wing}` : ''})`}
            >
              {`${idx + 1}. ${sec.name.split(':')[1]?.trim().split(',')[0].slice(0, 14) || sec.name}`}
            </button>
          );
        })}

        <button
          onClick={() => setFiftyAgentsModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.4))',
            color: '#38bdf8',
            border: '1px solid #38bdf8',
            borderRadius: '12px',
            padding: '3px 10px',
            fontSize: '10px',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
          title="Abrir Modal com Todos os 50 Funcionários"
        >
          <span>👥</span> 50 Agentes
        </button>
      </div>

      {/* BANNER FLUTUANTE DE IDENTIFICAÇÃO DA SQUAD ATIVA */}
      {activeSector && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #38bdf8',
            borderRadius: '10px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.7)',
            fontSize: '11px',
            color: '#cbd5e1',
          }}
        >
          <span style={{ fontSize: '14px' }}>⚡</span>
          <div>
            <span style={{ fontWeight: 800, color: '#38bdf8' }}>{activeSector.name}</span>
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#94a3b8' }}>
              {activeSectorCfg ? `Ala ${activeSectorCfg.wing} • Sala 3D com 5 Especialistas • Benchmarking de IA Ativo` : 'Squad Especializada'}
            </span>
          </div>
        </div>
      )}

      <Canvas
        shadows
        gl={{ powerPreference: 'high-performance', antialias: true, stencil: false }}
        dpr={[1, 1.5]}
      >
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

        {/* Iluminação Quente de Design de Interiores (Otimizada para 60 FPS) */}
        <ambientLight intensity={0.75} color="#fef3c7" />
        <directionalLight
          position={[12, 24, 16]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
          shadow-bias={-0.001}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-near={1}
          shadow-camera-far={60}
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
        <OfficeChair
          position={positions.ceo.chair}
          rotation={positions.ceo.chairRot}
          color="#1e1b4b"
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

        {/* ========================================================================= */}
        {/* 🏢 BANCADA CENTRAL DE COWORKING (DIRETORIA E ENGENHARIA PRINCIPAL) */}
        {/* Renderizada apenas quando o foco é a Liderança Central ou em Conferência Geral */}
        {/* ========================================================================= */}
        {(selectedSectorId === 'executive' || isConferenceActive) && (
          <>
            {/* 2. MESA E AVATAR DO CHIEF OF STAFF (Dr. Arthur Vance) */}
            <WorkstationTable
          position={positions['chief-of-staff'].table}
          rotation={positions['chief-of-staff'].tableRot}
          glowColor="#f59e0b"
          agentId="chief-of-staff"
          deskProps={AGENT_AVATAR_PROFILES['chief-of-staff'].deskProps}
          accessoryType="CLIPBOARD"
          activeProject={getAgentData('chief-of-staff')?.currentProject}
          activeTask={getAgentData('chief-of-staff')?.currentShiftTask}
          operationalState={getAgentOperationalState('chief-of-staff')}
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />
        <OfficeChair
          position={positions['chief-of-staff'].chair}
          rotation={positions['chief-of-staff'].chairRot}
          color="#1e293b"
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
          currentProject={getAgentData('chief-of-staff')?.currentProject}
          currentShiftTask={getAgentData('chief-of-staff')?.currentShiftTask}
          onClick={() => selectAgent(agents.find((a) => a.id === 'chief-of-staff'))}
        />

        {/* ========================================================================= */}
        {/* 🏢 BANCADA CENTRAL DE COWORKING (DIRETORIA E ENGENHARIA PRINCIPAL) */}
        {/* ========================================================================= */}
        {/* 3. MESA E AVATAR DA PRINCIPAL ARCHITECT (Helena Rostova) */}
        <WorkstationTable
          position={positions.architect.table}
          rotation={positions.architect.tableRot}
          glowColor="#3b82f6"
          agentId="architect"
          deskProps={AGENT_AVATAR_PROFILES.architect.deskProps}
          accessoryType="NONE"
          activeProject={getAgentData('architect')?.currentProject}
          activeTask={getAgentData('architect')?.currentShiftTask}
          operationalState={getAgentOperationalState('architect')}
          onClick={() => selectAgent(getAgentData('architect') || agents.find((a) => a.id === 'architect'))}
        />
        <OfficeChair position={positions.architect.chair} rotation={positions.architect.chairRot} color="#1e293b" />
        <Office3DAvatar
          position={positions.architect.avatar}
          rotation={positions.architect.avatarRot}
          conferencePosition={conferencePositions.architect.pos}
          conferenceRotation={conferencePositions.architect.rot}
          avatar={AGENT_AVATAR_PROFILES.architect}
          operationalState={getAgentOperationalState('architect')}
          speechBubble={getSpeechForEntity('architect')}
          isSelected={selectedAgent?.id === 'architect'}
          currentProject={getAgentData('architect')?.currentProject}
          currentShiftTask={getAgentData('architect')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('architect') || agents.find((a) => a.id === 'architect'))}
        />

        {/* 4. MESA E AVATAR DO SENIOR DEVELOPER (Lucas Silveira) */}
        <WorkstationTable
          position={positions.developer.table}
          rotation={positions.developer.tableRot}
          glowColor="#0ea5e9"
          agentId="developer"
          deskProps={AGENT_AVATAR_PROFILES.developer.deskProps}
          accessoryType="HEADPHONES"
          activeProject={getAgentData('developer')?.currentProject}
          activeTask={getAgentData('developer')?.currentShiftTask}
          operationalState={getAgentOperationalState('developer')}
          onClick={() => selectAgent(getAgentData('developer') || agents.find((a) => a.id === 'developer'))}
        />
        <OfficeChair position={positions.developer.chair} rotation={positions.developer.chairRot} color="#1e293b" />
        <Office3DAvatar
          position={positions.developer.avatar}
          rotation={positions.developer.avatarRot}
          conferencePosition={conferencePositions.developer.pos}
          conferenceRotation={conferencePositions.developer.rot}
          avatar={AGENT_AVATAR_PROFILES.developer}
          operationalState={getAgentOperationalState('developer')}
          speechBubble={getSpeechForEntity('developer')}
          isSelected={selectedAgent?.id === 'developer'}
          currentProject={getAgentData('developer')?.currentProject}
          currentShiftTask={getAgentData('developer')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('developer') || agents.find((a) => a.id === 'developer'))}
        />

        {/* 5. MESA E AVATAR DA CODE REVIEWER (Beatriz Mendes) */}
        <WorkstationTable
          position={positions.reviewer.table}
          rotation={positions.reviewer.tableRot}
          glowColor="#10b981"
          agentId="reviewer"
          deskProps={AGENT_AVATAR_PROFILES.reviewer.deskProps}
          accessoryType="NONE"
          activeProject={getAgentData('reviewer')?.currentProject}
          activeTask={getAgentData('reviewer')?.currentShiftTask}
          operationalState={getAgentOperationalState('reviewer')}
          onClick={() => selectAgent(getAgentData('reviewer') || agents.find((a) => a.id === 'reviewer'))}
        />
        <OfficeChair position={positions.reviewer.chair} rotation={positions.reviewer.chairRot} color="#1e293b" />
        <Office3DAvatar
          position={positions.reviewer.avatar}
          rotation={positions.reviewer.avatarRot}
          conferencePosition={conferencePositions.reviewer.pos}
          conferenceRotation={conferencePositions.reviewer.rot}
          avatar={AGENT_AVATAR_PROFILES.reviewer}
          operationalState={getAgentOperationalState('reviewer')}
          speechBubble={getSpeechForEntity('reviewer')}
          isSelected={selectedAgent?.id === 'reviewer'}
          currentProject={getAgentData('reviewer')?.currentProject}
          currentShiftTask={getAgentData('reviewer')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('reviewer') || agents.find((a) => a.id === 'reviewer'))}
        />

        {/* 6. MESA E AVATAR DO QA ENGINEER (Tiago Rocha) */}
        <WorkstationTable
          position={positions['qa-engineer'].table}
          rotation={positions['qa-engineer'].tableRot}
          glowColor="#059669"
          agentId="qa-engineer"
          deskProps={AGENT_AVATAR_PROFILES['qa-engineer'].deskProps}
          accessoryType="RUBBER_DUCKS"
          activeProject={getAgentData('qa-engineer')?.currentProject}
          activeTask={getAgentData('qa-engineer')?.currentShiftTask}
          operationalState={getAgentOperationalState('qa-engineer')}
          onClick={() => selectAgent(getAgentData('qa-engineer') || agents.find((a) => a.id === 'qa-engineer'))}
        />
        <OfficeChair position={positions['qa-engineer'].chair} rotation={positions['qa-engineer'].chairRot} color="#1e293b" />
        <Office3DAvatar
          position={positions['qa-engineer'].avatar}
          rotation={positions['qa-engineer'].avatarRot}
          conferencePosition={conferencePositions['qa-engineer'].pos}
          conferenceRotation={conferencePositions['qa-engineer'].rot}
          avatar={AGENT_AVATAR_PROFILES['qa-engineer']}
          operationalState={getAgentOperationalState('qa-engineer')}
          speechBubble={getSpeechForEntity('qa-engineer')}
          isSelected={selectedAgent?.id === 'qa-engineer'}
          currentProject={getAgentData('qa-engineer')?.currentProject}
          currentShiftTask={getAgentData('qa-engineer')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('qa-engineer') || agents.find((a) => a.id === 'qa-engineer'))}
        />

        {/* 7. MESA E AVATAR DO AUDIOVISUAL DIRECTOR (Cauã Martins) */}
        <WorkstationTable
          position={positions['video-editor'].table}
          rotation={positions['video-editor'].tableRot}
          glowColor="#e11d48"
          agentId="video-editor"
          deskProps={AGENT_AVATAR_PROFILES['video-editor'].deskProps}
          accessoryType="NONE"
          activeProject={getAgentData('video-editor')?.currentProject || 'buzios-de-cima'}
          activeTask={getAgentData('video-editor')?.currentShiftTask}
          operationalState={getAgentOperationalState('video-editor')}
          onClick={() => selectAgent(getAgentData('video-editor') || agents.find((a) => a.id === 'video-editor'))}
        />
        <OfficeChair position={positions['video-editor'].chair} rotation={positions['video-editor'].chairRot} color="#4c0519" />
        <Office3DAvatar
          position={positions['video-editor'].avatar}
          rotation={positions['video-editor'].avatarRot}
          conferencePosition={conferencePositions['video-editor'].pos}
          conferenceRotation={conferencePositions['video-editor'].rot}
          avatar={AGENT_AVATAR_PROFILES['video-editor']}
          operationalState={getAgentOperationalState('video-editor')}
          speechBubble={getSpeechForEntity('video-editor')}
          isSelected={selectedAgent?.id === 'video-editor'}
          currentProject={getAgentData('video-editor')?.currentProject || 'buzios-de-cima'}
          currentShiftTask={getAgentData('video-editor')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('video-editor') || agents.find((a) => a.id === 'video-editor'))}
        />

        {/* 8. MESA E AVATAR DA 3D ARTIST (Maya Lin) */}
        <WorkstationTable
          position={positions['image-designer'].table}
          rotation={positions['image-designer'].tableRot}
          glowColor="#a855f7"
          agentId="image-designer"
          deskProps={AGENT_AVATAR_PROFILES['image-designer'].deskProps}
          accessoryType="NONE"
          activeProject={getAgentData('image-designer')?.currentProject || 'eternize-seu-pinscher'}
          activeTask={getAgentData('image-designer')?.currentShiftTask}
          operationalState={getAgentOperationalState('image-designer')}
          onClick={() => selectAgent(getAgentData('image-designer') || agents.find((a) => a.id === 'image-designer'))}
        />
        <OfficeChair position={positions['image-designer'].chair} rotation={positions['image-designer'].chairRot} color="#3b0764" />
        <Office3DAvatar
          position={positions['image-designer'].avatar}
          rotation={positions['image-designer'].avatarRot}
          conferencePosition={conferencePositions['image-designer'].pos}
          conferenceRotation={conferencePositions['image-designer'].rot}
          avatar={AGENT_AVATAR_PROFILES['image-designer']}
          operationalState={getAgentOperationalState('image-designer')}
          speechBubble={getSpeechForEntity('image-designer')}
          isSelected={selectedAgent?.id === 'image-designer'}
          currentProject={getAgentData('image-designer')?.currentProject || 'eternize-seu-pinscher'}
          currentShiftTask={getAgentData('image-designer')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('image-designer') || agents.find((a) => a.id === 'image-designer'))}
        />

        {/* 9. MESA E AVATAR DO SOUND DESIGNER (Gabriel Costa) */}
        <WorkstationTable
          position={positions['sound-engineer'].table}
          rotation={positions['sound-engineer'].tableRot}
          glowColor="#f59e0b"
          agentId="sound-engineer"
          deskProps={AGENT_AVATAR_PROFILES['sound-engineer'].deskProps}
          accessoryType="HEADPHONES"
          activeProject={getAgentData('sound-engineer')?.currentProject || 'xp-audio-lab'}
          activeTask={getAgentData('sound-engineer')?.currentShiftTask}
          operationalState={getAgentOperationalState('sound-engineer')}
          onClick={() => selectAgent(getAgentData('sound-engineer') || agents.find((a) => a.id === 'sound-engineer'))}
        />
        <OfficeChair position={positions['sound-engineer'].chair} rotation={positions['sound-engineer'].chairRot} color="#78350f" />
        <Office3DAvatar
          position={positions['sound-engineer'].avatar}
          rotation={positions['sound-engineer'].avatarRot}
          conferencePosition={conferencePositions['sound-engineer'].pos}
          conferenceRotation={conferencePositions['sound-engineer'].rot}
          avatar={AGENT_AVATAR_PROFILES['sound-engineer']}
          operationalState={getAgentOperationalState('sound-engineer')}
          speechBubble={getSpeechForEntity('sound-engineer')}
          isSelected={selectedAgent?.id === 'sound-engineer'}
          currentProject={getAgentData('sound-engineer')?.currentProject || 'xp-audio-lab'}
          currentShiftTask={getAgentData('sound-engineer')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('sound-engineer') || agents.find((a) => a.id === 'sound-engineer'))}
        />

        {/* 10. MESA E AVATAR DA HEAD OF GROWTH (Renata Prado) */}
        <WorkstationTable
          position={positions['growth-ops'].table}
          rotation={positions['growth-ops'].tableRot}
          glowColor="#06b6d4"
          agentId="growth-ops"
          deskProps={AGENT_AVATAR_PROFILES['growth-ops'].deskProps}
          accessoryType="CLIPBOARD"
          activeProject={getAgentData('growth-ops')?.currentProject || 'pub-leads'}
          activeTask={getAgentData('growth-ops')?.currentShiftTask}
          operationalState={getAgentOperationalState('growth-ops')}
          onClick={() => selectAgent(getAgentData('growth-ops') || agents.find((a) => a.id === 'growth-ops'))}
        />
        <OfficeChair position={positions['growth-ops'].chair} rotation={positions['growth-ops'].chairRot} color="#083344" />
        <Office3DAvatar
          position={positions['growth-ops'].avatar}
          rotation={positions['growth-ops'].avatarRot}
          conferencePosition={conferencePositions['growth-ops'].pos}
          conferenceRotation={conferencePositions['growth-ops'].rot}
          avatar={AGENT_AVATAR_PROFILES['growth-ops']}
          operationalState={getAgentOperationalState('growth-ops')}
          speechBubble={getSpeechForEntity('growth-ops')}
          isSelected={selectedAgent?.id === 'growth-ops'}
          currentProject={getAgentData('growth-ops')?.currentProject || 'pub-leads'}
          currentShiftTask={getAgentData('growth-ops')?.currentShiftTask}
          onClick={() => selectAgent(getAgentData('growth-ops') || agents.find((a) => a.id === 'growth-ops'))}
        />
      </>
    )}

        {/* ========================================================================= */}
        {/* 🏢 AS 10 SALAS DOS SETORES ESPALHADAS NO ENTORNO (50 ESPECIALISTAS ATIVOS) */}
        {/* ========================================================================= */}
        {PUB_HOLDING_SECTORS.map((sector) => {
          const cfg = SECTOR_ROOM_CONFIGS[sector.id];
          if (!cfg) return null;
          return (
            <SectorRoom3D
              key={sector.id}
              sector={sector}
              sectorNumber={cfg.sectorNumber}
              position={cfg.position}
              rotation={cfg.rotation}
              onFocusRoom={() => handleCameraFocus(cfg.cameraTarget, cfg.cameraPos)}
            />
          );
        })}
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

      {/* Modal de Instrumentos Musicais do Estúdio PUB REC (Teclado, Bateria) */}
      <MusicStudioModal />

      {/* Logic Pro DAW Multitrack Profissional com Master Bus, Quantizer e Exportador WAV */}
      {activeStudioModal === 'daw' && (
        <LogicProDawModal onClose={() => useStore.getState().setActiveStudioModal(null)} />
      )}

      {/* Modal de Dashboard Executivo em Tempo Real (Sem Mock, Interativo) */}
      <LiveDashboardModal />
    </div>
  );
};
