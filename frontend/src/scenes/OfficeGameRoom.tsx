import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { PubRecLogo } from '../components/PubRecLogo';

interface OfficeGameRoomProps {
  position?: [number, number, number];
}

export const OfficeGameRoom: React.FC<OfficeGameRoomProps> = ({
  position = [-14, 0, 16],
}) => {
  const openArcadeGame = useStore((s) => s.openArcadeGame);
  const arcadeLeaderboard = useStore((s) => s.arcadeLeaderboard);
  const isKartActive = useStore((s) => s.isKartActive);
  const activeArcadeGame = useStore((s) => s.activeArcadeGame);
  const hideOverlays = isKartActive || !!activeArcadeGame;

  const crtGlowRef1 = useRef<THREE.PointLight>(null);
  const crtGlowRef2 = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (crtGlowRef1.current) {
      crtGlowRef1.current.intensity = 1.2 + Math.sin(t * 8) * 0.4;
    }
    if (crtGlowRef2.current) {
      crtGlowRef2.current.intensity = 1.2 + Math.cos(t * 7) * 0.4;
    }
  });

  const getTopScore = (game: string) => {
    const list = arcadeLeaderboard[game];
    if (!list || list.length === 0) return 0;
    return Math.max(...list.map((l) => l.score));
  };

  return (
    <group position={position}>
      {/* 1. PISO DA SALA DE JOGOS (Estilo Habbo Hotel / Arcade Neon) */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[14, 0.03, 14]} />
        <meshStandardMaterial color="#09090b" roughness={0.6} />
      </mesh>

      {/* Grid Quadriculada Retrô Neon Habbo */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[13.6, 0.02, 13.6]} />
        <meshStandardMaterial
          color="#18181b"
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>

      {/* 2. PLACA NEON SUPERIOR: PUB REC • ARCADE & GAMES */}
      <group position={[0, 4.2, -6.8]}>
        <mesh castShadow>
          <boxGeometry args={[11.5, 1.2, 0.15]} />
          <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.08]}>
          <boxGeometry args={[11.2, 0.95, 0.02]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
        {!hideOverlays && (
          <Html position={[0, 0, 0.12]} transform scale={0.16} center style={{ pointerEvents: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '6px 20px',
                background: 'rgba(2, 6, 23, 0.9)',
                borderRadius: '12px',
                border: '2px solid #38bdf8',
                boxShadow: '0 0 25px rgba(56, 189, 248, 0.8)',
              }}
            >
              <PubRecLogo size="sm" variant="light" showSubtitle={false} showGridLines={false} />
              <div style={{ fontFamily: 'monospace', fontWeight: 900, color: '#f8fafc', fontSize: '18px', letterSpacing: '2px' }}>
                🕹️ ARCADE ZONE • RETRO HIGH-SCORE
              </div>
            </div>
          </Html>
        )}
      </group>

      {/* 3. OS 4 FLIPERAMAS RETRÔ JOGÁVEIS */}
      {/* 3.1 Fliperama 1: F1 GRAND PRIX RETRO */}
      <group
        position={[-4.5, 0, -5.2]}
        onClick={(e) => {
          e.stopPropagation();
          openArcadeGame('f1');
        }}
      >
        <ArcadeCabinet
          color="#dc2626"
          title="F1 GRAND PRIX"
          screenColor="#ef4444"
          topScore={getTopScore('f1')}
          onPlay={() => openArcadeGame('f1')}
          hideHtml={hideOverlays}
        />
      </group>

      {/* 3.2 Fliperama 2: METAL SLUG SUPER VEHICLE */}
      <group
        position={[-1.5, 0, -5.2]}
        onClick={(e) => {
          e.stopPropagation();
          openArcadeGame('metal-slug');
        }}
      >
        <ArcadeCabinet
          color="#d97706"
          title="METAL SLUG"
          screenColor="#f59e0b"
          topScore={getTopScore('metal-slug')}
          onPlay={() => openArcadeGame('metal-slug')}
          hideHtml={hideOverlays}
        />
      </group>

      {/* 3.3 Fliperama 3: STREET FIGHTER II */}
      <group
        position={[1.5, 0, -5.2]}
        onClick={(e) => {
          e.stopPropagation();
          openArcadeGame('street-fighter');
        }}
      >
        <ArcadeCabinet
          color="#2563eb"
          title="STREET FIGHTER"
          screenColor="#38bdf8"
          topScore={getTopScore('street-fighter')}
          onPlay={() => openArcadeGame('street-fighter')}
          hideHtml={hideOverlays}
        />
      </group>

      {/* 3.4 Fliperama 4: CADILLACS E DINOSSAUROS */}
      <group
        position={[4.5, 0, -5.2]}
        onClick={(e) => {
          e.stopPropagation();
          openArcadeGame('cadillacs');
        }}
      >
        <ArcadeCabinet
          color="#16a34a"
          title="CADILLACS & DINOS"
          screenColor="#22c55e"
          topScore={getTopScore('cadillacs')}
          onPlay={() => openArcadeGame('cadillacs')}
          hideHtml={hideOverlays}
        />
      </group>

      {/* 3.4 Fliperama 4: CADILLACS AND DINOSAURS */}
      <group
        position={[4.5, 0, -5.2]}
        onClick={(e) => {
          e.stopPropagation();
          openArcadeGame('cadillacs');
        }}
        
      >
        <ArcadeCabinet
          color="#059669"
          title="CADILLACS & DINO"
          screenColor="#10b981"
          topScore={getTopScore('cadillacs')}
          onPlay={() => openArcadeGame('cadillacs')}
        />
      </group>

      {/* 4. MOBIS CLÁSSICOS HABBO HOTEL */}
      {/* 4.1 Sofá HC (Habbo Club Sofa Clássico Verde com Frisos Dourados) */}
      <group position={[4.8, 0, 1.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.35, 0.85]} />
          <meshStandardMaterial color="#15803d" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.9, -0.32]} castShadow>
          <boxGeometry args={[2.4, 0.7, 0.22]} />
          <meshStandardMaterial color="#166534" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.26, -0.32]}>
          <boxGeometry args={[2.42, 0.05, 0.24]} />
          <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[-1.25, 0.65, 0]} castShadow>
          <boxGeometry args={[0.25, 0.5, 0.88]} />
          <meshStandardMaterial color="#15803d" roughness={0.4} />
        </mesh>
        <mesh position={[1.25, 0.65, 0]} castShadow>
          <boxGeometry args={[0.25, 0.5, 0.88]} />
          <meshStandardMaterial color="#15803d" roughness={0.4} />
        </mesh>
      </group>

      {/* 4.2 Mesa de Vidro Plasto Habbo & O Pato Amarelo Clássico */}
      <group position={[4.8, 0, 3.8]}>
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.64, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.66, 0]}>
          <cylinderGeometry args={[0.65, 0.65, 0.04, 24]} />
          <meshPhysicalMaterial color="#38bdf8" transmission={0.7} opacity={0.8} transparent roughness={0.1} />
        </mesh>

        {/* O PATO AMARELO DO HABBO HOTEL */}
        <group position={[0, 0.76, 0]} scale={0.7}>
          <mesh castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} />
          </mesh>
          <mesh position={[0.1, 0.16, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#eab308" roughness={0.3} />
          </mesh>
          <mesh position={[0.22, 0.14, 0]} rotation={[0, 0, -0.2]}>
            <coneGeometry args={[0.06, 0.12, 12]} />
            <meshStandardMaterial color="#f97316" roughness={0.4} />
          </mesh>
          <mesh position={[0.16, 0.2, 0.08]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh position={[0.16, 0.2, -0.08]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>
      </group>

      {/* 4.3 Máquina de Refrigerante Clássica Habbo */}
      <group position={[-5.8, 0, 1.8]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 2.2, 0.85]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, 1.4, 0.44]}>
          <boxGeometry args={[0.95, 1.1, 0.04]} />
          <meshStandardMaterial color="#f87171" roughness={0.2} emissive="#dc2626" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.35, 0.44]}>
          <boxGeometry args={[0.7, 0.35, 0.04]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
      </group>

      {/* 4.4 Teleporte Clássico Habbo Hotel */}
      <group position={[-5.8, 0, 4.8]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 2.5, 0.9]} />
          <meshStandardMaterial color="#5c3826" roughness={0.6} metalness={0.1} />
        </mesh>
        <mesh position={[-0.08, 1.25, 0.47]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.08, 1.25, 0.47]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
        </mesh>
        {!isKartActive && (
          <Html position={[0, 2.3, 0.48]} transform scale={0.08} center style={{ pointerEvents: 'none' }}>
            <div style={{ background: '#ca8a04', color: '#000', fontWeight: 900, padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
              TELEPORT
            </div>
          </Html>
        )}
      </group>

      {/* 4.5 Pedestal com Troféus Dourados do Habbo */}
      <group position={[0, 0, -1.8]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.9, 0.65]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} />
        </mesh>
        {/* Troféu Ouro */}
        <group position={[-0.6, 0.95, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.04, 0.35, 16]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
        {/* Troféu Prata */}
        <group position={[0, 0.95, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.04, 0.35, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
        {/* Troféu Bronze */}
        <group position={[0.6, 0.95, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.04, 0.35, 16]} />
            <meshStandardMaterial color="#b45309" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* 5. VAGA CHECKERED DO KART COM PISTA DE SAÍDA */}
      <group position={[-1, 0.021, 4.2]}>
        <mesh receiveShadow>
          <boxGeometry args={[4.2, 0.01, 3.2]} />
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.005, -1.4]}>
          <boxGeometry args={[4.0, 0.01, 0.3]} />
          <meshStandardMaterial color="#eab308" roughness={0.3} />
        </mesh>
        <Html position={[0, 0.01, 0]} transform rotation={[-Math.PI / 2, 0, 0]} scale={0.12} center style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#64748b', fontFamily: 'monospace', fontWeight: 900, fontSize: '14px', letterSpacing: '4px' }}>
            🏁 START / FINISH • KART PUB REC 01
          </div>
        </Html>
      </group>
    </group>
  );
};

