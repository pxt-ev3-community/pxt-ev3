namespace pxsim {

    export enum NodeType {
        Port = 0,
        Brick = 1,
        TouchSensor = 2,
        MediumMotor = 3,
        LargeMotor = 4,
        GyroSensor = 5,
        ColorSensor = 6,
        UltrasonicSensor = 7,
        InfraredSensor = 8,
        NXTTouchSensor = 9,
        NXTLightSensor = 10,
        NXTSoundSensor = 11,
        NXTColorSensor = 12,
        NXTUltrasonicSensor = 13
    }

    export enum DeviceFamily {
        EV3,
        NXT,
        // HiTechnic,
        // Mindsensors
    }

    export enum DeviceInterface {
        Analog,
        Uart,
        I2C,
        None
    }

    export interface Node {
        id: number;
        didChange(): boolean;
    }

    export class BaseNode implements Node {

        public id: number;
        public port: number;
        public isOutput = false;

        private used = false;
        protected changed = true;

        constructor(port: number) {
            this.port = port;
        }

        didChange() {
            const res = this.changed;
            this.changed = false;
            return res;
        }

        setChangedState() {
            this.changed = true;
        }

        /**
         * Updates any internal state according to the elapsed time since the last call to `updateState`
         * @param elapsed
         */
        updateState(elapsed: number) {
            // Pass
        }
    }
}