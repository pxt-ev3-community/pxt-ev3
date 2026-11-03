#include "pxt.h"
#include "ev3const.h"

#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <dirent.h>
#include <stdarg.h>
#include <signal.h>

// ──────────────────────────────────────────────────────────────────────────────
// EV3 Bluetooth brick-to-brick messaging
//
// Protocol reference: LEGO MINDSTORMS EV3 Communication Developer Kit, §3.3.9
//
// WRITEMAILBOX is a **System Command** (NOT a Direct Command):
//   byte[4] = 0x81 (SYSTEM_COMMAND_NO_REPLY)
//   byte[5] = 0x9E (WRITEMAILBOX)
//
// Packet format:
//   [0-1]  message length (LE uint16, excluding these 2 bytes)
//   [2-3]  message counter (LE uint16)
//   [4]    0x81   SYSTEM_COMMAND_NO_REPLY
//   [5]    0x9E   WRITEMAILBOX
//   [6]    mailbox name length (number of chars, EXCLUDING null terminator)
//   [7..]  mailbox name (null-terminated)
//   [N..N+3] payload size (LE uint32)
//   [N+4..]  payload bytes
//
// EV3_AF_BLUETOOTH, EV3_BTPROTO_RFCOMM, VM_BRICK_NAME_SIZE from ev3const.h
// ──────────────────────────────────────────────────────────────────────────────

#define BT_RFCOMM_CHANNEL_1 1
#define BT_RFCOMM_CHANNEL_2 2
#define BT_MAX_CONNECTIONS 7 // BT piconet limit (matches EV3-G)
#define BT_MAX_MAILBOX_NAME 248
#define BT_MAX_MAILBOX_DATA 1024

// EV3 System Command type bytes (Communication Developer Kit §3)
#define SYSTEM_COMMAND_REPLY 0x01
#define SYSTEM_COMMAND_NO_REPLY 0x81
#define SYSTEM_REPLY 0x03
#define SYSTEM_REPLY_ERROR 0x05
#define WRITEMAILBOX 0x9E

// MailboxDataType values — must match enums.d.ts
#define MBOX_TYPE_TEXT 0
#define MBOX_TYPE_NUMERIC 1
#define MBOX_TYPE_LOGIC 2

// sockaddr_rc — mirrors BlueZ struct sockaddr_rc
struct BtBdAddr { 
    uint8_t b[6];
};

struct SockAddrRc {
    sa_family_t rc_family;
    BtBdAddr rc_bdaddr;
    uint8_t rc_channel;
};

// Connection slot
struct BtConnection {
    int fd;
    char brickName[VM_BRICK_NAME_SIZE];
    bool active;
    uint8_t rxBuf[4096];
    int rxLen;
};

#define MAX_MAILBOX_SLOTS 16 // Mailbox receive slot

struct MailboxSlot {
    char name[BT_MAX_MAILBOX_NAME];
    uint8_t dataType; // MBOX_TYPE_*
    uint8_t data[BT_MAX_MAILBOX_DATA]; // last received raw value
    int dataLen;
    int eventSrc; // pxt event source id
    int eventVal; // pxt event value
};

