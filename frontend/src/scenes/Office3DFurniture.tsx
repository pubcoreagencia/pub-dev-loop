import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// 1. Chão Corporativo e Pisos/Tapetes Ricos em Detalhes
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* 1.1 Piso Principal de Madeira Nobre Aconchegante (Warm Oak Hardwood) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[44, 34]} />
        <meshStandardMaterial
          color="#382216"
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>

      {/* Grid de Tábuas de Madeira */}
      <gridHelper args={[44, 44, '#4a2e1f', '#2c180e']} position={[0, 0.002, 0]} />

      {/* 1.2 Tapete Executivo Azul-Marinho do Gabinete do CEO (com Borda Dourada) */}
      <group position={[0, 0.015, -7.5]}>
        {/* Borda Dourada Externa */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[14.2, 9.2]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Corpo Azul-Marinho */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.002]} receiveShadow>
          <planeGeometry args={[13.6, 8.6]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.9} />
        </mesh>
      </group>

      {/* 1.3 Tapete Persa / Vinho Vintage no Lounge do Toca-Discos */}
      <group position={[-12, 0.015, 0]}>
        {/* Borda Dourada Externa */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[9.4, 9.4]} />
          <meshStandardMaterial color="#d97706" roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Centro Vermelho Rubi / Borgonha Texturizado */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.002]} receiveShadow>
          <planeGeometry args={[8.8, 8.8]} />
          <meshStandardMaterial color="#881337" roughness={0.88} />
        </mesh>
      </group>

      {/* 1.4 Piso Cerâmico Quadriculado da Cafeteria / Breakroom Dunder Mifflin */}
      <group position={[12, 0.015, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[11, 13]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Grid dos Azulejos */}
        <gridHelper args={[11, 11, '#94a3b8', '#cbd5e1']} position={[0, 0.005, 0]} />
      </group>
    </group>
  );
};

