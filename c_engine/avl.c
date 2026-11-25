#include "common.h"

typedef struct AVLNode {
    int topic_id;
    char title[MAX_TITLE];
    double mastery;
    double priority_score; /* Computed urgency/priority key */
    double mastery_gap;
    int height;
    struct AVLNode *left;
    struct AVLNode *right;
} AVLNode;

typedef struct {
    char type[8]; /* "LL", "RR", "LR", "RL" */
    int pivot_topic_id;
    char pivot_title[MAX_TITLE];
    double pivot_key;
    int new_root_topic_id;
    char detail[256];
} RotationEvent;

static RotationEvent g_rotations[MAX_STEPS];
static int g_rot_count = 0;

static int avl_height(AVLNode *n) {
    return n ? n->height : 0;
}

static int max_int(int a, int b) {
    return a > b ? a : b;
}

static int get_balance(AVLNode *n) {
    return n ? avl_height(n->left) - avl_height(n->right) : 0;
}

static void update_height(AVLNode *n) {
    if (n) n->height = 1 + max_int(avl_height(n->left), avl_height(n->right));
}

static AVLNode *new_avl_node(int topic_id, const char *title, double mastery, double priority) {
    AVLNode *n = (AVLNode *)calloc(1, sizeof(AVLNode));
    n->topic_id = topic_id;
    snprintf(n->title, MAX_TITLE, "%s", title ? title : "Topic");
    n->mastery = mastery;
    n->mastery_gap = 100.0 - mastery;
    n->priority_score = priority;
    n->height = 1;
    return n;
}

static int compare_avl(double p1, int id1, double p2, int id2) {
    if (fabs(p1 - p2) > 1e-6) return p1 < p2 ? -1 : 1;
    if (id1 != id2) return id1 < id2 ? -1 : 1;
    return 0;
}

static AVLNode *right_rotate(AVLNode *y) {
    AVLNode *x = y->left;
    AVLNode *T2 = x->right;
    x->right = y;
    y->left = T2;
    update_height(y);
    update_height(x);
    return x;
}

static AVLNode *left_rotate(AVLNode *x) {
    AVLNode *y = x->right;
    AVLNode *T2 = y->left;
    y->left = x;
    x->right = T2;
    update_height(x);
    update_height(y);
    return y;
}

static void log_rotation(const char *type, AVLNode *pivot, AVLNode *new_root, const char *ctx) {
    if (g_rot_count >= MAX_STEPS) return;
    RotationEvent *ev = &g_rotations[g_rot_count++];
    snprintf(ev->type, sizeof(ev->type), "%s", type);
    ev->pivot_topic_id = pivot ? pivot->topic_id : -1;
    snprintf(ev->pivot_title, MAX_TITLE, "%s", pivot ? pivot->title : "");
    ev->pivot_key = pivot ? pivot->priority_score : 0.0;
    ev->new_root_topic_id = new_root ? new_root->topic_id : -1;
    snprintf(ev->detail, sizeof(ev->detail),
             "%s rotation at #%d (%.48s, key=%.1f) -> new root #%d (%.48s)",
             type, pivot ? pivot->topic_id : -1, pivot ? pivot->title : "",
             pivot ? pivot->priority_score : 0.0,
             new_root ? new_root->topic_id : -1,
             new_root ? new_root->title : (ctx ? ctx : ""));
}

static AVLNode *avl_insert(AVLNode *node, int topic_id, const char *title, double mastery, double priority) {
    if (!node) return new_avl_node(topic_id, title, mastery, priority);

    int cmp = compare_avl(priority, topic_id, node->priority_score, node->topic_id);
    if (cmp < 0) {
        node->left = avl_insert(node->left, topic_id, title, mastery, priority);
    } else if (cmp > 0) {
        node->right = avl_insert(node->right, topic_id, title, mastery, priority);
    } else {
        /* Update existing */
        node->mastery = mastery;
        node->mastery_gap = 100.0 - mastery;
        return node;
    }

    update_height(node);
    int balance = get_balance(node);

    /* LL Case */
    if (balance > 1 && compare_avl(priority, topic_id, node->left->priority_score, node->left->topic_id) < 0) {
        AVLNode *nr = right_rotate(node);
        log_rotation("LL", node, nr, "insert");
        return nr;
    }
    /* RR Case */
    if (balance < -1 && compare_avl(priority, topic_id, node->right->priority_score, node->right->topic_id) > 0) {
        AVLNode *nr = left_rotate(node);
        log_rotation("RR", node, nr, "insert");
        return nr;
    }
    /* LR Case */
    if (balance > 1 && compare_avl(priority, topic_id, node->left->priority_score, node->left->topic_id) > 0) {
        node->left = left_rotate(node->left);
        AVLNode *nr = right_rotate(node);
        log_rotation("LR", node, nr, "insert");
        return nr;
    }
    /* RL Case */
    if (balance < -1 && compare_avl(priority, topic_id, node->right->priority_score, node->right->topic_id) < 0) {
        node->right = right_rotate(node->right);
        AVLNode *nr = left_rotate(node);
        log_rotation("RL", node, nr, "insert");
        return nr;
    }

    return node;
}

