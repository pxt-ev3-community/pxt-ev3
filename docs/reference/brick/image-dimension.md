# Image Dimension

Get the width or height of an image in pixels.

```sig
brick.imageDimension(null, image.Dimension.Width)
```

## Parameters

* **picture**: the [Image](/types/image) to measure.
* **dimension**: the dimension to get, either `Width` or `Height`.

## Returns

* a [number](/types/number) that is the width or height of the image in pixels.

## Example

Get the dimensions of an image and print them on the screen.

```blocks
let myImage = img`
    . 1 1 .
    1 . . 1
    1 . . 1
    . 1 1 .
`
let w = brick.imageDimension(myImage, image.Dimension.Width)
let h = brick.imageDimension(myImage, image.Dimension.Height)
brick.showValue("width", w, 1)
brick.showValue("height", h, 2)
```

## See also

[draw image](/reference/brick/draw-image), [show image](/reference/brick/show-image)
