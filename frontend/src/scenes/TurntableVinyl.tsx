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
  const armGroupRef = useRef<THREE.Group>(null);
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);
  const wave3Ref = useRef<THREE.Mesh>(null);
  const wave4Ref = useRef<THREE.Mesh>(null);

  // Rotação do disco, movimento físico do braço e ondas sonoras pulsantes
  useFrame((_, delta) => {
    // 1. Rotação do disco
    if (isPlaying && discRef.current) {
      discRef.current.rotation.y += delta * 3.5;
    }

    // 2. Movimento físico do braço da agulha (Tonearm)
    if (armGroupRef.current) {
      const targetRotY = isPlaying ? 0.42 : -0.05;
      const targetRotZ = isPlaying ? -0.04 : 0.08;
      armGroupRef.current.rotation.y = THREE.MathUtils.lerp(armGroupRef.current.rotation.y, targetRotY, delta * 4);
      armGroupRef.current.rotation.z = THREE.MathUtils.lerp(armGroupRef.current.rotation.z, targetRotZ, delta * 4);
    }

    // 3. Ondas sonoras volumétricas pulsando das caixas de som
    const t = Date.now() * 0.005;
    if (wave1Ref.current) {
      const s1 = 0.5 + ((t * 1.5) % 2.0);
      wave1Ref.current.scale.set(s1, s1, s1);
      wave1Ref.current.position.z = 0.25 + ((t * 0.5) % 1.2);
      const mat = wave1Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.8 - (s1 / 2.5)) : 0;
    }
    if (wave2Ref.current) {
      const s2 = 0.5 + (((t + 0.6) * 1.5) % 2.0);
      wave2Ref.current.scale.set(s2, s2, s2);
      wave2Ref.current.position.z = 0.25 + (((t + 0.6) * 0.5) % 1.2);
      const mat = wave2Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.8 - (s2 / 2.5)) : 0;
    }
    if (wave3Ref.current) {
      const s3 = 0.5 + ((t * 1.5) % 2.0);
      wave3Ref.current.scale.set(s3, s3, s3);
      wave3Ref.current.position.z = 0.25 + ((t * 0.5) % 1.2);
      const mat = wave3Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.8 - (s3 / 2.5)) : 0;
    }
    if (wave4Ref.current) {
      const s4 = 0.5 + (((t + 0.6) * 1.5) % 2.0);
      wave4Ref.current.scale.set(s4, s4, s4);
      wave4Ref.current.position.z = 0.25 + (((t + 0.6) * 0.5) % 1.2);
      const mat = wave4Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.8 - (s4 / 2.5)) : 0;
    }
  });

  return (
    <group position={[-12, 0, -2]} onClick={onClick}>
      {/* Móvel Vintage de Madeira Nobre para o Toca-Discos */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.0, 1.0]} />
        <meshStandardMaterial color="#3b1f14" roughness={0.6} />
      </mesh>

      {/* Prateleira com Discos de Vinil Verticais Coloridos */}
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

      {/* Disco de Vinil Preto com Ranhuras e Rotação */}
      <mesh ref={discRef} position={[-0.1, 1.11, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.01, 32]} />
        <meshStandardMaterial color="#09090b" roughness={0.15} metalness={0.5} />
      </mesh>

      {/* Rótulo Central do Vinil (Selo Dinâmico por Álbum) */}
      <mesh position={[-0.1, 1.12, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.012, 32]} />
        <meshBasicMaterial color={labelColor} />
      </mesh>

      {/* Braço Físico Articulado da Agulha (Tonearm) */}
      <group ref={armGroupRef} position={[0.3, 1.12, 0.22]}>
        {/* Base Pivô Metálica */}
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 16]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} />
        </mesh>
        {/* Haste Longa em L apontando para o sulco */}
        <mesh position={[-0.22, 0.03, -0.22]} rotation={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.45, 8]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.9} />
        </mesh>
        {/* Cabeçote / Cápsula da Agulha com LED indicador */}
        <mesh position={[-0.38, 0.02, -0.38]}>
          <boxGeometry args={[0.04, 0.03, 0.06]} />
          <meshStandardMaterial color="#ef4444" metalness={0.7} />
        </mesh>
      </group>

      {/* Amplificador Valvulado Vintage com LEDs Quentes */}
      <mesh position={[0.7, 1.08, 0]} castShadow>
        <boxGeometry args={[0.3, 0.16, 0.5]} />
        <meshStandardMaterial color="#09090b" metalness={0.7} />
      </mesh>
      <pointLight color="#f59e0b" intensity={isPlaying ? 1.6 : 0.2} distance={2.5} position={[0.7, 1.25, 0]} />

      {/* Caixa de Som Acústica Esquerda */}
      <group position={[-1.2, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.45, 0.95, 0.45]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {/* Cone da Caixa de Som */}
        <mesh position={[0, 0.1, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.08, 0.04, 24]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} />
        </mesh>
        {/* Ondas Sonoras Visuais Pulsantes (Caixa Esquerda) */}
        <mesh ref={wave1Ref} position={[0, 0.1, 0.25]}>
          <ringGeometry args={[0.16, 0.22, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wave2Ref} position={[0, 0.1, 0.25]}>
          <ringGeometry args={[0.22, 0.30, 24]} />
          <meshBasicMaterial color="#818cf8" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Caixa de Som Acústica Direita */}
      <group position={[1.2, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.45, 0.95, 0.45]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {/* Cone da Caixa de Som */}
        <mesh position={[0, 0.1, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.08, 0.04, 24]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} />
        </mesh>
        {/* Ondas Sonoras Visuais Pulsantes (Caixa Direita) */}
        <mesh ref={wave3Ref} position={[0, 0.1, 0.25]}>
          <ringGeometry args={[0.16, 0.22, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wave4Ref} position={[0, 0.1, 0.25]}>
          <ringGeometry args={[0.22, 0.30, 24]} />
          <meshBasicMaterial color="#818cf8" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
