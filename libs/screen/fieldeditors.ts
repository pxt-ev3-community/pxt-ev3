namespace images {

    /**
     * An image.
     */
    //% blockId=screen_sprite_image
    //% block="%img"
    //% shim=TD_ID
    //% img.fieldEditor="sprite"
    //% img.fieldOptions.taggedTemplate="img"
    //% img.fieldOptions.decompileIndirectFixedInstances="true"
    //% img.fieldOptions.decompileArgumentAsString="true"
    //% img.fieldOptions.filter="!tile !dialog !background"
    //% img.fieldOptions.sizes="16,16;32,32;64,64;178,128"
    //% weight=100
    //% group="Create"
    //% duplicateShadowOnDrag
    //% help=images/sprite-image
    export function _spriteImage(img: Image): Image {
        return img;
    }

    /**
     * Create a new empty image
     * @param width width of the image
     * @param height height of the image
     */
    //% blockId=image_create
    //% block="create image width $width height $height"
    //% weight=95
    //% group="Create"
    //% width.defl=16 height.defl=16
    //% help=images/create
    export function createImage(width: number, height: number): Image {
        return image.create(width, height);
    }

    /**
     * Returns a copy of the image.
     * @param picture The image to clone
     */
    //% blockId=image_clone
    //% block="clone $picture"
    //% weight=85
    //% group="Create"
    //% picture.shadow=variables_get
    //% picture.defl=picture
    //% help=images/clone
    export function cloneImage(picture: Image): Image {
        return picture ? picture.clone() : null;
    }

    function prepareImage(picture: Image): boolean {
        if (!picture) return false;
        if (picture === screen) {
            brick.setCustomScreenMode();
        }
        return true;
    }

    /**
     * Clear all pixels in image
     * @param picture The image to clear
     */
    //% blockId=image_clear
    //% block="$picture clear"
    //% weight=50
    //% group="Transform"
    //% picture.shadow=screen_image
    //% help=images/clear
    export function clearImage(picture: Image): void {
        if (prepareImage(picture)) picture.fill(0);
    }

    /**
     * The brick screen image
     */
    //% blockId=screen_image
    //% block="screen"
    //% weight=95
    //% group="Draw"
    //% help=images/screen-image
    export function screenImage(): Image {
        return screen;
    }

    /**
     * Draw an image onto another image
     * @param picture The target image
     * @param from The image to draw
     * @param x destination X
     * @param y destination Y
     */
    //% blockId=image_draw_image
    //% block="$picture draw $from at x $x y $y"
    //% weight=90
    //% group="Draw"
    //% inlineInputMode=inline
    //% picture.shadow=variables_get
    //% picture.defl=picture
    //% from.shadow=screen_sprite_image
    //% x.defl=0 y.defl=0
    //% help=images/draw-image
    export function drawOnImage(picture: Image, from: Image, x: number, y: number): void {
        if (prepareImage(picture) && from) picture.drawImage(from, x, y);
    }

    /**
     * Draw a line on an image
     * @param picture The image to draw on
     * @param x0 start x
     * @param y0 start y
     * @param x1 end x
     * @param y1 end y
     * @param width line thickness, eg: 1
     */
    //% blockId=image_draw_line
    //% block="$picture draw line from x $x0 y $y0 to x $x1 y $y1||width $width"
    //% weight=85
    //% group="Draw"
    //% inlineInputMode=inline
    //% expandableArgumentMode=toggle
    //% picture.shadow=screen_image
    //% x0.defl=0 y0.defl=0 x1.defl=10 y1.defl=10
    //% width.defl=1 width.min=1 width.max=10
    //% help=images/draw-line
    export function drawLine(picture: Image, x0: number, y0: number, x1: number, y1: number, width: number = 1): void {
        if (!prepareImage(picture)) return;
        x0 |= 0;
        y0 |= 0;
        x1 |= 0;
        y1 |= 0;
        width = Math.max(1, width | 0);
        if (width <= 1) {
            picture.drawLine(x0, y0, x1, y1, 1);
            return;
        }
        let dx = x1 - x0;
        let dy = y1 - y0;
        let len = Math.sqrt(dx * dx + dy * dy);
        let half = width / 2;
        if (len === 0) {
            let hf = (width - 1) >> 1;
            picture.fillRect(x0 - hf, y0 - hf, width, width, 1);
            return;
        }

        let nx = (-dy / len) * half;
        let ny = (dx / len) * half;

        let px0 = x0 + nx, py0 = y0 + ny;
        let px1 = x1 + nx, py1 = y1 + ny;
        let px2 = x1 - nx, py2 = y1 - ny;
        let px3 = x0 - nx, py3 = y0 - ny;

        let minY = Math.max(0, Math.floor(Math.min(py0, Math.min(py1, Math.min(py2, py3)))));
        let maxY = Math.min(picture.height - 1, Math.ceil(Math.max(py0, Math.max(py1, Math.max(py2, py3)))));

        let px = [px0, px1, px2, px3];
        let py = [py0, py1, py2, py3];

        for (let y = minY; y <= maxY; ++y) {
            let x0Min = 10000;
            let x0Max = -10000;
            let j = 3;
            for (let i = 0; i < 4; ++i) {
                let y0e = py[j], y1e = py[i];
                let x0e = px[j], x1e = px[i];
                if ((y0e <= y && y1e > y) || (y1e <= y && y0e > y)) {
                    let x = x0e + (y - y0e) * (x1e - x0e) / (y1e - y0e);
                    if (x < x0Min) x0Min = x;
                    if (x > x0Max) x0Max = x;
                }
                j = i;
            }
            if (x0Min <= x0Max) {
                let ix0 = Math.max(0, Math.round(x0Min));
                let ix1 = Math.min(picture.width - 1, Math.round(x0Max));
                if (ix0 <= ix1) {
                    picture.drawLine(ix0, y, ix1, y, 1);
                }
            }
        }
    }

    /**
     * Draw a rectangle outline on an image
     * @param picture The image to draw on
     * @param x top-left x
     * @param y top-left y
     * @param w width
     * @param h height
     * @param width line thickness, eg: 1
     */
    //% blockId=image_draw_rect
    //% block="$picture draw rectangle at x $x y $y width $w height $h||width $width"
    //% weight=80
    //% group="Draw"
    //% inlineInputMode=inline
    //% expandableArgumentMode=toggle
    //% picture.shadow=screen_image
    //% x.defl=0 y.defl=0 w.defl=20 h.defl=20
    //% width.defl=1 width.min=1 width.max=10
    //% help=images/draw-rect
    export function drawRect(picture: Image, x: number, y: number, w: number, h: number, width: number = 1): void {
        if (!prepareImage(picture)) return;
        x |= 0;
        y |= 0;
        w |= 0;
        h |= 0;
        width = Math.max(1, width | 0);
        if (w < 0) { x += w; w = -w; }
        if (h < 0) { y += h; h = -h; }
        if (w === 0 || h === 0) return;

        if (width <= 1) {
            picture.drawRect(x, y, w, h, 1);
            return;
        }

        if (2 * width >= w || 2 * width >= h) {
            picture.fillRect(x, y, w, h, 1);
            return;
        }

        // Top bar
        picture.fillRect(x, y, w, width, 1);
        // Bottom bar
        picture.fillRect(x, y + h - width, w, width, 1);
        // Left bar
        picture.fillRect(x, y + width, width, h - 2 * width, 1);
        // Right bar
        picture.fillRect(x + w - width, y + width, width, h - 2 * width, 1);
    }

    /**
     * Fill a rectangle on an image
     * @param picture The image to draw on
     * @param x top-left x
     * @param y top-left y
     * @param w width
     * @param h height
     */
    //% blockId=image_fill_rect
    //% block="$picture fill rectangle at x $x y $y width $w height $h"
    //% weight=75
    //% group="Draw"
    //% inlineInputMode=inline
    //% picture.shadow=screen_image
    //% x.defl=0 y.defl=0 w.defl=20 h.defl=20
    //% help=images/fill-rect
    export function fillRect(picture: Image, x: number, y: number, w: number, h: number): void {
        if (prepareImage(picture)) {
            if (w < 0) { x += w; w = -w; }
            if (h < 0) { y += h; h = -h; }
            picture.fillRect(x, y, w, h, 1);
        }
    }

    /**
     * Draw a circle outline on an image
     * @param picture The image to draw on
     * @param cx center x
     * @param cy center y
     * @param r radius
     * @param width line thickness, eg: 1
     */
    //% blockId=image_draw_circle
    //% block="$picture draw circle at cx $cx cy $cy radius $r||width $width"
    //% weight=70
    //% group="Draw"
    //% inlineInputMode=inline
    //% expandableArgumentMode=toggle
    //% picture.shadow=screen_image
    //% cx.defl=10 cy.defl=10 r.defl=5
    //% width.defl=1 width.min=1 width.max=10
    //% help=images/draw-circle
    export function drawCircle(picture: Image, cx: number, cy: number, r: number, width: number = 1): void {
        if (!prepareImage(picture)) return;
        cx |= 0;
        cy |= 0;
        r = Math.abs(r | 0);
        width = Math.max(1, width | 0);

        if (r === 0) {
            if (width <= 1) {
                picture.setPixel(cx, cy, 1);
            } else {
                fillCircle(picture, cx, cy, (width - 1) >> 1);
            }
            return;
        }

        if (width <= 1) {
            let x = 0;
            let y = r;
            let d = 3 - 2 * r;

            while (y >= x) {
                picture.setPixel(cx + x, cy + y, 1);
                picture.setPixel(cx - x, cy + y, 1);
                picture.setPixel(cx + x, cy - y, 1);
                picture.setPixel(cx - x, cy - y, 1);
                picture.setPixel(cx + y, cy + x, 1);
                picture.setPixel(cx - y, cy + x, 1);
                picture.setPixel(cx + y, cy - x, 1);
                picture.setPixel(cx - y, cy - x, 1);
                if (d > 0) {
                    d += 4 * (x - y) + 10;
                    y--;
                } else {
                    d += 4 * x + 6;
                }
                x++;
            }
            return;
        }

        const rOut = r + ((width - 1) >> 1);
        const rIn = rOut - width + 1;
        const rInner = rIn - 1;

        if (rInner < 0) {
            fillCircle(picture, cx, cy, rOut);
            return;
        }

        const computeXSpans = (rad: number): number[] => {
            const spans: number[] = [];
            for (let i = 0; i <= rad; ++i) spans.push(0);
            let x = 0;
            let y = rad;
            let d = 3 - 2 * rad;
            while (y >= x) {
                if (x > spans[y]) spans[y] = x;
                if (y > spans[x]) spans[x] = y;
                if (d > 0) {
                    d += 4 * (x - y) + 10;
                    y--;
                } else {
                    d += 4 * x + 6;
                }
                x++;
            }
            return spans;
        };

        const xOuter = computeXSpans(rOut);
        const xInner = computeXSpans(rInner);

        const drawH = (x0: number, x1: number, yPos: number) => {
            if (yPos < 0 || yPos >= picture.height) return;
            x0 = Math.max(0, x0);
            x1 = Math.min(picture.width - 1, x1);
            if (x0 <= x1) {
                picture.drawLine(x0, yPos, x1, yPos, 1);
            }
        };

        for (let dy = 0; dy <= rOut; ++dy) {
            const xOut = xOuter[dy];
            const hasHole = dy <= rInner;
            const yTop = cy - dy;
            const yBottom = cy + dy;

            if (hasHole) {
                const xIn = xInner[dy];
                // Left span
                drawH(cx - xOut, cx - xIn - 1, yTop);
                // Right span
                drawH(cx + xIn + 1, cx + xOut, yTop);
                if (dy !== 0) {
                    drawH(cx - xOut, cx - xIn - 1, yBottom);
                    drawH(cx + xIn + 1, cx + xOut, yBottom);
                }
            } else {
                // Full span across the circle
                drawH(cx - xOut, cx + xOut, yTop);
                if (dy !== 0) {
                    drawH(cx - xOut, cx + xOut, yBottom);
                }
            }
        }
    }

    /**
     * Fill a circle on an image
     * @param picture The image to draw on
     * @param cx center x
     * @param cy center y
     * @param r radius
     */
    //% blockId=image_fill_circle
    //% block="$picture fill circle at cx $cx cy $cy radius $r"
    //% weight=65
    //% group="Draw"
    //% inlineInputMode=inline
    //% picture.shadow=screen_image
    //% cx.defl=10 cy.defl=10 r.defl=5
    //% help=images/fill-circle
    export function fillCircle(picture: Image, cx: number, cy: number, r: number): void {
        if (!prepareImage(picture)) return;
        cx |= 0;
        cy |= 0;
        r = Math.abs(r | 0);
        if (r === 0) {
            picture.setPixel(cx, cy, 1);
            return;
        }
        let x = 0;
        let y = r;
        let d = 3 - 2 * r;

        const drawH = (x0: number, x1: number, yPos: number) => {
            if (yPos < 0 || yPos >= picture.height) return;
            x0 = Math.max(0, x0);
            x1 = Math.min(picture.width - 1, x1);
            if (x0 <= x1) {
                picture.drawLine(x0, yPos, x1, yPos, 1);
            }
        };

        while (y >= x) {
            drawH(cx - x, cx + x, cy - y);
            drawH(cx - x, cx + x, cy + y);
            drawH(cx - y, cx + y, cy - x);
            drawH(cx - y, cx + y, cy + x);
            if (d > 0) {
                d += 4 * (x - y) + 10;
                y--;
            } else {
                d += 4 * x + 6;
            }
            x++;
        }
    }
}
