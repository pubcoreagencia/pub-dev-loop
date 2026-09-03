import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Chão e Tapetes do Escritório Estilo The Office
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* Piso Principal de Madeira Nobre e Carpete Corporativo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[38, 30]} />
        <meshStandardMaterial color="#0f172a" roughness={0.65} metalness={0.25} />
      </mesh>

      {/* Grid Tecnológico sutil no piso */}
      <gridHelper args={[38, 38, '#1e293b', '#1e293b']} position={[0, 0, 0]} />

      {/* Carpete Executivo do Gabinete do CEO */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8]} receiveShadow>
        <planeGeometry args={[13, 8.5]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.95} />
      </mesh>

      {/* Carpete do Lounge do Vinil e Cafeteria */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.01, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#2d1537" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 2. Paredes de Vidro, Persianas e Letreiro Neon
export const OfficeWalls: React.FC = () => {
  const neonRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (neonRef.current) {
      const t = clock.getElapsedTime();
      const mat = neonRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.75 + Math.sin(t * 3) * 0.2;
      }
    }
  });

  return (
    <group>
      {/* Parede Norte (Atrás do CEO) */}
      <mesh position={[0, 3, -14.5]} receiveShadow>
        <boxGeometry args={[38, 6, 0.4]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.8} />
      </mesh>

      {/* Letreiro Neon Holográfico do PUB DEV LOOP */}
      <mesh ref={neonRef} position={[0, 4.6, -14.2]}>
        <planeGeometry args={[11, 1.3]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>

      {/* Parede Oeste (Lounge) */}
      <mesh position={[-19, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 30]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.8} />
      </mesh>

      {/* Parede Leste (Janelas de Vidro com Persianas de Escritório) */}
      <mesh position={[19, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 30]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.7}
          opacity={0.3}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Divisória de Vidro do Gabinete do CEO */}
      <mesh position={[0, 2, -4]}>
        <boxGeometry args={[26, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.85}
          opacity={0.25}
          transparent
          roughness={0.15}
        />
      </mesh>
    </group>
  );
};

// 3. Estação de Trabalho com Monitor CRT / LCD com Scanlines e Código Brilhante
interface WorkstationProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  glowColor?: string;
  isCeo?: boolean;
  accessoryType?: 'NONE' | 'RUBBER_DUCKS' | 'HEADPHONES' | 'BLUEPRINTS' | 'CLIPBOARD';
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
  const tableWidth = isCeo ? 3.8 : 2.5;
  const tableDepth = isCeo ? 1.7 : 1.25;
  const tableHeight = 0.9;
  const screenLightRef = useRef<THREE.PointLight>(null);
  const codeLinesRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + (position[0] * 1.5);
    if (screenLightRef.current) {
      screenLightRef.current.intensity = 0.75 + Math.sin(t * 10) * 0.2;
    }
    if (codeLinesRef.current) {
      codeLinesRef.current.position.y = (tableHeight + 0.45) + Math.sin(t * 4) * 0.05;
    }
  });

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa com Madeira Nobre */}
      <mesh position={[0, tableHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.08, tableDepth]} />
        <meshStandardMaterial color={isCeo ? '#1e293b' : '#334155'} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Pernas de Metal Escovado */}
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

      {/* Monitor CRT/LCD com Carcaça e Tela Brilhante */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh castShadow>
          <boxGeometry args={[isCeo ? 1.6 : 1.15, 0.68, 0.07]} />
          <meshStandardMaterial color="#090d16" metalness={0.6} />
        </mesh>
        {/* Tela com Glow da Persona */}
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[isCeo ? 1.5 : 1.05, 0.58]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
        {/* Linhas de Código / Scanlines Rolando */}
        <mesh ref={codeLinesRef} position={[0, 0, 0.045]}>
          <planeGeometry args={[isCeo ? 1.4 : 0.95, 0.48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.15} wireframe />
        </mesh>
        <pointLight ref={screenLightRef} color={glowColor} intensity={0.9} distance={2.8} position={[0, 0, 0.25]} />
      </group>

      {/* Teclado Mecânico e Mousepad */}
      <mesh position={[0, tableHeight + 0.05, 0.12]}>
        <boxGeometry args={[0.55, 0.02, 0.2]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>
      <mesh position={[0.38, tableHeight + 0.05, 0.12]}>
        <boxGeometry args={[0.09, 0.02, 0.13]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>

      {/* Caneca de Café "World's Best Boss" (ou clássica) */}
      <group position={[-tableWidth / 2 + 0.35, tableHeight + 0.1, 0.22]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.065, 0.055, 0.13, 16]} />
          <meshStandardMaterial color={isCeo ? '#fef08a' : '#f8fafc'} roughness={0.2} />
        </mesh>
        <mesh position={[0.07, 0, 0]}>
          <torusGeometry args={[0.04, 0.012, 8, 16]} />
          <meshStandardMaterial color={isCeo ? '#fef08a' : '#f8fafc'} />
        </mesh>
      </group>

      {/* Acessórios Especiais por Persona */}
      {accessoryType === 'RUBBER_DUCKS' && (
        <group position={[tableWidth / 2 - 0.4, tableHeight + 0.07, 0.2]}>
          <mesh castShadow>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.1} />
          </mesh>
          <mesh position={[0.045, 0.02, 0]}>
            <coneGeometry args={[0.02, 0.04, 8]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
        </group>
      )}

      {accessoryType === 'HEADPHONES' && (
        <group position={[tableWidth / 2 - 0.4, tableHeight + 0.06, 0.15]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.075, 0.02, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#ef4444" metalness={0.7} />
          </mesh>
        </group>
      )}

      {accessoryType === 'CLIPBOARD' && (
        <mesh position={[tableWidth / 2 - 0.45, tableHeight + 0.05, 0.18]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <planeGeometry args={[0.24, 0.32]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
      )}

      {/* Cadeira Ergonômica Giratória */}
      <group position={[0, 0, 0.7]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.55, 0.08, 0.55]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        <mesh position={[0, 0.85, -0.24]} castShadow>
          <boxGeometry args={[0.55, 0.7, 0.08]} />
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

// 4. O Clássico Bebedouro / Watercooler (The Office Style)
export const ClassicWatercooler: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Corpo Branco do Bebedouro */}
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 1.3, 0.45]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
      </mesh>
      {/* Bandeja de Copos */}
      <mesh position={[0, 0.75, 0.24]}>
        <boxGeometry args={[0.25, 0.08, 0.1]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Garrafão Azul Translúcido de 20L de Água */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.55, 24]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.8}
          opacity={0.6}
          transparent
          roughness={0.1}
          ior={1.33}
        />
      </mesh>
      {/* Ponto de luz da água */}
      <pointLight color="#38bdf8" intensity={0.5} distance={1.8} position={[0, 1.5, 0.3]} />
    </group>
  );
};

// 5. Sala de Reunião com Holograma Giratório Animado
export const MeetingRoomArea: React.FC = () => {
  const holoRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (holoRef.current) {
      holoRef.current.rotation.y = t * 0.9;
      holoRef.current.position.y = 1.4 + Math.sin(t * 2) * 0.06;
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 1.3;
      ring1Ref.current.rotation.z = t * 0.6;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -t * 1.1;
      ring2Ref.current.rotation.x = t * 0.8;
    }
  });

  return (
    <group position={[11, 0, -8]}>
      {/* Mesa de Vidro Oval de Conferência */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.3, 2.3, 0.08, 32]} />
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

      {/* Holograma 3D Flutuante e Animado */}
      <group ref={holoRef} position={[0, 1.4, 0]}>
        <mesh>
          <octahedronGeometry args={[0.24, 0]} />
          <meshBasicMaterial color="#38bdf8" wireframe />
        </mesh>
        <mesh ref={ring1Ref}>
          <torusGeometry args={[0.38, 0.012, 8, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
        </mesh>
        <mesh ref={ring2Ref}>
          <torusGeometry args={[0.48, 0.012, 8, 24]} />
          <meshBasicMaterial color="#818cf8" transparent opacity={0.45} />
        </mesh>
      </group>

      <pointLight color="#38bdf8" intensity={1.5} distance={4.2} position={[0, 1.5, 0]} />
    </group>
  );
};

