#include "common.h"

/* 3-color DFS cycle detection */
static bool dfs_cycle(int u, int n, int adj[MAX_TOPICS][MAX_TOPICS], int *color) {
    color[u] = 1; /* visiting */
    for (int v = 0; v < n; v++) {
        if (adj[u][v]) {
            if (color[v] == 1) return true;
            if (color[v] == 0 && dfs_cycle(v, n, adj, color)) return true;
        }
    }
    color[u] = 2; /* visited */
    return false;
}

bool dag_would_cycle(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                     int new_from, int new_to) {
    if (new_from == new_to) return true;
    int adj[MAX_TOPICS][MAX_TOPICS];
    memset(adj, 0, sizeof(adj));

    for (int i = 0; i < n_edges; i++) {
        int u = find_topic_idx(topics, n_topics, edges[i].from_id);
        int v = find_topic_idx(topics, n_topics, edges[i].to_id);
        if (u >= 0 && v >= 0) adj[u][v] = 1;
    }

    int nu = find_topic_idx(topics, n_topics, new_from);
    int nv = find_topic_idx(topics, n_topics, new_to);
    if (nu >= 0 && nv >= 0) adj[nu][nv] = 1;

    int color[MAX_TOPICS];
    memset(color, 0, sizeof(color));
    for (int i = 0; i < n_topics; i++) {
        if (color[i] == 0 && dfs_cycle(i, n_topics, adj, color)) {
            return true;
        }
    }
    return false;
}

