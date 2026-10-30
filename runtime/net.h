#ifndef GS_NET_H
#define GS_NET_H
#include <stdbool.h>
#include <lua.h>
int luaopen_gs_transport(lua_State *L);
bool gs_net_active(void);
void gs_net_close(void);
#endif
