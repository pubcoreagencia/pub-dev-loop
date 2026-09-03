import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface TurntableVinylProps {
  isPlaying?: boolean;
  labelColor?: string;
  albumTitle?: string;
  onClick?: () => void;
}

export const TurntableVinyl: React.FC<TurntableVinylProps> = ({
  isPlaying = false,
  labelColor = '#38bdf8',
  albumTitle = 'Midnight Compile Session',
  onClick,
}) => {
  const discRef = useRef<THREE.Mesh>(null);
  const armGroupRef = useRef<THREE.Group>(null);
  const needleLightRef = useRef<THREE.PointLight>(null);
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);
  const wave3Ref = useRef<THREE.Mesh>(null);
  const wave4Ref = useRef<THREE.Mesh>(null);

  // Rotação contínua do disco, interpolação física do braço e ondas sonoras
  useFrame((_, delta) => {
    // 1. Rotação a 33 RPM
    if (isPlaying && discRef.current) {
      discRef.current.rotation.y += delta * 4.2;
    }

    // 2. Movimento físico nítido e visível do braço da agulha (Tonearm)
    if (armGroupRef.current) {
      // Quando tocando: gira para cima do disco (0.55 rad) e desce a agulha (-0.12 rad)
      // Quando parado: sobe a agulha (0.12 rad) e recolhe para o suporte de repouso (-0.2 rad)
      const targetRotY = isPlaying ? 0.55 : -0.2;
      const targetRotZ = isPlaying ? -0.12 : 0.12;
      armGroupRef.current.rotation.y = THREE.MathUtils.lerp(armGroupRef.current.rotation.y, targetRotY, delta * 5);
      armGroupRef.current.rotation.z = THREE.MathUtils.lerp(armGroupRef.current.rotation.z, targetRotZ, delta * 5);
    }

    // 3. LED da agulha muda de cor e intensidade
    if (needleLightRef.current) {
      needleLightRef.current.color.set(isPlaying ? '#22c55e' : '#ef4444');
      needleLightRef.current.intensity = isPlaying ? 1.5 : 0.4;
    }

    // 4. Ondas sonoras volumétricas pulsando das caixas de som
    const t = Date.now() * 0.006;
    if (wave1Ref.current) {
      const s1 = 0.6 + ((t * 1.6) % 2.4);
      wave1Ref.current.scale.set(s1, s1, s1);
      wave1Ref.current.position.z = 0.25 + ((t * 0.8) % 1.5);
      const mat = wave1Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.9 - (s1 / 2.8)) : 0;
    }
    if (wave2Ref.current) {
      const s2 = 0.6 + (((t + 0.5) * 1.6) % 2.4);
      wave2Ref.current.scale.set(s2, s2, s2);
      wave2Ref.current.position.z = 0.25 + (((t + 0.5) * 0.8) % 1.5);
      const mat = wave2Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.9 - (s2 / 2.8)) : 0;
    }
    if (wave3Ref.current) {
      const s3 = 0.6 + ((t * 1.6) % 2.4);
      wave3Ref.current.scale.set(s3, s3, s3);
      wave3Ref.current.position.z = 0.25 + ((t * 0.8) % 1.5);
      const mat = wave3Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.9 - (s3 / 2.8)) : 0;
    }
    if (wave4Ref.current) {
      const s4 = 0.6 + (((t + 0.5) * 1.6) % 2.4);
      wave4Ref.current.scale.set(s4, s4, s4);
      wave4Ref.current.position.z = 0.25 + (((t + 0.5) * 0.8) % 1.5);
      const mat = wave4Ref.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = isPlaying ? Math.max(0, 0.9 - (s4 / 2.8)) : 0;
    }
  });

  return (
    <group position={[-12, 0, 0]} onClick={onClick}>
      {/* Placa Indicativa Flutuante no 3D */}
      <Html position={[0, 2.3, 0]} center distanceFactor={12}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: `1.5px solid ${labelColor}`,
            borderRadius: '6px',
            padding: '3px 10px',
            color: '#f8fafc',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
          }}
        >
          <span>{isPlaying ? '▶' : '⏸'}</span>
          <span style={{ color: labelColor }}>{albumTitle}</span>
          <span style={{ fontSize: '9px', background: isPlaying ? '#22c55e' : '#64748b', color: '#000', padding: '1px 4px', borderRadius: '3px' }}>
            {isPlaying ? 'TOCANDO' : 'PAUSADO'}
          </span>
        </div>
      </Html>

      {/* Móvel de Madeira Maciça Nobre com Prateleiras */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 1.0, 1.1]} />
        <meshStandardMaterial color="#3b1f14" roughness={0.5} />
      </mesh>

      {/* Prateleira com Discos de Vinil Verticais */}
      <mesh position={[0, 0.35, 0.48]} castShadow>
        <boxGeometry args={[1.4, 0.58, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Chassi Metálico Superior da Vitrola */}
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[1.2, 0.09, 0.9]} />
        <meshStandardMaterial color="#18181b" metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Prato Giratório Metálico (Platter) */}
      <mesh position={[-0.15, 1.1, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.025, 32]} />
        <meshStandardMaterial color="#3f3f46" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Disco de Vinil Preto com Ranhuras e Rotação */}
      <mesh ref={discRef} position={[-0.15, 1.125, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.015, 32]} />
        <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.5} />
      </mesh>

      {/* RÓTULO CENTRAL DO VINIL (Muda de cor instantaneamente ao selecionar álbum) */}
      <mesh position={[-0.15, 1.135, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 32]} />
        <meshBasicMaterial color={labelColor} />
      </mesh>
      {/* Pino Central Prateado */}
      <mesh position={[-0.15, 1.155, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.04, 16]} />
        <meshStandardMaterial color="#e4e4e7" metalness={0.95} />
      </mesh>

      {/* BRAÇO DA AGULHA FÍSICO (Tonearm Mecânico Articulado) */}
      <group ref={armGroupRef} position={[0.34, 1.14, 0.26]}>
        {/* Base Pivô Metálica de Rotação */}
        <mesh>
          <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
          <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Haste Longa de Alumínio Escovado */}
        <mesh position={[-0.26, 0.04, -0.26]} rotation={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.52, 12]} />
          <meshStandardMaterial color="#e4e4e7" metalness={0.95} roughness={0.1} />
        </mesh>
        {/* Cabeçote / Cápsula da Agulha (Cartridge) */}
        <mesh position={[-0.45, 0.02, -0.45]}>
          <boxGeometry args={[0.05, 0.035, 0.08]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} />
        </mesh>
        {/* LED indicador de status na agulha */}
        <mesh position={[-0.45, 0.04, -0.45]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshBasicMaterial color={isPlaying ? '#22c55e' : '#ef4444'} />
        </mesh>
        <pointLight ref={needleLightRef} distance={1.2} intensity={1.5} position={[-0.45, 0.08, -0.45]} />
      </group>

      {/* Suporte de Repouso da Agulha */}
      <mesh position={[0.34, 1.12, -0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
        <meshStandardMaterial color="#52525b" metalness={0.8} />
      </mesh>

      {/* Amplificador Valvulado com Válvulas Brilhantes */}
      <group position={[0.72, 1.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.18, 0.55]} />
          <meshStandardMaterial color="#09090b" metalness={0.8} />
        </mesh>
        {/* Válvula de Vidro */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
          <meshPhysicalMaterial color="#f59e0b" transmission={0.7} opacity={0.6} transparent />
        </mesh>
        <pointLight color="#f59e0b" intensity={isPlaying ? 1.8 : 0.3} distance={2.8} position={[0, 0.25, 0]} />
      </group>

      {/* Caixa de Som Acústica Esquerda */}
      <group position={[-1.35, 0.65, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 1.05, 0.48]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {/* Cone da Caixa de Som */}
        <mesh position={[0, 0.12, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.09, 0.05, 24]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} />
        </mesh>
        {/* Ondas Sonoras Visuais Pulsantes (Esquerda) */}
        <mesh ref={wave1Ref} position={[0, 0.12, 0.28]}>
          <ringGeometry args={[0.18, 0.25, 24]} />
          <meshBasicMaterial color={labelColor} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wave2Ref} position={[0, 0.12, 0.28]}>
          <ringGeometry args={[0.26, 0.35, 24]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Caixa de Som Acústica Direita */}
      <group position={[1.35, 0.65, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.48, 1.05, 0.48]} />
          <meshStandardMaterial color="#3b1f14" roughness={0.7} />
        </mesh>
        {/* Cone da Caixa de Som */}
        <mesh position={[0, 0.12, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.09, 0.05, 24]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} />
        </mesh>
        {/* Ondas Sonoras Visuais Pulsantes (Direita) */}
        <mesh ref={wave3Ref} position={[0, 0.12, 0.28]}>
          <ringGeometry args={[0.18, 0.25, 24]} />
          <meshBasicMaterial color={labelColor} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={wave4Ref} position={[0, 0.12, 0.28]}>
          <ringGeometry args={[0.26, 0.35, 24]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};
