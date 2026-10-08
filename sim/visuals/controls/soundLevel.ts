namespace pxsim.visuals {

    export class SoundLevelControl extends ControlView<NXTSoundSensorNode> {

        private group: SVGGElement;
        private soundGradient: SVGLinearGradientElement;
        private reporter: SVGTextElement;
        private rect: SVGElement;

        getInnerWidth() {
            return 111;
        }

        getInnerHeight() {
            return 192;
        }

        private getReporterHeight() {
            return 38;
        }

        private getSliderWidth() {
            return 62;
        }

        private getSliderHeight() {
            return 131;
        }

        private getMinValue(state: NXTSoundSensorNode) {
            if (state.getMode() == NXTSoundSensorMode.Db) return state.loudDb;
            else if (state.getMode() == NXTSoundSensorMode.DbA) return state.loudDbA;
            return 0;
        }

        private getMaxValue(state: NXTSoundSensorNode) {
            if (state.getMode() == NXTSoundSensorMode.RawDb || state.getMode() == NXTSoundSensorMode.RawDbA) {
                return 4095;
            } else if (state.getMode() == NXTSoundSensorMode.Db) {
                return state.silentDb;
            } else if (state.getMode() == NXTSoundSensorMode.DbA) {
                return state.silentDbA;
            }
            return 100;
        }

        updateState() {
            if (!this.visible) return;

            const node = this.state;
            const value = node.getValue();
            let inverseValue = this.getMaxValue(node) - value + this.getMinValue(node);
            if (node.getMode() == NXTSoundSensorMode.RawDb || node.getMode() == NXTSoundSensorMode.RawDbA) {
                inverseValue = pxsim.math.map(inverseValue, 0, 4095, 0, 100);
                inverseValue = pxsim.math.clamp(0, 100, inverseValue);
                svg.setGradientValue(this.soundGradient, inverseValue + "%");
                this.reporter.textContent = `${Math.floor(parseFloat(value.toString()))}`;
            } else if (node.getMode() == NXTSoundSensorMode.Db) {
                inverseValue = pxsim.math.map(inverseValue, node.silentDb, node.loudDb, 0, 100);
                inverseValue = pxsim.math.clamp(0, 100, inverseValue);
                svg.setGradientValue(this.soundGradient, inverseValue + "%");
                this.reporter.textContent = `${Math.floor(pxsim.math.map(parseFloat(value.toString()), this.getMaxValue(node), this.getMinValue(node), 0, 100))}%`;
            } else if (node.getMode() == NXTSoundSensorMode.DbA) {
                inverseValue = pxsim.math.map(inverseValue, node.silentDbA, node.loudDbA, 0, 100);
                inverseValue = pxsim.math.clamp(0, 100, inverseValue);
                svg.setGradientValue(this.soundGradient, inverseValue + "%");
                this.reporter.textContent = `${Math.floor(pxsim.math.map(parseFloat(value.toString()), this.getMaxValue(node), this.getMinValue(node), 0, 100))}%`;
            }
        }

        updateSoundLevel(pt: SVGPoint, parent: SVGSVGElement, ev: MouseEvent) {
            const state = this.state;
            let cur = svg.cursorPoint(pt, parent, ev);
            const bBox = this.rect.getBoundingClientRect();
            const height = bBox.height;
            let t = Math.max(0, Math.min(1, (height + bBox.top / this.scaleFactor - cur.y / this.scaleFactor) / height));
            if (state.getMode() == NXTSoundSensorMode.Db || state.getMode() == NXTSoundSensorMode.DbA) {
                t = 1 - t;
            }
            state.setValue(this.getMinValue(state) + t * (this.getMaxValue(state) - this.getMinValue(state)));
        }

        getInnerView(parent: SVGSVGElement, globalDefs: SVGDefsElement) {
            this.group = svg.elt("g") as SVGGElement;

            let gc = "gradient-sound-" + this.getPort();
            const prevSoundGradient = globalDefs.querySelector(`#${gc}`) as SVGLinearGradientElement;
            this.soundGradient = prevSoundGradient ? prevSoundGradient : svg.linearGradient(globalDefs, gc, false);
            svg.setGradientValue(this.soundGradient, "50%");
            svg.setGradientColors(this.soundGradient, "#1e293b", "#06b6d4");

            const reporterGroup = pxsim.svg.child(this.group, "g");
            reporterGroup.setAttribute("transform", `translate(${this.getWidth() / 2}, 20)`);
            this.reporter = pxsim.svg.child(reporterGroup, "text", {
                'text-anchor': 'middle',
                'x': 0,
                'y': 0,
                'class': 'sim-text number large inverted'
            }) as SVGTextElement;

            const sliderGroup = pxsim.svg.child(this.group, "g");
            sliderGroup.setAttribute("transform", `translate(${this.getWidth() / 2 - this.getSliderWidth() / 2}, ${this.getReporterHeight()})`);

            const rect = pxsim.svg.child(sliderGroup, "rect", {
                "width": this.getSliderWidth(),
                "height": this.getSliderHeight(),
                "style": `fill: url(#${gc})`
            });
            this.rect = rect;

            let pt = parent.createSVGPoint();
            let captured = false;
            touchEvents(rect, ev => {
                if (captured && (ev as MouseEvent).clientY) {
                    ev.preventDefault();
                    this.updateSoundLevel(pt, parent, ev as MouseEvent);
                }
            }, ev => {
                captured = true;
                if ((ev as MouseEvent).clientY) {
                    rect.setAttribute('cursor', '-webkit-grabbing');
                    this.updateSoundLevel(pt, parent, ev as MouseEvent);
                }
            }, () => {
                captured = false;
                rect.setAttribute('cursor', '-webkit-grab');
            });

            return this.group;
        }
    }
}