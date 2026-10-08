namespace pxsim.visuals {

    const PRINT_OFFSET_H = 16;
    const RGB_LETTERS = ["R", "G", "B"];
    const RGB_COLORS = ["red", "green", "blue"];

    export class ColorRGBWheelControl extends ControlView<ColorSensorNode> {
        
        private group: SVGGElement;
        private colorGradient: SVGLinearGradientElement[] = [];
        private reporter: SVGTextElement[] = [];
        private rect: SVGElement[] = [];

        private captured: boolean = false;
        private capturedIndex: number = -1;

        getInnerWidth() {
            return 120;
        }

        getInnerHeight() {
            return 192;
        }

        private getReporterHeight() {
            return 70;
        }

        private getSliderWidth() {
            return 24;
        }

        private getSliderHeight() {
            return 100;
        }

        private getMaxValue() {
            return 512;
        }

        updateState() {
            if (!this.visible) return;
            
            const node = this.state;
            const values = node.getValues();
            let inverseValue: number[] = [];
            for (let i = 0; i < 3; i++) {
                inverseValue[i] = this.getMaxValue() - values[i];
                inverseValue[i] = pxsim.math.map(inverseValue[i], 0, this.getMaxValue(), 0, 100);
                inverseValue[i] = pxsim.math.clamp(0, 100, inverseValue[i]);
                svg.setGradientValue(this.colorGradient[i], inverseValue[i] + "%");
                this.reporter[i].textContent = RGB_LETTERS[i] + ": " + `${parseFloat((values[i]).toString()).toFixed(0)}`;
            }
        }

        updateColorLevel(pt: SVGPoint, parent: SVGSVGElement, ev: MouseEvent, index: number) {
            let cur = svg.cursorPoint(pt, parent, ev);
            const bBox = this.rect[index].getBoundingClientRect();
            const height = bBox.height;
            let t = Math.max(0, Math.min(1, (height + bBox.top / this.scaleFactor - cur.y / this.scaleFactor) / height));
            const state = this.state;
            let colorsVal = this.state.getValues();
            colorsVal[index] = t * this.getMaxValue();
            state.setColors(colorsVal);
        }

        getInnerView(parent: SVGSVGElement, globalDefs: SVGDefsElement) {
            this.group = svg.elt("g") as SVGGElement;

            let gc = "gradient-color-" + this.getPort();
            let prevColorGradient: SVGLinearGradientElement[] = [];
            for (let i = 0; i < 3; i++) {
                prevColorGradient[i] = globalDefs.querySelector(`#${gc + "-" + i}`) as SVGLinearGradientElement;
                this.colorGradient[i] = prevColorGradient[i] ? prevColorGradient[i] : svg.linearGradient(globalDefs, gc + "-" + i, false);
                svg.setGradientValue(this.colorGradient[i], "50%");
                svg.setGradientColors(this.colorGradient[i], "black", RGB_COLORS[i]);
            }

            let reporterGroup: SVGElement[] = [];
            for (let i = 0; i < 3; i++) {
                reporterGroup[i] = pxsim.svg.child(this.group, "g");
                reporterGroup[i].setAttribute("transform", `translate(${this.getWidth() / 2}, ${18 + PRINT_OFFSET_H * i})`);
                this.reporter[i] = pxsim.svg.child(reporterGroup[i], "text", { 
                    'text-anchor': 'middle', 
                    'class': 'sim-text number large inverted', 
                    'style': 'font-size: 18px;' 
                }) as SVGTextElement;
            }
            
            let sliderGroup: SVGElement[] = [];
            for (let i = 0; i < 3; i++) {
                sliderGroup[i] = pxsim.svg.child(this.group, "g");
                const translateX = (this.getWidth() / 2 - this.getSliderWidth() / 2 - 36) + 36 * i;
                sliderGroup[i].setAttribute("transform", `translate(${translateX}, ${this.getReporterHeight()})`);
                this.rect[i] = pxsim.svg.child(sliderGroup[i], "rect", {
                    "width": this.getSliderWidth(),
                    "height": this.getSliderHeight(),
                    "style": `fill: url(#${gc + "-" + i})`
                });
            }

            let pt = parent.createSVGPoint();
            for (let i = 0; i < 3; i++) {
                touchEvents(this.rect[i], ev => {
                    if (this.captured && (ev as MouseEvent).clientY) {
                        ev.preventDefault();
                        this.updateColorLevel(pt, parent, ev as MouseEvent, this.capturedIndex);
                    }
                }, ev => {
                    this.captured = true;
                    this.capturedIndex = i;
                    if ((ev as MouseEvent).clientY) {
                        this.rect[i].setAttribute('cursor', '-webkit-grabbing');
                        this.rect[i].setAttribute('class', "rect" + RGB_LETTERS[i]);
                        this.updateColorLevel(pt, parent, ev as MouseEvent, i);
                    }
                }, () => {
                    this.captured = false;
                    this.capturedIndex = -1;
                    this.rect[i].setAttribute('cursor', '-webkit-grab');
                });
            }

            return this.group;
        }
    }
}