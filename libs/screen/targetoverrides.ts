const enum PrintStyle {
    //% block="black on white"
    BlackOnWhite,
    //% block="white on black"
    WhiteOnBlack
}

const enum FontSize {
    //% block="small"
    Small,
    //% block="medium"
    Medium,
    //% block="large"
    Large
}

/**
 * Tagged image literal converter
 */
//% shim=@f4
//% helper=image::ofBuffer
//% groups=["0.,","1#*"]
function img(lits: any, ...args: any[]): Image { 
    return null;
}

const screen = image.create(DAL.LCD_WIDTH, DAL.LCD_HEIGHT);

namespace _screen_internal {

    //% shim=pxt::updateScreen
    function updateScreen(img: Image): void {
        // Pass
    }

    //% shim=pxt::updateStats
    function updateStats(msg: string): void {
        // Pass
    }

    control.__screen.setupUpdate(() => updateScreen(screen));

    control.EventContext.onStats = function (msg: string) {
        updateStats(msg);
    }
}

namespace brick {

    enum ScreenMode {
        None,
        ShowLines,
        Image,
        Ports,
        Custom
    }

    const textOffset = 4;
    const lineOffset = 2;

    let screenMode = ScreenMode.None;
    export let font8 = image.font8;
    export let font16 = image.scaledFont(image.font8, 2);
    export let font32 = image.scaledFont(image.font8, 4);

    /**
     * Gets the text line height
     */
    //%
    export function lineHeight(): number {
        return font8.charHeight + lineOffset;
    }

    /**
     * Number of lines
     */
    //%
    export function lineCount(): number {
        return ((screen.height - textOffset) / lineHeight()) >> 0;
    }

    /**
     * Number of columns
     */
    //%
    export function columnCount(): number {
        return ((screen.width - textOffset) / font8.charWidth) >> 0;
    }

    export function getFont(fontSize: FontSize): image.Font {
        if (fontSize == FontSize.Medium) return font16;
        else if (fontSize == FontSize.Large) return font32;
        else return font8;
    }

    /**
     * Renders white text glyphs on top of an already filled black bounding box.
     *
     * Why this helper is required:
     * On physical EV3 hardware (1 bpp monochrome LCD display), standard `screen.print()`
     * delegates to C++ `_drawIcon` or scaled `fillRect`. In C++, `_drawIcon` uses bitwise OR
     * (`*off |= v`) which can only set bits to 1 (black) and cannot clear them back to 0 (white).
     * Scaled `fillRect(..., color)` treats any non-zero color as 1 (black).
     *
     * By manually traversing the font glyph bitmask and calling `img.fillRect(..., 0)`
     * for active character pixels, C++ executes `*ptr &= ~mask`, which reliably clears
     * the bits to 0 (white) inside the black highlight box on both real EV3 hardware and the web simulator.
     */
    function printWhiteOnBlack(img: Image, text: string, x: number, y: number, font: image.Font) {
        let mult = font.multiplier ? font.multiplier : 1;
        let dataW = Math.idiv(font.charWidth, mult);
        let dataH = Math.idiv(font.charHeight, mult);
        let byteHeight = (dataH + 7) >> 3;
        let charSize = byteHeight * dataW;
        let dataSize = 2 + charSize; // 2 bytes for charcode (UInt16LE) + bitmap data
        let fontdata = font.data;
        let lastchar = Math.idiv(fontdata.length, dataSize) - 1;
        let x0 = x;

        for (let cp = 0; cp < text.length; ++cp) {
            let ch = text.charCodeAt(cp);
            if (ch == 10) { // Newline '\n'
                y += font.charHeight + 2;
                x = x0;
                continue;
            }
            if (ch < 32) continue; // Skip non-printable control characters

            // Locate character glyph in font buffer:
            // Fast direct guess assuming ASCII range starts at char code 32 (space)
            let l = 0;
            let r = lastchar;
            let off = 0;
            let guess = (ch - 32) * dataSize;
            if (guess >= 0 && guess < fontdata.length && fontdata.getNumber(NumberFormat.UInt16LE, guess) == ch) {
                off = guess;
            } else {
                // Binary search fallback for characters outside consecutive ASCII range
                while (l <= r) {
                    let m = l + ((r - l) >> 1);
                    let v = fontdata.getNumber(NumberFormat.UInt16LE, m * dataSize);
                    if (v == ch) {
                        off = m * dataSize;
                        break;
                    }
                    if (v < ch) l = m + 1;
                    else r = m - 1;
                }
            }

            off += 2; // Skip 2-byte char code header to point to bitmap bytes
            // Font data is column-major: decode bit columns and clear pixel runs to 0 (White)
            for (let i = 0; i < dataW; ++i) {
                let j = 0;
                let mask = 0x01;
                let c = fontdata[off++];
                while (j < dataH) {
                    if (mask == 0x100) {
                        c = fontdata[off++];
                        mask = 0x01;
                    }
                    let n = 0;
                    // Count contiguous vertical runs of set bits
                    while (c & mask) {
                        n++;
                        mask <<= 1;
                    }
                    if (n) {
                        // Carve glyph pixels: clear run to 0 (White) inside the black bounding box
                        img.fillRect(x + i * mult, y + j * mult, mult, mult * n, 0);
                        j += n;
                    } else {
                        mask <<= 1;
                        j++;
                    }
                }
            }
            x += font.charWidth;
        }
    }

