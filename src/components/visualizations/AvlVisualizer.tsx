import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Trash2, Search } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { AvlData, AvlTreeNode } from '../../types';

interface AvlVisualizerProps {
  initialAvl: AvlData;
}

interface PositionedAvlNode {
  node: AvlTreeNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function layoutAvlTree(root: AvlTreeNode | null): { nodes: PositionedAvlNode[]; width: number; height: number } {
  if (!root) return { nodes: [], width: 700, height: 320 };
  const result: PositionedAvlNode[] = [];
  let counter = 0;

  function inorderAssign(
    n: AvlTreeNode | null,
    depth: number,
    px?: number,
    py?: number
  ) {
    if (!n) return;
    /* Assign placeholder x via inorder index */
    const tempNodes: PositionedAvlNode[] = [];
    function traverse(cur: AvlTreeNode | null, d: number, parentPos?: { x: number; y: number }) {
      if (!cur) return;
      const entry: PositionedAvlNode = { node: cur, x: 0, y: 48 + d * 78 };
      traverse(cur.left, d + 1, entry);
      entry.x = 58 + counter * 74;
      counter++;
      if (parentPos) {
        entry.parentX = parentPos.x;
        entry.parentY = parentPos.y;
      }
      tempNodes.push(entry);
      traverse(cur.right, d + 1, entry);
    }
    traverse(n, depth);
    /* Second pass fixes parent coordinates since right children got x after parent */
    const coordMap = new Map<AvlTreeNode, { x: number; y: number }>();
    tempNodes.forEach((t) => coordMap.set(t.node, { x: t.x, y: t.y }));

    function linkParents(cur: AvlTreeNode | null, parent: AvlTreeNode | null) {
      if (!cur) return;
      const pos = coordMap.get(cur)!;
      const pPos = parent ? coordMap.get(parent) : undefined;
      result.push({
        node: cur,
        x: pos.x,
        y: pos.y,
        parentX: pPos?.x,
        parentY: pPos?.y,
      });
      linkParents(cur.left, cur);
      linkParents(cur.right, cur);
    }
    linkParents(n, null);
    void px;
    void py;
  }

  inorderAssign(root, 0);
  const maxX = Math.max(720, ...result.map((r) => r.x + 70));
  const maxY = Math.max(340, ...result.map((r) => r.y + 60));
  return { nodes: result, width: maxX, height: maxY };
}

export const AvlVisualizer: React.FC<AvlVisualizerProps> = ({ initialAvl }) => {
  const [avl, setAvl] = useState<AvlData>(initialAvl);
  const [opsQueue, setOpsQueue] = useState<Array<Record<string, unknown>>>([]);
  const [customTitle, setCustomTitle] = useState('Red-Black Balancing');
  const [customPrio, setCustomPrio] = useState(88.5);
  const [searchKey, setSearchKey] = useState(75);
  const [deleteTopicId, setDeleteTopicId] = useState<number>(initialAvl.schedule[0]?.topic_id || 1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAvl(initialAvl);
    setOpsQueue([]);
  }, [initialAvl]);

  const executeOps = async (nextOps: Array<Record<string, unknown>>) => {
    setBusy(true);
    try {
      const res = await apiFetch<{ avl: AvlData }>('/api/engine/avl', {
        method: 'POST',
        body: JSON.stringify({ operations: nextOps }),
      });
      setAvl(res.avl);
      setOpsQueue(nextOps);
    } finally {
      setBusy(false);
    }
  };

  const handleInsert = () => {
    const nextOps = [
      ...opsQueue,
      {
        action: 'insert',
        topic_id: 900 + opsQueue.length + 1,
        title: customTitle.trim() || 'Adaptive Node',
        priority_score: Number(customPrio),
        mastery: Math.max(0, 100 - Number(customPrio)),
      },
    ];
    executeOps(nextOps);
  };

  const handleDelete = () => {
    const nextOps = [...opsQueue, { action: 'delete', topic_id: deleteTopicId }];
    executeOps(nextOps);
  };

  const handleSearch = () => {
    const nextOps = [...opsQueue, { action: 'search', priority_score: Number(searchKey) }];
    executeOps(nextOps);
  };

  const handleReset = () => {
    executeOps([]);
  };

