import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// 1. Chão Corporativo e Piso Cerâmico da Cafeteria
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* Piso Geral de Concreto Polido / Carpete Corporativo Escuro */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[42, 32]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Grid de Linhas Sutis */}
      <gridHelper args={[42, 42, '#1e293b', '#111827']} position={[0, 0.001, 0]} />

      {/* Carpete Executivo do Gabinete do CEO */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -8]} receiveShadow>
        <planeGeometry args={[14, 9]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>

      {/* Piso da Cafeteria / Breakroom Dunder Mifflin (Ladrilho Claro) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.015, 0]} receiveShadow>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Carpete Aconchegante do Lounge do Toca-Discos */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.015, 0]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#31102b" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 2. Paredes, Persianas Verticais de Escritório e Letreiro Neon
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

  // Geração das Persianas Verticais (Vertical Blinds estilo The Office)
  const blindSlats = [];
  for (let z = -14; z <= 14; z += 0.85) {
    blindSlats.push(
      <mesh key={`blind-${z}`} position={[19.6, 3, z]} rotation={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.02, 4.8, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
      </mesh>
    );
  }

  return (
    <group>
      {/* Parede Norte (Atrás do Gabinete do CEO) */}
      <mesh position={[0, 3.2, -15]} receiveShadow>
        <boxGeometry args={[42, 6.4, 0.5]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>

      {/* Letreiro Neon Holográfico PUB DEV LOOP */}
      <mesh ref={neonRef} position={[0, 5.0, -14.7]}>
        <planeGeometry args={[12, 1.4]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
      </mesh>

      {/* Parede Oeste (Atrás do Lounge) */}
      <mesh position={[-20.5, 3.2, 0]} receiveShadow>
        <boxGeometry args={[0.5, 6.4, 32]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>

      {/* Janelas de Vidro Leste */}
      <mesh position={[20, 3.2, 0]}>
        <boxGeometry args={[0.2, 6, 30]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.8}
          opacity={0.3}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Persianas Verticais de Escritório Reais */}
      {blindSlats}

      {/* Trilho Superior das Persianas */}
      <mesh position={[19.6, 5.5, 0]}>
        <boxGeometry args={[0.1, 0.1, 29]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} />
      </mesh>

      {/* Divisória de Vidro com Caixilhos do Gabinete do CEO */}
      <mesh position={[0, 2.2, -4]}>
        <boxGeometry args={[28, 4.4, 0.08]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.88}
          opacity={0.2}
          transparent
          roughness={0.1}
        />
      </mesh>
      {/* Caixilho de Alumínio da Divisória */}
      <mesh position={[0, 4.4, -4]}>
        <boxGeometry args={[28, 0.1, 0.12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} />
      </mesh>
    </group>
  );
};

// 3. Estação de Trabalho com Monitor CRT com Scanlines e Caneca "World's Best Boss"
interface WorkstationProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  glowColor?: string;
  isCeo?: boolean;
  accessoryType?: 'NONE' | 'RUBBER_DUCKS' | 'HEADPHONES' | 'CLIPBOARD';
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
  const tableWidth = isCeo ? 4.0 : 2.6;
  const tableDepth = isCeo ? 1.8 : 1.3;
  const tableHeight = 0.9;

  const scanlineRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + (position[0] * 1.7);
    if (scanlineRef.current) {
      scanlineRef.current.position.y = (Math.sin(t * 8) * 0.18);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.0 + Math.sin(t * 12) * 0.25;
    }
  });

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa com Madeira Maciça */}
      <mesh position={[0, tableHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.08, tableDepth]} />
        <meshStandardMaterial color={isCeo ? '#1e293b' : '#334155'} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Pernas Metálicas da Mesa */}
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, -tableDepth / 2 + 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[-tableWidth / 2 + 0.12, tableHeight / 2, tableDepth / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.12, tableHeight / 2, tableDepth / 2 - 0.12]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Monitor CRT com Carcaça Vintage e Scanlines Ativas */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        {/* Suporte Metálico */}
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {/* Moldura do Monitor */}
        <mesh castShadow>
          <boxGeometry args={[isCeo ? 1.7 : 1.2, 0.72, 0.1]} />
          <meshStandardMaterial color="#090d16" metalness={0.7} />
        </mesh>
        {/* Tela com Brilho do Monitor CRT */}
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[isCeo ? 1.58 : 1.1, 0.62]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
        {/* Linhas de Scanline Animadas Varrendo a Tela */}
        <mesh ref={scanlineRef} position={[0, 0, 0.06]}>
          <planeGeometry args={[isCeo ? 1.54 : 1.05, 0.08]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
        {/* Código Matrix/Terminal Verde/Azul simulado na tela */}
        <Html position={[0, 0, 0.07]} center transform distanceFactor={7}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#000',
              fontWeight: 800,
              letterSpacing: '1px',
              opacity: 0.8,
              textAlign: 'center',
              userSelect: 'none',
              textShadow: '0 0 4px rgba(255,255,255,0.8)',
            }}
          >
            {isCeo ? 'PUB_DEV_LOOP::SOVEREIGN_CEO' : 'WPM:140 > COMPILING...'}
          </div>
        </Html>
        <pointLight ref={lightRef} color={glowColor} intensity={1.2} distance={3.0} position={[0, 0, 0.3]} />
      </group>

      {/* Teclado e Mouse */}
      <mesh position={[0, tableHeight + 0.05, 0.12]}>
        <boxGeometry args={[0.55, 0.02, 0.2]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>
      <mesh position={[0.38, tableHeight + 0.05, 0.12]}>
        <boxGeometry args={[0.09, 0.02, 0.13]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>

      {/* A LENDÁRIA CANECA "WORLD'S BEST BOSS" (OU CANECA CORPORATIVA) */}
      <group position={[-tableWidth / 2 + 0.45, tableHeight + 0.1, 0.25]}>
        {/* Corpo da Caneca Amarela / Branca */}
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.065, 0.14, 24]} />
          <meshStandardMaterial color={isCeo ? '#facc15' : '#f8fafc'} roughness={0.15} />
        </mesh>
        {/* Alça da Caneca */}
        <mesh position={[0.08, 0, 0]}>
          <torusGeometry args={[0.045, 0.012, 8, 16]} />
          <meshStandardMaterial color={isCeo ? '#facc15' : '#f8fafc'} />
        </mesh>
        {/* Rótulo "WORLD'S BEST BOSS" Nítido e Legível */}
        {isCeo && (
          <Html position={[0, 0.02, 0.085]} center transform distanceFactor={4}>
            <div
              style={{
                background: '#facc15',
                color: '#000000',
                fontSize: '8px',
                fontWeight: 900,
                letterSpacing: '0.5px',
                padding: '1px 3px',
                borderRadius: '2px',
                border: '1px solid #ca8a04',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            >
              WORLD'S BEST BOSS
            </div>
          </Html>
        )}
      </group>

      {/* Acessórios por Persona */}
      {accessoryType === 'RUBBER_DUCKS' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.07, 0.2]}>
          <mesh castShadow>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#eab308" roughness={0.1} />
          </mesh>
          <mesh position={[0.05, 0.02, 0]}>
            <coneGeometry args={[0.02, 0.04, 8]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
        </group>
      )}

      {accessoryType === 'HEADPHONES' && (
        <group position={[tableWidth / 2 - 0.45, tableHeight + 0.06, 0.15]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.08, 0.02, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#ef4444" metalness={0.7} />
          </mesh>
        </group>
      )}

      {accessoryType === 'CLIPBOARD' && (
        <mesh position={[tableWidth / 2 - 0.45, tableHeight + 0.05, 0.18]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <planeGeometry args={[0.26, 0.35]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
      )}

      {/* Cadeira Executiva Giratória */}
      <group position={[0, 0, 0.75]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.58, 0.08, 0.58]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        <mesh position={[0, 0.9, -0.25]} castShadow>
          <boxGeometry args={[0.58, 0.75, 0.08]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
};

// 4. O Clássico Bebedouro / Watercooler The Office
export const ClassicWatercooler: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Corpo Branco do Bebedouro */}
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.3, 0.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
      {/* Torneiras Azul e Vermelha */}
      <mesh position={[-0.08, 0.78, 0.27]}>
        <boxGeometry args={[0.04, 0.06, 0.06]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0.08, 0.78, 0.27]}>
        <boxGeometry args={[0.04, 0.06, 0.06]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* Garrafão Azul Translúcido de 20L de Água Mineral */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.6, 32]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.85}
          opacity={0.65}
          transparent
          roughness={0.05}
          ior={1.33}
        />
      </mesh>
      <pointLight color="#38bdf8" intensity={0.8} distance={2.5} position={[0, 1.6, 0.3]} />
    </group>
  );
};

