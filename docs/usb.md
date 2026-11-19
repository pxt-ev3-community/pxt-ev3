# USB WebHID Download

This guide explains how to connect your LEGO® MINDSTORMS® EV3 brick and download programs directly over a USB cable using **WebHID** in BrickCode.

WebHID provides instant, driverless communication with your EV3 brick directly from your web browser, without requiring any background services or additional software.

## Supported Browsers

USB download relies on the standard **WebHID API**, which is built into modern Chromium-based browsers:

* **Google Chrome** (version 89 or higher) — Windows, macOS, ChromeOS, Linux
* **Microsoft Edge** (version 89 or higher) — Windows, macOS, ChromeOS, Linux
* **Opera**, **Brave**, and other Chromium-based browsers

> **Note for Linux users:** While Windows, macOS, and ChromeOS work with zero configuration, Linux requires a one-time `udev` permission rule. See [Linux Setup (udev rules)](#linux-setup) below.

#### ~ hint
WebHID is enabled by default in all modern Chromium browsers. No flags or special configuration changes in `chrome://flags` are needed!
#### ~

## Step 1: Connect your EV3 brick

![Connecting EV3 with USB cable](/static/download/connect.svg)

1. Use a standard **miniUSB** cable (miniUSB to USB-A or USB-C).
2. Connect the miniUSB end to the **PC** port located on top of the EV3 brick (between sensor ports 1–4).
   > **Note:** Do not plug the cable into the standard USB-A port on the side of the brick labeled **Host** (which is reserved for Wi-Fi dongles or daisy-chaining).
3. Connect the other end directly to a USB port on your computer.
4. Turn on the EV3 brick by pressing the center **Enter** button.
5. **Verify connection on the brick screen:** When the EV3 is recognized by your computer, a **USB** icon appears next to the battery indicator in the top-right corner of the LCD screen.

## Step 2: Download your program in BrickCode

1. In BrickCode, click the **Download** button in the bottom-left corner.
2. If prompted with download options, choose **USB** (or click the **'...'** menu next to Download and select **Upload Method > USB WebHID**).
3. When your browser displays the device selection prompt:
   * Select **Xfer data to and from EV3 brick** (Vendor ID `0x0694`, Product ID `0x0005`).
   * Click **Connect**.
4. The program compiles, transfers to the brick, and starts executing immediately!

## Download speed and performance

* **Direct transfer speed:** Around **130–230 KB/s**.
* A typical 100 KB program downloads in just **0.4–0.8 seconds**!
* USB WebHID is the fastest and most reliable download method available in BrickCode.

## Linux Setup (udev rules) #linux-setup

On Windows, macOS, and ChromeOS, USB WebHID works out of the box with zero configuration.

On Linux, raw USB HID devices (`/dev/hidraw*`) are owned by `root` with restricted permissions by default. To allow your web browser to open the EV3 brick as a standard user without `sudo`, you must install a `udev` permission rule:

### 1. Add the udev rule

Run the following command in a terminal to create the rule file:

```bash
echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0694", ATTRS{idProduct}=="0005", MODE="0666", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/99-lego-ev3.rules
```

### 2. Reload and apply rules

Reload the udev rules immediately without rebooting:

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### 3. Reconnect the EV3

Unplug the USB cable from your computer and plug it back in. Your browser will now be able to connect to the EV3 brick directly!

#### ~ hint
### Browser sandbox note (Snap / Flatpak)
If you installed Chromium or Google Chrome through **Snap** (default on Ubuntu) or **Flatpak**, the application sandbox may block access to `/dev/hidraw*` devices even when the udev rule is installed.

If you encounter permission issues, install the native `.deb` or `.rpm` package for your browser (e.g. from the official [Google Chrome](https://www.google.com/chrome/) download page), or configure your package manager to allow raw USB device access for the browser.
#### ~

### No administrator (sudo) privileges?
If you are using a managed Linux computer (such as a school, library, or contest workstation) where you do not have `sudo` access to install udev rules, you can still download your code:
* **[File Transfer (UF2 Drag & Drop)](/troubleshoot):** Connect the EV3 via USB — the `EV3` drive mounts as a standard flash drive without requiring root privileges. Download the `.uf2` file and copy it directly to the drive.
* **[Bluetooth Web Serial](/bluetooth):** Connect your EV3 wirelessly over Bluetooth.

## Troubleshooting

### EV3 is not appearing in the browser device picker
* **Wait for device detection:** When you first connect the USB cable or power on the brick, your operating system may take 2–3 seconds to detect and initialize the USB HID device. Wait a few moments, then click **Download** or **Retry**.
* **Check the cable:** Ensure you are using a data-capable miniUSB cable. Some third-party cables only supply power and cannot transfer data.
* **Check the port:** Verify that the cable is connected to the **PC** miniUSB port on top of the EV3, not the **Host** port.
* **Check the brick screen:** Make sure the **USB** indicator appears next to the battery icon. If it is not showing, try unplugging and firmly reconnecting the cable.
* **Try a direct USB port:** If connecting through an unpowered USB hub or keyboard passthrough, try plugging directly into your computer's motherboard or laptop USB port.

### "Failed to open the device" or Access Denied on Linux
* On Linux, this error indicates missing permissions for `/dev/hidraw*`. Follow the steps in [Linux Setup (udev rules)](#linux-setup) above to install the rule, reload udev, and reconnect the USB cable.
* If using a Snap or Flatpak package of Chrome/Chromium, try using the native `.deb` / `.rpm` package.

### Could not connect or device is busy
* **Close conflicting applications:** Only one application can access the EV3 USB interface at a time. Completely close official LEGO software (**EV3 Lab / MINDSTORMS EV3**, **EV3 Classroom**), other **BrickCode tabs**, or any other tools communicating with the EV3.
* **Exit on-brick apps:** If built-in apps such as **Port View** or **Motor Control** are open on the EV3 brick, press the **Back** button on the brick until you return to the main menu before downloading.
* **Dismiss on-brick pop-ups:** Ensure no modal alert boxes or dialogs are open on the EV3 LCD screen, as they block new programs from launching.

### Custom folder upload
* In BrickCode, you can specify a custom destination directory on the EV3 brick under **Project Settings** (for example, `../prjs/My_Project`). Both USB WebHID and Bluetooth downloads will automatically upload programs into that folder.
