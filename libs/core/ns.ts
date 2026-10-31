//% color="#1E90FF"
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
    //% blockHidden=1
    //% weight=0
    //% colorSecondary="#FFFFFF"
    //% speed.fieldEditor="speed"
    //% speed.fieldOptions.decompileLiterals=1
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
    //% blockHidden=1
    //% weight=0
    //% colorSecondary="#FFFFFF"
    //% turnratio.fieldEditor="turnratio"
    //% turnRatio.fieldOptions.decompileLiterals=1
    export function __turnRatioPicker(turnratio: number): number {
        return turnratio;
    }
}

//% color="#5F3109"
//% icon="\uf107"
namespace control {
    // Pass
}
