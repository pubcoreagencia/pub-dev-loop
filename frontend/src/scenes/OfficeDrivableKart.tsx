import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';

interface OfficeDrivableKartProps {
  initialPosition?: [number, number, number];
}

export const OfficeDrivableKart: React.FC<OfficeDrivableKartProps> = ({
  initialPosition = [-15, 0, 11],
}) => {
  const isKartActive = useStore((s) => s.isKartActive);
  const setKartActive = useStore((s) => s.setKartActive);

  const kartGroupRef = useRef<THREE.Group>(null);
  const frontLeftWheelRef = useRef<THREE.Group>(null);
  const frontRightWheelRef = useRef<THREE.Group>(null);
  const steeringWheelRef = useRef<THREE.Group>(null);
  const exhaustGlowRef = useRef<THREE.PointLight>(null);

  // Kart Physics & State
  const stateRef = useRef({
    pos: new THREE.Vector3(initialPosition[0], initialPosition[1], initialPosition[2]),
    rotationY: -Math.PI / 2, // Apontando para o corredor
    speed: 0,
    steeringAngle: 0,
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      drift: false,
    },
  });

  const [currentKmh, setCurrentKmh] = useState(0);

  // Keyboard Event Listeners when driving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!useStore.getState().isKartActive) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') stateRef.current.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') stateRef.current.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') stateRef.current.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') stateRef.current.keys.right = true;
      if (e.code === 'Space') stateRef.current.keys.drift = true;

      // E or Escape to exit kart
      if (e.code === 'KeyE' || e.code === 'Escape') {
        setKartActive(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') stateRef.current.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') stateRef.current.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') stateRef.current.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') stateRef.current.keys.right = false;
      if (e.code === 'Space') stateRef.current.keys.drift = false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (!useStore.getState().isKartActive) return;
      const delta = e.deltaY * 0.005;
      camDistRef.current = THREE.MathUtils.clamp(camDistRef.current + delta, 3.5, 14.0);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [setKartActive]);

  const { camera } = useThree();
  const camDistRef = useRef(6.5);

  useFrame((_, delta) => {
    const s = stateRef.current;
    const dt = Math.min(delta, 0.1);

    if (isKartActive) {
      // Acceleration & Braking
      const maxSpeed = s.keys.drift ? 14 : 9.5;
      const acceleration = 12;
      const deceleration = 8;
      const turnSpeed = 2.8;

      if (s.keys.forward) {
        s.speed = Math.min(s.speed + acceleration * dt, maxSpeed);
      } else if (s.keys.backward) {
        s.speed = Math.max(s.speed - deceleration * dt, -4);
      } else {
        // Natural friction
        if (s.speed > 0) s.speed = Math.max(0, s.speed - 6 * dt);
        else if (s.speed < 0) s.speed = Math.min(0, s.speed + 6 * dt);
      }

      // Steering
      const targetSteering = (s.keys.left ? 1 : 0) - (s.keys.right ? 1 : 0);
      s.steeringAngle = THREE.MathUtils.lerp(s.steeringAngle, targetSteering * 0.45, dt * 10);

      // Apply turning only if moving
      if (Math.abs(s.speed) > 0.1) {
        const dir = s.speed > 0 ? 1 : -1;
        s.rotationY += s.steeringAngle * turnSpeed * dir * dt;
      }

      // Move forward along rotation
      s.pos.x += Math.sin(s.rotationY) * s.speed * dt;
      s.pos.z += Math.cos(s.rotationY) * s.speed * dt;

      // Boundary limits within the entire extended office & game room & auditorium
      s.pos.x = THREE.MathUtils.clamp(s.pos.x, -21, 21);
      s.pos.z = THREE.MathUtils.clamp(s.pos.z, -13, 33);

      // Speed display update (throttled)
      if (Math.random() < 0.2) {
        setCurrentKmh(Math.round(Math.abs(s.speed) * 6));
      }

      // Smooth camera follow with scroll wheel zoom adjustment
      const camDist = camDistRef.current;
      const camHeight = camDist * 0.65;
      const camOffset = new THREE.Vector3(
        -Math.sin(s.rotationY) * camDist,
        camHeight,
        -Math.cos(s.rotationY) * camDist
      );
      const targetCamPos = s.pos.clone().add(camOffset);
      camera.position.lerp(targetCamPos, dt * 5);
      camera.lookAt(s.pos.x, s.pos.y + 0.8, s.pos.z);
    }

    // Update 3D Group Position & Rotation
    if (kartGroupRef.current) {
      kartGroupRef.current.position.copy(s.pos);
      kartGroupRef.current.rotation.y = s.rotationY;
      // Slight body roll during turns
      kartGroupRef.current.rotation.z = -s.steeringAngle * 0.15;
    }

    // Steer front wheels & steering wheel
    if (frontLeftWheelRef.current && frontRightWheelRef.current) {
      frontLeftWheelRef.current.rotation.y = s.steeringAngle;
      frontRightWheelRef.current.rotation.y = s.steeringAngle;
    }
    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.z = -s.steeringAngle * 2.5;
    }

    // Exhaust light flicker
    if (exhaustGlowRef.current) {
      const isMoving = Math.abs(s.speed) > 0.5;
      exhaustGlowRef.current.intensity = isMoving ? 1.5 + Math.random() * 1.2 : 0.2;
    }
  });

  return (
    <group
      ref={kartGroupRef}
      position={initialPosition}
      onClick={() => {
        if (!isKartActive) setKartActive(true);
      }}
    >
      {/* 1. CHASSIS DO KART (Tubular de Corrida Vermelho PUB REC) */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.12, 2.1]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Faixa Branca de Corrida no Bico */}
      <mesh position={[0, 0.245, 0.2]} castShadow>
        <boxGeometry args={[0.3, 0.02, 1.6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>

      {/* Para-choque Dianteiro Aerodinâmico com Número 01 */}
      <mesh position={[0, 0.18, 1.05]} castShadow>
        <boxGeometry args={[1.35, 0.16, 0.3]} />
        <meshStandardMaterial color="#111827" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.26, 0.9]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.22, 0.35]} />
        <meshStandardMaterial color="#dc2626" roughness={0.2} metalness={0.5} />
      </mesh>

      {/* 2. BANCO DE PILOTO ESPORTIVO TIPO CONCHA (Preto com Costuras) */}
      <mesh position={[0, 0.36, -0.2]} castShadow>
        <boxGeometry args={[0.65, 0.38, 0.55]} />
        <meshStandardMaterial color="#18181b" roughness={0.8} />
      </mesh>
      {/* Encosto Alto de Cabeça */}
      <mesh position={[0, 0.65, -0.45]} rotation={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.45, 0.14]} />
        <meshStandardMaterial color="#18181b" roughness={0.8} />
      </mesh>

      {/* 3. VOLANTE ESPORTIVO E COLUNA DE DIREÇÃO */}
      <mesh position={[0, 0.42, 0.25]} rotation={[0.65, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshStandardMaterial color="#71717a" metalness={0.9} />
      </mesh>
      <group ref={steeringWheelRef} position={[0, 0.58, 0.12]} rotation={[0.65, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.18, 0.025, 8, 24]} />
          <meshStandardMaterial color="#27272a" roughness={0.4} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>

      {/* 4. AEROFÓLIO TRASEIRO PUB REC COM LOGO */}
      <mesh position={[-0.5, 0.55, -0.9]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        <meshStandardMaterial color="#52525b" metalness={0.8} />
      </mesh>
      <mesh position={[0.5, 0.55, -0.9]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        <meshStandardMaterial color="#52525b" metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.8, -0.95]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[1.38, 0.05, 0.35]} />
        <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.7} />
      </mesh>

      {/* 5. RODAS DE KART COM PNEUS SLICK E CALOTAS DE ALUMÍNIO */}
      {/* Roda Dianteira Esquerda (Direcionável) */}
      <group ref={frontLeftWheelRef} position={[-0.72, 0.16, 0.72]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.22, 18]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.01, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.23, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Roda Dianteira Direita (Direcionável) */}
      <group ref={frontRightWheelRef} position={[0.72, 0.16, 0.72]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.22, 18]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.01, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.23, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Roda Traseira Esquerda (Tração mais Larga) */}
      <group position={[-0.75, 0.18, -0.65]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.28, 18]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.01, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.29, 16]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Roda Traseira Direita (Tração mais Larga) */}
      <group position={[0.75, 0.18, -0.65]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.28, 18]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.01, 0, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.29, 16]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* 6. ESCAPAMENTO DUPLO & FOGO/BRILHO */}
      <mesh position={[-0.24, 0.22, -1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.35, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.95} />
      </mesh>
      <mesh position={[0.24, 0.22, -1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.35, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.95} />
      </mesh>
      <pointLight
        ref={exhaustGlowRef}
        position={[0, 0.22, -1.25]}
        color="#f97316"
        distance={2.5}
        intensity={0.4}
      />

      {/* 7. FARÓIS DIANTEIROS DE LED */}
      <mesh position={[-0.45, 0.22, 1.15]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      <mesh position={[0.45, 0.22, 1.15]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {isKartActive && (
        <spotLight
          position={[0, 0.4, 1.1]}
          target-position={[0, 0, 8]}
          angle={0.7}
          penumbra={0.4}
          intensity={2.8}
          color="#e0f2fe"
        />
      )}

      {/* 8. BALÃO / INDICADOR 3D FLUTUANTE SOBRE O KART */}
      <Html position={[0, 1.4, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        {!isKartActive ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.92), rgba(15, 23, 42, 0.95))',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)',
              border: '1px solid #f87171',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            onClick={() => setKartActive(true)}
          >
            <span>🏎️</span>
            <span>PILOTAR KART (Gather Style)</span>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#f8fafc',
              padding: '5px 12px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: 700,
              border: '1px solid #38bdf8',
              boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ color: '#38bdf8' }}>{currentKmh} km/h</span>
            <span style={{ color: '#94a3b8' }}>| WASD / Setas | Drift: Espaço</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setKartActive(false);
              }}
              style={{
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '2px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              [E] Sair
            </button>
          </div>
        )}
      </Html>
    </group>
  );
};
