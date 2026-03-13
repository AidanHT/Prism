/** Shared TypeScript types for the forum/discussions feature. */

export interface ForumThread {
  id: string;
  course_id: string;
  title: string;
  cluster_id: string | null;
  vector_embedding_id: string | null;
  created_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  timestamp: string;
}

export interface TaEvaluation {
  is_accurate: boolean;
  /** 1 (blunt) → 10 (perfectly encouraging) */
  tone_score: number;
  suggested_edits: string;
}

export interface AddToBrainResponse {
  doc_id: string;
  message: string;
}

/** Minimal thread summary returned inside a ForumClusterResponse. */
export interface ClusterThreadSummary {
  id: string;
  title: string;
  created_at: string;
}

/** Server-side semantic cluster returned by GET /forum/clusters. */
export interface ForumClusterResponse {
  cluster_id: string;
  representative_topic: string;
  frequency_weight: number;
  x: number;
  y: number;
  z: number;
  threads: ClusterThreadSummary[];
}

/** AI-synthesised summary for a specific cluster. */
export interface ClusterSummaryResponse {
  cluster_id: string;
  representative_topic: string;
  summary: string;
  thread_count: number;
}

/**
 * Client-side cluster node used by BubbleView for D3/Three.js rendering.
 * Derived from ForumClusterResponse with full ForumThread objects attached.
 */
export interface ClusterNode {
  cluster_id: string;
  representative_topic: string;
  frequency_weight: number;
  threads: ClusterThreadSummary[];
  /** 3D X position from server (world units). */
  x: number;
  /** 3D Y position from server (world units). */
  y: number;
  /** 3D Z position from server (depth parallax). */
  z: number;
}
