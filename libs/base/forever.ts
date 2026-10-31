/**
 * Repeats the code forever in the background. On each iteration, allows other codes to run.
 * @param body code to execute
 */
//% help=loops/forever
//% blockId=forever
//% block="forever"
//% blockNamespace="basic"
//% weight=90
//% afterOnStart=true
//% blockAllowMultiple=1
function forever(a: () => void): void {
    loops.forever(a);
}
