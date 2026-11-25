#include "common.h"

typedef struct BSTNode {
    int id;
    int topic_id;
    char topic_title[MAX_TITLE];
    double score;
    double mastery_after;
    long long timestamp;
    struct BSTNode *left;
    struct BSTNode *right;
} BSTNode;

static BSTNode *new_bst_node(const AssessmentRecord *rec) {
    BSTNode *n = (BSTNode *)calloc(1, sizeof(BSTNode));
    n->id = rec->id;
    n->topic_id = rec->topic_id;
    snprintf(n->topic_title, MAX_TITLE, "%s", rec->topic_title);
    n->score = rec->score;
    n->mastery_after = rec->mastery_after;
    n->timestamp = rec->timestamp;
    return n;
}

static BSTNode *bst_insert(BSTNode *root, const AssessmentRecord *rec) {
    if (!root) return new_bst_node(rec);
    if (rec->timestamp < root->timestamp ||
        (rec->timestamp == root->timestamp && rec->id < root->id)) {
        root->left = bst_insert(root->left, rec);
    } else {
        root->right = bst_insert(root->right, rec);
    }
    return root;
}

static void bst_inorder(BSTNode *root, BSTNode **arr, int *n) {
    if (!root) return;
    bst_inorder(root->left, arr, n);
    if (*n < MAX_ASSESSMENTS) arr[(*n)++] = root;
    bst_inorder(root->right, arr, n);
}

static void bst_preorder(BSTNode *root, int *ids, int *n) {
    if (!root) return;
    if (*n < MAX_ASSESSMENTS) ids[(*n)++] = root->id;
    bst_preorder(root->left, ids, n);
    bst_preorder(root->right, ids, n);
}

static void bst_postorder(BSTNode *root, int *ids, int *n) {
    if (!root) return;
    bst_postorder(root->left, ids, n);
    bst_postorder(root->right, ids, n);
    if (*n < MAX_ASSESSMENTS) ids[(*n)++] = root->id;
}

static int bst_height(BSTNode *root) {
    if (!root) return 0;
    int lh = bst_height(root->left);
    int rh = bst_height(root->right);
    return 1 + (lh > rh ? lh : rh);
}

static BSTNode *bst_search_ts(BSTNode *root, long long ts, int *path_ids, int *path_len, BSTNode **nearest) {
    BSTNode *cur = root;
    *path_len = 0;
    long long best_diff = -1;
    *nearest = NULL;
    while (cur) {
        if (*path_len < MAX_ASSESSMENTS) path_ids[(*path_len)++] = cur->id;
        long long diff = cur->timestamp > ts ? (cur->timestamp - ts) : (ts - cur->timestamp);
        if (best_diff < 0 || diff < best_diff) {
            best_diff = diff;
            *nearest = cur;
        }
        if (cur->timestamp == ts) return cur;
        if (ts < cur->timestamp) cur = cur->left;
        else cur = cur->right;
    }
    return NULL;
}

static void bst_range_query(BSTNode *root, long long min_ts, long long max_ts, BSTNode **out, int *n) {
    if (!root) return;
    if (root->timestamp > min_ts) bst_range_query(root->left, min_ts, max_ts, out, n);
    if (root->timestamp >= min_ts && root->timestamp <= max_ts) {
        if (*n < MAX_ASSESSMENTS) out[(*n)++] = root;
    }
    if (root->timestamp < max_ts) bst_range_query(root->right, min_ts, max_ts, out, n);
}

static void emit_bst_tree(BSTNode *n, StrBuf *sb) {
    if (!n) {
        sb_append(sb, "null");
        return;
    }
    sb_append(sb, "{");
    sb_appendf(sb, "\"id\":%d,\"topic_id\":%d,\"topic_title\":", n->id, n->topic_id);
    sb_append_json_str(sb, n->topic_title);
    sb_appendf(sb, ",\"score\":%.1f,\"mastery_after\":%.1f,\"timestamp\":%lld,",
               n->score, n->mastery_after, n->timestamp);
    sb_append(sb, "\"left\":");
    emit_bst_tree(n->left, sb);
    sb_append(sb, ",\"right\":");
    emit_bst_tree(n->right, sb);
    sb_append(sb, "}");
}

static void free_bst(BSTNode *n) {
    if (!n) return;
    free_bst(n->left);
    free_bst(n->right);
    free(n);
}

