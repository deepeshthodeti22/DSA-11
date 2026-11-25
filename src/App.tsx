import React, { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  GitFork,
  Binary,
  Clock,
  Flame,
  Route,
  Link2,
  LogOut,
  Menu,
  X,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, setAuthToken } from './lib/api';
import { DashboardPayload, User } from './types';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView, NavSection } from './components/DashboardView';
import { CurriculumView } from './components/CurriculumView';
import { AssessmentView } from './components/AssessmentView';
import { DagVisualizer } from './components/visualizations/DagVisualizer';
import { AvlVisualizer } from './components/visualizations/AvlVisualizer';
import { BstVisualizer } from './components/visualizations/BstVisualizer';
import { HeapVisualizer } from './components/visualizations/HeapVisualizer';
import { DijkstraVisualizer } from './components/visualizations/DijkstraVisualizer';
import { LinkedListVisualizer } from './components/visualizations/LinkedListVisualizer';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  const [section, setSection] = useState<NavSection>('dashboard');
  const [activeQuizTopicId, setActiveQuizTopicId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoadingDash(true);
    setDashError(null);
    try {
      const data = await apiFetch<DashboardPayload>('/api/dashboard');
      setDashboard(data);
      setUser(data.user);
    } catch (err) {
      setDashError((err as Error).message);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  useEffect(() => {
    if (user && !dashboard) {
      fetchDashboard();
    }
  }, [user, dashboard, fetchDashboard]);

  const handleAuthenticated = (authedUser: User) => {
    setUser(authedUser);
    setSection('dashboard');
    setActiveQuizTopicId(null);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    setUser(null);
    setDashboard(null);
    setActiveQuizTopicId(null);
  };

  const handleStartQuiz = (topicId: number) => {
    setActiveQuizTopicId(topicId);
    setMobileMenuOpen(false);
  };

  const handleSelectSection = (next: NavSection) => {
    setSection(next);
    setActiveQuizTopicId(null);
    setMobileMenuOpen(false);
  };

  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const navWorkspace: Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'curriculum', label: 'Curriculum & Quizzes', icon: BookOpen },
  ];

  const navAlgorithms: Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dag', label: 'Knowledge DAG + BFS', icon: GitFork },
    { id: 'avl', label: 'AVL Scheduler', icon: Binary },
    { id: 'bst', label: 'BST History', icon: Clock },
    { id: 'heap', label: 'Max Heap Queue', icon: Flame },
    { id: 'dijkstra', label: 'Dijkstra Path', icon: Route },
    { id: 'linkedlist', label: 'Linked List Chain', icon: Link2 },
  ];

  const sectionTitles: Record<NavSection, string> = {
    dashboard: 'Student Overview & Adaptive Analytics',
    curriculum: 'Curriculum Topics, Prerequisites & Assessments',
    dag: 'Knowledge DAG, BFS & Kahn Topological Sort',
    avl: 'AVL Adaptive Scheduler & Live Rotations',
    bst: 'BST Timestamped Performance History',
    heap: 'Max Heap Dynamic Urgency Queue',
    dijkstra: 'Dijkstra Shortest Learning Path',
    linkedlist: 'Doubly Linked List Mastery Chain',
  };

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex">
      {/* Persistent Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-[#e2e8f0] z-30">
        {/* Brand */}
        <div className="h-16 px-5 border-b border-[#e2e8f0] flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-[#1e3a8a] text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-[#0f172a] whitespace-nowrap">
            ScholarGraph
          </span>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              Learning Workspace
            </div>
            <nav className="space-y-1">
              {navWorkspace.map((item) => {
                const Icon = item.icon;
                const active = !activeQuizTopicId && section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#eff6ff] text-[#1e3a8a]'
                        : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
              C Algorithm Engine
            </div>
            <nav className="space-y-1">
              {navAlgorithms.map((item) => {
                const Icon = item.icon;
                const active = !activeQuizTopicId && section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#eff6ff] text-[#1e3a8a]'
                        : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Student Profile Footer */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#fcfcfd]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#1e3a8a] text-white text-xs font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#0f172a] truncate">{user.name}</div>
              <div className="text-xs text-[#64748b] truncate">{user.major}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 px-3 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-xs font-medium text-[#475569] hover:text-[#0f172a] rounded flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0f172a]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full border-r border-[#e2e8f0] flex flex-col z-10">
            <div className="h-14 px-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-base font-bold text-[#0f172a]">ScholarGraph</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-[#475569] cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-5">
              <div className="space-y-1">
                {navWorkspace.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded cursor-pointer ${
                        section === item.id && !activeQuizTopicId
                          ? 'bg-[#eff6ff] text-[#1e3a8a]'
                          : 'text-[#475569]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">
                  Algorithms
                </div>
                {navAlgorithms.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSection(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded cursor-pointer ${
                        section === item.id && !activeQuizTopicId
                          ? 'bg-[#eff6ff] text-[#1e3a8a]'
                          : 'text-[#475569]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-[#e2e8f0]">
              <div className="text-sm font-semibold text-[#0f172a]">{user.name}</div>
              <div className="text-xs text-[#64748b] mb-3">{user.email}</div>
              <button
                onClick={handleLogout}
                className="w-full py-2 border border-[#e2e8f0] rounded text-xs font-medium text-[#1e293b] cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Clean 3-Zone Top Header Bar */}
        <header className="h-16 bg-white border-b border-[#e2e8f0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-[#475569] hover:text-[#0f172a] cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-[#0f172a] truncate">
              {activeQuizTopicId ? 'Topic Study & Diagnostic Assessment' : sectionTitles[section]}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchDashboard}
              disabled={loadingDash}
              title="Refresh C Engine State"
              className="p-2 bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] rounded text-[#475569] hover:text-[#0f172a] cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDash ? 'animate-spin' : ''}`} />
            </button>

            {dashboard?.next_activity && !activeQuizTopicId && (
              <button
                onClick={() => handleStartQuiz(dashboard.next_activity!.topic_id)}
                className="px-3.5 py-2 bg-[#1e3a8a] hover:bg-[#1e293b] text-white text-xs font-medium rounded flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Start Recommended</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {dashError && (
            <div className="mb-6 p-4 bg-[#fef2f2] border border-[#fecaca] rounded text-sm text-[#991b1b]">
              {dashError}
            </div>
          )}

          {!dashboard ? (
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-10 text-center text-sm text-[#64748b]">
              Initializing SQLite state and executing C algorithm engine...
            </div>
          ) : activeQuizTopicId !== null ? (
            <AssessmentView
              topicId={activeQuizTopicId}
              onBack={() => setActiveQuizTopicId(null)}
              onAssessmentCompleted={fetchDashboard}
            />
          ) : section === 'dashboard' ? (
            <DashboardView
              data={dashboard}
              onStartQuiz={handleStartQuiz}
              onNavigate={handleSelectSection}
            />
          ) : section === 'curriculum' ? (
            <CurriculumView
              topics={dashboard.topics}
              subjects={dashboard.subjects}
              edges={dashboard.edges}
              onRefresh={fetchDashboard}
              onStartQuiz={handleStartQuiz}
            />
          ) : section === 'dag' ? (
            <DagVisualizer
              initialDag={dashboard.engine.dag}
              topics={dashboard.topics}
              onStartQuiz={handleStartQuiz}
            />
          ) : section === 'avl' ? (
            <AvlVisualizer initialAvl={dashboard.engine.avl} />
          ) : section === 'bst' ? (
            <BstVisualizer initialBst={dashboard.engine.bst} />
          ) : section === 'heap' ? (
            <HeapVisualizer initialHeap={dashboard.engine.heap} />
          ) : section === 'dijkstra' ? (
            <DijkstraVisualizer
              initialDijkstra={dashboard.engine.dijkstra}
              dag={dashboard.engine.dag}
              topics={dashboard.topics}
            />
          ) : (
            <LinkedListVisualizer
              initialList={dashboard.engine.linked_list}
              onStartQuiz={handleStartQuiz}
            />
          )}
        </main>
      </div>
    </div>
  );
}
