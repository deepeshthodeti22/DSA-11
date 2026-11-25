#include "common.h"

typedef struct {
    int topic_id;
    char title[MAX_TITLE];
    double mastery;
    double urgency;
    bool unlocked;
} HeapItem;

typedef struct {
    char op[32]; /* "heapify", "sift_up", "sift_down", "extract_max", "insert" */
    int idx_a;
    int idx_b;
    char detail[256];
    HeapItem snapshot[MAX_TOPICS];
    int size;
} HeapStep;

static HeapStep g_hsteps[MAX_STEPS];
static int g_hstep_count = 0;

static void record_heap_step(const char *op, int a, int b, const char *detail,
                             const HeapItem *arr, int n) {
    if (g_hstep_count >= MAX_STEPS) return;
    HeapStep *st = &g_hsteps[g_hstep_count++];
    snprintf(st->op, sizeof(st->op), "%s", op);
    st->idx_a = a;
    st->idx_b = b;
    snprintf(st->detail, sizeof(st->detail), "%s", detail);
    st->size = n;
    for (int i = 0; i < n; i++) st->snapshot[i] = arr[i];
}

static void swap_items(HeapItem *a, HeapItem *b) {
    HeapItem tmp = *a;
    *a = *b;
    *b = tmp;
}

static void sift_down(HeapItem *arr, int n, int idx, bool trace) {
    int cur = idx;
    while (1) {
        int left = 2 * cur + 1;
        int right = 2 * cur + 2;
        int largest = cur;
        if (left < n && arr[left].urgency > arr[largest].urgency) largest = left;
        if (right < n && arr[right].urgency > arr[largest].urgency) largest = right;
        if (largest != cur) {
            char msg[256];
            snprintf(msg, sizeof(msg), "Swap [%d] %.40s (%.1f) <-> [%d] %.40s (%.1f)",
                     cur, arr[cur].title, arr[cur].urgency,
                     largest, arr[largest].title, arr[largest].urgency);
            swap_items(&arr[cur], &arr[largest]);
            if (trace) record_heap_step("sift_down", cur, largest, msg, arr, n);
            cur = largest;
        } else {
            break;
        }
    }
}

static void sift_up(HeapItem *arr, int n, int idx, bool trace) {
    int cur = idx;
    while (cur > 0) {
        int parent = (cur - 1) / 2;
        if (arr[cur].urgency > arr[parent].urgency) {
            char msg[256];
            snprintf(msg, sizeof(msg), "Sift-up swap [%d] %.40s (%.1f) <-> [%d] %.40s (%.1f)",
                     cur, arr[cur].title, arr[cur].urgency,
                     parent, arr[parent].title, arr[parent].urgency);
            swap_items(&arr[cur], &arr[parent]);
            if (trace) record_heap_step("sift_up", cur, parent, msg, arr, n);
            cur = parent;
        } else {
            break;
        }
    }
}

static double calc_urgency(const Topic *t, const Topic *topics, int n_topics,
                           const PrereqEdge *edges, int n_edges) {
    bool unlocked = true;
    for (int e = 0; e < n_edges; e++) {
        if (edges[e].to_id == t->id) {
            int p_idx = find_topic_idx(topics, n_topics, edges[e].from_id);
            if (p_idx >= 0 && topics[p_idx].mastery < 70.0) {
                unlocked = false;
                break;
            }
        }
    }
    int out_unlocks = 0;
    for (int e = 0; e < n_edges; e++) {
        if (edges[e].from_id == t->id) out_unlocks++;
    }
    double gap = 100.0 - t->mastery;
    double score = gap * (0.7 + 0.1 * t->difficulty) + out_unlocks * 8.0;
    if (t->attempts > 0 && t->mastery < 70.0) score += 12.0; /* In-progress weak topic boost */
    if (!unlocked) score *= 0.2;
    if (t->mastery >= 70.0) score *= 0.35;
    return round(score * 10.0) / 10.0;
}

static void emit_heap_items_json(const HeapItem *arr, int n, StrBuf *sb) {
    sb_append(sb, "[");
    for (int i = 0; i < n; i++) {
        if (i > 0) sb_append(sb, ",");
        sb_appendf(sb, "{\"index\":%d,\"topic_id\":%d,\"title\":", i, arr[i].topic_id);
        sb_append_json_str(sb, arr[i].title);
        sb_appendf(sb, ",\"mastery\":%.1f,\"urgency\":%.1f,\"unlocked\":%s}",
                   arr[i].mastery, arr[i].urgency, arr[i].unlocked ? "true" : "false");
    }
    sb_append(sb, "]");
}

