import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, RotateCcw, Plus, ArrowUpFromLine } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { HeapData, HeapItem } from '../../types';

interface HeapVisualizerProps {
  initialHeap: HeapData;
}

export const HeapVisualizer: React.FC<HeapVisualizerProps> = ({ initialHeap }) => {
  const [heapData, setHeapData] = useState<HeapData>(initialHeap);
  const [opsQueue, setOpsQueue] = useState<Array<Record<string, unknown>>>([]);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [playing, setPlaying] = useState(false);

  const [newTitle, setNewTitle] = useState('Urgent Exam Prep');
  const [newUrgency, setNewUrgency] = useState(96.0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeapData(initialHeap);
    setOpsQueue([]);
    setStepIdx(0);
    setPlaying(false);
  }, [initialHeap]);

  useEffect(() => {
    if (!playing || heapData.steps.length === 0) return;
    if (stepIdx >= heapData.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setStepIdx((s) => Math.min(heapData.steps.length - 1, s + 1));
    }, 600);
    return () => clearTimeout(timer);
  }, [playing, stepIdx, heapData.steps.length]);

  const runHeapOps = async (nextOps: Array<Record<string, unknown>>, autoplay = true) => {
    setBusy(true);
    setPlaying(false);
    try {
      const res = await apiFetch<{ heap: HeapData }>('/api/engine/heap', {
        method: 'POST',
        body: JSON.stringify({ operations: nextOps }),
      });
      setHeapData(res.heap);
      setOpsQueue(nextOps);
      if (res.heap.steps.length > 0) {
        setStepIdx(autoplay ? 0 : res.heap.steps.length - 1);
        if (autoplay) setPlaying(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const currentStep = heapData.steps[stepIdx];
  const displayArray: HeapItem[] = currentStep ? currentStep.snapshot : heapData.heap_array;

  /* Compute binary tree SVG positions for implicit 0-indexed heap array */
  const maxNodes = Math.min(displayArray.length, 31);
  const svgW = 760;
  const svgH = 340;
  const nodePos = displayArray.slice(0, maxNodes).map((_, idx) => {
    const level = Math.floor(Math.log2(idx + 1));
    const levelStart = Math.pow(2, level) - 1;
    const posInLevel = idx - levelStart;
    const slots = Math.pow(2, level);
    const x = ((posInLevel + 0.5) / slots) * (svgW - 40) + 20;
    const y = 44 + level * 76;
    return { x, y, level };
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">
              Max Heap Urgency Priority Queue
            </h2>
            <p className="text-xs text-[#64748b]">
              Executed in C (`heap.c`) · Floyd O(n) Heapify · {displayArray.length} active nodes · Urgency combines mastery gap, difficulty &amp; unlock impact
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => runHeapOps([], true)}
              disabled={busy}
              className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded cursor-pointer"
            >
              Replay C Heapify
            </button>

            <div className="flex items-center border border-[#e2e8f0] rounded overflow-hidden">
              <button
                onClick={() => {
                  if (heapData.steps.length === 0) runHeapOps(opsQueue, true);
                  else setPlaying((p) => !p);
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] cursor-pointer"
                title={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setStepIdx((s) => Math.min(Math.max(0, heapData.steps.length - 1), s + 1));
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
                title="Step Forward"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setStepIdx(0);
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-[#f8fafc] text-[#1e293b] border-l border-[#e2e8f0] cursor-pointer"
                title="Reset Step"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Insert / Extract Max Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#f1f5f9]">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs border border-[#e2e8f0] rounded"
              placeholder="Topic title"
            />
            <input
              type="number"
              step="1"
              value={newUrgency}
              onChange={(e) => setNewUrgency(Number(e.target.value))}
              className="w-20 px-2 py-1.5 text-xs font-mono border border-[#e2e8f0] rounded"
              title="Urgency Score"
            />
            <button
              disabled={busy}
              onClick={() =>
                runHeapOps(
                  [
                    ...opsQueue,
                    {
                      action: 'insert',
                      topic_id: 950 + opsQueue.length + 1,
                      title: newTitle.trim() || 'Urgent Topic',
                      urgency: Number(newUrgency),
                      mastery: 20,
                    },
                  ],
                  true
                )
              }
              className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] text-xs font-medium rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Insert</span>
            </button>
          </div>

          <button
            disabled={busy || displayArray.length === 0}
            onClick={() => runHeapOps([...opsQueue, { action: 'extract_max' }], true)}
            className="px-3.5 py-1.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-medium rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Extract Max</span>
          </button>

          {heapData.extracted.length > 0 && (
            <div className="text-xs text-[#475569] font-mono">
              Extracted: {heapData.extracted.map((e) => `${e.title} (${e.urgency.toFixed(1)})`).join(' -> ')}
            </div>
          )}
        </div>

        {currentStep && (
          <div className="px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs font-mono text-[#0f172a] flex items-center justify-between gap-2">
            <span>
              [{currentStep.op}] {currentStep.detail}
            </span>
            <span className="text-[#64748b] tabular-nums shrink-0">
              Step {stepIdx + 1} / {heapData.steps.length}
            </span>
          </div>
        )}
      </div>

      {/* Tree + Array View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] overflow-x-auto">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full min-w-[660px] h-[340px]"
            role="img"
            aria-label="Binary Max Heap Tree"
          >
            {displayArray.slice(0, maxNodes).map((_, idx) => {
              if (idx === 0) return null;
              const parentIdx = Math.floor((idx - 1) / 2);
              const p = nodePos[parentIdx];
              const c = nodePos[idx];
              return (
                <line
                  key={`e-${idx}`}
                  x1={p.x}
                  y1={p.y + 18}
                  x2={c.x}
                  y2={c.y - 18}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
              );
            })}

            {displayArray.slice(0, maxNodes).map((item, idx) => {
              const p = nodePos[idx];
              const isSwapped = currentStep && (currentStep.idx_a === idx || currentStep.idx_b === idx);
              const stroke = idx === 0 ? '#059669' : isSwapped ? '#1e3a8a' : '#94a3b8';
              const fill = idx === 0 ? '#f0fdf4' : isSwapped ? '#eff6ff' : '#ffffff';

              return (
                <g key={`${item.topic_id}-${idx}`} transform={`translate(${p.x}, ${p.y})`}>
                  <rect
                    x={-34}
                    y={-18}
                    width={68}
                    height={36}
                    rx={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={idx === 0 || isSwapped ? 2 : 1.5}
                  />
                  <text
                    y={-1}
                    textAnchor="middle"
                    className="fill-[#0f172a] text-[11px] font-mono font-semibold tabular-nums"
                  >
                    {item.urgency.toFixed(1)}
                  </text>
                  <text
                    y={12}
                    textAnchor="middle"
                    className="fill-[#64748b] text-[9px] font-mono tabular-nums"
                  >
                    idx [{idx}]
                  </text>
                  <text y={30} textAnchor="middle" className="fill-[#475569] text-[9px]">
                    {item.title.length > 13 ? `${item.title.slice(0, 12)}…` : item.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Contiguous Array Representation */}
        <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <h3 className="text-sm font-semibold text-[#0f172a] mb-1">
            Implicit Array Memory Layout
          </h3>
          <p className="text-xs text-[#64748b] mb-3">
            Parent = (i - 1) / 2 · Children = 2i + 1, 2i + 2
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {displayArray.map((item, idx) => {
              const isSwapped = currentStep && (currentStep.idx_a === idx || currentStep.idx_b === idx);
              return (
                <div
                  key={`${item.topic_id}-${idx}`}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded border text-xs ${
                    isSwapped
                      ? 'border-[#1e3a8a] bg-[#eff6ff]'
                      : idx === 0
                      ? 'border-[#a7f3d0] bg-[#f0fdf4]'
                      : 'border-[#f1f5f9] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[#64748b] w-6 tabular-nums">[{idx}]</span>
                    <span className="truncate font-medium text-[#0f172a]">{item.title}</span>
                  </div>
                  <span className="font-mono font-semibold text-[#1e3a8a] tabular-nums ml-2">
                    {item.urgency.toFixed(1)}
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
