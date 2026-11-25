import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { LinkedListData } from '../../types';

interface LinkedListVisualizerProps {
  initialList: LinkedListData;
  onStartQuiz: (topicId: number) => void;
}

export const LinkedListVisualizer: React.FC<LinkedListVisualizerProps> = ({
  initialList,
  onStartQuiz,
}) => {
  const [ll, setLl] = useState<LinkedListData>(initialList);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLl(initialList);
  }, [initialList]);

  const sendOp = async (action: 'prev' | 'next' | 'goto', targetId?: number) => {
    setBusy(true);
    try {
      const res = await apiFetch<{ linked_list: LinkedListData }>('/api/engine/linkedlist', {
        method: 'POST',
        body: JSON.stringify({
          action,
          current_id: ll.current_id,
          target_id: targetId ?? -1,
        }),
      });
      setLl(res.linked_list);
    } finally {
      setBusy(false);
    }
  };

  const currentNode = ll.nodes.find((n) => n.topic_id === ll.current_id);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#0f172a]">
            Doubly Linked List Mastery Sequence
          </h2>
          <p className="text-xs text-[#64748b]">
            Executed in C (`linkedlist.c`) · Length {ll.length} · Head #{ll.head_id} · Tail #{ll.tail_id} · {ll.completed_count} completed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={busy || !currentNode || currentNode.prev_id === -1}
            onClick={() => sendOp('prev')}
            className="px-3 py-1.5 bg-white hover:bg-[#f8fafc] disabled:opacity-40 border border-[#e2e8f0] text-xs font-medium text-[#1e293b] rounded flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>cursor-&gt;prev</span>
          </button>
          <button
            disabled={busy || !currentNode || currentNode.next_id === -1}
            onClick={() => sendOp('next')}
            className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] disabled:opacity-40 text-white text-xs font-medium rounded flex items-center gap-1.5 cursor-pointer"
          >
            <span>cursor-&gt;next</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-white border border-[#e2e8f0] rounded text-xs font-mono text-[#1e293b]">
        {ll.operation_summary}
      </div>

      {/* Doubly Linked List Chain */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ll.nodes.map((node) => {
            const isCur = node.is_current;
            const isHead = node.topic_id === ll.head_id;
            const isTail = node.topic_id === ll.tail_id;
            return (
              <div
                key={node.topic_id}
                onClick={() => sendOp('goto', node.topic_id)}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  isCur
                    ? 'border-[1.5px] border-[#1e3a8a] bg-[#eff6ff]'
                    : node.status === 'completed'
                    ? 'border-[#a7f3d0] bg-[#f0fdf4]'
                    : 'border-[#e2e8f0] bg-white hover:bg-[#f8fafc]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b] mb-1.5">
                  <span>
                    pos {node.position}
                    {isHead ? ' · HEAD' : ''}
                    {isTail ? ' · TAIL' : ''}
                    {isCur ? ' · CURSOR' : ''}
                  </span>
                  <span className="tabular-nums">id #{node.topic_id}</span>
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-[#0f172a] truncate">
                    {node.title}
                  </div>
                  {node.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                  ) : node.status === 'locked' ? (
                    <Lock className="w-4 h-4 text-[#94a3b8] shrink-0" />
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-[#475569] capitalize">{node.status.replace('_', ' ')}</span>
                  <span className="font-mono font-medium text-[#0f172a] tabular-nums">
                    {node.mastery.toFixed(1)}%
                  </span>
                </div>

                <div className="pt-2.5 border-t border-[#e2e8f0]/80 flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                  <span>prev: {node.prev_id === -1 ? 'NULL' : `#${node.prev_id}`}</span>
                  <span>next: {node.next_id === -1 ? 'NULL' : `#${node.next_id}`}</span>
                </div>
              </div>
            );
          })}
        </div>

        {currentNode && (
          <div className="mt-6 pt-5 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-[#1e293b]">
              Active Cursor: <span className="font-semibold">{currentNode.title}</span>{' '}
              <span className="font-mono text-xs text-[#64748b]">
                (Mastery {currentNode.mastery.toFixed(1)}%)
              </span>
            </div>
            {currentNode.status !== 'locked' && (
              <button
                onClick={() => onStartQuiz(currentNode.topic_id)}
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-medium rounded cursor-pointer"
              >
                Open Active Topic Assessment
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
