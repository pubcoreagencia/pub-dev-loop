import React from 'react';
import { Html } from '@react-three/drei';
import type { SectorDefinition } from '../config/squadsData';
import { FIFTY_SPECIALIZED_AGENTS } from '../config/squadsData';
import { WorkstationTable, OfficeChair, OfficePlant } from './Office3DFurniture';
import { Office3DAvatar } from './Office3DAvatar';
import { useStore } from '../store/useStore';
import type { AgentDefinition } from '../types/office';
import { AGENT_AVATAR_PROFILES } from '../config/officeLayout';

export const SECTOR_COLORS: Record<string, string> = {
  'b2b-growth-leads': '#06b6d4',
  'machine-saas-automation': '#f59e0b',
  'ecommerce-food-retail': '#ec4899',
  'audiovisual-cinema-music': '#e11d48',
  'immersive-3d-games': '#a855f7',
  'physical-3d-pets': '#8b5cf6',
  'real-estate-hospitality': '#14b8a6',
  'igaming-pubet': '#10b981',
  'web3-crypto-fintech': '#eab308',
  'neural-kernel-infra': '#38bdf8',
};

export const SECTOR_ICONS: Record<string, string> = {
  'b2b-growth-leads': '🎯',
  'machine-saas-automation': '⚡',
  'ecommerce-food-retail': '🛒',
  'audiovisual-cinema-music': '🎬',
  'immersive-3d-games': '🎮',
  'physical-3d-pets': '🐾',
  'real-estate-hospitality': '🏖️',
  'igaming-pubet': '🎰',
  'web3-crypto-fintech': '💎',
  'neural-kernel-infra': '🧠',
};

interface SectorRoom3DProps {
  sector: SectorDefinition;
  sectorNumber: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  onFocusRoom?: () => void;
}

