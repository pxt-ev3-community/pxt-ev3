# Brick

## Screen

```cards
brick.showMood(moods.sleeping);
brick.showImage(images.expressionsBigSmile);
brick.drawImage(null, 0, 0);
brick.imageDimension(null, image.Dimension.Width);
brick.showString("Hello world!", 1);
brick.showNumber(0, 1);
brick.showValue("item", 0, 1);
brick.clearScreen();
brick.showPorts();
```

## Buttons

```cards
brick.buttonEnter.onEvent(ButtonEvent.Bumped, function () {

});
brick.buttonEnter.pauseUntil(ButtonEvent.Bumped);
brick.buttonEnter.isPressed()
brick.setStatusLight(StatusLight.Red);
brick.buttonEnter.wasPressed()
```

## Other

```cards
brick.batteryLevel()
```