void run_max_heap(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                  JVal *op_req, StrBuf *out_json) {
    g_hstep_count = 0;
    HeapItem heap[MAX_TOPICS];
    memset(heap, 0, sizeof(heap));
    int n = 0;

    for (int i = 0; i < n_topics; i++) {
        bool unlocked = true;
        for (int e = 0; e < n_edges; e++) {
            if (edges[e].to_id == topics[i].id) {
                int p = find_topic_idx(topics, n_topics, edges[e].from_id);
                if (p >= 0 && topics[p].mastery < 70.0) { unlocked = false; break; }
            }
        }
        heap[n].topic_id = topics[i].id;
        snprintf(heap[n].title, MAX_TITLE, "%s", topics[i].title);
        heap[n].mastery = topics[i].mastery;
        heap[n].urgency = calc_urgency(&topics[i], topics, n_topics, edges, n_edges);
        heap[n].unlocked = unlocked;
        n++;
    }

    /* Record initial unsorted array before Floyd's build_heap */
    bool trace_build = (op_req != NULL);
    if (trace_build) {
        record_heap_step("initial", -1, -1, "Loaded topics into contiguous array before bottom-up heapify", heap, n);
    }

    /* Floyd's bottom-up O(N) heapify */
    for (int i = n / 2 - 1; i >= 0; i--) {
        sift_down(heap, n, i, trace_build);
    }
    if (trace_build) {
        record_heap_step("heapify_complete", 0, -1, "Max-Heap invariant satisfied across all parent-child pairs", heap, n);
    }

    HeapItem extracted[MAX_TOPICS];
    int ext_count = 0;

    if (op_req) {
        JVal *ops = jobj_get(op_req, "operations");
        if (ops && ops->type == J_ARR) {
            for (int i = 0; i < ops->count; i++) {
                JVal *op = ops->items[i];
                const char *act = jobj_str(op, "action", "");
                if (strcmp(act, "insert") == 0 && n < MAX_TOPICS) {
                    int tid = jobj_int(op, "topic_id", 950 + i);
                    const char *ttl = jobj_str(op, "title", "Urgent Review Item");
                    double urg = jobj_num(op, "urgency", 95.0);
                    double mast = jobj_num(op, "mastery", 25.0);
                    heap[n].topic_id = tid;
                    snprintf(heap[n].title, MAX_TITLE, "%s", ttl);
                    heap[n].urgency = urg;
                    heap[n].mastery = mast;
                    heap[n].unlocked = true;
                    n++;
                    char msg[256];
                    snprintf(msg, sizeof(msg), "Inserted %s (urgency %.1f) at tail index %d", ttl, urg, n - 1);
                    record_heap_step("insert", n - 1, -1, msg, heap, n);
                    sift_up(heap, n, n - 1, true);
                } else if (strcmp(act, "extract_max") == 0 && n > 0) {
                    HeapItem top = heap[0];
                    extracted[ext_count++] = top;
                    heap[0] = heap[n - 1];
                    n--;
                    char msg[256];
                    snprintf(msg, sizeof(msg), "Extracted max root: %s (urgency %.1f); moved tail to index 0",
                             top.title, top.urgency);
                    record_heap_step("extract_max", 0, n, msg, heap, n);
                    if (n > 0) sift_down(heap, n, 0, true);
                } else if (strcmp(act, "update") == 0) {
                    int tid = jobj_int(op, "topic_id", -1);
                    double new_urg = jobj_num(op, "urgency", 80.0);
                    for (int k = 0; k < n; k++) {
                        if (heap[k].topic_id == tid) {
                            double old_u = heap[k].urgency;
                            heap[k].urgency = new_urg;
                            char msg[256];
                            snprintf(msg, sizeof(msg), "Updated %s urgency %.1f -> %.1f", heap[k].title, old_u, new_urg);
                            record_heap_step("update", k, -1, msg, heap, n);
                            if (new_urg > old_u) sift_up(heap, n, k, true);
                            else sift_down(heap, n, k, true);
                            break;
                        }
                    }
                }
            }
        }
    }

    sb_append(out_json, "{");
    sb_appendf(out_json, "\"size\":%d,", n);
    sb_append(out_json, "\"heap_array\":");
    emit_heap_items_json(heap, n, out_json);
    sb_append(out_json, ",\"extracted\":");
    emit_heap_items_json(extracted, ext_count, out_json);
    sb_append(out_json, ",\"steps\":[");
    for (int i = 0; i < g_hstep_count; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_append(out_json, "{\"op\":");
        sb_append_json_str(out_json, g_hsteps[i].op);
        sb_appendf(out_json, ",\"idx_a\":%d,\"idx_b\":%d,\"detail\":",
                   g_hsteps[i].idx_a, g_hsteps[i].idx_b);
        sb_append_json_str(out_json, g_hsteps[i].detail);
        sb_append(out_json, ",\"snapshot\":");
        emit_heap_items_json(g_hsteps[i].snapshot, g_hsteps[i].size, out_json);
        sb_append(out_json, "}");
    }
    sb_append(out_json, "]}");
}
