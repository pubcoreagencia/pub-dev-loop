import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AvatarProfile, EmployeeOperationalState } from '../types/office';

interface Office3DAvatarProps {
  position: [number, number, number];
  avatar: AvatarProfile;
  operationalState: EmployeeOperationalState;
  isCeo?: boolean;
  speechBubble?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export const Office3DAvatar: React.FC<Office3DAvatarProps> = ({
  position,
  avatar,
  operationalState,
  isCeo = false,
  speechBubble,
  isSelected = false,
  onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  // Animação procedural suave
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Balanço sutil de respiração/idle
    if (headRef.current) {
      headRef.current.position.y = 1.35 + Math.sin(t * 2) * 0.015;
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.08;
    }

    // Digitação frenética quando trabalhando
    if (operationalState === 'working' || operationalState === 'reviewing') {
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.7 + Math.sin(t * 14) * 0.12;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.7 + Math.cos(t * 14) * 0.12;
    } else {
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.3 + Math.sin(t * 1.5) * 0.03;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.3 + Math.cos(t * 1.5) * 0.03;
    }
  });

  const suitColor = avatar.suitColor || (isCeo ? '#1e1b4b' : '#1e293b');
  const hairColor = avatar.hairColor || '#0f172a';
  const skinColor = '#fed7aa';

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      {/* Luz focal e halo de seleção quando clicado */}
      {isSelected && (
        <pointLight color={avatar.accentColor} intensity={2.0} distance={3.0} position={[0, 2.0, 0]} />
      )}

      {/* Tronco / Corpo com Terno/Roupa da Persona */}
      <mesh position={[0, 0.85, 0.2]} castShadow>
        <boxGeometry args={[0.55, 0.7, 0.35]} />
        <meshStandardMaterial color={suitColor} roughness={0.7} />
      </mesh>

      {/* Gravata / Detalhe Central */}
      <mesh position={[0, 0.88, 0.38]}>
        <boxGeometry args={[0.1, 0.45, 0.02]} />
        <meshStandardMaterial color={avatar.tieColor || avatar.accentColor} roughness={0.3} />
      </mesh>

      {/* Braço Esquerdo */}
      <mesh ref={leftArmRef} position={[-0.35, 0.85, 0.15]} castShadow>
        <boxGeometry args={[0.15, 0.55, 0.15]} />
        <meshStandardMaterial color={suitColor} />
      </mesh>

      {/* Braço Direito */}
      <mesh ref={rightArmRef} position={[0.35, 0.85, 0.15]} castShadow>
        <boxGeometry args={[0.15, 0.55, 0.15]} />
        <meshStandardMaterial color={suitColor} />
      </mesh>

      {/* Cabeça e Cabelo */}
      <group ref={headRef} position={[0, 1.35, 0.15]}>
        {/* Rosto */}
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.42, 0.38]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Cabelo */}
        <mesh position={[0, 0.15, -0.04]}>
          <boxGeometry args={[0.46, 0.22, 0.42]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>
        {/* Olhos estilizados */}
        <mesh position={[-0.1, 0, -0.2]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshBasicMaterial color="#090d16" />
        </mesh>
        <mesh position={[0.1, 0, -0.2]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshBasicMaterial color="#090d16" />
        </mesh>

        {/* Óculos para Dr. Arthur / Helena */}
        {(avatar.accessory === '👓' || avatar.avatarId.includes('architect') || avatar.avatarId.includes('chief')) && (
          <mesh position={[0, 0, -0.21]}>
            <boxGeometry args={[0.32, 0.08, 0.02]} />
            <meshStandardMaterial color="#d97706" metalness={0.9} />
          </mesh>
        )}
      </group>

      {/* Placa de Identificação Flutuante em 3D */}
      <Html position={[0, 2.1, 0]} center distanceFactor={14}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.88)',
            border: `1.5px solid ${avatar.accentColor}`,
            borderRadius: '6px',
            padding: '3px 8px',
            color: '#f8fafc',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={onClick}
        >
          <span>{avatar.badgeIcon}</span>
          <span>{avatar.displayName}</span>
          <span
            style={{
              fontSize: '9px',
              padding: '1px 4px',
              borderRadius: '3px',
              background: avatar.accentColor,
              color: '#000',
              fontWeight: 700,
            }}
          >
            {operationalState.toUpperCase()}
          </span>
        </div>
      </Html>

      {/* Balão de Fala 3D quando houver mensagem */}
      {speechBubble && (
        <Html position={[0, 2.7, 0]} center distanceFactor={12}>
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#f8fafc',
              fontSize: '12px',
              maxWidth: '220px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              animation: 'popIn 0.2s ease-out',
            }}
          >
            💬 {speechBubble}
          </div>
        </Html>
      )}
    </group>
  );
};
