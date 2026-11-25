#include "common.h"

/* Custom C Min-Priority Queue for Dijkstra's Algorithm */
typedef struct {
    int node_idx;
    double dist;
} MinPQItem;

typedef struct {
    MinPQItem data[MAX_TOPICS * 4];
    int size;
} MinPQ;

static void min_pq_push(MinPQ *pq, int node_idx, double dist) {
    if (pq->size >= MAX_TOPICS * 4) return;
    int i = pq->size++;
    pq->data[i].node_idx = node_idx;
    pq->data[i].dist = dist;
    while (i > 0) {
        int p = (i - 1) / 2;
        if (pq->data[i].dist < pq->data[p].dist) {
            MinPQItem tmp = pq->data[i];
            pq->data[i] = pq->data[p];
            pq->data[p] = tmp;
            i = p;
        } else {
            break;
        }
    }
}

static MinPQItem min_pq_pop(MinPQ *pq) {
    MinPQItem top = pq->data[0];
    pq->data[0] = pq->data[--pq->size];
    int i = 0;
    while (1) {
        int l = 2 * i + 1;
        int r = 2 * i + 2;
        int sm = i;
        if (l < pq->size && pq->data[l].dist < pq->data[sm].dist) sm = l;
        if (r < pq->size && pq->data[r].dist < pq->data[sm].dist) sm = r;
        if (sm != i) {
            MinPQItem tmp = pq->data[i];
            pq->data[i] = pq->data[sm];
            pq->data[sm] = tmp;
            i = sm;
        } else {
            break;
        }
    }
    return top;
}

typedef struct {
    char action[24]; /* "init", "pop_min", "relax", "skip_locked" */
    int from_id;
    int to_id;
    double weight;
    double new_dist;
    char detail[256];
} DijkStep;

