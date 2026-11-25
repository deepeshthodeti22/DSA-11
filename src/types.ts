export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  major: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface Topic {
  id: number;
  title: string;
  subject: string;
  subject_id: number;
  subject_code: string;
  difficulty: number;
  estimated_minutes: number;
  base_weight: number;
  description: string;
  lesson_content: string;
  pos_x: number;
  pos_y: number;
  is_core: number;
  mastery: number;
  status: string;
  derived_status: 'completed' | 'in_progress' | 'pending' | 'locked';
  attempts: number;
  last_assessed_at: number;
  unlocked: boolean;
  bfs_level?: number;
  prereq_ids: number[];
}

export interface PrereqEdge {
  from_id: number;
  to_id: number;
  weight: number;
}

export interface AssessmentRecord {
  id: number;
  topic_id: number;
  topic_title: string;
  score: number;
  correct_count: number;
  total_count: number;
  mastery_before: number;
  mastery_after: number;
  duration_sec: number;
  timestamp: number;
}

export interface WeakRecommendation {
  topic_id: number;
  title: string;
  subject: string;
  mastery: number;
  urgency: number;
  estimated_minutes: number;
  reason: string;
}

export interface DagData {
  is_valid_dag: boolean;
  node_count: number;
  edge_count: number;
  nodes: Array<{
    id: number;
    title: string;
    subject: string;
    difficulty: number;
    estimated_minutes: number;
    mastery: number;
    unlocked: boolean;
    in_degree: number;
    out_degree: number;
    bfs_level: number;
    status: string;
    pos_x: number;
    pos_y: number;
  }>;
  edges: Array<{
    from: number;
    to: number;
    weight: number;
    satisfied: boolean;
  }>;
  topological_order: Array<{
    id: number;
    title: string;
    unlocked: boolean;
    mastery: number;
  }>;
  bfs_traversal: Array<{
    step: number;
    id: number;
    title: string;
    level: number;
    parent_id: number;
  }>;
  bfs_edges: Array<{
    from: number;
    to: number;
    level: number;
  }>;
}

export interface AvlTreeNode {
  topic_id: number;
  title: string;
  priority_score: number;
  mastery: number;
  mastery_gap: number;
  height: number;
  balance_factor: number;
  left: AvlTreeNode | null;
  right: AvlTreeNode | null;
}

export interface AvlData {
  tree_height: number;
  node_count: number;
  rotation_count: number;
  root: AvlTreeNode | null;
  rotations: Array<{
    type: 'LL' | 'RR' | 'LR' | 'RL';
    pivot_topic_id: number;
    pivot_title: string;
    pivot_key: number;
    new_root_topic_id: number;
    detail: string;
  }>;
  schedule: Array<{
    rank: number;
    topic_id: number;
    title: string;
    priority_score: number;
    mastery: number;
    mastery_gap: number;
  }>;
  search_result: {
    found_topic_id: number;
    summary: string;
    visited_ids: number[];
  };
}

export interface BstTreeNode {
  id: number;
  topic_id: number;
  topic_title: string;
  score: number;
  mastery_after: number;
  timestamp: number;
  left: BstTreeNode | null;
  right: BstTreeNode | null;
}

export interface BstData {
  node_count: number;
  tree_height: number;
  average_score: number;
  improvement_slope: number;
  root: BstTreeNode | null;
  inorder: Array<{
    id: number;
    topic_id: number;
    topic_title: string;
    score: number;
    mastery_after: number;
    timestamp: number;
  }>;
  preorder_ids: number[];
  postorder_ids: number[];
  search_result: {
    matched_id: number;
    summary: string;
    visited_ids: number[];
    range_ids: number[];
  };
}

export interface HeapItem {
  index: number;
  topic_id: number;
  title: string;
  mastery: number;
  urgency: number;
  unlocked: boolean;
}

export interface HeapData {
  size: number;
  heap_array: HeapItem[];
  extracted: HeapItem[];
  steps: Array<{
    op: string;
    idx_a: number;
    idx_b: number;
    detail: string;
    snapshot: HeapItem[];
  }>;
}

export interface DijkstraData {
  start_id: number;
  target_id: number;
  reachable: boolean;
  total_cost: number;
  path: Array<{
    id: number;
    title: string;
    dist: number;
    mastery: number;
    unlocked: boolean;
  }>;
  distances: Array<{
    topic_id: number;
    dist: number;
    reachable: boolean;
    prev_id: number;
  }>;
  steps: Array<{
    action: 'init' | 'pop_min' | 'relax' | 'skip_locked';
    from_id: number;
    to_id: number;
    weight: number;
    new_dist: number;
    detail: string;
  }>;
}

export interface LinkedListData {
  length: number;
  head_id: number;
  tail_id: number;
  current_id: number;
  completed_count: number;
  pending_count: number;
  locked_count: number;
  operation_summary: string;
  nodes: Array<{
    position: number;
    topic_id: number;
    title: string;
    mastery: number;
    status: string;
    prev_id: number;
    next_id: number;
    is_current: boolean;
  }>;
}

export interface EngineOutput {
  dag: DagData;
  avl: AvlData;
  bst: BstData;
  heap: HeapData;
  dijkstra: DijkstraData;
  linked_list: LinkedListData;
  summary: {
    overall_mastery: number;
    total_topics: number;
    completed_topics: number;
    pending_topics: number;
    locked_topics: number;
  };
}

export interface DashboardPayload {
  user: User;
  subjects: Subject[];
  topics: Topic[];
  edges: PrereqEdge[];
  assessments: AssessmentRecord[];
  all_assessments: AssessmentRecord[];
  weak_recommendations: WeakRecommendation[];
  next_activity: WeakRecommendation | null;
  engine: EngineOutput;
}

export interface QuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  hint: string;
  difficulty: number;
}
