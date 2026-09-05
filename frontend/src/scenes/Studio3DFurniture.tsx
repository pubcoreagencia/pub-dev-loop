import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * PUB RECORDS • ESTÚDIO DE PRODUÇÃO MUSICAL, SALA TÉCNICA E AQUÁRIO DE GRAVAÇÃO
 * Modelado proceduralmente com alta fidelidade estética para o Gabinete do CEO Matheus Paes.
 */

// ============================================================================
// 1. TRATAMENTO ACÚSTICO DE ESTÚDIO (Acoustic Treatment, Difusores e Bass Traps)
// ============================================================================
export const StudioAcousticTreatment: React.FC = () => {
  // Difusor Quadrático Skyline em Madeira (blocos de profundidades variadas)
  const diffuserBlocks = [];
  const heights = [0.08, 0.16, 0.24, 0.12, 0.2, 0.06, 0.18, 0.14, 0.22, 0.1, 0.15, 0.25];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const h = heights[(r * 6 + c) % heights.length];
      diffuserBlocks.push(
        <mesh
          key={`diffuser-${r}-${c}`}
          position={[-1.25 + c * 0.5, 3.8 + r * 0.45, -14.55 + h / 2]}
          castShadow
        >
          <boxGeometry args={[0.42, 0.38, h]} />
          <meshStandardMaterial color="#854d0e" roughness={0.65} metalness={0.1} />
        </mesh>
      );
    }
  }

  // Painéis Acústicos Estofados em Tecido Cinza Antracite e Vermelho Studio
  const acousticPanels = [
    // Parede Norte (Atrás do CEO)
    { pos: [-3.8, 4.0, -14.6], color: '#991b1b', size: [1.2, 2.2, 0.1] },
    { pos: [-2.4, 4.0, -14.6], color: '#1e293b', size: [1.2, 2.2, 0.1] },
    { pos: [2.4, 4.0, -14.6], color: '#1e293b', size: [1.2, 2.2, 0.1] },
    { pos: [3.8, 4.0, -14.6], color: '#991b1b', size: [1.2, 2.2, 0.1] },
    // Painéis de Teto (Acoustic Cloud Baffles flutuando com luz indireta)
    { pos: [0, 5.8, -8.0], color: '#0f172a', size: [4.8, 0.08, 3.2] },
  ];

  return (
    <group>
      {/* Moldura do Difusor Central */}
      <mesh position={[0, 4.45, -14.58]} castShadow>
        <boxGeometry args={[3.2, 2.0, 0.06]} />
        <meshStandardMaterial color="#451a03" roughness={0.8} />
      </mesh>
      {diffuserBlocks}

      {/* Painéis Acústicos de Parede e Nuvem de Teto */}
      {acousticPanels.map((p, i) => (
        <group key={`panel-${i}`} position={p.pos as [number, number, number]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={p.size as [number, number, number]} />
            <meshStandardMaterial color={p.color} roughness={0.92} />
          </mesh>
          {/* Borda chanfrada de alumínio escurecido */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[(p.size[0] as number) + 0.04, (p.size[1] as number) + 0.04, (p.size[2] as number) - 0.02]} />
            <meshStandardMaterial color="#020617" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Bass Trap Prismático nos Cantos (Tratamento de Graves) */}
      <mesh position={[-5.8, 3.2, -14.4]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.7, 6.4, 0.7]} />
        <meshStandardMaterial color="#18181b" roughness={0.95} />
      </mesh>
      <mesh position={[5.8, 3.2, -14.4]} rotation={[0, -Math.PI / 4, 0]} castShadow>
        <boxGeometry args={[0.7, 6.4, 0.7]} />
        <meshStandardMaterial color="#18181b" roughness={0.95} />
      </mesh>

      {/* Fita LED Studio RGB Indireta sob a nuvem acústica */}
      <pointLight color="#a855f7" intensity={1.8} distance={8} position={[0, 5.6, -8.0]} />
      <pointLight color="#f97316" intensity={1.2} distance={6} position={[0, 3.0, -14.2]} />
    </group>
  );
};

// ============================================================================
// 2. MESA DE SOM E CONSOLE DE MIXAGEM DO CEO (Studio Mixing Desk & Monitors)
// ============================================================================
interface StudioMixingConsoleProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  isPlaying?: boolean;
}