namespace pxt {

static BtConnection btConns[BT_MAX_CONNECTIONS];
static int btConnCount = 0;
static pthread_mutex_t btMutex = PTHREAD_MUTEX_INITIALIZER;
static bool btRxRunning = false;
static bool btServerRunning = false;
static int serverFd1 = -1;
static int serverFd2 = -1;
static pthread_mutex_t btInitMutex = PTHREAD_MUTEX_INITIALIZER;
static bool btInitialized = false;

static pthread_mutex_t btStatusMutex = PTHREAD_MUTEX_INITIALIZER;
static char btLastStatus[256] = "ready";

static MailboxSlot mailboxSlots[MAX_MAILBOX_SLOTS];
static int mailboxSlotCount = 0;

// Forward declarations
static void ensureBtServer();
static void ensureRxThread();
static void initBluetooth();
static bool findNameByAddr(const char *macStr, char nameOut[VM_BRICK_NAME_SIZE]);

static void setBtStatus(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    pthread_mutex_lock(&btStatusMutex);
    vsnprintf(btLastStatus, sizeof(btLastStatus), fmt, args);
    pthread_mutex_unlock(&btStatusMutex);
    va_end(args);
    DMESG("BT STATUS: %s", btLastStatus);
}

//// Helpers

static void packU16LE(uint8_t *dst, uint16_t v) {
    dst[0] = v & 0xFF;
    dst[1] = (v >> 8) & 0xFF;
}

static void packU32LE(uint8_t *dst, uint32_t v) {
    dst[0] = v & 0xFF;
    dst[1] = (v >> 8) & 0xFF;
    dst[2] = (v >> 16) & 0xFF;
    dst[3] = (v >> 24) & 0xFF;
}

static uint16_t unpackU16LE(const uint8_t *src) {
    return (uint16_t)(src[0] | (src[1] << 8));
}

static uint32_t unpackU32LE(const uint8_t *src) {
    return (uint32_t)(src[0] | (src[1] << 8) | (src[2] << 16) | (src[3] << 24));
}

// Send a WRITEMAILBOX System Command packet
static bool sendMailboxPacket(int fd, const char *mailbox, const uint8_t *payload, int payloadLen, uint16_t msgcount) {
    if (fd < 0 || !mailbox) return false;
    uint8_t buf[BT_MAX_MAILBOX_DATA + 64];
    int pos = 0;

    int nameChars = (int)strlen(mailbox); // length EXCLUDING null terminator

    // [0-1] placeholder for message length
    buf[pos++] = 0;
    buf[pos++] = 0;
    // [2-3] message counter
    packU16LE(buf + pos, msgcount); pos += 2;
    // [4] SYSTEM_COMMAND_NO_REPLY
    buf[pos++] = SYSTEM_COMMAND_NO_REPLY;
    // [5] WRITEMAILBOX
    buf[pos++] = WRITEMAILBOX;
    // [6] mailbox name length (EXCLUDING null terminator, per spec)
    buf[pos++] = (uint8_t)nameChars;
    // [7..] mailbox name (null-terminated)
    memcpy(buf + pos, mailbox, nameChars + 1); // copy including null
    pos += nameChars + 1;
    // payload size (LE uint32)
    packU32LE(buf + pos, (uint32_t)payloadLen);
    pos += 4;
    // payload bytes
    if (payloadLen > 0) {
        memcpy(buf + pos, payload, payloadLen);
        pos += payloadLen;
    }

    // fill in message length = pos - 2
    packU16LE(buf, (uint16_t)(pos - 2));

    int totalSent = 0;
    while (totalSent < pos) {
        int sent = send(fd, buf + totalSent, pos - totalSent, MSG_NOSIGNAL);
        if (sent < 0) {
            if (errno == EINTR) continue;
            return false;
        }
        if (sent == 0) return false;
        totalSent += sent;
    }
    return true;
}

// Parse an incoming packet and raise pxt events for matching mailboxes
static void handleIncomingPacket(const uint8_t *pkt, int totalLen) {
    if (totalLen < 8) return;

    uint8_t cmdType = pkt[4];
    uint8_t sysCmd  = pkt[5];

    // Accept both SYSTEM_COMMAND_NO_REPLY and SYSTEM_COMMAND_REPLY
    if (cmdType != SYSTEM_COMMAND_NO_REPLY && cmdType != SYSTEM_COMMAND_REPLY) return;
    if (sysCmd != WRITEMAILBOX) return;

    // [6] = name length (excluding null)
    int nameLen = pkt[6];
    if (nameLen <= 0) return;

    int nameStart = 7;
    int nameEnd = nameStart + nameLen + 1; // +1 for null terminator
    if (nameEnd >= totalLen) return;

    char mailboxName[BT_MAX_MAILBOX_NAME];
    int cn = nameLen < (int)sizeof(mailboxName) - 1 ? nameLen : (int)sizeof(mailboxName) - 1;
    memcpy(mailboxName, pkt + nameStart, cn);
    mailboxName[cn] = 0;

    // payload size (LE uint32)
    int payloadSizeOff = nameEnd;
    if (payloadSizeOff + 4 > totalLen) return;
    uint32_t payloadSize = unpackU32LE(pkt + payloadSizeOff);

    int payloadOff = payloadSizeOff + 4;
    if (payloadOff + (int)payloadSize > totalLen) return;

    const uint8_t *payloadData = pkt + payloadOff;

    setBtStatus("Got: %s (%ub)", mailboxName, payloadSize);
    DMESG("BT: received mailbox '%s' size=%u", mailboxName, payloadSize);

    int eventsToRaise[MAX_MAILBOX_SLOTS];
    int numEvents = 0;

    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < mailboxSlotCount; i++) {
        MailboxSlot &s = mailboxSlots[i];
        if (strcmp(s.name, mailboxName) != 0) continue;

        int safeLen = (int)payloadSize;
        if (safeLen > (int)sizeof(s.data) - 1) {
            safeLen = (int)sizeof(s.data) - 1;
        }
        memcpy(s.data, payloadData, safeLen);
        s.data[safeLen] = 0;
        s.dataLen = safeLen;

        if (numEvents < MAX_MAILBOX_SLOTS) {
            eventsToRaise[numEvents++] = s.eventSrc;
        }
    }
    pthread_mutex_unlock(&btMutex);

    // Raise events outside btMutex to avoid deadlocks when handler accesses Bluetooth
    for (int i = 0; i < numEvents; i++) {
        pxt::raiseEvent(eventsToRaise[i], 0);
    }
}

// Receive thread: watches all active connections with select()
static void *btReceiveThread(void *) {
    DMESG("BT: receive thread starting");
    uint8_t pktBuf[4096];

    while (btRxRunning) {
        fd_set fds;
        FD_ZERO(&fds);
        int maxFd = -1;

        pthread_mutex_lock(&btMutex);
        for (int i = 0; i < btConnCount; i++) {
            if (!btConns[i].active || btConns[i].fd < 0) continue;
            FD_SET(btConns[i].fd, &fds);
            if (btConns[i].fd > maxFd) {
                maxFd = btConns[i].fd;
            }
        }
        pthread_mutex_unlock(&btMutex);

        if (maxFd < 0) { 
            usleep(50000);
            continue;
        }

        struct timeval tv = {0, 100000}; // 100ms
        int selRes = select(maxFd + 1, &fds, NULL, NULL, &tv);
        if (selRes <= 0) continue;

        pthread_mutex_lock(&btMutex);
        for (int i = 0; i < btConnCount; i++) {
            if (!btConns[i].active || btConns[i].fd < 0) continue;
            int fd = btConns[i].fd;
            if (!FD_ISSET(fd, &fds)) continue;

            if ((size_t)btConns[i].rxLen >= sizeof(btConns[i].rxBuf)) {
                DMESG("BT: rxBuf full from '%s', resetting", btConns[i].brickName);
                btConns[i].rxLen = 0;
            }

            int len = read(fd, btConns[i].rxBuf + btConns[i].rxLen, sizeof(btConns[i].rxBuf) - btConns[i].rxLen);
            if (len < 0) {
                if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) {
                    continue; // Normal transient signal or non-blocking condition, do NOT close!
                }
                DMESG("BT: conn %d ('%s') read error errno=%d", i, btConns[i].brickName, errno);
                close(fd);
                btConns[i].fd = -1;
                btConns[i].active = false;
                btConns[i].rxLen = 0;
                continue;
            } else if (len == 0) {
                DMESG("BT: conn %d ('%s') closed by peer", i, btConns[i].brickName);
                close(fd);
                btConns[i].fd = -1;
                btConns[i].active = false;
                btConns[i].rxLen = 0;
                continue;
            }
            btConns[i].rxLen += len;

            while (btConns[i].rxLen >= 2) {
                int msgLen   = unpackU16LE(btConns[i].rxBuf);
                int totalLen = msgLen + 2;
                if (msgLen < 2 || totalLen > (int)sizeof(btConns[i].rxBuf)) {
                    DMESG("BT: bad pkt len=%d from '%s', reset rxBuf", msgLen, btConns[i].brickName);
                    btConns[i].rxLen = 0;
                    break;
                }
                if (btConns[i].rxLen < totalLen) break;

                memcpy(pktBuf, btConns[i].rxBuf, totalLen);
                int rem = btConns[i].rxLen - totalLen;
                if (rem > 0) {
                    memmove(btConns[i].rxBuf, btConns[i].rxBuf + totalLen, rem);
                }
                btConns[i].rxLen = rem;

                pthread_mutex_unlock(&btMutex);
                handleIncomingPacket(pktBuf, totalLen);
                pthread_mutex_lock(&btMutex);

                if (!btConns[i].active || btConns[i].fd != fd) break;
            }
        }
        pthread_mutex_unlock(&btMutex);
    }
    return NULL;
}

