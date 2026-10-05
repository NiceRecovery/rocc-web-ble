import { RunState } from '../../state/advancedStore.js';
import { OpStateCode, ErrorTypeLabel } from '../../ble/roccProtocol.js';
import { formatClock, formatTimeToTarget } from '../../utils/format.js';

const OP_STATE_LABEL = {
  [OpStateCode.cool]: 'Cool',
  [OpStateCode.startup]: 'Startup',
  [OpStateCode.ready]: 'Ready',
  [OpStateCode.active]: 'Active',
  [OpStateCode.charge]: 'Charge',
  [OpStateCode.sleep]: 'Sleep',
  [OpStateCode.playDead]: 'Test',
  [OpStateCode.error]: 'Error',
};

/** Run Status panel - mirrors the C# Custom Test's run-time/state/error display. */
export class AdvancedRunPanel {
  constructor(container, store, advancedStore, controller) {
    this.store = store;
    this.advancedStore = advancedStore;
    this.controller = controller;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Run Status</h2>
          <button class="btn btn-primary" data-el="startStopBtn">Start</button>
        </div>
        <div class="info-rows">
          <div class="info-row"><span class="muted">Run Time</span><span data-el="runTime">--</span></div>
          <div class="info-row"><span class="muted">Device State</span><span data-el="deviceState">--</span></div>
          <div class="info-row"><span class="muted">Time to Target</span><span data-el="timeToTarget">--</span></div>
        </div>
        <div class="error-banner" data-el="errorBanner" hidden></div>
      </div>
    `;

    this.refs = {
      startStopBtn: container.querySelector('[data-el="startStopBtn"]'),
      runTime: container.querySelector('[data-el="runTime"]'),
      deviceState: container.querySelector('[data-el="deviceState"]'),
      timeToTarget: container.querySelector('[data-el="timeToTarget"]'),
      errorBanner: container.querySelector('[data-el="errorBanner"]'),
    };

    this.refs.startStopBtn.addEventListener('click', () => this._onStartStopClick());

    this._tickTimer = setInterval(() => this._renderRunTime(), 500);

    store.subscribe(() => this._render());
    advancedStore.subscribe(() => this._render());
    this._render();
  }

  async _onStartStopClick() {
    if (this.advancedStore.state.runState === RunState.IDLE) {
      this.refs.startStopBtn.disabled = true;
      try {
        await this.controller.start();
      } finally {
        this.refs.startStopBtn.disabled = false;
      }
    } else {
      await this.controller.stop();
    }
  }

  _renderRunTime() {
    const { runState, runStartedAt } = this.advancedStore.state;
    if (runState === RunState.IDLE || !runStartedAt) {
      this.refs.runTime.textContent = '--';
      return;
    }
    this.refs.runTime.textContent = formatClock(Date.now() - runStartedAt);
  }

  _render() {
    const advState = this.advancedStore.state;
    const running = advState.runState !== RunState.IDLE;

    this.refs.startStopBtn.textContent =
      advState.runState === RunState.RUNNING
        ? 'Stop'
        : advState.runState === RunState.STOPPING
          ? 'Stopping...'
          : 'Start';
    this.refs.startStopBtn.disabled = advState.runState === RunState.STOPPING || !this.store.state.connected;
    this.refs.startStopBtn.classList.toggle('btn-danger', running);

    const opState = this.store.state.sysInfo?.opState;
    this.refs.deviceState.textContent = opState != null ? (OP_STATE_LABEL[opState] ?? `0x${opState.toString(16)}`) : '--';

    this.refs.timeToTarget.textContent = formatTimeToTarget(this.store.state.roccData?.['time-to-target-ms']);

    if (advState.lastError) {
      const label = ErrorTypeLabel[advState.lastError.errorType] ?? 'Unknown error';
      this.refs.errorBanner.textContent = `Device error: ${label} - run stopped.`;
      this.refs.errorBanner.hidden = false;
    } else {
      this.refs.errorBanner.hidden = true;
    }

    this._renderRunTime();
  }
}
