/// <reference path="./sensorView.ts" />

namespace pxsim.visuals {

    export class NXTSoundSensorView extends SensorView implements LayoutElement {
        
        constructor(port: number) {
            super(NXT_SOUND_SENSOR_SVG, "nxt-sound-sensor", NodeType.NXTSoundSensor, port);
        }

        protected optimizeForLightMode() {
            const box = this.content ? this.content.getElementById(this.normalizeId('box')) as SVGElement : null;
            if (box) box.style.fill = '#a8aaa8';
        }

        public getPaddingRatio() {
            return 1 / 4;
        }

        public updateState() {
            super.updateState();
        }
    }
}