static void ensureRxThread() {
    if (btRxRunning) return;
    btRxRunning = true;
    pthread_t tid;
    pthread_create(&tid, NULL, btReceiveThread, NULL);
    pthread_detach(tid);
}

// Parse "XX:XX:XX:XX:XX:XX" → 6-byte BtBdAddr (little-endian)
static bool parseBtAddr(const char *str, BtBdAddr &out) {
    unsigned int b[6];
    if (sscanf(str, "%x:%x:%x:%x:%x:%x", &b[5],&b[4],&b[3],&b[2],&b[1],&b[0]) != 6) return false;
    for (int i = 0; i < 6; i++) {
        out.b[i] = (uint8_t)b[i];
    }
    return true;
}

// Search a specific file for a MAC / Brick Name mapping
static bool searchFileForBrick(const char *path, const char *brickName, char addrOut[18]) {
    FILE *f = fopen(path, "r");
    if (!f) return false;

    char line[256];
    bool found = false;
    while (fgets(line, sizeof(line), f) && !found) {
        int llen = (int)strlen(line);
        while (llen > 0 && (line[llen - 1] == '\r' || line[llen - 1] == '\n' || line[llen - 1] == ' ')) {
            line[--llen] = 0;
        }
        if (llen < 18) continue;

        BtBdAddr testBd;
        char macCandidate[18];
        memcpy(macCandidate, line, 17);
        macCandidate[17] = 0;
        if (parseBtAddr(macCandidate, testBd)) {
            char *p = line + 17;
            while (*p == ' ' || *p == '\t' || *p == '"' || *p == '=') {
                p++;
            }
            char nameCandidate[VM_BRICK_NAME_SIZE];
            strncpy(nameCandidate, p, sizeof(nameCandidate) - 1);
            nameCandidate[sizeof(nameCandidate) - 1] = 0;
            int nlen = (int)strlen(nameCandidate);
            if (nlen > 0 && nameCandidate[nlen - 1] == '"') {
                nameCandidate[--nlen] = 0;
            }

            if (strcasecmp(nameCandidate, brickName) == 0) {
                strncpy(addrOut, macCandidate, 17);
                addrOut[17] = 0;
                found = true;
            }
        }
    }
    fclose(f);
    return found;
}

// Resolve remote MAC address to Brick Name
static bool findNameByAddr(const char *macStr, char nameOut[VM_BRICK_NAME_SIZE]) {
    nameOut[0] = 0;

    const char *baseDirs[] = { "/var/lib/bluetooth", "/etc/bluetooth" };
    for (size_t b = 0; b < sizeof(baseDirs)/sizeof(baseDirs[0]); b++) {
        DIR *dir = opendir(baseDirs[b]);
        if (!dir) continue;
        struct dirent *ent;
        while ((ent = readdir(dir)) != NULL) {
            if (ent->d_name[0] == '.') continue;
            char path[256];
            snprintf(path, sizeof(path), "%s/%s/names", baseDirs[b], ent->d_name);
            FILE *f = fopen(path, "r");
            if (!f) continue;
            char line[256];
            while (fgets(line, sizeof(line), f)) {
                if (strlen(line) >= 18 && strncasecmp(line, macStr, 17) == 0) {
                    char *p = line + 17;
                    while (*p == ' ' || *p == '\t' || *p == '"') {
                        p++;
                    }
                    int len = (int)strlen(p);
                    while (len > 0 && (p[len - 1] == '\r' || p[len - 1] == '\n' || p[len - 1] == ' ' || p[len - 1] == '"')) {
                        p[--len] = 0;
                    }
                    if (len > 0) {
                        strncpy(nameOut, p, VM_BRICK_NAME_SIZE - 1);
                        nameOut[VM_BRICK_NAME_SIZE - 1] = 0;
                        fclose(f);
                        closedir(dir);
                        DMESG("BT: resolved MAC %s to '%s'", macStr, nameOut);
                        return true;
                    }
                }
            }
            fclose(f);
        }
        closedir(dir);
    }

    // Fallback: /usr/bin/hcitool name <macStr>
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "/usr/bin/hcitool name %s", macStr);
    FILE *nc = popen(cmd, "r");
    if (nc) {
        if (fgets(nameOut, VM_BRICK_NAME_SIZE, nc)) {
            nameOut[strcspn(nameOut, "\r\n")] = 0;
            pclose(nc);
            if (nameOut[0] != 0) {
                DMESG("BT: resolved MAC %s to '%s' via hcitool name", macStr, nameOut);
                return true;
            }
        } else {
            pclose(nc);
        }
    }
    return false;
}

