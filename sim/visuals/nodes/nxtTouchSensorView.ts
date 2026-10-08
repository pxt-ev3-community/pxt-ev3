/// <reference path="./moduleView.ts" />

namespace pxsim.visuals {

    export class NXTTouchSensorView extends ModuleView implements LayoutElement {
        
        private shadowElement: SVGElement | undefined;

        constructor(port: number) {
            super(NXT_TOUCH_SENSOR_SVG, "nxt-touch-sensor", NodeType.NXTTouchSensor, port);
        }

        protected optimizeForLightMode() {
            const box = this.content ? this.content.getElementById(this.normalizeId('box')) as SVGElement : null;
            if (box) box.style.fill = '#a8aaa8';
        }

        public getPaddingRatio() {
            return 1 / 4;
        }

        public hasClick() {
            return false;
        }

        public attachEvents() {
            this.content.style.cursor = "pointer";

            const normId = this.normalizeId('touch-pad-shadow');
            this.shadowElement = (this.content.getElementById(normId) 
                || this.content.querySelector(`[id*="touch-pad-shadow"]`)
                || this.content.querySelector('#touch-pad-shadow')) as SVGElement;

            if (this.shadowElement) {
                this.shadowElement.style.opacity = '0';
                this.shadowElement.style.pointerEvents = 'none';
                this.shadowElement.style.transition = 'opacity 0.08s ease';
            }

            const state = ev3board().getSensor(this.port, DAL.DEVICE_TYPE_NXT_TOUCH) as NXTTouchSensorNode;

            pointerEvents.down.forEach(evid => this.content.addEventListener(evid, ev => {
                this.setPressed(true);
                if (state) state.setPressed(true);
            }));
            this.content.addEventListener(pointerEvents.leave, ev => {
                this.setPressed(false);
                if (state) state.setPressed(false);
            });
            this.content.addEventListener(pointerEvents.up, ev => {
                this.setPressed(false);
                if (state) state.setPressed(false);
            });
        }

        private setPressed(pressed: boolean) {
            if (!this.shadowElement) return;
            this.shadowElement.style.opacity = pressed ? '1' : '0';
        }
    }
}