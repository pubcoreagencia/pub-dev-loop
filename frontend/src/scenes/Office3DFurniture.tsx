import React from 'react';

// 1. Chão e Tapete do Escritório
export const OfficeFloor: React.FC = () => {
  return (
    <group>
      {/* Piso Principal de Madeira Escura / Concreto Tecnológico */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[36, 28]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Grid sutil no chão */}
      <gridHelper args={[36, 36, '#1e293b', '#1e293b']} position={[0, 0, 0]} />

      {/* Tapete Executivo da Suíte do CEO */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -8]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>

      {/* Tapete da Área de Lounge / Toca-Discos */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.01, 0]} receiveShadow>
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial color="#2d1537" roughness={0.9} />
      </mesh>
    </group>
  );
};

// 2. Paredes de Vidro e Painéis
export const OfficeWalls: React.FC = () => {
  return (
    <group>
      {/* Parede de Fundo (Norte - Atrás do CEO) */}
      <mesh position={[0, 3, -14]} receiveShadow>
        <boxGeometry args={[36, 6, 0.4]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.8} />
      </mesh>

      {/* Letreiro Neon Holográfico do PUB DEV LOOP na parede norte */}
      <mesh position={[0, 4.5, -13.7]}>
        <planeGeometry args={[10, 1.2]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>

      {/* Parede Lateral Esquerda (Oeste) */}
      <mesh position={[-18, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 28]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.8} />
      </mesh>

      {/* Parede Lateral Direita (Leste) com Janelas de Vidro */}
      <mesh position={[18, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6, 28]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.6}
          opacity={0.3}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Divisória de Vidro entre Gabinete do CEO e Área de Engenharia */}
      <mesh position={[0, 2, -4]}>
        <boxGeometry args={[24, 4, 0.1]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transmission={0.8}
          opacity={0.25}
          transparent
          roughness={0.2}
        />
      </mesh>
    </group>
  );
};

// 3. Estação de Trabalho / Mesa Individual
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
  const tableWidth = isCeo ? 3.6 : 2.4;
  const tableDepth = isCeo ? 1.6 : 1.2;
  const tableHeight = 0.9;

  return (
    <group position={position} rotation={rotation} onClick={onClick}>
      {/* Tampo da Mesa */}
      <mesh position={[0, tableHeight, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableWidth, 0.08, tableDepth]} />
        <meshStandardMaterial color={isCeo ? '#1e293b' : '#334155'} roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Pernas da Mesa */}
      <mesh position={[-tableWidth / 2 + 0.1, tableHeight / 2, -tableDepth / 2 + 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.1, tableHeight / 2, -tableDepth / 2 + 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-tableWidth / 2 + 0.1, tableHeight / 2, tableDepth / 2 - 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[tableWidth / 2 - 0.1, tableHeight / 2, tableDepth / 2 - 0.1]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, tableHeight, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Monitor Principal */}
      <group position={[0, tableHeight + 0.45, -tableDepth / 3]}>
        {/* Suporte do Monitor */}
        <mesh position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.03, 0.08, 0.4, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} />
        </mesh>
        {/* Carcaça do Monitor */}
        <mesh castShadow>
          <boxGeometry args={[isCeo ? 1.6 : 1.1, 0.65, 0.06]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} />
        </mesh>
        {/* Tela com Glow da cor do papel */}
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[isCeo ? 1.5 : 1.0, 0.55]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
        {/* Ponto de Luz Emitido pela Tela */}
        <pointLight color={glowColor} intensity={0.8} distance={2.5} position={[0, 0, 0.2]} />
      </group>

      {/* Teclado e Mouse */}
      <mesh position={[0, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.5, 0.02, 0.18]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>
      <mesh position={[0.35, tableHeight + 0.05, 0.1]}>
        <boxGeometry args={[0.08, 0.02, 0.12]} />
        <meshStandardMaterial color="#090d16" />
      </mesh>

      {/* Caneca de Café */}
      <mesh position={[-tableWidth / 2 + 0.3, tableHeight + 0.1, 0.2]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 16]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>

      {/* Acessórios Especiais por Persona */}
      {accessoryType === 'RUBBER_DUCKS' && (
        <group position={[tableWidth / 2 - 0.35, tableHeight + 0.07, 0.2]}>
          {/* Patinho de Borracha do Tiago */}
          <mesh castShadow>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.2} />
          </mesh>
          <mesh position={[0.04, 0.02, 0]}>
            <coneGeometry args={[0.02, 0.04, 8]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
        </group>
      )}

      {accessoryType === 'HEADPHONES' && (
        <group position={[tableWidth / 2 - 0.35, tableHeight + 0.06, 0.15]}>
          {/* Fones de Ouvido do Lucas */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.07, 0.02, 8, 20, Math.PI]} />
            <meshStandardMaterial color="#ef4444" metalness={0.6} />
          </mesh>
        </group>
      )}

      {accessoryType === 'CLIPBOARD' && (
        <mesh position={[tableWidth / 2 - 0.4, tableHeight + 0.05, 0.15]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <planeGeometry args={[0.22, 0.3]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
      )}

      {/* Cadeira de Escritório */}
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color={isCeo ? '#090d16' : '#1e293b'} />
        </mesh>
        <mesh position={[0, 0.8, -0.22]} castShadow>
          <boxGeometry args={[0.5, 0.65, 0.08]} />
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

// 4. Sala de Reunião & Mesa Oval
export const MeetingRoomArea: React.FC = () => {
  return (
    <group position={[11, 0, -8]}>
      {/* Mesa de Vidro Oval */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.08, 32]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.8}
          opacity={0.3}
          transparent
          roughness={0.1}
        />
      </mesh>
      {/* Base da mesa de reunião */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 0.9, 32]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Holo-Display no centro da mesa de reunião */}
      <mesh position={[0, 1.2, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial color="#38bdf8" wireframe />
      </mesh>
      <pointLight color="#38bdf8" intensity={1.2} distance={3.5} position={[0, 1.4, 0]} />
    </group>
  );
};

// 5. Área de Café & Lounge
export const LoungeCoffeeArea: React.FC = () => {
  return (
    <group position={[-12, 0, 0]}>
      {/* Balcão da Cafeteria */}
      <mesh position={[0, 0.85, -2]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.9, 1.0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      {/* Máquina de Café Expresso com LEDs */}
      <mesh position={[0, 1.45, -2]} castShadow>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>
      <pointLight color="#fbbf24" intensity={0.5} distance={1.8} position={[0, 1.5, -1.7]} />

      {/* Sofá de Couro no Lounge */}
      <group position={[0, 0, 1.5]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <boxGeometry args={[2.4, 0.4, 0.9]} />
          <meshStandardMaterial color="#451a03" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0.38]} castShadow>
          <boxGeometry args={[2.4, 0.5, 0.2]} />
          <meshStandardMaterial color="#451a03" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
};
