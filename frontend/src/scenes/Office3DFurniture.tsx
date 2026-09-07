import { Html } from '@react-three/drei';
import { PubRecLogo } from '../components/PubRecLogo';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Chão Corporativo e Tapetes Ricos em Detalhes (Zero Z-Fighting / Geometria Sólida)
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* 1.1 Piso Principal do Campus de Madeira Nobre Expandido (Warm Oak Hardwood) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 5]} receiveShadow>
        <planeGeometry args={[76, 72]} />
        <meshStandardMaterial
          color="#24150c"
          roughness={0.45}
          metalness={0.12}
        />
      </mesh>

      {/* Friso luminoso perimetral do Campus Tecnológico */}
      <mesh position={[0, 0.005, -30.8]}>
        <boxGeometry args={[75.6, 0.015, 0.08]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0.005, 40.8]}>
        <boxGeometry args={[75.6, 0.015, 0.08]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-37.8, 0.005, 5]}>
        <boxGeometry args={[0.08, 0.015, 71.6]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[37.8, 0.005, 5]}>
        <boxGeometry args={[0.08, 0.015, 71.6]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.2} />
      </mesh>

      {/* 1.2 Tapete Executivo Azul-Marinho do Gabinete do CEO (Borda Dourada e Veludo) */}
      <group position={[0, 0.01, -7.5]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[11.6, 0.02, 7.6]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.006, 0]} receiveShadow>
          <boxGeometry args={[11.0, 0.02, 7.0]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.88} />
        </mesh>
      </group>

      {/* 1.3 Tapete Persa Vintage do Lounge da Vitrola */}
      <group position={[-12, 0.01, 0]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[7.6, 0.02, 7.6]} />
          <meshStandardMaterial color="#b45309" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.006, 0]} receiveShadow>
          <boxGeometry args={[7.0, 0.02, 7.0]} />
          <meshStandardMaterial color="#881337" roughness={0.85} />
        </mesh>
      </group>

      {/* 1.4 Piso Cerâmico do Breakroom / Cafeteria Dunder Mifflin */}
      <group position={[12, 0.01, 0]}>
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[10.2, 0.02, 12.2]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <boxGeometry args={[9.8, 0.02, 11.8]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.3} metalness={0.1} />
        </mesh>
      </group>

      {/* 1.5 🏎️ PISTA DE KART PROFISSIONAL COM ZEBRAS E ASFALTO DE CORRIDA */}
      <group position={[0, 0.003, 10]}>
        {/* Retas e Curvas de Asfalto Cinza Escuro Antiderrapante */}
        {/* Reta Principal Oeste (Corredor dos Fliperamas para a Recepção) */}
        <mesh position={[-15, 0, 0]} receiveShadow>
          <boxGeometry args={[3.8, 0.01, 26]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Reta Leste (Corredor do Auditório e Mesas de Dev) */}
        <mesh position={[15, 0, 0]} receiveShadow>
          <boxGeometry args={[3.8, 0.01, 26]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Reta Sul (Passagem em frente ao Auditório) */}
        <mesh position={[0, 0, 13]} receiveShadow>
          <boxGeometry args={[33.8, 0.01, 3.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Reta Norte (Passagem entre Lounge e Breakroom) */}
        <mesh position={[0, 0, -13]} receiveShadow>
          <boxGeometry args={[33.8, 0.01, 3.8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>

        {/* Linha de Chegada / Largada Xadrez */}
        <group position={[-15, 0.008, 11]}>
          <mesh>
            <boxGeometry args={[3.8, 0.012, 1.2]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {[-1.4, -0.6, 0.2, 1.0].map((x, i) => (
            <mesh key={`grid-1-${i}`} position={[x, 0.008, -0.3]}>
              <boxGeometry args={[0.6, 0.014, 0.5]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
          {[-1.0, -0.2, 0.6, 1.4].map((x, i) => (
            <mesh key={`grid-2-${i}`} position={[x, 0.008, 0.3]}>
              <boxGeometry args={[0.6, 0.014, 0.5]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          ))}
        </group>

        {/* Zebras Vermelhas e Brancas de Corrida nas Curvas da Pista */}
        {/* Curva Noroeste */}
        {[-1, 0, 1, 2, 3].map((idx) => (
          <mesh key={`cnw-${idx}`} position={[-16.8, 0.006, -12 - idx * 0.8]}>
            <boxGeometry args={[0.6, 0.018, 0.7]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#ef4444' : '#ffffff'} roughness={0.4} />
          </mesh>
        ))}
        {/* Curva Sudoeste */}
        {[-1, 0, 1, 2, 3].map((idx) => (
          <mesh key={`csw-${idx}`} position={[-16.8, 0.006, 12 + idx * 0.8]}>
            <boxGeometry args={[0.6, 0.018, 0.7]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#ef4444' : '#ffffff'} roughness={0.4} />
          </mesh>
        ))}
        {/* Curva Nordeste */}
        {[-1, 0, 1, 2, 3].map((idx) => (
          <mesh key={`cne-${idx}`} position={[16.8, 0.006, -12 - idx * 0.8]}>
            <boxGeometry args={[0.6, 0.018, 0.7]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#ef4444' : '#ffffff'} roughness={0.4} />
          </mesh>
        ))}
        {/* Curva Sudeste */}
        {[-1, 0, 1, 2, 3].map((idx) => (
          <mesh key={`cse-${idx}`} position={[16.8, 0.006, 12 + idx * 0.8]}>
            <boxGeometry args={[0.6, 0.018, 0.7]} />
            <meshStandardMaterial color={idx % 2 === 0 ? '#ef4444' : '#ffffff'} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// 2. Paredes com Painéis Ripados de Madeira, Persianas e Quadros Artísticos 3D
export const OfficeWalls: React.FC = () => {
  const neonRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (neonRef.current) {
      const t = clock.getElapsedTime();
      const mat = neonRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.8 + Math.sin(t * 3.5) * 0.15;
      }
    }
  });

  const woodSlats = [];
  for (let x = -8; x <= 8; x += 0.45) {
    woodSlats.push(
      <mesh key={`slat-${x}`} position={[x, 3.2, -14.65]} castShadow>
        <boxGeometry args={[0.22, 6.2, 0.06]} />
        <meshStandardMaterial color="#5c3826" roughness={0.5} />
      </mesh>
    );
  }

  return (
    <group>
      {/* Parede Central Norte (Fundo Acústico do Gabinete CEO / Estúdio PUB REC) */}
      <mesh position={[0, 3.2, -14.8]} receiveShadow>
        <boxGeometry args={[18, 6.4, 0.4]} />
        <meshStandardMaterial color="#1a130f" roughness={0.9} />
      </mesh>
      {woodSlats}

      {/* Letreiro Neon Holográfico com Logo Oficial PUB REC */}
      <mesh ref={neonRef} position={[0, 5.4, -14.5]}>
        <boxGeometry args={[14, 1.6, 0.1]} />
        <meshStandardMaterial color="#09090b" roughness={0.4} metalness={0.8} />
      </mesh>
      <Html position={[0, 5.4, -14.4]} transform scale={0.22} center style={{ pointerEvents: 'none' }}>
        <div style={{ background: 'rgba(9, 9, 11, 0.92)', padding: '10px 24px', borderRadius: '16px', border: '1.5px solid #ca8a04', boxShadow: '0 0 35px rgba(202, 138, 4, 0.4)' }}>
          <PubRecLogo size="md" variant="light" showSubtitle={true} showGridLines={true} />
        </div>
      </Html>

      {/* Quadro Artístico Corporativo 1 (Emoldurado em Nogueira e Bronze) */}
      <group position={[-5.5, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.0, 1.4, 0.08]} />
          <meshStandardMaterial color="#1c120c" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[1.7, 1.1, 0.06]} />
          <meshStandardMaterial color="#fef08a" roughness={0.8} />
        </mesh>
      </group>

      {/* Quadro Artístico Corporativo 2 (Emoldurado em Nogueira e Titânio) */}
      <group position={[5.5, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.0, 1.4, 0.08]} />
          <meshStandardMaterial color="#1c120c" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[1.7, 1.1, 0.06]} />
          <meshStandardMaterial color="#e0f2fe" roughness={0.8} />
        </mesh>
      </group>

      {/* Paredes de Vidro Perimetrais com Portais Abertos para as Salas */}
      {/* Divisória Oeste Intermediária com Passagens */}
      <mesh position={[-21.5, 3.2, -2]}>
        <boxGeometry args={[0.2, 6.4, 8]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} />
      </mesh>
      <mesh position={[-21.5, 3.2, 10]}>
        <boxGeometry args={[0.2, 6.4, 6]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} />
      </mesh>

      {/* Divisória Leste Intermediária com Passagens */}
      <mesh position={[21.0, 3.2, -2]}>
        <boxGeometry args={[0.2, 6.4, 8]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} />
      </mesh>
      <mesh position={[21.0, 3.2, 10]}>
        <boxGeometry args={[0.2, 6.4, 6]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.15} roughness={0.1} />
      </mesh>

      {/* Parede de Fundo do Palco do Auditório */}
      <mesh position={[0, 3.2, 34]} receiveShadow>
        <boxGeometry args={[18, 6.4, 0.4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Limites Perimetrais Externos do Campus Tecnológico (Vidro Panorâmico com Colunas) */}
      {/* Parede Externa Oeste */}
      <mesh position={[-36.5, 3.0, 5]}>
        <boxGeometry args={[0.3, 6.0, 71]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>
      {/* Parede Externa Leste */}
      <mesh position={[36.5, 3.0, 5]}>
        <boxGeometry args={[0.3, 6.0, 71]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>
      {/* Parede Externa Norte */}
      <mesh position={[0, 3.0, -30.5]}>
        <boxGeometry args={[73, 6.0, 0.3]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>
      {/* Parede Externa Sul */}
      <mesh position={[0, 3.0, 40.5]}>
        <boxGeometry args={[73, 6.0, 0.3]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>
    </group>
  );
};

export interface WorkstationProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  glowColor?: string;
  isCeo?: boolean;
  agentId?: string;
  accessoryType?: 'CLIPBOARD' | 'HEADPHONES' | 'DUCK' | 'RUBBER_DUCKS' | 'NONE';
  deskProps?: {
    matColor?: string;
    beverageType?: 'COFFEE_MUG' | 'ENERGY_DRINK' | 'MATCHA' | 'TEA_CUP' | 'COLD_BREW' | 'WATER_BOTTLE';
    items?: string[];
    plantType?: 'BONSAI' | 'SUCCULENT' | 'CACTUS' | 'FERN' | 'NONE';
    monitorLayout?: 'SINGLE' | 'DUAL' | 'ULTRAWIDE' | 'VERTICAL_DUAL' | 'STUDIO_TRIPLE';
    lampColor?: string;
  };
  activeProject?: string;
  activeTask?: string;
  operationalState?: string;
  onClick?: () => void;
}

export const WorkstationTable: React.FC<WorkstationProps> = ({
  position,
  rotation = [0, 0, 0],
  glowColor = '#38bdf8',
  isCeo = false,
  agentId,
  deskProps,
  activeProject: _activeProject,
  activeTask: _activeTask,
  operationalState: _operationalState = 'idle',
  onClick,
}) => {
  const tableWidth = isCeo ? 3.4 : 2.4;
  const tableDepth = isCeo ? 1.6 : 1.1;
  const tableHeight = 0.76;

  const displayGlow = isCeo ? '#38bdf8' : glowColor;

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa */}
      <mesh position={[0, tableHeight, 0]} receiveShadow>
        <boxGeometry args={[tableWidth, 0.06, tableDepth]} />
        <meshStandardMaterial
          color={isCeo ? '#2a1810' : '#3b2518'}
          roughness={isCeo ? 0.3 : 0.45}
          metalness={isCeo ? 0.2 : 0.05}
        />
      </mesh>

      {/* Pés de Aço Escovado */}
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]}>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]}>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, tableDepth / 2 - 0.12]}>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, tableDepth / 2 - 0.12]}>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Monitor com Carcaça e Display Fosforescente Realista */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh>
          <boxGeometry args={[isCeo ? 1.7 : 1.2, 0.72, 0.1]} />
          <meshStandardMaterial color="#090d16" metalness={0.7} />
        </mesh>
        {/* Tela Fosforescente Emissiva de Alta Performance */}
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[isCeo ? 1.58 : 1.1, 0.62]} />
          <meshStandardMaterial
            color="#04121a"
            emissive={displayGlow}
            emissiveIntensity={0.55}
            roughness={0.2}
          />
        </mesh>

        {/* Linhas de Código Holográficas WebGL Nativas (Zero custo de DOM) */}
        {!isCeo && (
          <group position={[0, 0, 0.058]}>
            <mesh position={[-0.2, 0.18, 0]}>
              <planeGeometry args={[0.6, 0.04]} />
              <meshBasicMaterial color={displayGlow} transparent opacity={0.85} />
            </mesh>
            <mesh position={[-0.1, 0.08, 0]}>
              <planeGeometry args={[0.8, 0.03]} />
              <meshBasicMaterial color="#34d399" transparent opacity={0.75} />
            </mesh>
            <mesh position={[-0.15, -0.02, 0]}>
              <planeGeometry args={[0.7, 0.03]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
            </mesh>
            <mesh position={[-0.05, -0.12, 0]}>
              <planeGeometry args={[0.9, 0.03]} />
              <meshBasicMaterial color="#a7f3d0" transparent opacity={0.65} />
            </mesh>
            <mesh position={[-0.25, -0.2, 0]}>
              <planeGeometry args={[0.5, 0.025]} />
              <meshBasicMaterial color={displayGlow} transparent opacity={0.8} />
            </mesh>
          </group>
        )}

        {/* Terminal Dinâmico Interativo APENAS no Monitor do CEO Matheus Paes */}
        {isCeo && (
          <>
            <Html
              position={[0, 0, 0.065]}
              transform
              distanceFactor={1.2}
              style={{
                width: '360px',
                height: '160px',
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(2, 44, 34, 0.92)',
                  border: `1.5px solid ${displayGlow}`,
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '9px',
                  color: '#34d399',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: `inset 0 0 20px ${displayGlow}55`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(52, 211, 153, 0.4)', paddingBottom: '3px' }}>
                  <span style={{ fontWeight: 900, color: '#f8fafc' }}>
                    👑 CEO TERMINAL • PUB CORE
                  </span>
                  <span style={{ color: displayGlow, fontWeight: 700 }}>
                    50 AGENTES ATIVOS
                  </span>
                </div>
                <div style={{ flex: 1, margin: '4px 0', fontSize: '8px', lineHeight: 1.4 }}>
                  <div style={{ color: '#38bdf8' }}>$ pubdevloop status --all-52 --60fps</div>
                  <div style={{ color: '#cbd5e1' }}>52 Repositórios Monitorados • 10 Salas Periféricas</div>
                  <div style={{ color: '#facc15' }}>Gateway: OpenRouter + 9Router Fallback</div>
                  <div style={{ color: '#34d399' }}>Comandante Matheus Paes Online</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7.5px', color: '#6ee7b7' }}>
                  <span>PUB DEV LOOP 24H</span>
                  <span>SOLID 60 FPS</span>
                </div>
              </div>
            </Html>
            <pointLight color={displayGlow} intensity={0.8} distance={3} position={[0, 0, 0.3]} />
          </>
        )}
      </group>

      {/* Teclado e Mouse */}
      <mesh position={[0, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.55, 0.02, 0.2]} />
        <meshStandardMaterial color="#090d16" roughness={0.5} />
      </mesh>
      <mesh position={[0.38, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.09, 0.02, 0.13]} />
        <meshStandardMaterial color="#090d16" roughness={0.5} />
      </mesh>

      {/* Desk Pad Personalizado por Persona */}
      {deskProps?.matColor && (
        <mesh position={[0, tableHeight + 0.032, 0.06]}>
          <boxGeometry args={[tableWidth * 0.72, 0.006, tableDepth * 0.65]} />
          <meshStandardMaterial color={deskProps.matColor} roughness={0.7} />
        </mesh>
      )}

      {/* A LENDÁRIA CANECA "WORLD'S BEST BOSS" OU BEBIDA PREFERIDA DO AGENTE */}
      <group position={[-tableWidth / 2 + 0.45, tableHeight + 0.1, 0.2]}>
        {isCeo ? (
          <>
            <mesh castShadow>
              <cylinderGeometry args={[0.075, 0.065, 0.14, 28]} />
              <meshStandardMaterial color="#facc15" roughness={0.12} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.01, 24]} />
              <meshStandardMaterial color="#2b1408" roughness={0.1} />
            </mesh>
            <mesh position={[0.075, 0, 0]}>
              <torusGeometry args={[0.045, 0.012, 12, 20]} />
              <meshStandardMaterial color="#facc15" roughness={0.12} />
            </mesh>
            <mesh position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.076, 0.067, 0.05, 28, 1, true]} />
              <meshStandardMaterial color="#a16207" metalness={0.7} roughness={0.3} />
            </mesh>
          </>
        ) : deskProps?.beverageType === 'ENERGY_DRINK' ? (
          /* Lata de Energético (Lucas Silveira) */
          <group position={[0, 0.02, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.16, 20]} />
              <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.081, 0]}>
              <cylinderGeometry args={[0.042, 0.042, 0.005, 20]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        ) : deskProps?.beverageType === 'MATCHA' ? (
          /* Copo de Vidro com Chá Matcha Verde (Beatriz & Renata) */
          <group position={[0, 0.02, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.055, 0.045, 0.15, 20]} />
              <meshStandardMaterial color="#10b981" transparent opacity={0.65} roughness={0.1} />
            </mesh>
            {/* Canudo de vidro */}
            <mesh position={[0.02, 0.07, 0]} rotation={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.16, 12]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.2} />
            </mesh>
          </group>
        ) : deskProps?.beverageType === 'TEA_CUP' ? (
          /* Xícara Delicada de Porcelana com Pires (Helena Rostova & Maya Lin) */
          <group position={[0, -0.02, 0]}>
            {/* Pires */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.09, 0.07, 0.015, 24]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.1} />
            </mesh>
            {/* Xícara */}
            <mesh position={[0, 0.05, 0]} castShadow>
              <cylinderGeometry args={[0.065, 0.045, 0.09, 24]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.1} />
            </mesh>
            {/* Chá com gota de limão */}
            <mesh position={[0, 0.085, 0]}>
              <cylinderGeometry args={[0.06, 0.06, 0.01, 20]} />
              <meshStandardMaterial color="#ca8a04" roughness={0.2} />
            </mesh>
          </group>
        ) : deskProps?.beverageType === 'COLD_BREW' ? (
          /* Garrafa de Vidro Cold Brew com Laranja (Cauã Martins) */
          <group position={[0, 0.03, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.048, 0.048, 0.16, 20]} />
              <meshStandardMaterial color="#451a03" transparent opacity={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.085, 0]}>
              <cylinderGeometry args={[0.02, 0.045, 0.04, 16]} />
              <meshStandardMaterial color="#451a03" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
              <cylinderGeometry args={[0.024, 0.024, 0.02, 16]} />
              <meshStandardMaterial color="#ca8a04" metalness={0.8} />
            </mesh>
          </group>
        ) : (
          /* Caneca Cerâmica Padrão */
          <>
            <mesh castShadow>
              <cylinderGeometry args={[0.07, 0.06, 0.13, 24]} />
              <meshStandardMaterial color={glowColor} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.055, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.01, 20]} />
              <meshStandardMaterial color="#1c1917" roughness={0.1} />
            </mesh>
            <mesh position={[0.07, 0, 0]}>
              <torusGeometry args={[0.04, 0.01, 12, 16]} />
              <meshStandardMaterial color={glowColor} />
            </mesh>
          </>
        )}
      </group>

      {/* PLANTA DECORATIVA NA MESA (SUCULENTA, CACTO, BONSAI) */}
      {deskProps?.plantType && deskProps.plantType !== 'NONE' && (
        <group position={[-tableWidth / 2 + 0.35, tableHeight + 0.08, -tableDepth / 3 + 0.1]}>
          {/* Vaso de Cerâmica Minimalista */}
          <mesh castShadow>
            <cylinderGeometry args={[0.07, 0.05, 0.1, 16]} />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.01, 16]} />
            <meshStandardMaterial color="#3f2e21" roughness={0.9} />
          </mesh>
          {deskProps.plantType === 'CACTUS' && (
            <mesh position={[0, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.15, 12]} />
              <meshStandardMaterial color="#15803d" roughness={0.8} />
            </mesh>
          )}
          {deskProps.plantType === 'SUCCULENT' && (
            <group position={[0, 0.07, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.05, 8, 8]} />
                <meshStandardMaterial color="#10b981" roughness={0.6} />
              </mesh>
            </group>
          )}
          {deskProps.plantType === 'BONSAI' && (
            <group position={[0, 0.08, 0]}>
              <mesh position={[0, 0.04, 0]} rotation={[0, 0, 0.2]}>
                <cylinderGeometry args={[0.015, 0.025, 0.12, 8]} />
                <meshStandardMaterial color="#78350f" roughness={0.9} />
              </mesh>
              <mesh position={[0.04, 0.11, 0]}>
                <sphereGeometry args={[0.06, 10, 10]} />
                <meshStandardMaterial color="#166534" roughness={0.7} />
              </mesh>
            </group>
          )}
          {deskProps.plantType === 'FERN' && (
            <group position={[0, 0.07, 0]}>
              {[-0.03, 0, 0.03].map((off, idx) => (
                <mesh key={`fern-${idx}`} position={[off, 0.05, 0]} rotation={[0, 0, off * 4]}>
                  <coneGeometry args={[0.03, 0.12, 6]} />
                  <meshStandardMaterial color="#059669" roughness={0.6} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      )}

      {/* ITENS PERSONALIZADOS NA BANCADA BASEADOS NO AGENTE */}
      {/* 1. Lucas Silveira (Crash) - Teclado Gamer RGB + Action Figure */}
      {agentId === 'developer' && (
        <group position={[tableWidth / 2 - 0.42, tableHeight + 0.05, 0.1]}>
          {/* Mini Action Figure / Mascote */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.035, 0.12, 10]} />
            <meshStandardMaterial color="#38bdf8" metalness={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        </group>
      )}

      {/* 2. Tiago Rocha (Chaos) - O Batalhão de 4 Patinhos de Borracha Amarelos Alinhados */}
      {agentId === 'qa-engineer' && (
        <group position={[tableWidth / 2 - 0.55, tableHeight + 0.05, 0.18]}>
          {[0, 0.12, 0.24, 0.36].map((dx, idx) => (
            <group key={`duck-squad-${idx}`} position={[dx, 0, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.045, 14, 14]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} />
              </mesh>
              <mesh position={[0.025, 0.015, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.015, 0.03, 10]} />
                <meshStandardMaterial color="#ea580c" />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* 3. Maya Lin (Render) - Escultura Dourada de Pinscher & Tablet Digitalizadora */}
      {agentId === 'image-designer' && (
        <group position={[tableWidth / 2 - 0.42, tableHeight + 0.05, 0.15]}>
          {/* Tablet Gráfico Wacom com Caneta */}
          <mesh rotation={[-0.1, 0, 0]} position={[0, 0.01, 0]}>
            <boxGeometry args={[0.26, 0.012, 0.34]} />
            <meshStandardMaterial color="#1e1b4b" metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Caneta Stylus na lateral */}
          <mesh position={[0.15, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.22, 10]} />
            <meshStandardMaterial color="#c084fc" metalness={0.8} />
          </mesh>
          {/* Escultura 3D Impressa do Pinscher (Dourada Metálica) */}
          <group position={[-0.18, 0.04, -0.15]}>
            <mesh castShadow>
              <boxGeometry args={[0.08, 0.07, 0.12]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.05, 0.06]}>
              <boxGeometry args={[0.06, 0.07, 0.07]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Orelhas pontudas clássicas do pinscher */}
            <mesh position={[-0.025, 0.1, 0.06]} rotation={[0, 0, 0.2]}>
              <coneGeometry args={[0.015, 0.04, 6]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} />
            </mesh>
            <mesh position={[0.025, 0.1, 0.06]} rotation={[0, 0, -0.2]}>
              <coneGeometry args={[0.015, 0.04, 6]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} />
            </mesh>
          </group>
        </group>
      )}

      {/* 4. Cauã Martins (Director) - Miniatura de Drone 4K e Claquete */}
      {agentId === 'video-editor' && (
        <group position={[tableWidth / 2 - 0.42, tableHeight + 0.05, 0.16]}>
          {/* Mini Drone DJI com 4 Hélices */}
          <mesh position={[0, 0.02, 0]} castShadow>
            <boxGeometry args={[0.12, 0.025, 0.12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* 4 Braços e Hélices */}
          {[-0.07, 0.07].map((x) =>
            [-0.07, 0.07].map((z) => (
              <group key={`prop-${x}-${z}`} position={[x, 0.035, z]}>
                <cylinderGeometry args={[0.03, 0.03, 0.004, 8]} />
                <meshBasicMaterial color="#f43f5e" transparent opacity={0.6} />
              </group>
            ))
          )}
          {/* Claquete de Cinema */}
          <group position={[-0.18, 0.02, 0]} rotation={[0, 0.3, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.14, 0.015, 0.11]} />
              <meshStandardMaterial color="#18181b" roughness={0.5} />
            </mesh>
          </group>
        </group>
      )}

      {/* 5. Gabriel Costa (Beatsmith) - Mini Teclado MIDI e Monitores de Referência */}
      {agentId === 'sound-engineer' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.04, 0.12]}>
          {/* Mini Synth / Pad Controller Akai */}
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[0.26, 0.02, 0.18]} />
            <meshStandardMaterial color="#292524" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Pads de Borracha Coloridos Iluminados */}
          {[-0.08, -0.02, 0.04, 0.1].map((px, i) => (
            <mesh key={`pad-${i}`} position={[px, 0.028, 0.02]}>
              <boxGeometry args={[0.03, 0.008, 0.03]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
            </mesh>
          ))}
        </group>
      )}

      {/* 6. Helena Rostova (Vektor) - Esquadro de Arquitetura & Caderno Grid */}
      {agentId === 'architect' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.03, 0.15]}>
          {/* Caderno de Grade Isométrica */}
          <mesh position={[0, 0.01, 0]} rotation={[0, 0.1, 0]}>
            <boxGeometry args={[0.2, 0.016, 0.28]} />
            <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
          </mesh>
          {/* Esquadro Triangular de Acrílico Azul */}
          <mesh position={[-0.15, 0.015, 0]} rotation={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.006, 3]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} metalness={0.5} />
          </mesh>
        </group>
      )}

      {/* 7. Dr. Arthur Vance - Prancheta Executiva em Madeira e Caneta Dourada */}
      {agentId === 'chief-of-staff' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.03, 0.15]}>
          <mesh position={[0, 0.01, 0]} rotation={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.22, 0.018, 0.32]} />
            <meshStandardMaterial color="#d97706" roughness={0.6} />
          </mesh>
          {/* Clipe Metálico Dourado */}
          <mesh position={[0, 0.022, -0.13]}>
            <boxGeometry args={[0.08, 0.01, 0.04]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Caneta-Tinteiro Virtual */}
          <mesh position={[0.15, 0.018, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.22, 12]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* 8. Beatriz Mendes (Sentinel) - Token Criptográfico & Bloco de PRs */}
      {agentId === 'reviewer' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.03, 0.15]}>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[0.18, 0.02, 0.24]} />
            <meshStandardMaterial color="#064e3b" roughness={0.5} />
          </mesh>
          {/* Chave de Segurança FIDO2 Metálica */}
          <mesh position={[-0.14, 0.015, 0]}>
            <boxGeometry args={[0.04, 0.012, 0.08]} />
            <meshStandardMaterial color="#10b981" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* 9. Renata Prado (Scaler) - Foguete de Decolagem e Tablet de KPIs */}
      {agentId === 'growth-ops' && (
        <group position={[tableWidth / 2 - 0.42, tableHeight + 0.04, 0.16]}>
          {/* Miniatura do Foguete Falcon Metálico (Símbolo de Escala) */}
          <group position={[0, 0.06, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.02, 0.03, 0.15, 12]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <coneGeometry args={[0.02, 0.05, 12]} />
              <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>
          </group>
          {/* Mini Tablet de Métricas */}
          <mesh position={[-0.16, 0.01, 0]} rotation={[-0.1, 0.2, 0]}>
            <boxGeometry args={[0.18, 0.01, 0.24]} />
            <meshStandardMaterial color="#083344" metalness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// 4. Cafeteria / Breakroom Dunder Mifflin (DunderBreakroom)
export const DunderBreakroom: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const p1 = useRef<THREE.Mesh>(null);
  const p2 = useRef<THREE.Mesh>(null);
  const p3 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (p1.current) {
      const y = (t * 0.7) % 0.8;
      p1.current.position.y = 1.6 + y;
      p1.current.position.x = Math.sin(t * 4) * 0.06;
      p1.current.scale.setScalar(0.06 + y * 0.35);
      const mat = p1.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.7 - y * 0.85);
    }
    if (p2.current) {
      const y = ((t + 0.3) * 0.65) % 0.8;
      p2.current.position.y = 1.6 + y;
      p2.current.position.x = 0.08 + Math.cos(t * 3.5) * 0.05;
      p2.current.scale.setScalar(0.06 + y * 0.35);
      const mat = p2.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.7 - y * 0.85);
    }
    if (p3.current) {
      const y = ((t + 0.6) * 0.6) % 0.8;
      p3.current.position.y = 1.6 + y;
      p3.current.position.x = -0.07 + Math.sin(t * 3) * 0.05;
      p3.current.scale.setScalar(0.06 + y * 0.35);
      const mat = p3.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.7 - y * 0.85);
    }
  });

  return (
    <group position={position}>
      {/* Balcão Principal */}
      <mesh position={[0, 0.85, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.9, 1.2]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.32, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#111827" roughness={0.2} metalness={0.3} />
      </mesh>

      {/* Máquina de Expresso Italiana em Inox Escovado */}
      <group position={[0, 1.45, -1.8]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.65, 0.6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0, -0.28, 0.15]}>
          <boxGeometry args={[0.9, 0.05, 0.3]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
        </mesh>
        <mesh position={[0, -0.2, 0.15]}>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Partículas de Vapor Volumétrico Quente */}
      <mesh ref={p1} position={[0, 1.6, -1.65]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={p2} position={[0.08, 1.6, -1.65]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <mesh ref={p3} position={[-0.07, 1.6, -1.65]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <pointLight color="#f59e0b" intensity={1.5} distance={3.0} position={[0, 1.8, -1.5]} />

      {/* Geladeira Corporativa */}
      <mesh position={[-2.8, 1.6, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.4, 1.0]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Micro-ondas */}
      <mesh position={[1.4, 1.5, -1.8]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.45]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} />
      </mesh>

      {/* Mesa Redonda de Almoço */}
      <group position={[0, 0, 1.8]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.1, 0.06, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.08, 0.15, 0.75, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {[-Math.PI / 3, Math.PI / 3, Math.PI].map((ang, i) => (
          <group key={`chair-${i}`} position={[Math.sin(ang) * 1.5, 0, Math.cos(ang) * 1.5]} rotation={[0, ang + Math.PI, 0]}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.05, 16]} />
              <meshStandardMaterial color="#ef4444" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.21, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.42, 8]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// 5. Bebedouro Clássico (ClassicWatercooler)
export const ClassicWatercooler: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.9, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 20]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.72, 0.2]}>
        <boxGeometry args={[0.08, 0.08, 0.1]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
    </group>
  );
};

