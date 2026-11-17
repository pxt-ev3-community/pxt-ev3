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

// Standard MakeCode utility pattern for interpolating JSX elements into localized strings with {0}, {1} placeholders
function jsxLF(loc: string, ...rest: JSX.Element[]): JSX.Element[] {
    const indices: number[] = [];
    loc.replace(/\{\d\}/g, match => {
        indices.push(parseInt(match.substr(1, 1)));
        return match;
    });

    const out: JSX.Element[] = [];
    let parts: string[];
    let i = 0;

    for (const index of indices) {
        parts = loc.split(`{${index}}`);
        out.push(<span key={i++}>{parts[0]}</span>);
        out.push(<span key={i++}>{rest[index]}</span>);
        loc = parts[1];
    }
    out.push(<span key={i++}>{loc}</span>);

    return out;
}

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
                                    <p>{lf("This is the historical, standard way to transfer a program to your EV3 over USB. Download the program as a file and transfer it to the EV3 drive manually.")}</p>
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
                            <i className="info circle icon" /> {jsxLF(
                                lf("To change the upload method, click the {0} button next to {1} and select {2}."),
                                <strong>'...'</strong>,
                                <strong>'{lf("Download")}'</strong>,
                                <strong>'{lf("Upload Method")}'</strong>
                            )}
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
                        <div style={{ fontSize: "15px", marginTop: "0.25rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {lf("Use the miniUSB port on the top of the EV3 Brick.")}
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
                        <div style={{ fontSize: "15px", marginTop: "0.25rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {lf("Locate the downloaded .uf2 file and drag it to the EV3 USB drive.")}
                        </div>
                    </div>
                </div>
            </div>

            <div className="sixteen wide column" style={{ color: "var(--pxt-neutral-foreground1, #5e5e5e)", paddingTop: "1.25rem" }}>
                <i className="info circle icon" /> {jsxLF(
                    lf("The program is saved to the standard {0} folder."),
                    <strong>'BrkProg_SAVE'</strong>
                )}
            </div>

            <div className="sixteen wide column" style={{ paddingTop: "0.8rem" }}>
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
                            <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                {jsxLF(
                                    lf("Connect the miniUSB cable to the PC port on top of the EV3 and make sure the brick is turned on. When connected, {0} appears next to the battery icon on the brick screen."),
                                    <strong>'USB'</strong>
                                )}
                            </div>
                            <div style={{ fontSize: "15px", marginTop: "0.35rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                                {jsxLF(
                                    lf("If {0} or other apps (e.g., {1}) are open on the EV3, close them before downloading."),
                                    <strong>'Port View'</strong>,
                                    <strong>'Motor Control'</strong>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                        <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                        <div>
                            <strong>{lf("Select device in browser")}</strong>
                            <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                {jsxLF(
                                    lf("When prompted by the browser, select {0} and click {1}."),
                                    <strong>'Xfer data to and from EV3 brick'</strong>,
                                    <strong>'{lf("Connect")}'</strong>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: "1.5rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                <i className="info circle icon" /> {jsxLF(
                    lf("USB allows uploading to a custom folder specified in {0}."),
                    <strong>'{lf("Project Settings")}'</strong>
                )}
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
                    <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                        {lf("Make sure your EV3 is turned on and already paired with your computer in Bluetooth settings.")}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                <div>
                    <strong>{lf("Close conflicting apps and pop-ups")}</strong>
                    <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                        {jsxLF(
                            lf("Close applications that may be using the Bluetooth connection, such as {0}, {1}, or other editor tabs (BrickCode). If {2} or other apps (e.g., {3}) are open on the EV3 brick, close them before downloading."),
                            <strong>'EV3 Lab'</strong>,
                            <strong>'EV3 Classroom'</strong>,
                            <strong>'Port View'</strong>,
                            <strong>'Motor Control'</strong>
                        )}
                    </div>
                    <div style={{ fontSize: "15px", marginTop: "0.35rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                        {lf("Make sure no pop-up windows are open on the EV3, as they will prevent the downloaded app from launching.")}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>3</span>
                <div>
                    <strong>{lf("Select EV3 port in browser")}</strong>
                    <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                        {lf("When prompted by the browser, select the serial port with the name of your EV3.")}
                    </div>
                    {pxt.BrowserUtils.isWindows() && (
                        <div style={{ fontSize: "15px", marginTop: "0.35rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                            {jsxLF(
                                lf("On Windows, if your EV3 name is not shown, select the {0} port (found in: {1} > {2} > {3} > {4})."),
                                <strong>'{lf("Outgoing")}'</strong>,
                                <strong>{lf("Bluetooth & devices")}</strong>,
                                <strong>{lf("Devices")}</strong>,
                                <strong>{lf("More Bluetooth settings")}</strong>,
                                <strong>{lf("COM Ports")}</strong>
                            )}
                        </div>
                    )}
                    <div style={{ fontSize: "15px", marginTop: "0.35rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                        {lf("Do not select unrelated COM ports or USB devices. If the EV3 does not respond, try selecting a different Bluetooth serial port.")}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: "1.5rem", color: "var(--pxt-neutral-foreground1, #5e5e5e)" }}>
                <i className="info circle icon" /> {jsxLF(
                    lf("Bluetooth allows uploading to a custom folder specified in {0}."),
                    <strong>'{lf("Project Settings")}'</strong>
                )}
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
                    ? lf("EV3 was not recognized or is still connecting. Your computer may take a few seconds to configure the USB device after connecting.")
                    : lf("The serial port opened, but your EV3 is not responding. Make sure the correct serial port was selected and the EV3 is on the main menu.")}
            </p>

            <div>
                {isUsb ? (
                    <div>
                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>1</span>
                            <div>
                                <strong>{lf("Just reconnected?")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {lf("Wait 2–3 seconds for your computer to detect the brick, then click 'Retry'.")}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                            <div>
                                <strong>{lf("Check the cable")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {lf("Make sure the miniUSB cable is firmly plugged into the PC port on the top of the EV3 and into your computer.")}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>3</span>
                            <div>
                                <strong>{lf("Check EV3 power")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {lf("Verify that the EV3 brick is turned on and ready.")}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>1</span>
                            <div>
                                <strong>{lf("Check selected serial port")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {jsxLF(
                                        lf("Make sure you selected the outgoing Bluetooth serial port for your EV3 (not the incoming port or another robot). Click {0} to choose a different port."),
                                        <strong>'{lf("Reselect Device")}'</strong>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                            <div>
                                <strong>{lf("Return to main menu")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {jsxLF(
                                        lf("If {0} is open or a program was started before connecting, press the {1} button on the EV3 to return to the main menu."),
                                        <strong>'Port View'</strong>,
                                        <strong>'{lf("Back")}'</strong>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                            <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>3</span>
                            <div>
                                <strong>{lf("Close other apps")}</strong>
                                <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                                    {jsxLF(
                                        lf("Close {0}, {1}, or other browser tabs that may be using the Bluetooth serial connection."),
                                        <strong>'EV3 Lab'</strong>,
                                        <strong>'EV3 Classroom'</strong>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
                label: lf("Reselect Device"),
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

export function showBluetoothConnectionStuckDialogAsync(): Promise<ConnectionFailedAction> {
    if (!confirmAsync) return Promise.resolve(ConnectionFailedAction.Cancel);

    let selectedAction = ConnectionFailedAction.Cancel;

    const jsx = (
        <div>
            <p style={{ marginBottom: "1.2rem" }}>
                {lf("Could not open the Bluetooth connection with your EV3. The brick may be turned off, Bluetooth may be disabled, or the connection timed out.")}
            </p>

            <div>
                <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                    <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>1</span>
                    <div>
                        <strong>{lf("Check EV3 power and Bluetooth")}</strong>
                        <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                            {lf("Make sure your EV3 brick is turned on, in range, and Bluetooth is enabled in the EV3 settings.")}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                    <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>2</span>
                    <div>
                        <strong>{lf("Check or redo pairing")}</strong>
                        <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                            {jsxLF(
                                lf("Check {0} > {1} > {2} on your EV3. If your computer is not listed, or if EV3 asks {3}, the pairing was lost. Remove EV3 in your computer's Bluetooth settings and pair it again."),
                                <strong>Settings</strong>,
                                <strong>Bluetooth</strong>,
                                <strong>Connections</strong>,
                                <strong>'Connect?'</strong>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: "0.9rem", display: "flex", alignItems: "flex-start" }}>
                    <span className="ui yellow circular label" style={{ flexShrink: 0, marginTop: "0.15em" }}>3</span>
                    <div>
                        <strong>{lf("Restart Bluetooth")}</strong>
                        <div style={{ fontSize: "15px", marginTop: "0.25rem" }}>
                            {jsxLF(
                                lf("Turn Bluetooth off and on in the EV3 settings or on your computer to reset the radio channel, then click {0}."),
                                <strong>'{lf("Retry")}'</strong>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return confirmAsync({
        header: lf("Could not connect over Bluetooth"),
        className: "downloaddialog",
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("Retry"),
        agreeIcon: "repeat",
        jsx,
        buttons: [
            {
                label: lf("Reselect Device"),
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
