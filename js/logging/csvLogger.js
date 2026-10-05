// Buffers one row per parsed OpsLog telemetry frame and offers it as a
// Blob download - the web equivalent of the Flutter app's DataLoggerService
// + share sheet (a browser download is the natural "get the file out of
// the tool" action here; the user can attach it to an email manually).
//
// Rows are kept in their canonical wire units (sensor temps in Celsius,
// target temp in Fahrenheit - same as roccData/sysInfo elsewhere) and only
// converted to whichever unit is selected in the UI at export time, so the
// exported file always matches what's on screen when you hit Download.

import { fromCelsius, fromFahrenheit, labelFor } from '../units/temperatureUnit.js';

function columnOrder(unit) {
  const u = labelFor(unit);
  return [
    'Timestamp',
    `TargetTemp_${u}`,
    `Temp1L_${u}`,
    `Temp2L_${u}`,
    `SinkL_${u}`,
    'CurrentL',
    'PeltierL',
    'RegulatingL',
    `Temp1R_${u}`,
    `Temp2R_${u}`,
    `SinkR_${u}`,
    'CurrentR',
    'PeltierR',
    'RegulatingR',
    'DischargeCurrent',
    'Voltage',
    `BatteryTemp_${u}`,
    'TimeToTarget_s',
  ];
}

export class CsvLogger {
  constructor() {
    this.rows = [];
  }

  reset() {
    this.rows = [];
  }

  get hasData() {
    return this.rows.length > 0;
  }

  /** roccData/targetTempF are stored as-is (canonical units) - conversion happens at export. */
  logSnapshot(roccData, targetTempF) {
    this.rows.push({ timestamp: new Date().toISOString(), roccData, targetTempF });
  }

  toCsvString(unit) {
    const fixed = (v, digits = 2) => (typeof v === 'number' ? v.toFixed(digits) : '');
    const bool = (v) => (v ? 'true' : 'false');
    const temp = (celsius) => fixed(celsius != null ? fromCelsius(celsius, unit) : null, 1);

    const dataRows = this.rows.map(({ timestamp, roccData, targetTempF }) => [
      timestamp,
      fixed(targetTempF != null ? fromFahrenheit(targetTempF, unit) : null, 1),
      temp(roccData['temp1-left']),
      temp(roccData['temp2-left']),
      temp(roccData['sink-left']),
      fixed(roccData['current-left']),
      fixed(roccData['peltvolt-left']),
      bool(roccData['regulating-left']),
      temp(roccData['temp1-right']),
      temp(roccData['temp2-right']),
      temp(roccData['sink-right']),
      fixed(roccData['current-right']),
      fixed(roccData['peltvolt-right']),
      bool(roccData['regulating-right']),
      fixed(roccData['discharge-current']),
      fixed(roccData['voltage']),
      temp(roccData['battery-temp']),
      roccData['time-to-target-ms'] != null ? (roccData['time-to-target-ms'] / 1000).toFixed(1) : '',
    ]);

    const lines = [columnOrder(unit), ...dataRows].map((row) => row.join(','));
    return lines.join('\r\n') + '\r\n';
  }

  download(unit, filename = `rocc_log_${Date.now()}.csv`) {
    const blob = new Blob([this.toCsvString(unit)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
}
