import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Lock,
  CheckCircle2,
  ArrowRight,
  Trash2,
  AlertCircle,
  GitMerge,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Topic, Subject, PrereqEdge } from '../types';

interface CurriculumViewProps {
  topics: Topic[];
  subjects: Subject[];
  edges: PrereqEdge[];
  onRefresh: () => Promise<void>;
  onStartQuiz: (topicId: number) => void;
}

export const CurriculumView: React.FC<CurriculumViewProps> = ({
  topics,
  subjects,
  edges,
  onRefresh,
  onStartQuiz,
}) => {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showAddTopic, setShowAddTopic] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [edgeModalTopic, setEdgeModalTopic] = useState<Topic | null>(null);

  /* New Topic Form */
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState<number>(subjects[0]?.id || 1);
  const [newDifficulty, setNewDifficulty] = useState(2);
  const [newMinutes, setNewMinutes] = useState(35);
  const [newDesc, setNewDesc] = useState('');
  const [newLesson, setNewLesson] = useState('');
  const [newPrereqs, setNewPrereqs] = useState<number[]>([]);

  /* New Subject Form */
  const [subjName, setSubjName] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjDesc, setSubjDesc] = useState('');

  /* Prerequisite Edge Form */
  const [selectedPrereqId, setSelectedPrereqId] = useState<number>(0);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (q) {
        const hit =
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      if (statusFilter !== 'all' && t.derived_status !== statusFilter) return false;
      return true;
    });
  }, [topics, search, subjectFilter, statusFilter]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/topics', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          subject_id: newSubjectId,
          difficulty: newDifficulty,
          estimated_minutes: newMinutes,
          description: newDesc,
          lesson_content: newLesson,
          prereq_ids: newPrereqs,
        }),
      });
      setNewTitle('');
      setNewDesc('');
      setNewLesson('');
      setNewPrereqs([]);
      setShowAddTopic(false);
      setFeedback({ type: 'success', text: 'Topic added to SQLite curriculum & Knowledge DAG.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch('/api/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: subjName, code: subjCode, description: subjDesc }),
      });
      setSubjName('');
      setSubjCode('');
      setSubjDesc('');
      setShowAddSubject(false);
      setFeedback({ type: 'success', text: 'New subject created.' });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/topics/${topic.id}`, { method: 'DELETE' });
      setFeedback({ type: 'success', text: `Deleted custom topic "${topic.title}".` });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleEdgeChange = async (topicId: number, prereqId: number, action: 'add' | 'remove') => {
    setBusy(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/topics/${topicId}/prerequisites`, {
        method: 'POST',
        body: JSON.stringify({ prereq_topic_id: prereqId, action }),
      });
      setFeedback({
        type: 'success',
        text:
          action === 'add'
            ? 'Prerequisite edge verified acyclic by C DAG engine and saved.'
            : 'Prerequisite edge removed.',
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const topicMap = useMemo(() => {
    const m = new Map<number, Topic>();
    topics.forEach((t) => m.set(t.id, t));
    return m;
  }, [topics]);

  return (
    <div className="space-y-6">
      {/* Toolbar: Search, Filters, and Create Actions */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search topics or concepts..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#e2e8f0] rounded text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filter by subject"
              className="px-3 py-2 text-sm bg-white border border-[#e2e8f0] rounded text-[#1e293b] focus:outline-none focus:border-[#1e3a8a]"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowAddSubject((v) => !v)}
              className="px-3.5 py-2 text-[13px] font-medium bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#1e293b] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              + New Subject
            </button>
            <button
              onClick={() => setShowAddTopic((v) => !v)}
              className="px-4 py-2 text-[13px] font-medium bg-[#1e3a8a] hover:bg-[#1e293b] text-white rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Topic</span>
            </button>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="mt-4 pt-4 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#f1f5f9] rounded-md overflow-x-auto">
            {[
              { id: 'all', label: 'All Modules' },
              { id: 'pending', label: 'Ready to Learn' },
              { id: 'in_progress', label: 'Needs Review' },
              { id: 'completed', label: 'Mastered' },
              { id: 'locked', label: 'Locked' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#0f172a] shadow-xs'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-[#64748b] tabular-nums">
            Showing {filteredTopics.length} of {topics.length} curriculum topics
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded border text-[13px] flex items-center justify-between gap-3 ${
            feedback.type === 'error'
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Subject Form */}
      {showAddSubject && (
        <form
          onSubmit={handleCreateSubject}
          className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0f172a]">Create Curriculum Subject</h3>
            <button
              type="button"
              onClick={() => setShowAddSubject(false)}
              className="text-xs text-[#64748b] hover:text-[#0f172a] cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="Subject Name (e.g. Compilers)"
              value={subjName}
              onChange={(e) => setSubjName(e.target.value)}
              className="px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
            />
            <input
              type="text"
              required
              placeholder="Course Code (e.g. CS-410)"
              value={subjCode}
              onChange={(e) => setSubjCode(e.target.value)}
              className="px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
            />
            <input
              type="text"
              placeholder="Short description"
              value={subjDesc}
              onChange={(e) => setSubjDesc(e.target.value)}
              className="px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-[#1e3a8a] text-white text-xs font-medium rounded hover:bg-[#1e293b] cursor-pointer"
          >
            Save Subject
          </button>
        </form>
      )}

      {/* Add Topic Form */}
      {showAddTopic && (
        <form
          onSubmit={handleCreateTopic}
          className="bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#0f172a]">Add Custom Curriculum Topic</h3>
            <button
              type="button"
              onClick={() => setShowAddTopic(false)}
              className="text-xs text-[#64748b] hover:text-[#0f172a] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#475569] mb-1">Topic Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Red-Black Trees & Amortized Rotations"
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Subject</label>
              <select
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1">Difficulty (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1">Est. Min</label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Short Description</label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Concise learning objectives"
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Lesson Summary</label>
              <input
                type="text"
                value={newLesson}
                onChange={(e) => setNewLesson(e.target.value)}
                placeholder="Key algorithmic invariants and formulas"
                className="w-full px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Prerequisites (must reach &ge; 70% to unlock)
            </label>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => {
                const active = newPrereqs.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setNewPrereqs((prev) =>
                        active ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                      )
                    }
                    className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                        : 'bg-white text-[#475569] border-[#e2e8f0] hover:border-[#94a3b8]'
                    }`}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-sm font-medium rounded cursor-pointer"
            >
              Create Topic &amp; Seed Questions
            </button>
          </div>
        </form>
      )}

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredTopics.map((topic) => {
          const prereqList = topic.prereq_ids
            .map((id) => topicMap.get(id))
            .filter(Boolean) as Topic[];

          return (
            <div
              key={topic.id}
              className="bg-white border border-[#e2e8f0] rounded-lg p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h3 className="text-base font-semibold text-[#0f172a] leading-snug">
                    {topic.title}
                  </h3>
                  {topic.is_core === 0 && (
                    <button
                      onClick={() => handleDeleteTopic(topic)}
                      title="Delete custom topic"
                      className="p-1 text-[#64748b] hover:text-[#ba1a1a] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Unboxed metadata per Stitch + Zero-Pill rule */}
                <div className="text-xs text-[#64748b] mb-3 flex flex-wrap items-center gap-1.5">
                  <span>{topic.subject_code}</span>
                  <span aria-hidden="true">·</span>
                  <span>Level {topic.difficulty}/5</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{topic.estimated_minutes} min</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-medium ${
                      topic.derived_status === 'completed'
                        ? 'text-[#059669]'
                        : topic.derived_status === 'in_progress'
                        ? 'text-[#92400e]'
                        : topic.derived_status === 'locked'
                        ? 'text-[#64748b]'
                        : 'text-[#1e3a8a]'
                    }`}
                  >
                    {topic.derived_status === 'completed'
                      ? 'Mastered'
                      : topic.derived_status === 'in_progress'
                      ? 'Needs Review'
                      : topic.derived_status === 'locked'
                      ? 'Locked'
                      : 'Unlocked'}
                  </span>
                </div>

                <p className="text-[13px] text-[#475569] leading-relaxed mb-4">
                  {topic.description}
                </p>

                {/* Mastery Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#64748b]">Mastery</span>
                    <span className="font-mono font-medium text-[#0f172a] tabular-nums">
                      {topic.mastery.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#e2e8f0] rounded overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        topic.mastery >= 70 ? 'bg-[#059669]' : 'bg-[#1e3a8a]'
                      }`}
                      style={{ width: `${Math.min(100, topic.mastery)}%` }}
                    />
                  </div>
                </div>

                {/* Prerequisites text */}
                <div className="text-xs text-[#64748b] mb-4">
                  <span className="font-medium text-[#475569]">Prerequisites: </span>
                  {prereqList.length === 0
                    ? 'None (Foundational Root)'
                    : prereqList.map((p) => `${p.title} (${p.mastery.toFixed(0)}%)`).join(', ')}
                </div>
              </div>

              <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setEdgeModalTopic(topic);
                    setSelectedPrereqId(0);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] border border-[#e2e8f0] rounded flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Prerequisites</span>
                </button>

                {topic.unlocked ? (
                  <button
                    onClick={() => onStartQuiz(topic.id)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      topic.mastery >= 70
                        ? 'bg-[#059669] hover:bg-[#047857] text-white'
                        : 'bg-[#1e3a8a] hover:bg-[#1e293b] text-white'
                    }`}
                  >
                    <span>{topic.attempts > 0 ? 'Re-assess' : 'Study & Quiz'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-3 py-1.5 text-xs font-medium bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prerequisite Edge Modal (Cycle Checked by C Engine) */}
      {edgeModalTopic && (
        <div className="fixed inset-0 z-50 bg-[#0f172a]/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e2e8f0] rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#0f172a]">
                Prerequisites for {edgeModalTopic.title}
              </h3>
              <button
                onClick={() => setEdgeModalTopic(null)}
                className="p-1 text-[#64748b] hover:text-[#0f172a] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#64748b]">
              New prerequisite edges are verified in real time by the C Knowledge DAG cycle detector. Any edge introducing a cycle is rejected.
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {edges
                .filter((e) => e.to_id === edgeModalTopic.id)
                .map((e) => {
                  const pt = topicMap.get(e.from_id);
                  if (!pt) return null;
                  return (
                    <div
                      key={e.from_id}
                      className="flex items-center justify-between px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded text-sm"
                    >
                      <span>
                        {pt.title}{' '}
                        <span className="text-xs font-mono text-[#64748b]">
                          ({pt.mastery.toFixed(0)}%)
                        </span>
                      </span>
                      <button
                        disabled={busy}
                        onClick={() => handleEdgeChange(edgeModalTopic.id, e.from_id, 'remove')}
                        className="text-xs text-[#ba1a1a] hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              {edges.filter((e) => e.to_id === edgeModalTopic.id).length === 0 && (
                <div className="text-xs text-[#64748b] py-2">
                  No prerequisites assigned (this is a root topic).
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#e2e8f0] flex items-center gap-2">
              <select
                value={selectedPrereqId}
                onChange={(e) => setSelectedPrereqId(Number(e.target.value))}
                className="flex-1 px-3 py-2 text-sm border border-[#e2e8f0] rounded focus:outline-none focus:border-[#1e3a8a]"
              >
                <option value={0}>Select prerequisite topic to add...</option>
                {topics
                  .filter(
                    (t) =>
                      t.id !== edgeModalTopic.id &&
                      !edges.some((e) => e.to_id === edgeModalTopic.id && e.from_id === t.id)
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
              <button
                disabled={busy || selectedPrereqId <= 0}
                onClick={() => handleEdgeChange(edgeModalTopic.id, selectedPrereqId, 'add')}
                className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e293b] disabled:opacity-50 text-white text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                Validate &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
