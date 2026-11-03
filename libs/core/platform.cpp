#include "pxt.h"

#include <unistd.h>
#include <sys/mman.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <pthread.h>
#include <signal.h>
#include <dirent.h>
#include <sys/socket.h>
#include <errno.h>
#include "ev3const.h"

namespace pxt {

#define USB_RFCOMM_MAGIC 0x3d3f
#define USB_SERIAL 1
#define USB_RESTART 2
#define USB_DMESG 3

#define RFCOMM_PING 3
#define RFCOMM_STOP 2

int lmsPid;
static pthread_t mainThreadId; // Main JavaScript user execution thread ID

static int usbFD;
static int rfcommFD = -1; // Connected RFCOMM socket shared with LMS2012

static const char *progPath = "/mnt/ramdisk/prjs/BrkProg_SAVE";

static char ev3BrickName[VM_BRICK_NAME_SIZE];

struct UsbPacket {
    uint16_t size;
    uint16_t msgcount;
    uint16_t magic;
    uint16_t code;
    char buf[1024 - 8];
};


void stopMotors() {
    uint8_t cmd[3] = {opOutputStop, 0x0F, 0};
    int fd = open("/dev/lms_pwm", O_RDWR);
    if (fd >= 0) {
        write(fd, cmd, 3);
        close(fd);
    }
}

void stopProgram() {
    // Note: opProgramStop (0x02) is the Linux kernel driver opcode for /dev/lms_pwm (d_pwm.c).
    // Do not confuse with VM bytecode instruction opOutput_Prg_Stop (0xB4).
    uint8_t cmd[1] = {opProgramStop};
    int fd = open("/dev/lms_pwm", O_RDWR);
    if (fd >= 0) {
        write(fd, cmd, 1);
        close(fd);
    }
}

void stopLMS() {
    struct dirent *ent;
    DIR *dir;

    dir = opendir("/proc");
    if (dir == NULL) return;

    while ((ent = readdir(dir)) != NULL) {
        int pid = atoi(ent->d_name);
        if (!pid) continue;

        char namebuf[100];
        snprintf(namebuf, 100, "/proc/%d/cmdline", pid);

        FILE *f = fopen(namebuf, "r");
        if (f) {
            fread(namebuf, 1, 99, f);
            if (strcmp(namebuf, "./lms2012") == 0) {
                lmsPid = pid;
            }

            fclose(f);
            if (lmsPid) break;
        }
    }

    closedir(dir);

    lmsPid = 0; // Disable SIGSTOP for now - rethink if problems with I2C (runs on a thread)

    if (lmsPid) {
        DMESG("SIGSTOP to lmsPID=%d", lmsPid);
        if (kill(lmsPid, SIGSTOP)) {
            DMESG("SIGSTOP failed errno=%d", errno);
        }
    }
}

void runLMS() {
    DMESG("re-starting LMS2012");
    kill(lmsPid, SIGCONT);
    sleep_core_us(200000);
    exit(0);
    /*
    chdir("/home/root/lms2012/sys");
    for (int fd = 3; fd < 9999; ++fd)
        close(fd);
    execl("lms2012", "./lms2012");
    exit(100); // should not be reached
    */
}

extern "C" void target_reset() {
    // Prevent re-entering target_reset while it is already executing
    static volatile bool resetting = false;
    if (__sync_lock_test_and_set(&resetting, 1)) {
        while (true) {
            sleep_core_us(100000);
        }
    }

    // Cancel main user thread if called from exitThread to prevent user loops (e.g. while(true))
    // from queuing new motor commands while shutting down
    if (mainThreadId && !pthread_equal(mainThreadId, pthread_self())) {
        pthread_cancel(mainThreadId);
        pthread_join(mainThreadId, NULL);
    }

    tryLockUser();
    stopMotors();
    stopProgram();

    // Give kernel PWM driver time to apply 0% duty cycle / H-bridge coast before process exit
    sleep_core_us(50000); // 50 ms

    if (lmsPid) {
        runLMS();
    } else {
        exit(0);
    }
}

void target_exit() {
    target_reset();
}

// Standard error messages (stderr) are sent to sensor port 1
// Comment the below lines to enable debug messages out of this port.
// Printing debug messages prevents normal functionality of port 1 UART sensors such as the IR sensor.
void close_stderr() __attribute__((constructor(101)));
void close_stderr() {
    fclose(stderr);
}


void *usbThread(void *) {
    UsbPacket pkt;
    UsbPacket resp;

    while (true) {
        int len = read(usbFD, &pkt, sizeof(pkt));
        if (len <= 4) {
            sleep_core_us(20000);
            continue;
        }
        // DMESG("USB THREAD magic=%04x code=%04x msg=%04x", pkt.magic, pkt.code, pkt.msgcount);
        resp.msgcount = pkt.msgcount;
        if (pkt.magic == USB_RFCOMM_MAGIC) {
            if (pkt.code == USB_RESTART) {
                target_reset();
            } else if (pkt.code == USB_DMESG) {
                dumpDmesg();
            }
            /*
            resp.magic = pkt.magic;
            resp.code = pkt.code;
            resp.size = 8;
            write(usbFD, &resp, sizeof(resp));
            */
        } else {
            resp.magic = 0xffff;
            resp.size = 4;
            write(usbFD, &resp, sizeof(resp));
        }
        sleep_core_us(1000);
    }
}

static void startUsb() {
    usbFD = open("/dev/lms_usbdev", O_RDWR, 0666);
    if (usbFD < 0) {
        DMESG("USB open FAILED errno=%d", errno);
        return;
    }

    pthread_t pid;
    int rc = pthread_create(&pid, NULL, usbThread, NULL);
    // DMESG("USB pthread_create rc=%d", rc);

    if (rc == 0) {
        pthread_detach(pid);
    }
}

void sendUsb(uint16_t code, const char *data, int len) {
    while (len > 0) {
        int sz = len;
        if (sz > 1000) {
            sz = 1000;
        }
        UsbPacket pkt = {(uint16_t)(6 + sz), 0, USB_RFCOMM_MAGIC, code, {}};
        memcpy(pkt.buf, data, sz);
        write(usbFD, &pkt, sizeof(pkt));
        len -= sz;
        data += sz;
    }
}

void sendSerial(const char *data, int len) {
    sendUsb(USB_SERIAL, data, len);
}


// Find the already connected RFCOMM socket inherited from LMS2012.
// LMS2012 accepts the Bluetooth connection before being stopped, and the accepted socket remains available to the PXT runtime after SIGSTOP.
static int findRfcommSocket() {
    DIR *dir = opendir("/proc/self/fd");
    if (!dir) {
        DMESG("RFCOMM opendir failed errno=%d", errno);
        return -1;
    }

    struct dirent *ent;

    while ((ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] == '.') continue;

        int fd = atoi(ent->d_name);
        if (fd < 0) continue;

        int type = 0;
        socklen_t typeLen = sizeof(type);

        if (getsockopt(fd, SOL_SOCKET, SO_TYPE, &type, &typeLen) < 0) continue;
        if (type != SOCK_STREAM) continue;

        struct sockaddr addr;
        socklen_t addrLen = sizeof(addr);

        if (getpeername(fd, &addr, &addrLen) < 0) continue;
        if (addr.sa_family != EV3_AF_BLUETOOTH) continue;

        DMESG("RFCOMM socket found fd=%d family=%d type=%d", fd, addr.sa_family, type);

        closedir(dir);
        return fd;
    }