// 5. Cafeteria / Breakroom Dunder Mifflin Completa com Vapor Animado
export const DunderBreakroom: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const p1 = useRef<THREE.Mesh>(null);
  const p2 = useRef<THREE.Mesh>(null);
  const p3 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (p1.current) {
      const y = (t * 0.6) % 0.8;
      p1.current.position.y = 1.6 + y;
      p1.current.position.x = Math.sin(t * 4) * 0.05;
      p1.current.scale.setScalar(0.06 + y * 0.35);
      const mat = p1.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.7 - y * 0.85);
    }
    if (p2.current) {
      const y = ((t + 0.3) * 0.6) % 0.8;
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
      {/* Placa "THE OFFICE BREAKROOM" */}
      <Html position={[0, 3.2, -1.8]} center distanceFactor={14}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid #f59e0b',
            borderRadius: '6px',
            padding: '4px 12px',
            color: '#f59e0b',
            fontSize: '12px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
          }}
        >
          ☕ CAFETERIA &amp; BREAKROOM
        </div>
      </Html>

      {/* Balcão Principal de Granito e Madeira */}
      <mesh position={[0, 0.85, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.9, 1.2]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      {/* Tampo de Granito Polido */}
      <mesh position={[0, 1.32, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#111827" roughness={0.2} metalness={0.3} />
      </mesh>

      {/* Máquina de Café Expresso Italiana Profissional */}
      <group position={[0, 1.45, -1.8]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.65, 0.6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Bandeja Coletora Cromada */}
        <mesh position={[0, -0.28, 0.15]}>
          <boxGeometry args={[0.9, 0.05, 0.3]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
        </mesh>
        {/* Xícara de Expresso na Bandeja */}
        <mesh position={[0, -0.2, 0.15]}>
          <cylinderGeometry args={[0.05, 0.04, 0.08, 16]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Sistema de Vapor Volumétrico Animado */}
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

      {/* Geladeira Corporativa com Recados */}
      <mesh position={[-2.8, 1.6, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 2.4, 1.0]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Micro-ondas na Bancada */}
      <mesh position={[1.4, 1.5, -1.8]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.45]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} />
      </mesh>

      {/* Mesa Redonda de Descanso e Cadeiras */}
      <group position={[0, 0, 1.8]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.1, 1.1, 0.06, 24]} />
          <meshStandardMaterial color="#334155" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.08, 0.15, 0.75, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {/* 3 Cadeiras da Cafeteria */}
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

// 6. Sala de Reunião com Holograma Giratório
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
      {/* Mesa Oval de Reunião */}
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

      {/* Holograma 3D Flutuante */}
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

// 7. Sofá e Lounge do Toca-Discos
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
      {/* Almofadas */}
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

// 8. Plantas Decorativas de Escritório
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