    /**
     * Show text on the screen at a specific line.
     * @param text the text to print on the screen, eg: "Hello world"
     * @param line the line number to print the text at (starting at 1), eg: 1
     */
    //% blockId=screen_print
    //% block="show string $text|at line $line"
    //% deprecated=true
    //% weight=98
    //% blockGap=8
    //% group="Screen"
    //% help=brick/show-string
    //% inlineInputMode=inline
    //% line.min=1 line.max=12
    export function showString(text: string, line: number) {
        if (screenMode != ScreenMode.ShowLines) {
            screenMode = ScreenMode.ShowLines;
            screen.fill(0);
        }
        
        line = (line - 1) >> 0; // line indexing starts at 1
        const nlines = lineCount();
        if (line < 0 || line > nlines) return; // out of screen

        const h = lineHeight();
        const y = textOffset + h * line;
        screen.fillRect(0, y, screen.width, h, 0); // clear background
        screen.print(text, textOffset, y, 1, font8);
    }

    /**
     * Show a number on the screen
     * @param value the numeric value
     * @param line the line number to print the text at, eg: 1
     */
    //% blockId=screenShowNumber
    //% block="show number %name|at line %line"
    //% deprecated=true
    //% weight=97
    //% blockGap=8
    //% group="Screen"
    //% help=brick/show-number
    //% inlineInputMode=inline
    //% line.min=1 line.max=12
    export function showNumber(value: number, line: number) {
        showString("" + value, line);
    }

    /**
     * Show a name, value pair on the screen
     * @param value the numeric value
     * @param line the line number to print the text at, eg: 1
     */
    
    //% blockId=screenShowValue
    //% block="show value %name|= %text|at line %line"
    //% deprecated=true
    //% weight=96
    //% blockGap=18
    //% group="Screen"
    //% help=brick/show-value
    //% inlineInputMode=inline
    //% line.min=1 line.max=12
    export function showValue(name: string, value: number, line: number) {
        value = Math.round(value * 1000) / 1000;
        showString((name ? name + ": " : "") + value, line);
    }

