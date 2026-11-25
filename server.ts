import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase, initializeUserProgress, hashPassword, verifyPassword } from './server/db.ts';
import { ensureCEngineBuilt, runCEngine } from './server/cEngine.ts';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  major: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
  token?: string;
}

function loadUserGraphPayload(userId: number) {
  const topics = db.prepare(`
    SELECT
      t.id, t.title, s.name AS subject, s.id AS subject_id, s.code AS subject_code,
      t.difficulty, t.estimated_minutes, t.base_weight, t.description, t.lesson_content,
      t.pos_x, t.pos_y, t.is_core,
      COALESCE(p.mastery, 0.0) AS mastery,
      COALESCE(p.status, 'pending') AS status,
      COALESCE(p.attempts, 0) AS attempts,
      COALESCE(p.last_assessed_at, 0) AS last_assessed_at
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN student_topic_progress p ON p.topic_id = t.id AND p.user_id = ?
    ORDER BY t.id ASC
  `).all(userId) as Array<any>;

  const edges = db.prepare(`
    SELECT prereq_topic_id AS from_id, topic_id AS to_id, edge_weight AS weight
    FROM topic_prerequisites
    ORDER BY prereq_topic_id, topic_id
  `).all() as Array<{ from_id: number; to_id: number; weight: number }>;

  const assessments = db.prepare(`
    SELECT a.id, a.topic_id, t.title AS topic_title, a.score, a.correct_count, a.total_count,
           a.mastery_before, a.mastery_after, a.duration_sec, a.timestamp
    FROM assessments a
    JOIN topics t ON t.id = a.topic_id
    WHERE a.user_id = ?
    ORDER BY a.timestamp ASC, a.id ASC
  `).all(userId) as Array<any>;

  return { topics, edges, assessments };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.major
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now) as AuthUser | undefined;

  if (!row) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.user = row;
  req.token = token;
  next();
}

