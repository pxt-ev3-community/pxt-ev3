namespace pxsim {

    const NXT_TOUCH_SENSOR_ANALOG_RELEASED = 4800;

    export class NXTTouchSensorNode extends AnalogSensorNode {

        id = NodeType.NXTTouchSensor;

        private pressed: boolean[] = [false];

        constructor(port: number) {
            super(port);
        }

        getDeviceType() {
            return DAL.DEVICE_TYPE_NXT_TOUCH;
        }

        getFamily() {
            return DeviceFamily.NXT;
        }

        getAnalogPin() {
            return AnalogOff.InPin1;
        }

        public getValue() {
            if (this.pressed.length) {
                if (this.pressed.pop()) return 0;
            }
            return NXT_TOUCH_SENSOR_ANALOG_RELEASED;
        }

        public setPressed(pressed: boolean) {
            this.pressed.push(pressed);
            this.setChangedState();
        }

        public isPressed() {
            return this.pressed;
        }

        public hasData() {
            return this.pressed.length > 0;
        }
    }
}