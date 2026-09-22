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

let text = '';

const scanButton = document.getElementById('scanButton');
const deviceList = document.getElementById('deviceList');
const downloadButton = document.getElementById('downloadBtn');

const csvRows = [];
let headersWritten = false;
const connectedDevices = {};

function objectToCSVRow(obj, includeHeader = false) {
  const timestamp = new Date().toISOString(); // current UTC timestamp
  const keys = Object.keys(obj);
  const values = Object.values(obj);

  let rows = '';

  if (includeHeader) {
    rows += ['Timestamp', ...keys].join(',') + '\n';
  }

  rows += [timestamp, ...values].join(',') + '\n';
  return rows;
}

function handleIncomingData(data) {
    // Write headers only once
    if (!headersWritten) {
        csvRows.push(objectToCSVRow(data, true));
        headersWritten = true;
        downloadButton.style.display = 'inline-block';
    } else {
        csvRows.push(objectToCSVRow(data));
    }
}

document.getElementById('connectRocc').addEventListener('click', async () => {
    try {
        const customDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NRS-ROCC' }],
            optionalServices: [serviceUUID]
        });
        await connectToDevice(customDevice, 'rocc');
    } catch (error) {
        console.error(error);
    }
});

document.getElementById('connectThermometer').addEventListener('click', async () => {
    try {
        const thermometerDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['health_thermometer'] }],
            optionalServices: ['battery_service']
        });
        await connectToDevice(thermometerDevice, 'thermometer');
    } catch (error) {
        console.error(error);
    }
});

document.getElementById('connectHeartRate').addEventListener('click', async () => {
    try {
        const heartRateDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }],
            optionalServices: ['battery_service']
        });
        await connectToDevice(heartRateDevice, 'heartRate');
    } catch (error) {
        console.error(error);
    }
});


scanButton.addEventListener('click', async () => {
    clearDeviceList();

    try {
        alert("Select your ROCC");
        // Connect to custom RTYK device
        const customDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NRS-ROCC' }],
            optionalServices: [serviceUUID] // Replace with actual UUID
        });
        connectedDevices.custom = await connectToDevice(customDevice, 'custom');

        // Connect to Health Thermometer
        alert("Now select the Health Thermometer");
        const thermometerDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['health_thermometer'] }],
            optionalServices: ['battery_service']
        });
        connectedDevices.thermometer = await connectToDevice(thermometerDevice, 'thermometer');

        // Connect to Heart Rate Monitor
        alert("Finally, select the Heart Rate Monitor");
        const heartRateDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['heart_rate'] }],
            optionalServices: ['battery_service']
        });
        connectedDevices.heartRate = await connectToDevice(heartRateDevice, 'heartRate');

    } catch (error) {
        console.error("Error during BLE device selection:", error);
    }
});

// Create and download CSV Blob
downloadButton.addEventListener('click', () => {
    const blob = new Blob(csvRows, { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'streamed_data.csv';
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

async function discoverRoccServices(server) {
    try {
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

async function connectToDevice11(device) {
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

async function connectToDevice(device, label) {
    const server = await device.gatt.connect();
    console.log(`${label} connected:`, device.name);

    switch (label) {
        case 'thermometer':
            const thermometerService = await server.getPrimaryService('health_thermometer');
            const tempChar = await thermometerService.getCharacteristic('temperature_measurement');
            await tempChar.startNotifications();
            tempChar.addEventListener('characteristicvaluechanged', event => {
                const value = parseTemperature(event.target.value);
                console.log(`Temperature: ${value.toFixed(2)} °C`);
                const tempData = parseTemperatureMeasurement(event.target.value);
                console.log(`Temperature: ${tempData.temperature.toFixed(2)} ${tempData.unit}`);
            });
            break;

        case 'heartRate':
            const heartService = await server.getPrimaryService('heart_rate');
            const hrChar = await heartService.getCharacteristic('heart_rate_measurement');
            await hrChar.startNotifications();
            hrChar.addEventListener('characteristicvaluechanged', event => {
                const bpm = parseHeartRate(event.target.value);
                console.log(`Heart Rate: ${bpm} bpm`);
            });
            break;

        case 'rocc':
            discoverRoccServices(server).then(() => {
            enableOpsLog().then(success => {
                if (success == false) {
                    appendLog("Failed to enable OpsLog.");
                }
            });
        }).catch(error => {
            console.error('Connection error:', error);
            alert('Connection failed: ' + error.message);
        });
            break;
    }

    return device;
}

// Helper: Parse temperature (IEEE-11073 32-bit float)
function parseTemperature(value) {
    const data = new DataView(value.buffer);
    console.log(`Raw temperature data: ${bufferToHex(value.buffer)}`);
    const flag = data.getUint8(0);
    const tempRaw = data.getUint32(1, true); // Little endian
    return tempRaw * 0.01;
}

function parseTemperatureMeasurement(value) {
    const dataView = new DataView(value.buffer);
    const flags = dataView.getUint8(0);
    const unitIsFahrenheit = flags & 0x01;

    // Extract Mantissa (3 bytes), Little Endian
    const mantissa =
        dataView.getUint8(1) |
        (dataView.getUint8(2) << 8) |
        (dataView.getUint8(3) << 16);

    // Sign extend 24-bit integer
    const signedMantissa = (mantissa & 0x800000) ? (mantissa | 0xFF000000) : mantissa;

    // Exponent is signed 8-bit int
    const exponent = dataView.getInt8(4);

    const temperature = signedMantissa * Math.pow(10, exponent);

    return {
        temperature,
        unit: unitIsFahrenheit ? "°F" : "°C"
    };
}

// Helper: Parse Heart Rate (8-bit format)
function parseHeartRate(value) {
    const data = new DataView(value.buffer);
    const flags = data.getUint8(0);
    const hrFormat = flags & 0x01;
    return hrFormat === 1 ? data.getUint16(1, true) : data.getUint8(1);
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
            
            handleIncomingData(opsLog);
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