// Find BT address for a brick name
static bool findAddrByName(const char *brickName, char addrOut[18]) {
    if (!brickName || !brickName[0]) return false;

    // 1. Direct MAC address check (e.g. "00:16:53:12:34:56")
    BtBdAddr tmpAddr;
    if (parseBtAddr(brickName, tmpAddr)) {
        strncpy(addrOut, brickName, 17);
        addrOut[17] = 0;
        DMESG("BT: target '%s' is direct MAC", addrOut);
        return true;
    }

    // 2. Search BlueZ caches in /var/lib/bluetooth and /etc/bluetooth
    const char *baseDirs[] = { "/var/lib/bluetooth", "/etc/bluetooth" };
    for (size_t b = 0; b < sizeof(baseDirs)/sizeof(baseDirs[0]); b++) {
        DIR *dir = opendir(baseDirs[b]);
        if (!dir) continue;
        struct dirent *ent;
        while ((ent = readdir(dir)) != NULL) {
            if (ent->d_name[0] == '.') continue;
            char path[256];
            snprintf(path, sizeof(path), "%s/%s/names", baseDirs[b], ent->d_name);
            if (searchFileForBrick(path, brickName, addrOut)) {
                closedir(dir);
                DMESG("BT: found '%s' -> %s in %s", brickName, addrOut, path);
                return true;
            }
        }
        closedir(dir);
    }

    // 3. Search settings directory: ./settings/ and /home/root/lms2012/sys/settings/
    const char *settingsPaths[] = {
        "./settings/Bluetooth",
        "/home/root/lms2012/sys/settings/Bluetooth",
        "./settings/names",
        "/etc/bluetooth/names"
    };
    for (size_t s = 0; s < sizeof(settingsPaths)/sizeof(settingsPaths[0]); s++) {
        if (searchFileForBrick(settingsPaths[s], brickName, addrOut)) {
            DMESG("BT: found '%s' -> %s in %s", brickName, addrOut, settingsPaths[s]);
            return true;
        }
    }

    // 4. Check active ACL connections via hcitool con
    FILE *f = popen("/usr/bin/hcitool con 2>/dev/null", "r");
    if (!f) f = popen("hcitool con 2>/dev/null", "r");
    if (f) {
        char line[256], addr[18];
        bool found = false;
        while (fgets(line, sizeof(line), f) && !found) {
            char *p = strstr(line, "ACL ");
            if (!p) continue;
            p += 4;
            if (sscanf(p, "%17s", addr) != 1 || strlen(addr) != 17) continue;

            char cmd[64];
            snprintf(cmd, sizeof(cmd), "/usr/bin/hcitool name %s", addr);
            FILE *nc = popen(cmd, "r");
            if (!nc) continue;
            char nameBuf[VM_BRICK_NAME_SIZE];
            if (fgets(nameBuf, sizeof(nameBuf), nc)) {
                nameBuf[strcspn(nameBuf, "\r\n")] = 0;
                if (strcasecmp(nameBuf, brickName) == 0) {
                    strncpy(addrOut, addr, 17);
                    addrOut[17] = 0;
                    found = true;
                }
            }
            pclose(nc);
        }
        pclose(f);
        if (found) {
            DMESG("BT: found '%s' -> %s via hcitool con", brickName, addrOut);
            return true;
        }
    }

    // 5. Fallback: inquiry scan via hcitool scan
    DMESG("BT: '%s' not found in cache, scanning with hcitool scan...", brickName);
    FILE *scan = popen("/usr/bin/hcitool scan 2>/dev/null", "r");
    if (!scan) scan = popen("hcitool scan 2>/dev/null", "r");
    if (scan) {
        char line[256], addr[18];
        bool found = false;
        while (fgets(line, sizeof(line), scan) && !found) {
            char *tab = strchr(line, ':');
            if (tab && tab - line >= 2) {
                char *start = tab - 2;
                if (sscanf(start, "%17s", addr) == 1 && strlen(addr) == 17) {
                    char *name = start + 17;
                    while (*name == ' ' || *name == '\t') {
                        name++;
                    }
                    int len = (int)strlen(name);
                    while (len > 0 && (name[len - 1] == '\r' || name[len - 1] == '\n' || name[len - 1] == ' ')) {
                        name[--len] = 0;
                    }
                    if (strcasecmp(name, brickName) == 0) {
                        strncpy(addrOut, addr, 17);
                        addrOut[17] = 0;
                        found = true;
                    }
                }
            }
        }
        pclose(scan);
        if (found) {
            DMESG("BT: found '%s' -> %s via hcitool scan", brickName, addrOut);
            return true;
        }
    }

    DMESG("BT: brick '%s' not found", brickName);
    return false;
}

