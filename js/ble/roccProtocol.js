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

  // Dev-tooling-only "advanced mode" commands - direct low-level overrides
  // mirroring the serial console commands of the same rough shape
  // (fanl/r, vregl/r, peltlc/rc, vdtgains, dtconst). Compiled into the
  // firmware only under BLE_ENABLED (dev builds), never present on prod
  // units. side: 0 = left, 1 = right.
  fanPwmSet: 0x87, // [side, pwm 0-100]
  peltierEnable: 0x88, // [side, 0/1]
  peltierVoltageSet: 0x89, // [side, mv u16 LE]
  peltierVoltageStop: 0x8a, // [side]
  peltierCurrentSet: 0x8b, // [side, amps*1000 u16 LE]
  peltierCurrentStop: 0x8c, // [side]
  voltageDtGainSet: 0x8d, // [mV/F*10 int16 LE]
  dtShapingConstSet: 0x8e, // [k*1000 int16 LE]
  advTelemetryEnable: 0x8f,
  advTelemetryDisable: 0x90,
};

export const RoccStatus = {
  opsLog: 0xa0,
  userSw: 0xa1,
  stateChange: 0xa2,
  sysInfo: 0xa3,
  accel: 0xa4,
  battChrg: 0xa5,
  // Dev-tooling-only "advanced mode" telemetry (fan RPM/PWM, battery temp,
  // error type) - only sent once a client opts in via advTelemetryEnable.
  advLog: 0xa6,
  err: 0xfe,
};

// side bytes shared by every advanced-mode command above.
export const RoccSide = {
  LEFT: 0,
  RIGHT: 1,
};

// Op-state codes, mirroring ops_state_code_t in operation.h - used both
// for BLE_CMD_STATE_CHANGE and as sysInfo.opState/advLog context.
export const OpStateCode = {
  cool: 0x10,
  startup: 0x11,
  ready: 0x12,
  active: 0x13,
  charge: 0x14,
  sleep: 0x15,
  playDead: 0x16, // "test" state - what the serial `state test` command reaches
  error: 0x17,
  invalid: 0xff,
};

// Mirrors err_type_t in state_manager.h.
export const ErrorType = {
  none: 0,
  coolTimeout: 1,
  fanFail: 2,
  peltFail: 3,
  battCrit: 4,
};

export const ErrorTypeLabel = {
  [ErrorType.none]: 'None',
  [ErrorType.coolTimeout]: 'Cool timeout',
  [ErrorType.fanFail]: 'Fan failure',
  [ErrorType.peltFail]: 'Peltier failure',
  [ErrorType.battCrit]: 'Battery critical',
};

// Sanity bounds for the target temperature, mirroring
// TARGET_TEMP_MIN_F/TARGET_TEMP_MAX_F in control_peltier.c.
export const RoccLimits = {
  targetTempMinF: 45.0,
  targetTempMaxF: 65.0,
};
