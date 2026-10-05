import { PeltierMode, RunState } from '../../state/advancedStore.js';
import { RoccLimits } from '../../ble/roccProtocol.js';
import { TemperatureUnit, fromCelsius, fromFahrenheit, suffixFor } from '../../units/temperatureUnit.js';

/** Converts a value entered in the currently-displayed unit back to the canonical Fahrenheit the store/wire protocol use. */
function toCanonicalF(displayValue, unit) {
  return unit === TemperatureUnit.FAHRENHEIT ? displayValue : fromCelsius(displayValue, TemperatureUnit.FAHRENHEIT);
}

function sideFieldset(side, title) {
  return `
    <fieldset class="side-config" data-el="${side}Fieldset">
      <legend>${title}</legend>
      <label class="checkbox-row">
        <input type="checkbox" data-el="${side}Enabled" />
        Enabled
      </label>
      <label class="field-row">
        <span>Fan PWM (%)</span>
        <input type="number" min="0" max="100" step="1" data-el="${side}FanPwm" />
      </label>
      <label class="field-row">
        <span data-el="${side}SetpointLabel">Setpoint</span>
        <input type="number" step="0.01" data-el="${side}Setpoint" />
      </label>
    </fieldset>
  `;
}

/** Advanced Mode config form - mirrors CustomTestTabView.xaml's fields (minus Keithley/PSU). */
export class AdvancedConfigForm {
  constructor(container, mainStore, advancedStore) {
    this.mainStore = mainStore;
    this.store = advancedStore;

    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Test Configuration</h2></div>

        <label class="field-row">
          <span>Control Mode</span>
          <select data-el="mode">
            <option value="${PeltierMode.VOLTAGE}">Voltage</option>
            <option value="${PeltierMode.CURRENT}">Current</option>
          </select>
        </label>

        <div class="side-config-grid">
          ${sideFieldset('left', 'Left')}
          ${sideFieldset('right', 'Right')}
        </div>

        <label class="field-row">
          <span data-el="targetTempLabel">Target Temp</span>
          <input type="number" step="0.5" data-el="targetTempF" />
        </label>
        <label class="field-row">
          <span>dT Shaping Const (k)</span>
          <input type="number" step="0.001" data-el="dtShapingConst" />
        </label>
        <label class="field-row" data-el="voltageDtGainRow">
          <span>Voltage dT Gain (mV/&deg;F)</span>
          <input type="number" step="0.1" data-el="voltageDtGain" />
        </label>
      </div>
    `;

    this.refs = {
      mode: container.querySelector('[data-el="mode"]'),
      targetTempLabel: container.querySelector('[data-el="targetTempLabel"]'),
      targetTempF: container.querySelector('[data-el="targetTempF"]'),
      dtShapingConst: container.querySelector('[data-el="dtShapingConst"]'),
      voltageDtGain: container.querySelector('[data-el="voltageDtGain"]'),
      voltageDtGainRow: container.querySelector('[data-el="voltageDtGainRow"]'),
      left: this._sideRefs(container, 'left'),
      right: this._sideRefs(container, 'right'),
    };

    this._wireInputs();
    mainStore.subscribe(() => this._render());
    advancedStore.subscribe(() => this._render());
  }

  _sideRefs(container, side) {
    return {
      fieldset: container.querySelector(`[data-el="${side}Fieldset"]`),
      enabled: container.querySelector(`[data-el="${side}Enabled"]`),
      fanPwm: container.querySelector(`[data-el="${side}FanPwm"]`),
      setpoint: container.querySelector(`[data-el="${side}Setpoint"]`),
      setpointLabel: container.querySelector(`[data-el="${side}SetpointLabel"]`),
    };
  }

  _wireInputs() {
    const s = this.store;

    this.refs.mode.addEventListener('change', (e) => s.setState({ mode: e.target.value }));
    this.refs.targetTempF.addEventListener('change', (e) => {
      const unit = this.mainStore.state.tempUnit;
      s.setState({ targetTempF: toCanonicalF(parseFloat(e.target.value) || 0, unit) });
    });
    this.refs.dtShapingConst.addEventListener('change', (e) =>
      s.setState({ dtShapingConst: parseFloat(e.target.value) || 0 }),
    );
    this.refs.voltageDtGain.addEventListener('change', (e) =>
      s.setState({ voltageDtGain: parseFloat(e.target.value) || 0 }),
    );

    for (const side of ['left', 'right']) {
      const r = this.refs[side];
      r.enabled.addEventListener('change', (e) =>
        s.setState({ [side]: { ...s.state[side], enabled: e.target.checked } }),
      );
      r.fanPwm.addEventListener('change', (e) =>
        s.setState({ [side]: { ...s.state[side], fanPwm: parseInt(e.target.value, 10) || 0 } }),
      );
      r.setpoint.addEventListener('change', (e) =>
        s.setState({ [side]: { ...s.state[side], setpoint: parseFloat(e.target.value) || 0 } }),
      );
    }
  }

  _render() {
    const state = this.store.state;
    const unit = this.mainStore.state.tempUnit;
    const editable = state.runState === RunState.IDLE;
    const setpointUnit = state.mode === PeltierMode.VOLTAGE ? 'Setpoint (V)' : 'Setpoint (A)';

    this.refs.mode.value = state.mode;
    this.refs.mode.disabled = !editable;

    this.refs.targetTempLabel.textContent = `Target Temp (${suffixFor(unit)})`;
    this.refs.targetTempF.min = fromFahrenheit(RoccLimits.targetTempMinF, unit).toFixed(1);
    this.refs.targetTempF.max = fromFahrenheit(RoccLimits.targetTempMaxF, unit).toFixed(1);
    this.refs.targetTempF.value = fromFahrenheit(state.targetTempF, unit).toFixed(1);
    this.refs.targetTempF.disabled = !editable;

    this.refs.dtShapingConst.value = state.dtShapingConst;
    this.refs.dtShapingConst.disabled = !editable;
    this.refs.voltageDtGain.value = state.voltageDtGain;
    this.refs.voltageDtGain.disabled = !editable;
    this.refs.voltageDtGainRow.classList.toggle('field-disabled', state.mode !== PeltierMode.VOLTAGE);

    for (const side of ['left', 'right']) {
      const r = this.refs[side];
      const cfg = state[side];
      r.enabled.checked = cfg.enabled;
      r.enabled.disabled = !editable;
      r.fanPwm.value = cfg.fanPwm;
      r.fanPwm.disabled = !editable;
      r.setpoint.value = cfg.setpoint;
      r.setpoint.disabled = !editable;
      r.setpointLabel.textContent = setpointUnit;
    }
  }
}
