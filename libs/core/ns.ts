//% color="#009FE3"
//% icon="\uf00a"
//% weight=110
namespace basic {
    // Pass
}

//% color="#68C3E2"
//% icon="\uf106"
//% weight=100
//% groups='["Buttons", "Indicator", "Screen", "Power", "Program"]'
//% labelLineWidth=60
namespace brick {
    // Pass
}

//% color="#C8509B"
//% icon="\uf10f"
//% weight=95
//% groups='["Touch Sensor", "Color Sensor", "Ultrasonic Sensor", "Gyro Sensor", "Infrared Sensor", "Remote Infrared Beacon", "Light Sensor"]'
//% subcategories='["NXT", "HiTechnic"]'
//% labelLineWidth=100
namespace sensors {
    // Pass
}

//% color="#00852B"
//% icon="\uf10d"
//% weight=90
//% groups='["Move", "Counters", "Properties"]'
//% labelLineWidth=50
namespace motors {

    /**
     * A speed picker
     * @param speed the speed, eg: 50
     */
    //% blockId=motorSpeedPicker
    //% block="%speed"
    //% shim=TD_ID
    //% blockHidden=true
    //% weight=0
    //% colorSecondary="#FFFFFF"
    //% speed.fieldEditor="speed"
    //% speed.fieldOptions.decompileLiterals=true
    export function __speedPicker(speed: number): number {
        return speed;
    }

    /**
     * A turn ratio picker
     * @param turnratio the turn ratio, eg: 0
     */
    //% blockId=motorTurnRatioPicker
    //% block="%turnratio"
    //% shim=TD_ID
    //% blockHidden=true
    //% weight=0
    //% colorSecondary="#FFFFFF"
    //% turnratio.fieldEditor="turnratio"
    //% turnRatio.fieldOptions.decompileLiterals=true
    export function __turnRatioPicker(turnratio: number): number {
        return turnratio;
    }

    /**
     * An all-motors picker (shadow for universal motor blocks).
     * @param motor the motor or pair, eg: motors.largeA
     */
    //% blockId=allMotorsPicker 
    //% block="%motor"
    //% shim=TD_ID
    //% blockHidden=true
    //% weight=0
    //% motor.fieldEditor="motors"
    //% motor.fieldOptions.decompileLiterals=true
    export function __allMotorsPicker(motor: MotorBase): MotorBase {
        return motor;
    }

    /**
     * A single motor picker.
     * @param motor the motor, eg: motors.largeA
     */
    //% blockId=motorPicker
    //% block="%motor"
    //% shim=TD_ID
    //% decompilerShadowAlias="allMotorsPicker"
    //% weight=88
    //% group="Move"
    //% motor.fieldEditor="motors"
    //% motor.fieldOptions.decompileLiterals=true
    export function __motorPicker(motor: Motor): Motor {
        return motor;
    }

    /**
     * A motor pair picker.
     * @param motors the motor pair, eg: motors.largeBC
     */
    //% blockId=motorPairPicker
    //% block="%motors"
    //% shim=TD_ID
    //% weight=87
    //% group="Move"
    //% motors.fieldEditor="motors"
    //% motors.fieldOptions.decompileLiterals=true
    export function __motorPairPicker(motors: SynchedMotorPair): SynchedMotorPair {
        return motors;
    }
}

//% color="#5F3109"
//% icon="\uf107"
namespace control {
    // Pass
}
