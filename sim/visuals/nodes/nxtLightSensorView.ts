/// <reference path="./sensorView.ts" />

namespace pxsim.visuals {

    export class NXTLightSensorView extends SensorView implements LayoutElement {
        
        constructor(port: number) {
            super(NXT_LIGHT_SENSOR_SVG, "nxt-light-sensor", NodeType.NXTLightSensor, port);
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

            const lightState = ev3board().getInputNodes()[this.port];
            if (!lightState) return;

            const mode = lightState.getMode();
            if (mode == NXTLightSensorMode.ReflectedLightRaw
                || mode == NXTLightSensorMode.ReflectedLight) {
                this.updateSensorLightVisual(true);
            } else {
                this.updateSensorLightVisual(false);
            }
        }

        private updateSensorLightVisual(enable: boolean) {
            const sensorHole = this.content.getElementById(this.normalizeId('led')) as SVGCircleElement;
            if (enable) {
                sensorHole.style.stroke = "#eb0c0c";
                sensorHole.style.strokeWidth = '10px';
            } else {
                sensorHole.style.stroke = "none";
                sensorHole.style.strokeWidth = "0";
            }
        }
    }
}