    closedir(dir);

    DMESG("RFCOMM connected socket not found");
    return -1;
}

static void sendSystemReply(uint16_t msgcount, uint8_t command, uint16_t status) {
    const int replySize = 6;
    uint8_t reply[8] = {};
    reply[0] = replySize & 0xff;
    reply[1] = (replySize >> 8) & 0xff;
    reply[2] = msgcount & 0xff;
    reply[3] = (msgcount >> 8) & 0xff;
    reply[4] = 0x03;
    reply[5] = command;
    reply[6] = status & 0xff;
    reply[7] = (status >> 8) & 0xff;
    // DMESG("RFCOMM SYSTEM REPLY msgcount=%04x command=%02x status=%04x size=%d", msgcount, command, status, replySize);
    write(rfcommFD, reply, replySize + 2);
}

static void sendDirectReply(uint16_t msgcount, const uint8_t *data = NULL, int dataLen = 0) {
    const int replySize = 3 + dataLen;
    uint8_t reply[256] = {};
    reply[0] = replySize & 0xff;
    reply[1] = (replySize >> 8) & 0xff;
    reply[2] = msgcount & 0xff;
    reply[3] = (msgcount >> 8) & 0xff;
    reply[4] = 0x02;
    if (dataLen > 0) {
        memcpy(reply + 5, data, dataLen);
    }
    // DMESG("RFCOMM DIRECT REPLY msgcount=%04x size=%d", msgcount, replySize);
    write(rfcommFD, reply, replySize + 2);
}

