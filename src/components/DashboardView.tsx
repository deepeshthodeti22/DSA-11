import React, { useState } from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  TrendingUp,
  GitFork,
  Binary,
  Flame,
  Route,
  Link2,
} from 'lucide-react';
import { DashboardPayload } from '../types';

export type NavSection =
  | 'dashboard'
  | 'curriculum'
  | 'dag'
  | 'avl'
  | 'bst'
  | 'heap'
  | 'dijkstra'
  | 'linkedlist';

interface DashboardViewProps {
  data: DashboardPayload;
  onStartQuiz: (topicId: number) => void;
  onNavigate: (section: NavSection) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onStartQuiz,
  onNavigate,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const { summary, bst, avl, heap, dijkstra, linked_list, dag } = data.engine;

  const history = bst.inorder;

  /* SVG Chart geometry for BST chronological performance */
  const chartW = 640;
  const chartH = 220;
  const padL = 42;
  const padR = 20;
  const padT = 20;
  const padB = 34;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const points = history.map((rec, i) => {
    const x =
      history.length <= 1
        ? padL + plotW / 2
        : padL + (i / (history.length - 1)) * plotW;
    const yScore = padT + plotH - (rec.score / 100) * plotH;
    const yMastery = padT + plotH - (rec.mastery_after / 100) * plotH;
    return { ...rec, x, yScore, yMastery, i };
  });

  const scoreLine = points.map((p) => `${p.x},${p.yScore}`).join(' ');
  const masteryLine = points.map((p) => `${p.x},${p.yMastery}`).join(' ');

