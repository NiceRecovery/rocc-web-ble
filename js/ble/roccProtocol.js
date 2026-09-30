// BLE protocol constants for the ROCC device.
//
// Mirrors the firmware's GATT layout and opcode/tag enums 1:1 - keep in
// sync with Core/Src/Ble/gatt_db.c (UUIDs) and Core/Src/Tasks/ble.c/ble.h
// (command opcodes, status tags, frame layouts) in the nice-rocc-fw repo,
// and with rocc_protocol.dart in the Flutter app (same protocol, second
// client). There is a single custom GATT service with two characteristics
// - a notify "status" channel and a write "command" channel - everything
// is multiplexed through those two as opcode/tag-prefixed binary frames.

export const RoccProtocol = {
  serviceUuid: 'd973f2e0-b19e-11e2-9e96-0800200c9a66',
  statusCharUuid: 'd973f2e1-b19e-11e2-9e96-0800200c9a66',
  commandCharUuid: 'd973f2e2-b19e-11e2-9e96-0800200c9a66',
};

export const RoccCommand = {
  streamEnable: 0x80,
  streamDisable: 0x81,
  vibSequence: 0x82,
  sysInfoReq: 0x83,
  stateChange: 0x84,
  battChrgReq: 0x85,
  // Payload: int16 LE, tenths of deg F. Firmware clamps and echoes the
  // accepted value back via a fresh RoccStatus.sysInfo notification.
  targetTempSet: 0x86,
};

export const RoccStatus = {
  opsLog: 0xa0,
  userSw: 0xa1,
  stateChange: 0xa2,
  sysInfo: 0xa3,
  accel: 0xa4,
  battChrg: 0xa5,
  err: 0xfe,
};

// Sanity bounds for the target temperature, mirroring
// TARGET_TEMP_MIN_F/TARGET_TEMP_MAX_F in control_peltier.c.
export const RoccLimits = {
  targetTempMinF: 45.0,
  targetTempMaxF: 65.0,
};
