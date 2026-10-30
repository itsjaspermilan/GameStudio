/* One nonblocking UDP socket per runtime. Session rules live in the framework, not the transport. */
#include "net.h"
#include <lauxlib.h>
#include <stdio.h>
#include <string.h>
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
typedef SOCKET NetSocket;
#define NET_NONE INVALID_SOCKET
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
typedef int NetSocket;
#define NET_NONE (-1)
#endif

#define NET_PACKET 1200
static NetSocket sock = NET_NONE;
#ifdef _WIN32
static bool wsa_started;
#endif

bool gs_net_active(void) { return sock != NET_NONE; }
void gs_net_close(void) {
    if (sock != NET_NONE) {
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        sock = NET_NONE;
    }
#ifdef _WIN32
    if (wsa_started) { WSACleanup(); wsa_started = false; }
#endif
}

static bool would_block(void) {
#ifdef _WIN32
    return WSAGetLastError() == WSAEWOULDBLOCK;
#else
    return errno == EAGAIN || errno == EWOULDBLOCK;
#endif
}

static int failed(lua_State *L, const char *what) {
#ifdef _WIN32
    const int code = WSAGetLastError();
    return luaL_error(L, "Wi-Fi: %s (socket error %d)", what, code);
#else
    return luaL_error(L, "Wi-Fi: %s: %s", what, strerror(errno));
#endif
}
static int close_failed(lua_State *L, const char *what) {
#ifdef _WIN32
    const int code = WSAGetLastError();
    gs_net_close(); WSASetLastError(code);
#else
    const int code = errno;
    gs_net_close(); errno = code;
#endif
    return failed(L, what);
}

static int net_open(lua_State *L) {
    const lua_Integer port = luaL_checkinteger(L, 1);
    luaL_argcheck(L, port >= 0 && port <= 65535, 1, "port is 0 to 65535");
    if (gs_net_active()) return luaL_error(L, "Wi-Fi: leave the current session before opening another");
#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa)) return luaL_error(L, "Wi-Fi: could not start sockets");
    wsa_started = true;
#endif
    sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sock == NET_NONE) return close_failed(L, "could not open a socket");
    int yes = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_BROADCAST, (const char *)&yes, sizeof yes)) {
        return close_failed(L, "could not enable local discovery");
    }
    struct sockaddr_in addr; memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET; addr.sin_addr.s_addr = htonl(INADDR_ANY); addr.sin_port = htons((unsigned short)port);
    if (bind(sock, (struct sockaddr *)&addr, sizeof addr)) return close_failed(L, "could not host on this port");
#ifdef _WIN32
    u_long nonblocking = 1;
    if (ioctlsocket(sock, FIONBIO, &nonblocking)) return close_failed(L, "could not make the socket nonblocking");
#else
    const int flags = fcntl(sock, F_GETFL, 0);
    if (flags < 0 || fcntl(sock, F_SETFL, flags | O_NONBLOCK)) return close_failed(L, "could not make the socket nonblocking");
#endif
    lua_pushboolean(L, true); return 1;
}

static int net_close(lua_State *L) { (void)L; gs_net_close(); return 0; }

static int net_send(lua_State *L) {
    const char *endpoint = luaL_checkstring(L, 1);
    size_t n; const char *data = luaL_checklstring(L, 2, &n);
    luaL_argcheck(L, n > 0 && n <= NET_PACKET, 2, "a packet is 1 to 1200 bytes");
    if (!gs_net_active()) return luaL_error(L, "Wi-Fi: no socket is open");
    char ip[16], extra; unsigned port;
    struct sockaddr_in addr; memset(&addr, 0, sizeof addr); addr.sin_family = AF_INET;
    if (sscanf(endpoint, "%15[0-9.]:%u%c", ip, &port, &extra) != 2 || !port || port > 65535 ||
        inet_pton(AF_INET, ip, &addr.sin_addr) != 1) return luaL_error(L, "Wi-Fi: invalid IPv4 address and port");
    addr.sin_port = htons((unsigned short)port);
    const int sent = (int)sendto(sock, data, (int)n, 0, (struct sockaddr *)&addr, sizeof addr);
    if (sent < 0 && would_block()) { lua_pushboolean(L, false); return 1; }
    if (sent < 0) return failed(L, "could not send a packet; check that Wi-Fi is on");
    if ((size_t)sent != n) return luaL_error(L, "Wi-Fi: an incomplete packet was sent");
    lua_pushboolean(L, true); return 1;
}

static int net_receive(lua_State *L) {
    if (!gs_net_active()) return 0;
    char data[NET_PACKET + 1], ip[16], endpoint[24];
    struct sockaddr_in addr;
#ifdef _WIN32
    int len = sizeof addr;
#else
    socklen_t len = sizeof addr;
#endif
    const int n = (int)recvfrom(sock, data, sizeof data, 0, (struct sockaddr *)&addr, &len);
#ifdef _WIN32
    if (n < 0 && WSAGetLastError() == WSAEMSGSIZE) { lua_pushliteral(L, ""); lua_pushliteral(L, "oversized"); return 2; }
#endif
    if (n < 0 && would_block()) return 0;
    if (n < 0) return failed(L, "could not receive a packet");
    if (n > NET_PACKET) { lua_pushliteral(L, ""); lua_pushliteral(L, "oversized"); return 2; }
    if (!inet_ntop(AF_INET, &addr.sin_addr, ip, sizeof ip)) return failed(L, "could not read a sender's address");
    snprintf(endpoint, sizeof endpoint, "%s:%u", ip, ntohs(addr.sin_port));
    lua_pushlstring(L, data, n); lua_pushstring(L, endpoint); return 2;
}

int luaopen_gs_transport(lua_State *L) {
    const luaL_Reg api[] = { {"open", net_open}, {"close", net_close}, {"send", net_send}, {"receive", net_receive}, {NULL, NULL} };
    luaL_newlib(L, api); return 1;
}
