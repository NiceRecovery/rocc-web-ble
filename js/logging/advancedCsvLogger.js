// CSV logging for Advanced Mode - mirrors the C# Custom Test tool's CSV
// shape (a config header block, then one row per sample) but as a single
// combined file with a Side column instead of separate Left/Right files,
// simpler for a one-click web download.
//
// Rows are kept in their canonical wire units (sensor/battery temps in
// Celsius, target temp in Fahrenheit) and only converted to whichever unit
// is selected in the UI at export time, so the exported file always
// matches what's on screen when you hit Download.

import { fromCelsius, fromFahrenheit, labelFor } from '../units/temperatureUnit.js';

function columnOrder(unit) {
  const u = labelFor(unit);
  return [
    'Timestamp',
    'RunTime_s',
    'Side',
    'Mode',
    `Temp1_${u}`,
    `Temp2_${u}`,
    `Sink_${u}`,
    'Current_A',
    'PeltierV',
    'FanRpm',
    'FanPwm_pct',
    `BatteryTemp_${u}`,
    `TargetTemp_${u}`,
    'Regulating',
    'DeviceState',
    'ErrorType',
  ];
}

export class AdvancedCsvLogger {
  constructor() {
    this.rows = [];
    this.config = null;
  }

  reset() {
    this.rows = [];
    this.config = null;
  }

  get hasData() {
    return this.rows.length > 0;
  }

  /** config.targetTempF (if present) is converted at export time like everything else. */
  logSessionConfig(config) {
    this.config = config;
  }

  logSample({ side, runTimeS, mode, roccData, advTelemetry, sysInfo }) {
    this.rows.push({ side, runTimeS, mode, roccData, advTelemetry, sysInfo });
  }

  toCsvString(unit) {
    const fixed = (v, digits = 2) => (typeof v === 'number' ? v.toFixed(digits) : '');
    const temp = (celsius) => fixed(celsius != null ? fromCelsius(celsius, unit) : null, 1);

    const configLines = this.config
      ? Object.entries(this.config).map(([k, v]) => {
          if (k === 'TargetTempF' && typeof v === 'number') {
            return `Target Temp (${labelFor(unit)}),${fromFahrenheit(v, unit).toFixed(1)}`;
          }
          return `${k},${v}`;
        })
      : [];

    const dataRows = this.rows.map(({ side, runTimeS, mode, roccData, advTelemetry, sysInfo }) => [
      new Date().toISOString(),
      runTimeS.toFixed(1),
      side,
      mode,
      temp(roccData?.[`temp1-${side}`]),
      temp(roccData?.[`temp2-${side}`]),
      temp(roccData?.[`sink-${side}`]),
      fixed(roccData?.[`current-${side}`]),
      fixed(roccData?.[`peltvolt-${side}`]),
      advTelemetry ? (side === 'left' ? advTelemetry.fanRpmLeft : advTelemetry.fanRpmRight) : '',
      advTelemetry ? (side === 'left' ? advTelemetry.fanPwmLeft : advTelemetry.fanPwmRight) : '',
      temp(roccData?.['battery-temp']),
      sysInfo?.targetTempF != null ? fromFahrenheit(sysInfo.targetTempF, unit).toFixed(1) : '',
      roccData?.[`regulating-${side}`] ? 'true' : 'false',
      sysInfo?.opState ?? '',
      advTelemetry?.errorType ?? '',
    ]);

    const lines = [...configLines, '', columnOrder(unit), ...dataRows].map((row) =>
      Array.isArray(row) ? row.join(',') : row,
    );
    return lines.join('\r\n') + '\r\n';
  }

  download(unit, filename = `rocc_advanced_test_${Date.now()}.csv`) {
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