void run_dijkstra_path(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                       int start_id, int target_id, bool respect_prereqs, StrBuf *out_json) {
    const double INF = 1e12;
    double dist[MAX_TOPICS];
    int prev[MAX_TOPICS];
    bool settled[MAX_TOPICS];
    bool unlocked[MAX_TOPICS];
    double adj_w[MAX_TOPICS][MAX_TOPICS];

    for (int i = 0; i < n_topics; i++) {
        dist[i] = INF;
        prev[i] = -1;
        settled[i] = false;
        unlocked[i] = true;
        for (int j = 0; j < n_topics; j++) adj_w[i][j] = -1.0;
    }

    for (int v = 0; v < n_topics; v++) {
        for (int e = 0; e < n_edges; e++) {
            if (edges[e].to_id == topics[v].id) {
                int u = find_topic_idx(topics, n_topics, edges[e].from_id);
                if (u >= 0 && topics[u].mastery < 70.0) {
                    unlocked[v] = false;
                }
            }
        }
    }

    /* Effective edge weight incorporates base prerequisite cost + target mastery gap */
    for (int e = 0; e < n_edges; e++) {
        int u = find_topic_idx(topics, n_topics, edges[e].from_id);
        int v = find_topic_idx(topics, n_topics, edges[e].to_id);
        if (u >= 0 && v >= 0) {
            double base = edges[e].weight > 0 ? edges[e].weight : (double)topics[v].estimated_minutes / 10.0;
            double mastery_factor = 1.0 + (100.0 - topics[v].mastery) / 100.0;
            double eff = round((base * mastery_factor) * 100.0) / 100.0;
            adj_w[u][v] = eff;
        }
    }

    DijkStep steps[MAX_STEPS];
    int step_count = 0;
    MinPQ pq;
    pq.size = 0;

    int start_idx = find_topic_idx(topics, n_topics, start_id);
    int target_idx = find_topic_idx(topics, n_topics, target_id);

    /* If start_id <= 0, initialize from all currently unlocked/active topics (mastery >= 70 or root unlocked) */
    if (start_idx >= 0) {
        dist[start_idx] = 0.0;
        min_pq_push(&pq, start_idx, 0.0);
        if (step_count < MAX_STEPS) {
            snprintf(steps[step_count].action, 24, "init");
            steps[step_count].from_id = topics[start_idx].id;
            steps[step_count].to_id = topics[start_idx].id;
            steps[step_count].weight = 0.0;
            steps[step_count].new_dist = 0.0;
            snprintf(steps[step_count].detail, 256, "Source initialized at #%d (%s), cost = 0.0",
                     topics[start_idx].id, topics[start_idx].title);
            step_count++;
        }
    } else {
        for (int i = 0; i < n_topics; i++) {
            bool is_root = true;
            for (int e = 0; e < n_edges; e++) {
                if (edges[e].to_id == topics[i].id) { is_root = false; break; }
            }
            if (is_root || topics[i].mastery >= 70.0) {
                double init_cost = topics[i].mastery >= 70.0 ? 0.0 :
                    round(((double)topics[i].estimated_minutes / 10.0) * (1.0 + (100.0 - topics[i].mastery) / 100.0) * 100.0) / 100.0;
                dist[i] = init_cost;
                min_pq_push(&pq, i, init_cost);
                if (step_count < MAX_STEPS) {
                    snprintf(steps[step_count].action, 24, "init");
                    steps[step_count].from_id = topics[i].id;
                    steps[step_count].to_id = topics[i].id;
                    steps[step_count].weight = init_cost;
                    steps[step_count].new_dist = init_cost;
                    snprintf(steps[step_count].detail, 256, "Frontier node #%d (%s) queued at cost %.2f",
                             topics[i].id, topics[i].title, init_cost);
                    step_count++;
                }
            }
        }
    }

    /* Choose sensible target if none provided: highest difficulty unmastered topic */
    if (target_idx < 0 && n_topics > 0) {
        int best = n_topics - 1;
        for (int i = 0; i < n_topics; i++) {
            if (topics[i].mastery < 70.0 && topics[i].difficulty >= topics[best].difficulty) {
                best = i;
            }
        }
        target_idx = best;
    }

    while (pq.size > 0) {
        MinPQItem cur = min_pq_pop(&pq);
        int u = cur.node_idx;
        if (settled[u]) continue;
        settled[u] = true;

        if (step_count < MAX_STEPS) {
            snprintf(steps[step_count].action, 24, "pop_min");
            steps[step_count].from_id = topics[u].id;
            steps[step_count].to_id = topics[u].id;
            steps[step_count].weight = dist[u];
            steps[step_count].new_dist = dist[u];
            snprintf(steps[step_count].detail, 256, "Pop Min-PQ: #%d (%s), accumulated effort %.2f",
                     topics[u].id, topics[u].title, dist[u]);
            step_count++;
        }

        if (u == target_idx) break;

        for (int v = 0; v < n_topics; v++) {
            if (adj_w[u][v] >= 0.0 && !settled[v]) {
                /* Prerequisite constraint check: to traverse u -> v, either respect_prereqs is false,
                   or all prerequisites of v are either mastered or already settled on the candidate path */
                bool prereqs_ok = true;
                if (respect_prereqs) {
                    for (int e = 0; e < n_edges; e++) {
                        if (edges[e].to_id == topics[v].id) {
                            int p = find_topic_idx(topics, n_topics, edges[e].from_id);
                            if (p >= 0 && p != u && topics[p].mastery < 70.0 && dist[p] >= INF * 0.5) {
                                prereqs_ok = false;
                                break;
                            }
                        }
                    }
                }
                if (!prereqs_ok) {
                    if (step_count < MAX_STEPS) {
                        snprintf(steps[step_count].action, 24, "skip_locked");
                        steps[step_count].from_id = topics[u].id;
                        steps[step_count].to_id = topics[v].id;
                        steps[step_count].weight = adj_w[u][v];
                        steps[step_count].new_dist = dist[v];
                        snprintf(steps[step_count].detail, 256,
                                 "Blocked %s -> %s: unreached prerequisite constraint",
                                 topics[u].title, topics[v].title);
                        step_count++;
                    }
                    continue;
                }

                double cand = dist[u] + adj_w[u][v];
                if (cand < dist[v]) {
                    dist[v] = cand;
                    prev[v] = u;
                    min_pq_push(&pq, v, cand);
                    if (step_count < MAX_STEPS) {
                        snprintf(steps[step_count].action, 24, "relax");
                        steps[step_count].from_id = topics[u].id;
                        steps[step_count].to_id = topics[v].id;
                        steps[step_count].weight = adj_w[u][v];
                        steps[step_count].new_dist = cand;
                        snprintf(steps[step_count].detail, 256,
                                 "Relaxed %s -> %s (edge %.2f): new dist = %.2f",
                                 topics[u].title, topics[v].title, adj_w[u][v], cand);
                        step_count++;
                    }
                }
            }
        }
    }

    /* Reconstruct shortest path */
    int path[MAX_TOPICS];
    int path_len = 0;
    bool reachable = (target_idx >= 0 && dist[target_idx] < INF * 0.5);
    if (reachable) {
        int cur = target_idx;
        while (cur != -1 && path_len < MAX_TOPICS) {
            path[path_len++] = cur;
            cur = prev[cur];
        }
        /* Reverse */
        for (int i = 0; i < path_len / 2; i++) {
            int t = path[i];
            path[i] = path[path_len - 1 - i];
            path[path_len - 1 - i] = t;
        }
    }

    sb_append(out_json, "{");
    sb_appendf(out_json, "\"start_id\":%d,\"target_id\":%d,\"reachable\":%s,\"total_cost\":%.2f,",
               start_idx >= 0 ? topics[start_idx].id : -1,
               target_idx >= 0 ? topics[target_idx].id : -1,
               reachable ? "true" : "false",
               reachable ? dist[target_idx] : -1.0);

    sb_append(out_json, "\"path\":[");
    for (int i = 0; i < path_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        int idx = path[i];
        sb_appendf(out_json, "{\"id\":%d,\"title\":", topics[idx].id);
        sb_append_json_str(out_json, topics[idx].title);
        sb_appendf(out_json, ",\"dist\":%.2f,\"mastery\":%.1f,\"unlocked\":%s}",
                   dist[idx], topics[idx].mastery, unlocked[idx] ? "true" : "false");
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"distances\":[");
    for (int i = 0; i < n_topics; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "{\"topic_id\":%d,\"dist\":%.2f,\"reachable\":%s,\"prev_id\":%d}",
                   topics[i].id,
                   dist[i] < INF * 0.5 ? dist[i] : -1.0,
                   dist[i] < INF * 0.5 ? "true" : "false",
                   prev[i] >= 0 ? topics[prev[i]].id : -1);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"steps\":[");
    for (int i = 0; i < step_count; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_append(out_json, "{\"action\":");
        sb_append_json_str(out_json, steps[i].action);
        sb_appendf(out_json, ",\"from_id\":%d,\"to_id\":%d,\"weight\":%.2f,\"new_dist\":%.2f,\"detail\":",
                   steps[i].from_id, steps[i].to_id, steps[i].weight,
                   steps[i].new_dist < INF * 0.5 ? steps[i].new_dist : -1.0);
        sb_append_json_str(out_json, steps[i].detail);
        sb_append(out_json, "}");
    }
    sb_append(out_json, "]}");
}
