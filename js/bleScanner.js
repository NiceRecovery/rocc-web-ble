import { displayDevice, clearDeviceList, appendLog, overwriteLog, renderOpsLogCard } from './ui.js';

const BleStatus = {
    OpsLog: 0xA0,
    UserSw: 0xA1,
    StateChange: 0xA2,
    SystemInfo: 0xA3,
    AccelEvt: 0xA4,
    BattChargerStatus: 0xA5,
};

function parseOpsLog(dataView) {
    let index = 1;
    const readFloat = () => {
        const val = dataView.getFloat32(index, true); index += 4; return val;
    };
    const readUint32 = () => {
        const val = dataView.getUint32(index, true); index += 4; return val;
    };
    const readUint16 = () => {
        const val = dataView.getUint16(index, true); index += 2; return val;
    };

    return {
        LeftTherm1: readFloat(),
        LeftTherm2: readFloat(),
        LeftSinkTemp: readFloat(),
        LeftPeltCurrent: readFloat(),

        RightTherm1: readFloat(),
        RightTherm2: readFloat(),
        RightSinkTemp: readFloat(),
        RightPeltCurrent: readFloat(),

        BattVolt: readUint32(),

        AmbTemperature: readFloat(),
        AmbHumidity: readFloat(),

        LeftPeltVolt: readUint16(),
        RightPeltVolt: readUint16(),

        DischargeCurrent: readUint16()
    };
}


const serviceUUID = 'd973f2e0-b19e-11e2-9e96-0800200c9a66';
const commandCharUUID = 'd973f2e2-b19e-11e2-9e96-0800200c9a66';
const statusCharUUID = 'd973f2e1-b19e-11e2-9e96-0800200c9a66';

let commandCharacteristic;
let statusCharacteristic;

const scanButton = document.getElementById('scanButton');
const deviceList = document.getElementById('deviceList');

scanButton.addEventListener('click', async () => {
    clearDeviceList();

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NRS-ROCC' }],
            optionalServices: [serviceUUID]
        });

        connectToDevice(device).then(() => {
            //appendLog(`Connected to ${device.name}`);

            enableOpsLog().then(success => {
                if (success == false) {
                    appendLog("Failed to enable OpsLog.");
                }
            });
        }).catch(error => {
            console.error('Connection error:', error);
            alert('Connection failed: ' + error.message);
        });

    } catch (error) {
        console.error('Scan failed:', error);
        alert('Scan failed or cancelled: ' + error.message);
    }
});

async function connectToDevice(device) {
    try {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(serviceUUID);

        commandCharacteristic = await service.getCharacteristic(commandCharUUID);
        statusCharacteristic = await service.getCharacteristic(statusCharUUID);

        await statusCharacteristic.startNotifications();
        statusCharacteristic.addEventListener('characteristicvaluechanged', handleNotification);

    } catch (error) {
        console.error('Connection error:', error);
        alert('Connection failed: ' + error.message);
    }
}

function handleNotification(event) {
    const dataView = event.target.value;
    const byte0 = dataView.getUint8(0);

    //console.log("🔔 Notification received:", bufferToHex(dataView.buffer));

    switch (byte0) {
        case BleStatus.OpsLog:
            if (dataView.byteLength < 45) {
                console.warn("OpsLog too short");
                break;
            }
            const opsLog = parseOpsLog(dataView);
            //console.log("📘 OpsLog:", opsLog);
            //overwriteLog(`${JSON.stringify(opsLog)}`);
            // for (const [key, value] of Object.entries(opsLog)) {
            //     console.log(`   ${key}: ${value}`);
            //   }
            renderOpsLogCard(opsLog);
            break;

        case BleStatus.UserSw:
            console.log("🟢 UserSw Event Triggered");
            break;

        case BleStatus.StateChange:
            const newState = dataView.getUint8(1);
            console.log("🔄 State Changed to:", newState);
            break;

        case BleStatus.SystemInfo:
            console.log("ℹ️ System Info received (not handled)");
            break;

        case BleStatus.AccelEvt:
            const accelStatus = dataView.getUint8(1);
            console.log("📈 Accel Event:", accelStatus);
            break;

        case BleStatus.BattChargerStatus:
            console.log("🔋 Battery/Charger status received (not handled)");
            break;

        default:
            console.warn("❓ Unknown BLE status:", byte0);
            break;
    }
}

function bufferToHex(buffer) {
    return [...new Uint8Array(buffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
  }
  

async function writeCommand(commandByteArray) {
    if (!commandCharacteristic) {
      console.error("Command characteristic not available");
      return false;
    }
  
    try {
      const value = new Uint8Array(commandByteArray);
      await commandCharacteristic.writeValue(value);
      console.log(`➡️ Sent command: ${bufferToHex(value.buffer)}`);
      return true;
    } catch (err) {
      console.error("Failed to write command:", err);
      return false;
    }
  }
  
  async function enableOpsLog() {
    const CMD_ENABLE_OPSLOG = 0x80;
  
    const success = await writeCommand([CMD_ENABLE_OPSLOG]);
    if (!success) {
      appendLog("❌ Failed to send EnableOpsLog command");
      return false;
    }
  
    return true;
  }
  
