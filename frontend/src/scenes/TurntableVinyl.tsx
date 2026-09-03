import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TurntableVinylProps {
  isPlaying?: boolean;
  onClick?: () => void;
}

export const TurntableVinyl: React.FC<TurntableVinylProps> = ({ isPlaying = true, onClick }) => {
  const discRef = useRef<THREE.Mesh>(null);

  // Animação de rotação do disco de vinil a 33 RPM
  useFrame((_, delta) => {
    if (isPlaying && discRef.current) {
      discRef.current.rotation.y += delta * 2.2;
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

      {/* Rótulo Central do Vinil (Selo Dourado) */}
      <mesh position={[-0.1, 1.12, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.012, 32]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {/* Braço da Agulha (Tonearm) */}
      <group position={[0.32, 1.12, 0.2]}>
        {/* Base do Braço */}
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 16]} />
          <meshStandardMaterial color="#a1a1aa" metalness={0.9} />
        </mesh>
        {/* Haste do Braço apontando para o disco */}
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
      {/* Válvulas brilhando com luz âmbar suave */}
      <pointLight color="#f59e0b" intensity={isPlaying ? 1.0 : 0.2} distance={2.0} position={[0.7, 1.25, 0]} />

      {/* Caixa de Som Acústica Esquerda */}
      <mesh position={[-1.2, 0.6, 0]} castShadow>
        <boxGeometry args={[0.4, 0.9, 0.4]} />
        <meshStandardMaterial color="#3b1f14" roughness={0.7} />
      </mesh>
      {/* Caixa de Som Acústica Direita */}
      <mesh position={[1.2, 0.6, 0]} castShadow>
        <boxGeometry args={[0.4, 0.9, 0.4]} />
        <meshStandardMaterial color="#3b1f14" roughness={0.7} />
      </mesh>
    </group>
  );
};