  const { nodes, width, height } = layoutAvlTree(avl.root);
  const searchVisited = new Set(avl.search_result?.visited_ids || []);

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">
              AVL Adaptive Scheduler (LL, RR, LR, RL Rotations)
            </h2>
            <p className="text-xs text-[#64748b]">
              Executed in C (`avl.c`) · Tree Height {avl.tree_height} · {avl.node_count} nodes · {avl.rotation_count} self-balancing rotations recorded
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={busy}
            className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-xs font-medium text-[#1e293b] rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Live Student State</span>
          </button>
        </div>

        {/* Interactive Operations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-[#f1f5f9]">
          {/* Insert */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Node title"
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded"
            />
            <input
              type="number"
              step="0.5"
              value={customPrio}
              onChange={(e) => setCustomPrio(Number(e.target.value))}
              className="w-16 px-2 py-1.5 text-xs font-mono border border-[#e2e8f0] rounded"
              title="Priority Key"
            />
            <button
              onClick={handleInsert}
              disabled={busy}
              className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Insert</span>
            </button>
          </div>

          {/* Delete */}
          <div className="flex items-center gap-2">
            <select
              value={deleteTopicId}
              onChange={(e) => setDeleteTopicId(Number(e.target.value))}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded bg-white"
            >
              {avl.schedule.map((s) => (
                <option key={s.topic_id} value={s.topic_id}>
                  #{s.topic_id} {s.title} ({s.priority_score.toFixed(1)})
                </option>
              ))}
            </select>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="px-3 py-1.5 bg-white hover:bg-[#fef2f2] border border-[#e2e8f0] hover:border-[#fecaca] text-[#ba1a1a] text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              value={searchKey}
              onChange={(e) => setSearchKey(Number(e.target.value))}
              className="flex-1 px-2.5 py-1.5 text-xs font-mono border border-[#e2e8f0] rounded"
              placeholder="Priority key"
            />
            <button
              onClick={handleSearch}
              disabled={busy}
              className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Key</span>
            </button>
          </div>
        </div>

        {avl.search_result?.summary && (
          <div className="text-xs px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded text-[#1e293b] font-mono">
            {avl.search_result.summary}
          </div>
        )}
      </div>

      {/* SVG Tree + Rotation Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[680px] h-[380px]"
            role="img"
            aria-label="AVL balanced binary search tree"
          >
            {/* Edges */}
            {nodes.map((item) =>
              item.parentX !== undefined && item.parentY !== undefined ? (
                <line
                  key={`edge-${item.node.topic_id}`}
                  x1={item.parentX}
                  y1={item.parentY + 22}
                  x2={item.x}
                  y2={item.y - 22}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
              ) : null
            )}

            {/* Nodes */}
            {nodes.map((item) => {
              const n = item.node;
              const isMatched = avl.search_result?.found_topic_id === n.topic_id;
              const isVisited = searchVisited.has(n.topic_id);
              const stroke = isMatched
                ? '#059669'
                : isVisited
                ? '#1e3a8a'
                : '#94a3b8';
              const fill = isMatched
                ? '#f0fdf4'
                : isVisited
                ? '#eff6ff'
                : '#ffffff';

              return (
                <g key={n.topic_id} transform={`translate(${item.x}, ${item.y})`}>
                  <rect
                    x={-34}
                    y={-22}
                    width={68}
                    height={44}
                    rx={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isMatched || isVisited ? 2 : 1.5}
                  />
                  <text
                    y={-4}
                    textAnchor="middle"
                    className="fill-[#0f172a] text-[12px] font-mono font-semibold tabular-nums"
                  >
                    {n.priority_score.toFixed(1)}
                  </text>
                  <text
                    y={11}
                    textAnchor="middle"
                    className="fill-[#64748b] text-[9px] font-mono tabular-nums"
                  >
                    h={n.height} bf={n.balance_factor >= 0 ? `+${n.balance_factor}` : n.balance_factor}
                  </text>
                  <text
                    y={34}
                    textAnchor="middle"
                    className="fill-[#475569] text-[9px]"
                  >
                    {n.title.length > 12 ? `${n.title.slice(0, 11)}…` : n.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Rotation Log & Priority Schedule */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-1">
              AVL Rotation Log ({avl.rotations.length})
            </h3>
            <p className="text-xs text-[#64748b] mb-3">
              Actual LL, RR, LR, RL rotations executed during tree construction &amp; edits
            </p>
            {avl.rotations.length === 0 ? (
              <div className="text-xs text-[#64748b] py-3">
                No rotations triggered for current key order. Insert or delete nodes above to trigger LL/RR/LR/RL balancing.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {avl.rotations.map((rot, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs"
                  >
                    <div className="flex items-center justify-between font-mono font-semibold text-[#1e3a8a] mb-0.5">
                      <span>{rot.type} Rotation</span>
                      <span>Key {rot.pivot_key.toFixed(1)}</span>
                    </div>
                    <div className="text-[#475569] leading-snug">{rot.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-3">
              Adaptive Schedule (Reverse In-Order)
            </h3>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {avl.schedule.map((item) => (
                <div
                  key={item.topic_id}
                  className="flex items-center justify-between px-2.5 py-1.5 border border-[#f1f5f9] rounded text-xs"
                >
                  <span className="truncate font-medium text-[#0f172a]">
                    <span className="font-mono text-[#64748b] mr-1.5">{item.rank}.</span>
                    {item.title}
                  </span>
                  <span className="font-mono text-[#1e3a8a] tabular-nums shrink-0 ml-2">
                    {item.priority_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
