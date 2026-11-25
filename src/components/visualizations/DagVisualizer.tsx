import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, RotateCcw, CheckCircle2, Lock } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { DagData, Topic } from '../../types';

interface DagVisualizerProps {
  initialDag: DagData;
  topics: Topic[];
  onStartQuiz: (topicId: number) => void;
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({
  initialDag,
  topics,
  onStartQuiz,
}) => {
  const [dag, setDag] = useState<DagData>(initialDag);
  const [bfsStartId, setBfsStartId] = useState<number>(-1);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [bfsStep, setBfsStep] = useState<number>(initialDag.bfs_traversal.length);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDag(initialDag);
    setBfsStep(initialDag.bfs_traversal.length);
  }, [initialDag]);

  useEffect(() => {
    if (!playing) return;
    if (bfsStep >= dag.bfs_traversal.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setBfsStep((s) => Math.min(dag.bfs_traversal.length, s + 1));
    }, 550);
    return () => clearTimeout(timer);
  }, [playing, bfsStep, dag.bfs_traversal.length]);

  const handleRunBfs = async (startId: number) => {
    setLoading(true);
    setPlaying(false);
    try {
      const res = await apiFetch<{ dag: DagData }>('/api/engine/dag', {
        method: 'POST',
        body: JSON.stringify({ bfs_start_id: startId }),
      });
      setDag(res.dag);
      setBfsStep(1);
      setPlaying(true);
    } finally {
      setLoading(false);
    }
  };

  const visitedSet = new Set(dag.bfs_traversal.slice(0, bfsStep).map((s) => s.id));
  const activeStepNode = bfsStep > 0 ? dag.bfs_traversal[bfsStep - 1] : null;

  const nodeMap = new Map(dag.nodes.map((n) => [n.id, n]));
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;
  const selectedTopic = selectedNodeId ? topics.find((t) => t.id === selectedNodeId) : null;

  /* Compute auto-layout bounds */
  const maxX = Math.max(980, ...dag.nodes.map((n) => n.pos_x + 140));
  const maxY = Math.max(540, ...dag.nodes.map((n) => n.pos_y + 90));

  return (
    <div className="space-y-6">
      {/* Control Deck */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#0f172a]">
            Knowledge DAG &amp; Breadth-First Traversal
          </h2>
          <p className="text-xs text-[#64748b]">
            Executed in C (`dag.c`) · Acyclicity: {dag.is_valid_dag ? 'Verified DAG' : 'Cycle Detected'} · {dag.node_count} topics · {dag.edge_count} prerequisite edges
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={bfsStartId}
            onChange={(e) => setBfsStartId(Number(e.target.value))}
            aria-label="BFS starting node"
            className="px-3 py-1.5 text-xs bg-white border border-[#e2e8f0] rounded text-[#1e293b]"
          >
            <option value={-1}>All Root Prerequisites (Level 0)</option>
            {dag.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                Start from: {n.title}
              </option>
            ))}
          </select>

          <button
            disabled={loading}
            onClick={() => handleRunBfs(bfsStartId)}
            className="px-3.5 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer"
          >
            Run C BFS
          </button>

          <div className="flex items-center border border-[#e2e8f0] rounded overflow-hidden">
            <button
              onClick={() => setPlaying((p) => !p)}
              title={playing ? 'Pause BFS' : 'Play BFS'}
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] cursor-pointer"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setBfsStep((s) => Math.min(dag.bfs_traversal.length, s + 1));
              }}
              title="Step forward"
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setBfsStep(0);
              }}
              title="Reset BFS"
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Zone Split: SVG Canvas + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] overflow-x-auto">
          <svg
            viewBox={`0 0 ${maxX} ${maxY}`}
            className="w-full min-w-[760px] h-[470px]"
            role="img"
            aria-label="Knowledge DAG visualization"
          >
            <defs>
              <marker
                id="arrow-satisfied"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
              </marker>
              <marker
                id="arrow-pending"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
              </marker>
              <marker
                id="arrow-bfs"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e3a8a" />
              </marker>
            </defs>

            {/* Prerequisite Edges */}
            {dag.edges.map((edge, idx) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;

              const dx = to.pos_x - from.pos_x;
              const dy = to.pos_y - from.pos_y;
              const dist = Math.hypot(dx, dy) || 1;
              const startX = from.pos_x + (dx / dist) * 66;
              const startY = from.pos_y + (dy / dist) * 26;
              const endX = to.pos_x - (dx / dist) * 68;
              const endY = to.pos_y - (dy / dist) * 28;

              const isBfsEdge = dag.bfs_edges.some(
                (be) => be.from === edge.from && be.to === edge.to && visitedSet.has(be.to)
              );

              const stroke = isBfsEdge
                ? '#1e3a8a'
                : edge.satisfied
                ? '#059669'
                : '#cbd5e1';
              const marker = isBfsEdge
                ? 'url(#arrow-bfs)'
                : edge.satisfied
                ? 'url(#arrow-satisfied)'
                : 'url(#arrow-pending)';

              return (
                <g key={`${edge.from}-${edge.to}-${idx}`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={stroke}
                    strokeWidth={isBfsEdge ? 2.2 : 1.5}
                    markerEnd={marker}
                  />
                </g>
              );
            })}

            {/* Topic Nodes */}
            {dag.nodes.map((node) => {
              const isVisited = visitedSet.has(node.id);
              const isActive = activeStepNode?.id === node.id;
              const isSelected = selectedNodeId === node.id;

              let fill = '#ffffff';
              let stroke = '#cbd5e1';
              if (node.mastery >= 70) {
                fill = '#f0fdf4';
                stroke = '#059669';
              } else if (node.unlocked) {
                fill = '#ffffff';
                stroke = '#1e3a8a';
              } else {
                fill = '#f8fafc';
                stroke = '#cbd5e1';
              }
              if (isActive || isSelected) {
                stroke = '#00236f';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.pos_x - 68}, ${node.pos_y - 26})`}
                  onClick={() => setSelectedNodeId(node.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width={136}
                    height={52}
                    rx={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isActive || isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={10}
                    y={20}
                    className="fill-[#0f172a] text-[11px] font-semibold"
                  >
                    {node.title.length > 18 ? `${node.title.slice(0, 17)}…` : node.title}
                  </text>
                  <text
                    x={10}
                    y={38}
                    className="fill-[#475569] text-[10px] font-mono tabular-nums"
                  >
                    {node.mastery.toFixed(0)}% · {node.unlocked ? 'Unlocked' : 'Locked'}
                  </text>
                  {isVisited && node.bfs_level >= 0 && (
                    <g transform="translate(114, -8)">
                      <rect width={26} height={16} rx={4} fill="#1e3a8a" />
                      <text
                        x={13}
                        y={11}
                        textAnchor="middle"
                        className="fill-white text-[9px] font-mono"
                      >
                        L{node.bfs_level}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="mt-3 pt-3 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#f0fdf4] border border-[#059669] inline-block" />
                Mastered (&ge;70%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-white border border-[#1e3a8a] inline-block" />
                Unlocked Frontier
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#f8fafc] border border-[#cbd5e1] inline-block" />
                Locked
              </span>
            </div>
            <span className="font-mono tabular-nums">
              BFS Step {bfsStep} / {dag.bfs_traversal.length}
            </span>
          </div>
        </div>

        {/* Right Side: Selected Node Inspector + Topological Order */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-3">Node Inspector</h3>
            {selectedNode ? (
              <div className="space-y-3">
                <div>
                  <div className="text-base font-semibold text-[#0f172a]">{selectedNode.title}</div>
                  <div className="text-xs text-[#64748b]">
                    {selectedNode.subject} · In-degree {selectedNode.in_degree} · Out-degree{' '}
                    {selectedNode.out_degree}
                  </div>
                </div>
                <div className="text-xs text-[#475569]">
                  {selectedTopic?.description}
                </div>
                <div className="flex items-center justify-between text-xs font-mono bg-[#f8fafc] border border-[#e2e8f0] rounded p-2.5">
                  <span>Mastery: {selectedNode.mastery.toFixed(1)}%</span>
                  <span className={selectedNode.unlocked ? 'text-[#059669]' : 'text-[#64748b]'}>
                    {selectedNode.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                {selectedNode.unlocked ? (
                  <button
                    onClick={() => onStartQuiz(selectedNode.id)}
                    className="w-full py-2 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded cursor-pointer"
                  >
                    Open Topic &amp; Assessment
                  </button>
                ) : (
                  <div className="text-xs text-[#64748b] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Satisfy all incoming prerequisite edges (&ge;70%) to unlock.</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#64748b]">
                Click any node in the DAG to inspect its prerequisite degrees, mastery, and unlock status.
              </p>
            )}
          </div>

          {/* Topological Sequence from Kahn's Algorithm */}
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-1">
              Kahn Topological Sequence
            </h3>
            <p className="text-xs text-[#64748b] mb-3">
              Valid dependency-respecting study order computed in C
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {dag.topological_order.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedNodeId(item.id)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded border border-[#f1f5f9] hover:bg-[#f8fafc] text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[#64748b] tabular-nums w-5">
                      {idx + 1}.
                    </span>
                    <span className="truncate font-medium text-[#0f172a]">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                    <span className={item.mastery >= 70 ? 'text-[#059669]' : 'text-[#475569]'}>
                      {item.mastery.toFixed(0)}%
                    </span>
                    {item.mastery >= 70 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                    ) : !item.unlocked ? (
                      <Lock className="w-3.5 h-3.5 text-[#94a3b8]" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
