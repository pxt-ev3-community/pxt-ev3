namespace pxsim.visuals {

    interface ColorGridItem {
        id: string;
        value: number;
        fill: string;
        stroke?: string;
        opacity?: string;
    }

    const COLOR_ITEMS: ColorGridItem[] = [
        { id: 'red', value: 5, fill: '#f12a21' },
        { id: 'yellow', value: 4, fill: '#ffd01b' },
        { id: 'blue', value: 2, fill: '#006db3' },
        { id: 'green', value: 3, fill: '#00934b' },
        { id: 'black', value: 1, fill: '#000' },
        { id: 'brown', value: 7, fill: '#6c2d00' },
        { id: 'white', value: 6, fill: '#fff', stroke: '#94989b' },
        { id: 'none', value: 0, fill: '#fff', stroke: '#94989b', opacity: '0%' }
    ];

    export class ColorGridControl extends ControlView<ColorSensorNode> {
        
        private group: SVGGElement;

        private colorDivs: Element[] = [];

        getInnerView() {
            this.group = svg.elt("g") as SVGGElement;
            this.group.setAttribute("transform", `translate(2, 2.5) scale(0.6)`);
            this.colorDivs = [];

            let cy = -4;
            for (let c = 0; c < COLOR_ITEMS.length; c++) {
                const item = COLOR_ITEMS[c];
                const cx = c % 2 == 0 ? 2.2 : 7.5;
                if (c % 2 == 0) cy += 5;
                
                const circleWrapper = pxsim.svg.child(this.group, "g");
                const style = `fill: ${item.fill};` + (item.opacity ? ` fill-opacity: ${item.opacity};` : "");

                const circle = pxsim.svg.child(circleWrapper, "circle", {
                    'class': `sim-color-grid-circle sim-color-grid-${item.id}`,
                    'cx': cx,
                    'cy': cy,
                    'r': 2,
                    'style': style
                });
                this.colorDivs.push(circle);

                if (item.stroke) {
                    pxsim.svg.child(circleWrapper, "circle", {
                        'cx': cx,
                        'cy': cy,
                        'r': 2,
                        'style': `fill: none; stroke: ${item.stroke}; stroke-width: 0.1px`
                    });
                }

                pointerEvents.down.forEach(evid => circleWrapper.addEventListener(evid, () => {
                    this.setColor(item.value);
                }));
            }
            return this.group;
        }

        getInnerWidth() {
            return 9.5;
        }

        getInnerHeight() {
            return 15;
        }

        public updateState() {
            if (!this.visible) return;

            const node = this.state;
            const color = node.getValue();

            for (let c = 0; c < COLOR_ITEMS.length; c++) {
                const colorDiv = this.colorDivs[c] as HTMLElement;
                if (COLOR_ITEMS[c].value === color) {
                    pxsim.U.addClass(colorDiv, 'sim-color-selected');
                } else {
                    pxsim.U.removeClass(colorDiv, 'sim-color-selected');
                }
            }
        }

        private setColor(color: number) {
            const currentColor = this.state.getValue();
            this.state.setColor(currentColor === color ? 0 : color);
        }
    }
}