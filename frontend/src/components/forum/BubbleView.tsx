"use client";

/**
 * BubbleView – 3D Visual Concept Map rendered with React Three Fiber.
 *
 * - Groups ForumThreads by cluster_id into ClusterNodes.
 * - Runs a D3-Force simulation (client-side, settles before first paint) to
 *   calculate spread positions, then maps them into 3D space with Z depth.
 * - Node radius  ∝ thread count in the cluster.
 * - Node glow    ∝ recency of the most-recently-created thread in the cluster.
 * - MeshPhysicalMaterial provides clearcoat gloss + emissive glow on hot nodes.
 * - drei <Html> renders flat, no-gradient tooltip overlays on hover.
 * - Clicking a node fires onClusterClick with the cluster_id so the parent
 *   can open the TopicSummarySheet.
 * - The scene auto-rotates slowly; drag the canvas to orbit manually.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import * as d3 from "d3";

import type { ClusterNode, ForumThread } from "@/types/forum";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build ClusterNodes from a flat thread list, settling positions with D3. */
function buildClusterNodes(threads: ForumThread[]): ClusterNode[] {
  const map = new Map<string, ForumThread[]>();
  for (const t of threads) {
    const key = t.cluster_id ?? t.id;
    const bucket = map.get(key) ?? [];
    bucket.push(t);
    map.set(key, bucket);
  }

  const nodes: (ClusterNode & d3.SimulationNodeDatum & { z: number })[] =
    Array.from(map.entries()).map(([cluster_id, clusterThreads]) => ({
      cluster_id,
      threads: clusterThreads,
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      z: (Math.random() - 0.5) * 2, // shallow Z spread for depth parallax
    }));

  if (nodes.length === 0) return [];

  const radiusFn = (n: (typeof nodes)[0]) =>
    Math.max(0.6, Math.sqrt(n.threads.length)) * 1.2 + 0.5;

  const sim = d3
    .forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-120))
    .force("center", d3.forceCenter(0, 0))
    .force("x", d3.forceX(0).strength(0.05))
    .force("y", d3.forceY(0).strength(0.05))
    .force(
      "collision",
      d3.forceCollide<(typeof nodes)[0]>().radius((n) => radiusFn(n) * 35 + 15),
    )
    .stop();

  const iterations = Math.ceil(
    Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()),
  );
  for (let i = 0; i < iterations; i++) sim.tick();

  return nodes.map((n) => ({
    cluster_id: n.cluster_id,
    threads: n.threads,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));
}

/** Map a D3 pixel position to Three.js world units. */
const WORLD_SCALE = 0.04;

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

/** Derive a short, readable label from the cluster_id or thread titles. */
function clusterLabel(node: ClusterNode): string {
  if (node.threads.length > 0) {
    const title = node.threads[0].title;
    return title.length > 36 ? title.slice(0, 33) + "…" : title;
  }
  return node.cluster_id.slice(0, 8);
}

// ── BubbleNode mesh ──────────────────────────────────────────────────────────

interface BubbleNodeProps {
  node: ClusterNode;
  recency: number; // 0-1
  zOffset: number;
  onClick: (clusterId: string) => void;
}

function BubbleNode({ node, recency, zOffset, onClick }: BubbleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const radius = Math.max(0.3, Math.sqrt(node.threads.length)) * 0.6 + 0.2;
  const x = node.x * WORLD_SCALE;
  const y = node.y * WORLD_SCALE;
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
      position={[x, y, zOffset]}
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
  zOffsets: Map<string, number>;
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
  zOffsets,
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
          zOffset={zOffsets.get(node.cluster_id) ?? 0}
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
  threads: ForumThread[];
  onClusterClick: (clusterId: string) => void;
}

export function BubbleView({ threads, onClusterClick }: BubbleViewProps) {
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [recencyMap, setRecencyMap] = useState<Map<string, number>>(new Map());
  const [zOffsets, setZOffsets] = useState<Map<string, number>>(new Map());

  const dragState = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    rotX: 0,
    rotY: 0,
  });

  useEffect(() => {
    const built = buildClusterNodes(threads);
    setNodes(built);

    const maxTimes = built.map((n) =>
      Math.max(...n.threads.map((t) => new Date(t.created_at).getTime())),
    );
    const globalMin = Math.min(...maxTimes);
    const globalMax = Math.max(...maxTimes);
    const range = globalMax - globalMin || 1;

    const rMap = new Map<string, number>();
    const zMap = new Map<string, number>();
    built.forEach((n, i) => {
      rMap.set(n.cluster_id, (maxTimes[i] - globalMin) / range);
      // Spread Z so nodes at different depths create parallax
      zMap.set(n.cluster_id, (Math.random() - 0.5) * 2.5);
    });
    setRecencyMap(rMap);
    setZOffsets(zMap);
  }, [threads]);

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

  if (nodes.length === 0) {
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
          nodes={nodes}
          recencyMap={recencyMap}
          zOffsets={zOffsets}
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
