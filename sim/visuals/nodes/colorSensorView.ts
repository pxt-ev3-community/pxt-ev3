/// <reference path="./sensorView.ts" />

namespace pxsim.visuals {

    const LED_ID = 'color_sensor_white_big';

    const RGB_SEGMENT_COLORS = ['#F86262', '#00934B', '#0062DD'];
    
    export class ColorSensorView extends SensorView implements LayoutElement {

        private control: ColorGridControl;

        private rgbRings: SVGCircleElement[] = [];

        constructor(port: number) {
            super(COLOR_SENSOR_SVG, "color", NodeType.ColorSensor, port);
        }

        protected optimizeForLightMode() {
            (this.content.getElementById(this.normalizeId('color_bigbox-2_path')) as SVGElement).style.fill = '#a8aaa8';
        }

        public getPaddingRatio() {
            return 1 / 4;
        }

        public updateState() {
            super.updateState();

            const colorState = ev3board().getInputNodes()[this.port];
            if (!colorState) return;

            const mode = colorState.getMode();
            switch (mode) {
                case ColorSensorMode.Colors: 
                case ColorSensorMode.RgbRaw: 
                    this.updateSensorRgbVisual();
                    return;
                case ColorSensorMode.Reflected: 
                case ColorSensorMode.RefRaw: 
                    this.updateSensorLightVisual('#F86262'); 
                    return; // red
                case ColorSensorMode.Ambient: 
                    this.updateSensorLightVisual('#67C3E2'); 
                    return; // light blue
            }
            this.updateSensorLightVisual('#ffffff');
        }

        private updateSensorLightVisual(color: string) {
            const led = this.content.getElementById(this.normalizeId(LED_ID)) as SVGCircleElement;
            if (!led) return;

            for (let i = 0; i < this.rgbRings.length; i++) {
                this.rgbRings[i].style.display = 'none';
            }

            led.style.stroke = color;
            led.style.strokeWidth = color !== '#ffffff' ? '2px' : '0px';
        }

        private updateSensorRgbVisual() {
            const led = this.content.getElementById(this.normalizeId(LED_ID)) as SVGCircleElement;
            if (!led) return;

            this.ensureRgbRings(led);
            led.style.stroke = 'none';

            for (let i = 0; i < this.rgbRings.length; i++) {
                this.rgbRings[i].style.display = '';
            }
        }

        private ensureRgbRings(baseHole: SVGCircleElement) {
            if (this.rgbRings.length > 0) return;

            const parentNode = baseHole.parentElement;
            if (!parentNode) return;

            const r = parseFloat(baseHole.getAttribute('r') || '3.35');
            const circumference = 2 * Math.PI * r;
            const segment = circumference / 3;
            const dashArray = `${segment.toFixed(2)} ${(circumference - segment).toFixed(2)}`;
            const startOffset = circumference / 4;

            for (let i = 0; i < 3; i++) {
                const ring = baseHole.cloneNode(false) as SVGCircleElement;
                ring.removeAttribute('id');
                ring.style.fill = 'none';
                ring.style.stroke = RGB_SEGMENT_COLORS[i];
                ring.style.strokeWidth = '2px';
                ring.style.strokeDasharray = dashArray;
                ring.style.strokeDashoffset = `${(startOffset - i * segment).toFixed(2)}`;
                ring.style.display = 'none';

                parentNode.appendChild(ring);
                this.rgbRings.push(ring);
            }
        }
    }
}