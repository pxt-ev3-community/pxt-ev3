// Master brick: connect and send speed every second
bluetooth.connectToBrick("EV3-Slave")

loops.forever(function () {
    bluetooth.sendNumberMessage("speed", 75)
    pause(1000)
})

// Slave brick: receive speed and drive motors
bluetooth.onNumberReceived("speed", function (receivedSpeed) {
    motors.largeAB.run(receivedSpeed)
})