// 6. Sala de Reunião Executiva (MeetingRoomArea)
export const MeetingRoomArea: React.FC = () => {
  const holoRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (holoRef.current) {
      holoRef.current.rotation.y = t * 0.8;
      holoRef.current.position.y = 1.4 + Math.sin(t * 1.8) * 0.06;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 1.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -t * 1.0;
    }
  });

  return (
    <group position={[-11, 0, -8]}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 2.4, 0.08, 32]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.85}
          opacity={0.3}
          transparent
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.75, 0.9, 32]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      <group ref={holoRef} position={[0, 1.4, 0]}>
        <mesh>
          <octahedronGeometry args={[0.26, 0]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
        <mesh ref={ring1Ref}>
          <torusGeometry args={[0.42, 0.012, 8, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        <mesh ref={ring2Ref}>
          <torusGeometry args={[0.52, 0.012, 8, 24]} />
          <meshBasicMaterial color="#818cf8" transparent opacity={0.45} />
        </mesh>
      </group>

      <pointLight color="#38bdf8" intensity={1.5} distance={4.5} position={[0, 1.6, 0]} />
    </group>
  );
};

// 7. Sofá e Lounge do Toca-Discos (LoungeSofa)
export const LoungeSofa: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[2.8, 0.42, 1.0]} />
        <meshStandardMaterial color="#451a03" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.75, 0.4]} castShadow>
        <boxGeometry args={[2.8, 0.5, 0.22]} />
        <meshStandardMaterial color="#451a03" roughness={0.8} />
      </mesh>
      <mesh position={[-0.8, 0.58, 0.2]}>
        <boxGeometry args={[0.4, 0.35, 0.15]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>
      <mesh position={[0.8, 0.58, 0.2]}>
        <boxGeometry args={[0.4, 0.35, 0.15]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>
    </group>
  );
};