export const StudioMixingConsole: React.FC<StudioMixingConsoleProps> = ({
  position,
  rotation = [0, 0, 0],
  isPlaying = true,
}) => {
  const vuMeter1 = useRef<THREE.Mesh>(null);
  const vuMeter2 = useRef<THREE.Mesh>(null);
  const vuMeter3 = useRef<THREE.Mesh>(null);
  const screenGlow = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Medidores VU dinâmicos oscilando com a reprodução de áudio
    if (vuMeter1.current) {
      const s = isPlaying ? 0.3 + Math.abs(Math.sin(t * 12)) * 0.7 : 0.1;
      vuMeter1.current.scale.y = s;
    }
    if (vuMeter2.current) {
      const s = isPlaying ? 0.2 + Math.abs(Math.cos(t * 14 + 1)) * 0.8 : 0.1;
      vuMeter2.current.scale.y = s;
    }
    if (vuMeter3.current) {
      const s = isPlaying ? 0.4 + Math.abs(Math.sin(t * 9 + 2)) * 0.6 : 0.1;
      vuMeter3.current.scale.y = s;
    }
    if (screenGlow.current) {
      screenGlow.current.intensity = 1.0 + Math.sin(t * 4) * 0.2;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* 2.1 ESTRUTURA DA MESA DE PRODUÇÃO ESTILO ARGOSY / ZAOR */}
      {/* Tampo Central Rebaixado com Braço Angulado */}
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.08, 1.4]} />
        <meshStandardMaterial color="#1e1b18" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Borda Dianteira Almofadada em Couro Preto (Armrest do Engenheiro) */}
      <mesh position={[0, 0.78, 0.68]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 3.2, 16]} />
        <meshStandardMaterial color="#09090b" roughness={0.7} />
      </mesh>
      {/* Prateleira Elevada Traseira para Monitores e Tela Ultrawide */}
      <mesh position={[0, 1.05, -0.45]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.06, 0.55]} />
        <meshStandardMaterial color="#2d241e" roughness={0.4} />
      </mesh>
      {/* Pés Laterais Robustos de Estúdio em Aço Preto */}
      <mesh position={[-1.5, 0.45, 0]} castShadow>
        <boxGeometry args={[0.12, 0.9, 1.2]} />
        <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.5, 0.45, 0]} castShadow>
        <boxGeometry args={[0.12, 0.9, 1.2]} />
        <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* 2.2 MESA DE SOM / CONSOLE ANALÓGICO COM FADERS E CANAIS */}
      <group position={[0, 0.82, 0.15]} rotation={[-0.15, 0, 0]}>
        {/* Chassi do Console */}
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.08, 0.65]} />
          <meshStandardMaterial color="#27272a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Meter Bridge com VU Meters Analógicos Iluminados */}
        <mesh position={[0, 0.08, -0.26]} castShadow>
          <boxGeometry args={[1.46, 0.09, 0.12]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} />
        </mesh>
        {/* Barras Luminosas VU (LED Bargraph) */}
        <mesh ref={vuMeter1} position={[-0.4, 0.1, -0.2]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh ref={vuMeter2} position={[0, 0.1, -0.2]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
        <mesh ref={vuMeter3} position={[0.4, 0.1, -0.2]}>
          <boxGeometry args={[0.06, 0.06, 0.02]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>

        {/* Faders e Knobs do Mixer */}
        {[-0.55, -0.35, -0.15, 0.05, 0.25, 0.45].map((x, idx) => (
          <group key={`strip-${idx}`} position={[x, 0.05, 0.05]}>
            {/* Trilho do Fader */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.015, 0.005, 0.28]} />
              <meshBasicMaterial color="#09090b" />
            </mesh>
            {/* Knob do Fader com Cap Prateado */}
            <mesh position={[0, 0.015, (idx % 3) * 0.05 - 0.05]} castShadow>
              <boxGeometry args={[0.035, 0.02, 0.04]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.9} />
            </mesh>
            {/* Knobs Rotatórios de EQ (Agudos, Médios, Graves) */}
            <mesh position={[0, 0.01, -0.18]}>
              <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
              <meshStandardMaterial color="#38bdf8" />
            </mesh>
            <mesh position={[0, 0.01, -0.12]}>
              <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 2.3 TECLADO CONTROLADOR MIDI (49 TECLAS COM PADS DE BATERIA) */}
      <group position={[0, 0.81, 0.55]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.04, 0.22]} />
          <meshStandardMaterial color="#09090b" roughness={0.4} />
        </mesh>
        {/* Teclas Brancas */}
        <mesh position={[0, 0.025, 0.03]}>
          <boxGeometry args={[0.85, 0.015, 0.12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.2} />
        </mesh>
        {/* Teclas Pretas */}
        <mesh position={[0, 0.035, -0.01]}>
          <boxGeometry args={[0.82, 0.018, 0.06]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} />
        </mesh>
        {/* Pads de Percussão RGB (MPC Style) */}
        {[-0.35, -0.28, -0.21, -0.14].map((px, i) => (
          <mesh key={`pad-${i}`} position={[px, 0.025, -0.07]}>
            <boxGeometry args={[0.045, 0.01, 0.045]} />
            <meshBasicMaterial color={['#ef4444', '#38bdf8', '#22c55e', '#a855f7'][i]} />
          </mesh>
        ))}
      </group>

      {/* 2.4 MONITORES DE ÁUDIO DE ESTÚDIO (YAMAHA HS / GENELEC STYLE) */}
      {/* Monitor Esquerdo (Angulado 25° para o CEO) */}
      <group position={[-1.25, 1.45, -0.4]} rotation={[0, 0.42, 0]}>
        {/* Pedestal Desacoplador com Espuma Acústica */}
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.32, 0.16, 0.32]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        {/* Gabinete do Monitor em Preto Fosco */}
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.46, 0.32]} />
          <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.2} />
        </mesh>
        {/* Cone Woofer de 8 Polegadas (Branco Icônico Yamaha HS8) */}
        <mesh position={[0, -0.07, 0.162]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.04, 0.01, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} />
        </mesh>
        {/* Tweeter de Cúpula Suave de 1 Polegada */}
        <mesh position={[0, 0.12, 0.162]}>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshStandardMaterial color="#27272a" metalness={0.8} />
        </mesh>
        {/* Luz Piloto do Monitor Ligado */}
        <mesh position={[0, -0.2, 0.162]}>
          <boxGeometry args={[0.015, 0.005, 0.005]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Monitor Direito (Angulado -25° para o CEO) */}
      <group position={[1.25, 1.45, -0.4]} rotation={[0, -0.42, 0]}>
        {/* Pedestal Desacoplador com Espuma Acústica */}
        <mesh position={[0, -0.28, 0]} castShadow>
          <boxGeometry args={[0.32, 0.16, 0.32]} />
          <meshStandardMaterial color="#18181b" roughness={0.9} />
        </mesh>
        {/* Gabinete do Monitor */}
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.46, 0.32]} />
          <meshStandardMaterial color="#09090b" roughness={0.3} metalness={0.2} />
        </mesh>
        {/* Cone Woofer de 8 Polegadas Branco */}
        <mesh position={[0, -0.07, 0.162]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.085, 0.04, 0.01, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.15} />
        </mesh>
        {/* Tweeter */}
        <mesh position={[0, 0.12, 0.162]}>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshStandardMaterial color="#27272a" metalness={0.8} />
        </mesh>
        {/* Luz Piloto do Monitor Ligado */}
        <mesh position={[0, -0.2, 0.162]}>
          <boxGeometry args={[0.015, 0.005, 0.005]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* 2.5 RACKS DE EQUIPAMENTOS OUTBOARD 19" (COMPRESSORES E PREAMPS) */}
      {/* Rack Esquerdo Embutido */}
      <group position={[-1.15, 0.95, -0.1]} rotation={[-0.12, 0.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.32, 0.38]} />
          <meshStandardMaterial color="#111827" metalness={0.8} />
        </mesh>
        {/* VU Analógico Vintage Redondo (Compressor estilo 1176 / LA-2A) */}
        <mesh position={[0, 0.06, 0.192]}>
          <circleGeometry args={[0.05, 20]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
        <mesh position={[0, 0.06, 0.195]}>
          <boxGeometry args={[0.003, 0.06, 0.002]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        {/* LEDs de Sinal */}
        <mesh position={[-0.18, -0.08, 0.192]}>
          <boxGeometry args={[0.04, 0.015, 0.005]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* Rack Direito Embutido */}
      <group position={[1.15, 0.95, -0.1]} rotation={[-0.12, -0.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.32, 0.38]} />
          <meshStandardMaterial color="#111827" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.06, 0.192]}>
          <circleGeometry args={[0.05, 20]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
        <mesh position={[0, 0.06, 0.195]}>
          <boxGeometry args={[0.003, 0.06, 0.002]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh position={[0.18, -0.08, 0.192]}>
          <boxGeometry args={[0.04, 0.015, 0.005]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      </group>

      {/* 2.6 MICROFONE DE BROADCAST COM BRAÇO ARTICULADO (SHURE SM7B STYLE) */}
      <group position={[-0.55, 1.05, 0.2]}>
        {/* Base Fixada na Mesa */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 16]} />
          <meshStandardMaterial color="#09090b" metalness={0.9} />
        </mesh>
        {/* Braço Articulado Scissor Boom Arm */}
        <mesh position={[0.08, 0.25, -0.08]} rotation={[0.4, 0.3, -0.3]}>
          <cylinderGeometry args={[0.008, 0.008, 0.45, 8]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} />
        </mesh>
        <mesh position={[0.22, 0.42, 0.05]} rotation={[-0.4, 0.3, 0.2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.4, 8]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} />
        </mesh>
        {/* Suporte Anti-choque (Shockmount) */}
        <mesh position={[0.32, 0.38, 0.18]}>
          <torusGeometry args={[0.05, 0.008, 8, 16]} />
          <meshStandardMaterial color="#27272a" metalness={0.9} />
        </mesh>
        {/* Corpo do Microfone Condensador */}
        <mesh position={[0.32, 0.38, 0.18]} rotation={[0, 0.3, Math.PI / 4]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 16]} />
          <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Espuma Pop Filter Circular */}
        <mesh position={[0.28, 0.42, 0.22]} rotation={[0, 0.3, 0]}>
          <torusGeometry args={[0.06, 0.004, 6, 20]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      </group>

      {/* 2.7 FONE DE OUVIDO DE ESTÚDIO (AUDIO-TECHNICA M50X STYLE) */}
      <group position={[1.52, 0.72, 0.4]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <torusGeometry args={[0.09, 0.015, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
        <mesh position={[-0.09, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh position={[0.09, 0, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* 2.8 MONITOR ULTRAWIDE DE PRODUÇÃO COM DAW (LOGIC PRO / ABLETON LIVE) */}
      <group position={[0, 1.48, -0.42]}>
        {/* Tela Curva Ultrawide */}
        <mesh castShadow>
          <boxGeometry args={[1.75, 0.58, 0.05]} />
          <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Display Glow com interface de pistas de áudio (DAW) */}
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[1.7, 0.53]} />
          <meshStandardMaterial
            color="#0f172a"
            emissive="#38bdf8"
            emissiveIntensity={0.65}
            roughness={0.2}
          />
        </mesh>
        {/* Pistas de Áudio Iluminadas na Tela */}
        {[-0.18, -0.06, 0.06, 0.18].map((py, idx) => (
          <mesh key={`track-${idx}`} position={[0, py, 0.032]}>
            <planeGeometry args={[1.6, 0.06]} />
            <meshBasicMaterial color={['#38bdf8', '#a855f7', '#22c55e', '#f59e0b'][idx]} transparent opacity={0.6} />
          </mesh>
        ))}
        <pointLight ref={screenGlow} color="#38bdf8" intensity={1.1} distance={2.8} position={[0, 0, 0.4]} />
      </group>

      {/* 2.9 A LENDÁRIA CANECA "WORLD'S BEST BOSS" */}
      <group position={[-1.1, 1.15, -0.3]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.075, 0.065, 0.14, 28]} />
          <meshStandardMaterial color="#facc15" roughness={0.12} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.01, 24]} />
          <meshStandardMaterial color="#2b1408" roughness={0.1} />
        </mesh>
        <mesh position={[0.075, 0, 0]}>
          <torusGeometry args={[0.045, 0.012, 12, 20]} />
          <meshStandardMaterial color="#facc15" roughness={0.12} />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 3. INSTRUMENTOS MUSICAIS ESPALHADOS NA SALA (Guitarras, Baixo, Violão, Amp)
// ============================================================================
export const StudioInstruments: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* 3.1 RACK DE CHÃO MULTI-INSTRUMENTOS (Suporte para 3 Guitarras) */}
      <group position={[0, 0, 0]} rotation={[0, -0.35, 0]}>
        {/* Base do Suporte Tubular */}
        <mesh position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[1.3, 0.04, 0.45]} />
          <meshStandardMaterial color="#09090b" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.65, -0.15]} rotation={[0.25, 0, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.85, 12]} />
          <meshStandardMaterial color="#18181b" metalness={0.8} />
        </mesh>

        {/* GUITARRA 1: Fender Stratocaster Vintage Sunburst */}
        <group position={[-0.38, 0.72, 0]} rotation={[0.18, 0, 0.05]}>
          {/* Corpo com Curvas Anatômicas */}
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.46, 0.06]} />
            <meshStandardMaterial color="#b45309" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Escudo / Pickguard Branco */}
          <mesh position={[0.02, -0.02, 0.032]}>
            <boxGeometry args={[0.22, 0.32, 0.008]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* 3 Captadores Single Coil Brancos */}
          {[-0.08, 0, 0.08].map((py, i) => (
            <mesh key={`pickup-${i}`} position={[0.02, py, 0.038]}>
              <boxGeometry args={[0.14, 0.025, 0.01]} />
              <meshStandardMaterial color="#ffffff" metalness={0.5} />
            </mesh>
          ))}
          {/* Braço de Maple (Madeira Clara) */}
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.065, 0.68, 0.03]} />
            <meshStandardMaterial color="#fde68a" roughness={0.4} />
          </mesh>
          {/* Headstock Stratocaster */}
          <mesh position={[0.015, 0.9, 0]} castShadow>
            <boxGeometry args={[0.09, 0.15, 0.025]} />
            <meshStandardMaterial color="#fde68a" roughness={0.4} />
          </mesh>
        </group>

        {/* GUITARRA 2: Contrabaixo Elétrico Precision Bass (Preto Clássico) */}
        <group position={[0.05, 0.8, 0]} rotation={[0.18, 0, -0.02]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.52, 0.065]} />
            <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.07, 0.82, 0.032]} />
            <meshStandardMaterial color="#d4d4d8" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0.02, 1.06, 0]} castShadow>
            <boxGeometry args={[0.1, 0.18, 0.028]} />
            <meshStandardMaterial color="#09090b" />
          </mesh>
        </group>

        {/* GUITARRA 3: Violão Acústico de Estúdio (Acoustic Guitar) */}
        <group position={[0.42, 0.72, 0]} rotation={[0.18, 0, -0.08]}>
          {/* Caixa de Ressonância em Madeira Clara */}
          <mesh castShadow>
            <boxGeometry args={[0.38, 0.56, 0.12]} />
            <meshStandardMaterial color="#d97706" roughness={0.5} />
          </mesh>
          {/* Boca do Violão (Soundhole) */}
          <mesh position={[0, 0.05, 0.062]}>
            <circleGeometry args={[0.06, 24]} />
            <meshBasicMaterial color="#1c1917" />
          </mesh>
          {/* Cavalete */}
          <mesh position={[0, -0.16, 0.065]}>
            <boxGeometry args={[0.16, 0.03, 0.015]} />
            <meshStandardMaterial color="#451a03" />
          </mesh>
          {/* Braço e Headstock */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <boxGeometry args={[0.065, 0.65, 0.04]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </group>
      </group>

      {/* 3.2 AMPLIFICADOR VALVULADO DE GUITARRA (TUBE AMP CAB) */}
      <group position={[1.4, 0.38, 0.2]} rotation={[0, -0.4, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.65, 0.42]} />
          <meshStandardMaterial color="#18181b" roughness={0.8} />
        </mesh>
        {/* Grelha Frontal de Tecido Tweed Vintage */}
        <mesh position={[0, -0.04, 0.212]}>
          <planeGeometry args={[0.62, 0.44]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.9} />
        </mesh>
        {/* Painel Superior com Knobs Dourados e Chave On/Off */}
        <mesh position={[0, 0.22, 0.212]}>
          <planeGeometry args={[0.62, 0.1]} />
          <meshStandardMaterial color="#eab308" metalness={0.8} />
        </mesh>
        {/* Luz Piloto da Válvula Vermelha (Jewel Light) */}
        <mesh position={[0.25, 0.22, 0.218]}>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <pointLight color="#ef4444" intensity={0.4} distance={1.2} position={[0.25, 0.22, 0.3]} />
      </group>

      {/* 3.3 TECLADO SINTETIZADOR VINTAGE EM SUPORTE X */}
      <group position={[-1.6, 0.72, 0.4]} rotation={[0, 0.6, 0]}>
        {/* Suporte em X Preto */}
        <mesh position={[0, -0.36, 0]} rotation={[0, 0, 0.45]}>
          <cylinderGeometry args={[0.018, 0.018, 0.85, 8]} />
          <meshStandardMaterial color="#09090b" metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.36, 0]} rotation={[0, 0, -0.45]}>
          <cylinderGeometry args={[0.018, 0.018, 0.85, 8]} />
          <meshStandardMaterial color="#09090b" metalness={0.8} />
        </mesh>
        {/* Chassi do Sintetizador Analógico */}
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.08, 0.38]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Teclas */}
        <mesh position={[0, 0.045, 0.08]}>
          <boxGeometry args={[0.9, 0.02, 0.16]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        {/* Painel de Modulação e Knobs */}
        <mesh position={[0, 0.045, -0.09]}>
          <boxGeometry args={[0.9, 0.02, 0.14]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 4. SALA DE BATERIA DE GRAVAÇÃO (Drum Recording Booth / Aquário Acústico)
// ============================================================================
interface DrumRecordingBoothProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  isRecording?: boolean;
}

export const DrumRecordingBooth: React.FC<DrumRecordingBoothProps> = ({
  position,
  rotation = [0, 0, 0],
  isRecording = true,
}) => {
  const onAirLight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (onAirLight.current) {
      const t = clock.getElapsedTime();
      onAirLight.current.intensity = isRecording ? 1.5 + Math.sin(t * 3) * 0.4 : 0.2;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* 4.1 AQUÁRIO: PAREDES ACÚSTICAS COM VIDRO DUPLO DE GRAVAÇÃO */}
      {/* Paredes Sólidas Laterais e Traseiras do Aquário */}
      {/* Parede Traseira (Norte do Booth) */}
      <mesh position={[0, 2.8, -3.2]} castShadow receiveShadow>
        <boxGeometry args={[6.4, 5.6, 0.25]} />
        <meshStandardMaterial color="#1a130f" roughness={0.8} />
      </mesh>
      {/* Parede Esquerda (Oeste do Booth) */}
      <mesh position={[-3.1, 2.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 5.6, 6.4]} />
        <meshStandardMaterial color="#1a130f" roughness={0.8} />
      </mesh>
      {/* Parede Traseira Sul (com abertura) */}
      <mesh position={[-2.0, 2.8, 3.1]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 5.6, 0.25]} />
        <meshStandardMaterial color="#1a130f" roughness={0.8} />
      </mesh>

      {/* VIDRO DUPLO DO AQUÁRIO (Voltado para a Sala Técnica do CEO) */}
      <group position={[3.1, 2.4, 0]}>
        {/* Moldura de Alumínio e Nogueira */}
        <mesh castShadow>
          <boxGeometry args={[0.28, 4.4, 5.6]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} />
        </mesh>
        {/* Vidro Acústico Translúcido Reflexivo */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.08, 3.8, 5.0]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transmission={0.92}
            opacity={0.35}
            transparent
            roughness={0.05}
            metalness={0.1}
            ior={1.5}
          />
        </mesh>
      </group>

      {/* PLACA LUMINOSA "🔴 RECORDING / LIVE ROOM" NO ALTO DO AQUÁRIO */}
      <group position={[3.15, 4.8, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.45, 2.4]} />
          <meshStandardMaterial color="#09090b" metalness={0.9} />
        </mesh>
        <mesh position={[0.08, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[2.2, 0.35]} />
          <meshBasicMaterial color={isRecording ? '#ef4444' : '#475569'} />
        </mesh>
        <pointLight
          ref={onAirLight}
          color="#ef4444"
          intensity={1.8}
          distance={4.5}
          position={[0.3, 0, 0]}
        />
      </group>

      {/* 4.2 TAPETE ACÚSTICO CIRCULAR DA BATERIA */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[2.4, 2.4, 0.03, 32]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.018, 0]} receiveShadow>
        <cylinderGeometry args={[2.2, 2.2, 0.03, 32]} />
        <meshStandardMaterial color="#991b1b" roughness={0.95} />
      </mesh>

      {/* 4.3 BATERIA ACÚSTICA COMPLETA (DRUM KIT) */}
      <group position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        {/* BUMBO (BASS DRUM 22") */}
        <group position={[0, 0.6, -0.35]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.65, 32]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.4} />
          </mesh>
          {/* Pele Frontal com Aro Cromado */}
          <mesh position={[0, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.54, 0.54, 0.01, 32]} />
            <meshStandardMaterial color="#09090b" roughness={0.4} />
          </mesh>
          {/* Logo Central da PUB Records no Bumbo */}
          <mesh position={[0, 0, 0.338]} rotation={[0, 0, 0]}>
            <circleGeometry args={[0.22, 24]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          {/* Furo de Descompressão e Microfone de Bumbo */}
          <mesh position={[0.25, -0.15, 0.34]} rotation={[0, 0, 0]}>
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          {/* Microfone de Bumbo (AKG D112 / Shure Beta 52 style) */}
          <mesh position={[0.25, -0.15, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.12, 16]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} />
          </mesh>
          {/* Pés de Apoio do Bumbo (Spurs cromados) */}
          <mesh position={[-0.52, -0.4, 0.2]} rotation={[0, 0, 0.4]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
          <mesh position={[0.52, -0.4, 0.2]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
        </group>

        {/* CAIXA DE BATERIA (SNARE DRUM 14") */}
        <group position={[-0.55, 0.72, 0.2]}>
          {/* Tripé Cromado da Caixa */}
          <mesh position={[0, -0.36, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.72, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
          {/* Corpo Metálico da Caixa */}
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.18, 24]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Pele Porosa Branca */}
          <mesh position={[0, 0.092, 0]}>
            <cylinderGeometry args={[0.27, 0.27, 0.005, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.8} />
          </mesh>
          {/* Microfone de Caixa (Shure SM57 com clamp) */}
          <mesh position={[-0.18, 0.16, 0]} rotation={[0.4, 0, -0.5]}>
            <cylinderGeometry args={[0.015, 0.018, 0.1, 12]} />
            <meshStandardMaterial color="#1f2937" metalness={0.8} />
          </mesh>
        </group>

        {/* TOM 1 E TOM 2 (RACK TOMS SOBRE O BUMBO) */}
        <group position={[-0.22, 1.25, -0.3]} rotation={[0.2, 0, 0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.24, 20]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
        <group position={[0.22, 1.25, -0.3]} rotation={[0.2, 0, -0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.24, 0.26, 20]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.4} />
          </mesh>
        </group>

        {/* SURDO DE CHÃO (FLOOR TOM 16") */}
        <group position={[0.72, 0.68, 0.15]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.42, 24]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.4} />
          </mesh>
          {/* 3 Pés Cromados */}
          {[-0.25, 0, 0.25].map((px, i) => (
            <mesh key={`leg-${i}`} position={[px, -0.3, (i % 2) * 0.15]}>
              <cylinderGeometry args={[0.012, 0.012, 0.55, 8]} />
              <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
            </mesh>
          ))}
        </group>

        {/* PRATO DE CHIMBAL (HI-HAT CYMBALS 14") */}
        <group position={[-0.92, 1.05, 0.15]}>
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.0, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
          {/* Prato Superior e Inferior em Bronze B20 */}
          <mesh position={[0, 0.01, 0]} rotation={[0, 0, 0.05]} castShadow>
            <cylinderGeometry args={[0.26, 0.02, 0.015, 24]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.01, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.02, 0.015, 24]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>

        {/* PRATO CRASH / ATAQUE EM ESTANTE GIRAFA CROMADA */}
        <group position={[-0.75, 1.6, -0.55]}>
          <mesh position={[0, -0.7, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.4, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
          <mesh rotation={[0.25, 0.1, 0.1]} castShadow>
            <cylinderGeometry args={[0.34, 0.03, 0.012, 24]} />
            <meshStandardMaterial color="#facc15" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>

        {/* PRATO RIDE / CONDUÇÃO EM ESTANTE CROMADA */}
        <group position={[0.85, 1.45, -0.4]}>
          <mesh position={[0, -0.65, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1.3, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
          <mesh rotation={[-0.2, 0, 0.15]} castShadow>
            <cylinderGeometry args={[0.42, 0.04, 0.015, 28]} />
            <meshStandardMaterial color="#eab308" metalness={0.95} roughness={0.2} />
          </mesh>
        </group>

        {/* BANQUETA DO BATERISTA (DRUM THRONE) */}
        <group position={[0, 0.5, 0.65]}>
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 20]} />
            <meshStandardMaterial color="#18181b" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.95} />
          </mesh>
        </group>

        {/* PAR ESTÉREO DE MICROFONES OVERHEAD SUSPENSOS */}
        <group position={[-0.5, 2.2, -0.1]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </group>
        <group position={[0.5, 2.2, -0.1]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </group>
      </group>
    </group>
  );
};
