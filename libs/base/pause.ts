/**
 * Pause for the specified time in milliseconds
 * @param ms how long to pause for, eg: 100, 200, 500, 1000, 2000
 */
//% help=loops/pause
//% blockId=device_pause
//% block="pause %pause|ms"
//% blockNamespace=basic
//% pause.shadow=timePicker
//% weight=80
//% async
//% ms.label="value"
function pause(ms: number): void {
    loops.pause(ms);
}

