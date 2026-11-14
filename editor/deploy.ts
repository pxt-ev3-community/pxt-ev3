/// <reference path="../node_modules/pxt-core/localtypings/pxteditor.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>

import HF2 = pxt.HF2;
import UF2 = pxtc.UF2;

import { transport, DeployTransport } from "./transport";
import { WebHidIO } from "./webhid";
import { resetBluetoothPairingDialog, resetUsbPairingDialog, showEv3ConnectionFailedDialogAsync } from "./dialogs";


export { DeployTransport };

// This comes from aux/pxt.lms
const defaultUploadProjectFolder = "BrkProg_SAVE";
// RBF template from aux/pxt.lms.
// The template contains the launcher code in hexadecimal form.
// "XX" is replaced with the hexadecimal path of the ELF file to run.
const rbfTemplate = `
4c45474f580000006d000100000000001c000000000000000e000000821b038405018130813e8053
74617274696e672e2e2e0084006080XX00448581644886488405018130813e80427965210084000a
`;

let preferredTransport = DeployTransport.None;

export function canUseWebSerial(): boolean {
    return !!(navigator as any).serial;
}

export function canUseWebHID(): boolean {
    return WebHidIO.supported();
}

export function setUseFileTransfer() {
    preferredTransport = DeployTransport.FileTransfer;
}

export function setUseUsbWebHID() {
    preferredTransport = DeployTransport.UsbWebHid;
}

export function setUseBluetoothWebSerial() {
    preferredTransport = DeployTransport.BluetoothWebSerial;
}

export function getPreferredTransport(): DeployTransport {
    return preferredTransport;
}

export async function resetDeployTransport() {
    preferredTransport = DeployTransport.None;
    await transport.disconnectAsync(true);
}

export function isDeployTransportSelected(): boolean {
    return preferredTransport !== DeployTransport.None;
}

export async function deployCoreAsync(resp: pxtc.CompileResult) {
    console.log(`START DEPLOY`);

    const filename = (resp.downloadFileBaseName || "pxt").replace(/^lego-/, "");
    const projectPxtJson = await (window as any).getPxtJson();
    const isFileTransfer = preferredTransport === DeployTransport.FileTransfer;
    const isUsbWebHid = preferredTransport === DeployTransport.UsbWebHid;
    const isWebSerial = preferredTransport === DeployTransport.BluetoothWebSerial;
    const uploadProjectFolder = (isWebSerial || isUsbWebHid) && projectPxtJson?.uploadProjectFolder ? projectPxtJson.uploadProjectFolder : defaultUploadProjectFolder;

    const fspath = `../prjs/${uploadProjectFolder}/`;
    // console.log(`fspath: ${fspath}`);
    const elfPath = fspath + filename + ".elf";
    const rbfPath = fspath + filename + ".rbf";

    // Build rbf
    const rbfHex = rbfTemplate.replace(/\s+/g, "").replace("XX", pxt.U.toHex(pxt.U.stringToUint8Array(elfPath)));

    const rbfBIN = pxt.U.fromHex(rbfHex);
    HF2.write16(rbfBIN, 4, rbfBIN.length);

    // Parse elf
    const origElfUF2 = UF2.parseFile(pxt.U.stringToUint8Array(ts.pxtc.decodeBase64(resp.outfiles[pxt.outputName()])));
    
    // FILE TRANSFER MODE (UF2 packaging like original pxt-ev3)
    if (isFileTransfer) {
        const mkFile = (ext: string, data?: Uint8Array) => {
            const f = UF2.newBlockFile();
            f.filename = "Projects/" + filename + ext;
            if (data) {
                UF2.writeBytes(f, 0, data);
            }

            return f;
        };

        const elfUF2 = mkFile(".elf");
        for (const b of origElfUF2) {
            UF2.writeBytes(elfUF2, b.targetAddr, b.data);
        }

        const combined = UF2.concatFiles([elfUF2, mkFile(".rbf", rbfBIN)]);
        const data = UF2.serializeFile(combined);
        resp.outfiles[pxtc.BINARY_UF2] = btoa(data);

        console.log("DEPLOY FILE READY");

        if (pxt.commands?.electronDeployAsync) return pxt.commands.electronDeployAsync(resp);
        if (pxt.commands?.saveOnlyAsync) return pxt.commands.saveOnlyAsync(resp);

        return Promise.resolve();
    }

    // DIRECT FLASH MODE (WebSerial or WebHID)
    const tickPrefix = isUsbWebHid ? "webhid" : "webserial";
    pxt.tickEvent(`${tickPrefix}.flash`);
    try {
        const wrapper = await transport.connectAsync(preferredTransport);
        
        let isEv3Connected = await wrapper.isEv3ConnectedAsync();
        if (!isEv3Connected) {
            console.log("EV3 did not respond to PING, checking if app is running or attempting stop...");
            await wrapper.tryStopRunningAppAsync();
            isEv3Connected = await wrapper.isEv3ConnectedAsync();
        }

        if (!isEv3Connected) {
            console.warn("EV3 is not responding.");
            await transport.disconnectAsync(true);
            await showEv3ConnectionFailedDialogAsync(preferredTransport);

            return;
        }

        try {
            const ev3Name = await wrapper.getEv3NameAsync();
            console.log(`Connected to EV3: ${ev3Name}`);
        } catch (e) {
            console.warn("Failed to get EV3 name, continuing deployment.", e);
        }

        const isPxtAppRunning = await wrapper.isPxtAppRunningAsync();
        if (isPxtAppRunning) {
            await wrapper.stopAsync();
        }
        await wrapper.rmAsync(elfPath); // Remove old file of the program
        await wrapper.flashAsync(elfPath, UF2.readBytes(origElfUF2, 0, origElfUF2.length * 256));
        await wrapper.flashAsync(rbfPath, rbfBIN);
        await wrapper.runAsync(rbfPath);

        console.log("DEPLOY FINISHED");

        pxt.tickEvent(`${tickPrefix}.success`);
    } catch (e: any) {
        if (e?.message === "NO_PORT_SELECTED" || e?.message === "NO_DEVICE_SELECTED") {
            await resetDeployTransport();
            resetBluetoothPairingDialog();
            resetUsbPairingDialog();
            console.warn(`${isUsbWebHid ? "USB" : "Bluetooth"} download cancelled: no device/port was selected.`);
            
            return;
        }
        if (e?.message === "PORT_OPEN_FAILED") {
            await resetDeployTransport();
            resetBluetoothPairingDialog();
        }

        pxt.tickEvent(`${tickPrefix}.fail`);
        throw e;
    }
}
