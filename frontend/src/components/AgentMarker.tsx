import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Mesh } from "three";
import type { Agent } from "../types/agent";
import type { TaskState } from "../types/task";
import { STATE_LABELS_PT } from "../services/agentAdapter";

interface Props {
  agent: Agent;
  position: [number, number, number];
  isSelected?: boolean;
  isProjectContextual?: boolean;
  onSelect: (agent: Agent) => void;
}

const colorMap: Record<TaskState, string> = {
  QUEUED: "#94a3b8",
  ASSIGNED: "#3b82f6",
  RUNNING: "#f59e0b",
  TESTING: "#a855f7",
  COMPLETED: "#10b981",
  FAILED: "#ef4444",
  BLOCKED: "#b45309",
  CANCELLED: "#475569",
  NEEDS_REVIEW: "#eab308",
};

export const AgentMarker: React.FC<Props> = ({
  agent,
  position,
  isSelected = false,
  isProjectContextual = false,
  onSelect,
}) => {
  const meshRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  const mainColor = colorMap[agent.state] ?? "#3b82f6";
  const stateLabel = STATE_LABELS_PT[agent.state] ?? agent.state;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + 1.0 + Math.sin(t * 2) * 0.15;
      meshRef.current.rotation.y = t * 0.8;
    }
    if (ringRef.current) {
      const s = (isProjectContextual ? 1.2 : 1.0) + Math.sin(t * (isProjectContextual ? 4 : 3)) * 0.18;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={position}>
      {/* Floor Pulse Ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      >
        <ringGeometry args={[isProjectContextual ? 0.8 : 0.7, isProjectContextual ? 1.05 : 0.85, 32]} />
        <meshBasicMaterial
          color={isProjectContextual ? "#60a5fa" : mainColor}
          transparent
          opacity={isSelected ? 0.95 : isProjectContextual ? 0.85 : 0.6}
        />
      </mesh>

      {/* Floating Agent Sphere Avatar */}
      <mesh
        ref={meshRef}
        position={[0, 1.0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent);
        }}
        castShadow
      >
        <sphereGeometry args={[isProjectContextual ? 0.65 : 0.55, 32, 32]} />
        <meshStandardMaterial
          color={mainColor}
          emissive={isProjectContextual ? "#3b82f6" : mainColor}
          emissiveIntensity={isSelected ? 0.7 : isProjectContextual ? 0.5 : 0.3}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>

      {/* Floating Badge Header */}
      <Html position={[0, isProjectContextual ? 2.4 : 2.2, 0]} center distanceFactor={18}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect(agent);
          }}
          style={{
            cursor: "pointer",
            background: isSelected
              ? "rgba(15, 23, 42, 0.95)"
              : "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            border: `2px solid ${isSelected ? "#60a5fa" : isProjectContextual ? "#3b82f6" : mainColor}`,
            padding: "5px 10px",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "11px",
            fontWeight: "bold",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            whiteSpace: "nowrap",
            boxShadow: `0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px ${isProjectContextual ? "#3b82f6" : mainColor}44`,
            transform: isSelected ? "scale(1.12)" : isProjectContextual ? "scale(1.05)" : "scale(1)",
            transition: "transform 0.2s ease",
          }}
        >
          {isProjectContextual && (
            <div style={{ fontSize: "9px", color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ⚡ PROJETO ATIVO
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: mainColor,
                display: "inline-block",
                boxShadow: `0 0 6px ${mainColor}`,
              }}
            />
            <span style={{ color: "#f8fafc", fontSize: "12px" }}>{agent.name}</span>
          </div>
          <div style={{ fontSize: "10px", color: mainColor, fontWeight: 600 }}>
            {stateLabel}
          </div>
        </div>
      </Html>
    </group>
  );
};
