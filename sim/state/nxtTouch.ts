namespace pxsim {

    export const NXT_TOUCH_SENSOR_ANALOG_PRESSED = 2400;

    export class NXTTouchSensorNode extends AnalogSensorNode {
        id = NodeType.NXTTouchSensor;

        private pressed: boolean[];

        constructor(port: number) {
            super(port);
            this.pressed = [];
        }

        public setPressed(pressed: boolean) {
            this.pressed.push(pressed);
            this.setChangedState();
        }

        public isPressed() {
            return this.pressed;
        }

        public getValue() {
            if (this.pressed.length) {
                if (this.pressed.pop()) return NXT_TOUCH_SENSOR_ANALOG_PRESSED;
            }
            return 0;
        }

        getDeviceType() {
            return DAL.DEVICE_TYPE_NXT_TOUCH;
        }

        public hasData() {
            return this.pressed.length > 0;
        }

        getAnalogReadPin() {
            return AnalogOff.InPin1;
        }

        isNXT() {
            return true;
        }
    }
}