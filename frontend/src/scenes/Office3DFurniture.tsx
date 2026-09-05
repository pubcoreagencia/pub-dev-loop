import { Html } from '@react-three/drei';
import { PubRecLogo } from '../components/PubRecLogo';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Chão Corporativo e Tapetes Ricos em Detalhes (Zero Z-Fighting / Geometria Sólida)
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* 1.1 Piso Principal de Madeira Nobre Aconchegante (Warm Oak Hardwood) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 9]} receiveShadow>
        <planeGeometry args={[56, 56]} />
        <meshStandardMaterial
          color="#2e1b10"
          roughness={0.45}
          metalness={0.12}
        />
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
  for (let x = -13; x <= 13; x += 0.45) {
    woodSlats.push(
      <mesh key={`slat-${x}`} position={[x, 3.2, -14.65]} castShadow>
        <boxGeometry args={[0.22, 6.2, 0.06]} />
        <meshStandardMaterial color="#5c3826" roughness={0.5} />
      </mesh>
    );
  }

  const blindSlats = [];
  for (let z = -14; z <= 14; z += 0.8) {
    blindSlats.push(
      <mesh key={`blind-${z}`} position={[20.6, 3.2, z]} rotation={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.02, 5.2, 0.22]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </mesh>
    );
  }

  return (
    <group>
      {/* Parede Norte (Fundo da Sala do CEO com Painel Ripado) */}
      <mesh position={[0, 3.2, -14.8]} receiveShadow>
        <boxGeometry args={[44, 6.4, 0.4]} />
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
      <group position={[-6.5, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.4, 1.5, 0.08]} />
          <meshStandardMaterial color="#1c120c" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[2.1, 1.2, 0.06]} />
          <meshStandardMaterial color="#fef08a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[1.8, 0.9, 0.04]} />
          <meshStandardMaterial color="#090d16" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <ringGeometry args={[0.2, 0.35, 32]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Quadro Artístico Corporativo 2 (Emoldurado em Nogueira e Titânio) */}
      <group position={[6.5, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.4, 1.5, 0.08]} />
          <meshStandardMaterial color="#1c120c" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[2.1, 1.2, 0.06]} />
          <meshStandardMaterial color="#e0f2fe" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[1.8, 0.9, 0.04]} />
          <meshStandardMaterial color="#022c22" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.065]} rotation={[0, 0, Math.PI / 4]}>
          <planeGeometry args={[0.45, 0.45]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Parede Oeste (Lounge do Toca-Discos até Arcade & Auditório) */}
      <mesh position={[-21.5, 3.2, 9]} receiveShadow>
        <boxGeometry args={[0.6, 6.4, 50]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Janelas Panorâmicas de Vidro Leste com Persianas */}
      <mesh position={[21, 3.2, 9]}>
        <boxGeometry args={[0.2, 6.4, 50]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.12} roughness={0.1} />
      </mesh>
      {blindSlats}

      {/* Parede Sul Perimetral (Fundo do Auditório e Games Room) */}
      <mesh position={[0, 3.2, 34]} receiveShadow>
        <boxGeometry args={[44, 6.4, 0.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 3. Estações de Trabalho (WorkstationTable compatível com Office3DScene)
export interface WorkstationProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  glowColor?: string;
  isCeo?: boolean;
  accessoryType?: 'CLIPBOARD' | 'HEADPHONES' | 'DUCK' | 'RUBBER_DUCKS' | 'NONE';
  onClick?: () => void;
}

export const WorkstationTable: React.FC<WorkstationProps> = ({
  position,
  rotation = [0, 0, 0],
  glowColor = '#38bdf8',
  isCeo = false,
  accessoryType = 'NONE',
  onClick,
}) => {
  const tableWidth = isCeo ? 3.4 : 2.4;
  const tableDepth = isCeo ? 1.6 : 1.1;
  const tableHeight = 0.76;

  const scanlineRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (scanlineRef.current) {
      scanlineRef.current.position.y = Math.sin(t * 3.5) * 0.18;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.0 + Math.sin(t * 7) * 0.08;
    }
  });

  const displayGlow = isCeo ? '#38bdf8' : glowColor;

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa */}
      <mesh position={[0, tableHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.06, tableDepth]} />
        <meshStandardMaterial
          color={isCeo ? '#2a1810' : '#3b2518'}
          roughness={isCeo ? 0.3 : 0.45}
          metalness={isCeo ? 0.2 : 0.05}
        />
      </mesh>

      {/* Pés de Aço Escovado */}
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, tableDepth / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, tableDepth / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Monitor com Carcaça e Display Fosforescente Realista */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[isCeo ? 1.7 : 1.2, 0.72, 0.1]} />
          <meshStandardMaterial color="#090d16" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[isCeo ? 1.58 : 1.1, 0.62]} />
          <meshStandardMaterial
            color={isCeo ? '#042f2e' : '#022c22'}
            emissive={displayGlow}
            emissiveIntensity={0.65}
            roughness={0.15}
          />
        </mesh>
        <mesh ref={scanlineRef} position={[0, 0, 0.06]}>
          <planeGeometry args={[isCeo ? 1.54 : 1.05, 0.04]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.28} />
        </mesh>

        <pointLight ref={lightRef} color={displayGlow} intensity={1.1} distance={2.5} position={[0, 0, 0.3]} />
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

      {/* A LENDÁRIA CANECA "WORLD'S BEST BOSS" (Cerâmica 3D Amarela) */}
      <group position={[-tableWidth / 2 + 0.45, tableHeight + 0.1, 0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.065, 0.14, 28]} />
          <meshStandardMaterial
            color={isCeo ? '#facc15' : '#f8fafc'}
            roughness={0.12}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.01, 24]} />
          <meshStandardMaterial color="#2b1408" roughness={0.1} />
        </mesh>
        <mesh position={[0.075, 0, 0]}>
          <torusGeometry args={[0.045, 0.012, 12, 20]} />
          <meshStandardMaterial
            color={isCeo ? '#facc15' : '#f8fafc'}
            roughness={0.12}
          />
        </mesh>
        {isCeo && (
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.076, 0.067, 0.05, 28, 1, true]} />
            <meshStandardMaterial color="#a16207" metalness={0.7} roughness={0.3} />
          </mesh>
        )}
      </group>

      {/* Acessórios por Persona */}
      {accessoryType === 'DUCK' || accessoryType === 'RUBBER_DUCKS' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.07, 0.2]}>
          <mesh castShadow>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial color="#facc15" roughness={0.3} />
          </mesh>
          <mesh position={[0.035, 0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.02, 0.04, 12]} />
            <meshStandardMaterial color="#ea580c" />
          </mesh>
        </group>
      )}

      {accessoryType === 'HEADPHONES' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.08, 0.2]}>
          <mesh castShadow>
            <torusGeometry args={[0.06, 0.01, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
        </group>
      )}

      {accessoryType === 'CLIPBOARD' && (
        <mesh position={[tableWidth / 2 - 0.45, tableHeight + 0.02, 0.2]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.22, 0.02, 0.32]} />
          <meshStandardMaterial color="#d97706" roughness={0.6} />
        </mesh>
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

