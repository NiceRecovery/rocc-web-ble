import { fromCelsius, suffixFor } from '../../units/temperatureUnit.js';

/** Scrolling per-side sample table - mirrors the C# tool's live sample ListBoxes. */
export class AdvancedSampleTable {
  constructor(container, mainStore, advancedStore, side, title) {
    this.mainStore = mainStore;
    this.side = side;

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>${title}</h2></div>
        <div class="sample-table-wrap">
          <table class="sample-table">
            <thead>
              <tr>
                <th>Time</th>
                <th data-el="temp1Header">Temp1</th>
                <th data-el="temp2Header">Temp2</th>
                <th data-el="sinkHeader">Sink</th>
                <th>Current</th>
                <th>Peltier V</th>
                <th>Fan RPM</th>
                <th>Fan PWM</th>
              </tr>
            </thead>
            <tbody data-el="rows"></tbody>
          </table>
        </div>
      </div>
    `;

    this.headerRefs = {
      temp1: container.querySelector('[data-el="temp1Header"]'),
      temp2: container.querySelector('[data-el="temp2Header"]'),
      sink: container.querySelector('[data-el="sinkHeader"]'),
    };
    this.tbody = container.querySelector('[data-el="rows"]');

    this._latestAdvState = advancedStore.state;
    mainStore.subscribe(() => this._render());
    advancedStore.subscribe((state) => this._render(state));
  }

  _render(advState) {
    if (advState) this._latestAdvState = advState;
    const state = this._latestAdvState;
    const unit = this.mainStore.state.tempUnit;
    const unitSuffix = suffixFor(unit);

    this.headerRefs.temp1.textContent = `Temp1 (${unitSuffix})`;
    this.headerRefs.temp2.textContent = `Temp2 (${unitSuffix})`;
    this.headerRefs.sink.textContent = `Sink (${unitSuffix})`;

    const samples = this.side === 'left' ? state.samplesLeft : state.samplesRight;
    const latest = samples.slice(-50).reverse(); // newest first, cap rendered rows for DOM perf

    const fmt = (v, digits = 1) => (typeof v === 'number' ? v.toFixed(digits) : '--');
    const temp = (celsius) => fmt(celsius != null ? fromCelsius(celsius, unit) : null);

    this.tbody.innerHTML = latest
      .map((s) => {
        const d = s.roccData ?? {};
        const adv = s.advTelemetry ?? {};
        const fanRpm = this.side === 'left' ? adv.fanRpmLeft : adv.fanRpmRight;
        const fanPwm = this.side === 'left' ? adv.fanPwmLeft : adv.fanPwmRight;
        return `<tr>
          <td>${s.runTimeS.toFixed(0)}s</td>
          <td>${temp(d[`temp1-${this.side}`])}</td>
          <td>${temp(d[`temp2-${this.side}`])}</td>
          <td>${temp(d[`sink-${this.side}`])}</td>
          <td>${fmt(d[`current-${this.side}`], 2)}</td>
          <td>${fmt(d[`peltvolt-${this.side}`], 2)}</td>
          <td>${fanRpm ?? '--'}</td>
          <td>${fanPwm ?? '--'}</td>
        </tr>`;
      })
      .join('');
  }
}
