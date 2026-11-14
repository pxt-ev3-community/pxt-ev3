/**
 * See
 * https://www.lego.com/cdn/cs/set/assets/blt6879b00ae6951482/LEGO_MINDSTORMS_EV3_Communication_Developer_Kit.pdf
 * https://github.com/mindboards/ev3sources/blob/master/lms2012/lms2012/source/bytecodes.h#L146
 */

import HF2 = pxt.HF2;
import U = pxt.U;


export interface DirEntry {
    name: string;
    md5?: string;
    size?: number;
}

const runTemplate = "C00882010084XX0060640301606400";

const usbRfcommMagic = 0x3d3f; // Magic value identifying custom packets

const directCommand = 0x00; // Command Type: Direct command, reply required
const systemCommand = 0x01; // Command Type: System command, reply required
const directCommandNoReply = 0x80; // Command Type: Direct command, reply not required
const customCommand = 0x3f; // Command Type: Custom command

const directCommandReply = 0x02; // Reply type: Direct command reply
const systemCommandReply = 0x03; // Reply type: System command reply OK
const directCommandReplyError = 0x04; // // Reply type: Direct command reply ERROR
const systemCommandReplyError = 0x05; // Reply type: System command reply ERROR

const rfcommPxtAppPingCommand = 0x0003; // RFCOMM command: ping PXT app
const rfcommPxtAppStopCommand = 0x0002; // RFCOMM command: stop PXT app

const vmBrickNameSize = 120; // Maximum size of the EV3 brick name in VM memory

const opNop = 0x01; // LEGO VM opcode: No operation
const opComGet = 0xD3; // System command: Get
const getBrickName = 0x0D; // GET subcode Get brick name


function log(msg: string) {
    pxt.log("SERIAL: " + msg);
}


export class Ev3Wrapper {
    msgs = new U.PromiseBuffer<Uint8Array>()
    private cmdSeq = U.randomUint32() & 0xffff;
    private lock = new U.PromiseQueue();
    isStreaming = false;
    dataDump = /talkdbg=1/.test(window.location.href);

    constructor(public io: pxt.packetio.PacketIO) {
        io.onData = buf => {
            buf = buf.slice(0, HF2.read16(buf, 0) + 2);
            if (HF2.read16(buf, 4) == usbRfcommMagic) {
                let code = HF2.read16(buf, 6);
                let payload = buf.slice(8);
                if (code == 1) {
                    let str = U.uint8ArrayToString(payload);
                    if (U.isNodeJS) {
                        pxt.debug("SERIAL: " + str.replace(/\n+$/, ""));
                    } else {
                        window.postMessage({
                            type: 'SERIAL',
                            id: 'n/a', // TODO?
                            data: str
                        }, "*");
                    }
                } else {
                    pxt.debug("Magic: " + code + ": " + U.toHex(payload));
                }

                return;
            }
            if (this.dataDump) {
                log("RECV: " + U.toHex(buf));
            }
            this.msgs.push(buf);
        }
    }

    private allocCore(addSize: number, replyType: number) {
        let len = 5 + addSize;
        let buf = new Uint8Array(len);
        HF2.write16(buf, 0, len - 2); // pktLen
        HF2.write16(buf, 2, this.cmdSeq++); // msgCount
        buf[4] = replyType;

        return buf;
    }

    private allocSystem(addSize: number, cmd: number, replyType = 1) {
        let buf = this.allocCore(addSize + 1, replyType);
        buf[5] = cmd;

        return buf;
    }

    allocCustom(code: number, addSize = 0) {
        let buf = this.allocCore(1 + 2 + addSize, 0);
        HF2.write16(buf, 4, usbRfcommMagic);
        HF2.write16(buf, 6, code);

        return buf;
    }

    stopAsync(): Promise<void> {
        log(`PXT app is running, sending stop command`);

        const buf = this.allocCustom(rfcommPxtAppStopCommand);
        return this.talkAsync(buf, 0, 1500)
            .catch(err => {
                log(`PXT app stop command not acknowledged, sending fallback: ${err}`);
                return this.justSendAsync(buf);
            })
            .then(() => {
                log(`PXT app stop command completed`);
                return pxt.U.delay(600);
            });
    }

