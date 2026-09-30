// Buffers one CSV row per parsed OpsLog telemetry frame and offers it as a
// Blob download - the web equivalent of the Flutter app's DataLoggerService
// + share sheet (a browser download is the natural "get the file out of
// the tool" action here; the user can attach it to an email manually).
//
// Column order is fixed (not derived from Object.keys(), which free-orders
// whatever a parsed object happens to have) and matches the Flutter app's
// CSV headers so logs from either client are directly comparable.

const HEADERS = [
  'Timestamp',
  'TargetTempF',
  'Temp1L',
  'Temp2L',
  'SinkL',
  'CurrentL',
  'PeltierL',
  'RegulatingL',
  'Temp1R',
  'Temp2R',
  'SinkR',
  'CurrentR',
  'PeltierR',
  'RegulatingR',
  'DischargeCurrent',
  'Voltage',
];

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

  logSnapshot(roccData, targetTempF) {
    const fixed = (v, digits = 2) => (typeof v === 'number' ? v.toFixed(digits) : '');
    const bool = (v) => (v ? 'true' : 'false');

    const row = [
      new Date().toISOString(),
      targetTempF != null ? targetTempF.toFixed(1) : '',
      fixed(roccData['temp1-left']),
      fixed(roccData['temp2-left']),
      fixed(roccData['sink-left']),
      fixed(roccData['current-left']),
      fixed(roccData['peltvolt-left']),
      bool(roccData['regulating-left']),
      fixed(roccData['temp1-right']),
      fixed(roccData['temp2-right']),
      fixed(roccData['sink-right']),
      fixed(roccData['current-right']),
      fixed(roccData['peltvolt-right']),
      bool(roccData['regulating-right']),
      fixed(roccData['discharge-current']),
      fixed(roccData['voltage']),
    ];

    this.rows.push(row);
  }

  toCsvString() {
    const lines = [HEADERS, ...this.rows].map((row) => row.join(','));
    return lines.join('\r\n') + '\r\n';
  }

  download(filename = `rocc_log_${Date.now()}.csv`) {
    const blob = new Blob([this.toCsvString()], { type: 'text/csv' });
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