async function startServer() {
  initDatabase();
  ensureCEngineBuilt();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  /* Security headers */
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  /* Health check */
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  /* AUTH ROUTES */
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const major = String(req.body?.major || 'Computer Science').trim() || 'Computer Science';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const passHash = hashPassword(password);
    const userId = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, major, created_at)
      VALUES (?, ?, ?, 'student', ?, ?)
    `).run(name, email, passHash, major, now).lastInsertRowid as number;

    initializeUserProgress(userId);

    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token, userId, now, now + 86400 * 7
    );

    res.status(201).json({
      token,
      user: { id: userId, name, email, role: 'student', major },
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRow = db.prepare(`
      SELECT id, name, email, password_hash, role, major
      FROM users WHERE email = ?
    `).get(email) as (AuthUser & { password_hash: string }) | undefined;

    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    initializeUserProgress(userRow.id);

    const now = Math.floor(Date.now() / 1000);
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      token, userRow.id, now, now + 86400 * 7
    );

    res.json({
      token,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        major: userRow.major,
      },
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  /* FULL DASHBOARD (POWERED BY C ENGINE) */
  app.get('/api/dashboard', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { topics, edges, assessments } = loadUserGraphPayload(userId);
      const subjects = db.prepare('SELECT id, name, code, description FROM subjects ORDER BY id').all();

      const engineOut = await runCEngine({
        command: 'analyze_all',
        topics,
        edges,
        assessments,
      });

      /* Build topic lookup map */
      const dagNodeMap = new Map<number, any>();
      for (const n of engineOut.dag?.nodes || []) {
        dagNodeMap.set(n.id, n);
      }

      const enrichedTopics = topics.map((t) => {
        const dn = dagNodeMap.get(t.id);
        const prereqIds = edges.filter((e) => e.to_id === t.id).map((e) => e.from_id);
        return {
          ...t,
          unlocked: dn ? dn.unlocked : true,
          derived_status: dn ? dn.status : t.status,
          bfs_level: dn ? dn.bfs_level : 0,
          prereq_ids: prereqIds,
        };
      });

      /* Weak-topic recommendations: unlocked topics with mastery < 70%, ordered by Max Heap urgency */
      const heapItems: Array<any> = engineOut.heap?.heap_array || [];
      const sortedByUrgency = [...heapItems]
        .filter((h) => h.unlocked && h.mastery < 70)
        .sort((a, b) => b.urgency - a.urgency);

      const weakRecommendations = sortedByUrgency.slice(0, 4).map((h) => {
        const topic = enrichedTopics.find((t) => t.id === h.topic_id);
        return {
          topic_id: h.topic_id,
          title: h.title,
          subject: topic?.subject || '',
          mastery: h.mastery,
          urgency: h.urgency,
          estimated_minutes: topic?.estimated_minutes || 30,
          reason:
            h.mastery > 0
              ? `In-progress mastery (${h.mastery.toFixed(0)}%) requires reinforcement to pass 70% threshold`
              : `Unlocked prerequisite frontier ready for initial diagnostic assessment`,
        };
      });

      /* Next recommended activity from AVL top priority + Max Heap */
      const nextActivity =
        weakRecommendations[0] ||
        (enrichedTopics.find((t) => t.unlocked && t.mastery < 100)
          ? {
              topic_id: enrichedTopics.find((t) => t.unlocked && t.mastery < 100)!.id,
              title: enrichedTopics.find((t) => t.unlocked && t.mastery < 100)!.title,
              subject: enrichedTopics.find((t) => t.unlocked && t.mastery < 100)!.subject,
              mastery: enrichedTopics.find((t) => t.unlocked && t.mastery < 100)!.mastery,
              urgency: 30,
              estimated_minutes: enrichedTopics.find((t) => t.unlocked && t.mastery < 100)!.estimated_minutes,
              reason: 'All unlocked topics mastered — scheduled maintenance review',
            }
          : null);

      const recentAssessments = [...assessments].reverse().slice(0, 8);

      res.json({
        user: req.user,
        subjects,
        topics: enrichedTopics,
        edges,
        assessments: recentAssessments,
        all_assessments: assessments,
        weak_recommendations: weakRecommendations,
        next_activity: nextActivity,
        engine: engineOut,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* TOPICS & SUBJECTS MANAGEMENT */
  app.get('/api/topics', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const q = String(req.query.q || '').trim().toLowerCase();
      const subjectFilter = String(req.query.subject || '').trim();
      const statusFilter = String(req.query.status || '').trim();

      const { topics, edges } = loadUserGraphPayload(userId);
      const dagRes = await runCEngine({ command: 'dag_traverse', topics, edges });
      const nodeMap = new Map<number, any>();
      for (const n of dagRes.dag?.nodes || []) nodeMap.set(n.id, n);

      let result = topics.map((t) => {
        const dn = nodeMap.get(t.id);
        const prereqIds = edges.filter((e) => e.to_id === t.id).map((e) => e.from_id);
        return {
          ...t,
          unlocked: dn ? dn.unlocked : true,
          derived_status: dn ? dn.status : t.status,
          prereq_ids: prereqIds,
        };
      });

      if (q) {
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q)
        );
      }
      if (subjectFilter && subjectFilter !== 'all') {
        result = result.filter((t) => t.subject === subjectFilter || String(t.subject_id) === subjectFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        result = result.filter((t) => t.derived_status === statusFilter);
      }

      const subjects = db.prepare('SELECT id, name, code, description FROM subjects ORDER BY id').all();
      res.json({ topics: result, subjects, edges });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/subjects', requireAuth, (req: AuthedRequest, res) => {
    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || '').trim().toUpperCase();
    const description = String(req.body?.description || '').trim();
    if (!name || !code) {
      res.status(400).json({ error: 'Subject name and code are required.' });
      return;
    }
    const existing = db.prepare('SELECT id FROM subjects WHERE name = ?').get(name);
    if (existing) {
      res.status(409).json({ error: 'Subject with this name already exists.' });
      return;
    }
    const id = db.prepare('INSERT INTO subjects (name, code, description) VALUES (?, ?, ?)').run(
      name, code, description || 'Custom curriculum subject.'
    ).lastInsertRowid as number;
    res.status(201).json({ subject: { id, name, code, description } });
  });

  app.post('/api/topics', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const title = String(req.body?.title || '').trim();
      const subjectId = Number(req.body?.subject_id || 1);
      const difficulty = Math.min(5, Math.max(1, Number(req.body?.difficulty || 2)));
      const estimatedMinutes = Math.min(180, Math.max(10, Number(req.body?.estimated_minutes || 35)));
      const description = String(req.body?.description || '').trim();
      const lessonContent = String(req.body?.lesson_content || '').trim();
      const prereqIds: number[] = Array.isArray(req.body?.prereq_ids)
        ? req.body.prereq_ids.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
        : [];

      if (title.length < 3 || title.length > 100) {
        res.status(400).json({ error: 'Topic title must be between 3 and 100 characters.' });
        return;
      }

      const subjectExists = db.prepare('SELECT id FROM subjects WHERE id = ?').get(subjectId);
      if (!subjectExists) {
        res.status(400).json({ error: 'Selected subject does not exist.' });
        return;
      }

      const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      const countRow = db.prepare('SELECT COUNT(*) as c FROM topics').get() as { c: number };
      const posX = 120 + ((countRow.c % 4) * 230);
      const posY = 100 + (Math.floor(countRow.c / 4) * 160);

      const newTopicId = db.transaction(() => {
        const tid = db.prepare(`
          INSERT INTO topics (subject_id, title, slug, difficulty, estimated_minutes, base_weight, description, lesson_content, pos_x, pos_y, is_core)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(
          subjectId,
          title,
          slug,
          difficulty,
          estimatedMinutes,
          1.0 + difficulty * 0.4,
          description || `Study module covering ${title}.`,
          lessonContent || `${title}: Core principles, invariant analysis, and algorithmic tradeoffs.`,
          posX,
          posY
        ).lastInsertRowid as number;

        const insertEdge = db.prepare('INSERT OR IGNORE INTO topic_prerequisites (topic_id, prereq_topic_id, edge_weight) VALUES (?, ?, ?)');
        for (const pid of prereqIds) {
          if (pid !== tid) insertEdge.run(tid, pid, 1.5 + difficulty * 0.25);
        }

        const allUsers = db.prepare('SELECT id FROM users').all() as Array<{ id: number }>;
        const insertProg = db.prepare(`
          INSERT OR IGNORE INTO student_topic_progress (user_id, topic_id, mastery, status, attempts, last_assessed_at)
          VALUES (?, ?, 0.0, 'pending', 0, 0)
        `);
        for (const u of allUsers) {
          insertProg.run(u.id, tid);
        }

        /* Seed 2 default diagnostic questions for the custom topic so assessments work immediately */
        const insertQ = db.prepare(`
          INSERT INTO questions (topic_id, prompt, options_json, correct_index, hint, explanation, difficulty)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertQ.run(
          tid,
          `Which statement best characterizes the primary objective of ${title}?`,
          JSON.stringify([
            `Structuring invariants and operations cleanly for ${title}`,
            'Bypassing prerequisite dependencies in the DAG',
            'Disabling asymptotic complexity bounds',
            'Using O(n^3) brute force on all inputs'
          ]),
          0,
          'Focus on structural invariants and algorithmic efficiency.',
          `${title} establishes clear invariants that support predictable complexity and composition.`,
          difficulty
        );
        insertQ.run(
          tid,
          `When integrating ${title} into an adaptive pipeline, what must be verified first?`,
          JSON.stringify([
            'All prerequisite concepts meet mastery threshold >= 70%',
            'Only the final leaf node is evaluated',
            'No memory allocation is permitted',
            'Sorting is avoided completely'
          ]),
          0,
          'Recall how the Knowledge DAG governs topic readiness.',
          'Mastering prerequisite foundations ensures readiness for higher-difficulty modules.',
          difficulty
        );

        return tid;
      })();

      const updated = loadUserGraphPayload(userId);
      res.status(201).json({ topic_id: newTopicId, topics: updated.topics });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/topics/:id', requireAuth, (req: AuthedRequest, res) => {
    const topicId = Number(req.params.id);
    const topic = db.prepare('SELECT id, is_core FROM topics WHERE id = ?').get(topicId) as { id: number; is_core: number } | undefined;
    if (!topic) {
      res.status(404).json({ error: 'Topic not found.' });
      return;
    }
    if (topic.is_core === 1) {
      res.status(400).json({ error: 'Core curriculum topics cannot be deleted. You can delete custom-created topics.' });
      return;
    }
    db.prepare('DELETE FROM topics WHERE id = ?').run(topicId);
    res.json({ ok: true });
  });

  /* ADD OR REMOVE PREREQUISITE EDGE WITH C ENGINE DAG CYCLE GUARD */
  app.post('/api/topics/:id/prerequisites', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const targetId = Number(req.params.id);
      const prereqId = Number(req.body?.prereq_topic_id);
      const action = String(req.body?.action || 'add');
      const weight = Number(req.body?.weight || 1.8);

      if (!Number.isInteger(targetId) || !Number.isInteger(prereqId) || targetId <= 0 || prereqId <= 0) {
        res.status(400).json({ error: 'Valid topic IDs are required.' });
        return;
      }

      if (action === 'remove') {
        db.prepare('DELETE FROM topic_prerequisites WHERE topic_id = ? AND prereq_topic_id = ?').run(targetId, prereqId);
        res.json({ ok: true });
        return;
      }

      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const validation = await runCEngine<{ valid: boolean; would_cycle: boolean }>({
        command: 'validate_dag',
        topics,
        edges,
        from_id: prereqId,
        to_id: targetId,
      });

      if (!validation.valid || validation.would_cycle) {
        res.status(422).json({
          error: 'Cycle detected by C DAG engine: adding this prerequisite edge would violate acyclicity.',
          would_cycle: true,
        });
        return;
      }

      db.prepare('INSERT OR REPLACE INTO topic_prerequisites (topic_id, prereq_topic_id, edge_weight) VALUES (?, ?, ?)').run(
        targetId, prereqId, weight
      );
      res.json({ ok: true, validation });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* QUIZ & ASSESSMENT SYSTEM */
  app.get('/api/topics/:id/quiz', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const topicId = Number(req.params.id);
      const { topics, edges } = loadUserGraphPayload(userId);
      const topic = topics.find((t) => t.id === topicId);
      if (!topic) {
        res.status(404).json({ error: 'Topic not found.' });
        return;
      }

      const dagRes = await runCEngine({ command: 'dag_traverse', topics, edges });
      const dagNode = (dagRes.dag?.nodes || []).find((n: any) => n.id === topicId);
      const unlocked = dagNode ? dagNode.unlocked : true;

      const prereqIds = edges.filter((e) => e.to_id === topicId).map((e) => e.from_id);
      const unmetPrereqs = prereqIds
        .map((pid) => topics.find((t) => t.id === pid))
        .filter((pt) => pt && pt.mastery < 70)
        .map((pt) => ({ id: pt!.id, title: pt!.title, mastery: pt!.mastery }));

      const questions = db.prepare(`
        SELECT id, topic_id, prompt, options_json, hint, difficulty
        FROM questions
        WHERE topic_id = ?
        ORDER BY id ASC
      `).all(topicId) as Array<any>;

      res.json({
        topic: {
          ...topic,
          unlocked,
          unmet_prereqs: unmetPrereqs,
        },
        questions: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: JSON.parse(q.options_json),
          hint: q.hint,
          difficulty: q.difficulty,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/assessments/submit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const topicId = Number(req.body?.topic_id);
      const answers = req.body?.answers as Record<string, number> | undefined;
      const durationSec = Math.max(10, Math.min(3600, Number(req.body?.duration_sec || 90)));

      if (!Number.isInteger(topicId) || !answers || typeof answers !== 'object') {
        res.status(400).json({ error: 'topic_id and answers map are required.' });
        return;
      }

      const { topics, edges } = loadUserGraphPayload(userId);
      const topic = topics.find((t) => t.id === topicId);
      if (!topic) {
        res.status(404).json({ error: 'Topic not found.' });
        return;
      }

      /* Enforce prerequisite validation via C DAG engine */
      const dagRes = await runCEngine({ command: 'dag_traverse', topics, edges });
      const dagNode = (dagRes.dag?.nodes || []).find((n: any) => n.id === topicId);
      if (dagNode && !dagNode.unlocked) {
        res.status(403).json({
          error: 'Topic is locked until all prerequisite topics reach >= 70% mastery.',
        });
        return;
      }

      const questions = db.prepare(`
        SELECT id, prompt, options_json, correct_index, explanation
        FROM questions WHERE topic_id = ? ORDER BY id ASC
      `).all(topicId) as Array<any>;

      if (questions.length === 0) {
        res.status(400).json({ error: 'No questions configured for this topic.' });
        return;
      }

      let correctCount = 0;
      const breakdown = questions.map((q) => {
        const chosen = Number(answers[String(q.id)] ?? -1);
        const isCorrect = chosen === q.correct_index;
        if (isCorrect) correctCount++;
        return {
          question_id: q.id,
          prompt: q.prompt,
          options: JSON.parse(q.options_json),
          selected_index: chosen,
          correct_index: q.correct_index,
          is_correct: isCorrect,
          explanation: q.explanation,
        };
      });

      const score = Math.round((correctCount / questions.length) * 1000) / 10;
      const masteryBefore = topic.mastery;
      /* Weighted mastery update: blends historical mastery with latest assessment */
      const masteryAfter =
        topic.attempts === 0
          ? score
          : Math.round((masteryBefore * 0.35 + score * 0.65) * 10) / 10;

      const newStatus = masteryAfter >= 70 ? 'completed' : 'in_progress';
      const now = Math.floor(Date.now() / 1000);

      const assessmentId = db.transaction(() => {
        db.prepare(`
          INSERT INTO student_topic_progress (user_id, topic_id, mastery, status, attempts, last_assessed_at)
          VALUES (?, ?, ?, ?, 1, ?)
          ON CONFLICT(user_id, topic_id) DO UPDATE SET
            mastery = excluded.mastery,
            status = excluded.status,
            attempts = student_topic_progress.attempts + 1,
            last_assessed_at = excluded.last_assessed_at
        `).run(userId, topicId, masteryAfter, newStatus, now);

        return db.prepare(`
          INSERT INTO assessments (user_id, topic_id, score, correct_count, total_count, mastery_before, mastery_after, duration_sec, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, topicId, score, correctCount, questions.length, masteryBefore, masteryAfter, durationSec, now)
          .lastInsertRowid as number;
      })();

      /* Re-run full C algorithm engine to detect newly unlocked topics and schedule updates */
      const afterPayload = loadUserGraphPayload(userId);
      const engineOut = await runCEngine({
        command: 'analyze_all',
        topics: afterPayload.topics,
        edges: afterPayload.edges,
        assessments: afterPayload.assessments,
      });

      const newlyUnlocked = (engineOut.dag?.nodes || [])
        .filter((n: any) => {
          const prevNode = (dagRes.dag?.nodes || []).find((p: any) => p.id === n.id);
          return n.unlocked && prevNode && !prevNode.unlocked;
        })
        .map((n: any) => ({ id: n.id, title: n.title }));

      res.json({
        assessment_id: assessmentId,
        topic_id: topicId,
        topic_title: topic.title,
        score,
        correct_count: correctCount,
        total_count: questions.length,
        mastery_before: masteryBefore,
        mastery_after: masteryAfter,
        passed_threshold: masteryAfter >= 70,
        newly_unlocked: newlyUnlocked,
        breakdown,
        engine: engineOut,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* DEDICATED C ENGINE VISUALIZATION ENDPOINTS */
  app.post('/api/engine/dag', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const bfsStartId = Number(req.body?.bfs_start_id ?? -1);
      const out = await runCEngine({
        command: 'dag_traverse',
        topics,
        edges,
        bfs_start_id: bfsStartId,
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/engine/avl', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
      const out = await runCEngine({
        command: 'avl_operate',
        topics,
        edges,
        params: { operations },
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/engine/bst', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { assessments } = loadUserGraphPayload(req.user!.id);
      const params = req.body?.params || {};
      const out = await runCEngine({
        command: 'bst_operate',
        assessments,
        params,
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/engine/heap', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
      const out = await runCEngine({
        command: 'heap_operate',
        topics,
        edges,
        params: { operations },
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/engine/dijkstra', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const startId = Number(req.body?.start_id ?? -1);
      const targetId = Number(req.body?.target_id ?? -1);
      const respectPrereqs = req.body?.respect_prereqs !== false;
      const out = await runCEngine({
        command: 'dijkstra_path',
        topics,
        edges,
        start_id: startId,
        target_id: targetId,
        respect_prereqs: respectPrereqs,
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/engine/linkedlist', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { topics, edges } = loadUserGraphPayload(req.user!.id);
      const action = String(req.body?.action || 'sync');
      const currentId = Number(req.body?.current_id ?? -1);
      const targetId = Number(req.body?.target_id ?? -1);
      const newStatus = String(req.body?.new_status || '');
      const newMastery = req.body?.new_mastery !== undefined ? Number(req.body.new_mastery) : -1;

      const out = await runCEngine({
        command: 'linkedlist_operate',
        topics,
        edges,
        current_id: currentId,
        action,
        target_id: targetId,
        new_status: newStatus,
        new_mastery: newMastery,
      });
      res.json(out);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /* Vite middleware (dev) or static production bundle */
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Adaptive Tutoring System listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
