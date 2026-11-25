import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const C_ENGINE_DIR = path.resolve(process.cwd(), 'c_engine');
const C_ENGINE_BIN = path.join(C_ENGINE_DIR, 'its_engine');

export function ensureCEngineBuilt(): void {
  if (!fs.existsSync(C_ENGINE_BIN)) {
    execFileSync('make', ['-C', C_ENGINE_DIR], { stdio: 'inherit' });
  }
}

export interface CEnginePayload {
  command:
    | 'analyze_all'
    | 'validate_dag'
    | 'dag_traverse'
    | 'avl_operate'
    | 'bst_operate'
    | 'heap_operate'
    | 'dijkstra_path'
    | 'linkedlist_operate';
  topics?: Array<{
    id: number;
    title: string;
    subject: string;
    difficulty: number;
    estimated_minutes: number;
    base_weight: number;
    mastery: number;
    attempts: number;
    last_assessed_at: number;
    pos_x: number;
    pos_y: number;
    status: string;
  }>;
  edges?: Array<{
    from_id: number;
    to_id: number;
    weight: number;
  }>;
  assessments?: Array<{
    id: number;
    topic_id: number;
    topic_title: string;
    score: number;
    mastery_after: number;
    timestamp: number;
  }>;
  bfs_start_id?: number;
  dijkstra_start_id?: number;
  dijkstra_target_id?: number;
  start_id?: number;
  target_id?: number;
  respect_prereqs?: boolean;
  from_id?: number;
  to_id?: number;
  current_id?: number;
  action?: string;
  new_status?: string;
  new_mastery?: number;
  params?: Record<string, unknown>;
}

export function runCEngine<T = any>(payload: CEnginePayload): Promise<T> {
  ensureCEngineBuilt();

  return new Promise((resolve, reject) => {
    const child = spawn(C_ENGINE_BIN, [], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('C algorithm engine timed out'));
    }, 5000);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`C engine exited with code ${code}: ${stderr || stdout}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed as T);
      } catch (err) {
        reject(new Error(`Failed to parse C engine JSON output: ${(err as Error).message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
