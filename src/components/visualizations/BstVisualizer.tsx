import React, { useState, useEffect } from 'react';
import { Search, Plus, RotateCcw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { BstData, BstTreeNode } from '../../types';

interface BstVisualizerProps {
  initialBst: BstData;
}

interface PositionedBst {
  node: BstTreeNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function layoutBstTree(root: BstTreeNode | null) {
  if (!root) return { nodes: [] as PositionedBst[], width: 700, height: 320 };
  const result: PositionedBst[] = [];
  let counter = 0;
  const coords = new Map<BstTreeNode, { x: number; y: number }>();

  function assign(n: BstTreeNode | null, depth: number) {
    if (!n) return;
    assign(n.left, depth + 1);
    coords.set(n, { x: 64 + counter * 82, y: 48 + depth * 74 });
    counter++;
    assign(n.right, depth + 1);
  }
  assign(root, 0);

  function collect(n: BstTreeNode | null, parent: BstTreeNode | null) {
    if (!n) return;
    const p = coords.get(n)!;
    const pp = parent ? coords.get(parent) : undefined;
    result.push({ node: n, x: p.x, y: p.y, parentX: pp?.x, parentY: pp?.y });
    collect(n.left, n);
    collect(n.right, n);
  }
  collect(root, null);

  const width = Math.max(720, ...result.map((r) => r.x + 80));
  const height = Math.max(330, ...result.map((r) => r.y + 60));
  return { nodes: result, width, height };
}

export const BstVisualizer: React.FC<BstVisualizerProps> = ({ initialBst }) => {
  const [bst, setBst] = useState<BstData>(initialBst);
  const [traversalMode, setTraversalMode] = useState<'inorder' | 'preorder' | 'postorder'>('inorder');
  const [searchTs, setSearchTs] = useState<number>(
    initialBst.inorder[Math.floor(initialBst.inorder.length / 2)]?.timestamp || Math.floor(Date.now() / 1000)
  );
  const [simScore, setSimScore] = useState(88);
  const [simTitle, setSimTitle] = useState('Simulated Practice Quiz');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBst(initialBst);
    if (initialBst.inorder.length > 0) {
      setSearchTs(initialBst.inorder[Math.floor(initialBst.inorder.length / 2)].timestamp);
    }
  }, [initialBst]);

  const runBstOp = async (params: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await apiFetch<{ bst: BstData }>('/api/engine/bst', {
        method: 'POST',
        body: JSON.stringify({ params }),
      });
      setBst(res.bst);
    } finally {
      setBusy(false);
    }
  };

  const { nodes, width, height } = layoutBstTree(bst.root);
  const visitedSet = new Set(bst.search_result?.visited_ids || []);
  const matchedId = bst.search_result?.matched_id ?? -1;

  const nodeById = new Map(bst.inorder.map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">
              BST Performance History (Timestamp-Keyed)
            </h2>
            <p className="text-xs text-[#64748b]">
              Executed in C (`bst.c`) · {bst.node_count} records · Height {bst.tree_height} · Avg {bst.average_score.toFixed(1)}% · Slope{' '}
              {bst.improvement_slope >= 0 ? '+' : ''}
              {bst.improvement_slope.toFixed(2)}% / quiz
            </p>
          </div>
          <button
            onClick={() => runBstOp({})}
            disabled={busy}
            className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-xs font-medium text-[#1e293b] rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sync SQLite History</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#f1f5f9]">
          {/* Timestamp Search */}
          <div className="flex items-center gap-2">
            <select
              value={searchTs}
              onChange={(e) => setSearchTs(Number(e.target.value))}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono border border-[#e2e8f0] rounded bg-white"
            >
              {bst.inorder.map((r) => (
                <option key={r.id} value={r.timestamp}>
                  {new Date(r.timestamp * 1000).toLocaleDateString()} · {r.topic_title} ({r.score}%)
                </option>
              ))}
            </select>
            <button
              onClick={() => runBstOp({ action: 'search', timestamp: searchTs })}
              disabled={busy || bst.node_count === 0}
              className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Timestamp</span>
            </button>
          </div>

          {/* Insert Simulated Node */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={simTitle}
              onChange={(e) => setSimTitle(e.target.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded"
              placeholder="Topic title"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={simScore}
              onChange={(e) => setSimScore(Number(e.target.value))}
              className="w-16 px-2 py-1.5 text-xs font-mono border border-[#e2e8f0] rounded"
            />
            <button
              onClick={() =>
                runBstOp({
                  action: 'insert',
                  topic_title: simTitle,
                  score: simScore,
                  mastery_after: simScore,
                  timestamp: Math.floor(Date.now() / 1000),
                })
              }
              disabled={busy}
              className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Test Insert</span>
            </button>
          </div>
        </div>

        {bst.search_result?.summary && (
          <div className="text-xs px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded font-mono text-[#1e293b]">
            {bst.search_result.summary}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] overflow-x-auto">
          {nodes.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-[#64748b]">
              Complete an assessment to populate the Binary Search Tree.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full min-w-[680px] h-[360px]"
              role="img"
              aria-label="Binary Search Tree of timestamped assessments"
            >
              {nodes.map((item) =>
                item.parentX !== undefined && item.parentY !== undefined ? (
                  <line
                    key={`edge-${item.node.id}`}
                    x1={item.parentX}
                    y1={item.parentY + 21}
                    x2={item.x}
                    y2={item.y - 21}
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                  />
                ) : null
              )}

              {nodes.map((item) => {
                const n = item.node;
                const isMatch = matchedId === n.id;
                const isVisited = visitedSet.has(n.id);
                const stroke = isMatch
                  ? '#059669'
                  : isVisited
                  ? '#1e3a8a'
                  : '#94a3b8';
                const fill = isMatch
                  ? '#f0fdf4'
                  : isVisited
                  ? '#eff6ff'
                  : '#ffffff';

                return (
                  <g key={n.id} transform={`translate(${item.x}, ${item.y})`}>
                    <rect
                      x={-36}
                      y={-21}
                      width={72}
                      height={42}
                      rx={6}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isMatch || isVisited ? 2 : 1.5}
                    />
                    <text
                      y={-3}
                      textAnchor="middle"
                      className="fill-[#0f172a] text-[11px] font-mono font-semibold tabular-nums"
                    >
                      {n.score.toFixed(0)}%
                    </text>
                    <text
                      y={12}
                      textAnchor="middle"
                      className="fill-[#64748b] text-[9px] font-mono tabular-nums"
                    >
                      {new Date(n.timestamp * 1000).toLocaleDateString(undefined, {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </text>
                    <text y={32} textAnchor="middle" className="fill-[#475569] text-[9px]">
                      {n.topic_title.length > 13 ? `${n.topic_title.slice(0, 12)}…` : n.topic_title}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Traversals Panel */}
        <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] mb-2">BST Traversals</h3>
            <div className="flex items-center gap-1 p-1 bg-[#f1f5f9] rounded">
              {(['inorder', 'preorder', 'postorder'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setTraversalMode(m)}
                  className={`flex-1 py-1 text-xs font-medium rounded capitalize cursor-pointer ${
                    traversalMode === m
                      ? 'bg-white text-[#0f172a] shadow-xs'
                      : 'text-[#475569] hover:text-[#0f172a]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {(traversalMode === 'inorder'
              ? bst.inorder.map((r) => r.id)
              : traversalMode === 'preorder'
              ? bst.preorder_ids
              : bst.postorder_ids
            ).map((id, idx) => {
              const rec = nodeById.get(id);
              if (!rec) return null;
              return (
                <div
                  key={`${id}-${idx}`}
                  className="flex items-center justify-between px-2.5 py-1.5 border border-[#f1f5f9] rounded text-xs"
                >
                  <span className="truncate text-[#0f172a] font-medium">
                    <span className="font-mono text-[#64748b] mr-1.5">{idx + 1}.</span>
                    {rec.topic_title}
                  </span>
                  <span className="font-mono text-[#1e3a8a] tabular-nums shrink-0 ml-2">
                    {rec.score.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