static AVLNode *min_value_node(AVLNode *node) {
    AVLNode *cur = node;
    while (cur && cur->left) cur = cur->left;
    return cur;
}

static AVLNode *avl_delete_by_key(AVLNode *root, double priority, int topic_id, bool *deleted) {
    if (!root) return NULL;
    int cmp = compare_avl(priority, topic_id, root->priority_score, root->topic_id);
    if (cmp < 0) {
        root->left = avl_delete_by_key(root->left, priority, topic_id, deleted);
    } else if (cmp > 0) {
        root->right = avl_delete_by_key(root->right, priority, topic_id, deleted);
    } else {
        *deleted = true;
        if (!root->left || !root->right) {
            AVLNode *temp = root->left ? root->left : root->right;
            if (!temp) {
                free(root);
                return NULL;
            } else {
                AVLNode copy = *temp;
                free(temp);
                *root = copy;
            }
        } else {
            AVLNode *temp = min_value_node(root->right);
            root->topic_id = temp->topic_id;
            snprintf(root->title, MAX_TITLE, "%s", temp->title);
            root->mastery = temp->mastery;
            root->mastery_gap = temp->mastery_gap;
            root->priority_score = temp->priority_score;
            root->right = avl_delete_by_key(root->right, temp->priority_score, temp->topic_id, deleted);
        }
    }

    update_height(root);
    int balance = get_balance(root);

    if (balance > 1 && get_balance(root->left) >= 0) {
        AVLNode *nr = right_rotate(root);
        log_rotation("LL", root, nr, "delete");
        return nr;
    }
    if (balance > 1 && get_balance(root->left) < 0) {
        root->left = left_rotate(root->left);
        AVLNode *nr = right_rotate(root);
        log_rotation("LR", root, nr, "delete");
        return nr;
    }
    if (balance < -1 && get_balance(root->right) <= 0) {
        AVLNode *nr = left_rotate(root);
        log_rotation("RR", root, nr, "delete");
        return nr;
    }
    if (balance < -1 && get_balance(root->right) > 0) {
        root->right = right_rotate(root->right);
        AVLNode *nr = left_rotate(root);
        log_rotation("RL", root, nr, "delete");
        return nr;
    }
    return root;
}

static AVLNode *avl_find_by_topic(AVLNode *root, int topic_id) {
    if (!root) return NULL;
    if (root->topic_id == topic_id) return root;
    AVLNode *l = avl_find_by_topic(root->left, topic_id);
    if (l) return l;
    return avl_find_by_topic(root->right, topic_id);
}

static AVLNode *avl_search_key(AVLNode *root, double key, int *steps_out, int *path_ids, int *path_len) {
    AVLNode *cur = root;
    *steps_out = 0;
    *path_len = 0;
    while (cur) {
        (*steps_out)++;
        if (*path_len < MAX_TOPICS) path_ids[(*path_len)++] = cur->topic_id;
        if (fabs(cur->priority_score - key) <= 0.5) return cur;
        if (key < cur->priority_score) cur = cur->left;
        else cur = cur->right;
    }
    return NULL;
}

/* Reverse in-order (highest priority first) for adaptive schedule */
static void collect_desc_schedule(AVLNode *root, AVLNode **arr, int *n) {
    if (!root) return;
    collect_desc_schedule(root->right, arr, n);
    if (*n < MAX_TOPICS) arr[(*n)++] = root;
    collect_desc_schedule(root->left, arr, n);
}

static void emit_avl_tree_json(AVLNode *n, StrBuf *sb) {
    if (!n) {
        sb_append(sb, "null");
        return;
    }
    sb_append(sb, "{");
    sb_appendf(sb, "\"topic_id\":%d,\"title\":", n->topic_id);
    sb_append_json_str(sb, n->title);
    sb_appendf(sb, ",\"priority_score\":%.1f,\"mastery\":%.1f,\"mastery_gap\":%.1f,\"height\":%d,\"balance_factor\":%d,",
               n->priority_score, n->mastery, n->mastery_gap, n->height, get_balance(n));
    sb_append(sb, "\"left\":");
    emit_avl_tree_json(n->left, sb);
    sb_append(sb, ",\"right\":");
    emit_avl_tree_json(n->right, sb);
    sb_append(sb, "}");
}

static void free_avl(AVLNode *n) {
    if (!n) return;
    free_avl(n->left);
    free_avl(n->right);
    free(n);
}

