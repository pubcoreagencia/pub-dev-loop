import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Room } from "../components/Room";
import { AgentMarker } from "../components/AgentMarker";
import { useStore } from "../store/useStore";
import { ROOM_COORDINATES } from "../services/agentAdapter";
import type { RoomId } from "../types/agent";

const ROOMS_CONFIG: { id: RoomId; name: string; position: [number, number, number] }[] = [
  { id: "PLANEJAMENTO", name: "Planejamento", position: ROOM_COORDINATES.PLANEJAMENTO },
  { id: "DESENVOLVIMENTO", name: "Desenvolvimento", position: ROOM_COORDINATES.DESENVOLVIMENTO },
  { id: "TESTES", name: "Testes", position: ROOM_COORDINATES.TESTES },
  { id: "REVISÃO", name: "Revisão", position: ROOM_COORDINATES.REVISÃO },
  { id: "LOUNGE", name: "Lounge", position: ROOM_COORDINATES.LOUNGE },
  { id: "BLOQUEADOS", name: "Bloqueados", position: ROOM_COORDINATES.BLOQUEADOS },
];

export const OfficeScene: React.FC = () => {
  const { agents, selectedAgent, selectAgent } = useStore();

  // Active rooms with agents in them
  const activeRooms = new Set(agents.map((a) => a.room));

  return (
    <Canvas
      style={{ height: "100%", width: "100%", background: "#0b0f19" }}
      camera={{ position: [0, 22, 24], fov: 45 }}
    >
      <PerspectiveCamera makeDefault position={[0, 22, 24]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[10, 25, 10]} intensity={1.2} castShadow />
      <pointLight position={[0, 10, 0]} intensity={0.8} color="#93c5fd" />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.1}
        minDistance={8}
        maxDistance={50}
      />

      {/* Grid Floor */}
      <gridHelper args={[40, 40, "#1e293b", "#0f172a"]} position={[0, -0.2, 0]} />

      {/* Virtual Office Rooms */}
      {ROOMS_CONFIG.map((r) => (
        <Room
          key={r.id}
          id={r.id}
          name={r.name}
          position={r.position}
          isActive={activeRooms.has(r.id)}
        />
      ))}

      {/* Real Agents Rendered in their Assigned Rooms */}
      {agents.map((agent, index) => {
        const baseCoord = ROOM_COORDINATES[agent.room] || [0, 0, 0];
        // Calculate offset if multiple agents in same room
        const roomAgents = agents.filter((a) => a.room === agent.room);
        const agentIndexInRoom = roomAgents.findIndex((a) => a.id === agent.id);
        const offsetX = (agentIndexInRoom - (roomAgents.length - 1) / 2) * 2.0;

        const agentPos: [number, number, number] = [
          baseCoord[0] + offsetX,
          baseCoord[1],
          baseCoord[2],
        ];

        return (
          <AgentMarker
            key={agent.id || index}
            agent={agent}
            position={agentPos}
            isSelected={selectedAgent?.id === agent.id}
            onSelect={selectAgent}
          />
        );
      })}
    </Canvas>
  );
};