// Parse a complete LEGO communication packet received over RFCOMM.
// Distinguish custom and system packets and extract the system payload.
static void handleRfcommPacket(const uint8_t *packet, int totalLen) {
    if (totalLen < 6) {
        DMESG("RFCOMM packet too short len=%d", totalLen);
        return;
    }

    int msgLen = packet[0] | (packet[1] << 8);
    uint16_t msgcount = packet[2] | (packet[3] << 8);

    if (msgLen + 2 != totalLen) {
        DMESG("RFCOMM length mismatch msglen=%d total=%d", msgLen, totalLen);
        return;
    }

    // LEGO Direct Command: opNop
    if (packet[4] == 0x00 && totalLen >= 8 && packet[7] == 0x01) {
        sendDirectReply(msgcount, NULL, 0);
        return;
    }

    // LEGO Direct Command: opCOM_GET / GET_BRICKNAME
    if (packet[4] == 0x00 && totalLen >= 12 && packet[7] == 0xD3 && packet[8] == 0x0D) {
        uint8_t name[VM_BRICK_NAME_SIZE] = {};
        memcpy(name, ev3BrickName, sizeof(name));
        sendDirectReply(msgcount, name, sizeof(name));
        return;
    }

    // RFCOMM custom
    if (totalLen >= 8 && packet[4] == (USB_RFCOMM_MAGIC & 0xff) && packet[5] == ((USB_RFCOMM_MAGIC >> 8) & 0xff)) {
        uint16_t code = packet[6] | (packet[7] << 8);
        DMESG("RFCOMM CUSTOM msgcount=%04x magic=3d3f code=%04x", msgcount, code);

        if (code == RFCOMM_STOP) {
            sendSystemReply(msgcount, 2, 0);
            sleep_core_us(10000);
            target_reset();
        }  else if (code == RFCOMM_PING) {
            sendSystemReply(msgcount, 3, 0);
        }

        return;
    }

    // DMESG("RFCOMM SYSTEM msgcount=%04x type=%02x command=%02x", msgcount, packet[4], packet[5]);

    int payloadLen = totalLen - 6;
    if (payloadLen > 0) {
        char payload[1024];
        int copyLen = payloadLen;

        if (copyLen >= (int)sizeof(payload)) {
            copyLen = sizeof(payload) - 1;
        }

        memcpy(payload, packet + 6, copyLen);
        payload[copyLen] = 0;
    }
}