// 8. Plantas Decorativas de Escritório (OfficePlant)
export const OfficePlant: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const leavesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (leavesRef.current) {
      const t = clock.getElapsedTime();
      leavesRef.current.rotation.z = Math.sin(t * 1.5) * 0.05;
      leavesRef.current.rotation.x = Math.cos(t * 1.2) * 0.04;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.18, 0.6, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      <group ref={leavesRef} position={[0, 0.6, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.38, 12, 12]} />
          <meshStandardMaterial color="#15803d" roughness={0.6} />
        </mesh>
        <mesh position={[0.15, 0.35, 0]} castShadow>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshStandardMaterial color="#16a34a" roughness={0.6} />
        </mesh>
        <mesh position={[-0.15, 0.3, 0.1]} castShadow>
          <sphereGeometry args={[0.22, 10, 10]} />
          <meshStandardMaterial color="#22c55e" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

// 9. Cadeira de Escritório Executiva Ergonômica (OfficeChair)
export const OfficeChair: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}> = ({ position, rotation = [0, 0, 0], color = '#0f172a' }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* 9.1 Base Estrela com 5 Rodízios */}
      <group position={[0, 0.04, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* 5 Braços da Estrela */}
        {[0, 1, 2, 3, 4].map((i) => {
          const angle = (i * Math.PI * 2) / 5;
          const rx = Math.cos(angle) * 0.22;
          const rz = Math.sin(angle) * 0.22;
          return (
            <group key={i} position={[rx, 0, rz]}>
              <mesh castShadow>
                <sphereGeometry args={[0.035, 8, 8]} />
                <meshStandardMaterial color="#09090b" roughness={0.6} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* 9.2 Pistão Hidráulico / Coluna a Gás Cromada */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.045, 0.34, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* 9.3 Assento Acolchoado Ergonômico */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.54, 0.08, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      {/* 9.4 Encosto Alto Ergonômico com Apoio Lombar (Inclinado Levemente) */}
      <mesh position={[0, 0.82, -0.22]} rotation={[0.08, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.65, 0.07]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Faixa Lombar */}
      <mesh position={[0, 0.68, -0.24]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.46, 0.1, 0.04]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* 9.5 Braços Laterais com Apoio Acolchoado */}
      <group position={[-0.27, 0.58, 0]}>
        {/* Haste Vertical do Braço */}
        <mesh position={[0, -0.06, 0]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.05]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        {/* Apoio de Braço Superior */}
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.07, 0.03, 0.28]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
      </group>

      <group position={[0.27, 0.58, 0]}>
        <mesh position={[0, -0.06, 0]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.05]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.07, 0.03, 0.28]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};

