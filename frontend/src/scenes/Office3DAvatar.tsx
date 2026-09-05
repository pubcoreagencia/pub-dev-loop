import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { AvatarProfile, EmployeeOperationalState } from '../types/office';
import { OPERATIONAL_STATE_LABELS_PT } from '../config/officeLayout';
import { useStore } from '../store/useStore';
import { studioSynthAudio } from '../utils/StudioSynthAudio';

interface Office3DAvatarProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  conferencePosition?: [number, number, number];
  conferenceRotation?: [number, number, number];
  avatar: AvatarProfile;
  operationalState: EmployeeOperationalState;
  isCeo?: boolean;
  speechBubble?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export const Office3DAvatar: React.FC<Office3DAvatarProps> = ({
  position,
  rotation = [0, 0, 0],
  conferencePosition,
  conferenceRotation = [0, 0, 0],
  avatar,
  operationalState,
  isCeo = false,
  speechBubble,
  isSelected = false,
  onClick,
}) => {
  const isJukeboxOpen = useStore((s) => s.isJukeboxOpen);
  const isConferenceActive = useStore((s) => s.isConferenceActive);
  const isKartActive = useStore((s) => s.isKartActive);

  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  // Articulações individuais das pernas (Coxas e Canelas articuladas independentes)
  const leftLegGroupRef = useRef<THREE.Group>(null);
  const rightLegGroupRef = useRef<THREE.Group>(null);
  const leftThighRef = useRef<THREE.Group>(null);
  const rightThighRef = useRef<THREE.Group>(null);
  const leftShinRef = useRef<THREE.Group>(null);
  const rightShinRef = useRef<THREE.Group>(null);

  // Estado de controle WASD para o CEO Matheus Paes
  const [ceoKeys, setCeoKeys] = useState({ forward: false, backward: false, left: false, right: false });
  const ceoPosRef = useRef<THREE.Vector3>(new THREE.Vector3(position[0], position[1], position[2]));
  const ceoRotYRef = useRef<number>(rotation[1]);
  const [nearbyInstrument, setNearbyInstrument] = useState<string | null>(null);

  useEffect(() => {
    if (!isCeo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar se estiver digitando em input de texto ou chat
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (isKartActive || isConferenceActive) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') setCeoKeys((k) => ({ ...k, forward: true }));
      if (e.code === 'KeyS' || e.code === 'ArrowDown') setCeoKeys((k) => ({ ...k, backward: true }));
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') setCeoKeys((k) => ({ ...k, left: true }));
      if (e.code === 'KeyD' || e.code === 'ArrowRight') setCeoKeys((k) => ({ ...k, right: true }));

      // Interação musical com tecla E
      if (e.code === 'KeyE') {
        const p = ceoPosRef.current;
        // Bateria
        if (Math.hypot(p.x - (-11.5), p.z - (-8.0)) < 3.2) {
          studioSynthAudio.playDrumPattern();
        }
        // Mesa de Som
        else if (Math.hypot(p.x - 0, p.z - (-7.5)) < 2.8) {
          studioSynthAudio.playConsoleEffect();
        }
        // Sintetizador / Guitarra
        else if (Math.hypot(p.x - 4.8, p.z - (-8.5)) < 3.2) {
          studioSynthAudio.playSynthAndGuitar();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') setCeoKeys((k) => ({ ...k, forward: false }));
      if (e.code === 'KeyS' || e.code === 'ArrowDown') setCeoKeys((k) => ({ ...k, backward: false }));
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') setCeoKeys((k) => ({ ...k, left: false }));
      if (e.code === 'KeyD' || e.code === 'ArrowRight') setCeoKeys((k) => ({ ...k, right: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isCeo, isKartActive, isConferenceActive]);

  // Animação procedural completa e articulação biomecânica
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime() + (position[0] * 2.1);
    const dt = Math.min(delta, 0.1);

    if (!groupRef.current) return;
    const cur = groupRef.current.position;

    // Se é o CEO e WASD está ativo (não está na conferência e não está no kart)
    const isCeoManualWalking = isCeo && !isKartActive && !isConferenceActive &&
      (ceoKeys.forward || ceoKeys.backward || ceoKeys.left || ceoKeys.right);

    if (isCeo && !isKartActive && !isConferenceActive) {
      // Movimento WASD do CEO
      const moveSpeed = 3.6;
      let mx = (ceoKeys.right ? 1 : 0) - (ceoKeys.left ? 1 : 0);
      let mz = (ceoKeys.backward ? 1 : 0) - (ceoKeys.forward ? 1 : 0);

      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;

        ceoPosRef.current.x += mx * moveSpeed * dt;
        ceoPosRef.current.z += mz * moveSpeed * dt;

        // Limites do escritório PUB REC
        ceoPosRef.current.x = THREE.MathUtils.clamp(ceoPosRef.current.x, -20, 20);
        ceoPosRef.current.z = THREE.MathUtils.clamp(ceoPosRef.current.z, -12, 32);

        // Ângulo de caminhada
        const walkAngle = Math.atan2(mx, mz);
        ceoRotYRef.current = THREE.MathUtils.lerp(ceoRotYRef.current, walkAngle, dt * 10);
      }

      cur.x = ceoPosRef.current.x;
      cur.z = ceoPosRef.current.z;
      groupRef.current.rotation.y = ceoRotYRef.current;

      // Detectar proximidade com instrumentos do estúdio musical
      const dDrums = Math.hypot(cur.x - (-11.5), cur.z - (-8.0));
      const dConsole = Math.hypot(cur.x - 0, cur.z - (-7.5));
      const dSynth = Math.hypot(cur.x - 4.8, cur.z - (-8.5));

      if (dDrums < 3.0) setNearbyInstrument('drums');
      else if (dConsole < 2.6) setNearbyInstrument('console');
      else if (dSynth < 3.0) setNearbyInstrument('synth');
      else setNearbyInstrument(null);

      // Animação de caminhada do CEO
      if (isCeoManualWalking) {
        cur.y = Math.abs(Math.sin(clock.getElapsedTime() * 11)) * 0.08;

        // Balanço alternado dos braços
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 11) * 0.6;
        if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(clock.getElapsedTime() * 11) * 0.6;

        // Pernas verticais com passada alternada
        if (leftLegGroupRef.current) leftLegGroupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 11) * 0.65;
        if (rightLegGroupRef.current) rightLegGroupRef.current.rotation.x = -Math.sin(clock.getElapsedTime() * 11) * 0.65;

        // Pernas esticadas (coxas e canelas verticais alinhadas)
        if (leftThighRef.current) leftThighRef.current.rotation.x = 0;
        if (rightThighRef.current) rightThighRef.current.rotation.x = 0;
        if (leftShinRef.current) leftShinRef.current.rotation.x = 0;
        if (rightShinRef.current) rightShinRef.current.rotation.x = 0;
        return;
      } else {
        // CEO parado em pé ou sentado na mesa
        const isAtCeoDesk = Math.hypot(cur.x - position[0], cur.z - position[2]) < 0.4;
        if (isAtCeoDesk) {
          // Sentado na mesa de som executiva
          cur.y = position[1];
          if (leftThighRef.current) leftThighRef.current.rotation.x = -Math.PI / 2;
          if (rightThighRef.current) rightThighRef.current.rotation.x = -Math.PI / 2;
          if (leftShinRef.current) leftShinRef.current.rotation.x = Math.PI / 2;
          if (rightShinRef.current) rightShinRef.current.rotation.x = Math.PI / 2;
          if (leftLegGroupRef.current) leftLegGroupRef.current.rotation.x = 0;
          if (rightLegGroupRef.current) rightLegGroupRef.current.rotation.x = 0;
        } else {
          // Em pé livremente pelo estúdio/escritório
          cur.y = 0;
          if (leftThighRef.current) leftThighRef.current.rotation.x = 0;
          if (rightThighRef.current) rightThighRef.current.rotation.x = 0;
          if (leftShinRef.current) leftShinRef.current.rotation.x = 0;
          if (rightShinRef.current) rightShinRef.current.rotation.x = 0;
          if (leftLegGroupRef.current) leftLegGroupRef.current.rotation.x = 0;
          if (rightLegGroupRef.current) rightLegGroupRef.current.rotation.x = 0;
        }
      }
    }

    // Se é conferência ou são agentes autônomos
    const target = (isConferenceActive && conferencePosition) ? conferencePosition : position;
    const targetRot = (isConferenceActive && conferenceRotation) ? conferenceRotation : rotation;

    const dx = target[0] - cur.x;
    const dz = target[2] - cur.z;
    const dist = Math.hypot(dx, dz);
    const isWalking = dist > 0.18;

    if (isWalking) {
      // Rotação suave na direção do movimento
      const travelAngle = Math.atan2(dx, dz);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, travelAngle, dt * 7);

      // Movimento de caminhada fluida
      const walkSpeed = 3.2;
      cur.x += (dx / dist) * Math.min(dist, dt * walkSpeed);
      cur.z += (dz / dist) * Math.min(dist, dt * walkSpeed);

      // Bounce vertical de passos
      cur.y = target[1] + Math.abs(Math.sin(clock.getElapsedTime() * 11)) * 0.08;

      // Balanço alternado dos braços caminhando
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 11) * 0.55;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(clock.getElapsedTime() * 11) * 0.55;

      // Pernas verticais esticadas com passada alternada natural (Zero bug de andar sentado!)
      if (leftLegGroupRef.current) leftLegGroupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 11) * 0.65;
      if (rightLegGroupRef.current) rightLegGroupRef.current.rotation.x = -Math.sin(clock.getElapsedTime() * 11) * 0.65;

      // Destrava pernas da posição sentada
      if (leftThighRef.current) leftThighRef.current.rotation.x = 0;
      if (rightThighRef.current) rightThighRef.current.rotation.x = 0;
      if (leftShinRef.current) leftShinRef.current.rotation.x = 0;
      if (rightShinRef.current) rightShinRef.current.rotation.x = 0;
    } else {
      // Chegou no destino: acomoda suavemente
      cur.x = THREE.MathUtils.lerp(cur.x, target[0], dt * 4);
      cur.z = THREE.MathUtils.lerp(cur.z, target[2], dt * 4);
      cur.y = THREE.MathUtils.lerp(cur.y, target[1] + Math.sin(t * 1.8) * 0.012, dt * 4);

      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRot[1] + Math.sin(t * 0.6) * 0.04,
        dt * 5
      );
      groupRef.current.rotation.x = targetRot[0];
      groupRef.current.rotation.z = targetRot[2];

      // Zera rotação de passada
      if (leftLegGroupRef.current) leftLegGroupRef.current.rotation.x = 0;
      if (rightLegGroupRef.current) rightLegGroupRef.current.rotation.x = 0;

      // Se é o CEO no púlpito do auditório (fica em pé no palco com microfone)
      const isStandingAtPodium = isCeo && isConferenceActive;

      if (isStandingAtPodium) {
        // CEO em pé no palco
        if (leftThighRef.current) leftThighRef.current.rotation.x = 0;
        if (rightThighRef.current) rightThighRef.current.rotation.x = 0;
        if (leftShinRef.current) leftShinRef.current.rotation.x = 0;
        if (rightShinRef.current) rightShinRef.current.rotation.x = 0;

        // Mãos apoiadas suavemente no púlpito
        if (leftArmRef.current) leftArmRef.current.rotation.x = -0.4;
        if (rightArmRef.current) rightArmRef.current.rotation.x = -0.4;
      } else {
        // Sentado na cadeira da bancada ou na cadeira do auditório (Dobra as pernas 90 graus ergonomicamente)
        if (leftThighRef.current) leftThighRef.current.rotation.x = -Math.PI / 2;
        if (rightThighRef.current) rightThighRef.current.rotation.x = -Math.PI / 2;
        if (leftShinRef.current) leftShinRef.current.rotation.x = Math.PI / 2;
        if (rightShinRef.current) rightShinRef.current.rotation.x = Math.PI / 2;

        // Digitação dinâmica de acordo com o estado do funcionário
        if (operationalState === 'working' || operationalState === 'reviewing') {
          const typingSpeed = avatar.avatarId.includes('developer') ? 18 : 12;
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.7 + Math.sin(t * typingSpeed) * 0.14;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.7 + Math.cos(t * typingSpeed) * 0.14;
        } else if (operationalState === 'thinking' || operationalState === 'learning') {
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.4 + Math.sin(t * 1.5) * 0.05;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.9;
        } else {
          // Idle relaxado com mãos na mesa / colo
          if (leftArmRef.current) leftArmRef.current.rotation.x = -0.45 + Math.sin(t * 1.2) * 0.04;
          if (rightArmRef.current) rightArmRef.current.rotation.x = -0.45 + Math.cos(t * 1.2) * 0.04;
        }
      }
    }

    // Movimentação da cabeça
    if (headRef.current) {
      headRef.current.position.y = 1.35 + Math.sin(t * 1.8) * 0.01;
      headRef.current.rotation.y = Math.sin(t * 0.9) * 0.12;
      headRef.current.rotation.x = 0.05 + Math.sin(t * 1.4) * 0.04;
    }
  });

  const suitColor = avatar.suitColor || (isCeo ? '#1e1b4b' : '#1e293b');
  const hairColor = avatar.hairColor || '#0f172a';
  const skinColor = '#fed7aa';

  return (
    <group ref={groupRef} position={position} rotation={rotation} onClick={onClick}>
      {/* Luz focal e halo de seleção quando clicado */}
      {isSelected && (
        <pointLight color={avatar.accentColor} intensity={2.2} distance={3.2} position={[0, 2.0, 0]} />
      )}

      {/* 1. PERNAS ARTICULADAS (Zero Z-fighting / Coxa horizontal e Canela vertical quando sentado, pernas retas andando) */}
      {/* Perna Esquerda */}
      <group ref={leftLegGroupRef} position={[-0.15, 0.46, 0]}>
        {/* Coxa Articulada */}
        <group ref={leftThighRef} position={[0, 0, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <boxGeometry args={[0.16, 0.32, 0.16]} />
            <meshStandardMaterial color={suitColor} roughness={0.7} />
          </mesh>
          {/* Canela / Joelho Articulado */}
          <group ref={leftShinRef} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.14, 0]} castShadow>
              <boxGeometry args={[0.14, 0.28, 0.14]} />
              <meshStandardMaterial color={suitColor} roughness={0.7} />
            </mesh>
            {/* Sapato Clássico Oxford */}
            <mesh position={[0, -0.27, 0.04]} castShadow>
              <boxGeometry args={[0.15, 0.07, 0.22]} />
              <meshStandardMaterial color="#09090b" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Perna Direita */}
      <group ref={rightLegGroupRef} position={[0.15, 0.46, 0]}>
        {/* Coxa Articulada */}
        <group ref={rightThighRef} position={[0, 0, 0]}>
          <mesh position={[0, -0.16, 0]} castShadow>
            <boxGeometry args={[0.16, 0.32, 0.16]} />
            <meshStandardMaterial color={suitColor} roughness={0.7} />
          </mesh>
          {/* Canela / Joelho Articulado */}
          <group ref={rightShinRef} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.14, 0]} castShadow>
              <boxGeometry args={[0.14, 0.28, 0.14]} />
              <meshStandardMaterial color={suitColor} roughness={0.7} />
            </mesh>
            {/* Sapato Clássico Oxford */}
            <mesh position={[0, -0.27, 0.04]} castShadow>
              <boxGeometry args={[0.15, 0.07, 0.22]} />
              <meshStandardMaterial color="#09090b" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 2. TRONCO / CORPO COM TERNO DA PERSONA */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.55, 0.72, 0.35]} />
        <meshStandardMaterial color={suitColor} roughness={0.7} />
      </mesh>

      {/* Gravata / Camisa Social Elegante */}
      <mesh position={[0, 0.94, 0.18]}>
        <boxGeometry args={[0.18, 0.5, 0.02]} />
        <meshStandardMaterial color={avatar.shirtColor || '#ffffff'} />
      </mesh>
      <mesh position={[0, 0.88, 0.19]}>
        <boxGeometry args={[0.08, 0.4, 0.02]} />
        <meshStandardMaterial color={avatar.accentColor} metalness={0.2} roughness={0.4} />
      </mesh>

      {/* Braço Esquerdo Articulado */}
      <mesh ref={leftArmRef} position={[-0.34, 1.05, 0]} castShadow>
        <boxGeometry args={[0.12, 0.48, 0.12]} />
        <meshStandardMaterial color={suitColor} roughness={0.7} />
      </mesh>

      {/* Braço Direito Articulado */}
      <mesh ref={rightArmRef} position={[0.34, 1.05, 0]} castShadow>
        <boxGeometry args={[0.12, 0.48, 0.12]} />
        <meshStandardMaterial color={suitColor} roughness={0.7} />
      </mesh>

      {/* Mãos */}
      <mesh position={[-0.34, 0.77, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.34, 0.77, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* 3. CABEÇA E CABELO */}
      <group ref={headRef} position={[0, 1.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.34, 0.32]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Cabelo Fiel à Persona */}
        <mesh position={[0, 0.14, -0.02]} castShadow>
          <boxGeometry args={[0.36, 0.14, 0.34]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.06, -0.16]} castShadow>
          <boxGeometry args={[0.36, 0.26, 0.06]} />
          <meshStandardMaterial color={hairColor} roughness={0.9} />
        </mesh>

        {/* Óculos Intelectuais */}
        {(avatar.hasGlasses || isCeo) && (
          <group position={[0, 0.04, 0.18]}>
            <mesh position={[-0.08, 0, 0]}>
              <ringGeometry args={[0.03, 0.048, 16]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0.08, 0, 0]}>
              <ringGeometry args={[0.03, 0.048, 16]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.06, 0.015, 0.01]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
          </group>
        )}

        {/* Fone de Ouvido Profissional Studio */}
        {(avatar.hasHeadphones || isCeo) && (
          <group position={[0, 0.05, 0]}>
            <mesh position={[-0.19, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
              <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0.19, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
              <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.19, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.19, 0.02, 8, 24, Math.PI]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
          </group>
        )}
      </group>

      {/* PROMPT INTERATIVO DE INSTRUMENTOS MUSICAIS PARA O CEO */}
      {isCeo && nearbyInstrument && !isKartActive && (
        <Html position={[0, 2.6, 0]} center distanceFactor={10}>
          <div
            onClick={() => {
              if (nearbyInstrument === 'drums') studioSynthAudio.playDrumPattern();
              else if (nearbyInstrument === 'console') studioSynthAudio.playConsoleEffect();
              else if (nearbyInstrument === 'synth') studioSynthAudio.playSynthAndGuitar();
            }}
            style={{
              background: 'linear-gradient(135deg, #ca8a04 0%, #eab308 100%)',
              color: '#000000',
              fontWeight: 900,
              fontSize: '12px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '2px solid #ffffff',
              boxShadow: '0 0 20px rgba(234, 179, 8, 0.8)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              animation: 'bounce 1s infinite alternate',
            }}
          >
            {nearbyInstrument === 'drums' && '🥁 [E] ou Toque: BATERIA PUB REC'}
            {nearbyInstrument === 'console' && '🎛️ [E] ou Toque: MESA SSL STUDIO'}
            {nearbyInstrument === 'synth' && '🎹 [E] ou Toque: SINTETIZADOR & GUITARRA'}
          </div>
        </Html>
      )}

      {/* Crachá Flutuante Elegante com Nome e Cargo (Ocultado quando pilotando kart para visão limpa) */}
      {!isJukeboxOpen && !isKartActive && (
        <Html position={[0, 2.1, 0]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              border: '1px solid #334155',
              padding: '3px 8px',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>{isCeo ? '⭐' : '💼'}</span>
              <span style={{ color: avatar.accentColor }}>{avatar.displayName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8' }}>{avatar.role}</span>
              <span
                style={{
                  fontSize: '8.5px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background:
                    operationalState === 'working' || operationalState === 'reviewing'
                      ? '#0284c7'
                      : operationalState === 'thinking'
                      ? '#7c3aed'
                      : operationalState === 'idle'
                      ? '#10b981'
                      : operationalState === 'blocked'
                      ? '#ef4444'
                      : operationalState === 'learning'
                      ? '#d97706'
                      : operationalState === 'celebrating'
                      ? '#16a34a'
                      : operationalState === 'waiting_for_dependency'
                      ? '#ea580c'
                      : '#10b981',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#ffffff',
                  }}
                />
                {OPERATIONAL_STATE_LABELS_PT[operationalState]?.label || operationalState}
              </span>
            </div>
          </div>
        </Html>
      )}

      {/* Balão de Fala 3D Comic (Ocultado quando pilotando kart) */}
      {speechBubble && !isKartActive && (
        <Html position={[0, 2.7, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600,
              maxWidth: '180px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              border: '2px solid #38bdf8',
              textAlign: 'center',
            }}
          >
            {speechBubble}
          </div>
        </Html>
      )}
    </group>
  );
};
