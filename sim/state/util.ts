namespace pxsim.util {

    export function map16Bit(buffer: Uint8Array, index: number, value: number) {
        buffer[index] = value & 0xFF;
        buffer[index + 1] = (value >> 8) & 0xFF;
    }
}

namespace pxsim.math {
    
    export function map(x: number, inMin: number, inMax: number, outMin: number, outMax: number) {
        return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    export function clamp(min: number, max: number, v: number): number {
        return Math.max(min, Math.min(max, v));
    }
}