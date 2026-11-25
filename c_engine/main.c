#include "common.h"

static char *read_all_stdin(void) {
    size_t cap = 16384;
    size_t len = 0;
    char *buf = (char *)malloc(cap);
    if (!buf) return NULL;
    size_t n;
    while ((n = fread(buf + len, 1, cap - len - 1, stdin)) > 0) {
        len += n;
        if (cap - len - 1 < 4096) {
            cap *= 2;
            char *nb = (char *)realloc(buf, cap);
            if (!nb) { free(buf); return NULL; }
            buf = nb;
        }
    }
    buf[len] = '\0';
    return buf;
}

static void parse_topics(JVal *root, Topic *topics, int *n_topics) {
    *n_topics = 0;
    JVal *arr = jobj_get(root, "topics");
    if (!arr || arr->type != J_ARR) return;
    for (int i = 0; i < arr->count && *n_topics < MAX_TOPICS; i++) {
        JVal *t = arr->items[i];
        Topic *dst = &topics[*n_topics];
        memset(dst, 0, sizeof(Topic));
        dst->id = jobj_int(t, "id", i + 1);
        snprintf(dst->title, MAX_TITLE, "%s", jobj_str(t, "title", "Topic"));
        snprintf(dst->subject, 64, "%s", jobj_str(t, "subject", "General"));
        dst->difficulty = jobj_int(t, "difficulty", 1);
        dst->estimated_minutes = jobj_int(t, "estimated_minutes", 30);
        dst->base_weight = jobj_num(t, "base_weight", 1.0);
        dst->mastery = jobj_num(t, "mastery", 0.0);
        dst->attempts = jobj_int(t, "attempts", 0);
        dst->last_assessed_at = (long long)jobj_num(t, "last_assessed_at", 0.0);
        dst->pos_x = jobj_num(t, "pos_x", 100.0 + (i % 4) * 200.0);
        dst->pos_y = jobj_num(t, "pos_y", 100.0 + (i / 4) * 140.0);
        snprintf(dst->status, MAX_STATUS, "%s", jobj_str(t, "status", "pending"));
        (*n_topics)++;
    }
}

static void parse_edges(JVal *root, PrereqEdge *edges, int *n_edges) {
    *n_edges = 0;
    JVal *arr = jobj_get(root, "edges");
    if (!arr || arr->type != J_ARR) return;
    for (int i = 0; i < arr->count && *n_edges < MAX_EDGES; i++) {
        JVal *e = arr->items[i];
        edges[*n_edges].from_id = jobj_int(e, "from_id", jobj_int(e, "from", 0));
        edges[*n_edges].to_id = jobj_int(e, "to_id", jobj_int(e, "to", 0));
        edges[*n_edges].weight = jobj_num(e, "weight", 1.0);
        (*n_edges)++;
    }
}

static void parse_assessments(JVal *root, AssessmentRecord *recs, int *n_recs) {
    *n_recs = 0;
    JVal *arr = jobj_get(root, "assessments");
    if (!arr || arr->type != J_ARR) return;
    for (int i = 0; i < arr->count && *n_recs < MAX_ASSESSMENTS; i++) {
        JVal *a = arr->items[i];
        AssessmentRecord *r = &recs[*n_recs];
        memset(r, 0, sizeof(AssessmentRecord));
        r->id = jobj_int(a, "id", i + 1);
        r->topic_id = jobj_int(a, "topic_id", 0);
        snprintf(r->topic_title, MAX_TITLE, "%s", jobj_str(a, "topic_title", "Topic"));
        r->score = jobj_num(a, "score", 0.0);
        r->mastery_after = jobj_num(a, "mastery_after", 0.0);
        r->timestamp = (long long)jobj_num(a, "timestamp", 0.0);
        (*n_recs)++;
    }
}

