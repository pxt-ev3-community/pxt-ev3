import * as React from "react";

import { 
    canUseWebSerial, 
    canUseWebHID,
    setUseFileTransfer, 
    setUseUsbWebHID,
    setUseBluetoothWebSerial, 
    resetDeployTransport, 
    DeployTransport 
} from "./deploy";
import { projectView } from "./extension";


export enum ConnectionFailedAction {
    Cancel,
    Retry,
    ReselectDevice
}

let skipFileTransferDialog = false;
let skipUsbPairingDialog = false;
let skipBluetoothPairingDialog = false;

let confirmAsync: (options: any) => Promise<number>;

export function setConfirmAsync(fn: (options: any) => Promise<number>) {
    confirmAsync = fn;
}

export function resetFileTransferDialog() {
    skipFileTransferDialog = false;
}

export function resetUsbPairingDialog() {
    skipUsbPairingDialog = false;
}

export function resetBluetoothPairingDialog() {
    skipBluetoothPairingDialog = false;
}

export function showDownloadDialogAsync(projectName: string): Promise<void> {
    if (!confirmAsync) return Promise.resolve();

    // https://msdn.microsoft.com/en-us/library/cc848897.aspx
    // "For security reasons, data URIs are restricted to downloaded resources.
    // Data URIs cannot be used for navigation, for scripting, or to populate frame or iframe elements"
    const downloadFile = !pxt.BrowserUtils.isIE() && !pxt.BrowserUtils.isEdge();
    const docUrl = pxt.appTarget.appTheme.usbDocs ? pxt.appTarget.appTheme.usbDocs : false;
    let selectedTransport = DeployTransport.None;

    const jsx =
        <div className="ui grid stackable">
            <div className="column five wide download-hint">
                <div className="ui header">{lf("First time here?")}</div>
                <strong style={{ fontSize: "small" }}>{lf("You must have version 1.10E or above of the firmware")}</strong>
                <div style={{ justifyContent: "center", display: "flex", padding: "1rem" }}>
                    <img className="ui image" src="/static/download/firmware.png" style={{ height: "100px" }} />
                </div>
                <a href="/troubleshoot" target="_blank">{lf("Check your firmware version here and update if needed")}</a>
            </div>
            <div className="eleven wide column">
                <div className="ui grid download-options">
                    <div className="row">
                        <div className="sixteen wide column">
                            <div className="download-step">
                                <span className="ui yellow circular label">1</span>
                                <div className="download-step-content">
                                    <strong>{lf("File Transfer")}</strong>
                                    <p>{lf("This is the standard way to transfer a program to your EV3. Download the program as a file and transfer it to the EV3 manually. The program is saved to the standard folder.")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="sixteen wide column">
                            <div className="download-step">
                                <span className="ui yellow circular label">2</span>
                                <div className="download-step-content">
                                    <strong>{lf("USB")}</strong>
                                    <p>{lf("Upload the program directly to your EV3 over a USB cable connection using WebHID.")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="sixteen wide column">
                            <div className="download-step">
                                <span className="ui yellow circular label">3</span>
                                <div className="download-step-content">
                                    <strong>{lf("Bluetooth")}</strong>
                                    <p>{lf("Upload the program directly to your EV3 over a Bluetooth connection using Web Serial.")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row">
                        <div className="sixteen wide column" style={{ color: "var(--pxt-neutral-foreground1, #5e5e5e)", paddingTop: "0.5rem" }}>
                            <i className="info circle icon" /> {lf("To change the upload method, click the '...' button next to 'Download' and select 'Upload method'.")}
                        </div>
                    </div>
                </div>
            </div>
        </div>;

    return confirmAsync({
        header: lf("Download to your EV3"),
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: true,
        className: 'downloaddialog',
        buttons: [
            downloadFile && {
                label: projectName + ".uf2",
                icon: "download",
                className: "lightgrey focused",
                onclick: () => {
                    selectedTransport = DeployTransport.FileTransfer;
                }
            }, canUseWebHID() && {
                label: lf("USB"),
                icon: "usb",
                className: "usb focused",
                onclick: () => {
                    selectedTransport = DeployTransport.UsbWebHid;
                }
            }, canUseWebSerial() && {
                label: lf("Bluetooth"),
                icon: "bluetooth",
                className: "bluetooth focused",
                onclick: () => {
                    selectedTransport = DeployTransport.BluetoothWebSerial;
                }
            }, docUrl && {
                label: lf("Help"),
                icon: "help",
                className: "lightgrey",
                url: docUrl
            }
        ].filter(Boolean)
        //timeout: 20000
    }).then(() => {
        switch (selectedTransport) {
            case DeployTransport.FileTransfer:
                pxt.tickEvent("upload.fileTransfer");
                setUseFileTransfer();

                return projectView.compile();
            case DeployTransport.UsbWebHid:
                pxt.tickEvent("upload.usbhid");
                setUseUsbWebHID();

                return showUsbPairingDialogAsync()
                    .then(shouldContinue => {
                    if (!shouldContinue) {
                        pxt.tickEvent("upload.cancel");
                        resetDeployTransport();
                        resetFileTransferDialog();
                        resetBluetoothPairingDialog();
                        resetUsbPairingDialog();
                        return;
                    }

                    return projectView.compile();
                });
            case DeployTransport.BluetoothWebSerial:
                pxt.tickEvent("upload.bluetooth");
                setUseBluetoothWebSerial();
                
                return showBluetoothPairingDialogAsync()
                    .then(shouldContinue => {
                    if (!shouldContinue) {
                        pxt.tickEvent("upload.cancel");
                        resetDeployTransport();
                        resetFileTransferDialog();
                        resetBluetoothPairingDialog();
                        resetUsbPairingDialog();
                        return;
                    }

                    return projectView.compile();
                });
            default:
                return;
        }
    });
}

export function showFileTransferDialogAsync(fn: string, url: string, _confirmAsync: (options: any) => Promise<number>): Promise<void> {
    if (!confirmAsync || skipFileTransferDialog) return Promise.resolve();

    const jsx = (
        <div className="ui two column grid stackable" style={{ padding: "0.5rem 0.5rem 0" }}>
            <div className="column">
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    <img
                        className="ui medium rounded image"
                        src="/static/download/connect.svg"
                        style={{
                            height: "109px",
                            width: "261px",
                            display: "inline-block"
                        }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.1em" }}>1</span>
                    <div>
                        <strong>
                            {lf("Connect the EV3 to your computer with a USB cable")}
                        </strong>
                        <div style={{ fontSize: "14px", marginTop: "0.25rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {lf("Use the miniUSB port on the top of the EV3 Brick")}
                        </div>
                    </div>
                </div>
            </div>

            <div className="column">
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    <img
                        className="ui medium rounded image"
                        src="/static/download/transfer.svg"
                        style={{
                            height: "109px",
                            width: "261px",
                            display: "inline-block"
                        }}
                    />
                </div>

                <div style={{ display: "flex", alignItems: "flex-start" }}>
                    <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.1em" }}>2</span>
                    <div>
                        <strong>
                            {lf("Move the .uf2 file to the EV3 Brick")}
                        </strong>
                        <div style={{ fontSize: "14px", marginTop: "0.25rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {lf("Locate the downloaded .uf2 file and drag it to the EV3 USB drive")}
                        </div>
                    </div>
                </div>
            </div>

            <div className="sixteen wide column" style={{ paddingTop: "1.25rem" }}>
                <div className="ui toggle checkbox">
                    <input
                        type="checkbox"
                        onChange={e => {
                            skipFileTransferDialog = e.currentTarget.checked;
                        }}
                    />
                    <label>{lf("Don't show this again")}</label>
                </div>
            </div>
        </div>
    );

    return _confirmAsync({
        header: lf("File Transfer"),
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("Done"),
        agreeIcon: "checkmark",
        className: "downloaddialog",
        buttons: [
            {
                label: lf("Download Again"),
                icon: "download",
                className: "lightgrey",
                url,
                fileName: fn
            }
        ]
    }).then(() => {
        // Pass
    });
}

export async function showUsbPairingDialogAsync(): Promise<boolean> {
    if (!confirmAsync || skipUsbPairingDialog) return Promise.resolve(true);

    const docUrl = pxt.appTarget.appTheme.usbDocs ? pxt.appTarget.appTheme.usbDocs : false;

    const jsx = (
        <div style={{ padding: "0.25rem 0" }}>
            <p style={{ marginBottom: "1rem" }}>
                {lf("USB download uses WebHID. Your browser will ask for permission to connect to your EV3 brick.")}
            </p>

            <div className="ui two column grid stackable" style={{ alignItems: "center" }}>
                <div className="six wide column" style={{ textAlign: "center" }}>
                    <img
                        className="ui image"
                        src="/static/download/connect.svg"
                        style={{
                            maxHeight: "115px",
                            maxWidth: "100%",
                            margin: "0 auto",
                            display: "inline-block"
                        }}
                    />
                </div>

                <div className="ten wide column">
                    <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                        <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>1</span>
                        <div>
                            <strong>{lf("Connect EV3 brick")}</strong>
                            <div style={{ marginTop: "0.25rem" }}>
                                {lf("Connect the miniUSB cable to the PC port on top of the EV3 and make sure the brick is turned on. When connected,")} <strong>'USB'</strong> {lf("appears next to the battery icon on the brick screen.")}
                            </div>
                            <div style={{ marginTop: "0.35rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                                {lf("If")} <strong>'Port View'</strong> {lf("or other apps (e.g.,")} <strong>'Motor Control'</strong>{lf(") are open on the EV3, close them before downloading.")}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                        <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                        <div>
                            <strong>{lf("Select device in browser")}</strong>
                            <div style={{ marginTop: "0.25rem" }}>
                                {lf("When prompted by the browser, select")} <strong>'Xfer data to and from EV3 brick'</strong> {lf("and click")} <strong>'Connect'</strong>.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: "1.5rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                <i className="info circle icon" /> {lf("USB allows uploading to a custom folder specified in 'Project Settings'.")}
            </div>

            <div style={{ marginTop: "1.5rem" }}>
                <div className="ui toggle checkbox">
                    <input
                        type="checkbox"
                        onChange={e => {
                            skipUsbPairingDialog = e.currentTarget.checked;
                        }}
                    />
                    <label>{lf("Don't show this again")}</label>
                </div>
            </div>
        </div>
    );

    return confirmAsync({
        header: lf("USB WebHID connection"),
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("Connect"),
        agreeIcon: "usb",
        className: "downloaddialog",
        buttons: [
            docUrl && {
                label: lf("Help"),
                icon: "question circle",
                className: "lightgrey",
                url: docUrl
            }
        ].filter(Boolean)
    }).then(result => result === 1);
}

async function showBluetoothPairingDialogAsync(): Promise<boolean> {
    if (!confirmAsync || skipBluetoothPairingDialog) return Promise.resolve(true);

    const jsx = (
        <div style={{ padding: "0.25rem 0" }}>
            <p style={{ marginBottom: "1.2rem" }}>
                {lf("Bluetooth download uses Web Serial. Your browser will ask you to select a serial port.")}
            </p>

            <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>1</span>
                <div>
                    <strong>{lf("Turn on and pair EV3")}</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                        {lf("Make sure your EV3 is turned on and already paired with your computer in Bluetooth settings.")}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                <div>
                    <strong>{lf("Close conflicting apps")}</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                        {lf("Close applications that may be using the Bluetooth connection, such as")} <strong>'EV3 Lab'</strong>, <strong>'EV3 Classroom'</strong>, {lf("or other editor tabs (BrickCode). If")} <strong>'Port View'</strong> {lf("or other apps (e.g.,")} <strong>'Motor Control'</strong>{lf(") are open on the EV3 brick, close them before downloading.")}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>3</span>
                <div>
                    <strong>{lf("Select EV3 port in browser")}</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                        {lf("When prompted by the browser, select the serial port with the name of your EV3.")}
                    </div>
                    {pxt.BrowserUtils.isWindows() && (
                        <div style={{ marginTop: "0.35rem", fontSize: "14px", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {lf("On Windows, if your EV3 name is not shown, select the outgoing Bluetooth COM port assigned to your EV3 in Bluetooth COM Ports settings.")}
                        </div>
                    )}
                    <div style={{ marginTop: "0.35rem", fontSize: "14px", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                        {lf("Do not select unrelated COM ports or USB devices. If the EV3 does not respond, try selecting a different Bluetooth serial port.")}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: "1.5rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                <i className="info circle icon" /> {lf("Bluetooth allows uploading to a custom folder specified in 'Project Settings'.")}
            </div>

            <div style={{ marginTop: "1.5rem" }}>
                <div className="ui toggle checkbox">
                    <input
                        type="checkbox"
                        onChange={e => {
                            skipBluetoothPairingDialog = e.currentTarget.checked;
                        }}
                    />
                    <label>{lf("Don't show this again")}</label>
                </div>
            </div>
        </div>
    );
    
    return confirmAsync({
        header: lf("Bluetooth Web Serial connection"),
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("Connect"),
        agreeIcon: "bluetooth",
        className: "downloaddialog",
        buttons: [{
            label: lf("Help"),
            icon: "question circle",
            className: "lightgrey",
            url: "/bluetooth"
        }]
    }).then(result => result === 1);
}

export function showEv3ConnectionFailedDialogAsync(transportType?: DeployTransport): Promise<ConnectionFailedAction> {
    if (!confirmAsync) return Promise.resolve(ConnectionFailedAction.Cancel);

    const isUsb = transportType === DeployTransport.UsbWebHid;
    let selectedAction = ConnectionFailedAction.Cancel;

    const jsx = (
        <div>
            <p style={{ marginBottom: "1.2rem" }}>
                {isUsb
                    ? lf("EV3 was not recognized or is still connecting. Windows may take a few seconds to configure the USB device after connecting.")
                    : lf("EV3 was not found on Bluetooth. Make sure Bluetooth is turned on and EV3 is paired with your computer.")}
            </p>

            <div>
                {isUsb ? (
                    <div>
                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">1</span>
                            <div>
                                <strong>{lf("Just reconnected?")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("Wait 2–3 seconds for Windows to detect the brick, then click 'Retry'.")}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">2</span>
                            <div>
                                <strong>{lf("Check the cable")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("Make sure the miniUSB cable is firmly plugged into the PC port on the top of the EV3 and into your computer.")}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">3</span>
                            <div>
                                <strong>{lf("Check EV3 power")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("Verify that the EV3 brick is turned on and ready.")}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">1</span>
                            <div>
                                <strong>{lf("Check pairing")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("Make sure the EV3 is paired with your computer in Windows Bluetooth settings.")}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">2</span>
                            <div>
                                <strong>{lf("Close other apps")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("Close EV3 Lab, EV3 Classroom, or other browser tabs that may be using the Bluetooth serial connection.")}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label">3</span>
                            <div>
                                <strong>{lf("Close Port View")}</strong>
                                <br />
                                <span style={{ fontSize: "14px" }}>
                                    {lf("If 'Port View' is open on the EV3 brick, close it before downloading.")}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ marginTop: "1.2rem", paddingTop: "0.8rem", borderTop: "1px solid #e0e0e0", fontSize: "small", color: "#666" }}>
                <i className="repeat icon" /> <strong>{lf("Retry:")}</strong> {lf("Attempt to reconnect to the already approved device.")}
                <br />
                <i className="exchange icon" /> <strong>{lf("Reselect device:")}</strong> {lf("Open browser dialog to pick the EV3 again.")}
            </div>
        </div>
    );

    return confirmAsync({
        header: lf("Could not connect to EV3"),
        className: "downloaddialog",
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("Retry"),
        agreeIcon: "repeat",
        jsx,
        buttons: [
            {
                label: lf("Reselect device"),
                icon: "exchange",
                className: "lightgrey",
                onclick: () => {
                    selectedAction = ConnectionFailedAction.ReselectDevice;
                }
            }
        ]
    }).then(result => {
        if (selectedAction === ConnectionFailedAction.ReselectDevice) {
            return ConnectionFailedAction.ReselectDevice;
        }
        if (result === 1) {
            return ConnectionFailedAction.Retry;
        }
        return ConnectionFailedAction.Cancel;
    });
}

export async function showBluetoothConnectionStuckDialogAsync(): Promise<void> {
    if (!confirmAsync) return Promise.resolve();

    await confirmAsync({
        header: lf("Bluetooth connection stuck"),
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("OK"),
        jsx: (
            <div>
                <p>{lf("The Bluetooth connection could not be established.")}</p>
                <p>{lf("This can happen if a previous Bluetooth connection is still active or if the Bluetooth connection is temporarily unavailable.")}</p>
                <p>{lf("Stop the program on the EV3 and try again. If the problem persists, turn Bluetooth off and on again, then try again.")}</p>
            </div>
        )
    });
}
