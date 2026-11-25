#include "common.h"
#include <stdarg.h>
#include <ctype.h>

void sb_init(StrBuf *sb) {
    sb->cap = 4096;
    sb->len = 0;
    sb->data = (char *)malloc(sb->cap);
    if (sb->data) sb->data[0] = '\0';
}

void sb_free(StrBuf *sb) {
    free(sb->data);
    sb->data = NULL;
    sb->len = sb->cap = 0;
}

static void sb_ensure(StrBuf *sb, size_t extra) {
    if (sb->len + extra + 1 >= sb->cap) {
        while (sb->len + extra + 1 >= sb->cap) {
            sb->cap *= 2;
        }
        sb->data = (char *)realloc(sb->data, sb->cap);
    }
}

void sb_append(StrBuf *sb, const char *s) {
    if (!s) return;
    size_t slen = strlen(s);
    sb_ensure(sb, slen);
    memcpy(sb->data + sb->len, s, slen);
    sb->len += slen;
    sb->data[sb->len] = '\0';
}

void sb_appendf(StrBuf *sb, const char *fmt, ...) {
    char stack_buf[1024];
    va_list args;
    va_start(args, fmt);
    int needed = vsnprintf(stack_buf, sizeof(stack_buf), fmt, args);
    va_end(args);
    if (needed < 0) return;
    if ((size_t)needed < sizeof(stack_buf)) {
        sb_append(sb, stack_buf);
    } else {
        char *heap_buf = (char *)malloc((size_t)needed + 1);
        va_start(args, fmt);
        vsnprintf(heap_buf, (size_t)needed + 1, fmt, args);
        va_end(args);
        sb_append(sb, heap_buf);
        free(heap_buf);
    }
}

void sb_append_json_str(StrBuf *sb, const char *s) {
    sb_append(sb, "\"");
    if (s) {
        for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
            switch (*p) {
                case '\"': sb_append(sb, "\\\""); break;
                case '\\': sb_append(sb, "\\\\"); break;
                case '\b': sb_append(sb, "\\b"); break;
                case '\f': sb_append(sb, "\\f"); break;
                case '\n': sb_append(sb, "\\n"); break;
                case '\r': sb_append(sb, "\\r"); break;
                case '\t': sb_append(sb, "\\t"); break;
                default:
                    if (*p < 0x20) {
                        sb_appendf(sb, "\\u%04x", *p);
                    } else {
                        char ch[2] = {(char)*p, '\0'};
                        sb_append(sb, ch);
                    }
            }
        }
    }
    sb_append(sb, "\"");
}

/* Recursive descent JSON parser */
typedef struct {
    const char *p;
} JParser;

static void skip_ws(JParser *jp) {
    while (*jp->p && (*jp->p == ' ' || *jp->p == '\t' || *jp->p == '\n' || *jp->p == '\r')) {
        jp->p++;
    }
}

static JVal *parse_val(JParser *jp);

static char *parse_string(JParser *jp) {
    if (*jp->p != '"') return NULL;
    jp->p++;
    StrBuf sb;
    sb_init(&sb);
    while (*jp->p && *jp->p != '"') {
        if (*jp->p == '\\') {
            jp->p++;
            if (!*jp->p) break;
            char c = *jp->p++;
            switch (c) {
                case '"': sb_append(&sb, "\""); break;
                case '\\': sb_append(&sb, "\\"); break;
                case '/': sb_append(&sb, "/"); break;
                case 'b': sb_append(&sb, "\b"); break;
                case 'f': sb_append(&sb, "\f"); break;
                case 'n': sb_append(&sb, "\n"); break;
                case 'r': sb_append(&sb, "\r"); break;
                case 't': sb_append(&sb, "\t"); break;
                case 'u': {
                    unsigned int code = 0;
                    for (int i = 0; i < 4 && isxdigit((unsigned char)jp->p[i]); i++) {
                        char h = jp->p[i];
                        code <<= 4;
                        if (h >= '0' && h <= '9') code |= (unsigned int)(h - '0');
                        else if (h >= 'a' && h <= 'f') code |= (unsigned int)(h - 'a' + 10);
                        else if (h >= 'A' && h <= 'F') code |= (unsigned int)(h - 'A' + 10);
                    }
                    if (strlen(jp->p) >= 4) jp->p += 4;
                    if (code < 0x80) {
                        char ch[2] = {(char)code, '\0'};
                        sb_append(&sb, ch);
                    } else {
                        sb_append(&sb, " ");
                    }
                    break;
                }
                default: {
                    char ch[2] = {c, '\0'};
                    sb_append(&sb, ch);
                }
            }
        } else {
            char ch[2] = {*jp->p++, '\0'};
            sb_append(&sb, ch);
        }
    }
    if (*jp->p == '"') jp->p++;
    return sb.data;
}

