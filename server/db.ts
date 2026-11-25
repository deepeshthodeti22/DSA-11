import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'its.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      major TEXT NOT NULL DEFAULT 'Computer Science',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      difficulty INTEGER NOT NULL DEFAULT 1,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      base_weight REAL NOT NULL DEFAULT 1.0,
      description TEXT NOT NULL,
      lesson_content TEXT NOT NULL,
      pos_x REAL NOT NULL DEFAULT 100,
      pos_y REAL NOT NULL DEFAULT 100,
      is_core INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS topic_prerequisites (
      topic_id INTEGER NOT NULL,
      prereq_topic_id INTEGER NOT NULL,
      edge_weight REAL NOT NULL DEFAULT 1.5,
      PRIMARY KEY (topic_id, prereq_topic_id),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (prereq_topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_topic_progress (
      user_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      mastery REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_assessed_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, topic_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      hint TEXT NOT NULL,
      explanation TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      score REAL NOT NULL,
      correct_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      mastery_before REAL NOT NULL,
      mastery_after REAL NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 120,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
  `);

  const subjectCount = db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number };
  if (subjectCount.c === 0) {
    seedCurriculum();
  }
}

export function initializeUserProgress(userId: number): void {
  const topics = db.prepare('SELECT id FROM topics').all() as Array<{ id: number }>;
  const insertProg = db.prepare(`
    INSERT OR IGNORE INTO student_topic_progress (user_id, topic_id, mastery, status, attempts, last_assessed_at)
    VALUES (?, ?, 0.0, 'pending', 0, 0)
  `);
  const tx = db.transaction(() => {
    for (const t of topics) {
      insertProg.run(userId, t.id);
    }
  });
  tx();
}

function seedCurriculum(): void {
  const insertSubject = db.prepare('INSERT INTO subjects (name, code, description) VALUES (?, ?, ?)');
  const s1 = insertSubject.run('Foundational Structures', 'CS-201', 'Asymptotic analysis, contiguous arrays, linked memory, and linear ADTs.').lastInsertRowid as number;
  const s2 = insertSubject.run('Trees & Hierarchies', 'CS-301', 'Binary search trees, AVL self-balancing rotations, and binary priority heaps.').lastInsertRowid as number;
  const s3 = insertSubject.run('Graphs & Optimization', 'CS-401', 'Directed acyclic graphs, BFS/DFS traversals, Dijkstra shortest paths, and dynamic programming.').lastInsertRowid as number;

  const insertTopic = db.prepare(`
    INSERT INTO topics (subject_id, title, slug, difficulty, estimated_minutes, base_weight, description, lesson_content, pos_x, pos_y, is_core)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const topicDefs = [
    {
      subject_id: s1, title: 'Asymptotic Complexity', slug: 'asymptotic-complexity',
      difficulty: 1, mins: 25, weight: 1.0, x: 90, y: 120,
      desc: 'Big-O, Big-Theta, and amortized runtime analysis for algorithm comparison.',
      lesson: 'Asymptotic notation characterizes how runtime and space scale as input size n grows toward infinity. Focus on dominant terms, recurrence relations via the Master Theorem (T(n) = aT(n/b) + f(n)), and amortized analysis for dynamic array resizing.'
    },
    {
      subject_id: s1, title: 'Arrays & Dynamic Buffers', slug: 'arrays-dynamic-buffers',
      difficulty: 1, mins: 30, weight: 1.2, x: 90, y: 290,
      desc: 'Contiguous memory layout, O(1) random indexing, and doubling resize strategies.',
      lesson: 'Contiguous arrays provide O(1) index addressing via base_addr + i * sizeof(T) and superior CPU cache locality. Dynamic buffers double capacity upon overflow, achieving O(1) amortized append while incurring O(n) worst-case copy.'
    },
    {
      subject_id: s1, title: 'Linked Lists & Pointers', slug: 'linked-lists-pointers',
      difficulty: 2, mins: 35, weight: 1.5, x: 280, y: 90,
      desc: 'Singly and doubly linked nodes, pointer manipulation, and in-place reversal.',
      lesson: 'Linked lists decouple logical order from contiguous memory via explicit next/prev pointers. Insertion and deletion at a known node pointer execute in O(1), while random access requires O(n) sequential traversal.'
    },
    {
      subject_id: s1, title: 'Stacks, Queues & BFS Buffers', slug: 'stacks-queues',
      difficulty: 2, mins: 30, weight: 1.4, x: 280, y: 260,
      desc: 'LIFO call stacks, circular ring-buffer queues, and level-order state buffering.',
      lesson: 'Stacks enforce LIFO order for recursion frames and expression parsing; circular queues enforce FIFO order in O(1) without shifting elements, forming the backbone of Breadth-First Search.'
    },
    {
      subject_id: s2, title: 'Hash Tables & Probing', slug: 'hash-tables',
      difficulty: 2, mins: 40, weight: 1.8, x: 280, y: 420,
      desc: 'Hash functions, load factor management, separate chaining, and open addressing.',
      lesson: 'Hash tables map keys to bucket indices in O(1) expected time. When load factor alpha = n/m exceeds 0.75, collisions degrade performance unless mitigated by separate chaining or Robin Hood open addressing and rehashing.'
    },
    {
      subject_id: s2, title: 'Binary Search Trees', slug: 'binary-search-trees',
      difficulty: 3, mins: 45, weight: 2.0, x: 480, y: 120,
      desc: 'BST ordering invariant, in-order sorted traversals, successor search, and Hibbard deletion.',
      lesson: 'Every node in a Binary Search Tree satisfies left < root < right. An in-order traversal yields keys in strictly non-decreasing order. Without balancing, skewed insertions degrade height from O(log n) to O(n).'
    },
    {
      subject_id: s2, title: 'AVL Self-Balancing Trees', slug: 'avl-trees',
      difficulty: 4, mins: 55, weight: 2.6, x: 680, y: 80,
      desc: 'Height balance factors in {-1, 0, +1} and LL, RR, LR, RL tree rotations.',
      lesson: 'Adelson-Velsky and Landis (AVL) trees maintain |height(L) - height(R)| <= 1 at every node. Violations trigger single rotations (LL -> right rotate, RR -> left rotate) or double rotations (LR, RL), guaranteeing O(log n) worst-case lookup, insert, and delete.'
    },
    {
      subject_id: s2, title: 'Binary Heaps & Priority Queues', slug: 'binary-heaps',
      difficulty: 3, mins: 40, weight: 2.1, x: 480, y: 310,
      desc: 'Implicit array-backed trees, Floyd O(n) heapify, sift-up, and extract-max/min.',
      lesson: 'A binary heap stores a complete tree in a flat array where parent(i) = (i-1)/2 and children are 2i+1 and 2i+2. Floyd bottom-up heapify builds a valid heap in O(n), while extract-max/min and insert run in O(log n).'
    },
    {
      subject_id: s3, title: 'Graph Traversals (BFS & DFS)', slug: 'graph-traversals',
      difficulty: 3, mins: 45, weight: 2.2, x: 480, y: 460,
      desc: 'Adjacency lists, unweighted shortest paths via BFS, and 3-color DFS cycle detection.',
      lesson: 'Breadth-First Search explores vertices in non-decreasing hop distance using a FIFO queue, finding unweighted shortest paths in O(V+E). Depth-First Search tracks recursion state (unvisited, visiting, visited) to detect back-edges and cycles.'
    },
    {
      subject_id: s3, title: 'Topological Sort & DAGs', slug: 'topological-dag',
      difficulty: 4, mins: 45, weight: 2.4, x: 680, y: 240,
      desc: 'Kahn in-degree ordering, prerequisite dependency resolution, and longest path in DAGs.',
      lesson: 'A Directed Acyclic Graph permits a linear ordering of vertices such that every directed edge u -> v places u before v. Kahn algorithm iteratively dequeues zero-in-degree vertices in O(V+E) to verify acyclicity and produce valid study sequences.'
    },
    {
      subject_id: s3, title: 'Dijkstra Shortest Path', slug: 'dijkstra-shortest-path',
      difficulty: 4, mins: 55, weight: 2.8, x: 680, y: 410,
      desc: 'Greedy edge relaxation with a Min-Priority Queue on non-negative weighted graphs.',
      lesson: 'Dijkstra algorithm maintains tentative distance estimates and settles the closest unsettled vertex via a Min-Priority Queue. Each outgoing edge (u, v) is relaxed if dist[u] + w(u,v) < dist[v], achieving O((V + E) log V) with a binary heap.'
    },
    {
      subject_id: s3, title: 'Dynamic Programming & Memoization', slug: 'dynamic-programming',
      difficulty: 5, mins: 60, weight: 3.2, x: 870, y: 260,
      desc: 'Optimal substructure, overlapping subproblems, DAG bottom-up tabulation, and state compression.',
      lesson: 'Dynamic Programming solves problems exhibiting overlapping subproblems and optimal substructure by caching subproblem results. Evaluating states along a topological order of the dependency DAG guarantees each state is finalized before its dependents.'
    },
  ];

  const topicIds: Record<string, number> = {};
  for (const t of topicDefs) {
    const id = insertTopic.run(
      t.subject_id, t.title, t.slug, t.difficulty, t.mins, t.weight, t.desc, t.lesson, t.x, t.y
    ).lastInsertRowid as number;
    topicIds[t.slug] = id;
  }

  const insertEdge = db.prepare('INSERT INTO topic_prerequisites (topic_id, prereq_topic_id, edge_weight) VALUES (?, ?, ?)');
  const edges: Array<[string, string, number]> = [
    ['asymptotic-complexity', 'linked-lists-pointers', 1.4],
    ['asymptotic-complexity', 'stacks-queues', 1.3],
    ['arrays-dynamic-buffers', 'stacks-queues', 1.2],
    ['arrays-dynamic-buffers', 'hash-tables', 1.6],
    ['linked-lists-pointers', 'binary-search-trees', 1.8],
    ['stacks-queues', 'binary-search-trees', 1.7],
    ['stacks-queues', 'graph-traversals', 1.9],
    ['arrays-dynamic-buffers', 'binary-heaps', 1.8],
    ['binary-search-trees', 'avl-trees', 2.4],
    ['graph-traversals', 'topological-dag', 2.1],
    ['binary-heaps', 'dijkstra-shortest-path', 2.5],
    ['graph-traversals', 'dijkstra-shortest-path', 2.3],
    ['topological-dag', 'dynamic-programming', 2.8],
    ['avl-trees', 'dynamic-programming', 2.6],
    ['dijkstra-shortest-path', 'dynamic-programming', 3.0],
  ];

  for (const [prereq, target, w] of edges) {
    insertEdge.run(topicIds[target], topicIds[prereq], w);
  }

  /* Seed 36 authentic technical quiz questions (3 per topic) */
  const insertQ = db.prepare(`
    INSERT INTO questions (topic_id, prompt, options_json, correct_index, hint, explanation, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const qBank: Record<string, Array<{ p: string; o: string[]; c: number; h: string; e: string; d: number }>> = {
    'asymptotic-complexity': [
      {
        p: 'What is the tight asymptotic bound for T(n) = 2T(n/2) + n log n using the Master Theorem / recurrence tree?',
        o: ['Theta(n log n)', 'Theta(n log^2 n)', 'Theta(n^2)', 'Theta(n)'],
        c: 1,
        h: 'Compare f(n) = n log n against n^(log_b a) = n^1. This falls into Case 2 extended with a logarithmic factor.',
        e: 'Each of the log n levels of the recursion tree contributes O(n log n) work in the dominant upper levels, summing to Theta(n log^2 n).',
        d: 2
      },
      {
        p: 'If a dynamic array doubles its capacity whenever full, what is the amortized time complexity of n consecutive push_back operations?',
        o: ['O(n log n) per push', 'O(1) per push', 'O(log n) per push', 'O(n) per push'],
        c: 1,
        h: 'Sum the geometric series of copy costs: 1 + 2 + 4 + ... + n.',
        e: 'Total work across n insertions is bounded by 3n, yielding O(1) amortized cost per insertion.',
        d: 1
      },
      {
        p: 'Which growth rate strictly dominates the others as n approaches infinity?',
        o: ['n^(1.5)', 'n * log^3(n)', '2^(log2 n)', 'sqrt(n) * log(n)'],
        c: 0,
        h: 'Remember that 2^(log2 n) simplifies directly to n.',
        e: 'n^1.5 grows faster than any polylogarithmic multiple of n.',
        d: 1
      }
    ],
    'arrays-dynamic-buffers': [
      {
        p: 'Why does iterating sequentially over a contiguous array outperform traversing a linked list of identical size in practice?',
        o: ['Arrays avoid pointer dereferencing and maximize CPU cache-line spatial locality', 'Arrays have smaller Big-O asymptotic traversal complexity', 'Linked lists cannot be iterated in a single loop', 'Arrays automatically compress integers in L1 cache'],
        c: 0,
        h: 'Both traversals are O(n), so consider hardware memory hierarchy.',
        e: 'Contiguous elements sit in adjacent 64-byte cache lines, enabling hardware prefetching and zero pointer chasing.',
        d: 1
      },
      {
        p: 'In a C array `int arr[10]`, if `arr` starts at byte address 0x1000 and `sizeof(int) == 4`, what is the address of `arr[6]`?',
        o: ['0x1006', '0x1018', '0x1024', '0x1012'],
        c: 1,
        h: 'Compute offset = 6 * 4 = 24 bytes in hexadecimal.',
        e: '24 decimal equals 0x18, so 0x1000 + 0x18 = 0x1018.',
        d: 2
      },
      {
        p: 'What is the worst-case time complexity of inserting an element at index 0 of an array of n elements?',
        o: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        c: 2,
        h: 'Existing elements must shift right to preserve contiguity.',
        e: 'All n existing elements must be shifted one slot right, taking O(n) time.',
        d: 1
      }
    ],
    'linked-lists-pointers': [
      {
        p: 'Given a pointer directly to a middle node `cur` in a doubly linked list, what is the time complexity to unlink and delete `cur`?',
        o: ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'],
        c: 2,
        h: 'Both `cur->prev` and `cur->next` are directly accessible without searching.',
        e: 'Updating `cur->prev->next = cur->next` and `cur->next->prev = cur->prev` takes constant O(1) pointer writes.',
        d: 1
      },
      {
        p: 'Which algorithm detects a cycle in a singly linked list using O(1) auxiliary memory?',
        o: ['Hash set of visited node addresses', 'Floyd tortoise-and-hare two-pointer traversal', 'Breadth-First Search with a queue', 'Binary search on node indices'],
        c: 1,
        h: 'Advance one pointer by 1 step and another by 2 steps per iteration.',
        e: 'If a cycle exists, the fast pointer will inevitably lap and meet the slow pointer inside the loop in O(n) time and O(1) space.',
        d: 2
      },
      {
        p: 'In an empty doubly linked list with `head` and `tail` pointers, what must happen when appending the first node `N`?',
        o: ['Only head is set to N', 'Both head and tail are set to N, with prev = NULL and next = NULL', 'N->next points to head', 'tail->prev points to N'],
        c: 1,
        h: 'The single node is simultaneously the first and last element.',
        e: 'Both head and tail must point to N so subsequent head/tail operations remain consistent.',
        d: 1
      }
    ],
    'stacks-queues': [
      {
        p: 'How is the next write index computed in a fixed-capacity circular ring-buffer queue of size M?',
        o: ['(tail + 1) / M', '(tail + 1) % M', 'tail * 2 % M', 'head - tail'],
        c: 1,
        h: 'Modulo arithmetic wraps indices back to 0 at the end of the buffer.',
        e: '`(tail + 1) % M` wraps seamlessly in O(1) without shifting elements.',
        d: 1
      },
      {
        p: 'Which data structure directly models balanced parenthesis verification and function call return addresses?',
        o: ['Priority Queue', 'LIFO Stack', 'FIFO Queue', 'Adjacency Matrix'],
        c: 1,
        h: 'The most recently opened delimiter must be the first one closed.',
        e: 'Last-In-First-Out (LIFO) stacks match nested scopes and stack frames naturally.',
        d: 1
      },
      {
        p: 'If you implement a queue using two stacks (inbox and outbox), what is the amortized cost per enqueue and dequeue?',
        o: ['O(n) enqueue, O(n) dequeue', 'O(1) amortized for both', 'O(log n) amortized for both', 'O(1) enqueue, O(n) amortized dequeue'],
        c: 1,
        h: 'Each element is pushed to inbox once, moved to outbox at most once, and popped once.',
        e: 'Every element undergoes at most 3 stack operations total, yielding O(1) amortized time per operation.',
        d: 3
      }
    ],
    'hash-tables': [
      {
        p: 'In open addressing with linear probing, what phenomenon degrades lookup time when load factor approaches 1?',
        o: ['Primary clustering of contiguous occupied slots', 'Stack overflow during recursion', 'Rotation imbalance in buckets', 'Integer overflow in array capacity'],
        c: 0,
        h: 'Adjacent probe sequences merge into long runs.',
        e: 'Linear probing causes occupied slots to clump together into long contiguous blocks (primary clustering), lengthening probe chains.',
        d: 2
      },
      {
        p: 'Why must deleted slots in an open-addressed hash table be marked with a tombstone rather than cleared directly to EMPTY?',
        o: ['To preserve probe chains for keys inserted after the deleted key', 'To free heap memory asynchronously', 'To keep the hash function deterministic', 'To prevent integer division by zero'],
        c: 0,
        h: 'A search stops when it hits an EMPTY slot.',
        e: 'Clearing a slot to EMPTY would prematurely terminate lookups for keys that had previously collided and probed past that slot.',
        d: 3
      },
      {
        p: 'What is the expected lookup complexity of a well-distributed hash table with load factor bounded below 0.75?',
        o: ['O(log n)', 'O(1)', 'O(sqrt(n))', 'O(n)'],
        c: 1,
        h: 'Expected bucket chain length is O(alpha).',
        e: 'With constant bounded load factor and uniform hashing, expected lookup time is O(1).',
        d: 1
      }
    ],
    'binary-search-trees': [
      {
        p: 'Which BST traversal visits all keys in ascending sorted order?',
        o: ['Pre-order (Root, Left, Right)', 'In-order (Left, Root, Right)', 'Post-order (Left, Right, Root)', 'Level-order BFS'],
        c: 1,
        h: 'Visit smaller keys first, then the current node, then larger keys.',
        e: 'By the BST invariant (left < root < right), in-order traversal outputs keys in strictly sorted order.',
        d: 1
      },
      {
        p: 'When deleting a BST node that has two children, what replaces its key to preserve the BST property?',
        o: ['Either child selected arbitrarily', 'Its in-order successor (minimum of right subtree) or in-order predecessor', 'The root of the entire tree', 'A leaf from the shallowest branch'],
        c: 1,
        h: 'The replacement must be greater than all left-subtree keys and less than all remaining right-subtree keys.',
        e: 'The in-order successor (leftmost node in the right subtree) has at most one child and preserves the strict ordering invariant.',
        d: 2
      },
      {
        p: 'What is the worst-case height of an unbalanced BST after inserting keys [10, 20, 30, 40, 50] in sorted order?',
        o: ['3', '2', '5 (degenerates into a linked chain)', '4 balanced'],
        c: 2,
        h: 'Every new key becomes the right child of the previous node.',
        e: 'Sorted insertion creates a right-skewed chain of height n = 5, degrading operations to O(n).',
        d: 1
      }
    ],
    'avl-trees': [
      {
        p: 'In an AVL tree, a node has balance factor BF = height(left) - height(right) = +2, and its left child has BF = -1. Which rotation sequence restores balance?',
        o: ['Single Left (RR) rotation', 'Single Right (LL) rotation', 'Left-Right (LR) double rotation', 'Right-Left (RL) double rotation'],
        c: 2,
        h: 'The imbalance zig-zags: left child first, then its right subtree.',
        e: 'BF(node) = +2 with BF(node->left) = -1 is the LR zig-zag case: left-rotate the left child, then right-rotate the node.',
        d: 3
      },
      {
        p: 'What is the guaranteed worst-case time complexity of search, insert, and delete in an AVL tree of n nodes?',
        o: ['O(n)', 'O(log n)', 'O(log^2 n)', 'O(1)'],
        c: 1,
        h: 'AVL height is strictly bounded by ~1.44 log2(n).',
        e: 'Strict height balancing keeps tree height logarithmic in n, guaranteeing O(log n) worst-case time for all three operations.',
        d: 1
      },
      {
        p: 'When performing a single Right Rotation (LL fix) around pivot `y` with left child `x`, where does `x->right` (subtree T2) attach?',
        o: ['As y->left', 'As y->right', 'As x->left', 'It is discarded'],
        c: 0,
        h: 'All keys in T2 are greater than x and less than y.',
        e: 'Since x < T2 < y, T2 becomes y->left while y becomes x->right.',
        d: 2
      }
    ],
    'binary-heaps': [
      {
        p: 'In a 0-indexed array representation of a binary Max Heap, what are the child indices of node at index `i`?',
        o: ['i+1 and i+2', '2i and 2i+1', '2i+1 and 2i+2', '(i-1)/2 and (i+1)/2'],
        c: 2,
        h: 'At index 0 (root), children must be at indices 1 and 2.',
        e: 'For 0-based arrays, left child = 2i + 1, right child = 2i + 2, and parent = (i - 1) / 2.',
        d: 1
      },
      {
        p: 'What is the time complexity of Floyd bottom-up `build_heap` on an unsorted array of n elements?',
        o: ['O(n log n)', 'O(n)', 'O(log n)', 'O(n^2)'],
        c: 1,
        h: 'Half the nodes are leaves (0 sift work), a quarter sift at most 1 level, etc.',
        e: 'Summing h * (n / 2^(h+1)) converges to O(n) linear time.',
        d: 2
      },
      {
        p: 'How does `extract_max` remove and return the highest-priority item in O(log n) time?',
        o: ['Shifts all elements left by one index', 'Moves the last element to index 0, shrinks size, and runs sift_down(0)', 'Sorts the entire array and pops the tail', 'Swaps index 0 with index 1 recursively'],
        c: 1,
        h: 'Preserve the complete binary tree shape before restoring the heap property.',
        e: 'Replacing root with the last leaf maintains completeness in O(1), and sifting down restores the max-heap invariant in O(log n).',
        d: 2
      }
    ],
    'graph-traversals': [
      {
        p: 'During a 3-color DFS on a directed graph, encountering an edge to a vertex colored GRAY (currently on recursion stack) proves what?',
        o: ['The graph is bipartite', 'A directed cycle exists (back-edge)', 'The edge is a shortest path', 'The graph is disconnected'],
        c: 1,
        h: 'GRAY means the vertex is an active ancestor of the current node.',
        e: 'An edge from a node to its active ancestor (GRAY) closes a directed cycle.',
        d: 2
      },
      {
        p: 'Which traversal guarantees discovering vertices in order of fewest edges from the source in an unweighted graph?',
        o: ['Depth-First Search', 'Breadth-First Search', 'Post-order Traversal', 'Random Walk'],
        c: 1,
        h: 'Level-by-level expansion explores distance k before k+1.',
        e: 'BFS uses a FIFO queue to visit every vertex at hop distance d before any vertex at d+1.',
        d: 1
      },
      {
        p: 'What is the time complexity of BFS using an adjacency list on a graph with V vertices and E edges?',
        o: ['O(V^2)', 'O(V + E)', 'O(E log V)', 'O(V * E)'],
        c: 1,
        h: 'Each vertex is enqueued at most once and each edge is inspected once (or twice if undirected).',
        e: 'Adjacency-list BFS runs in linear O(V + E) time.',
        d: 1
      }
    ],
    'topological-dag': [
      {
        p: 'In Kahn algorithm for topological sorting, which vertices are placed into the initial queue?',
        o: ['Vertices with out-degree 0', 'Vertices with in-degree 0 (no unmet prerequisites)', 'Vertices with highest edge weight', 'Leaf vertices only'],
        c: 1,
        h: 'Which topics have zero prerequisites?',
        e: 'Vertices with in-degree 0 have no remaining dependencies and can safely start the topological order.',
        d: 1
      },
      {
        p: 'If Kahn algorithm terminates after outputting fewer than V vertices, what does that prove about the directed graph?',
        o: ['It has disconnected components', 'It contains at least one directed cycle', 'It has negative edge weights', 'It is a complete graph'],
        c: 1,
        h: 'Vertices trapped in a cycle never drop to in-degree 0.',
        e: 'Every vertex in a cycle perpetually depends on another vertex in the cycle, so topological ordering is impossible.',
        d: 2
      },
      {
        p: 'Why must prerequisite dependency graphs be strictly acyclic (DAGs) in an Intelligent Tutoring System?',
        o: ['Cycles create circular prerequisite deadlocks where no topic can ever unlock', 'Cyclic graphs cannot be drawn on screen', 'Cycles require floating-point weights', 'DAGs always have exactly one root'],
        c: 0,
        h: 'If A requires B and B requires A, which can a student take first?',
        e: 'A cycle creates an unresolvable mutual dependency, preventing any valid topological learning sequence.',
        d: 1
      }
    ],
    'dijkstra-shortest-path': [
      {
        p: 'Why does Dijkstra algorithm require non-negative edge weights?',
        o: ['Negative weights cause integer overflow in C', 'Once a vertex is popped as minimum from the PQ, a later negative edge could violate the greedy finality assumption', 'Min-heaps cannot store negative numbers', 'BFS handles negative weights instead'],
        c: 1,
        h: 'Dijkstra assumes path cost never decreases as more edges are added.',
        e: 'Dijkstra greedily settles the minimum-distance vertex assuming future extensions only add >= 0 cost.',
        d: 3
      },
      {
        p: 'What is the time complexity of Dijkstra algorithm with a binary Min-Heap Priority Queue on a sparse graph?',
        o: ['O(V^2)', 'O((V + E) log V)', 'O(V * E)', 'O(V + E)'],
        c: 1,
        h: 'Each vertex pop and each edge relaxation push costs O(log V).',
        e: 'Up to V extract-min calls and E relaxations in a binary heap yield O((V + E) log V).',
        d: 2
      },
      {
        p: 'During edge relaxation `(u -> v)` with weight `w`, when is `dist[v]` updated?',
        o: ['Whenever dist[u] < dist[v]', 'Whenever dist[u] + w < dist[v]', 'Whenever w < dist[v]', 'Only when v is unvisited'],
        c: 1,
        h: 'Compare the new path cost through u against the best known cost to v.',
        e: 'If reaching v via u (`dist[u] + w`) strictly improves on `dist[v]`, we update `dist[v]` and `prev[v] = u`.',
        d: 1
      }
    ],
    'dynamic-programming': [
      {
        p: 'What two structural properties characterize a problem solvable via Dynamic Programming?',
        o: ['Greedy choice and randomized hashing', 'Optimal substructure and overlapping subproblems', 'Constant space and linear recursion', 'Bipartite matching and planarity'],
        c: 1,
        h: 'Memoizing saves work only when subproblems repeat.',
        e: 'Optimal substructure lets solutions compose from subproblems; overlapping subproblems make caching (memoization/tabulation) effective.',
        d: 1
      },
      {
        p: 'In bottom-up DP tabulation, why is computing states in topological order of the subproblem DAG critical?',
        o: ['It guarantees every dependency state is finalized before the current state reads it', 'It reduces memory from O(n) to O(1) automatically', 'It converts exponential weights to unit weights', 'It eliminates base cases'],
        c: 0,
        h: 'Think of DP transitions as directed edges in a dependency DAG.',
        e: 'Topological ordering ensures all subproblem inputs are already evaluated prior to computing the dependent state.',
        d: 2
      },
      {
        p: 'How does memoization (top-down DP) avoid recomputing exponential recursion trees?',
        o: ['By caching solved subproblem states in a lookup table keyed by state parameters', 'By replacing recursion with random sampling', 'By sorting input arrays before each recursive call', 'By limiting recursion depth to 10'],
        c: 0,
        h: 'Store and reuse each subproblem answer once computed.',
        e: 'Each unique subproblem state is solved once and returned in O(1) on subsequent visits.',
        d: 1
      }
    ]
  };

  for (const [slug, qs] of Object.entries(qBank)) {
    const tid = topicIds[slug];
    for (const q of qs) {
      insertQ.run(tid, q.p, JSON.stringify(q.o), q.c, q.h, q.e, q.d);
    }
  }

  /* Seed demo student account with realistic learning trajectory */
  const nowSec = Math.floor(Date.now() / 1000);
  const demoPassHash = hashPassword('TutorSys2026!');
  const demoUserId = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, major, created_at)
    VALUES (?, ?, ?, 'student', 'B.S. Computer Science', ?)
  `).run('Alex Chen', 'alex.chen@university.edu', demoPassHash, nowSec - 86400 * 14).lastInsertRowid as number;

  initializeUserProgress(demoUserId);

  const demoHistory: Array<{ slug: string; score: number; masteryAfter: number; daysAgo: number; dur: number }> = [
    { slug: 'asymptotic-complexity', score: 67, masteryAfter: 67, daysAgo: 12, dur: 190 },
    { slug: 'asymptotic-complexity', score: 100, masteryAfter: 88, daysAgo: 10, dur: 145 },
    { slug: 'arrays-dynamic-buffers', score: 85, masteryAfter: 85, daysAgo: 9, dur: 165 },
    { slug: 'linked-lists-pointers', score: 78, masteryAfter: 78, daysAgo: 7, dur: 210 },
    { slug: 'stacks-queues', score: 92, masteryAfter: 92, daysAgo: 5, dur: 130 },
    { slug: 'hash-tables', score: 54, masteryAfter: 54, daysAgo: 4, dur: 240 },
    { slug: 'binary-search-trees', score: 76, masteryAfter: 76, daysAgo: 3, dur: 225 },
    { slug: 'binary-heaps', score: 48, masteryAfter: 48, daysAgo: 2, dur: 260 },
    { slug: 'graph-traversals', score: 82, masteryAfter: 82, daysAgo: 1, dur: 175 },
  ];

  const updateProg = db.prepare(`
    UPDATE student_topic_progress
    SET mastery = ?, status = ?, attempts = attempts + 1, last_assessed_at = ?
    WHERE user_id = ? AND topic_id = ?
  `);
  const insertAssess = db.prepare(`
    INSERT INTO assessments (user_id, topic_id, score, correct_count, total_count, mastery_before, mastery_after, duration_sec, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const prevMasteryMap: Record<string, number> = {};
  for (const h of demoHistory) {
    const tid = topicIds[h.slug];
    const ts = nowSec - h.daysAgo * 86400;
    const before = prevMasteryMap[h.slug] ?? 0;
    prevMasteryMap[h.slug] = h.masteryAfter;
    const status = h.masteryAfter >= 70 ? 'completed' : 'in_progress';
    const correctCount = Math.round((h.score / 100) * 3);
    updateProg.run(h.masteryAfter, status, ts, demoUserId, tid);
    insertAssess.run(demoUserId, tid, h.score, correctCount, 3, before, h.masteryAfter, h.dur, ts);
  }
}