    /**
     * Show text on the screen on a specific line and starting at a column and the selected print style.
     * @param text the text to print on the screen, eg: "Hello world"
     * @param line the line number to print the text at (starting at 1), eg: 1
     * @param column the column number to print the text at (starting at 1), eg: 1
     * @param fontSize set size of text (2x or 4x font size)
     * @param printStyle print style black on white or white on black
     */
    //% blockId=screenPrintString
    //% block="show string $text|at line $line||column $column|size $fontSize|style $printStyle"
    //% weight=98
    //% blockGap=8
    //% group="Screen"
    //% help=brick/show-string
    //% inlineInputMode=inline
    //% expandableArgumentMode=enabled
    //% line.min=1 line.max=12
    //% column.min=1 column.max=29
    export function printString(text: string, line: number, column: number = 1, fontSize: FontSize = FontSize.Small, printStyle: PrintStyle = PrintStyle.BlackOnWhite) {
        if (screenMode != ScreenMode.ShowLines) {
            screenMode = ScreenMode.ShowLines;
            screen.fill(0);
        }

        line = (line - 1) >> 0; // line indexing starts at 1
        column = (column - 1) >> 0; // column indexing starts at 1
        const nlines = lineCount();
        const nColumn = columnCount();
        if (line < 0 || line > nlines) return; // out of screen by line
        if (column < 0 || column > nColumn) return; // out of screen by column
        
        // Line and column coordinates match the native 8x8 font size, but clearing uses the selected font size
        const selectedFont = getFont(fontSize);
        const x = textOffset + font8.charWidth * column;
        const y = textOffset + lineHeight() * line;
        const mult = selectedFont.multiplier > 1 ? selectedFont.multiplier : 1;
        const width = text.length * selectedFont.charWidth;
        const height = lineHeight() * mult;

        if (printStyle == PrintStyle.WhiteOnBlack) {
            screen.fillRect(x, y, width, height, 1); // Draw solid black background box
            printWhiteOnBlack(screen, text, x, y, selectedFont); // Carve glyph pixels to white (0)
        } else {
            screen.fillRect(x, y, width, height, 0); // Clear background to white
            screen.print(text, x, y, 1, selectedFont); // Draw standard black text
        }
    }

    /**
     * Show a number on the screen on a specific line and starting at a column and the selected print style.
     * @param value the numeric value
     * @param line the line number to print the text at, eg: 1
     * @param column the column number to print the text at (starting at 1), eg: 1
     * @param fontSize set size of text (2x or 4x font size)
     * @param printStyle print style black on white or white on black
     */
    //% blockId=screenPrintNumber
    //% block="show number $value|at line $line||column $column|size $fontSize|style $printStyle"
    //% weight=97
    //% blockGap=8
    //% group="Screen"
    //% help=brick/show-number
    //% inlineInputMode=inline
    //% expandableArgumentMode=enabled
    //% line.min=1 line.max=12
    //% column.min=1 column.max=29
    export function printNumber(value: number, line: number, column: number = 1, fontSize: FontSize = FontSize.Small, printStyle: PrintStyle = PrintStyle.BlackOnWhite) {
        printString("" + value, line, column, fontSize, printStyle);
    }

    /**
     * Show a name, value pair on the screen on a specific line and starting at a column and the selected print style.
     * @param name the value name
     * @param value the numeric value
     * @param line the line number to print the text at, eg: 1
     * @param column the column number to print the text at (starting at 1), eg: 1
     * @param fontSize set size of text (2x or 4x font size)
     * @param printStyle print style black on white or white on black
     */
    //% blockId=screenPrintValue
    //% block="show value $name|= $value|at line $line||column $column|size $fontSize|style $printStyle"
    //% weight=96
    //% blockGap=18
    //% group="Screen"
    //% help=brick/show-value
    //% inlineInputMode=inline
    //% expandableArgumentMode=enabled
    //% line.min=1 line.max=12
    //% column.min=1 column.max=29
    export function printValue(name: string, value: number, line: number, column: number = 1, fontSize: FontSize = FontSize.Small, printStyle: PrintStyle = PrintStyle.BlackOnWhite) {
        value = Math.round(value * 1000) / 1000;
        printString((name ? name + ": " : "") + value, line, column, fontSize, printStyle);
    }

