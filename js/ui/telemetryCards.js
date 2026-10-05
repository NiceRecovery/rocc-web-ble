import { fromCelsius, suffixFor } from '../units/temperatureUnit.js';
import { formatTimeToTarget } from '../utils/format.js';

function fmt(value, digits, unit) {
  return value != null ? `${value.toFixed(digits)}${unit}` : 'N/A';
}

function regulatingBadgeHtml(regulating) {
  if (regulating == null) return '';
  const cls = regulating ? 'badge badge-success' : 'badge badge-neutral';
  const icon = regulating ? '&#10003;' : '&#8987;';
  const text = regulating ? 'At Target' : 'Ramping';
  return `<span class="${cls}">${icon} ${text}</span>`;
}

/** ROCC LEFT / ROCC RIGHT telemetry card (temps, current, peltier voltage, regulating badge). */
export class SideCard {
  constructor(container, store, side) {
    this.store = store;
    this.side = side; // 'left' | 'right'

    const title = side === 'left' ? 'ROCC LEFT' : 'ROCC RIGHT';
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>${title}</h2>
          <span data-el="badge"></span>
        </div>
        <div class="metric-rows">
          <div class="metric-row"><span class="metric-label">Temp1</span><span data-el="temp1" class="metric-value temp"></span></div>
          <div class="metric-row"><span class="metric-label">Temp2</span><span data-el="temp2" class="metric-value temp"></span></div>
          <div class="metric-row"><span class="metric-label">Sink</span><span data-el="sink" class="metric-value temp"></span></div>
          <div class="metric-row"><span class="metric-label">Current</span><span data-el="current" class="metric-value warn"></span></div>
          <div class="metric-row"><span class="metric-label">Peltier</span><span data-el="peltier" class="metric-value warn"></span></div>
        </div>
      </div>
    `;

    this.refs = {
      badge: container.querySelector('[data-el="badge"]'),
      temp1: container.querySelector('[data-el="temp1"]'),
      temp2: container.querySelector('[data-el="temp2"]'),
      sink: container.querySelector('[data-el="sink"]'),
      current: container.querySelector('[data-el="current"]'),
      peltier: container.querySelector('[data-el="peltier"]'),
    };

    store.subscribe((state) => this._render(state));
  }

  _render(state) {
    const data = state.roccData ?? {};
    const unit = state.tempUnit;
    const s = this.side;

    const temp = (celsius) => fmt(celsius != null ? fromCelsius(celsius, unit) : null, 1, suffixFor(unit));

    this.refs.temp1.textContent = temp(data[`temp1-${s}`]);
    this.refs.temp2.textContent = temp(data[`temp2-${s}`]);
    this.refs.sink.textContent = temp(data[`sink-${s}`]);
    this.refs.current.textContent = fmt(data[`current-${s}`], 1, ' A');
    this.refs.peltier.textContent = fmt(data[`peltvolt-${s}`], 1, ' V');
    this.refs.badge.innerHTML = regulatingBadgeHtml(data[`regulating-${s}`]);
  }
}

/** ROCC SYSTEM card (battery voltage, discharge current). */
export class SystemCard {
  constructor(container, store) {
    this.store = store;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>ROCC SYSTEM</h2>
          <span data-el="connIcon" class="conn-icon"></span>
        </div>
        <div class="metric-rows">
          <div class="metric-row"><span class="metric-label">Battery Voltage</span><span data-el="voltage" class="metric-value success"></span></div>
          <div class="metric-row"><span class="metric-label">Battery Temp</span><span data-el="battTemp" class="metric-value temp"></span></div>
          <div class="metric-row"><span class="metric-label">Discharge Current</span><span data-el="discharge" class="metric-value warn"></span></div>
          <div class="metric-row"><span class="metric-label">Time to Target</span><span data-el="timeToTarget" class="metric-value"></span></div>
        </div>
      </div>
    `;

    this.refs = {
      connIcon: container.querySelector('[data-el="connIcon"]'),
      voltage: container.querySelector('[data-el="voltage"]'),
      battTemp: container.querySelector('[data-el="battTemp"]'),
      discharge: container.querySelector('[data-el="discharge"]'),
      timeToTarget: container.querySelector('[data-el="timeToTarget"]'),
    };

    store.subscribe((state) => this._render(state));
  }

  _render(state) {
    const data = state.roccData ?? {};
    const unit = state.tempUnit;

    this.refs.voltage.textContent = fmt(data['voltage'], 2, ' V');
    this.refs.battTemp.textContent = fmt(
      data['battery-temp'] != null ? fromCelsius(data['battery-temp'], unit) : null,
      1,
      suffixFor(unit),
    );
    this.refs.discharge.textContent = fmt(data['discharge-current'], 2, ' A');
    this.refs.timeToTarget.textContent = formatTimeToTarget(data['time-to-target-ms']);
    this.refs.connIcon.textContent = state.connected ? '●' : '○';
    this.refs.connIcon.className = `conn-icon ${state.connected ? 'online' : 'offline'}`;
  }
}
