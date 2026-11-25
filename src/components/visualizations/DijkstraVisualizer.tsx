import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { DagData, DijkstraData, Topic } from '../../types';

interface DijkstraVisualizerProps {
  initialDijkstra: DijkstraData;
  dag: DagData;
  topics: Topic[];
}

export const DijkstraVisualizer: React.FC<DijkstraVisualizerProps> = ({
  initialDijkstra,
  dag,
  topics,
}) => {
  const [dijk, setDijk] = useState<DijkstraData>(initialDijkstra);
  const [startId, setStartId] = useState<number>(-1);
  const [targetId, setTargetId] = useState<number>(
    initialDijkstra.target_id > 0 ? initialDijkstra.target_id : topics[topics.length - 1]?.id || 1
  );
  const [respectPrereqs, setRespectPrereqs] = useState<boolean>(true);
  const [stepIdx, setStepIdx] = useState<number>(initialDijkstra.steps.length);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDijk(initialDijkstra);
    setStepIdx(initialDijkstra.steps.length);
  }, [initialDijkstra]);

  useEffect(() => {
    if (!playing) return;
    if (stepIdx >= dijk.steps.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIdx((s) => Math.min(dijk.steps.length, s + 1));
    }, 550);
    return () => clearTimeout(timer);
  }, [playing, stepIdx, dijk.steps.length]);

  const handleCompute = async () => {
    setBusy(true);
    setPlaying(false);
    try {
      const res = await apiFetch<{ dijkstra: DijkstraData }>('/api/engine/dijkstra', {
        method: 'POST',
        body: JSON.stringify({
          start_id: startId,
          target_id: targetId,
          respect_prereqs: respectPrereqs,
        }),
      });
      setDijk(res.dijkstra);
      setStepIdx(1);
      setPlaying(true);
    } finally {
      setBusy(false);
    }
  };

  const visibleSteps = dijk.steps.slice(0, stepIdx);
  const settledIds = new Set(
    visibleSteps.filter((s) => s.action === 'pop_min').map((s) => s.from_id)
  );
  const activeStep = visibleSteps[visibleSteps.length - 1];
  const pathIds = new Set(dijk.path.map((p) => p.id));

  const pathEdgeSet = new Set<string>();
  for (let i = 0; i < dijk.path.length - 1; i++) {
    pathEdgeSet.add(`${dijk.path[i].id}->${dijk.path[i + 1].id}`);
  }

  const nodeMap = new Map(dag.nodes.map((n) => [n.id, n]));
  const distMap = new Map(dijk.distances.map((d) => [d.topic_id, d]));

  const maxX = Math.max(980, ...dag.nodes.map((n) => n.pos_x + 140));
  const maxY = Math.max(540, ...dag.nodes.map((n) => n.pos_y + 90));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">
              Dijkstra Weighted Learning Path (Min-Priority Queue)
            </h2>
            <p className="text-xs text-[#64748b]">
              Executed in C (`dijkstra.c`) · Edge weights model study effort and mastery gap ·{' '}
              {dijk.reachable
                ? `Optimal route cost ${dijk.total_cost.toFixed(2)} across ${dijk.path.length} modules`
                : 'Target unreachable under current prerequisite constraints'}
            </p>
          </div>

          <div className="flex items-center border border-[#e2e8f0] rounded overflow-hidden">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] cursor-pointer"
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setStepIdx((s) => Math.min(dijk.steps.length, s + 1));
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
              title="Step"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setStepIdx(0);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748b]">Source:</span>
            <select
              value={startId}
              onChange={(e) => setStartId(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded bg-white"
            >
              <option value={-1}>Current Mastery Frontier</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748b]">Target Goal:</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded bg-white"
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#1e293b] cursor-pointer">
            <input
              type="checkbox"
              checked={respectPrereqs}
              onChange={(e) => setRespectPrereqs(e.target.checked)}
              className="accent-[#1e3a8a]"
            />
            <span>Enforce Prerequisite Constraints</span>
          </label>

          <button
            disabled={busy}
            onClick={handleCompute}
            className="px-4 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ml-auto"
          >
            Compute Shortest Path
          </button>
        </div>

        {activeStep && (
          <div className="px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs font-mono text-[#0f172a] flex items-center justify-between gap-2">
            <span>
              [{activeStep.action}] {activeStep.detail}
            </span>
            <span className="text-[#64748b] tabular-nums shrink-0">
              Step {stepIdx} / {dijk.steps.length}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] overflow-x-auto">
          <svg
            viewBox={`0 0 ${maxX} ${maxY}`}
            className="w-full min-w-[760px] h-[460px]"
            role="img"
            aria-label="Dijkstra shortest path graph traversal"
          >
            <defs>
              <marker
                id="dijk-path-arrow"
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
                id="dijk-muted-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#cbd5e1" />
              </marker>
            </defs>

            {dag.edges.map((edge, idx) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;

              const dx = to.pos_x - from.pos_x;
              const dy = to.pos_y - from.pos_y;
              const d = Math.hypot(dx, dy) || 1;
              const startX = from.pos_x + (dx / d) * 66;
              const startY = from.pos_y + (dy / d) * 26;
              const endX = to.pos_x - (dx / d) * 68;
              const endY = to.pos_y - (dy / d) * 28;

              const onShortest = stepIdx >= dijk.steps.length && pathEdgeSet.has(`${edge.from}->${edge.to}`);
              const isRelaxing =
                activeStep?.action === 'relax' &&
                activeStep.from_id === edge.from &&
                activeStep.to_id === edge.to;

              const stroke = onShortest
                ? '#059669'
                : isRelaxing
                ? '#1e3a8a'
                : '#cbd5e1';

              return (
                <g key={idx}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={stroke}
                    strokeWidth={onShortest || isRelaxing ? 2.5 : 1.25}
                    markerEnd={onShortest ? 'url(#dijk-path-arrow)' : 'url(#dijk-muted-arrow)'}
                  />
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 4}
                    textAnchor="middle"
                    className="fill-[#64748b] text-[9px] font-mono"
                  >
                    {edge.weight.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {dag.nodes.map((node) => {
              const distEntry = distMap.get(node.id);
              const isSettled = settledIds.has(node.id);
              const isOnPath = stepIdx >= dijk.steps.length && pathIds.has(node.id);
              const isTarget = node.id === dijk.target_id;

              const stroke = isOnPath
                ? '#059669'
                : isSettled
                ? '#1e3a8a'
                : isTarget
                ? '#d97706'
                : '#cbd5e1';
              const fill = isOnPath
                ? '#f0fdf4'
                : isSettled
                ? '#eff6ff'
                : '#ffffff';

              return (
                <g key={node.id} transform={`translate(${node.pos_x - 68}, ${node.pos_y - 26})`}>
                  <rect
                    width={136}
                    height={52}
                    rx={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isOnPath || isSettled ? 2.2 : 1.5}
                  />
                  <text x={10} y={20} className="fill-[#0f172a] text-[11px] font-semibold">
                    {node.title.length > 18 ? `${node.title.slice(0, 17)}…` : node.title}
                  </text>
                  <text x={10} y={38} className="fill-[#475569] text-[10px] font-mono tabular-nums">
                    d = {distEntry && distEntry.reachable ? distEntry.dist.toFixed(2) : '∞'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Optimal Path & Step Trace */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-2">
              Optimal Learning Route
            </h3>
            {dijk.reachable && dijk.path.length > 0 ? (
              <div className="space-y-2">
                {dijk.path.map((hop, idx) => (
                  <div
                    key={hop.id}
                    className="flex items-center justify-between px-3 py-2 bg-[#f0fdf4] border border-[#a7f3d0] rounded text-xs"
                  >
                    <span className="font-medium text-[#065f46]">
                      <span className="font-mono mr-1.5">{idx + 1}.</span>
                      {hop.title}
                    </span>
                    <span className="font-mono text-[#059669] tabular-nums">
                      cost {hop.dist.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded p-3">
                No valid path reaches the target under strict prerequisite constraints from the chosen source. Try starting from the Current Mastery Frontier or toggling prerequisite constraints.
              </p>
            )}
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            <h3 className="text-sm font-semibold text-[#0f172a] mb-2">
              Min-PQ Execution Log
            </h3>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {visibleSteps.map((st, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1.5 border border-[#f1f5f9] rounded text-[11px] font-mono text-[#475569]"
                >
                  <span className="text-[#1e3a8a] font-semibold">[{st.action}]</span> {st.detail}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
