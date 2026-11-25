import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { QuizQuestion, Topic } from '../types';

interface AssessmentViewProps {
  topicId: number;
  onBack: () => void;
  onAssessmentCompleted: () => Promise<void>;
}

interface GradedResult {
  topic_title: string;
  score: number;
  correct_count: number;
  total_count: number;
  mastery_before: number;
  mastery_after: number;
  passed_threshold: boolean;
  newly_unlocked: Array<{ id: number; title: string }>;
  breakdown: Array<{
    question_id: number;
    prompt: string;
    options: string[];
    selected_index: number;
    correct_index: number;
    is_correct: boolean;
    explanation: string;
  }>;
  engine: any;
}

export const AssessmentView: React.FC<AssessmentViewProps> = ({
  topicId,
  onBack,
  onAssessmentCompleted,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<(Topic & { unmet_prereqs?: Array<{ id: number; title: string; mastery: number }> }) | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [openHints, setOpenHints] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GradedResult | null>(null);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    setOpenHints({});

    apiFetch<{ topic: any; questions: QuizQuestion[] }>(`/api/topics/${topicId}/quiz`)
      .then((res) => {
        if (!active) return;
        setTopic(res.topic);
        setQuestions(res.questions);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [topicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic) return;
    setSubmitting(true);
    setError(null);
    try {
      const durationSec = Math.max(10, Math.round((Date.now() - startedAt) / 1000));
      const res = await apiFetch<GradedResult>('/api/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({
          topic_id: topic.id,
          answers,
          duration_sec: durationSec,
        }),
      });
      setResult(res);
      await onAssessmentCompleted();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 text-sm text-[#64748b]">
        Loading study guide and diagnostic questions...
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 space-y-4">
        <div className="text-sm text-[#ba1a1a]">{error || 'Unable to load topic.'}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-white border border-[#e2e8f0] rounded text-sm font-medium text-[#1e293b] cursor-pointer"
        >
          Back to Curriculum
        </button>
      </div>
    );
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#475569] hover:text-[#0f172a] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Curriculum</span>
        </button>
        <div className="text-xs text-[#64748b] font-mono tabular-nums">
          {topic.subject} · Mastery {topic.mastery.toFixed(1)}% · Target 70%
        </div>
      </div>

      {!topic.unlocked ? (
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-8 max-w-2xl">
          <div className="flex items-center gap-2.5 text-[#0f172a] font-semibold text-lg mb-2">
            <Lock className="w-5 h-5 text-[#64748b]" />
            <span>Topic Locked by Knowledge DAG Prerequisites</span>
          </div>
          <p className="text-sm text-[#475569] mb-4">
            You must reach at least 70% mastery in all prerequisite modules before unlocking{' '}
            <strong>{topic.title}</strong>.
          </p>
          <div className="space-y-2 mb-6">
            {(topic.unmet_prereqs || []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3.5 py-2.5 bg-[#fffbeb] border border-[#fde68a] rounded text-sm text-[#92400e]"
              >
                <span>{p.title}</span>
                <span className="font-mono tabular-nums">{p.mastery.toFixed(0)}% / 70%</span>
              </div>
            ))}
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded cursor-pointer"
          >
            Return to Available Topics
          </button>
        </div>
      ) : (
        /* 50/50 Split Workspace per Stitch Design Spec */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane: Lesson & Conceptual Primer */}
          <div className="lg:col-span-5 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#1e3a8a] mb-1">
                {topic.subject} · Module #{topic.id}
              </div>
              <h2 className="text-2xl font-semibold text-[#0f172a] tracking-tight">
                {topic.title}
              </h2>
              <div className="text-xs text-[#64748b] mt-1">
                Difficulty {topic.difficulty}/5 · Est. {topic.estimated_minutes} min · Attempts:{' '}
                <span className="tabular-nums">{topic.attempts}</span>
              </div>
            </div>

            <div className="border-t border-[#e2e8f0] pt-4">
              <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Core Concept Brief</h3>
              <p className="text-[15px] leading-[1.65] text-[#1e293b] max-w-[72ch]">
                {topic.lesson_content}
              </p>
            </div>

            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded p-4">
              <div className="flex items-center justify-between text-xs text-[#475569] mb-1.5">
                <span>Mastery Progress</span>
                <span className="font-mono font-semibold text-[#0f172a] tabular-nums">
                  {(result ? result.mastery_after : topic.mastery).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#e2e8f0] rounded overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    (result ? result.mastery_after : topic.mastery) >= 70
                      ? 'bg-[#059669]'
                      : 'bg-[#1e3a8a]'
                  }`}
                  style={{
                    width: `${Math.min(100, result ? result.mastery_after : topic.mastery)}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-[#64748b] mt-2">
                Reaching &ge; 70% mastery unlocks downstream topics in the Knowledge DAG and lowers AVL review urgency.
              </div>
            </div>

            {result && (
              <div
                className={`p-4 rounded border space-y-2 ${
                  result.passed_threshold
                    ? 'bg-[#f0fdf4] border-[#a7f3d0] text-[#065f46]'
                    : 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
                }`}
              >
                <div className="text-sm font-semibold">
                  Assessment Score: {result.score.toFixed(0)}% ({result.correct_count}/{result.total_count})
                </div>
                <div className="text-xs font-mono tabular-nums">
                  Mastery updated: {result.mastery_before.toFixed(1)}% &rarr;{' '}
                  {result.mastery_after.toFixed(1)}%
                </div>
                {result.newly_unlocked.length > 0 && (
                  <div className="pt-2 border-t border-[#a7f3d0] text-xs font-medium">
                    Unlocked downstream topics:{' '}
                    {result.newly_unlocked.map((u) => u.title).join(', ')}
                  </div>
                )}
                <div className="text-xs opacity-90 pt-1">
                  C Engine recalibrated AVL schedule ({result.engine?.avl?.rotation_count ?? 0} rotations) and Max Heap priorities.
                </div>
              </div>
            )}
          </div>

          {/* Right Pane: Interactive Assessment Questions */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] rounded-lg p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
            {!result ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#0f172a]">
                      Diagnostic Assessment
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      Select one answer per question. Expand hints if needed.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-[#475569] tabular-nums">
                    {Object.keys(answers).length}/{questions.length} answered
                  </div>
                </div>

                {questions.map((q, idx) => {
                  const hintOpen = !!openHints[q.id];
                  return (
                    <div key={q.id} className="space-y-3 pb-6 border-b border-[#f1f5f9] last:border-0 last:pb-0">
                      <div className="text-sm font-semibold text-[#0f172a] leading-relaxed">
                        <span className="font-mono text-[#1e3a8a] mr-2">0{idx + 1}.</span>
                        {q.prompt}
                      </div>

                      {/* Collapsible Step-by-Step Hint Accordion per Stitch Spec */}
                      <div className="border border-[#e2e8f0] rounded overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenHints((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                          }
                          className="w-full px-3 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-left text-xs font-medium text-[#475569] flex items-center justify-between cursor-pointer"
                        >
                          <span>Pedagogical Hint</span>
                          {hintOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {hintOpen && (
                          <div className="px-3 py-2.5 text-xs text-[#475569] bg-white border-t border-[#e2e8f0]">
                            {q.hint}
                          </div>
                        )}
                      </div>

                      {/* Radio Selector Cards per Stitch Spec */}
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const selected = answers[q.id] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-start gap-3 p-3.5 rounded cursor-pointer transition-colors ${
                                selected
                                  ? 'border-[1.5px] border-[#1e3a8a] bg-[#f8fafc]'
                                  : 'border border-[#e2e8f0] bg-white hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={selected}
                                onChange={() =>
                                  setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                }
                                className="mt-0.5 accent-[#1e3a8a]"
                              />
                              <span className="text-sm text-[#1e293b] leading-snug">{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={!allAnswered || submitting}
                    className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white text-sm font-medium rounded transition-colors cursor-pointer"
                  >
                    {submitting ? 'Grading & Updating C Engine...' : 'Submit Assessment'}
                  </button>
                </div>
              </form>
            ) : (
              /* Graded Review Breakdown */
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
                  <h3 className="text-lg font-semibold text-[#0f172a]">
                    Graded Feedback &amp; Explanations
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setResult(null);
                        setAnswers({});
                      }}
                      className="px-3.5 py-1.5 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-xs font-medium text-[#1e293b] rounded cursor-pointer"
                    >
                      Retake Quiz
                    </button>
                    <button
                      onClick={onBack}
                      className="px-3.5 py-1.5 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="space-y-5">
                  {result.breakdown.map((b, idx) => (
                    <div key={b.question_id} className="space-y-2.5 pb-5 border-b border-[#f1f5f9] last:border-0">
                      <div className="flex items-start gap-2 text-sm font-semibold text-[#0f172a]">
                        {b.is_correct ? (
                          <CheckCircle2 className="w-4 h-4 text-[#059669] mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#ba1a1a] mt-0.5 shrink-0" />
                        )}
                        <span>
                          0{idx + 1}. {b.prompt}
                        </span>
                      </div>

                      <div className="space-y-1.5 pl-6">
                        {b.options.map((opt, oIdx) => {
                          const isCorrectOpt = oIdx === b.correct_index;
                          const isSelectedWrong = oIdx === b.selected_index && !b.is_correct;
                          return (
                            <div
                              key={oIdx}
                              className={`px-3 py-2 rounded text-[13px] border ${
                                isCorrectOpt
                                  ? 'border-[1.5px] border-[#059669] bg-[#f0fdf4] text-[#065f46] font-medium'
                                  : isSelectedWrong
                                  ? 'border border-[#fecaca] bg-[#fef2f2] text-[#991b1b]'
                                  : 'border-[#e2e8f0] bg-white text-[#475569]'
                              }`}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>

                      <div className="ml-6 p-3 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs text-[#475569]">
                        <span className="font-semibold text-[#0f172a]">Explanation: </span>
                        {b.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
