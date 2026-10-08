enum NXTSoundSensorMode {
    //% block="dB"
    Db = 0,
    //% block="dBA"
    DbA = 1
}

namespace sensors {

    const enum InternalSoundMode {
        Db = 0,
        DbA = 1,
        RawDb = 2,
        RawDbA = 3
    }

    const dcmModeDb = "0";
    const dcmModeDbA = "2";

    //% fixedInstances
    export class NXTSoundSensor extends internal.AnalogSensor {

        // https://github.com/mindboards/ev3sources-xtended/blob/master/ev3sources/lms2012/lms2012/Linux_AM1808/sys/settings/typedata.rcf

        private silentDb: number = 4095;
        private loudDb: number = 0;
        private silentDbA: number = 4095;
        private loudDbA: number = 0;

        constructor(port: number) {
            super(port);
            this.setMode(InternalSoundMode.DbA);
        }

        _query() {
            const rawValue = this._readPin1(); // Read the raw 12-bit ADC value (0-4095) from Pin 1

            switch (this.mode) {
                case InternalSoundMode.Db:
                    return [this._normalize(rawValue, this.silentDb, this.loudDb)];
                case InternalSoundMode.DbA:
                    return [this._normalize(rawValue, this.silentDbA, this.loudDbA)];
                case InternalSoundMode.RawDb:
                case InternalSoundMode.RawDbA:
                    return [rawValue];
            }
            return [0];
        }

        _info() {
            const value = this._query()[0];
            switch (this.mode) {
                case InternalSoundMode.Db:
                case InternalSoundMode.DbA:
                    return [`${value}%`];
                default:
                    return [value.toString()];
            }
        }

        _update(prev: number, curr: number) {
            // Pass
        }

        _deviceType() {
            return DAL.DEVICE_TYPE_NXT_SOUND;
        }
        
        setMode(m: InternalSoundMode) {
            const modeChanged = this.isActive() && this.mode != m;
            this._setMode(m);
            if (modeChanged) {
                const useDbA = (m === InternalSoundMode.DbA || m === InternalSoundMode.RawDbA);
                this._writeDcm(useDbA ? dcmModeDbA : dcmModeDb);
            }
        }

        /**
         * Set the range of values for determining silence and loud in dB mode. This must be done so that the dB mode defines a value in the range from 0 to 100 percent.
         * @param silent the raw value of silence, eg: 4095
         * @param loud the raw value of loud, eg: 0
         */
        //% help=sensors/nxt-sound-sensor/set-db-range
        //% block="**nxt sound sensor** %this|set dB range silent $silent|loud $loud"
        //% blockId="nxtSoundSensorSetDbRange"
        //% parts="nxt-sound-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=89 blockGap=8
        //% subcategory="NXT"
        //% group="Sound Sensor"
        setDbRange(silent: number, loud: number) {
            if (silent <= loud) return;
            this.silentDb = Math.clamp(0, 4095, silent);
            this.loudDb = Math.clamp(0, 4095, loud);
        }

        /**
         * Set the value range for silence and loud detection in dBA mode. This must be done so that the dBA mode determines the value in the range from 0 to 100 percent.
         * @param silent the raw value of silence, eg: 4095
         * @param loud the raw value of loud, eg: 0
         */
        //% help=sensors/nxt-sound-sensor/set-dba-range
        //% block="**nxt sound sensor** %this|set dBA range silent $silent|loud $loud"
        //% blockId="nxtSoundSensorSetDbARange"
        //% parts="nxt-sound-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=88 blockGap=8
        //% subcategory="NXT"
        //% group="Sound Sensor"
        setDbARange(silent: number, loud: number) {
            if (silent <= loud) return;
            this.silentDbA = Math.clamp(0, 4095, silent);
            this.loudDbA = Math.clamp(0, 4095, loud);
        }
        
        // Normalizes the raw sound value to a percentage based on silence and loud reference values
        private _normalize(value: number, silent: number, loud: number) {
            let normalized = Math.map(value, silent, loud, 0, 100);
            normalized = Math.round(Math.clamp(0, 100, normalized));
            return normalized;
        }

        /**
         * Get the current sound level measured by the NXT sound sensor.
         * Returns a number between 0 and 100 representing the sound volume.
         * @param mode mode dB (raw volume, all frequencies) or dBA (human ear sensitivity), eg: NXTSoundSensorMode.dBA
         */
        //% block="**nxt sound sensor** %this|sound level $mode"
        //% blockId="nxtSoundSensorLevel"
        //% parts="nxt-sound-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=99 blockGap=8
        //% subcategory="NXT"
        //% group="Sound Sensor"
        soundLevel(mode: NXTSoundSensorMode): number {
            if (!this.isActive()) return 0;
            const internalMode = mode === NXTSoundSensorMode.DbA ? InternalSoundMode.DbA : InternalSoundMode.Db;
            this.setMode(internalMode);
            this.poke();
            return this._query()[0];
        }

        /**
         * Get the raw ADC value from the NXT sound sensor.
         * Returns a number between 0 and 4095 (Note: 4095 = silence, 0 = very loud).
         * @param mode mode dB (raw volume, all frequencies) or dBA (human ear sensitivity), eg: NXTSoundSensorMode.dBA
         */
        //% block="**nxt sound sensor** %this|sound level (raw) $mode"
        //% blockId="nxtSoundSensorSoundLevelRaw"
        //% parts="nxt-sound-sensor"
        //% blockNamespace="sensors"
        //% this.fieldEditor="images"
        //% this.fieldOptions.columns="4"
        //% this.fieldOptions.width="300"
        //% weight=89 blockGap=8
        //% subcategory="NXT"
        //% group="Sound Sensor"
        soundLevelRaw(mode: NXTSoundSensorMode): number {
            if (!this.isActive()) return 0;
            const internalMode = mode === NXTSoundSensorMode.DbA ? InternalSoundMode.RawDbA : InternalSoundMode.RawDb;
            this.setMode(internalMode);
            this.poke();
            return this._query()[0]; // Returns the raw 12-bit value (0-4095)
        }
    }

    //% whenUsed block="1" weight=95 fixedInstance jres=icons.port1
    export const nxtSound1 = new NXTSoundSensor(1);

    //% whenUsed block="2" weight=95 fixedInstance jres=icons.port2
    export const nxtSound2 = new NXTSoundSensor(2);

    //% whenUsed block="3" weight=95 fixedInstance jres=icons.port3
    export const nxtSound3 = new NXTSoundSensor(3);

    //% whenUsed block="4" weight=95 fixedInstance jres=icons.port4
    export const nxtSound4 = new NXTSoundSensor(4);
}