// Check if LMS2012 already opened an RFCOMM socket
static void checkInheritedSockets() {
    DIR *dir = opendir("/proc/self/fd");
    if (!dir) return;

    struct dirent *ent;
    while ((ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] == '.') continue;
        int fd = atoi(ent->d_name);
        if (fd < 3) continue;

        int type = 0;
        socklen_t typeLen = sizeof(type);
        if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &typeLen) < 0) continue;
        if (type != SOCK_STREAM) continue;

        SockAddrRc peerAddr;
        socklen_t peerLen = sizeof(peerAddr);
        if (getpeername(fd, (struct sockaddr *)&peerAddr, &peerLen) < 0) continue;
        if (peerAddr.rc_family != EV3_AF_BLUETOOTH) continue;

        char macStr[18];
        snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
            peerAddr.rc_bdaddr.b[5], peerAddr.rc_bdaddr.b[4],
            peerAddr.rc_bdaddr.b[3], peerAddr.rc_bdaddr.b[2],
            peerAddr.rc_bdaddr.b[1], peerAddr.rc_bdaddr.b[0]);

        char remoteName[VM_BRICK_NAME_SIZE] = {};
        if (!findNameByAddr(macStr, remoteName) || remoteName[0] == 0) {
            strncpy(remoteName, macStr, sizeof(remoteName) - 1);
        }

        pthread_mutex_lock(&btMutex);
        bool exists = false;
        for (int i = 0; i < btConnCount; i++) {
            if (btConns[i].active && btConns[i].fd == fd) { 
                exists = true;
                break;
            }
        }
        if (!exists && btConnCount < BT_MAX_CONNECTIONS) {
            struct timeval tv_sock = { 2, 0 };
            setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv_sock, sizeof(tv_sock));
            setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv_sock, sizeof(tv_sock));
            int slot = btConnCount++;
            btConns[slot].fd = fd;
            btConns[slot].active = true;
            btConns[slot].rxLen = 0;
            strncpy(btConns[slot].brickName, remoteName, VM_BRICK_NAME_SIZE - 1);
            btConns[slot].brickName[VM_BRICK_NAME_SIZE - 1] = 0;
            setBtStatus("Inherited: %s (fd %d)", remoteName, fd);
            DMESG("BT: registered inherited socket slot %d: '%s' (fd %d)", slot, remoteName, fd);
        }
        pthread_mutex_unlock(&btMutex);
    }
    closedir(dir);
}

