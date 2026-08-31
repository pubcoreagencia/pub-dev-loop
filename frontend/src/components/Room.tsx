import React from "react";
import { Html } from "@react-three/drei";
import type { RoomId } from "../types/agent";

interface Props {
  id: RoomId;
  name: string;
  position: [number, number, number];
  color?: string;
  isActive?: boolean;
}

export const Room: React.FC<Props> = ({ name, position, color = "#1b2030", isActive = false }) => {
  return (
    <group position={position}>
      {/* Floor Plate */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[9.5, 0.2, 8]} />
        <meshStandardMaterial
          color={isActive ? "#1e293b" : color}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Top Border Accent */}
      <mesh position={[0, 0.02, 0]}>
        <ringGeometry args={[3.8, 3.85, 32]} />
        <meshBasicMaterial
          color={isActive ? "#3b82f6" : "#334155"}
          wireframe
        />
      </mesh>

      {/* Room Label */}
      <Html position={[0, 0.2, -3.2]} center distanceFactor={22}>
        <div
          style={{
            background: isActive ? "rgba(30, 41, 59, 0.95)" : "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            border: `1px solid ${isActive ? "#60a5fa" : "#334155"}`,
            color: isActive ? "#93c5fd" : "#94a3b8",
            padding: "4px 12px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
            boxShadow: isActive ? "0 0 15px rgba(59, 130, 246, 0.4)" : "none",
          }}
        >
          {name}
        </div>
      </Html>
    </group>
  );
};
