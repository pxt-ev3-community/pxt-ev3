namespace pxsim {

    export class SensorNode extends BaseNode {

        protected mode: number;
        protected valueChanged: boolean;
        protected modeChanged: boolean;
        protected modeReturnsArray: boolean;

        constructor(port: number) {
            super(port);
        }

        getDeviceType() {
            return DAL.DEVICE_TYPE_NONE;
        }

        getFamily() {
            return DeviceFamily.EV3;
        }

        getInterface() {
            return DeviceInterface.None;
        }

        setMode(mode: number) {
            this.mode = mode;
            this.changed = true;
            this.modeChanged = true;
            this.modeReturnsArray = false;
        }

        getMode() {
            return this.mode;
        }

        modeChange() {
            const res = this.modeChanged;
            this.modeChanged = false;
            return res;
        }

        hasData() {
            return true;
        }

        returnsArray() {
            return this.modeReturnsArray;
        }

        getValue() {
            return 0;
        }

        getValues() {
            return [this.getValue()];
        }

        valueChange() {
            const res = this.valueChanged;
            this.valueChanged = false;
            return res;
        }

        setChangedState() {
            this.changed = true;
            this.valueChanged = false;
        }
    }

    export class AnalogSensorNode extends SensorNode {

        constructor(port: number) {
            super(port);
        }

        getInterface() {
            return DeviceInterface.Analog;
        }

        getAnalogPin() {
            return AnalogOff.InPin6; // Default for EV3 sensor
        }
    }

    export class UartSensorNode extends SensorNode {

        constructor(port: number) {
            super(port);
        }

        getInterface() {
            return DeviceInterface.Uart;
        }

        hasChanged() {
            return this.changed;
        }
    }

    export class I2CSensorNode extends SensorNode {

        constructor(port: number) {
            super(port);
        }

        getDeviceType() {
            return DAL.DEVICE_TYPE_IIC_UNKNOWN;
        }

        getInterface() {
            return DeviceInterface.I2C;
        }
    }
}