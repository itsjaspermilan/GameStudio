#ifndef GS_LUA_SEED_H
#define GS_LUA_SEED_H
/* Separate processes must traverse string-keyed tables in the same order. */
#define luai_makeseed(L) 0x4753u
#endif
