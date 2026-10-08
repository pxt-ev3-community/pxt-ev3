const enum NXTLightSensorMode {
    //% block="reflected light (raw)"
    ReflectedLightRaw = 0,
    //% block="reflected light"
    ReflectedLight = 1,
    //% block="ambient light (raw)"
    AmbientLightRaw = 2,
    //% block="ambient light"
    AmbientLight = 3,
}

enum NXTLightIntensityMode {
    //% block="reflected light (raw)"
    ReflectedRaw = NXTLightSensorMode.ReflectedLightRaw,
    //% block="reflected light"
    Reflected = NXTLightSensorMode.ReflectedLight,
    //% block="ambient light (raw)"
    AmbientRaw = NXTLightSensorMode.AmbientLightRaw,
    //% block="ambient light"
    Ambient = NXTLightSensorMode.AmbientLight
}

namespace sensors {

    const dcmLedOff = "0";
    const dcmLedOn = "2";

    //% fixedInstances
    export class NXTLightSensor extends internal.AnalogSensor {

        // https://github.com/mindboards/ev3sources-xtended/blob/master/ev3sources/lms2012/lms2012/Linux_AM1808/sys/settings/typedata.rcf

        private darkReflectedLight: number = 3372;
        private brightReflectedLight: number = 445;
        private darkAmbientLight: number = 3411;
        private brightAmbientLight: number = 633;

        constructor(port: number) {
            super(port);
        }

        _query() {
            const rawValue = this._readPin1();
            switch (this.mode) {
                case NXTLightSensorMode.ReflectedLight:
                    return [this._normalize(rawValue, this.darkReflectedLight, this.brightReflectedLight)];
                case NXTLightSensorMode.AmbientLight:
                    return [this._normalize(rawValue, this.darkAmbientLight, this.brightAmbientLight)];
                case NXTLightSensorMode.ReflectedLightRaw:
                case NXTLightSensorMode.AmbientLightRaw:
                    return [rawValue];
            }
            return [0];
        }

        _info() {
            const value = this._query()[0];
            switch (this.mode) {
                case NXTLightSensorMode.ReflectedLight:
                case NXTLightSensorMode.AmbientLight:
                    return [`${value}%`];
                default:
                    return [value.toString()];
            }
        }

        _update(prev: number, curr: number) {
            // Intentionally left empty
            // This sensor does not generate threshold or change events
            // Pass
        }

        _deviceType() {
            return DAL.DEVICE_TYPE_NXT_LIGHT;
        }

        setMode(m: number) {
            if (m != this.mode) {
                this._setMode(m);
                switch (m) {
                    case NXTLightSensorMode.ReflectedLight:
                    case NXTLightSensorMode.ReflectedLightRaw:
                        this._setLedState(true);
                        break;
                    case NXTLightSensorMode.AmbientLight:
                    case NXTLightSensorMode.AmbientLightRaw:
                        this._setLedState(false);
                        break;
                }
            } else {
                this._setMode(m);
            }
        }

        /**
         * Gets the current light mode.
         */
        lightMode() {
            return <NXTLightSensorMode>this.mode;
        }

        /**
         * Set the range of values for determining dark and light in light reflection mode. This must be done so that the reflection mode defines a value in the range from 0 to 100 percent.
         * @param sensor the color sensor port
         * @param dark the value of dark, eg: 3372
         * @param bright the value of bright, eg: 445
         */
        //% help=sensors/nxt-light-sensor/set-reflected-range
        //% block="**nxt light sensor** $this|set reflected range dark $dark|bright $bright"
        //% blockId="nxtLightSensorSetReflectedLightRange"
        //% parts="nxt-light-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=89 blockGap=8
        //% subcategory="NXT"
        //% group="Light Sensor"
        setReflectedLightRange(dark: number, bright: number) {
            if (dark <= bright) return;
            this.darkReflectedLight = Math.clamp(0, 4095, dark);
            this.brightReflectedLight = Math.clamp(0, 4095, bright);
        }

        /**
         * Set the value range for dark and light detection in ambient light mode. This must be done so that the ambient light mode determines the value in the range from 0 to 100 percent.
         * @param sensor the color sensor port
         * @param dark the value of dark, eg: 3411
         * @param bright the value of bright, eg: 633
         */
        //% help=sensors/nxt-light-sensor/set-ambient-range
        //% block="**nxt light sensor** $this|set ambient range dark $dark|bright $bright"
        //% blockId="nxtLightSensorSetAmbientLightRange"
        //% parts="nxt-light-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=88 blockGap=8
        //% subcategory="NXT"
        //% group="Light Sensor"
        setAmbientLightRange(dark: number, bright: number) {
            if (dark <= bright) return;
            this.darkAmbientLight = Math.clamp(0, 4095, dark);
            this.brightAmbientLight = Math.clamp(0, 4095, bright);
        }

        // Enables or disables the built-in illumination LED
        private _setLedState(enable: boolean) {
            this._writeDcm(enable ? dcmLedOn : dcmLedOff);
        }
        
        // Normalizes the raw light value to a percentage based on the dark and bright reference values
        private _normalize(value: number, dark: number, bright: number) {
            let normalized = Math.map(value, dark, bright, 0, 100);
            normalized = Math.round(Math.clamp(0, 100, normalized));
            return normalized;
        }

        /**
         * Measure the ambient or reflected light value from 0 (darkest) to 100 (brightest). For raw reflection values, the range can be from 0 to 4095.
         * @param sensor the color sensor port
         * @param mode the color sensor mode, eg: NXTLightIntensityMode.Reflected
         */
        //% help=sensors/nxt-light-sensor/light
        //% block="**nxt light sensor** $this|$mode"
        //% blockId="nxtLightSensorLight"
        //% parts="nxt-light-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=99 blockGap=8
        //% subcategory="NXT"
        //% group="Light Sensor"
        light(mode: NXTLightIntensityMode) {
            this.setMode(<NXTLightSensorMode><number>mode);
            this.poke();
            return this._query()[0];
        }

        /**
         * Gets the raw reflection light value.
         */
        //%
        reflectedLightRaw() {
            return this.light(NXTLightIntensityMode.ReflectedRaw);
        }

        /**
         * Gets the raw ambient light value.
         */
        //%
        ambientLightRaw() {
            return this.light(NXTLightIntensityMode.AmbientRaw);
        }

        /**
         * Gets the normalize reflection light value.
         */
        //%
        reflectedLight() {
            return this.light(NXTLightIntensityMode.Reflected);
        }

        /**
         * Gets the normalize ambient light value.
         */
        //%
        ambientLight() {
            return this.light(NXTLightIntensityMode.Ambient);
        }

    }

    //% whenUsed block="1" weight=95 fixedInstance jres=icons.port1
    export const nxtLight1: NXTLightSensor = new NXTLightSensor(1);

    //% whenUsed block="2" weight=90 fixedInstance jres=icons.port2
    export const nxtLight2: NXTLightSensor = new NXTLightSensor(2);

    //% whenUsed block="3" weight=90 fixedInstance jres=icons.port3
    export const nxtLight3: NXTLightSensor = new NXTLightSensor(3);
    
    //% whenUsed block="4" weight=90 fixedInstance jres=icons.port4
    export const nxtLight4: NXTLightSensor = new NXTLightSensor(4);
}