interface ArcadeCabinetProps {
  color: string;
  title: string;
  screenColor: string;
  topScore: number;
  onPlay: () => void;
  hideHtml?: boolean;
}

const ArcadeCabinet: React.FC<ArcadeCabinetProps> = ({
  color,
  title,
  screenColor,
  topScore,
  onPlay,
  hideHtml = false,
}) => {
  return (
    <group>
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2.5, 1.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
      </mesh>

      <mesh position={[-0.61, 1.25, 0]} castShadow>
        <boxGeometry args={[0.04, 2.45, 1.05]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      <mesh position={[0.61, 1.25, 0]} castShadow>
        <boxGeometry args={[0.04, 2.45, 1.05]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>

      <mesh position={[0, 2.25, 0.42]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[1.1, 0.35, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>

      <mesh position={[0, 1.55, 0.38]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.95, 0.75, 0.06]} />
        <meshStandardMaterial color="#030712" roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.55, 0.41]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.88, 0.68, 0.02]} />
        <meshBasicMaterial color={screenColor} />
      </mesh>

      <mesh position={[0, 0.95, 0.52]} rotation={[0.4, 0, 0]} castShadow>
        <boxGeometry args={[1.12, 0.45, 0.12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      <group position={[-0.3, 1.06, 0.52]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#dc2626" roughness={0.2} />
        </mesh>
      </group>

      {[-0.05, 0.12, 0.28].map((xBtn, bIdx) => (
        <mesh key={bIdx} position={[xBtn, 1.05, 0.52]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 12]} />
          <meshStandardMaterial color={['#ef4444', '#3b82f6', '#eab308'][bIdx]} roughness={0.3} />
        </mesh>
      ))}

      <mesh position={[0, 0.5, 0.56]}>
        <boxGeometry args={[0.22, 0.12, 0.02]} />
        <meshStandardMaterial color="#ca8a04" metalness={0.8} roughness={0.3} />
      </mesh>

      {!hideHtml && (
        <Html position={[0, 2.8, 0]} center distanceFactor={8}>
          <div
            onClick={onPlay}
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1px solid ${screenColor}`,
              padding: '4px 10px',
              borderRadius: '12px',
              color: '#f8fafc',
              textAlign: 'center',
              boxShadow: `0 4px 16px ${screenColor}66`,
              cursor: 'pointer',
              minWidth: '110px',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 800, color: screenColor }}>
              🕹️ {title}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>
              Top: {topScore > 0 ? topScore.toLocaleString() : 'Sem recorde'}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#facc15', marginTop: '2px' }}>
              [CLIQUE P/ JOGAR]
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

