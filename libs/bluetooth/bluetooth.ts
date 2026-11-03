/**
 * Data type for a mailbox message
 */
const enum MailboxDataType {
    //% block="text"
    Text = 0,
    //% block="number"
    Number = 1,
    //% block="logic"
    Logic = 2
}


/**
 * Bluetooth brick-to-brick messaging using Mailbox.
 */
//% color="#0082DB"
//% icon="\uf293"
//% weight=75
//% groups='["Connection", "Send", "Receive", "Mailbox"]'
namespace bluetooth {

    /**
     * Connect to another EV3 brick by its name over Bluetooth.
     * @param brickName name of the brick to connect to, eg: "EV3"
     */
    //% blockId=btConnectToBrick
    //% block="connect to brick $brickName"
    //% shim=bluetooth::connectToBrick
    //% weight=100
    //% group="Connection"
    //% brickName.defl="EV3"
    export function connectToBrick(brickName: string): void {
        return;
    }

    /**
     * Returns true if connected to the specified brick.
     * @param brickName name of the brick to check, eg: "EV3"
     */
    //% blockId=btIsConnected
    //% block="bluetooth connected to $brickName"
    //% shim=bluetooth::isConnected
    //% weight=90
    //% group="Connection"
    //% brickName.defl="EV3"
    export function isConnected(brickName: string): boolean {
        return false;
    }

    /**
     * Disconnect from a specific brick.
     * @param brickName name of the brick to disconnect, eg: "EV3"
     */
    //% blockId=btDisconnect
    //% block="disconnect from brick $brickName"
    //% shim=bluetooth::disconnectBrick
    //% weight=80
    //% group="Connection"
    //% brickName.defl="EV3"
    export function disconnectBrick(brickName: string): void {
        return;
    }

    /**
     * Returns the status of the Bluetooth connection.
     */
    //% blockId=btStatus
    //% block="bluetooth status"
    //% shim=bluetooth::status
    //% weight=75
    //% group="Connection"
    export function status(): string {
        return "";
    }

    /**
     * Send a text message to a mailbox on all connected bricks.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param value the text to send, eg: "hello"
     */
    //% blockId=btSendText
    //% block="send text $value to mailbox $mailbox"
    //% shim=bluetooth::sendTextMessage
    //% mailbox.defl="mailbox1"
    //% weight=100
    //% group="Send"
    //% value.defl="hello"
    export function sendTextMessage(mailbox: string, value: string): void {
        return;
    }

    /**
     * Send a number to a mailbox on all connected bricks.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param value the number to send, eg: 0
     */
    //% blockId=btSendNumber
    //% block="send number $value to mailbox $mailbox"
    //% shim=bluetooth::sendNumberMessage
    //% weight=90
    //% group="Send"
    //% value.defl=0
    //% mailbox.defl="mailbox1"
    export function sendNumberMessage(mailbox: string, value: number): void {
        return;
    }

    /**
     * Send a logic (true/false) value to a mailbox on all connected bricks.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param value the logic value to send
     */
    //% blockId=btSendLogic
    //% block="send logic $value to mailbox $mailbox"
    //% shim=bluetooth::sendLogicMessage
    //% weight=80
    //% group="Send"
    //% mailbox.defl="mailbox1"
    export function sendLogicMessage(mailbox: string, value: boolean): void {
        return;
    }

    /**
     * Run code when a text message is received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param handler code to run when a message arrives
     */
    //% blockId=btOnTextReceived
    //% block="on text received $receivedText in mailbox $mailbox"
    //% weight=100
    //% group="Receive"
    //% draggableParameters="reporter"
    //% mailbox.defl="mailbox1"
    export function onTextReceived(mailbox: string, handler: (receivedText: string) => void): void {
        const evSrc = _registerMailboxHandler(mailbox, MailboxDataType.Text);
        if (evSrc < 0) return;
        control.onEvent(evSrc, 0, () => {
            const text = readTextMessage(mailbox);
            handler(text);
        });
    }

    /**
     * Run code when a number is received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param handler code to run when a number arrives
     */
    //% blockId=btOnNumberReceived
    //% block="on number received $receivedNumber in mailbox $mailbox"
    //% weight=90
    //% group="Receive"
    //% draggableParameters="reporter"
    //% mailbox.defl="mailbox1"
    export function onNumberReceived(mailbox: string, handler: (receivedNumber: number) => void): void {
        const evSrc = _registerMailboxHandler(mailbox, MailboxDataType.Number);
        if (evSrc < 0) return;
        control.onEvent(evSrc, 0, () => {
            const num = readNumberMessage(mailbox);
            handler(num);
        });
    }

    /**
     * Run code when a logic value is received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     * @param handler code to run when a logic value arrives
     */
    //% blockId=btOnLogicReceived
    //% block="on logic received $receivedLogic in mailbox $mailbox"
    //% weight=80
    //% group="Receive"
    //% draggableParameters="reporter"
    //% mailbox.defl="mailbox1"
    export function onLogicReceived(mailbox: string, handler: (receivedLogic: boolean) => void): void {
        const evSrc = _registerMailboxHandler(mailbox, MailboxDataType.Logic);
        if (evSrc < 0) return;
        control.onEvent(evSrc, 0, () => {
            const logic = readLogicMessage(mailbox);
            handler(logic);
        });
    }

    /**
     * Read the last text message received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     */
    //% blockId=btReadText
    //% block="read text from mailbox $mailbox"
    //% shim=bluetooth::readTextMessage
    //% weight=70
    //% group="Mailbox"
    //% mailbox.defl="mailbox1"
    export function readTextMessage(mailbox: string): string {
        return "";
    }

    /**
     * Read the last number received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     */
    //% blockId=btReadNumber
    //% block="read number from mailbox $mailbox"
    //% shim=bluetooth::readNumberMessage
    //% weight=60
    //% group="Mailbox"
    //% mailbox.defl="mailbox1"
    export function readNumberMessage(mailbox: string): number {
        return 0;
    }

    /**
     * Read the last logic (boolean) value received in the specified mailbox.
     * @param mailbox the mailbox name, eg: "mailbox1"
     */
    //% blockId=btReadLogic
    //% block="read logic from mailbox $mailbox"
    //% shim=bluetooth::readLogicMessage
    //% weight=50
    //% group="Mailbox"
    //% mailbox.defl="mailbox1"
    export function readLogicMessage(mailbox: string): boolean {
        return false;
    }

    /**
     * Internal: register a mailbox receive handler; returns the pxt event source id.
     */
    //% shim=bluetooth::_registerMailboxHandler
    //% blockHidden=1
    export function _registerMailboxHandler(mailbox: string, dataType: number): number {
        return -1;
    }
}
