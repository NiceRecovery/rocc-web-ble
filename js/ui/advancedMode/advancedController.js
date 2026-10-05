import { RunState, PeltierMode, pushSample } from '../../state/advancedStore.js';
import { OpStateCode, RoccSide } from '../../ble/roccProtocol.js';

const SIDE_BYTES = { left: RoccSide.LEFT, right: RoccSide.RIGHT };

/**
 * Orchestrates an Advanced Mode run - mirrors CustomTestViewModel's
 * StartAsync/StopAsync (rocc-test-sw/.../CustomTestViewModel.cs:650-821)
 * but over the new BLE opcodes instead of serial commands, and samples on
 * incoming telemetry notifications rather than a manual poll timer (the
 * firmware already pushes periodically).
 */
export class AdvancedController {
  constructor(store, advancedStore, roccService, csvLogger) {
    this.store = store;
    this.advancedStore = advancedStore;
    this.roccService = roccService;
    this.csvLogger = csvLogger;
    this._lastRoccData = null;

    store.subscribe((state) => this._onStoreChange(state));
  }

  async start() {
    const cfg = this.advancedStore.state;

    this.csvLogger.reset();
    this.csvLogger.logSessionConfig({
      Mode: cfg.mode,
      LeftEnabled: cfg.left.enabled,
      LeftFanPwm: cfg.left.fanPwm,
      LeftSetpoint: cfg.left.setpoint,
      RightEnabled: cfg.right.enabled,
      RightFanPwm: cfg.right.fanPwm,
      RightSetpoint: cfg.right.setpoint,
      TargetTempF: cfg.targetTempF,
      DtShapingConst: cfg.dtShapingConst,
      VoltageDtGain: cfg.voltageDtGain,
      FwVersion: this.store.state.sysInfo?.fwVersion ?? '',
      StartedAt: new Date().toISOString(),
    });

    this.advancedStore.setState({
      runState: RunState.RUNNING,
      runStartedAt: Date.now(),
      lastError: null,
      samplesLeft: [],
      samplesRight: [],
    });

    await this.roccService.setTargetTempF(cfg.targetTempF);
    await this.roccService.setDtShapingConst(cfg.dtShapingConst);
    if (cfg.mode === PeltierMode.VOLTAGE) {
      await this.roccService.setVoltageDtGain(cfg.voltageDtGain);
    }

    for (const side of ['left', 'right']) {
      const sideCfg = cfg[side];
      if (!sideCfg.enabled) continue;
      const sideByte = SIDE_BYTES[side];

      await this.roccService.setFanPwm(sideByte, sideCfg.fanPwm);
      if (cfg.mode === PeltierMode.VOLTAGE) {
        await this.roccService.setPeltierVoltage(sideByte, sideCfg.setpoint * 1000); // V -> mV
      } else {
        await this.roccService.setPeltierCurrent(sideByte, sideCfg.setpoint); // A
      }
      await this.roccService.setPeltierEnable(sideByte, true);
    }

    await this.roccService.enableAdvTelemetry();
  }

  async stop(errorReason = null) {
    if (this.advancedStore.state.runState === RunState.IDLE) return;

    this.advancedStore.setState({ runState: RunState.STOPPING });

    const cfg = this.advancedStore.state;
    for (const side of ['left', 'right']) {
      if (!cfg[side].enabled) continue;
      await this.roccService.deactivateSide(SIDE_BYTES[side]);
    }
    await this.roccService.disableAdvTelemetry();

    this.advancedStore.setState({ runState: RunState.IDLE, lastError: errorReason });
  }

  _onStoreChange(state) {
    if (this.advancedStore.state.runState !== RunState.RUNNING) return;
    if (!state.roccData || state.roccData === this._lastRoccData) return;
    this._lastRoccData = state.roccData;

    if (state.sysInfo?.opState === OpStateCode.error) {
      this.stop({ opState: state.sysInfo.opState, errorType: state.advTelemetry?.errorType ?? null });
      return;
    }

    const cfg = this.advancedStore.state;
    const runTimeS = (Date.now() - cfg.runStartedAt) / 1000;

    for (const side of ['left', 'right']) {
      if (!cfg[side].enabled) continue;

      pushSample(this.advancedStore, side, {
        t: Date.now(),
        runTimeS,
        roccData: state.roccData,
        advTelemetry: state.advTelemetry,
        sysInfo: state.sysInfo,
      });

      this.csvLogger.logSample({
        side,
        runTimeS,
        mode: cfg.mode,
        roccData: state.roccData,
        advTelemetry: state.advTelemetry,
        sysInfo: state.sysInfo,
      });
    }
  }
}