    async tryStopRunningAppAsync(): Promise<boolean> {
        log("Attempting to stop running PXT app...");
        const buf = this.allocCustom(rfcommPxtAppStopCommand);
        try {
            await this.talkAsync(buf, 0, 1000);
            log("PXT app stop acknowledged");
        } catch {
            log("PXT app stop not acknowledged, sending unacknowledged stop command");
            try {
                await this.justSendAsync(buf);
            } catch (e) {
                log("Failed to send fallback stop packet: " + e);
            }
        }
        await pxt.U.delay(600);
        return true;
    }

    isEv3ConnectedAsync(): Promise<boolean> {
        const buf = this.allocCore(3, directCommand);
        HF2.write16(buf, 5, 0x0000);
        buf[7] = opNop; // opNop

        return this.talkAsync(buf, 0, 2000)
            .then(resp => {
                if (resp[4] !== 0x02) {
                    throw new Error("INVALID_EV3_REPLY");
                }

                log("PING EV3 OK");

                return true;
            })
            .catch(() => {
                // log("EV3 is not responding");
                return false;
            });
    }

    isPxtAppRunningAsync(): Promise<boolean> {
        const buf = this.allocCustom(rfcommPxtAppPingCommand);
        return this.talkAsync(buf, 0, 500)
            .then(() => {
                log(`PXT app is responding`);

                return true;
            })
            .catch(() => {
                log(`PXT app is not responding`);

                return false;
            })
    }

    getEv3NameAsync(): Promise<string> {
        const req = this.allocCore(7, directCommand);
        HF2.write16(req, 5, vmBrickNameSize); // Global memory size
        req[7] = opComGet; // opCOM_GET
        req[8] = getBrickName; // GET_BRICKNAME
        req[9] = 0x81; // LCX(16)
        req[10] = 0x20;
        req[11] = 0x60; // GVX(0)

        return this.talkAsync(req)
            .then(resp => {
                const nameBytes = resp.slice(5, 5 + vmBrickNameSize);
                const end = nameBytes.indexOf(0);
                const name = U.uint8ArrayToString(end >= 0 ? nameBytes.slice(0, end) : nameBytes);

                // log(`EV3 name: ${name}`);
                return name;
            });
    }

    dmesgAsync() {
        log(`asking for DMESG buffer over serial`);
        let buf = this.allocCustom(3);

        return this.justSendAsync(buf);
    }

    runAsync(path: string) {
        let codeHex = runTemplate.replace("XX", U.toHex(U.stringToUint8Array(path)));
        let code = U.fromHex(codeHex);
        let pkt = this.allocCore(2 + code.length, directCommandNoReply);
        HF2.write16(pkt, 5, 0x0800);
        U.memcpy(pkt, 7, code);
        log(`run ${path}`);

        return this.justSendAsync(pkt);
    }

    justSendAsync(buf: Uint8Array) {
        return this.lock.enqueue("talk", () => {
            this.msgs.drain();
            if (this.dataDump) {
                log("SEND: " + U.toHex(buf));
            }

            return this.io.sendPacketAsync(buf);
        })
    }

    dumpInputCmd(buf : Uint8Array) {
        const replySize = HF2.read16(buf, 0);
        const msgCount = HF2.read16(buf, 2);
        const replyType = buf[4];
        const replyStatus = buf[6];
        let replyTypeMsg = "Unknown";

        switch (replyType) {
            case directCommandReply:
                replyTypeMsg = "Direct command reply";
                break;
            case systemCommandReply:
                replyTypeMsg = "System command reply OK";
                break;
            case directCommandReplyError:
                replyTypeMsg = "Direct command reply ERROR";
                break;
            case systemCommandReplyError:
                replyTypeMsg = "System command reply ERROR";
                break;
        }
        log(`Reply size: ${replySize}, Message counter: ${msgCount}, Reply type: ${replyType} (${replyTypeMsg})`);
        
        switch (replyStatus) {
            case 0x00:
                log("Reply Status SUCCESS");
                break;
            case 0x01:
                log("Reply Status UNKNOWN_HANDLE");
                break;
            case 0x02:
                log("Reply Status HANDLE_NOT_READY");
                break;
            case 0x03:
                log("Reply Status CORRUPT_FILE");
                break;
            case 0x04:
                log("Reply Status NO_HANDLES_AVAILABLE");
                break;
            case 0x05:
                log("Reply Status NO_PERMISSION");
                break;
            case 0x06:
                log("Reply Status ILLEGAL_PATH");
                break;
            case 0x07:
                log("Reply Status FILE_EXISTS");
                break;
            case 0x08:
                log("Reply Status END_OF_FILE");
                break;
            case 0x09:
                log("Reply Status SIZE_ERROR");
                break;
            case 0x0A:
                log("Reply Status UNKNOWN_ERROR");
                break;
            case 0x0B:
                log("Reply Status ILLEGAL_FILENAME");
                break;
            case 0x0C:
                log("Reply Status ILLEGAL_CONNECTION");
                break;
        }
    }