    /**
     * Show an image on the screen
     * @param image image to draw
     * @param duration duration in milliseconds to display the image, eg: 400
     */
    //% blockId=screen_show_image
    //% block="show image %image"
    //% weight=100
    //% blockGap=18
    //% group="Screen"
    //% help=brick/show-image
    //% image.shadow=screen_image_picker
    export function showImage(image: Image, duration: number = 400) {
        if (!image) return;
        screenMode = ScreenMode.Image;
        screen.fill(0);
        screen.drawImage(image, 0, 0);
        if (duration > 0) pause(duration);
    }

    /**
     * Draw an image on the screen at given coordinates.
     * @param image image to draw
     * @param x horizontal position on screen, eg: 0
     * @param y vertical position on screen, eg: 0
     */
    //% blockId=screen_draw_image
    //% block="draw image %image at x $x y $y"
    //% weight=99
    //% blockGap=18
    //% group="Screen"
    //% help=brick/draw-image
    //% inlineInputMode=inline
    //% image.shadow=screen_sprite_image
    export function drawImage(image: Image, x: number = 0, y: number = 0) {
        if (!image) return;
        screenMode = ScreenMode.Custom;
        screen.drawImage(image, x, y);
    }

    /**
     * Returns the width or height of an image
     * @param picture The image to get the width or height of
     * @param dimension The dimension to get
     */
    //% blockId=image_get_dimension
    //% block="$picture $dimension"
    //% weight=98
    //% blockGap=8
    //% group="Screen"
    //% help=images/get-dimension
    //% picture.shadow=screen_sprite_image
    export function imageDimension(picture: Image, dimension: image.Dimension): number {
        return picture ? image.getDimension(picture, dimension) : 0;
    }

    /**
    * Display the status of the sensors and motors attached to ports   
    */
    //% blockId=brickShowPorts
    //% block="show ports"
    //% weight=95
    //% blockGap=18
    //% group="Screen"
    //% help=brick/show-ports
    export function showPorts() {
        if (screenMode == ScreenMode.Ports) return;
        screenMode = ScreenMode.Ports;

        renderPorts();
        control.runInParallel(function () {
            while (screenMode == ScreenMode.Ports) {
                renderPorts();
                pause(50);
            }
        });
    }

    function renderPorts() {
        const col = 44;
        const lineHeight8 = image.font8.charHeight + 2;
        const h = screen.height;

        clearScreen();

        for (let i = 0; i < 4; ++i) {
            const x = i * col + 2;
            if (screenMode != ScreenMode.Ports) return;
            screen.print("ABCD"[i], x, 1 * lineHeight8, 1, image.font8);
            screen.print((i + 1).toString(), x, h - lineHeight8, 1, image.font8);
        }

        if (screenMode != ScreenMode.Ports) return;
        screen.drawLine(0, 5 * lineHeight8, screen.width, 5 * lineHeight8, 1);
        screen.drawLine(0, h - 5 * lineHeight8, screen.width, h - 5 * lineHeight8, 1);

        function scale(x: number) {
            if (Math.abs(x) >= 5000) {
                const k = Math.floor(x / 1000);
                const r = Math.round((x - 1000 * k) / 100);
                return `${k}.${r}k`;
            }
            return ("" + (x || 0));
        }

        // motors
        const datas = motors.getAllMotorData();
        for (let i = 0; i < datas.length; ++i) {
            const data = datas[i];
            const x = i * col + 2;
            if (!data.actualSpeed && !data.count) continue;
            if (screenMode != ScreenMode.Ports) return;
            screen.print(`${scale(data.actualSpeed)}%`, x, 3 * lineHeight8, 1, image.font8);
            screen.print(`${scale(data.count)}>`, x, 4 * lineHeight8, 1, image.font8);
        }

        // sensors
        const sis = sensors.internal.getActiveSensors();
        for (let i = 0; i < sis.length; ++i) {
            const si = sis[i];
            const x = (si.port() - 1) * col + 2;
            const inf = si._info();
            if (screenMode != ScreenMode.Ports) return;
            if (inf.length > 1) {
                let infArr = si._info();
                for (let data = 0, str = Math.min(infArr.length + 1, 4); data < Math.min(infArr.length, 3); data++, str--) {
                    screen.print(infArr[data], x, h - str * lineHeight8, 1, infArr[data].length > 4 ? image.font5 : image.font8);
                }
            } else if (inf[0]) {
                screen.print(inf[0], x, h - 2 * lineHeight8, 1, inf[0].length > 4 ? image.font5 : image.font8);
            }
        }
    }

