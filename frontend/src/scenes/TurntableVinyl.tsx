import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TurntableVinylProps {
  isPlaying?: boolean;
  labelColor?: string;
  onClick?: () => void;
}

export const TurntableVinyl: React.FC<TurntableVinylProps> = ({
  isPlaying = true,
  labelColor = '#38bdf8',
  onClick,
}) => {
  const discRef = useRef<THREE.Mesh>(null);
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);

  // Rotação do disco e ondas sonoras
  useFrame((_, delta) => {
    if (isPlaying && discRef.current) {
      discRef.current.rotation.y += delta * 2.4;
    }
    if (isPlaying && wave1Ref.current) {
      const s = 1 + (Math.sin(Date.now() * 0.006) + 1) * 0.2;
      wave1Ref.current.scale.set(s, s, s);
    }
    if (isPlaying && wave2Ref.current) {
      const s = 1 + (Math.cos(Date.now() * 0.006) + 1) * 0.2;
      wave2Ref.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={[-12, 0, -2]} onClick={onClick}>
      {/* Móvel Vintage de Madeira Nobre para o Toca-Discos */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.0, 1.0]} />
        <meshStandardMaterial color="#3b1f14" roughness={0.6} />
      </mesh>

      {/* Prateleira com Discos de Vinil Verticais */}
      <mesh position={[0, 0.35, 0.45]} castShadow>
        <boxGeometry args={[1.3, 0.55, 0.05]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Base Metálica do Toca-Discos */}
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.8]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Prato Giratório Metálico */}
      <mesh position={[-0.1, 1.09, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.02, 32]} />
        <meshStandardMaterial color="#27272a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Disco de Vinil Preto com Rotação */}
      <mesh ref={discRef} position={[-0.1, 1.11, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.01, 32]} />
        <meshStandardMaterial color="#09090b" roughness={0.15} metalness={0.4} />
      </mesh>

      {/* Rótulo Central do Vinil (Selo Dinâmico por Álbum) */}
      <mesh position={[-0.1, 1.12, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.012, 32]} />
        <meshBasicMaterial color={labelColor} />
      </mesh>

      {/* Braço da Agulha (Tonearm) */}
      <group position={[0.32, 1.12, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} />
        </mesh>
        <mesh position={[-0.2, 0.03, -0.2]} rotation={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.4, 8]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} />
        </mesh>
      </group>

      {/* Amplificador Valvulado com LEDs Quentes */}
      <mesh position={[0.7, 1.08, 0]} castShadow>
        <boxGeometry args={[0.3, 0.16, 0.5]} />
        <meshStandardMaterial color="#09090b" metalness={0.7} />
      </mesh>
      <pointLight color="#f59e0b" intensity={isPlaying ? 1.2 : 0.2} distance={2.5} position={[0.7, 1.25, 0]} />

      {/* Caixa de Som Acústica Esquerda */}
      <group position={[-1.2, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.9, 0.4]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {isPlaying && (
          <mesh ref={wave1Ref} position={[0, 0.2, 0.22]}>
            <ringGeometry args={[0.08, 0.12, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Caixa de Som Acústica Direita */}
      <group position={[1.2, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.9, 0.4]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {isPlaying && (
          <mesh ref={wave2Ref} position={[0, 0.2, 0.22]}>
            <ringGeometry args={[0.08, 0.12, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  );
};