    dumpOutputCmd(buf: Uint8Array) {
        const commandSize = HF2.read16(buf, 0);
        const msgCount = HF2.read16(buf, 2);
        const commandType = buf[4];
        const command = buf[5];
        const magic = HF2.read16(buf, 4);
        let commandTypeMsg = "Unknown";

        switch (commandType) {
            case directCommand:
                commandTypeMsg = "Direct command, reply required";
                break;
            case systemCommand:
                commandTypeMsg = "System command, reply required";
                break;
            case directCommandNoReply:
                commandTypeMsg = "Direct command, reply not required";
                break;
            case customCommand:
                commandTypeMsg = magic == usbRfcommMagic ? "Custom command" : "Unknown";
                break;
        }

        log(`Command size: ${commandSize}, Message counter: ${msgCount}, Command type: ${commandType} (${commandTypeMsg})`);

        if (magic == usbRfcommMagic) {
            const code = HF2.read16(buf, 6);
            switch (code) {
                case rfcommPxtAppStopCommand:
                    log(`RFCOMM command: Stop PXT app`);
                    break;
                case rfcommPxtAppPingCommand:
                    log(`RFCOMM command: Ping PXT app`);
                    break;
                default:
                    log(`RFCOMM command: Unknown (${code})`);
                    break;
            }
            return;
        }

        switch (command) {
            case 0x92:
                log("System command: Begin file download");
                break;
            case 0x93:
                log("System command: Continue file download");
                break;
            case 0x94:
                log("System command: Begin file upload");
                break;
            case 0x95:
                log("System command: Continue file upload");
                break;
            case 0x96:
                log("System command: Begin get bytes from a file (while writing to the file)");
                break;
            case 0x97:
                log("System command: Continue get byte from a file (while writing to the file)");
                break;
            case 0x98:
                log("System command: Close file handle");
                break;
            case 0x99:
                log("System command: List files");
                break;
            case 0x9A:
                log("System command: Continue list files");
                break;
            case 0x9B:
                log("System command: Create directory");
                break;
            case 0x9C:
                log("System command: Delete");
                break;
            case 0x9D:
                log("System command: List handles");
                break;
            case 0x9E:
                log("System command: Write to mailbox");
                break;
            case 0x9F:
                log("System command: Transfer trusted pin code to brick");
                break;
            case 0xA0:
                log("System command: Restart the brick in Firmware update mode");
                break;
        }
    }

    talkAsync(buf: Uint8Array, altResponse = 0, timeout = 5000) {
        return this.lock.enqueue("talk", () => {
            this.msgs.drain();
            if (this.dataDump) {
                log("TALK: " + U.toHex(buf));
            }
            this.dumpOutputCmd(buf);

            return this.io.sendPacketAsync(buf)
                .then(() => {
                    return this.msgs.shiftAsync(timeout);
                })
                .then(resp => {
                    this.dumpInputCmd(resp);
                    if (resp[2] != buf[2] || resp[3] != buf[3]) {
                        U.userError("msg count de-sync");
                    }
                    if (buf[4] == 1) {
                        if (altResponse != -1 && resp[5] != buf[5]) {
                            U.userError("cmd de-sync");
                        }
                        if (altResponse != -1 && resp[6] != 0 && resp[6] != altResponse) {
                            U.userError("cmd error: " + resp[6]);
                        }
                    }

                    return resp;
                });
        })
    }

