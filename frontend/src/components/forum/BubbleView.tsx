"use client";

/**
 * BubbleView – 3D Visual Concept Map rendered with React Three Fiber.
 *
 * - Groups ForumThreads by cluster_id into ClusterNodes.
 * - Runs a D3-Force simulation (client-side, settles before first paint) to
 *   calculate 2D spread positions, then maps them into 3D space.
 * - Node radius  ∝ thread count in the cluster.
 * - Node glow    ∝ recency of the most-recently-created thread in the cluster.
 * - Clicking a node fires onClusterClick with the cluster_id so the parent
 *   can open the ClusterSheet.
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
import * as THREE from "three";
import * as d3 from "d3";

import type { ClusterNode, ForumThread } from "@/types/forum";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build ClusterNodes from a flat thread list, settling positions with D3. */
function buildClusterNodes(threads: ForumThread[]): ClusterNode[] {
  // Group threads by cluster_id; ungrouped threads form their own singleton clusters.
  const map = new Map<string, ForumThread[]>();
  for (const t of threads) {
    const key = t.cluster_id ?? t.id;
    const bucket = map.get(key) ?? [];
    bucket.push(t);
    map.set(key, bucket);
  }

  const nodes: (ClusterNode & d3.SimulationNodeDatum)[] = Array.from(
    map.entries(),
  ).map(([cluster_id, clusterThreads]) => ({
    cluster_id,
    threads: clusterThreads,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200,
  }));

  if (nodes.length === 0) return [];

  // Compute radii so D3 collision accounts for node sizes.
  const radiusFn = (n: (typeof nodes)[0]) =>
    Math.max(0.6, Math.sqrt(n.threads.length)) * 1.2 + 0.5;

  const sim = d3
    .forceSimulation(nodes)
    .force("charge", d3.forceManyBody().strength(-80))
    .force("center", d3.forceCenter(0, 0))
    .force(
      "collision",
      d3.forceCollide<(typeof nodes)[0]>().radius((n) => radiusFn(n) * 30 + 10),
    )
    .stop();

  // Run synchronously until the simulation fully cools (alpha < 0.001).
  const n = Math.ceil(
    Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay()),
  );
  for (let i = 0; i < n; i++) sim.tick();

  return nodes.map((n) => ({
    cluster_id: n.cluster_id,
    threads: n.threads,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));
}

/** Map a D3 pixel position to Three.js world units (scale down). */
const WORLD_SCALE = 0.04;

/** Map recency (0 = old, 1 = brand-new) to an emissive color on a cold→hot ramp. */
function recencyColor(t: number): THREE.Color {
  // t=0: deep blue  t=0.5: violet/magenta  t=1: hot amber/orange
  const r = Math.min(1, t * 2);
  const g = Math.max(0, t - 0.5) * 0.6;
  const b = Math.max(0, 1 - t * 2);
  return new THREE.Color(r, g, b);
}

// ── BubbleNode mesh ──────────────────────────────────────────────────────────

interface BubbleNodeProps {
  node: ClusterNode;
  recency: number; // 0-1
  onClick: (clusterId: string) => void;
}

function BubbleNode({ node, recency, onClick }: BubbleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const radius = Math.max(0.3, Math.sqrt(node.threads.length)) * 0.6 + 0.2;
  const x = node.x * WORLD_SCALE;
  const y = node.y * WORLD_SCALE;
  const baseColor = recencyColor(recency);
  const emissiveIntensity = 0.3 + recency * 1.4; // hotter nodes glow more

  // Gentle pulsing for "hot" nodes (recency > 0.6).
  useFrame(({ clock }) => {
    if (!matRef.current) return;
    if (recency > 0.6) {
      const pulse = Math.sin(clock.getElapsedTime() * 3) * 0.2;
      matRef.current.emissiveIntensity = emissiveIntensity + pulse;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.cluster_id);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
        if (matRef.current) matRef.current.emissiveIntensity += 0.4;
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
        if (matRef.current) matRef.current.emissiveIntensity = emissiveIntensity;
      }}
    >
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial
        ref={matRef}
        color={baseColor}
        emissive={baseColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.25}
        metalness={0.1}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}

// ── Orbit controller (no @react-three/drei) ─────────────────────────────────

interface OrbitControllerProps {
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
}: {
  nodes: ClusterNode[];
  recencyMap: Map<string, number>;
  onClusterClick: (id: string) => void;
  dragState: OrbitControllerProps["dragState"];
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!dragState.current.active) {
      // Auto-rotate when idle.
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
    camera.position.set(0, 0, 8);
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

  // Drag-orbit state lives in a ref so useFrame doesn't re-render.
  const dragState = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    rotX: 0,
    rotY: 0,
  });

  // Rebuild simulation when threads change.
  useEffect(() => {
    const built = buildClusterNodes(threads);
    setNodes(built);

    // Compute recency for each cluster (normalised 0-1 across all clusters).
    const maxTimes = built.map((n) =>
      Math.max(...n.threads.map((t) => new Date(t.created_at).getTime())),
    );
    const globalMin = Math.min(...maxTimes);
    const globalMax = Math.max(...maxTimes);
    const range = globalMax - globalMin || 1;

    const rMap = new Map<string, number>();
    built.forEach((n, i) => {
      rMap.set(n.cluster_id, (maxTimes[i] - globalMin) / range);
    });
    setRecencyMap(rMap);
  }, [threads]);

  // Pointer handlers for manual orbit.
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
      <Canvas>
        <CameraSetup />
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.2} />
        <pointLight position={[-5, -3, -5]} intensity={0.6} color="#4466ff" />
        <SceneGroup
          nodes={nodes}
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
