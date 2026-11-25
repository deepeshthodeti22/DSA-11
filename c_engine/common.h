#ifndef ITS_COMMON_H
#define ITS_COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdbool.h>

#define MAX_TOPICS 128
#define MAX_EDGES 512
#define MAX_ASSESSMENTS 512
#define MAX_TITLE 128
#define MAX_STATUS 32
#define MAX_STEPS 512

typedef struct {
    int id;
    char title[MAX_TITLE];
    char subject[64];
    int difficulty;         /* 1..5 */
    int estimated_minutes;
    double base_weight;
    double mastery;         /* 0.0 .. 100.0 */
    int attempts;
    long long last_assessed_at;
    double pos_x;
    double pos_y;
    bool unlocked;
    char status[MAX_STATUS]; /* "locked", "pending", "in_progress", "completed" */
} Topic;

typedef struct {
    int from_id; /* prerequisite topic id */
    int to_id;   /* dependent topic id */
    double weight;
} PrereqEdge;

typedef struct {
    int id;
    int topic_id;
    char topic_title[MAX_TITLE];
    double score;
    double mastery_after;
    long long timestamp;
} AssessmentRecord;

/* Dynamic string buffer for clean JSON emission */
typedef struct {
    char *data;
    size_t len;
    size_t cap;
} StrBuf;

void sb_init(StrBuf *sb);
void sb_free(StrBuf *sb);
void sb_append(StrBuf *sb, const char *s);
void sb_appendf(StrBuf *sb, const char *fmt, ...);
void sb_append_json_str(StrBuf *sb, const char *s);

/* Minimal recursive-descent JSON DOM */
typedef enum {
    J_NULL,
    J_BOOL,
    J_NUM,
    J_STR,
    J_ARR,
    J_OBJ
} JType;

typedef struct JVal JVal;

typedef struct {
    char *key;
    JVal *val;
} JKV;

struct JVal {
    JType type;
    bool bval;
    double nval;
    char *sval;
    JVal **items;
    int count;
    JKV *pairs;
};

JVal *json_parse(const char *src);
void json_free(JVal *v);
JVal *jobj_get(JVal *obj, const char *key);
const char *jobj_str(JVal *obj, const char *key, const char *def);
double jobj_num(JVal *obj, const char *key, double def);
int jobj_int(JVal *obj, const char *key, int def);
bool jobj_bool(JVal *obj, const char *key, bool def);

/* Helper to find topic index by id */
int find_topic_idx(const Topic *topics, int n, int id);

/* Algorithm module entry points */
void run_dag_analysis(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                      int bfs_start_id, bool *unlocked_out, int *topo_order_out, int *topo_len_out,
                      StrBuf *out_json);

bool dag_would_cycle(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                     int new_from, int new_to);

void run_avl_scheduler(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                       JVal *op_req, StrBuf *out_json);

void run_bst_history(const AssessmentRecord *records, int n_records,
                     JVal *op_req, StrBuf *out_json);

void run_max_heap(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                  JVal *op_req, StrBuf *out_json);

void run_dijkstra_path(const Topic *topics, int n_topics, const PrereqEdge *edges, int n_edges,
                       int start_id, int target_id, bool respect_prereqs, StrBuf *out_json);

void run_linked_list(const Topic *topics, int n_topics, const int *topo_order, int topo_len,
                     int current_id, const char *action, int target_id, const char *new_status,
                     double new_mastery, StrBuf *out_json);

#endif