// RFCOMM Server Thread
static void *btServerThread(void *) {
    DMESG("BT: server thread starting");

    int s1Err = 0, s2Err = 0;

    // Attempt to bind Channel 1
    int s1 = socket(EV3_AF_BLUETOOTH, SOCK_STREAM, EV3_BTPROTO_RFCOMM);
    if (s1 >= 0) {
        int opt = 1;
        setsockopt(s1, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
        SockAddrRc addr1;
        memset(&addr1, 0, sizeof(addr1));
        addr1.rc_family  = EV3_AF_BLUETOOTH;
        addr1.rc_channel = BT_RFCOMM_CHANNEL_1;
        if (bind(s1, (struct sockaddr *)&addr1, sizeof(addr1)) == 0) {
            if (listen(s1, 5) == 0) {
                serverFd1 = s1;
                DMESG("BT: listening on RFCOMM ch %d (fd=%d)", BT_RFCOMM_CHANNEL_1, s1);
            } else {
                s1Err = errno;
                DMESG("BT: listen ch %d failed errno=%d", BT_RFCOMM_CHANNEL_1, errno);
                close(s1);
            }
        } else {
            s1Err = errno;
            DMESG("BT: bind ch %d failed errno=%d", BT_RFCOMM_CHANNEL_1, errno);
            close(s1);
        }
    } else {
        s1Err = errno;
    }

    // Attempt to bind Channel 2
    int s2 = socket(EV3_AF_BLUETOOTH, SOCK_STREAM, EV3_BTPROTO_RFCOMM);
    if (s2 >= 0) {
        int opt = 1;
        setsockopt(s2, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
        SockAddrRc addr2;
        memset(&addr2, 0, sizeof(addr2));
        addr2.rc_family = EV3_AF_BLUETOOTH;
        addr2.rc_channel = BT_RFCOMM_CHANNEL_2;
        if (bind(s2, (struct sockaddr *)&addr2, sizeof(addr2)) == 0) {
            if (listen(s2, 5) == 0) {
                serverFd2 = s2;
                DMESG("BT: listening on RFCOMM ch %d (fd=%d)", BT_RFCOMM_CHANNEL_2, s2);
            } else {
                s2Err = errno;
                DMESG("BT: listen ch %d failed errno=%d", BT_RFCOMM_CHANNEL_2, errno);
                close(s2);
            }
        } else {
            s2Err = errno;
            DMESG("BT: bind ch %d failed errno=%d", BT_RFCOMM_CHANNEL_2, errno);
            close(s2);
        }
    } else {
        s2Err = errno;
    }

    if (serverFd1 < 0 && serverFd2 < 0) {
        setBtStatus("Srv err S1:e%d S2:e%d", s1Err, s2Err);
        DMESG("BT: server could not bind any RFCOMM channels (s1Err=%d, s2Err=%d)", s1Err, s2Err);
        btServerRunning = false;
        return NULL;
    } else {
        setBtStatus("Srv ok S1:%s S2:%s", serverFd1 >= 0 ? "ok" : "err", serverFd2 >= 0 ? "ok" : "err");
    }

    while (btServerRunning) {
        fd_set fds;
        FD_ZERO(&fds);
        int maxFd = -1;

        if (serverFd1 >= 0) {
            FD_SET(serverFd1, &fds);
            if (serverFd1 > maxFd) maxFd = serverFd1;
        }
        if (serverFd2 >= 0) {
            FD_SET(serverFd2, &fds);
            if (serverFd2 > maxFd) maxFd = serverFd2;
        }

        struct timeval tv = { 1, 0 }; // 1 sec timeout
        int rc = select(maxFd + 1, &fds, NULL, NULL, &tv);
        if (rc <= 0) continue;

        int activeServers[2] = { serverFd1, serverFd2 };
        for (int s = 0; s < 2; s++) {
            int sfd = activeServers[s];
            if (sfd < 0 || !FD_ISSET(sfd, &fds)) continue;

            SockAddrRc clientAddr;
            socklen_t clientLen = sizeof(clientAddr);
            int cfd = accept(sfd, (struct sockaddr *)&clientAddr, &clientLen);
            if (cfd < 0) {
                if (errno != EINTR && errno != EAGAIN && errno != EWOULDBLOCK) {
                    DMESG("BT: accept failed errno=%d", errno);
                }
                continue;
            }

            struct timeval tv_sock = { 2, 0 };
            setsockopt(cfd, SOL_SOCKET, SO_SNDTIMEO, &tv_sock, sizeof(tv_sock));
            setsockopt(cfd, SOL_SOCKET, SO_RCVTIMEO, &tv_sock, sizeof(tv_sock));

            char macStr[18];
            snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
                clientAddr.rc_bdaddr.b[5], clientAddr.rc_bdaddr.b[4],
                clientAddr.rc_bdaddr.b[3], clientAddr.rc_bdaddr.b[2],
                clientAddr.rc_bdaddr.b[1], clientAddr.rc_bdaddr.b[0]);

            char clientName[VM_BRICK_NAME_SIZE] = {};
            if (!findNameByAddr(macStr, clientName) || clientName[0] == 0) {
                strncpy(clientName, macStr, sizeof(clientName) - 1);
            }

            DMESG("BT: accepted connection from '%s' (%s) fd=%d", clientName, macStr, cfd);

            pthread_mutex_lock(&btMutex);
            int slot = -1;
            for (int i = 0; i < btConnCount; i++) {
                if (!btConns[i].active) {
                    slot = i;
                    break;
                } else if (strcasecmp(btConns[i].brickName, clientName) == 0) {
                    close(btConns[i].fd);
                    slot = i;
                    break;
                }
            }
            if (slot < 0 && btConnCount < BT_MAX_CONNECTIONS) {
                slot = btConnCount++;
            }

            if (slot >= 0) {
                btConns[slot].fd = cfd;
                btConns[slot].active = true;
                btConns[slot].rxLen = 0;
                strncpy(btConns[slot].brickName, clientName, VM_BRICK_NAME_SIZE - 1);
                btConns[slot].brickName[VM_BRICK_NAME_SIZE - 1] = 0;
                setBtStatus("Client: %s (fd %d)", clientName, cfd);
                DMESG("BT: client registered at slot %d: '%s'", slot, clientName);
            } else {
                DMESG("BT: connection limit reached, rejecting incoming");
                close(cfd);
            }
            pthread_mutex_unlock(&btMutex);

            ensureRxThread();
        }
    }

    if (serverFd1 >= 0) { 
        close(serverFd1);
        serverFd1 = -1;
    }
    if (serverFd2 >= 0) { 
        close(serverFd2);
        serverFd2 = -1;
    }
    return NULL;
}

static void ensureBtServer() {
    if (btServerRunning) return;
    btServerRunning = true;
    pthread_t tid;
    pthread_create(&tid, NULL, btServerThread, NULL);
    pthread_detach(tid);
}

static void initBluetooth() {
    pthread_mutex_lock(&btInitMutex);
    if (!btInitialized) {
        btInitialized = true;
        signal(SIGPIPE, SIG_IGN);
        // Ensure local Bluetooth adapter is UP and connectable (Page Scan + Inquiry Scan)
        system("/usr/bin/hciconfig hci0 up 2>/dev/null; /usr/bin/hciconfig hci0 piscan 2>/dev/null");
        checkInheritedSockets();
        ensureBtServer();
        ensureRxThread();
    }
    pthread_mutex_unlock(&btInitMutex);
}

// Auto-start server and receive threads when binary loads
__attribute__((constructor)) static void btAutoInit() {
    initBluetooth();
}

// Internal: find or create a mailbox slot
static int getOrCreateSlot(const char *mailbox, uint8_t dataType) {
    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < mailboxSlotCount; i++) {
        if (strcmp(mailboxSlots[i].name, mailbox) == 0 && mailboxSlots[i].dataType == dataType) {
            int idx = i;
            pthread_mutex_unlock(&btMutex);
            return idx;
        }
    }
    if (mailboxSlotCount >= MAX_MAILBOX_SLOTS) {
        pthread_mutex_unlock(&btMutex);
        return -1;
    }
    int idx = mailboxSlotCount++;
    MailboxSlot &s = mailboxSlots[idx];
    strncpy(s.name, mailbox, BT_MAX_MAILBOX_NAME - 1);
    s.name[BT_MAX_MAILBOX_NAME - 1] = 0;
    s.dataType = dataType;
    s.dataLen = 0;
    memset(s.data, 0, sizeof(s.data));
    s.eventSrc = pxt::allocateNotifyEvent();
    s.eventVal = 0;
    pthread_mutex_unlock(&btMutex);
    return idx;
}

// Broadcast to all active connections
static uint16_t msgCounter = 0;

static void broadcastMailbox(const char *mailbox, const uint8_t *payload, int payloadLen) {
    if (!mailbox) return;
    initBluetooth();
    uint16_t mc = ++msgCounter;

    int targets[BT_MAX_CONNECTIONS];
    char targetNames[BT_MAX_CONNECTIONS][VM_BRICK_NAME_SIZE];
    int numTargets = 0;

    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < btConnCount; i++) {
        if (btConns[i].active && btConns[i].fd >= 0) {
            targets[numTargets] = btConns[i].fd;
            strncpy(targetNames[numTargets], btConns[i].brickName, VM_BRICK_NAME_SIZE - 1);
            targetNames[numTargets][VM_BRICK_NAME_SIZE - 1] = 0;
            numTargets++;
        }
    }
    pthread_mutex_unlock(&btMutex);

    if (numTargets == 0) {
        DMESG("BT: broadcastMailbox '%s' - no active connections!", mailbox);
        return;
    }

    for (int i = 0; i < numTargets; i++) {
        int fd = targets[i];
        if (!sendMailboxPacket(fd, mailbox, payload, payloadLen, mc)) {
            int err = errno;
            DMESG("BT: send to '%s' failed errno=%d", targetNames[i], err);
            if (err == EPIPE || err == ECONNRESET || err == EBADF || err == ETIMEDOUT || err == ENOTCONN) {
                pthread_mutex_lock(&btMutex);
                for (int c = 0; c < btConnCount; c++) {
                    if (btConns[c].fd == fd) {
                        close(fd);
                        btConns[c].fd = -1;
                        btConns[c].active = false;
                        btConns[c].rxLen = 0;
                        DMESG("BT: deactivated broken conn slot %d ('%s')", c, targetNames[i]);
                        break;
                    }
                }
                pthread_mutex_unlock(&btMutex);
            }
        }
    }
}

} // namespace pxt