static double compute_topic_priority(const Topic *t, const Topic *topics, int n_topics,
                                     const PrereqEdge *edges, int n_edges) {
    /* Check if unlocked */
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
    /* Count dependents unlocked by this topic */
    int dependents = 0;
    for (int e = 0; e < n_edges; e++) {
        if (edges[e].from_id == t->id) dependents++;
    }

    double gap = 100.0 - t->mastery;
    double raw = gap * (0.65 + 0.15 * t->difficulty) + dependents * 6.5;
    if (!unlocked) raw *= 0.25; /* Locked topics are deferred in schedule priority */
    if (t->mastery >= 70.0) raw *= 0.45; /* Mastered topics drop to maintenance review priority */
    return round(raw * 10.0) / 10.0;
}

void run_avl_scheduler(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                       JVal *op_req, StrBuf *out_json) {
    g_rot_count = 0;
    AVLNode *root = NULL;

    for (int i = 0; i < n_topics; i++) {
        double prio = compute_topic_priority(&topics[i], topics, n_topics, edges, n_edges);
        root = avl_insert(root, topics[i].id, topics[i].title, topics[i].mastery, prio);
    }

    /* Optional interactive operations passed via JSON (insert/delete/search) */
    char search_info[256] = "";
    int search_path[MAX_TOPICS];
    int search_path_len = 0;
    int search_found_id = -1;

    if (op_req) {
        JVal *ops = jobj_get(op_req, "operations");
        if (ops && ops->type == J_ARR) {
            for (int i = 0; i < ops->count; i++) {
                JVal *op = ops->items[i];
                const char *act = jobj_str(op, "action", "");
                if (strcmp(act, "insert") == 0) {
                    int tid = jobj_int(op, "topic_id", 900 + i);
                    const char *ttl = jobj_str(op, "title", "Custom Priority Node");
                    double m = jobj_num(op, "mastery", 40.0);
                    double p = jobj_num(op, "priority_score", 75.0);
                    root = avl_insert(root, tid, ttl, m, p);
                } else if (strcmp(act, "delete") == 0) {
                    int tid = jobj_int(op, "topic_id", -1);
                    AVLNode *target = avl_find_by_topic(root, tid);
                    if (target) {
                        bool del = false;
                        root = avl_delete_by_key(root, target->priority_score, target->topic_id, &del);
                    }
                } else if (strcmp(act, "search") == 0) {
                    double key = jobj_num(op, "priority_score", 50.0);
                    int steps = 0;
                    AVLNode *found = avl_search_key(root, key, &steps, search_path, &search_path_len);
                    if (found) {
                        search_found_id = found->topic_id;
                        snprintf(search_info, sizeof(search_info),
                                 "Found #%d (%s) at priority %.1f in %d comparisons",
                                 found->topic_id, found->title, found->priority_score, steps);
                    } else {
                        snprintf(search_info, sizeof(search_info),
                                 "No node within +/-0.5 of %.1f after %d comparisons",
                                 key, steps);
                    }
                }
            }
        }
    }

    AVLNode *schedule[MAX_TOPICS];
    int sched_len = 0;
    collect_desc_schedule(root, schedule, &sched_len);

    sb_append(out_json, "{");
    sb_appendf(out_json, "\"tree_height\":%d,\"node_count\":%d,\"rotation_count\":%d,",
               avl_height(root), sched_len, g_rot_count);

    sb_append(out_json, "\"root\":");
    emit_avl_tree_json(root, out_json);
    sb_append(out_json, ",");

    sb_append(out_json, "\"rotations\":[");
    for (int i = 0; i < g_rot_count; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_append(out_json, "{\"type\":");
        sb_append_json_str(out_json, g_rotations[i].type);
        sb_appendf(out_json, ",\"pivot_topic_id\":%d,\"pivot_title\":", g_rotations[i].pivot_topic_id);
        sb_append_json_str(out_json, g_rotations[i].pivot_title);
        sb_appendf(out_json, ",\"pivot_key\":%.1f,\"new_root_topic_id\":%d,\"detail\":",
                   g_rotations[i].pivot_key, g_rotations[i].new_root_topic_id);
        sb_append_json_str(out_json, g_rotations[i].detail);
        sb_append(out_json, "}");
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"schedule\":[");
    for (int i = 0; i < sched_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "{\"rank\":%d,\"topic_id\":%d,\"title\":",
                   i + 1, schedule[i]->topic_id);
        sb_append_json_str(out_json, schedule[i]->title);
        sb_appendf(out_json, ",\"priority_score\":%.1f,\"mastery\":%.1f,\"mastery_gap\":%.1f}",
                   schedule[i]->priority_score, schedule[i]->mastery, schedule[i]->mastery_gap);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"search_result\":{\"found_topic_id\":");
    sb_appendf(out_json, "%d,\"summary\":", search_found_id);
    sb_append_json_str(out_json, search_info);
    sb_append(out_json, ",\"visited_ids\":[");
    for (int i = 0; i < search_path_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "%d", search_path[i]);
    }
    sb_append(out_json, "]}");
    sb_append(out_json, "}");

    free_avl(root);
}