void run_bst_history(const AssessmentRecord *records, int n_records,
                     JVal *op_req, StrBuf *out_json) {
    BSTNode *root = NULL;
    for (int i = 0; i < n_records; i++) {
        root = bst_insert(root, &records[i]);
    }

    int search_path[MAX_ASSESSMENTS];
    int search_path_len = 0;
    int matched_id = -1;
    char search_summary[256] = "";
    BSTNode *range_matches[MAX_ASSESSMENTS];
    int range_count = 0;

    if (op_req) {
        const char *act = jobj_str(op_req, "action", "");
        if (strcmp(act, "insert") == 0) {
            AssessmentRecord extra;
            memset(&extra, 0, sizeof(extra));
            extra.id = jobj_int(op_req, "id", 9000 + n_records);
            extra.topic_id = jobj_int(op_req, "topic_id", 1);
            snprintf(extra.topic_title, MAX_TITLE, "%s", jobj_str(op_req, "topic_title", "Simulated Assessment"));
            extra.score = jobj_num(op_req, "score", 82.0);
            extra.mastery_after = jobj_num(op_req, "mastery_after", 82.0);
            extra.timestamp = (long long)jobj_num(op_req, "timestamp", 1795600000.0);
            root = bst_insert(root, &extra);
        } else if (strcmp(act, "search") == 0) {
            long long ts = (long long)jobj_num(op_req, "timestamp", 0.0);
            BSTNode *nearest = NULL;
            BSTNode *exact = bst_search_ts(root, ts, search_path, &search_path_len, &nearest);
            if (exact) {
                matched_id = exact->id;
                snprintf(search_summary, sizeof(search_summary),
                         "Exact match: #%d (%s, %.1f%%) in %d BST comparisons",
                         exact->id, exact->topic_title, exact->score, search_path_len);
            } else if (nearest) {
                matched_id = nearest->id;
                snprintf(search_summary, sizeof(search_summary),
                         "Nearest timestamp record: #%d (%s, %.1f%%) in %d comparisons",
                         nearest->id, nearest->topic_title, nearest->score, search_path_len);
            } else {
                snprintf(search_summary, sizeof(search_summary), "Tree is empty");
            }
        } else if (strcmp(act, "range") == 0) {
            long long min_ts = (long long)jobj_num(op_req, "min_timestamp", 0.0);
            long long max_ts = (long long)jobj_num(op_req, "max_timestamp", 9999999999.0);
            bst_range_query(root, min_ts, max_ts, range_matches, &range_count);
            snprintf(search_summary, sizeof(search_summary),
                     "Range query returned %d chronological assessment records", range_count);
        }
    }

    BSTNode *inorder_nodes[MAX_ASSESSMENTS];
    int inorder_len = 0;
    bst_inorder(root, inorder_nodes, &inorder_len);

    int preorder_ids[MAX_ASSESSMENTS];
    int preorder_len = 0;
    bst_preorder(root, preorder_ids, &preorder_len);

    int postorder_ids[MAX_ASSESSMENTS];
    int postorder_len = 0;
    bst_postorder(root, postorder_ids, &postorder_len);

    /* Compute linear regression improvement slope across inorder history */
    double slope = 0.0;
    double avg_score = 0.0;
    if (inorder_len > 0) {
        double sum_x = 0, sum_y = 0, sum_xy = 0, sum_xx = 0;
        for (int i = 0; i < inorder_len; i++) {
            double x = (double)i;
            double y = inorder_nodes[i]->score;
            sum_x += x;
            sum_y += y;
            sum_xy += x * y;
            sum_xx += x * x;
        }
        avg_score = sum_y / inorder_len;
        double denom = inorder_len * sum_xx - sum_x * sum_x;
        if (fabs(denom) > 1e-9) {
            slope = (inorder_len * sum_xy - sum_x * sum_y) / denom;
        }
    }

    sb_append(out_json, "{");
    sb_appendf(out_json, "\"node_count\":%d,\"tree_height\":%d,\"average_score\":%.1f,\"improvement_slope\":%.2f,",
               inorder_len, bst_height(root), avg_score, slope);
    sb_append(out_json, "\"root\":");
    emit_bst_tree(root, out_json);
    sb_append(out_json, ",");

    sb_append(out_json, "\"inorder\":[");
    for (int i = 0; i < inorder_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "{\"id\":%d,\"topic_id\":%d,\"topic_title\":",
                   inorder_nodes[i]->id, inorder_nodes[i]->topic_id);
        sb_append_json_str(out_json, inorder_nodes[i]->topic_title);
        sb_appendf(out_json, ",\"score\":%.1f,\"mastery_after\":%.1f,\"timestamp\":%lld}",
                   inorder_nodes[i]->score, inorder_nodes[i]->mastery_after, inorder_nodes[i]->timestamp);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"preorder_ids\":[");
    for (int i = 0; i < preorder_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "%d", preorder_ids[i]);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"postorder_ids\":[");
    for (int i = 0; i < postorder_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "%d", postorder_ids[i]);
    }
    sb_append(out_json, "],");

    sb_append(out_json, "\"search_result\":{\"matched_id\":");
    sb_appendf(out_json, "%d,\"summary\":", matched_id);
    sb_append_json_str(out_json, search_summary);
    sb_append(out_json, ",\"visited_ids\":[");
    for (int i = 0; i < search_path_len; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "%d", search_path[i]);
    }
    sb_append(out_json, "],\"range_ids\":[");
    for (int i = 0; i < range_count; i++) {
        if (i > 0) sb_append(out_json, ",");
        sb_appendf(out_json, "%d", range_matches[i]->id);
    }
    sb_append(out_json, "]}");
    sb_append(out_json, "}");

    free_bst(root);
}
