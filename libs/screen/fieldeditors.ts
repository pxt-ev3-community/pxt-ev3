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
    //% group="Screen"
    //% blockNamespace="brick"
    //% duplicateShadowOnDrag
    //% help=images/sprite-image
    export function _spriteImage(img: Image): Image {
        return img;
    }
}
