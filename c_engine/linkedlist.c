#include "common.h"

typedef struct LLNode {
    int topic_id;
    char title[MAX_TITLE];
    double mastery;
    char status[MAX_STATUS];
    int position;
    struct LLNode *prev;
    struct LLNode *next;
} LLNode;

static LLNode *ll_append(LLNode **head, LLNode **tail, const Topic *t, int pos) {
    LLNode *node = (LLNode *)calloc(1, sizeof(LLNode));
    node->topic_id = t->id;
    snprintf(node->title, MAX_TITLE, "%s", t->title);
    node->mastery = t->mastery;
    if (t->mastery >= 70.0) snprintf(node->status, MAX_STATUS, "completed");
    else if (t->unlocked && t->attempts > 0) snprintf(node->status, MAX_STATUS, "in_progress");
    else if (t->unlocked) snprintf(node->status, MAX_STATUS, "pending");
    else snprintf(node->status, MAX_STATUS, "locked");
    node->position = pos;
    if (!*head) {
        *head = *tail = node;
    } else {
        (*tail)->next = node;
        node->prev = *tail;
        *tail = node;
    }
    return node;
}

static void ll_free(LLNode *head) {
    while (head) {
        LLNode *nxt = head->next;
        free(head);
        head = nxt;
    }
}

void run_linked_list(const Topic *topics, int n_topics, const int *topo_order, int topo_len,
                     int current_id, const char *action, int target_id, const char *new_status,
                     double new_mastery, StrBuf *out_json) {
    LLNode *head = NULL, *tail = NULL;
    int pos = 0;

    if (topo_len > 0) {
        for (int i = 0; i < topo_len; i++) {
            int idx = find_topic_idx(topics, n_topics, topo_order[i]);
            if (idx >= 0) ll_append(&head, &tail, &topics[idx], pos++);
        }
    } else {
        for (int i = 0; i < n_topics; i++) {
            ll_append(&head, &tail, &topics[i], pos++);
        }
    }

    /* Locate cursor node */
    LLNode *cursor = head;
    if (current_id > 0) {
        for (LLNode *p = head; p; p = p->next) {
            if (p->topic_id == current_id) { cursor = p; break; }
        }
    } else {
        /* Default cursor: first unlocked non-completed node */
        for (LLNode *p = head; p; p = p->next) {
            if (strcmp(p->status, "completed") != 0 && strcmp(p->status, "locked") != 0) {
                cursor = p;
                break;
            }
        }
    }

    char op_msg[256] = "Synchronized doubly-linked mastery chain in topological sequence";
    if (action && cursor) {
        if (strcmp(action, "next") == 0 && cursor->next) {
            cursor = cursor->next;
            snprintf(op_msg, sizeof(op_msg), "Traversed cursor->next to #%d (%s)",
                     cursor->topic_id, cursor->title);
        } else if (strcmp(action, "prev") == 0 && cursor->prev) {
            cursor = cursor->prev;
            snprintf(op_msg, sizeof(op_msg), "Traversed cursor->prev to #%d (%s)",
                     cursor->topic_id, cursor->title);
        } else if (strcmp(action, "goto") == 0 && target_id > 0) {
            for (LLNode *p = head; p; p = p->next) {
                if (p->topic_id == target_id) {
                    cursor = p;
                    snprintf(op_msg, sizeof(op_msg), "Moved cursor to #%d (%s)",
                             cursor->topic_id, cursor->title);
                    break;
                }
            }
        } else if (strcmp(action, "update") == 0 && target_id > 0) {
            for (LLNode *p = head; p; p = p->next) {
                if (p->topic_id == target_id) {
                    if (new_status && strlen(new_status) > 0) snprintf(p->status, MAX_STATUS, "%s", new_status);
                    if (new_mastery >= 0.0) p->mastery = new_mastery;
                    cursor = p;
                    snprintf(op_msg, sizeof(op_msg), "Updated node #%d (%s): status=%s, mastery=%.1f%%",
                             p->topic_id, p->title, p->status, p->mastery);
                    break;
                }
            }
        }
    }

    int completed = 0, pending = 0, locked = 0;
    for (LLNode *p = head; p; p = p->next) {
        if (strcmp(p->status, "completed") == 0) completed++;
        else if (strcmp(p->status, "locked") == 0) locked++;
        else pending++;
    }

    sb_append(out_json, "{");
    sb_appendf(out_json, "\"length\":%d,\"head_id\":%d,\"tail_id\":%d,\"current_id\":%d,",
               pos, head ? head->topic_id : -1, tail ? tail->topic_id : -1,
               cursor ? cursor->topic_id : -1);
    sb_appendf(out_json, "\"completed_count\":%d,\"pending_count\":%d,\"locked_count\":%d,",
               completed, pending, locked);
    sb_append(out_json, "\"operation_summary\":");
    sb_append_json_str(out_json, op_msg);
    sb_append(out_json, ",\"nodes\":[");
    int first = 1;
    for (LLNode *p = head; p; p = p->next) {
        if (!first) sb_append(out_json, ",");
        first = 0;
        sb_appendf(out_json, "{\"position\":%d,\"topic_id\":%d,\"title\":", p->position, p->topic_id);
        sb_append_json_str(out_json, p->title);
        sb_appendf(out_json, ",\"mastery\":%.1f,\"status\":", p->mastery);
        sb_append_json_str(out_json, p->status);
        sb_appendf(out_json, ",\"prev_id\":%d,\"next_id\":%d,\"is_current\":%s}",
                   p->prev ? p->prev->topic_id : -1,
                   p->next ? p->next->topic_id : -1,
                   (cursor && cursor->topic_id == p->topic_id) ? "true" : "false");
    }
    sb_append(out_json, "]}");

    ll_free(head);
}