int main(void) {
    char *input = read_all_stdin();
    if (!input) {
        printf("{\"error\":\"Failed to read stdin\"}\n");
        return 1;
    }

    JVal *req = json_parse(input);
    free(input);
    if (!req || req->type != J_OBJ) {
        json_free(req);
        printf("{\"error\":\"Invalid JSON request\"}\n");
        return 1;
    }

    const char *cmd = jobj_str(req, "command", "analyze_all");

    Topic topics[MAX_TOPICS];
    int n_topics = 0;
    parse_topics(req, topics, &n_topics);

    PrereqEdge edges[MAX_EDGES];
    int n_edges = 0;
    parse_edges(req, edges, &n_edges);

    AssessmentRecord recs[MAX_ASSESSMENTS];
    int n_recs = 0;
    parse_assessments(req, recs, &n_recs);

    bool unlocked[MAX_TOPICS];
    int topo_order[MAX_TOPICS];
    int topo_len = 0;
    memset(unlocked, 0, sizeof(unlocked));

    StrBuf out;
    sb_init(&out);

    if (strcmp(cmd, "validate_dag") == 0) {
        int from_id = jobj_int(req, "from_id", -1);
        int to_id = jobj_int(req, "to_id", -1);
        bool cycle = dag_would_cycle(topics, n_topics, edges, n_edges, from_id, to_id);
        sb_appendf(&out, "{\"valid\":%s,\"would_cycle\":%s}",
                   cycle ? "false" : "true", cycle ? "true" : "false");
    } else if (strcmp(cmd, "dag_traverse") == 0) {
        int bfs_start = jobj_int(req, "bfs_start_id", -1);
        sb_append(&out, "{\"dag\":");
        run_dag_analysis(topics, n_topics, edges, n_edges, bfs_start, unlocked, topo_order, &topo_len, &out);
        sb_append(&out, "}");
    } else if (strcmp(cmd, "avl_operate") == 0) {
        JVal *params = jobj_get(req, "params");
        sb_append(&out, "{\"avl\":");
        run_avl_scheduler(topics, n_topics, edges, n_edges, params, &out);
        sb_append(&out, "}");
    } else if (strcmp(cmd, "bst_operate") == 0) {
        JVal *params = jobj_get(req, "params");
        sb_append(&out, "{\"bst\":");
        run_bst_history(recs, n_recs, params, &out);
        sb_append(&out, "}");
    } else if (strcmp(cmd, "heap_operate") == 0) {
        JVal *params = jobj_get(req, "params");
        sb_append(&out, "{\"heap\":");
        run_max_heap(topics, n_topics, edges, n_edges, params, &out);
        sb_append(&out, "}");
    } else if (strcmp(cmd, "dijkstra_path") == 0) {
        int start_id = jobj_int(req, "start_id", -1);
        int target_id = jobj_int(req, "target_id", -1);
        bool respect = jobj_bool(req, "respect_prereqs", true);
        sb_append(&out, "{\"dijkstra\":");
        run_dijkstra_path(topics, n_topics, edges, n_edges, start_id, target_id, respect, &out);
        sb_append(&out, "}");
    } else if (strcmp(cmd, "linkedlist_operate") == 0) {
        StrBuf dag_discard;
        sb_init(&dag_discard);
        run_dag_analysis(topics, n_topics, edges, n_edges, -1, unlocked, topo_order, &topo_len, &dag_discard);
        sb_free(&dag_discard);
        for (int i = 0; i < n_topics; i++) topics[i].unlocked = unlocked[i];

        int current_id = jobj_int(req, "current_id", -1);
        const char *action = jobj_str(req, "action", "sync");
        int target_id = jobj_int(req, "target_id", -1);
        const char *new_status = jobj_str(req, "new_status", "");
        double new_mastery = jobj_num(req, "new_mastery", -1.0);
        sb_append(&out, "{\"linked_list\":");
        run_linked_list(topics, n_topics, topo_order, topo_len, current_id, action, target_id, new_status, new_mastery, &out);
        sb_append(&out, "}");
    } else {
        /* Default: "analyze_all" */
        int bfs_start = jobj_int(req, "bfs_start_id", -1);
        int dijk_start = jobj_int(req, "dijkstra_start_id", -1);
        int dijk_target = jobj_int(req, "dijkstra_target_id", -1);

        sb_append(&out, "{");
        sb_append(&out, "\"dag\":");
        run_dag_analysis(topics, n_topics, edges, n_edges, bfs_start, unlocked, topo_order, &topo_len, &out);
        for (int i = 0; i < n_topics; i++) topics[i].unlocked = unlocked[i];

        sb_append(&out, ",\"avl\":");
        run_avl_scheduler(topics, n_topics, edges, n_edges, NULL, &out);

        sb_append(&out, ",\"bst\":");
        run_bst_history(recs, n_recs, NULL, &out);

        sb_append(&out, ",\"heap\":");
        run_max_heap(topics, n_topics, edges, n_edges, NULL, &out);

        sb_append(&out, ",\"dijkstra\":");
        run_dijkstra_path(topics, n_topics, edges, n_edges, dijk_start, dijk_target, true, &out);

        sb_append(&out, ",\"linked_list\":");
        run_linked_list(topics, n_topics, topo_order, topo_len, -1, "sync", -1, "", -1.0, &out);

        /* Compute overall mastery & summary metrics */
        double sum_m = 0.0;
        int completed = 0, unlocked_pending = 0, locked = 0;
        for (int i = 0; i < n_topics; i++) {
            sum_m += topics[i].mastery;
            if (topics[i].mastery >= 70.0) completed++;
            else if (topics[i].unlocked) unlocked_pending++;
            else locked++;
        }
        double overall = n_topics > 0 ? sum_m / n_topics : 0.0;
        sb_appendf(&out, ",\"summary\":{\"overall_mastery\":%.1f,\"total_topics\":%d,"
                   "\"completed_topics\":%d,\"pending_topics\":%d,\"locked_topics\":%d}",
                   overall, n_topics, completed, unlocked_pending, locked);
        sb_append(&out, "}");
    }

    printf("%s\n", out.data);
    sb_free(&out);
    json_free(req);
    return 0;
}