static JVal *parse_val(JParser *jp) {
    skip_ws(jp);
    if (!*jp->p) return NULL;

    JVal *v = (JVal *)calloc(1, sizeof(JVal));
    if (*jp->p == '"') {
        v->type = J_STR;
        v->sval = parse_string(jp);
        return v;
    }
    if (*jp->p == '{') {
        v->type = J_OBJ;
        jp->p++;
        skip_ws(jp);
        int cap = 8;
        v->pairs = (JKV *)calloc((size_t)cap, sizeof(JKV));
        v->count = 0;
        if (*jp->p == '}') { jp->p++; return v; }
        while (*jp->p) {
            skip_ws(jp);
            char *k = parse_string(jp);
            if (!k) break;
            skip_ws(jp);
            if (*jp->p == ':') jp->p++;
            JVal *val = parse_val(jp);
            if (v->count >= cap) {
                cap *= 2;
                v->pairs = (JKV *)realloc(v->pairs, (size_t)cap * sizeof(JKV));
            }
            v->pairs[v->count].key = k;
            v->pairs[v->count].val = val;
            v->count++;
            skip_ws(jp);
            if (*jp->p == ',') { jp->p++; continue; }
            if (*jp->p == '}') { jp->p++; break; }
            break;
        }
        return v;
    }
    if (*jp->p == '[') {
        v->type = J_ARR;
        jp->p++;
        skip_ws(jp);
        int cap = 8;
        v->items = (JVal **)calloc((size_t)cap, sizeof(JVal *));
        v->count = 0;
        if (*jp->p == ']') { jp->p++; return v; }
        while (*jp->p) {
            JVal *item = parse_val(jp);
            if (!item) break;
            if (v->count >= cap) {
                cap *= 2;
                v->items = (JVal **)realloc(v->items, (size_t)cap * sizeof(JVal *));
            }
            v->items[v->count++] = item;
            skip_ws(jp);
            if (*jp->p == ',') { jp->p++; continue; }
            if (*jp->p == ']') { jp->p++; break; }
            break;
        }
        return v;
    }
    if (strncmp(jp->p, "true", 4) == 0) {
        v->type = J_BOOL;
        v->bval = true;
        jp->p += 4;
        return v;
    }
    if (strncmp(jp->p, "false", 5) == 0) {
        v->type = J_BOOL;
        v->bval = false;
        jp->p += 5;
        return v;
    }
    if (strncmp(jp->p, "null", 4) == 0) {
        v->type = J_NULL;
        jp->p += 4;
        return v;
    }
    /* Number */
    char *endptr = NULL;
    double num = strtod(jp->p, &endptr);
    if (endptr != jp->p) {
        v->type = J_NUM;
        v->nval = num;
        jp->p = endptr;
        return v;
    }
    free(v);
    return NULL;
}

JVal *json_parse(const char *src) {
    if (!src) return NULL;
    JParser jp = {src};
    return parse_val(&jp);
}

void json_free(JVal *v) {
    if (!v) return;
    if (v->type == J_STR) {
        free(v->sval);
    } else if (v->type == J_ARR) {
        for (int i = 0; i < v->count; i++) json_free(v->items[i]);
        free(v->items);
    } else if (v->type == J_OBJ) {
        for (int i = 0; i < v->count; i++) {
            free(v->pairs[i].key);
            json_free(v->pairs[i].val);
        }
        free(v->pairs);
    }
    free(v);
}

JVal *jobj_get(JVal *obj, const char *key) {
    if (!obj || obj->type != J_OBJ) return NULL;
    for (int i = 0; i < obj->count; i++) {
        if (strcmp(obj->pairs[i].key, key) == 0) return obj->pairs[i].val;
    }
    return NULL;
}

const char *jobj_str(JVal *obj, const char *key, const char *def) {
    JVal *v = jobj_get(obj, key);
    if (v && v->type == J_STR && v->sval) return v->sval;
    return def;
}

double jobj_num(JVal *obj, const char *key, double def) {
    JVal *v = jobj_get(obj, key);
    if (v && v->type == J_NUM) return v->nval;
    return def;
}

int jobj_int(JVal *obj, const char *key, int def) {
    JVal *v = jobj_get(obj, key);
    if (v && v->type == J_NUM) return (int)llround(v->nval);
    return def;
}

bool jobj_bool(JVal *obj, const char *key, bool def) {
    JVal *v = jobj_get(obj, key);
    if (v && v->type == J_BOOL) return v->bval;
    return def;
}

int find_topic_idx(const Topic *topics, int n, int id) {
    for (int i = 0; i < n; i++) {
        if (topics[i].id == id) return i;
    }
    return -1;
}
