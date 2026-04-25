/// <reference path="../node_modules/pxt-core/localtypings/pxtblockly.d.ts"/>

const pxtblockly = pxt.blocks.requirePxtBlockly()
const Blockly = pxt.blocks.requireBlockly();

export interface FieldColorEnumOptions {
    className?: string;
}

export class FieldColorEnum extends pxtblockly.FieldColorNumber {

    public isFieldCustom_ = true;

    private paramsData: any[];
    private className_: string;

    private static colorNonePatternCreated = false;

    constructor(text: string, params: FieldColorEnumOptions) {
        super(text, params as any);

        this.paramsData = params["data"];
        this.className_ = params.className;
        
        if (!FieldColorEnum.colorNonePatternCreated) {
            FieldColorEnum.colorNonePatternCreated = true;
            const svg = document.querySelector(".blocklySvg") as SVGSVGElement;
            if (svg) {
                let defs = svg.querySelector("defs");
                if (!defs) {
                    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
                    svg.prepend(defs);
                }

                if (!defs.querySelector("#legoColorNonePattern")) {
                    defs.insertAdjacentHTML("beforeend", `
                        <pattern id="legoColorNonePattern" width="1.2" height="1.2" x="-0.1" y="-0.1" viewBox="0 0 1 1" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox">
                            <rect width="1" height="1" fill="#ffffff"/>
                            <rect width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.5" y="0" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.25" y="0.25" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.75" y="0.25" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0" y="0.5" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.5" y="0.5" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.25" y="0.75" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <rect x="0.75" y="0.75" width="0.25" height="0.25" fill="#cfd8dc"/>
                            <line x1="0" y1="1" x2="1" y2="0" stroke="#ff3b30" stroke-width="0.08" stroke-linecap="round"/>
                        </pattern>
                    `);
                }
            }
        }
    }

    mapColour(enumString: string) {
        switch(enumString) {
            case '#000000': return 'ColorSensorColor.Black';
            case '#006db3': return 'ColorSensorColor.Blue';
            case '#00934b': return 'ColorSensorColor.Green';
            case '#ffd01b': return 'ColorSensorColor.Yellow';
            case '#f12a21': return 'ColorSensorColor.Red';
            case '#ffffff': return 'ColorSensorColor.White';
            case '#6c2d00': return 'ColorSensorColor.Brown';
            default: return 'ColorSensorColor.None';
        }
    }

    mapEnum(colorString: string) {
        switch(colorString) {
            case 'ColorSensorColor.Black': return '#000000';
            case 'ColorSensorColor.Blue': return '#006db3';
            case 'ColorSensorColor.Green': return '#00934b';
            case 'ColorSensorColor.Yellow': return '#ffd01b';
            case 'ColorSensorColor.Red': return '#f12a21';
            case 'ColorSensorColor.White': return '#ffffff';
            case 'ColorSensorColor.Brown': return '#6c2d00';
            case 'ColorSensorColor.None': return '#dfe6e9';
            default: return colorString;
        }
    }

    rgbToHex(rgb: string) {
        const result = rgb.match(/\d+/g);
        if (!result) return rgb;
        return "#" + result.map(x => parseInt(x).toString(16).padStart(2, "0")).join("");
    }

    showEditor_() {
        super.showEditor_();
        const picker = Blockly.DropDownDiv.getContentDiv().childNodes[0] as HTMLElement;
        if (this.className_ && picker) {
            pxt.BrowserUtils.addClass(picker as HTMLElement, this.className_);
        }
        const colorCells = picker.querySelectorAll('.blocklyColourSwatch');
        colorCells.forEach((cell) => {
            const rgbColor = window.getComputedStyle(cell as HTMLElement).backgroundColor;
            const hexColor = this.rgbToHex(rgbColor);
            const titleName = this.mapColour(hexColor);
            const index = this.paramsData.findIndex(item => item[1] === titleName);
            if (index === -1) return;
            const enumName = this.paramsData[index][1]?.replace("ColorSensorColor.", "") ?? "None";
            cell.classList.add(`legoColor${enumName}`);
            cell.setAttribute("title", this.paramsData[index][0]);
        });
    }

    doValueUpdate_(colour: string) {
        super.doValueUpdate_(colour);
        this.applyColour();
    }

    applyColour() {
        if (this.borderRect_) {
            this.borderRect_.style.fill = this.value_;
        } else if (this.sourceBlock_) {
            (this.sourceBlock_ as any)?.pathObject?.svgPath?.setAttribute('fill', this.value_);
            (this.sourceBlock_ as any)?.pathObject?.svgPath?.setAttribute('stroke', '#fff');
        }
    };

    /**
     * Return the current colour.
     * @param {boolean} opt_asHex optional field if the returned value should be a hex
     * @return {string} Current colour in '#rrggbb' format.
     */
    getValue(opt_asHex?: boolean) {
        const colour = this.mapColour(this.value_);
        if (!opt_asHex && colour.indexOf('#') > -1) {
            return `0x${colour.replace(/^#/, '')}`;
        }
        return colour;
    }

    /**
     * Set the colour.
     * @param {string} colour The new colour in '#rrggbb' format.
     */
    setValue(colorStr: string) {
        // Convert 0xHEX -> #HEX
        if (colorStr && colorStr.startsWith("0x")) {
            colorStr = "#" + colorStr.substring(2);
        }
        // Enum -> HEX
        if (colorStr && colorStr.startsWith("ColorSensorColor.")) {
            colorStr = this.mapEnum(colorStr);
        }
        let sourceBlock = this.sourceBlock_ as any;
        if (sourceBlock && Blockly.Events.isEnabled() && this.value_ != colorStr) {
            Blockly.Events.fire(new (Blockly as any).Events.BlockChange(sourceBlock, 'field', this.name, this.value_, colorStr));
        }
        this.value_ = colorStr;
        if (sourceBlock) {
            sourceBlock.setColour(colorStr);
            const group = sourceBlock.svgGroup;
            if (group) {
                // Remove old color classes
                group.classList.forEach((c: string) => {
                    if (c.startsWith("legoColor")) group.classList.remove(c);
                });
                // Get enum name and set as class
                const enumName = this.mapColour(colorStr)?.replace("ColorSensorColor.", "") ?? "None";
                sourceBlock.svgGroup?.classList.add("legoColor" + enumName);
            }
        }
    }
    
}