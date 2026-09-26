import * as React from "react";

import { canUseWebSerial, setUseFileTransfer, setUseBluetoothWebSerial, resetDeployTransport } from "./deploy";
import { projectView } from "./extension";


enum UploadMethod {
    None,
    FileTransfer,
    // HID,
    Bluetooth
}

let skipFileTransferDialog = false;
let skipBluetoothPairingDialog = false;

let confirmAsync: (options: any) => Promise<number>;

export function setConfirmAsync(fn: (options: any) => Promise<number>) {
    confirmAsync = fn;
}

export function resetFileTransferDialog() {
    skipFileTransferDialog = false;
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
    let selectedTransport = UploadMethod.None;

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
                <div className="ui grid">
                    <div className="row">
                        <div className="sixteen wide column">
                            <span className="ui yellow circular label" style={{ marginRight: "0.75em" }}>1</span>
                            <strong>{lf("File Transfer")}</strong>
                            <p>{lf("This is the standard way to transfer a program to your EV3. Download the program as a file and transfer it to the EV3 manually.")}</p>
                        </div>
                    </div>
                    <div className="row">
                        <div className="sixteen wide column">
                            <span className="ui yellow circular label" style={{ marginRight: "0.75em" }}>2</span>
                            <strong>{lf("Bluetooth")}</strong>
                            <p>{lf("Upload the program directly to your EV3 over a Bluetooth connection using Web Serial.")}</p>
                        </div>
                    </div>
                    <div className="row">
                        <div className="sixteen wide column">
                            <span className="ui green circular label" style={{ marginRight: "0.75em" }}>!</span>
                            <strong>{lf("Note")}</strong>
                            <p>{lf("To change the upload method, click the '...' button next to Download and select 'Upload method'.")}</p>
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
        hideAgree: false,
        agreeLbl: lf("I got it"),
        className: 'downloaddialog',
        buttons: [
            canUseWebSerial() && {
                label: lf("Bluetooth"),
                icon: "bluetooth",
                className: "bluetooth focused",
                onclick: () => {
                    selectedTransport = UploadMethod.Bluetooth;
                }
            }, downloadFile && {
                label: projectName + ".uf2",
                icon: "download",
                className: "lightgrey focused",
                onclick: () => {
                    selectedTransport = UploadMethod.FileTransfer;
                }
            }, docUrl && {
                label: lf("Help"),
                icon: "help",
                className: "lightgrey",
                url: docUrl
            }
        ]
        //timeout: 20000
    }).then(() => {
        switch (selectedTransport) {
            case UploadMethod.FileTransfer:
                pxt.tickEvent("upload.fileTransfer");
                setUseFileTransfer();

                return projectView.compile();
            case UploadMethod.Bluetooth:
                pxt.tickEvent("upload.bluetooth");
                setUseBluetoothWebSerial();
                
                return showBluetoothPairingDialogAsync()
                    .then(shouldContinue => {
                    if (!shouldContinue) {
                        pxt.tickEvent("upload.cancel");
                        resetDeployTransport();
                        resetFileTransferDialog();
                        resetBluetoothPairingDialog();
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
        <div className="ui grid stackable">
            <div className="column five wide download-hint">
                <div className="ui header">
                    {lf("First time here?")}
                </div>

                <strong style={{ fontSize: "small" }}>
                    {lf("You must have version 1.10E or above of the firmware")}
                </strong>

                <div style={{
                    justifyContent: "center",
                    display: "flex",
                    padding: "1rem"
                }}>
                    <img
                        className="ui image"
                        src="/static/download/firmware.png"
                        style={{ height: "100px" }}
                    />
                </div>

                <a href="/troubleshoot" target="_blank">
                    {lf("Check your firmware version here and update if needed")}
                </a>
            </div>

            <div className="column eleven wide">
                <div className="ui grid">
                    <div className="row">
                        <div className="column">
                            <div className="ui two column grid padded">
                                <div className="column">
                                    <div className="ui">
                                        <div className="image">
                                            <img
                                                className="ui medium rounded image"
                                                src="/static/download/connect.svg"
                                                style={{
                                                    height: "109px",
                                                    width: "261px",
                                                    marginBottom: "1rem"
                                                }}
                                            />
                                        </div>

                                        <div className="content">
                                            <div className="description">
                                                <span className="ui yellow circular label">1</span>
                                                <strong>
                                                    {lf("Connect the EV3 to your computer with a USB cable")}
                                                </strong>
                                                <br />
                                                <span style={{ fontSize: "small" }}>
                                                    {lf("Use the miniUSB port on the top of the EV3 Brick")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="column">
                                    <div className="ui">
                                        <div className="image">
                                            <img
                                                className="ui medium rounded image"
                                                src="/static/download/transfer.svg"
                                                style={{
                                                    height: "109px",
                                                    width: "261px",
                                                    marginBottom: "1rem"
                                                }}
                                            />
                                        </div>

                                        <div className="content">
                                            <div className="description">
                                                <span className="ui yellow circular label">2</span>
                                                <strong>
                                                    {lf("Move the .uf2 file to the EV3 Brick")}
                                                </strong>
                                                <br />
                                                <span style={{ fontSize: "small" }}>
                                                    {lf("Locate the downloaded .uf2 file and drag it to the EV3 USB drive")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="row" style={{ paddingTop: 0 }}>
                        <div className="column">
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
    }).then(() => {});
}

async function showBluetoothPairingDialogAsync(): Promise<boolean> {
    if (!confirmAsync || skipBluetoothPairingDialog) return Promise.resolve(true);

    const jsx = (
        <div>
            <p>{lf("Bluetooth download uses Web Serial. Your browser will ask you to select a serial port.")}</p>
            <p>{lf("Before continuing, make sure your EV3 is turned on and already paired with your computer. Close other applications that may be using the EV3 Bluetooth connection, such as 'EV3 Lab', 'EV3 Classroom', other BrickCode (MakeCode) editor tabs, or other applications using the EV3 Bluetooth serial connection.")}</p>
            <p>{lf("If 'Port View' is open on the EV3, close it before downloading. The program may download successfully, but it will not start.")}</p>
            <p>{lf("When the browser asks you to select a serial port, select the port with the name of your EV3. This is the name you set on your EV3 controller.")}</p>
            {pxt.BrowserUtils.isWindows() && (
                <p>{lf("On some Windows computers, the browser may not display your EV3 by name. The exact cause of this issue has not yet been determined. In this case, select the outgoing Bluetooth COM port assigned to your EV3. You can check the Bluetooth settings and open the COM Ports tab to identify the ports assigned to your EV3.")}</p>
            )}
            <p>{lf("Do not select unrelated COM ports, USB devices, or serial ports belonging to other hardware. If the EV3 does not respond after selecting a port, try selecting a different Bluetooth serial port.")}</p>
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
    );
    
    return confirmAsync({
        header: lf("Bluetooth pairing"),
        jsx,
        hasCloseIcon: true,
        hideCancel: true,
        buttons: [{
            label: lf("Help"),
            icon: "question circle",
            className: "lightgrey",
            url: "/bluetooth"
        }]
    }).then(result => result === 1);
}

export function showEv3ConnectionFailedDialogAsync(): Promise<void> {
    if (!confirmAsync) return Promise.resolve();

    return confirmAsync({
        header: lf("Could not connect to EV3"),
        hasCloseIcon: true,
        hideCancel: true,
        hideAgree: false,
        agreeLbl: lf("OK"),
        jsx: (
            <div>
                <p>{lf("The selected serial port did not respond as an EV3 device.")}</p>
                <p>{lf("Make sure your EV3 is turned on and paired with your computer, then select the correct Bluetooth serial port and try again.")}</p>
            </div>
        )
    }).then(() => {});
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
                <p>{lf("If other robotics software (such as EV3 Classroom or EV3 Lab) is open, close it to release the port.")}</p>
                <p>{lf("Stop the program on the EV3 and try again. If the problem persists, turn Bluetooth off and on again, then try again.")}</p>
            </div>
        )
    });
}