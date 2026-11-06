# Draw Image

Draw an image on the brick's screen at specified coordinates.

```sig
brick.drawImage(null, 0, 0)
```

You can draw an image directly on the screen at specified X and Y coordinates. The sprite editor lets you draw custom monochrome pixel art, or you can supply an image asset created in the Asset Editor.

## Parameters

* **image**: an [Image](/types/image) to draw on the screen. Click on the image parameter in the block to open the pixel art editor, or select an asset from "My Assets".
* **x**: the horizontal position on the screen to start drawing (0 to 177).
* **y**: the vertical position on the screen to start drawing (0 to 127).

## Example

Draw a custom smiley face image at position `(30, 20)` on the screen.

```blocks
brick.drawImage(img`
    . . . . . . . . . . . . . . . .
    . . . . 1 1 1 1 1 1 . . . . . .
    . . 1 1 . . . . . . 1 1 . . . .
    . 1 . . . . . . . . . . 1 . . .
    . 1 . 1 1 . . . . 1 1 . 1 . . .
    1 . . 1 1 . . . . 1 1 . . 1 . .
    1 . . . . . . . . . . . . 1 . .
    1 . . . . . . . . . . . . 1 . .
    1 . . 1 . . . . . . 1 . . 1 . .
    1 . . . 1 . . . . 1 . . . 1 . .
    . 1 . . . 1 1 1 1 . . . 1 . . .
    . 1 . . . . . . . . . . 1 . . .
    . . 1 1 . . . . . . 1 1 . . . .
    . . . . 1 1 1 1 1 1 . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
`, 30, 20)
```

## See also

[show image](/reference/brick/show-image), [image dimension](/reference/brick/image-dimension), [clear screen](/reference/brick/clear-screen)