// Read and process complete packets from the existing RFCOMM connection.
// Data may arrive in several reads or contain multiple packets in one read, so bytes are accumulated until a complete packet is available.
static void *rfcommThread(void *) {
    uint8_t rxBuf[1024];
    uint8_t packetBuf[4096];
    int packetLen = 0;

    if (rfcommFD < 0) {
        DMESG("RFCOMM THREAD invalid socket fd");
        return NULL;
    }

    DMESG("RFCOMM THREAD started fd=%d", rfcommFD);

    while (true) {
        fd_set fds;
        struct timeval tv;

        FD_ZERO(&fds);
        FD_SET(rfcommFD, &fds);

        tv.tv_sec = 1;
        tv.tv_usec = 0;

        int rc = select(rfcommFD + 1, &fds, NULL, NULL, &tv);

        if (rc < 0) {
            DMESG("RFCOMM THREAD select failed errno=%d", errno);
            continue;
        }
        if (rc == 0) continue;
        if (!FD_ISSET(rfcommFD, &fds)) continue;

        int len = read(rfcommFD, rxBuf, sizeof(rxBuf));

        if (len < 0) {
            DMESG("RFCOMM THREAD read failed errno=%d", errno);
            break;
        }
        if (len == 0) {
            DMESG("RFCOMM THREAD peer disconnected");
            break;
        }

        // DMESG("RFCOMM THREAD read len=%d", len);

        if (packetLen + len > (int)sizeof(packetBuf)) {
            DMESG("RFCOMM THREAD buffer overflow");
            packetLen = 0;
            continue;
        }

        memcpy(packetBuf + packetLen, rxBuf, len);
        packetLen += len;

        while (packetLen >= 2) {
            int msgLen = packetBuf[0] | (packetBuf[1] << 8);
            if (msgLen < 2 || msgLen > (int)sizeof(packetBuf)) {
                DMESG("RFCOMM THREAD invalid packet length=%d", msgLen);
                packetLen = 0;
                break;
            }

            if (packetLen < msgLen + 2) break;

            int totalLen = msgLen + 2;

            // DMESG("RFCOMM THREAD COMPLETE PACKET len=%d", totalLen);
            handleRfcommPacket(packetBuf, totalLen);

            int remaining = packetLen - totalLen;
            if (remaining > 0) {
                memmove(packetBuf, packetBuf + totalLen, remaining);
            }

            packetLen = remaining;
        }
    }

    return NULL;
}

// Start the thread that handles the existing RFCOMM connection inherited from LMS2012.
static void startRfcommThread() {
    pthread_t pid;
    int rc = pthread_create(&pid, NULL, rfcommThread, NULL);
    // DMESG("RFCOMM THREAD pthread_create rc=%d", rc);

    if (rc == 0) {
        pthread_detach(pid);
    }
}


static void loadEv3BrickName() {
    ev3BrickName[0] = 0;

    FILE *file = fopen("./settings/BrickName", "r");
    if (!file) return;

    fgets(ev3BrickName, sizeof(ev3BrickName), file);
    fclose(file);

    ev3BrickName[strcspn(ev3BrickName, "\r\n")] = 0;
}

static void *exitThread(void *) {
    int fd = open("/dev/lms_ui", O_RDWR, 0666);
    if (fd < 0) return 0;

    uint8_t *data = (uint8_t *)mmap(NULL, NUM_BUTTONS, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (data == MAP_FAILED) {
        close(fd);
        return 0;
    }

    while (true) {
        if (data[5]) { // Cancel (back) btn
            target_reset();
        }
        sleep_core_us(50000);
    }
}

static void startExitThread() {
    pthread_t pid;
    pthread_create(&pid, NULL, exitThread, NULL);
    pthread_detach(pid);
}

void target_startup() {
    // Record main thread ID and allow asynchronous cancellation so tight while(true) loops
    // can be terminated cleanly when the BACK/Escape button is pressed
    mainThreadId = pthread_self();
    pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, NULL);
    pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, NULL);

    loadEv3BrickName();
    stopLMS();
    startUsb();
    rfcommFD = findRfcommSocket();
    if (rfcommFD >= 0) {
        startRfcommThread();
    }
    startExitThread();
}


void initKeys() {}

// These are disabled except when building File_manager.pdf
// %
void deletePrjFile(String filename) {
    const char *d = filename->getUTF8Data();
    if (strlen(d) > 500 || strchr(d, '/')) return;
    char buf[1024];
    snprintf(buf, sizeof(buf), "%s/%s", progPath, d);
    unlink(buf);
}

// %
RefCollection *listPrjFiles() {
    auto res = Array_::mk();
    registerGCObj(res);

    auto dp = opendir(progPath);

    while (true) {
        dirent *ep = dp ? readdir(dp) : NULL;
        if (!ep) break;
        if (ep->d_name[0] == '.') continue;
        auto str = mkString(ep->d_name, -1);
        registerGCObj(str);
        res->head.push((TValue)str);
        unregisterGCObj(str);
    }
    if (dp) {
        closedir(dp);
    }
    unregisterGCObj(res);

    return res;
}

}
