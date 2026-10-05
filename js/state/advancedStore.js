import { Store } from './store.js';
import { RoccLimits } from '../ble/roccProtocol.js';

export const PeltierMode = {
  VOLTAGE: 'voltage',
  CURRENT: 'current',
};

export const RunState = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPING: 'stopping',
};

const MAX_SAMPLES_KEPT = 300;

function defaultSideConfig() {
  return { enabled: false, fanPwm: 50, setpoint: 0 };
}

/**
 * State for Advanced Mode's config + run lifecycle - mirrors
 * CustomTestViewModel's flat bindable properties. Live telemetry
 * (roccData/sysInfo/advTelemetry) is NOT duplicated here - it lives on the
 * one shared main store (see store.js / main.js) that both the dashboard
 * and Advanced Mode read from, so there's a single BLE data pipeline.
 */
export function createAdvancedStore() {
  return new Store({
    // Config (edited via the form, used when Start is pressed)
    mode: PeltierMode.VOLTAGE,
    left: defaultSideConfig(),
    right: defaultSideConfig(),
    targetTempF: 58.0,
    dtShapingConst: 0,
    voltageDtGain: 0,

    // Run state
    runState: RunState.IDLE,
    runStartedAt: null,
    lastError: null, // { opState, errorType } when the device reports an error

    // Per-side sample history, capped like the C# tool's MaxSamplesKept
    samplesLeft: [],
    samplesRight: [],
  });
}

export function pushSample(store, side, sample) {
  const key = side === 'left' ? 'samplesLeft' : 'samplesRight';
  const next = [...store.state[key], sample];
  if (next.length > MAX_SAMPLES_KEPT) next.shift();
  store.setState({ [key]: next });
}

export function clampTempF(tempF) {
  return Math.min(Math.max(tempF, RoccLimits.targetTempMinF), RoccLimits.targetTempMaxF);
}