    flashAsync(path: string, file: Uint8Array) {
        log(`Write ${file.length} bytes to ${path}`);

        let handle = -1;
        let loopAsync = (pos: number): Promise<void> => {
            if (pos >= file.length) return Promise.resolve();

            let size = file.length - pos;
            if (size > 1000) {
                size = 1000;
            }
            let upl = this.allocSystem(1 + size, 0x93, 0x1);
            upl[6] = handle;
            U.memcpy(upl, 6 + 1, file, pos, size);

            return this.talkAsync(upl, 8) // 8=EOF
                .then(() => loopAsync(pos + size));
        }

        let begin = this.allocSystem(4 + path.length + 1, 0x92);
        HF2.write32(begin, 6, file.length); // fileSize
        U.memcpy(begin, 10, U.stringToUint8Array(path));

        return this.lock.enqueue("file", () =>
            this.talkAsync(begin)
                .then(resp => {
                    handle = resp[7];

                    return loopAsync(0);
                }));
    }

    lsAsync(path: string): Promise<DirEntry[]> {
        let lsReq = this.allocSystem(2 + path.length + 1, 0x99);
        HF2.write16(lsReq, 6, 1024); // maxRead
        U.memcpy(lsReq, 8, U.stringToUint8Array(path));

        return this.talkAsync(lsReq, 8)
            .then(resp =>
                U.uint8ArrayToString(resp.slice(12))
                    .split(/\n/)
                    .filter(s => !!s)
                    .map(s => {
                        let m = /^([A-F0-9]+) ([A-F0-9]+) ([^\/]*)$/.exec(s);

                        if (m) {
                            return {
                                md5: m[1],
                                size: parseInt(m[2], 16),
                                name: m[3]
                            };
                        }

                        return {
                            name: s.replace(/\/$/, "")
                        };
                    })
            );
    }

    rmAsync(path: string): Promise<void> {
        log(`rm ${path}`);
        let rmReq = this.allocSystem(path.length + 1, 0x9c);
        U.memcpy(rmReq, 6, U.stringToUint8Array(path));

        return this.talkAsync(rmReq, 5)
            .then(resp => {});
    }

    private streamFileOnceAsync(path: string, cb: (d: Uint8Array) => void) {
        let fileSize = 0;
        let filePtr = 0;
        let handle = -1;
        let resp = (buf: Uint8Array): Promise<void> => {
            if (buf[6] == 2) { // Handle not ready - file is missing
                this.isStreaming = false;

                return Promise.resolve();
            }

            if (buf[6] != 0 && buf[6] != 8) {
                U.userError("bad response when streaming file: " + buf[6] + " " + U.toHex(buf));
            }

            this.isStreaming = true;
            fileSize = HF2.read32(buf, 7);
            if (handle == -1) {
                handle = buf[11];
                log(`stream on, handle=${handle}`);
            }
            let data = buf.slice(12);
            filePtr += data.length;
            if (data.length > 0) {
                cb(data);
            }

            if (buf[6] == 8) { // End of file
                this.isStreaming = false;

                return this.rmAsync(path);
            }

            let contFileReq = this.allocSystem(1 + 2, 0x97);
            HF2.write16(contFileReq, 7, 1000); // maxRead
            contFileReq[6] = handle;
            
            return pxt.U.delay(data.length > 0 ? 0 : 500)
                .then(() => this.talkAsync(contFileReq, -1))
                .then(resp);
        }

        let getFileReq = this.allocSystem(2 + path.length + 1, 0x96);
        HF2.write16(getFileReq, 6, 1000); // maxRead
        U.memcpy(getFileReq, 8, U.stringToUint8Array(path));

        return this.talkAsync(getFileReq, -1).then(resp);
    }

    streamFileAsync(path: string, cb: (d: Uint8Array) => void) {
        let loop = (): Promise<void> =>
            this.lock.enqueue("file", () =>
                this.streamFileOnceAsync(path, cb))
                .then(() => pxt.U.delay(500))
                .then(loop);

        return loop();
    }

    downloadFileAsync(path: string, cb: (d: Uint8Array) => void) {
        return this.lock.enqueue("file", () =>
            this.streamFileOnceAsync(path, cb));
    }

    private initAsync() {
        return Promise.resolve();
    }

    private resetState() {
        // Pass
    }

    reconnectAsync(first = false): Promise<void> {
        this.resetState();
        if (first) return this.initAsync();
        
        log(`Reconnect`);

        return this.io.reconnectAsync()
            .then(() => this.initAsync());
    }

    disconnectAsync() {
        log(`Disconnect`);

        return this.io.disconnectAsync();
    }
}