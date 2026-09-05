import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { PubRecLogo } from '../components/PubRecLogo';

interface OfficeAuditoriumProps {
  position?: [number, number, number];
}

export const OfficeAuditorium: React.FC<OfficeAuditoriumProps> = ({
  position = [0, 0, 0],
}) => {
  const isConferenceActive = useStore((s) => s.isConferenceActive);
  const conferenceTopic = useStore((s) => s.conferenceTopic);
  const screenGlowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (screenGlowRef.current) {
      const t = clock.getElapsedTime();
      screenGlowRef.current.intensity = isConferenceActive
        ? 2.8 + Math.sin(t * 3) * 0.4
        : 1.4 + Math.sin(t * 1.5) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* 1. PISO DO AUDITÓRIO & PALCO (Carpete Nobre Azul Índigo Escuro) */}
      <mesh position={[0, 0.012, 23.5]} receiveShadow>
        <boxGeometry args={[26, 0.02, 20]} />
        <meshStandardMaterial color="#0b132b" roughness={0.8} />
      </mesh>

      {/* Bordadura Dourada Externa do Auditório */}
      <mesh position={[0, 0.016, 23.5]} receiveShadow>
        <boxGeometry args={[26.4, 0.015, 20.4]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* 2. PALCO ELEVADO DE EVENTOS (Frente para o Auditório e Fundo Sul) */}
      <group position={[0, 0, 29]}>
        {/* Base Principal do Palco em Madeira Nobre Escura */}
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 0.72, 5.8]} />
          <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.2} />
        </mesh>

        {/* Piso Superior do Palco Envernizado */}
        <mesh position={[0, 0.73, 0]} receiveShadow>
          <boxGeometry args={[23.6, 0.02, 5.4]} />
          <meshStandardMaterial color="#381b0d" roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Degraus Frontais de Acesso ao Palco */}
        <mesh position={[0, 0.18, -3.1]} castShadow receiveShadow>
          <boxGeometry args={[8, 0.36, 0.8]} />
          <meshStandardMaterial color="#27272a" roughness={0.5} />
        </mesh>

        {/* Fita de LED Neon na Borda Frontal do Palco */}
        <mesh position={[0, 0.74, -2.71]}>
          <boxGeometry args={[23.8, 0.04, 0.06]} />
          <meshBasicMaterial color={isConferenceActive ? '#38bdf8' : '#e11d48'} />
        </mesh>

        {/* 3. TELÃO GIGANTE DE LED (Backdrop com PUB REC e Logo Oficial - Voltado para o Norte) */}
        <group position={[0, 3.4, 2.2]}>
          {/* Moldura de Alumínio Escovado do Telão */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[18.4, 4.8, 0.2]} />
            <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.8} />
          </mesh>

          {/* Painel de LED Frontal */}
          <mesh position={[0, 0, -0.11]}>
            <boxGeometry args={[17.8, 4.4, 0.02]} />
            <meshBasicMaterial color="#030712" />
          </mesh>

          {/* Luz emissiva do telão iluminando o palco e a plateia */}
          <pointLight
            ref={screenGlowRef}
            position={[0, 0, -1.2]}
            color={isConferenceActive ? '#38bdf8' : '#f43f5e'}
            distance={14}
            intensity={2.0}
          />

          {/* Conteúdo Interativo do Telão em HTML 3D voltado para a plateia */}
          <Html
            position={[0, 0, -0.13]}
            rotation={[0, Math.PI, 0]}
            transform
            distanceFactor={5.2}
            scale={0.4}
            style={{
              width: '940px',
              height: '460px',
              background: 'radial-gradient(ellipse at center, #111827 0%, #030712 100%)',
              border: '2px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px',
              boxSizing: 'border-box',
              color: '#ffffff',
              boxShadow: 'inset 0 0 60px rgba(56, 189, 248, 0.25)',
              userSelect: 'none',
            }}
          >
            {/* Top Status Bar */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ height: '10px', width: '10px', borderRadius: '50%', background: isConferenceActive ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
                <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {isConferenceActive ? '🔴 AUDITÓRIO AO VIVO • SESSÃO ESTRATÉGICA' : 'PAINEL CENTRAL PUB REC'}
                </span>
              </div>
              <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                {new Date().toLocaleTimeString('pt-BR')} • AUDITÓRIO MASTER
              </span>
            </div>

            {/* Logo Oficial PUB REC Centralizada */}
            <div style={{ transform: 'scale(1.25)', margin: '12px 0' }}>
              <PubRecLogo size="lg" variant="light" showSubtitle showGridLines />
            </div>

            {/* Bottom Directive / Topic */}
            <div style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', letterSpacing: '0.08em' }}>
                {isConferenceActive ? 'DIRETIVA EXECUTIVA EM DISCUSSÃO' : 'STATUS DO AUDITÓRIO & CONFERÊNCIA'}
              </span>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 0 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {conferenceTopic || 'Todos os especialistas posicionados na plateia • Auditório pronto'}
              </p>
            </div>
          </Html>
        </group>

        {/* 4. PÚLPITO DE EVENTOS (Podium do Orador / CEO no Centro do Palco voltado para a plateia) */}
        <group position={[0, 0.72, -1.2]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[1.2, 1.1, 0.8]} />
            <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 1.11, 0]} rotation={[-0.2, 0, 0]} receiveShadow>
            <boxGeometry args={[1.3, 0.05, 0.9]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.8} />
          </mesh>
          {/* Microfones Duplos no Púlpito apontando para o orador */}
          <mesh position={[-0.2, 1.3, 0.1]} rotation={[-0.3, 0.1, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
          <mesh position={[0.2, 1.3, 0.1]} rotation={[-0.3, -0.1, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
          {/* Logo PUB REC na face frontal do púlpito (olhando para a plateia -Z) */}
          <Html position={[0, 0.6, -0.42]} rotation={[0, Math.PI, 0]} transform scale={0.12} center style={{ pointerEvents: 'none' }}>
            <PubRecLogo size="sm" variant="light" showSubtitle={false} showGridLines={false} />
          </Html>
        </group>
      </group>

      {/* 5. PLATEIA DO AUDITÓRIO (Fileiras de Cadeiras Voltadas de Frente para o Palco no Sul +Z) */}
      <group position={[0, 0, 0]}>
        {[22.5, 19.5, 16.5, 13.5].map((zRow, rIdx) => (
          <group key={rIdx} position={[0, 0, zRow]}>
            {[-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8].map((xChair, cIdx) => (
              <group key={cIdx} position={[xChair, 0, 0]}>
                {/* Assento Acolchoado Azul Corporativo */}
                <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.7, 0.12, 0.62]} />
                  <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
                </mesh>
                {/* Encosto Ergonômico com Inclinação para Trás (ao Norte) para olhar para o Sul (+Z) */}
                <mesh position={[0, 0.85, -0.27]} rotation={[0.1, 0, 0]} castShadow>
                  <boxGeometry args={[0.7, 0.7, 0.1]} />
                  <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
                </mesh>
                {/* Pés Metálicos */}
                <mesh position={[-0.28, 0.22, -0.22]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.44]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[0.28, 0.22, -0.22]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.44]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[-0.28, 0.22, 0.22]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.44]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[0.28, 0.22, 0.22]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.44]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>

      {/* 6. ILUMINAÇÃO DE FOCO (Canhões de Luz para o Palco) */}
      <spotLight
        position={[0, 9, 20]}
        target-position={[0, 1.2, 29]}
        angle={0.65}
        penumbra={0.6}
        intensity={isConferenceActive ? 3.8 : 2.0}
        color="#ffffff"
        castShadow
      />
    </group>
  );
};
