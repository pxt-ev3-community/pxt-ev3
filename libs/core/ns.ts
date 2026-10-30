//% color="#00852B" weight=90 icon="\uf10d"
//% groups='["Move", "Counters", "Properties"]'
//% labelLineWidth=50
namespace motors {

    /**
     * A speed picker
     * @param speed the speed, eg: 50
     */
    //% blockId=motorSpeedPicker block="%speed" shim=TD_ID
    //% speed.fieldEditor="speed" colorSecondary="#FFFFFF"
    //% weight=0 blockHidden=1 speed.fieldOptions.decompileLiterals=1
    export function __speedPicker(speed: number): number {
        return speed;
    }

    /**
     * A turn ratio picker
     * @param turnratio the turn ratio, eg: 0
     */
    //% blockId=motorTurnRatioPicker block="%turnratio" shim=TD_ID
    //% turnratio.fieldEditor="turnratio" colorSecondary="#FFFFFF"
    //% weight=0 blockHidden=1 turnRatio.fieldOptions.decompileLiterals=1
    export function __turnRatioPicker(turnratio: number): number {
        return turnratio;
    }

    /**
     * An all-motors picker (shadow for universal motor blocks).
     * @param motor the motor or pair, eg: motors.largeA
     */
    //% blockId=allMotorsPicker block="%motor" shim=TD_ID
    //% blockHidden=1
    //% motor.fieldEditor="motors"
    //% motor.fieldOptions.decompileLiterals=1
    export function __allMotorsPicker(motor: MotorBase): MotorBase {
        return motor;
    }

    /**
     * A single motor picker.
     * @param motor the motor, eg: motors.largeA
     */
    //% blockId=motorPicker block="%motor" shim=TD_ID
    //% decompilerShadowAlias="allMotorsPicker"
    //% group="Move" weight=88
    //% motor.fieldEditor="motors"
    //% motor.fieldOptions.decompileLiterals=1
    export function __motorPicker(motor: Motor): Motor {
        return motor;
    }

    /**
     * A motor pair picker.
     * @param motors the motor pair, eg: motors.largeBC
     */
    //% blockId=motorPairPicker block="%motors" shim=TD_ID
    //% decompilerShadowAlias="allMotorsPicker"
    //% group="Move" weight=87
    //% motors.fieldEditor="motors"
    //% motors.fieldOptions.decompileLiterals=1
    export function __motorPairPicker(motors: SynchedMotorPair): SynchedMotorPair {
        return motors;
    }
}

//% color="#C8509B" weight=95 icon="\uf10f"
//% labelLineWidth=100
//% groups='["Touch Sensor", "Color Sensor", "Ultrasonic Sensor", "Gyro Sensor", "Infrared Sensor", "Remote Infrared Beacon",  "Light Sensor"]'
//% subcategories='["NXT", "HiTechnic"]'
namespace sensors {
}

//% color="#5F3109" icon="\uf107"
namespace control {
}

//% color="#68C3E2" weight=100 icon="\uf106"
//% groups='["Buttons", "Indicator", "Screen", "Power", "Program"]'
//% labelLineWidth=60
namespace brick {
}