// Public namespace exposed to TypeScript via shims
namespace bluetooth {

using namespace pxt;

//%
String status() {
    char tmp[256];
    pthread_mutex_lock(&btStatusMutex);
    strncpy(tmp, btLastStatus, sizeof(tmp) - 1);
    tmp[sizeof(tmp) - 1] = 0;
    pthread_mutex_unlock(&btStatusMutex);
    return mkString(tmp, -1);
}

//%
void connectToBrick(String brickName) {
    if (!brickName) {
        setBtStatus("Err: null name");
        return;
    }
    const char *name = brickName->getUTF8Data();
    if (!name || !name[0]) {
        setBtStatus("Err: empty name");
        return;
    }

    initBluetooth();

    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < btConnCount; i++) {
        if (btConns[i].active && strcasecmp(btConns[i].brickName, name) == 0) {
            pthread_mutex_unlock(&btMutex);
            setBtStatus("Already ok: %s", name);
            DMESG("BT: already connected to '%s'", name);
            return;
        }
    }
    if (btConnCount >= BT_MAX_CONNECTIONS) {
        pthread_mutex_unlock(&btMutex);
        setBtStatus("Err: max conns (%d)", BT_MAX_CONNECTIONS);
        DMESG("BT: max connections reached");
        return;
    }
    pthread_mutex_unlock(&btMutex);

    setBtStatus("Resolving %s...", name);

    char addr[18] = {};
    if (!findAddrByName(name, addr)) {
        setBtStatus("Not found: '%s'", name);
        DMESG("BT: connectToBrick '%s' failed - address not found", name);
        return;
    }

    BtBdAddr remoteBd;
    if (!parseBtAddr(addr, remoteBd)) {
        setBtStatus("Bad addr: %s", addr);
        DMESG("BT: bad addr '%s'", addr);
        return;
    }

    // Try channels: BT_RFCOMM_CHANNEL_1, then BT_RFCOMM_CHANNEL_2
    const uint8_t channels[] = { BT_RFCOMM_CHANNEL_1, BT_RFCOMM_CHANNEL_2 };
    int connectedFd = -1;
    int ch1Err = 0, ch2Err = 0;

    for (size_t c = 0; c < sizeof(channels) / sizeof(channels[0]); c++) {
        uint8_t ch = channels[c];
        int fd = socket(EV3_AF_BLUETOOTH, SOCK_STREAM, EV3_BTPROTO_RFCOMM);
        if (fd < 0) {
            if (ch == BT_RFCOMM_CHANNEL_1) {
                ch1Err = errno;
            } else {
                ch2Err = errno;
            }
            DMESG("BT: socket() errno=%d", errno);
            continue;
        }

        SockAddrRc remote;
        memset(&remote, 0, sizeof(remote));
        remote.rc_family = EV3_AF_BLUETOOTH;
        remote.rc_channel = ch;
        memcpy(&remote.rc_bdaddr, &remoteBd, sizeof(remoteBd));

        DMESG("BT: attempting connect to '%s' (%s) ch %d...", name, addr, ch);

        int flags = fcntl(fd, F_GETFL, 0);
        fcntl(fd, F_SETFL, flags | O_NONBLOCK);

        int res = connect(fd, (struct sockaddr *)&remote, sizeof(remote));
        if (res == 0) {
            fcntl(fd, F_SETFL, flags);
            connectedFd = fd;
            struct timeval tv_sock = { 2, 0 };
            setsockopt(connectedFd, SOL_SOCKET, SO_SNDTIMEO, &tv_sock, sizeof(tv_sock));
            setsockopt(connectedFd, SOL_SOCKET, SO_RCVTIMEO, &tv_sock, sizeof(tv_sock));
            DMESG("BT: connected to '%s' on ch %d", name, ch);
            break;
        } else if (errno == EINPROGRESS) {
            fd_set wfds;
            FD_ZERO(&wfds);
            FD_SET(fd, &wfds);
            struct timeval tv = { 4, 0 }; // 4 second timeout per channel
            res = select(fd + 1, NULL, &wfds, NULL, &tv);
            if (res > 0) {
                int so_error = 0;
                socklen_t len = sizeof(so_error);
                getsockopt(fd, SOL_SOCKET, SO_ERROR, &so_error, &len);
                if (so_error == 0) {
                    fcntl(fd, F_SETFL, flags);
                    connectedFd = fd;
                    struct timeval tv_sock = { 2, 0 };
                    setsockopt(connectedFd, SOL_SOCKET, SO_SNDTIMEO, &tv_sock, sizeof(tv_sock));
                    setsockopt(connectedFd, SOL_SOCKET, SO_RCVTIMEO, &tv_sock, sizeof(tv_sock));
                    DMESG("BT: connected to '%s' on ch %d", name, ch);
                    break;
                } else {
                    if (ch == BT_RFCOMM_CHANNEL_1) {
                        ch1Err = so_error;
                    } else {
                        ch2Err = so_error;
                    }
                    DMESG("BT: connect on ch %d failed so_error=%d", ch, so_error);
                }
            } else {
                if (ch == BT_RFCOMM_CHANNEL_1) {
                    ch1Err = ETIMEDOUT;
                } else {
                    ch2Err = ETIMEDOUT;
                }
                DMESG("BT: connect on ch %d timed out (res=%d)", ch, res);
            }
        } else {
            if (ch == BT_RFCOMM_CHANNEL_1) {
                ch1Err = errno;
            } else {
                ch2Err = errno;
            }
            DMESG("BT: connect on ch %d failed errno=%d", ch, errno);
        }
        close(fd);
    }

