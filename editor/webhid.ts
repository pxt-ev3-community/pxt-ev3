/// <reference path="../node_modules/pxt-core/localtypings/pxteditor.d.ts"/>
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>


enum IOState {
    Disconnected,
    Connecting,
    Connected
}

export class WebHidIO implements pxt.packetio.PacketIO {
    onData = (v: Uint8Array) => {};
    onEvent = (v: Uint8Array) => {};
    onError = (e: Error) => {};
    error = (msg: string) => {};
    onConnectionChanged = () => {};
    onDeviceConnectionChanged = () => {};

    private state: IOState = IOState.Disconnected;
    private onInputReportBound: (e: any) => void;
    private onDisconnectBound: (e: any) => void;

    constructor(private device: any) {
        console.log("HID: New WebHidIO", device?.productName);
        this.onInputReportBound = this.handleInputReport.bind(this);
        this.onDisconnectBound = this.handleDisconnect.bind(this);
    }

    static supported(): boolean {
        return typeof navigator !== "undefined" && !!(navigator as any).hid;
    }

    isConnected() {
        return this.state === IOState.Connected && !!this.device?.opened;
    }

    isConnecting() {
        return this.state === IOState.Connecting;
    }

    static async createAsync(forceRequest: boolean): Promise<WebHidIO> {
        const hid = (navigator as any).hid;
        if (!hid) throw new Error("WEBHID_NOT_SUPPORTED");

        let device: any;
        // Read vendorId and productId directly from pxtarget.json ("serial" configuration)
        const vendorId = parseInt(pxt.appTarget.serial.vendorId, 16);
        const productId = parseInt(pxt.appTarget.serial.productId, 16);

        if (!forceRequest) {
            const devices = await hid.getDevices();
            if (devices && devices.length > 0) {
                // Find EV3 device or take first approved device
                device = devices.find((d: any) => d.vendorId === vendorId && (!d.productId || d.productId === productId)) || devices[0];
            }
        }

        if (!device) {
            try {
                const devices = await hid.requestDevice({
                    filters: [{ vendorId, productId }]
                });
                if (devices && devices.length > 0) {
                    device = devices[0];
                }
            } catch (e: any) {
                if (e?.name === "NotFoundError") {
                    throw new Error("NO_DEVICE_SELECTED");
                }
                if (e?.name === "SecurityError") {
                    throw new Error("DEVICE_PERMISSION_DENIED");
                }
                throw e;
            }
        }

        if (!device) {
            throw new Error("NO_DEVICE_SELECTED");
        }

        return new WebHidIO(device);
    }

    async reconnectAsync(): Promise<void> {
        if (this.state === IOState.Connected && this.device?.opened) return;
        if (this.state === IOState.Connecting) throw new Error("CONNECT_IN_PROGRESS");

        this.state = IOState.Connecting;

        try {
            if (!this.device.opened) {
                await this.device.open();
            }
            this.state = IOState.Connected;

            const hid = (navigator as any).hid;
            if (hid) {
                hid.removeEventListener("disconnect", this.onDisconnectBound);
                hid.addEventListener("disconnect", this.onDisconnectBound);
            }

            this.device.removeEventListener("inputreport", this.onInputReportBound);
            this.device.addEventListener("inputreport", this.onInputReportBound);

            this.onConnectionChanged();
        } catch (e: any) {
            this.state = IOState.Disconnected;
            if (e?.name === "SecurityError") {
                throw new Error("DEVICE_PERMISSION_DENIED");
            }
            throw e;
        }
    }

    async disconnectAsync(): Promise<void> {
        if (this.state === IOState.Disconnected && !this.device?.opened) return;

        this.state = IOState.Disconnected;

        try {
            const hid = (navigator as any).hid;
            if (hid) {
                hid.removeEventListener("disconnect", this.onDisconnectBound);
            }
            if (this.device) {
                this.device.removeEventListener("inputreport", this.onInputReportBound);
                if (this.device.opened) {
                    await this.device.close();
                }
            }
        } catch (e) {
            console.warn("HID: close error", e);
        }
        this.onConnectionChanged();
    }

    async sendPacketAsync(pkt: Uint8Array): Promise<void> {
        if (!this.device || !this.device.opened) {
            throw new Error("DEVICE_NOT_CONNECTED");
        }
        // EV3 HID uses report ID 0
        await this.device.sendReport(0, pkt);
    }

    disposeAsync(): Promise<void> {
        return this.disconnectAsync();
    }

    private handleInputReport(event: any) {
        const data: DataView = event?.data;
        if (!data || data.byteLength < 2) return;

        const buf = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        this.onData(buf);
    }

    private handleDisconnect(event: any) {
        if (event?.device === this.device) {
            console.log("HID: EV3 device disconnected");
            this.disconnectAsync();
        }
    }
}
