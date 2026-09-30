import { RoccProtocol, RoccCommand, RoccStatus, RoccLimits } from './roccProtocol.js';

/**
 * Owns the actual navigator.bluetooth calls: connect, discover, subscribe,
 * parse notifications, and write commands. Reports everything up through
 * plain callbacks (onConnectionChange/onTelemetry/onSysInfo) rather than
 * touching the DOM directly - see js/main.js for how those feed the store.
 */
export class RoccService {
  constructor() {
    this.device = null;
    this.commandChar = null;
    this.statusChar = null;

    this.onConnectionChange = () => {};
    this.onTelemetry = () => {};
    this.onSysInfo = () => {};

    this._handleNotification = this._handleNotification.bind(this);
    this._handleDisconnected = this._handleDisconnected.bind(this);
  }

  get connected() {
    return this.device?.gatt?.connected ?? false;
  }

  async connect() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NRS-ROCC' }],
      optionalServices: [RoccProtocol.serviceUuid],
    });

    this.device = device;
    device.addEventListener('gattserverdisconnected', this._handleDisconnected);

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(RoccProtocol.serviceUuid);

    this.commandChar = await service.getCharacteristic(RoccProtocol.commandCharUuid);
    this.statusChar = await service.getCharacteristic(RoccProtocol.statusCharUuid);

    await this.statusChar.startNotifications();
    this.statusChar.addEventListener('characteristicvaluechanged', this._handleNotification);

    this.onConnectionChange(true);

    // Start telemetry streaming and fetch FW version/target temp/etc. up
    // front, so the UI isn't stuck waiting for the next periodic push.
    await this._writeCommand([RoccCommand.streamEnable]);
    await this._writeCommand([RoccCommand.sysInfoReq]);
  }

  disconnect() {
    this.device?.gatt?.disconnect();
  }

  async requestSysInfo() {
    await this._writeCommand([RoccCommand.sysInfoReq]);
  }

  /**
   * Sets the peltier regulation target temperature over BLE. Clamped
   * client-side to RoccLimits before it's ever sent, though the firmware
   * clamps again and is the source of truth for the accepted value (echoed
   * back via a fresh RoccStatus.sysInfo notification).
   */
  async setTargetTempF(tempF) {
    if (!this.commandChar) return false;

    const clamped = Math.min(
      Math.max(tempF, RoccLimits.targetTempMinF),
      RoccLimits.targetTempMaxF,
    );
    const tenths = Math.round(clamped * 10);

    const payload = new DataView(new ArrayBuffer(2));
    payload.setInt16(0, tenths, true);

    await this._writeCommand([
      RoccCommand.targetTempSet,
      payload.getUint8(0),
      payload.getUint8(1),
    ]);
    return true;
  }

  _handleDisconnected() {
    this.commandChar = null;
    this.statusChar = null;
    this.onConnectionChange(false);
  }

  async _writeCommand(bytes) {
    if (!this.commandChar) {
      console.error('Command characteristic not available');
      return false;
    }
    try {
      await this.commandChar.writeValue(new Uint8Array(bytes));
      return true;
    } catch (err) {
      console.error('Failed to write command:', err);
      return false;
    }
  }

  _handleNotification(event) {
    const data = event.target.value;
    const tag = data.getUint8(0);

    switch (tag) {
      case RoccStatus.opsLog: {
        const telemetry = this._parseOpsLog(data);
        if (telemetry) this.onTelemetry(telemetry);
        break;
      }
      case RoccStatus.sysInfo: {
        const info = this._parseSysInfo(data);
        if (info) this.onSysInfo(info);
        break;
      }
      case RoccStatus.userSw:
        console.log('UserSw event');
        break;
      case RoccStatus.stateChange:
        console.log('State changed to', data.getUint8(1));
        break;
      case RoccStatus.accel:
        console.log('Accel event', data.getUint8(1));
        break;
      case RoccStatus.battChrg:
        console.log('Battery/charger status received (not parsed yet)');
        break;
      default:
        console.warn('Unknown BLE status tag:', tag);
    }
  }

  _parseOpsLog(data) {
    if (data.byteLength < 52) {
      console.warn('OpsLog frame too short:', data.byteLength);
      return null;
    }

    let index = 1;
    const readFloat = () => {
      const v = data.getFloat32(index, true);
      index += 4;
      return v;
    };
    const readUint32 = () => {
      const v = data.getUint32(index, true);
      index += 4;
      return v;
    };
    const readUint16 = () => {
      const v = data.getUint16(index, true);
      index += 2;
      return v;
    };
    const readUint8 = () => data.getUint8(index++);
    const f2c = (f) => ((f - 32) * 5) / 9;

    const left = {
      'temp1-left': f2c(readFloat()),
      'temp2-left': f2c(readFloat()),
      'sink-left': f2c(readFloat()),
      'current-left': readFloat(), // already Amps
    };
    const right = {
      'temp1-right': f2c(readFloat()),
      'temp2-right': f2c(readFloat()),
      'sink-right': f2c(readFloat()),
      'current-right': readFloat(), // already Amps
    };

    const voltage = readUint32() / 1000.0; // mV -> V

    // Ambient temp/humidity sensor is no longer populated by the firmware
    // - skip past the two placeholder floats without surfacing them.
    readFloat();
    readFloat();

    const peltvoltLeft = readUint16() / 1000.0; // mV -> V
    const peltvoltRight = readUint16() / 1000.0; // mV -> V
    const dischargeCurrent = readUint16() / 1000.0; // mA -> A
    const regulatingFlags = readUint8();

    return {
      ...left,
      ...right,
      voltage,
      'peltvolt-left': peltvoltLeft,
      'peltvolt-right': peltvoltRight,
      'discharge-current': dischargeCurrent,
      'regulating-left': (regulatingFlags & 0x01) !== 0,
      'regulating-right': (regulatingFlags & 0x02) !== 0,
    };
  }

  _parseSysInfo(data) {
    if (data.byteLength < 20) {
      console.warn('SysInfo frame too short:', data.byteLength);
      return null;
    }

    const major = data.getUint8(1);
    const minor = data.getUint8(2);
    const build = data.getUint8(3);

    const uidW0 = data.getUint32(4, true);
    const uidW1 = data.getUint32(8, true);
    const uidW2 = data.getUint32(12, true);
    const mcuUid = [uidW0, uidW1, uidW2]
      .map((w) => w.toString(16).padStart(8, '0'))
      .join('');

    const opState = data.getUint8(16);
    const fileioInitialized = data.getUint8(17) !== 0;
    const targetTempF = data.getInt16(18, true) / 10.0;

    return {
      fwVersion: `${major}.${minor}.${build}`,
      mcuUid,
      opState,
      fileioInitialized,
      targetTempF,
    };
  }
}