    if (connectedFd < 0) {
        setBtStatus("Fail: c1:e%d c2:e%d", ch1Err, ch2Err);
        DMESG("BT: failed to connect to '%s' (%s): c1=%d c2=%d", name, addr, ch1Err, ch2Err);
        return;
    }

    pthread_mutex_lock(&btMutex);
    int slot = -1;
    for (int i = 0; i < btConnCount; i++) {
        if (!btConns[i].active) {
            slot = i;
            break;
        }
    }
    if (slot < 0 && btConnCount < BT_MAX_CONNECTIONS) {
        slot = btConnCount++;
    }

    if (slot >= 0) {
        btConns[slot].fd = connectedFd;
        btConns[slot].active = true;
        btConns[slot].rxLen = 0;
        strncpy(btConns[slot].brickName, name, VM_BRICK_NAME_SIZE - 1);
        btConns[slot].brickName[VM_BRICK_NAME_SIZE - 1] = 0;
        setBtStatus("OK: %s (fd %d)", name, connectedFd);
        DMESG("BT: connected to '%s' (slot %d, fd %d)", name, slot, connectedFd);
    } else {
        close(connectedFd);
        setBtStatus("Err: no slot");
    }
    pthread_mutex_unlock(&btMutex);

    ensureRxThread();
}

//%
bool isConnected(String brickName) {
    initBluetooth();
    pthread_mutex_lock(&btMutex);
    bool found = false;
    if (!brickName || brickName->getUTF8Size() == 0) {
        for (int i = 0; i < btConnCount && !found; i++) {
            found = btConns[i].active && btConns[i].fd >= 0;
        }
    } else {
        const char *name = brickName->getUTF8Data();
        for (int i = 0; i < btConnCount && !found; i++) {
            found = btConns[i].active && btConns[i].fd >= 0 && strcasecmp(btConns[i].brickName, name) == 0;
        }
    }
    pthread_mutex_unlock(&btMutex);
    return found;
}

//%
void disconnectBrick(String brickName) {
    if (!brickName) return;
    const char *name = brickName->getUTF8Data();
    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < btConnCount; i++) {
        if (btConns[i].active && strcasecmp(btConns[i].brickName, name) == 0) {
            close(btConns[i].fd);
            btConns[i].fd = -1;
            btConns[i].active = false;
            btConns[i].rxLen = 0;
            DMESG("BT: disconnected from '%s'", name);
            break;
        }
    }
    pthread_mutex_unlock(&btMutex);
}

//%
void sendTextMessage(String mailbox, String value) {
    if (!mailbox || !value) return;
    const char *val = value->getUTF8Data();
    int len = (int)strlen(val) + 1; // include null terminator in payload
    broadcastMailbox(mailbox->getUTF8Data(), (const uint8_t *)val, len);
}

//%
void sendNumberMessage(String mailbox, TNumber value) {
    if (!mailbox) return;
    float fval = (float)toDouble(value);
    broadcastMailbox(mailbox->getUTF8Data(), (const uint8_t *)&fval, 4);
}

//%
void sendLogicMessage(String mailbox, bool value) {
    if (!mailbox) return;
    uint8_t v = value ? 1 : 0;
    broadcastMailbox(mailbox->getUTF8Data(), &v, 1);
}

//%
int _registerMailboxHandler(String mailbox, int dataType) {
    if (!mailbox) return -1;
    initBluetooth();
    int idx = getOrCreateSlot(mailbox->getUTF8Data(), (uint8_t)dataType);
    return idx < 0 ? -1 : mailboxSlots[idx].eventSrc;
}

//%
String readTextMessage(String mailbox) {
    if (!mailbox) return mkString("", 0);
    const char *mbox = mailbox->getUTF8Data();
    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < mailboxSlotCount; i++) {
        MailboxSlot &s = mailboxSlots[i];
        if (s.dataType == MBOX_TYPE_TEXT && strcmp(s.name, mbox) == 0) {
            String r = mkString((const char *)s.data, -1);
            pthread_mutex_unlock(&btMutex);
            return r;
        }
    }
    pthread_mutex_unlock(&btMutex);
    return mkString("", 0);
}

//%
TNumber readNumberMessage(String mailbox) {
    if (!mailbox) return fromDouble(0);
    const char *mbox = mailbox->getUTF8Data();
    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < mailboxSlotCount; i++) {
        MailboxSlot &s = mailboxSlots[i];
        if (s.dataType == MBOX_TYPE_NUMERIC && s.dataLen >= 4 && strcmp(s.name, mbox) == 0) {
            float fval;
            memcpy(&fval, s.data, 4);
            pthread_mutex_unlock(&btMutex);
            return fromDouble((double)fval);
        }
    }
    pthread_mutex_unlock(&btMutex);
    return fromDouble(0);
}

//%
bool readLogicMessage(String mailbox) {
    if (!mailbox) return false;
    const char *mbox = mailbox->getUTF8Data();
    pthread_mutex_lock(&btMutex);
    for (int i = 0; i < mailboxSlotCount; i++) {
        MailboxSlot &s = mailboxSlots[i];
        if (s.dataType == MBOX_TYPE_LOGIC && s.dataLen >= 1 && strcmp(s.name, mbox) == 0) {
            bool v = s.data[0] != 0;
            pthread_mutex_unlock(&btMutex);
            return v;
        }
    }
    pthread_mutex_unlock(&btMutex);
    return false;
}

} // namespace bluetooth