void run_dag_analysis(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                      int bfs_start_id, bool *unlocked_out, int *topo_order_out, int *topo_len_out,
                      StrBuf *out_json) {
    int adj[MAX_TOPICS][MAX_TOPICS];
    double edge_w[MAX_TOPICS][MAX_TOPICS];
    int in_degree[MAX_TOPICS];
    int out_degree[MAX_TOPICS];
    memset(adj, 0, sizeof(adj));
    memset(edge_w, 0, sizeof(edge_w));
    memset(in_degree, 0, sizeof(in_degree));
    memset(out_degree, 0, sizeof(out_degree));

    for (int i = 0; i < n_edges; i++) {
        int u = find_topic_idx(topics, n_topics, edges[i].from_id);
        int v = find_topic_idx(topics, n_topics, edges[i].to_id);
        if (u >= 0 && v >= 0 && !adj[u][v]) {
            adj[u][v] = 1;
            edge_w[u][v] = edges[i].weight > 0 ? edges[i].weight : 1.0;
            in_degree[v]++;
            out_degree[u]++;
        }
    }

    /* Cycle check */
    int color[MAX_TOPICS];
    memset(color, 0, sizeof(color));
    bool has_cycle = false;
    for (int i = 0; i < n_topics; i++) {
        if (color[i] == 0 && dfs_cycle(i, n_topics, adj, color)) {
            has_cycle = true;
            break;
        }
    }

    /* Prerequisite validation: unlocked iff all direct prerequisites have mastery >= 70.0 */
    for (int v = 0; v < n_topics; v++) {
        bool ok = true;
        for (int u = 0; u < n_topics; u++) {
            if (adj[u][v]) {
                if (topics[u].mastery < 70.0) {
                    ok = false;
                    break;
                }
            }
        }
        unlocked_out[v] = ok;
    }

    /* Kahn's Topological Sort (preferring lower difficulty / lower id deterministically) */
    int deg[MAX_TOPICS];
    memcpy(deg, in_degree, sizeof(deg));
    bool picked[MAX_TOPICS];
    memset(picked, 0, sizeof(picked));
    int topo[MAX_TOPICS];
    int topo_len = 0;

    for (int step = 0; step < n_topics; step++) {
        int best = -1;
        for (int i = 0; i < n_topics; i++) {
            if (!picked[i] && deg[i] == 0) {
                if (best == -1 || topics[i].difficulty < topics[best].difficulty ||
                    (topics[i].difficulty == topics[best].difficulty && topics[i].id < topics[best].id)) {
                    best = i;
                }
            }
        }
        if (best == -1) break;
        picked[best] = true;
        topo[topo_len++] = best;
        for (int v = 0; v < n_topics; v++) {
            if (adj[best][v]) deg[v]--;
        }
    }

    for (int i = 0; i < topo_len; i++) {
        topo_order_out[i] = topics[topo[i]].id;
    }
    *topo_len_out = topo_len;

    /* BFS Traversal from bfs_start_id (or all root nodes if bfs_start_id <= 0) */
    int queue[MAX_TOPICS];
    int level[MAX_TOPICS];
    int parent[MAX_TOPICS];
    bool visited[MAX_TOPICS];
    memset(visited, 0, sizeof(visited));
    for (int i = 0; i < n_topics; i++) { level[i] = -1; parent[i] = -1; }

    int head = 0, tail = 0;
    int start_idx = find_topic_idx(topics, n_topics, bfs_start_id);
    if (start_idx >= 0) {
        visited[start_idx] = true;
        level[start_idx] = 0;
        queue[tail++] = start_idx;
    } else {
        for (int i = 0; i < n_topics; i++) {
            if (in_degree[i] == 0) {
                visited[i] = true;
                level[i] = 0;
                queue[tail++] = i;
            }
        }
    }

    int bfs_order[MAX_TOPICS];
    int bfs_len = 0;
    typedef struct { int from_id; int to_id; int level; } BfsEdge;
    BfsEdge bfs_edges[MAX_EDGES];
    int bfs_edge_count = 0;

    while (head < tail) {
        int u = queue[head++];
        bfs_order[bfs_len++] = u;
        for (int v = 0; v < n_topics; v++) {
            if (adj[u][v] && !visited[v]) {
                visited[v] = true;
                level[v] = level[u] + 1;
                parent[v] = u;
                queue[tail++] = v;
                if (bfs_edge_count < MAX_EDGES) {
                    bfs_edges[bfs_edge_count].from_id = topics[u].id;
                    bfs_edges[bfs_edge_count].to_id = topics[v].id;
                    bfs_edges[bfs_edge_count].level = level[v];
                    bfs_edge_count++;
                }
            }
        }
    }

    /* Emit JSON */
    sb_append(out_json, "{");
    sb_appendf(out_json, "\"is_valid_dag\":%s,", has_cycle ? "false" : "true");
    sb_appendf(out_json, "\"node_count\":%d,\"edge_count\":%d,", n_topics, n_edges);

    sb_append(out_json, "\"nodes\":[");
    for (int i = 0; i < n_topics; i++) {
        if (i > 0) sb_append(out_json, ",");
        const char *derived_status = "locked";
        if (topics[i].mastery >= 70.0) derived_status = "completed";
        else if (unlocked_out[i] && topics[i].attempts > 0) derived_status = "in_progress";
        else if (unlocked_out[i]) derived_status = "pending";

        sb_appendf(out_json,
            "{\"id\":%d,\"title\":", topics[i].id);
        sb_append_json_str(out_json, topics[i].title);
        sb_append(out_json, ",\"subject\":");
        sb_append_json_str(out_json, topics[i].subject);
        sb_appendf(out_json,
            ",\"difficulty\":%d,\"estimated_minutes\":%d,\"mastery\":%.1f,"
            "\"unlocked\":%s,\"in_degree\":%d,\"out_degree\":%d,"
            "\"bfs_level\":%d,\"status\":",
            topics[i].difficulty, topics[i].estimated_minutes, topics[i].mastery,
            unlocked_out[i] ? "true" : "false", in_degree[i], out_degree[i], level[i]);
        sb_append_json_str(out_json, derived_status);
        sb_appendf(out_json, ",\"pos_x\":%.1f,\"pos_y\":%.1f}", topics[i].pos_x, topics[i].pos_y);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"edges\":[");
    for (int i = 0; i < n_edges; i++) {
        if (i > 0) sb_append(out_json, ",");
        int u = find_topic_idx(topics, n_topics, edges[i].from_id);
        bool satisfied = (u >= 0 && topics[u].mastery >= 70.0);
        sb_appendf(out_json, "{\"from\":%d,\"to\":%d,\"weight\":%.2f,\"satisfied\":%s}",
                   edges[i].from_id, edges[i].to_id, edges[i].weight,
                   satisfied ? "true" : "false");
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"topological_order\":[");
    for (int i = 0; i < topo_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        int idx = topo[i];
        sb_appendf(out_json, "{\"id\":%d,\"title\":", topics[idx].id);
        sb_append_json_str(out_json, topics[idx].title);
        sb_appendf(out_json, ",\"unlocked\":%s,\"mastery\":%.1f}",
                   unlocked_out[idx] ? "true" : "false", topics[idx].mastery);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"bfs_traversal\":[");
    for (int i = 0; i < bfs_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        int idx = bfs_order[i];
        sb_appendf(out_json, "{\"step\":%d,\"id\":%d,\"title\":", i + 1, topics[idx].id);
        sb_append_json_str(out_json, topics[idx].title);
        sb_appendf(out_json, ",\"level\":%d,\"parent_id\":%d}",
                   level[idx], parent[idx] >= 0 ? topics[parent[idx]].id : -1);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"bfs_edges\":[");
    for (int i = 0; i < bfs_edge_count; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "{\"from\":%d,\"to\":%d,\"level\":%d}",
                   bfs_edges[i].from_id, bfs_edges[i].to_id, bfs_edges[i].level);
    }
    sb_append(out_json, "]");
    sb_append(out_json, "}");
}