// 6. Área de Café & Lounge com Vapor Animado em Múltiplas Camadas
export const LoungeCoffeeArea: React.FC = () => {
  const p1 = useRef<THREE.Mesh>(null);
  const p2 = useRef<THREE.Mesh>(null);
  const p3 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (p1.current) {
      p1.current.position.y = 1.75 + ((t * 0.5) % 0.5);
      p1.current.position.x = Math.sin(t * 3) * 0.03;
      p1.current.scale.setScalar(0.05 + ((t * 0.5) % 0.5) * 0.2);
      const mat = p1.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.6 - ((t * 0.5) % 0.5);
    }
    if (p2.current) {
      p2.current.position.y = 1.75 + (((t + 0.4) * 0.5) % 0.5);
      p2.current.position.x = 0.06 + Math.cos(t * 3) * 0.03;
      p2.current.scale.setScalar(0.05 + (((t + 0.4) * 0.5) % 0.5) * 0.2);
      const mat = p2.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.6 - (((t + 0.4) * 0.5) % 0.5);
    }
    if (p3.current) {
      p3.current.position.y = 1.75 + (((t + 0.8) * 0.5) % 0.5);
      p3.current.position.x = -0.05 + Math.sin(t * 2.5) * 0.03;
      p3.current.scale.setScalar(0.05 + (((t + 0.8) * 0.5) % 0.5) * 0.2);
      const mat = p3.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = 0.6 - (((t + 0.8) * 0.5) % 0.5);
    }
  });

  return (
    <group position={[-12, 0, 0]}>
      {/* Balcão da Cafeteria */}
      <mesh position={[0, 0.85, -2]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.9, 1.0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      {/* Máquina de Café Expresso com LEDs */}
      <mesh position={[0, 1.45, -2]} castShadow>
        <boxGeometry args={[0.75, 0.55, 0.5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Partículas de Vapor Animadas com Swirl em 3 Camadas */}
      <mesh ref={p1} position={[0, 1.75, -1.9]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      <mesh ref={p2} position={[0.06, 1.75, -1.9]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
      <mesh ref={p3} position={[-0.05, 1.75, -1.9]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>

      <pointLight color="#fbbf24" intensity={0.7} distance={2.0} position={[0, 1.5, -1.7]} />

      {/* Sofá de Couro no Lounge */}
      <group position={[0, 0, 1.5]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[2.5, 0.4, 0.95]} />
          <meshStandardMaterial color="#451a03" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0.4]} castShadow>
          <boxGeometry args={[2.5, 0.5, 0.2]} />
          <meshStandardMaterial color="#451a03" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};

// 7. Plantas Decorativas de Escritório com Brisa Animada
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
