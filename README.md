# rocc-web-ble

A browser-based BLE control and telemetry tool for ROCC dev units, built on the [Web Bluetooth API](https://developer.chrome.com/docs/capabilities/bluetooth). No build step, no dependencies - plain HTML/CSS/JS modules.

Speaks the same BLE protocol as the firmware (`Core/Src/Tasks/ble.c` in `nice-rocc-fw`) and the Flutter companion app (`rocc-ble-data-collect-app`): a single custom GATT service with a notify "status" characteristic and a write "command" characteristic, opcode/tag-prefixed binary frames.

## Platform requirements

- **Windows only.** Web Bluetooth requires Chrome or Edge (any Chromium-based browser); it is not supported in Firefox or on iOS.
- Must be served over `http://localhost` (or another secure context) - opening `index.html` directly via `file://` will not work, Web Bluetooth refuses to run outside a secure context.

## Running it

Any static file server on localhost works, e.g. one of:

```
# Python
python -m http.server 5500

# VS Code "Live Server" extension (see .vscode/launch.json)
```

Then open `http://localhost:5500` (or whatever port) in Chrome/Edge and click **Connect**.

## What it does

- Connects to a device advertising as `NRS-ROCC...` and subscribes to its telemetry stream.
- Shows live left/right channel temps, current, and peltier voltage; battery voltage and discharge current; firmware version, SD card presence, and device UID.
- Lets you set the peltier regulation target temperature (45-65°F) and shows an "At Target"/"Ramping" indicator per channel.
- Toggle between °C/°F display (persisted in `localStorage`).
- Logs telemetry to CSV in-memory and offers it as a download once connected.

## Code layout

```
js/
  ble/            BLE protocol constants + the RoccService connection/parsing class
  state/          Minimal observable state store
  units/          °C/°F conversion + persistence
  logging/        CSV buffering/download
  ui/             One module per card/control, each subscribes to the store
  main.js         Wires it all together
```