    /**
     * Clear on the screen at a specific line.
     * @param line the line number to clear at (starting at 1), eg: 1
     */
    //% blockId="clearLine"
    //% block="clear line $line"
    //% weight=94
    //% blockGap=8
    //% group="Screen"
    //% inlineInputMode=inline
    //% line.min=1 line.max=12
    export function clearLine(line: number) {
        if (screenMode != ScreenMode.ShowLines) {
            screenMode = ScreenMode.ShowLines;
            screen.fill(0);
        }

        line = (line - 1) >> 0; // line indexing starts at 1
        const nlines = lineCount();
        if (line < 0 || line > nlines) return; // out of screen by line

        const h = lineHeight();
        const y = textOffset + h * line;
        screen.fillRect(0, y, screen.width, h, 0); // clear background
    }

    /**
     * Clear on the screen at a specific lines (1..12).
     * @param lines list of lines to clear (starting at 1 and ends with 12)
     */
    //% blockId="clearLines"
    //% block="clear lines $lines"
    //% weight=93
    //% blockGap=18
    //% group="Screen"
    //% inlineInputMode=inline
    export function clearLines(lines: number[]) {
        if (screenMode != ScreenMode.ShowLines) {
            screenMode = ScreenMode.ShowLines;
            screen.fill(0);
        }

        for (let i = 0; i < lines.length; i++) {
            clearLine(lines[i]);
        }
    }

    /**
     * Clear the screen
     */
    //% blockId=screen_clear_screen
    //% block="clear screen"
    //% weight=92
    //% group="Screen"
    //% help=brick/clear-screen
    export function clearScreen() {
        screen.fill(0);
    }

    export function showBoot() {
        brick.setStatusLight(StatusLight.GreenPulse); // Pulse green, play startup sound, turn off light
        // We pause to give time to read sensor values, so they work in on_start block
        pause(400); // It turns out that this time is not enough for the simulator to display the LED change and we're ready
        brick.setStatusLight(StatusLight.Off);
        // Always show port by default if no UI is set
        control.runInParallel(function () {
            // Show ports if nothing is has been shown
            if (screenMode != ScreenMode.None) return;
            showPorts();
        })
    }

    /**
     * An image
     * @param image the image
     */
    //% blockId=screen_image_picker
    //% block="%image"
    //% shim=TD_ID
    //% blockHidden=true
    //% weight=0
    //% group="Screen"
    //% image.fieldEditor="images"
    //% image.fieldOptions.columns=6
    //% image.fieldOptions.width=600
    export function __imagePicker(image: Image): Image {
        return image;
    }
}

namespace assets {

    //% helper=getImageByName
    //% pyConvertToTaggedTemplate
    //% blockIdentity="images._spriteImage"
    export function image(lits: any, ...args: any[]): Image {
        return null;
    }
}

namespace helpers {

    export type ImageFactory = (name: string) => Image;

    interface Factory {
        kind: string;
        factory: (name: string) => any;
    }

    let factories: Factory[];

    export function _registerFactory(kind: string, factory: (name: string) => any) {
        if (!factories) factories = [];
        factories.push({
            kind,
            factory
        });
    }

    export function _getFactoryInstance(kind: string, name: string) {
        if (factories) {
            for (const factory of factories) {
                if (factory.kind === kind) {
                    let data = factory.factory(name);
                    if (data) return data;
                }
            }
        }
        return null;
    }

    export function getImageByName(name: string): Image {
        return _getFactoryInstance("image", name);
    }
}