// 2. Paredes com Painéis Ripados de Madeira, Persianas e Quadros
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

  // Painéis Ripados de Madeira Vertical (Acoustic Slat Wood Wall) atrás do CEO
  const woodSlats = [];
  for (let x = -13; x <= 13; x += 0.45) {
    woodSlats.push(
      <mesh key={`slat-${x}`} position={[x, 3.2, -14.65]} castShadow>
        <boxGeometry args={[0.22, 6.2, 0.06]} />
        <meshStandardMaterial color="#5c3826" roughness={0.5} />
      </mesh>
    );
  }

  // Persianas Verticais (Vertical Blinds) ao longo de todas as janelas
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
      {/* Parede Norte Principal */}
      <mesh position={[0, 3.2, -15]} receiveShadow>
        <boxGeometry args={[44, 6.4, 0.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Painéis Ripados de Madeira Acústica */}
      {woodSlats}

      {/* Letreiro Neon Holográfico PUB DEV LOOP */}
      <mesh ref={neonRef} position={[0, 5.2, -14.5]}>
        <planeGeometry args={[13, 1.4]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
      </mesh>

      {/* Quadro Motivacional The Office 1 */}
      <group position={[-6, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.2, 1.4, 0.05]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <Html position={[0, 0, 0.04]} center distanceFactor={14}>
          <div style={{ background: '#020617', border: '1px solid #f59e0b', color: '#f8fafc', padding: '6px 10px', fontSize: '10px', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }}>
            DUNDER MIFFLIN / PUB DEV LOOP<br/><span style={{ color: '#f59e0b', fontSize: '8px' }}>"IN CODE WE TRUST"</span>
          </div>
        </Html>
      </group>

      {/* Quadro Motivacional The Office 2 */}
      <group position={[6, 4.2, -14.55]}>
        <mesh castShadow>
          <boxGeometry args={[2.2, 1.4, 0.05]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <Html position={[0, 0, 0.04]} center distanceFactor={14}>
          <div style={{ background: '#020617', border: '1px solid #38bdf8', color: '#f8fafc', padding: '6px 10px', fontSize: '10px', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }}>
            SOVEREIGN ARCHITECTURE<br/><span style={{ color: '#38bdf8', fontSize: '8px' }}>"ZERO ANY IN TYPESCRIPT"</span>
          </div>
        </Html>
      </group>

      {/* Parede Oeste (Lounge) */}
      <mesh position={[-21.5, 3.2, 0]} receiveShadow>
        <boxGeometry args={[0.6, 6.4, 34]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Janelas de Vidro Leste com Persianas */}
      <mesh position={[21, 3.2, 0]}>
        <boxGeometry args={[0.2, 6, 32]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.8}
          opacity={0.3}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
      {blindSlats}

      {/* Divisória de Vidro com Molduras do Gabinete do CEO */}
      <mesh position={[0, 2.2, -3.5]}>
        <boxGeometry args={[30, 4.4, 0.08]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.88}
          opacity={0.2}
          transparent
          roughness={0.1}
        />
      </mesh>
      <mesh position={[0, 4.4, -3.5]}>
        <boxGeometry args={[30, 0.1, 0.12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} />
      </mesh>
    </group>
  );
};

// 3. Estação de Trabalho com Cadeira e Computador
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
  const tableWidth = isCeo ? 4.2 : 2.6;
  const tableDepth = isCeo ? 1.9 : 1.3;
  const tableHeight = 0.88;

  const scanlineRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + (position[0] * 1.7);
    if (scanlineRef.current) {
      scanlineRef.current.position.y = (Math.sin(t * 7) * 0.18);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.1 + Math.sin(t * 11) * 0.2;
    }
  });

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa com Madeira Maciça Nobre */}
      <mesh position={[0, tableHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.08, tableDepth]} />
        <meshStandardMaterial color={isCeo ? '#1e293b' : '#3b2518'} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* Pernas Metálicas */}
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

      {/* Monitor CRT com Carcaça e Scanlines Ativas */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[isCeo ? 1.7 : 1.2, 0.72, 0.1]} />
          <meshStandardMaterial color="#090d16" metalness={0.7} />
        </mesh>
        {/* Tela CRT */}
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[isCeo ? 1.58 : 1.1, 0.62]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
        {/* Scanlines Animadas */}
        <mesh ref={scanlineRef} position={[0, 0, 0.06]}>
          <planeGeometry args={[isCeo ? 1.54 : 1.05, 0.08]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
        {/* Código Matrix no Monitor */}
        <Html position={[0, 0, 0.07]} center transform distanceFactor={7}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#000',
              fontWeight: 900,
              letterSpacing: '1px',
              opacity: 0.85,
              textAlign: 'center',
              userSelect: 'none',
              textShadow: '0 0 5px rgba(255,255,255,0.9)',
            }}
          >
            {isCeo ? 'PUB_DEV_LOOP::CEO' : 'WPM:140 > COMPILING...'}
          </div>
        </Html>
        <pointLight ref={lightRef} color={glowColor} intensity={1.2} distance={3.0} position={[0, 0, 0.3]} />
      </group>

      {/* Teclado e Mouse */}
      <mesh position={[0, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.55, 0.02, 0.2]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>
      <mesh position={[0.38, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.09, 0.02, 0.13]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>

      {/* A LENDÁRIA CANECA "WORLD'S BEST BOSS" */}
      <group position={[-tableWidth / 2 + 0.45, tableHeight + 0.1, 0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.065, 0.14, 24]} />
          <meshStandardMaterial color={isCeo ? '#facc15' : '#f8fafc'} roughness={0.15} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <torusGeometry args={[0.045, 0.012, 8, 16]} />
          <meshStandardMaterial color={isCeo ? '#facc15' : '#f8fafc'} />
        </mesh>
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

      {/* CADEIRA GIRATÓRIA (Posicionada exatamente onde o avatar senta: z = 0.72) */}
      <group position={[0, 0, 0.72]}>
        {/* Assento da Cadeira */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.58, 0.08, 0.58]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        {/* Encosto da Cadeira */}
        <mesh position={[0, 0.9, 0.26]} castShadow>
          <boxGeometry args={[0.58, 0.78, 0.08]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        {/* Coluna e Rodinhas */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
};

// 4. O Bebedouro / Watercooler The Office
export const ClassicWatercooler: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.3, 0.5]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
      <mesh position={[-0.08, 0.78, 0.27]}>
        <boxGeometry args={[0.04, 0.06, 0.06]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0.08, 0.78, 0.27]}>
        <boxGeometry args={[0.04, 0.06, 0.06]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
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

      {/* Balcão Principal */}
      <mesh position={[0, 0.85, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 0.9, 1.2]} />
        <meshStandardMaterial color="#1f2937" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.32, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#111827" roughness={0.2} metalness={0.3} />
      </mesh>

      {/* Máquina de Expresso */}
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

      {/* Partículas de Vapor */}
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

      {/* Geladeira */}
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
