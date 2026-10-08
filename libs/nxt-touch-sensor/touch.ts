namespace sensors {

    //% fixedInstances
    export class NXTTouchSensor extends internal.AnalogSensor {
        private button: brick.Button;

        constructor(port: number) {
            super(port);
            this.button = new brick.Button();
        }

        _query() {
            return [this._readPin1() < 2400 ? 1 : 0];
        }

        _info() {
            return [this._query()[0] ? "pres" : "rel"];
        }

        _update(prev: number, curr: number) {
            this.button._update(curr > 0);
        }

        _deviceType() {
            return DAL.DEVICE_TYPE_NXT_TOUCH;
        }

        /**
         * Run some code when the NXT touch sensor is pressed, released, or bumped.
         * @param event the touch sensor event to listen for
         * @param body the code to run when the event occurs
         */
        //% help=sensors/nxt-touch-sensor/on-event
        //% block="on **nxt touch sensor** %this|%event"
        //% blockId="nxtTouchSensorOnEvent"
        //% parts="nxt-touch-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=99 blockGap=8
        //% subcategory="NXT"
        //% group="Touch Sensor"
        onEvent(ev: ButtonEvent, body: () => void) {
            this.button.onEvent(ev, body);
        }

        /**
         * Wait until the NXT touch sensor is touched.
         * @param sensor the touch sensor that needs to be clicked or used
         * @param event the kind of button gesture that needs to be detected
         */
        //% help=sensors/nxt-touch-sensor/pause-until
        //% block="pause until **nxt touch sensor** %this|%event"
        //% blockId="nxtTouchSensorPauseUntil"
        //% parts="nxt-touch-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=98 blockGap=8
        //% subcategory="NXT"
        //% group="Touch Sensor"
        pauseUntil(ev: ButtonEvent) {
            this.button.pauseUntil(<ButtonEvent><number>ev);
        }

        /**
         * Check if the NXT touch sensor is currently pressed.
         * @returns true if the sensor is pressed, false otherwise
         */
        //% help=sensors/nxt-touch-sensor/is-pressed
        //% block="**nxt touch sensor** %this|is pressed"
        //% blockId="nxtTouchSensorIsPressed"
        //% parts="nxt-touch-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=81 blockGap=8
        //% subcategory="NXT"
        //% group="Touch Sensor"
        isPressed(): boolean {
            this.poke();
            return this.button.isPressed();
        }

        /**
         * Check if NXT touch sensor is touched since it was last checked.
         * @param sensor the port to query the request
         */
        //% help=sensors/nxt-touch-sensor/was-pressed
        //% block="**nxt touch sensor** %this|was pressed"
        //% blockId="nxtTouchSensorWasPressed"
        //% parts="nxt-touch-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=80
        //% subcategory="NXT"
        //% group="Touch Sensor"
        //% blockHidden=true
        wasPressed() {
            this.poke();
            return this.button.wasPressed();
        }
    }

    //% whenUsed block="1" weight=95 fixedInstance jres=icons.port1
    export const nxtTouch1: NXTTouchSensor = new NXTTouchSensor(1);

    //% whenUsed block="2" weight=95 fixedInstance jres=icons.port2
    export const nxtTouch2: NXTTouchSensor = new NXTTouchSensor(2);

    //% whenUsed block="3" weight=95 fixedInstance jres=icons.port3
    export const nxtTouch3: NXTTouchSensor = new NXTTouchSensor(3);

    //% whenUsed block="4" weight=95 fixedInstance jres=icons.port4
    export const nxtTouch4: NXTTouchSensor = new NXTTouchSensor(4);
}