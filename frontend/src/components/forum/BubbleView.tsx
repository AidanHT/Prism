"use client";

/**
 * BubbleView – 3D Visual Concept Map rendered with React Three Fiber.
 *
 * Receives pre-computed ClusterNode[] from the server (GET /forum/clusters).
 * - Node radius  ∝ frequency_weight (normalised 0-1 from thread count).
 * - Node glow    ∝ recency of the most-recently-created thread in the cluster.
 * - MeshPhysicalMaterial provides clearcoat gloss + emissive glow on hot nodes.
 * - drei <Html> renders flat, no-gradient tooltip overlays on hover.
 * - Clicking a node fires onClusterClick with the cluster_id so the parent
 *   can open the TopicSummarySheet.
 * - The scene auto-rotates slowly; drag the canvas to orbit manually.
 */

import {
  useRef,
  useState,
  useCallback,
  type PointerEvent,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useEffect } from "react";

import type { ClusterNode } from "@/types/forum";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map recency (0 = old, 1 = brand-new) to a rich emissive color ramp.
 * cold blue → electric indigo → hot amber  (3D only — permitted gradient zone)
 */
function recencyColor(t: number): THREE.Color {
  const r = Math.min(1, t * 2);
  const g = Math.max(0, t - 0.5) * 0.6;
  const b = Math.max(0, 1 - t * 2);
  return new THREE.Color(r, g, b);
}

/** Derive a short, readable label from the representative_topic. */
function clusterLabel(node: ClusterNode): string {
  const topic = node.representative_topic;
  return topic.length > 36 ? topic.slice(0, 33) + "…" : topic;
}

/** Compute per-node recency (0-1) from thread created_at timestamps. */
function buildRecencyMap(nodes: ClusterNode[]): Map<string, number> {
  if (nodes.length === 0) return new Map();

  const maxTimes = nodes.map((n) =>
    Math.max(...n.threads.map((t) => new Date(t.created_at).getTime())),
  );
  const globalMin = Math.min(...maxTimes);
  const globalMax = Math.max(...maxTimes);
  const range = globalMax - globalMin || 1;

  const rMap = new Map<string, number>();
  nodes.forEach((n, i) => {
    rMap.set(n.cluster_id, (maxTimes[i] - globalMin) / range);
  });
  return rMap;
}

// ── BubbleNode mesh ──────────────────────────────────────────────────────────

interface BubbleNodeProps {
  node: ClusterNode;
  recency: number; // 0-1
  onClick: (clusterId: string) => void;
}

function BubbleNode({ node, recency, onClick }: BubbleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const [hovered, setHovered] = useState(false);

  // Radius derived from server-provided frequency_weight (0-1).
  const radius = 0.3 + node.frequency_weight * 0.9;
  const baseColor = recencyColor(recency);
  const baseEmissive = 0.3 + recency * 1.4;
  const isHot = recency > 0.6;

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (isHot) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.25;
      matRef.current.emissiveIntensity = baseEmissive + pulse;
    }
  });

  const label = clusterLabel(node);

  return (
    <mesh
      ref={meshRef}
      position={[node.x, node.y, node.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.cluster_id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        setHovered(true);
        if (matRef.current) matRef.current.emissiveIntensity = baseEmissive + 0.5;
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
        setHovered(false);
        if (matRef.current) matRef.current.emissiveIntensity = baseEmissive;
      }}
    >
      <sphereGeometry args={[radius, 64, 64]} />
      <meshPhysicalMaterial
        ref={matRef}
        color={baseColor}
        emissive={baseColor}
        emissiveIntensity={baseEmissive}
        roughness={0.15}
        metalness={0.05}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transmission={0.2}
        ior={1.5}
        transparent
        opacity={0.9}
      />

      {/* Flat HTML tooltip — no gradients, solid bg/border only */}
      {hovered && (
        <Html distanceFactor={6} center zIndexRange={[100, 0]}>
          <div
            style={{
              pointerEvents: "none",
              background: "var(--color-card, #fff)",
              border: "1px solid var(--color-border, #e2e8f0)",
              borderRadius: "6px",
              padding: "8px 12px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              minWidth: "140px",
              maxWidth: "220px",
              whiteSpace: "nowrap",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-foreground, #0f172a)",
                marginBottom: "3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "var(--color-muted-foreground, #64748b)",
              }}
            >
              {node.threads.length} thread{node.threads.length !== 1 ? "s" : ""}
              {isHot ? " · Active" : ""}
            </p>
          </div>
        </Html>
      )}
    </mesh>
  );
}

// ── Scene group with auto-rotation and manual orbit ──────────────────────────

interface SceneGroupProps {
  nodes: ClusterNode[];
  recencyMap: Map<string, number>;
  onClusterClick: (id: string) => void;
  dragState: React.MutableRefObject<{
    active: boolean;
    lastX: number;
    lastY: number;
    rotX: number;
    rotY: number;
  }>;
}

function SceneGroup({
  nodes,
  recencyMap,
  onClusterClick,
  dragState,
}: SceneGroupProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!dragState.current.active) {
      dragState.current.rotY += 0.002;
    }
    groupRef.current.rotation.x = dragState.current.rotX;
    groupRef.current.rotation.y = dragState.current.rotY;
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => (
        <BubbleNode
          key={node.cluster_id}
          node={node}
          recency={recencyMap.get(node.cluster_id) ?? 0}
          onClick={onClusterClick}
        />
      ))}
    </group>
  );
}

function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ── Public component ─────────────────────────────────────────────────────────

interface BubbleViewProps {
  clusters: ClusterNode[];
  onClusterClick: (clusterId: string) => void;
}

export function BubbleView({ clusters, onClusterClick }: BubbleViewProps) {
  const recencyMap = buildRecencyMap(clusters);

  const dragState = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    rotX: 0,
    rotY: 0,
  });

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragState.current.active = true;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
  }, []);

  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    dragState.current.rotY += dx * 0.005;
    dragState.current.rotX += dy * 0.005;
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current.active = false;
  }, []);

  if (clusters.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">No clusters yet — post a question to seed the map.</p>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
        <CameraSetup />
        <ambientLight intensity={0.5} />
        <pointLight position={[6, 6, 6]} intensity={1.5} />
        <pointLight position={[-5, -4, -5]} intensity={0.8} color="#4466ff" />
        <pointLight position={[0, -6, 4]} intensity={0.4} color="#ffffff" />
        <SceneGroup
          nodes={clusters}
          recencyMap={recencyMap}
          onClusterClick={onClusterClick}
          dragState={dragState}
        />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 right-4 text-xs text-muted-foreground/60 select-none">
        Drag to orbit · Click a bubble to explore
      </p>
    </div>
  );
}
