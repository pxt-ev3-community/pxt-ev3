/// <reference path="../node_modules/pxt-core/localtypings/pxteditor.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>

import { Ev3Wrapper } from "./wrap";
import { WebSerialIO } from "./webserial";
import { WebHidIO } from "./webhid";
import { showBluetoothConnectionStuckDialogAsync } from "./dialogs";


export enum DeployTransport {
    NotSelected,
    FileTransfer,
    BluetoothWebSerial,
    UsbHid
}

enum TransportState {
    Unpaired, // No port or device is selected. A new selection must be made on the next connection attempt
    Idle, // The transport is disconnected but can reconnect using the selected port/device
    Connecting, // A connection attempt is in progress
    Connected, // The transport is connected and ready to use
    Disconnecting, // The current connection is being closed
    FatalError // An unrecoverable transport error has occurred
}

class TransportManager {

    private state = TransportState.Unpaired;
    private wrapper?: Ev3Wrapper;
    private io?: pxt.packetio.PacketIO;
    private currentType?: DeployTransport;

    // Stores the current connection attempt to prevent multiple simultaneous connectAsync() calls from creating or opening more than one connection
    private connectPromise?: Promise<Ev3Wrapper>;

    /**
     * Connects to the EV3 and returns a ready-to-use wrapper.
     *
     * If the transport is already connected with the same transport type, the existing wrapper is returned.
     * If another connection attempt is already in progress, the same Promise is returned instead of starting a second connection.
     */
    async connectAsync(transportType: DeployTransport = DeployTransport.BluetoothWebSerial): Promise<Ev3Wrapper> {
        if (this.state === TransportState.Connected && this.wrapper && this.currentType === transportType) {
            return this.wrapper; // Already connected
        }
        if (this.connectPromise) return this.connectPromise; // If a connection is already in progress, we return the same Promise

        this.connectPromise = this.doConnectAsync(transportType);
        try {
            return await this.connectPromise;
        } finally {
            this.connectPromise = undefined;
        }
    }

    /**
     * Performs a single connection attempt.
     *
     * If switching transport type, previous IO is disconnected.
     * If no IO exists, a new connection is created (WebHidIO or WebSerialIO).
     * Otherwise, the existing IO object is reconnected.
     *
     * Known connection errors update the transport state accordingly.
     * The method does not retry failed connections automatically.
     * A new connection attempt is started by the next connectAsync() call.
     */
    private async doConnectAsync(transportType: DeployTransport): Promise<Ev3Wrapper> {
        try {
            // Disconnect old IO if switching between USB HID and Bluetooth
            if (this.currentType !== transportType && this.io) {
                try {
                    await this.io.disconnectAsync();
                } catch {}
                this.io = undefined;
                this.wrapper = undefined;
                this.state = TransportState.Unpaired;
            }

            this.currentType = transportType;

            // Don't create a new IO if it already exists
            if (!this.io) {
                const force = this.state === TransportState.Unpaired;
                if (transportType === DeployTransport.UsbHid) {
                    this.io = await WebHidIO.createAsync(force);
                } else if (transportType === DeployTransport.BluetoothWebSerial) {
                    this.io = await WebSerialIO.createAsync(force);
                } else {
                    throw new Error("UNSUPPORTED_TRANSPORT");
                }
            }

            this.state = TransportState.Connecting;
            await this.io.reconnectAsync();
            if (!this.wrapper) { // If the wrapper is not yet available, create it
                this.wrapper = new Ev3Wrapper(this.io);
            }

            this.state = TransportState.Connected;
            return this.wrapper;
        } catch (e: any) {
            if (e?.message === "Timeout") { // The device opened, but the EV3 did not respond to PING
                console.warn("EV3 PING timeout. Selected device/port did not respond.");
                this.state = TransportState.Unpaired;
                throw new Error("EV3_RESPONSE_TIMEOUT");
            }
            if (e?.message === "NO_PORT_SELECTED" || e?.message === "NO_DEVICE_SELECTED") { // The user closed the selection window
                this.state = TransportState.Unpaired;
                throw e;
            }
            if (e?.message === "PORT_PERMISSION_DENIED" || e?.message === "DEVICE_PERMISSION_DENIED") {
                this.state = TransportState.Idle;
                throw e;
            }
            if (e?.message === "PORT_OPEN_FAILED") {
                console.warn("Bluetooth connection is stuck. Windows did not release the RFCOMM channel. Please reset Bluetooth or re-enable the COM port.");
                
                if (this.io) { // Destroy the old IO if it exists
                    try {
                        await this.io.disconnectAsync();
                    } catch {}
                    this.io = undefined;
                    this.wrapper = undefined;
                }
                this.state = TransportState.Unpaired;
                await showBluetoothConnectionStuckDialogAsync();
                throw e;
            }

            // WEBSERIAL_NOT_SUPPORTED, WEBHID_NOT_SUPPORTED or other unknown transport error
            this.state = TransportState.FatalError;
            throw e;
        }
    }

    /**
     * Disconnects the current connection and releases all transport resources.
     *
     * The io and wrapper instances are always cleared after the disconnect attempt.
     * By default the transport becomes Idle. When unpaired is true, the transport becomes Unpaired so the next connection requires selecting a device/port again.
     */
    async disconnectAsync(unpaired: boolean) {
        if (!this.io) {
            this.state = unpaired ? TransportState.Unpaired : TransportState.Idle;
            return;
        }

        this.state = TransportState.Disconnecting;

        try {
            await this.io.disconnectAsync();
        } finally {
            this.io = undefined;
            this.wrapper = undefined;
            this.currentType = undefined;
            this.state = unpaired ? TransportState.Unpaired : TransportState.Idle;
        }
    }

}

export const transport = new TransportManager();
