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

/** Derived from ForumThread[] — one node per semantic cluster in the Bubble View. */
export interface ClusterNode {
  cluster_id: string;
  threads: ForumThread[];
  /** Settled D3-Force X position (pixels, centred on 0). */
  x: number;
  /** Settled D3-Force Y position (pixels, centred on 0). */
  y: number;
}
