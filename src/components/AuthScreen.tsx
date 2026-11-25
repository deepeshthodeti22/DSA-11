import React, { useState } from 'react';
import { BookOpen, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api';
import { User } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [major, setMajor] = useState('B.S. Computer Science');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { name, email, password, major };
      const res = await apiFetch<{ token: string; user: User }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'alex.chen@university.edu',
          password: 'TutorSys2026!',
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Academic Overview Panel */}
        <div className="lg:col-span-6 bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-8 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(15,23,42,0.05)]">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 rounded bg-[#1e3a8a] text-white flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-[#0f172a]">
                ScholarGraph
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-[-0.02em] text-[#0f172a] leading-tight mb-4">
              Adaptive Curriculum &amp; Algorithm Tutoring
            </h1>
            <p className="text-[15px] leading-relaxed text-[#475569] mb-8">
              Every learning path, prerequisite check, and assessment schedule is computed live by an embedded C algorithm engine backed by SQLite persistence.
            </p>

            <div className="border-t border-[#e2e8f0] pt-6 space-y-4">
              {[
                {
                  title: 'Knowledge DAG & Topological Sort',
                  desc: 'Validates prerequisite mastery (>= 70%) before unlocking advanced modules.',
                },
                {
                  title: 'AVL Adaptive Scheduler & Max Heap',
                  desc: 'Balances mastery gaps with LL, RR, LR, RL rotations and prioritizes urgent topics.',
                },
                {
                  title: 'BST Performance History & Dijkstra Path',
                  desc: 'Tracks timestamped assessments and computes optimal weighted study routes.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#059669] mt-1 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[#0f172a]">{item.title}</div>
                    <div className="text-[13px] text-[#64748b]">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#e2e8f0] text-xs text-[#64748b]">
            Computer Science Curriculum · 12 Interconnected Modules · 36 Diagnostic Questions
          </div>
        </div>

        {/* Right Sign In / Registration Form */}
        <div className="lg:col-span-6 bg-[#ffffff] border border-[#e2e8f0] rounded-lg p-8 shadow-[0_1px_3px_0_rgba(15,23,42,0.05)] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1 p-1 bg-[#f1f5f9] rounded-md mb-6 w-fit">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`px-4 py-1.5 text-[13px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'login'
                    ? 'bg-[#ffffff] text-[#0f172a] shadow-xs'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`px-4 py-1.5 text-[13px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'register'
                    ? 'bg-[#ffffff] text-[#0f172a] shadow-xs'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                Create Student Account
              </button>
            </div>

            <h2 className="text-xl font-semibold text-[#0f172a] tracking-[-0.01em] mb-1">
              {mode === 'login' ? 'Welcome back' : 'Register student profile'}
            </h2>
            <p className="text-[13px] text-[#64748b] mb-6">
              {mode === 'login'
                ? 'Sign in to access your adaptive schedule and algorithm workspace.'
                : 'Start from foundational prerequisites and build your mastery graph.'}
            </p>

            {error && (
              <div className="mb-5 p-3 rounded bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-[13px] font-medium text-[#1e293b] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Patel"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#e2e8f0] rounded text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                  />
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-[#1e293b] mb-1.5">
                  Academic Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#e2e8f0] rounded text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#1e293b] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#e2e8f0] rounded text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-[13px] font-medium text-[#1e293b] mb-1.5">
                    Program / Major
                  </label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="B.S. Computer Science"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#e2e8f0] rounded text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/10"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : mode === 'login'
                    ? 'Sign In to Workspace'
                    : 'Create Account & Initialize Graph'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-5 border-t border-[#e2e8f0]">
            <div className="text-xs text-[#64748b] mb-2.5">
              Explore immediately with a pre-seeded student profile (9 assessments logged):
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full py-2 px-4 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] text-[#1e293b] text-[13px] font-medium rounded transition-colors cursor-pointer"
            >
              Sign in as Demo Student (Alex Chen)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