export const SectorRoom3D: React.FC<SectorRoom3DProps> = ({
  sector,
  sectorNumber,
  position,
  rotation = [0, 0, 0],
  onFocusRoom,
}) => {
  const {
    agents,
    selectedAgent,
    selectAgent,
    speechBubbles,
    selectedSectorId,
    setSelectedSectorId,
  } = useStore();

  const isSelected = selectedSectorId === sector.id;
  const accentColor = SECTOR_COLORS[sector.id] || '#38bdf8';
  const icon = SECTOR_ICONS[sector.id] || '🏢';

  // Obter os 5 especialistas oficiais desta Squad
  const squadAgents = FIFTY_SPECIALIZED_AGENTS.filter((a) => a.sectorId === sector.id);

  const getAgentLive = (role: string): AgentDefinition | undefined => {
    const base = squadAgents.find((a) => a.role === role);
    if (!base) return undefined;
    const dynamic = agents.find((a) => a.id === base.id);
    return dynamic || base;
  };

  const techLead = getAgentLive('TECH_LEAD');
  const fullstackDev = getAgentLive('FULLSTACK_DEV');
  const qaSec = getAgentLive('QA_SECURITY');
  const productDesigner = getAgentLive('PRODUCT_DESIGNER');
  const growthSales = getAgentLive('GROWTH_SALES');

  const getSpeech = (agentId?: string): string | undefined => {
    if (!agentId) return undefined;
    return speechBubbles.find((b) => b.senderId === agentId)?.content;
  };

  // Coordenadas calculadas para os 5 especialistas dentro da sala (width: 9.2m, depth: 7.4m)
  const stations = {
    techLead: {
      tablePos: [0, 0, -2.1] as [number, number, number],
      tableRot: [0, 0, 0] as [number, number, number],
      avatarPos: [0, 0.04, -1.55] as [number, number, number],
      avatarRot: [0, Math.PI, 0] as [number, number, number],
      chairPos: [0, 0, -1.55] as [number, number, number],
      chairRot: [0, Math.PI, 0] as [number, number, number],
    },
    dev: {
      tablePos: [-2.6, 0, -0.7] as [number, number, number],
      tableRot: [0, -Math.PI / 2, 0] as [number, number, number],
      avatarPos: [-3.15, 0.04, -0.7] as [number, number, number],
      avatarRot: [0, Math.PI / 2, 0] as [number, number, number],
      chairPos: [-3.15, 0, -0.7] as [number, number, number],
      chairRot: [0, Math.PI / 2, 0] as [number, number, number],
    },
    qa: {
      tablePos: [-2.6, 0, 1.4] as [number, number, number],
      tableRot: [0, -Math.PI / 2, 0] as [number, number, number],
      avatarPos: [-3.15, 0.04, 1.4] as [number, number, number],
      avatarRot: [0, Math.PI / 2, 0] as [number, number, number],
      chairPos: [-3.15, 0, 1.4] as [number, number, number],
      chairRot: [0, Math.PI / 2, 0] as [number, number, number],
    },
    designer: {
      tablePos: [2.6, 0, -0.7] as [number, number, number],
      tableRot: [0, Math.PI / 2, 0] as [number, number, number],
      avatarPos: [3.15, 0.04, -0.7] as [number, number, number],
      avatarRot: [0, -Math.PI / 2, 0] as [number, number, number],
      chairPos: [3.15, 0, -0.7] as [number, number, number],
      chairRot: [0, -Math.PI / 2, 0] as [number, number, number],
    },
    growth: {
      tablePos: [2.6, 0, 1.4] as [number, number, number],
      tableRot: [0, Math.PI / 2, 0] as [number, number, number],
      avatarPos: [3.15, 0.04, 1.4] as [number, number, number],
      avatarRot: [0, -Math.PI / 2, 0] as [number, number, number],
      chairPos: [3.15, 0, 1.4] as [number, number, number],
      chairRot: [0, -Math.PI / 2, 0] as [number, number, number],
    },
  };

  const handleRoomClick = (e: any) => {
    e.stopPropagation();
    setSelectedSectorId(sector.id);
    if (onFocusRoom) onFocusRoom();
  };

  return (
    <group position={position} rotation={rotation}>
      {/* 1. PISO ELEVADO DA SALA COM BORDA DE LED CHANFRADA */}
      <group position={[0, 0.04, 0]}>
        {/* Base de ardósia escura técnica */}
        <mesh receiveShadow onClick={handleRoomClick}>
          <boxGeometry args={[9.2, 0.08, 7.4]} />
          <meshStandardMaterial
            color="#0b1120"
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>

        {/* Tapete acústico central integrado */}
        <mesh position={[0, 0.045, 0.2]} receiveShadow>
          <boxGeometry args={[2.4, 0.01, 4.0]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.85}
          />
        </mesh>

        {/* Bordas de LED Neon na base da sala */}
        {/* Borda Frontal Esquerda */}
        <mesh position={[-3.1, 0.042, 3.68]}>
          <boxGeometry args={[3.0, 0.02, 0.04]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 2.5 : 1.2} />
        </mesh>
        {/* Borda Frontal Direita */}
        <mesh position={[3.1, 0.042, 3.68]}>
          <boxGeometry args={[3.0, 0.02, 0.04]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 2.5 : 1.2} />
        </mesh>
        {/* Borda Traseira */}
        <mesh position={[0, 0.042, -3.68]}>
          <boxGeometry args={[9.16, 0.02, 0.04]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 2.5 : 1.2} />
        </mesh>
        {/* Borda Lateral Esquerda */}
        <mesh position={[-4.58, 0.042, 0]}>
          <boxGeometry args={[0.04, 0.02, 7.36]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 2.5 : 1.2} />
        </mesh>
        {/* Borda Lateral Direita */}
        <mesh position={[4.58, 0.042, 0]}>
          <boxGeometry args={[0.04, 0.02, 7.36]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 2.5 : 1.2} />
        </mesh>
      </group>

      {/* 2. ILUMINAÇÃO INTERNA DA SALA */}
      <pointLight
        position={[0, 3.2, 0]}
        intensity={isSelected ? 1.4 : 0.65}
        color={accentColor}
        distance={9}
        decay={2}
      />

      {/* 3. PAREDE DE FUNDO ACÚSTICA COM PAINEL DE CONTROLE / DASHBOARD DO SETOR */}
      <group position={[0, 1.9, -3.65]}>
        {/* Parede Sólida de Fundo */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[9.2, 3.8, 0.15]} />
          <meshStandardMaterial color="#090d16" roughness={0.7} metalness={0.3} />
        </mesh>

        {/* Moldura do Telão LED do Setor */}
        <mesh position={[0, 0.35, 0.09]}>
          <boxGeometry args={[5.2, 1.8, 0.04]} />
          <meshStandardMaterial color="#020617" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Dashboard Holográfico do Setor no Fundo */}
        <Html
          position={[0, 0.35, 0.12]}
          transform
          scale={0.16}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              width: '540px',
              background: 'rgba(5, 10, 24, 0.95)',
              border: `1.5px solid ${accentColor}`,
              borderRadius: '12px',
              padding: '12px 18px',
              color: '#f8fafc',
              boxShadow: `0 0 25px ${accentColor}44`,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: accentColor }}>
                    SETOR {sectorNumber}: {sector.name.split(':')[1]?.trim() || sector.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Squad de 5 Especialistas • Status: Ativo 24h
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: `${accentColor}22`, border: `1px solid ${accentColor}`, borderRadius: '12px', padding: '3px 8px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#38bdf8' }}>ONLINE</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px' }}>
                <div style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 700, marginBottom: '3px' }}>
                  📦 REPOSITÓRIOS DESIGNADOS ({sector.repos.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {sector.repos.slice(0, 4).map((r) => (
                    <span key={r} style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '4px', padding: '1px 5px', color: '#e0f2fe', fontSize: '9px' }}>
                      {r}
                    </span>
                  ))}
                  {sector.repos.length > 4 && (
                    <span style={{ color: '#94a3b8', fontSize: '9px' }}>+{sector.repos.length - 4} mais</span>
                  )}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px' }}>
                <div style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 700, marginBottom: '3px' }}>
                  ⚡ BENCHMARKING DE IA ATIVO
                </div>
                <div style={{ color: '#facc15', fontSize: '10px', fontWeight: 700 }}>
                  {techLead?.preferredModel || 'minimax/minimax-m3:free'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '9px', marginTop: '2px' }}>
                  Fallback: 9Router • Latência: 120ms
                </div>
              </div>
            </div>
          </div>
        </Html>
      </group>

      {/* 4. PAREDES LATERAIS E FRONTAIS DE VIDRO COM ESQUADRIAS ESCURAS */}
      {/* Parede Lateral Esquerda (Vidro Translúcido) */}
      <mesh position={[-4.58, 1.9, 0]}>
        <boxGeometry args={[0.08, 3.8, 7.3]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.16}
        />
      </mesh>
      {/* Moldura metálica lateral esquerda */}
      <mesh position={[-4.58, 3.75, 0]}>
        <boxGeometry args={[0.12, 0.1, 7.35]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>

      {/* Parede Lateral Direita (Vidro Translúcido) */}
      <mesh position={[4.58, 1.9, 0]}>
        <boxGeometry args={[0.08, 3.8, 7.3]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.16}
        />
      </mesh>
      {/* Moldura metálica lateral direita */}
      <mesh position={[4.58, 3.75, 0]}>
        <boxGeometry args={[0.12, 0.1, 7.35]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>

      {/* Paredes Frontais de Vidro (Flanqueando a Entrada Aberta) */}
      {/* Painel Esquerdo Frontal */}
      <mesh position={[-3.1, 1.9, 3.65]}>
        <boxGeometry args={[2.95, 3.8, 0.08]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.16}
        />
      </mesh>
      <mesh position={[-3.1, 3.75, 3.65]}>
        <boxGeometry args={[3.0, 0.1, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>

      {/* Painel Direito Frontal */}
      <mesh position={[3.1, 1.9, 3.65]}>
        <boxGeometry args={[2.95, 3.8, 0.08]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.1}
          metalness={0.2}
          transparent
          opacity={0.16}
        />
      </mesh>
      <mesh position={[3.1, 3.75, 3.65]}>
        <boxGeometry args={[3.0, 0.1, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>

      {/* 5. PÓRTICO NEON DE ENTRADA (VÃO ABERTO DE 3.2M PARA PASSAGEM DO KART E PESSOAS) */}
      {/* Coluna Esquerda do Pórtico */}
      <mesh position={[-1.6, 1.9, 3.65]} castShadow>
        <boxGeometry args={[0.16, 3.8, 0.2]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Coluna Direita do Pórtico */}
      <mesh position={[1.6, 1.9, 3.65]} castShadow>
        <boxGeometry args={[0.16, 3.8, 0.2]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Viga Superior do Pórtico */}
      <mesh position={[0, 3.4, 3.65]} castShadow>
        <boxGeometry args={[3.36, 0.45, 0.24]} />
        <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Faixa Emissiva de LED no Pórtico */}
      <mesh position={[0, 3.16, 3.78]}>
        <boxGeometry args={[3.2, 0.04, 0.04]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={isSelected ? 3.0 : 1.5} />
      </mesh>

      {/* Placa Letreiro Holográfico da Entrada */}
      <Html
        position={[0, 3.4, 3.8]}
        transform
        scale={0.18}
        center
      >
        <div
          onClick={handleRoomClick}
          style={{
            cursor: 'pointer',
            background: isSelected ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.88)',
            border: `2px solid ${accentColor}`,
            boxShadow: `0 0 20px ${accentColor}${isSelected ? 'bb' : '55'}`,
            borderRadius: '16px',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
          title={`Clique para focar na sala do Setor ${sectorNumber}`}
        >
          <span style={{ fontSize: '18px' }}>{icon}</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: accentColor, letterSpacing: '0.5px' }}>
              SETOR {sectorNumber} • {sector.name.split(':')[1]?.trim().split(',')[0].slice(0, 20) || sector.name}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>
              5 Especialistas • Benchmark Ativo
            </div>
          </div>
        </div>
      </Html>

      {/* Plantas decorativas no canto da sala */}
      <OfficePlant position={[-3.8, 0, -2.8]} />
      <OfficePlant position={[3.8, 0, -2.8]} />

      {/* ===================================================================== */}
      {/* 6. AS 5 BANCADAS DE TRABALHO COMPLETAS E OS 5 ESPECIALISTAS ATIVOS */}
      {/* ===================================================================== */}

      {/* 6.1 TECH LEAD (ARQUITETO & HEAD DE ENGENHARIA DA SQUAD) */}
      {techLead && (
        <group>
          <WorkstationTable
            position={stations.techLead.tablePos}
            rotation={stations.techLead.tableRot}
            glowColor={techLead.accentColor || accentColor}
            agentId={techLead.id}
            deskProps={techLead.avatar?.deskProps}
            accessoryType="CLIPBOARD"
            activeProject={sector.name.split(':')[1]?.trim() || sector.name}
            activeTask={`Tech Lead • ${techLead.specialty}`}
            operationalState={techLead.operationalState || 'idle'}
            onClick={() => selectAgent(techLead)}
          />
          <OfficeChair
            position={stations.techLead.chairPos}
            rotation={stations.techLead.chairRot}
            color="#1e293b"
          />
          <Office3DAvatar
            position={stations.techLead.avatarPos}
            rotation={stations.techLead.avatarRot}
            avatar={techLead.avatar || AGENT_AVATAR_PROFILES['chief-of-staff']}
            operationalState={techLead.operationalState || 'idle'}
            speechBubble={getSpeech(techLead.id)}
            isSelected={selectedAgent?.id === techLead.id}
            currentProject={techLead.currentProject || sector.repos[0]}
            currentShiftTask={`Benchmarking: ${techLead.preferredModel}`}
            onClick={() => selectAgent(techLead)}
          />
        </group>
      )}

      {/* 6.2 FULLSTACK DEVELOPER (DESENVOLVIMENTO DE CÓDIGO E PIPELINE) */}
      {fullstackDev && (
        <group>
          <WorkstationTable
            position={stations.dev.tablePos}
            rotation={stations.dev.tableRot}
            glowColor={fullstackDev.accentColor || accentColor}
            agentId={fullstackDev.id}
            deskProps={fullstackDev.avatar?.deskProps}
            accessoryType="HEADPHONES"
            activeProject={sector.name.split(':')[1]?.trim() || sector.name}
            activeTask={`Full-Stack Dev • ${fullstackDev.specialty}`}
            operationalState={fullstackDev.operationalState || 'idle'}
            onClick={() => selectAgent(fullstackDev)}
          />
          <OfficeChair
            position={stations.dev.chairPos}
            rotation={stations.dev.chairRot}
            color="#1e293b"
          />
          <Office3DAvatar
            position={stations.dev.avatarPos}
            rotation={stations.dev.avatarRot}
            avatar={fullstackDev.avatar || AGENT_AVATAR_PROFILES['developer']}
            operationalState={fullstackDev.operationalState || 'idle'}
            speechBubble={getSpeech(fullstackDev.id)}
            isSelected={selectedAgent?.id === fullstackDev.id}
            currentProject={fullstackDev.currentProject || sector.repos[1] || sector.repos[0]}
            currentShiftTask={`Benchmarking: ${fullstackDev.preferredModel}`}
            onClick={() => selectAgent(fullstackDev)}
          />
        </group>
      )}

      {/* 6.3 QA & SECURITY (QUALIDADE, TESTES E AUDITORIA DE REPOSITÓRIO) */}
      {qaSec && (
        <group>
          <WorkstationTable
            position={stations.qa.tablePos}
            rotation={stations.qa.tableRot}
            glowColor={qaSec.accentColor || accentColor}
            agentId={qaSec.id}
            deskProps={qaSec.avatar?.deskProps}
            accessoryType="RUBBER_DUCKS"
            activeProject={sector.name.split(':')[1]?.trim() || sector.name}
            activeTask={`QA & Security • ${qaSec.specialty}`}
            operationalState={qaSec.operationalState || 'idle'}
            onClick={() => selectAgent(qaSec)}
          />
          <OfficeChair
            position={stations.qa.chairPos}
            rotation={stations.qa.chairRot}
            color="#1e293b"
          />
          <Office3DAvatar
            position={stations.qa.avatarPos}
            rotation={stations.qa.avatarRot}
            avatar={qaSec.avatar || AGENT_AVATAR_PROFILES['qa-engineer']}
            operationalState={qaSec.operationalState || 'idle'}
            speechBubble={getSpeech(qaSec.id)}
            isSelected={selectedAgent?.id === qaSec.id}
            currentProject={qaSec.currentProject || sector.repos[0]}
            currentShiftTask={`Benchmarking: ${qaSec.preferredModel}`}
            onClick={() => selectAgent(qaSec)}
          />
        </group>
      )}

      {/* 6.4 PRODUCT & 3D DESIGNER (UI/UX, MODELOS 3D E EXPERIÊNCIA) */}
      {productDesigner && (
        <group>
          <WorkstationTable
            position={stations.designer.tablePos}
            rotation={stations.designer.tableRot}
            glowColor={productDesigner.accentColor || accentColor}
            agentId={productDesigner.id}
            deskProps={productDesigner.avatar?.deskProps}
            accessoryType="NONE"
            activeProject={sector.name.split(':')[1]?.trim() || sector.name}
            activeTask={`Product & 3D Designer • ${productDesigner.specialty}`}
            operationalState={productDesigner.operationalState || 'idle'}
            onClick={() => selectAgent(productDesigner)}
          />
          <OfficeChair
            position={stations.designer.chairPos}
            rotation={stations.designer.chairRot}
            color="#1e293b"
          />
          <Office3DAvatar
            position={stations.designer.avatarPos}
            rotation={stations.designer.avatarRot}
            avatar={productDesigner.avatar || AGENT_AVATAR_PROFILES['image-designer']}
            operationalState={productDesigner.operationalState || 'idle'}
            speechBubble={getSpeech(productDesigner.id)}
            isSelected={selectedAgent?.id === productDesigner.id}
            currentProject={productDesigner.currentProject || sector.repos[2] || sector.repos[0]}
            currentShiftTask={`Benchmarking: ${productDesigner.preferredModel}`}
            onClick={() => selectAgent(productDesigner)}
          />
        </group>
      )}

      {/* 6.5 GROWTH & SALES (OPERAÇÃO DE CRESCIMENTO, ESCALA E MONETIZAÇÃO) */}
      {growthSales && (
        <group>
          <WorkstationTable
            position={stations.growth.tablePos}
            rotation={stations.growth.tableRot}
            glowColor={growthSales.accentColor || accentColor}
            agentId={growthSales.id}
            deskProps={growthSales.avatar?.deskProps}
            accessoryType="CLIPBOARD"
            activeProject={sector.name.split(':')[1]?.trim() || sector.name}
            activeTask={`Growth & Sales • ${growthSales.specialty}`}
            operationalState={growthSales.operationalState || 'idle'}
            onClick={() => selectAgent(growthSales)}
          />
          <OfficeChair
            position={stations.growth.chairPos}
            rotation={stations.growth.chairRot}
            color="#1e293b"
          />
          <Office3DAvatar
            position={stations.growth.avatarPos}
            rotation={stations.growth.avatarRot}
            avatar={growthSales.avatar || AGENT_AVATAR_PROFILES['growth-ops']}
            operationalState={growthSales.operationalState || 'idle'}
            speechBubble={getSpeech(growthSales.id)}
            isSelected={selectedAgent?.id === growthSales.id}
            currentProject={growthSales.currentProject || sector.repos[3] || sector.repos[0]}
            currentShiftTask={`Benchmarking: ${growthSales.preferredModel}`}
            onClick={() => selectAgent(growthSales)}
          />
        </group>
      )}
    </group>
  );
};
