import { RoccLimits } from '../ble/roccProtocol.js';
import { TargetTempSetState } from '../state/store.js';
import { fromFahrenheit, suffixFor } from '../units/temperatureUnit.js';

/**
 * Target-temperature control card: shows the firmware-confirmed target
 * temp and lets the user stage a new value (slider + fine +/-0.5F steps)
 * before committing it over BLE with "Set". The staged value only follows
 * the confirmed value from the device while the user isn't actively
 * dragging/editing, so a mid-drag BLE echo doesn't yank the slider.
 *
 * Internally everything stays in Fahrenheit - the wire protocol and the
 * firmware's clamp bounds are both F-native (RoccLimits) - the selected
 * unit only controls how values are displayed.
 */
export class TargetTempCard {
  constructor(container, store, roccService) {
    this.store = store;
    this.roccService = roccService;

    this.stagedTempF = null;
    this.dirty = false;
    this.prevSetState = TargetTempSetState.IDLE;

    container.innerHTML = `
      <div class="card target-temp-card">
        <div class="card-header">
          <h2>Target Temperature</h2>
          <span class="muted" data-el="confirmedLabel">Not connected</span>
        </div>
        <div class="target-temp-controls">
          <button class="icon-btn" data-el="decBtn" aria-label="Decrease">&minus;</button>
          <span class="target-temp-value" data-el="valueLabel">--</span>
          <button class="icon-btn" data-el="incBtn" aria-label="Increase">+</button>
        </div>
        <input type="range" class="temp-slider" data-el="slider"
               min="${RoccLimits.targetTempMinF}" max="${RoccLimits.targetTempMaxF}" step="0.5" />
        <div class="card-actions">
          <span class="error-text" data-el="errorLabel" hidden>Failed to set target temperature - device not connected.</span>
          <button class="btn btn-primary" data-el="setBtn" disabled>
            <span data-el="setBtnLabel">Set</span>
          </button>
        </div>
      </div>
    `;

    this.refs = {
      confirmedLabel: container.querySelector('[data-el="confirmedLabel"]'),
      decBtn: container.querySelector('[data-el="decBtn"]'),
      incBtn: container.querySelector('[data-el="incBtn"]'),
      valueLabel: container.querySelector('[data-el="valueLabel"]'),
      slider: container.querySelector('[data-el="slider"]'),
      setBtn: container.querySelector('[data-el="setBtn"]'),
      setBtnLabel: container.querySelector('[data-el="setBtnLabel"]'),
      errorLabel: container.querySelector('[data-el="errorLabel"]'),
    };

    this.refs.decBtn.addEventListener('click', () => this._adjust(-0.5));
    this.refs.incBtn.addEventListener('click', () => this._adjust(0.5));
    this.refs.slider.addEventListener('input', (e) => {
      this.stagedTempF = parseFloat(e.target.value);
      this.dirty = true;
      this._render(this.store.state);
    });
    this.refs.setBtn.addEventListener('click', () => this._onSetClick());

    store.subscribe((state) => this._onStateChange(state));
  }

  _adjust(deltaF) {
    const confirmed = this.store.state.sysInfo?.targetTempF;
    const base = this.stagedTempF ?? confirmed ?? RoccLimits.targetTempMinF;
    this.stagedTempF = Math.min(
      Math.max(base + deltaF, RoccLimits.targetTempMinF),
      RoccLimits.targetTempMaxF,
    );
    this.dirty = true;
    this._render(this.store.state);
  }

  async _onSetClick() {
    if (this.stagedTempF == null) return;
    this.store.setState({ targetTempSetState: TargetTempSetState.PENDING });
    const ok = await this.roccService.setTargetTempF(this.stagedTempF);
    if (!ok) {
      this.store.setState({ targetTempSetState: TargetTempSetState.FAILED });
    }
    // On success we stay "pending" until the firmware echoes the accepted
    // value back via a fresh sysInfo notification (main.js resets to IDLE).
  }

  _onStateChange(state) {
    if (
      state.targetTempSetState === TargetTempSetState.IDLE &&
      this.prevSetState === TargetTempSetState.PENDING
    ) {
      // Firmware echoed the accepted value back - drop "dirty" so the
      // slider follows the device again.
      this.dirty = false;
    }
    this.prevSetState = state.targetTempSetState;

    const confirmed = state.sysInfo?.targetTempF;
    if (confirmed != null && !this.dirty) {
      this.stagedTempF = confirmed;
    }

    this._render(state);
  }

  _render(state) {
    const unit = state.tempUnit;
    const connected = state.connected;
    const pending = state.targetTempSetState === TargetTempSetState.PENDING;
    const confirmed = state.sysInfo?.targetTempF;
    const displayTempF = this.stagedTempF ?? confirmed;
    const hasPendingEdit = this.dirty && displayTempF !== confirmed;

    this.refs.confirmedLabel.textContent = !connected
      ? 'Not connected'
      : confirmed != null
        ? `Confirmed: ${fromFahrenheit(confirmed, unit).toFixed(1)}${suffixFor(unit)}`
        : 'Syncing...';

    this.refs.valueLabel.textContent =
      displayTempF != null ? `${fromFahrenheit(displayTempF, unit).toFixed(1)}${suffixFor(unit)}` : '--';

    this.refs.slider.value = displayTempF ?? RoccLimits.targetTempMinF;
    this.refs.slider.disabled = !connected || pending;
    this.refs.decBtn.disabled = !connected || pending;
    this.refs.incBtn.disabled = !connected || pending;

    this.refs.setBtn.disabled = !connected || pending || !hasPendingEdit;
    this.refs.setBtnLabel.textContent = pending ? 'Setting...' : 'Set';
    this.refs.setBtn.classList.toggle('pending', pending);

    this.refs.errorLabel.hidden = state.targetTempSetState !== TargetTempSetState.FAILED;
  }
}