  return (
    <div className="space-y-6">
      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="text-[12px] font-medium text-[#64748b] mb-1">Overall Mastery</div>
          <div className="text-3xl font-bold text-[#0f172a] tabular-nums tracking-tight">
            {summary.overall_mastery.toFixed(1)}%
          </div>
          <div className="mt-3 w-full h-1.5 bg-[#e2e8f0] rounded overflow-hidden">
            <div
              className="h-full bg-[#10b981] transition-all duration-300"
              style={{ width: `${Math.min(100, summary.overall_mastery)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="text-[12px] font-medium text-[#64748b] mb-1">Completed Topics</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#059669] tabular-nums">
              {summary.completed_topics}
            </span>
            <span className="text-sm text-[#64748b] tabular-nums">
              / {summary.total_topics} modules
            </span>
          </div>
          <div className="mt-2 text-xs text-[#475569]">Mastery threshold &ge; 70%</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="text-[12px] font-medium text-[#64748b] mb-1">Pending &amp; Active</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#1e3a8a] tabular-nums">
              {summary.pending_topics}
            </span>
            <span className="text-sm text-[#64748b]">unlocked</span>
          </div>
          <div className="mt-2 text-xs text-[#475569] tabular-nums">
            {summary.locked_topics} locked by prerequisites
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="text-[12px] font-medium text-[#64748b] mb-1">BST Score Trajectory</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#0f172a] tabular-nums">
              {bst.average_score.toFixed(1)}%
            </span>
            <span
              className={`text-xs font-medium tabular-nums ${
                bst.improvement_slope >= 0 ? 'text-[#059669]' : 'text-[#b45309]'
              }`}
            >
              {bst.improvement_slope >= 0 ? '+' : ''}
              {bst.improvement_slope.toFixed(1)}% / quiz
            </span>
          </div>
          <div className="mt-2 text-xs text-[#475569] tabular-nums">
            {bst.node_count} recorded assessments
          </div>
        </div>
      </div>

      {/* Primary Row: Next Recommended Learning Activity + Weak-Topic Priority Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Next Recommended Activity */}
        <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#1e3a8a] mb-2">
              Next Recommended Activity
            </div>
            {data.next_activity ? (
              <>
                <h2 className="text-xl font-semibold text-[#0f172a] tracking-tight mb-2">
                  {data.next_activity.title}
                </h2>
                <div className="text-[13px] text-[#64748b] mb-4 flex items-center gap-2">
                  <span>{data.next_activity.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{data.next_activity.estimated_minutes} min</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Urgency {data.next_activity.urgency.toFixed(1)}
                  </span>
                </div>
                <p className="text-sm text-[#475569] leading-relaxed mb-5">
                  {data.next_activity.reason}
                </p>

                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded p-3.5 mb-5">
                  <div className="flex items-center justify-between text-xs text-[#475569] mb-1.5">
                    <span>Current Topic Mastery</span>
                    <span className="font-mono font-medium text-[#0f172a] tabular-nums">
                      {data.next_activity.mastery.toFixed(1)}% / 70% target
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e2e8f0] rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        data.next_activity.mastery >= 70 ? 'bg-[#059669]' : 'bg-[#1e3a8a]'
                      }`}
                      style={{ width: `${Math.min(100, data.next_activity.mastery)}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#475569]">
                All curriculum topics are mastered. Add custom topics or review algorithms.
              </p>
            )}
          </div>

          {data.next_activity && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onStartQuiz(data.next_activity!.topic_id)}
                className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-sm font-medium rounded transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Start Topic Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('avl')}
                className="px-3.5 py-2 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inspect AVL Schedule
              </button>
            </div>
          )}
        </div>

        {/* Learning Progress Chart (BST In-Order History) */}
        <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0f172a]">
                Learning Progress &amp; Mastery Trajectory
              </h2>
              <p className="text-xs text-[#64748b]">
                Chronological in-order traversal from C BST Performance History
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#475569]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#1e3a8a] inline-block" />
                Quiz Score
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#059669] inline-block" />
                Mastery After
              </span>
            </div>
          </div>

          {points.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded text-center px-6">
              <TrendingUp className="w-6 h-6 text-[#64748b] mb-2" />
              <div className="text-sm font-medium text-[#0f172a]">No assessment history yet</div>
              <div className="text-xs text-[#64748b] mt-1">
                Complete your first unlocked quiz to populate the BST history curve.
              </div>
            </div>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label="Assessment score and mastery history chart"
              >
                {/* Horizontal gridlines */}
                {[0, 25, 50, 70, 100].map((val) => {
                  const y = padT + plotH - (val / 100) * plotH;
                  return (
                    <g key={val}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke={val === 70 ? '#a7f3d0' : '#f1f5f9'}
                        strokeDasharray={val === 70 ? '4 4' : undefined}
                        strokeWidth={1}
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-[#64748b] text-[10px] font-mono"
                      >
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* Lines */}
                {points.length > 1 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="#1e3a8a"
                      strokeWidth={2}
                      points={scoreLine}
                    />
                    <polyline
                      fill="none"
                      stroke="#059669"
                      strokeWidth={2}
                      points={masteryLine}
                    />
                  </>
                )}

                {/* Points */}
                {points.map((p) => (
                  <g
                    key={p.id}
                    onMouseEnter={() => setHoveredIdx(p.i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={p.x}
                      cy={p.yScore}
                      r={hoveredIdx === p.i ? 5.5 : 4}
                      fill="#1e3a8a"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={p.x}
                      cy={p.yMastery}
                      r={hoveredIdx === p.i ? 5.5 : 4}
                      fill="#059669"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={p.x}
                      y={chartH - 8}
                      textAnchor="middle"
                      className="fill-[#64748b] text-[10px] font-mono"
                    >
                      #{p.i + 1}
                    </text>
                  </g>
                ))}
              </svg>

              {hoveredIdx !== null && points[hoveredIdx] && (
                <div className="mt-2 px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f172a]">
                    {points[hoveredIdx].topic_title}
                  </span>
                  <div className="flex items-center gap-3 text-[#475569] font-mono tabular-nums">
                    <span>Score: {points[hoveredIdx].score.toFixed(0)}%</span>
                    <span>Mastery: {points[hoveredIdx].mastery_after.toFixed(0)}%</span>
                    <span>
                      {new Date(points[hoveredIdx].timestamp * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Weak-Topic Recommendations + Recent Assessment History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weak-Topic Recommendations (from Max Heap) */}
        <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0f172a]">
                Weak-Topic Recommendations
              </h2>
              <p className="text-xs text-[#64748b]">
                Ranked by C Max Heap urgency score
              </p>
            </div>
            <button
              onClick={() => onNavigate('heap')}
              className="text-xs font-medium text-[#1e3a8a] hover:underline cursor-pointer"
            >
              Open Max Heap
            </button>
          </div>

          {data.weak_recommendations.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#475569]">
              <CheckCircle2 className="w-6 h-6 text-[#059669] mx-auto mb-2" />
              No weak unlocked topics detected.
            </div>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {data.weak_recommendations.map((rec) => (
                <div
                  key={rec.topic_id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#0f172a] truncate">
                        {rec.title}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748b] mt-0.5">
                      {rec.subject} · Urgency {rec.urgency.toFixed(1)} · Mastery{' '}
                      <span className="font-mono text-[#92400e] font-medium tabular-nums">
                        {rec.mastery.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onStartQuiz(rec.topic_id)}
                    className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] text-[#1e293b] rounded whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Practice
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Assessment History Table */}
        <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0f172a]">
                Recent Assessment History
              </h2>
              <p className="text-xs text-[#64748b]">
                Stored in SQLite and indexed chronologically in C BST
              </p>
            </div>
            <button
              onClick={() => onNavigate('bst')}
              className="text-xs font-medium text-[#1e3a8a] hover:underline cursor-pointer"
            >
              Inspect BST
            </button>
          </div>

          {data.assessments.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#64748b]">
              No assessments submitted yet. Select any unlocked topic to begin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
                    <th className="py-2 pr-3">Topic</th>
                    <th className="py-2 px-3 text-right">Score</th>
                    <th className="py-2 px-3 text-right">Mastery After</th>
                    <th className="py-2 pl-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] text-[13px]">
                  {data.assessments.map((a) => (
                    <tr key={a.id} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 pr-3 font-medium text-[#0f172a]">
                        {a.topic_title}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1e293b]">
                        {a.score.toFixed(0)}% ({a.correct_count}/{a.total_count})
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${
                          a.mastery_after >= 70 ? 'text-[#059669]' : 'text-[#92400e]'
                        }`}
                      >
                        {a.mastery_after.toFixed(1)}%
                      </td>
                      <td className="py-2.5 pl-3 text-right text-[#64748b] tabular-nums">
                        {new Date(a.timestamp * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Live C Algorithm Engine Summary Cards */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a]">
              Live Algorithm Engine Snapshot
            </h2>
            <p className="text-xs text-[#64748b]">
              Click any data structure below to open its interactive visualization and step debugger
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              key: 'dag' as NavSection,
              icon: GitFork,
              title: 'Knowledge DAG + BFS',
              metric: `${dag.node_count} nodes · ${dag.edge_count} edges`,
              sub: dag.is_valid_dag ? 'Acyclic topological sort valid' : 'Cycle detected',
            },
            {
              key: 'avl' as NavSection,
              icon: Binary,
              title: 'AVL Adaptive Scheduler',
              metric: `Height ${avl.tree_height} · ${avl.rotation_count} rotations`,
              sub: avl.schedule[0]
                ? `Top priority: ${avl.schedule[0].title}`
                : 'Balanced schedule ready',
            },
            {
              key: 'bst' as NavSection,
              icon: Clock,
              title: 'BST Performance History',
              metric: `${bst.node_count} records · Height ${bst.tree_height}`,
              sub: `Avg score ${bst.average_score.toFixed(1)}%`,
            },
            {
              key: 'heap' as NavSection,
              icon: Flame,
              title: 'Max Heap Priority Queue',
              metric: `${heap.size} scheduled items`,
              sub: heap.heap_array[0]
                ? `Root max: ${heap.heap_array[0].title} (${heap.heap_array[0].urgency.toFixed(1)})`
                : 'Heap empty',
            },
            {
              key: 'dijkstra' as NavSection,
              icon: Route,
              title: 'Dijkstra Learning Path',
              metric: dijkstra.reachable
                ? `${dijkstra.path.length} hops · Cost ${dijkstra.total_cost.toFixed(1)}`
                : 'Compute route',
              sub: dijkstra.path.length > 0
                ? `Target: ${dijkstra.path[dijkstra.path.length - 1].title}`
                : 'Select target topic',
            },
            {
              key: 'linkedlist' as NavSection,
              icon: Link2,
              title: 'Linked List Mastery Chain',
              metric: `${linked_list.completed_count} done · ${linked_list.pending_count} active`,
              sub: `Cursor at topic #${linked_list.current_id}`,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                onClick={() => onNavigate(card.key)}
                className="text-left p-4 rounded border border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
                    <Icon className="w-4 h-4 text-[#1e3a8a]" />
                    <span>{card.title}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94a3b8] group-hover:text-[#1e3a8a] transition-colors" />
                </div>
                <div className="text-xs font-mono text-[#1e293b] tabular-nums">{card.metric}</div>
                <div className="text-xs text-[#64748b] mt-1 truncate">{card.sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
