import { RoccService } from './ble/roccService.js';
import { Store, TargetTempSetState } from './state/store.js';
import { loadStoredUnit } from './units/temperatureUnit.js';
import { CsvLogger } from './logging/csvLogger.js';
import { ConnectionBadge } from './ui/connectionBadge.js';
import { UnitToggle } from './ui/unitToggle.js';
import { TargetTempCard } from './ui/targetTempCard.js';
import { SystemCard, SideCard } from './ui/telemetryCards.js';
import { DeviceInfoCard } from './ui/deviceInfoCard.js';

const store = new Store({
  connected: false,
  roccData: null,
  sysInfo: null,
  targetTempSetState: TargetTempSetState.IDLE,
  tempUnit: loadStoredUnit(),
});

const roccService = new RoccService();
const csvLogger = new CsvLogger();

roccService.onConnectionChange = (connected) => {
  if (!connected) {
    // Device dropped out from under us (or we asked it to) - reset the UI
    // instead of leaving stale telemetry on screen.
    store.setState({
      connected: false,
      roccData: null,
      sysInfo: null,
      targetTempSetState: TargetTempSetState.IDLE,
    });
    return;
  }
  store.setState({ connected: true });
};

roccService.onTelemetry = (data) => {
  store.setState({ roccData: data });
  csvLogger.logSnapshot(data, store.state.sysInfo?.targetTempF ?? null);
  downloadButton.hidden = !csvLogger.hasData;
};

roccService.onSysInfo = (info) => {
  store.setState({ sysInfo: info, targetTempSetState: TargetTempSetState.IDLE });
};

// Mount UI modules
new ConnectionBadge(document.getElementById('connectionBadge'), store);
new UnitToggle(document.getElementById('unitToggle'), store);
new TargetTempCard(document.getElementById('targetTempCard'), store, roccService);
new SystemCard(document.getElementById('systemCard'), store);
new SideCard(document.getElementById('leftCard'), store, 'left');
new SideCard(document.getElementById('rightCard'), store, 'right');
new DeviceInfoCard(document.getElementById('deviceInfoCard'), store);

const connectButton = document.getElementById('connectButton');
const downloadButton = document.getElementById('downloadButton');

let connecting = false;

function renderConnectButton(state) {
  if (connecting) {
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
  } else if (state.connected) {
    connectButton.textContent = 'Disconnect';
    connectButton.disabled = false;
  } else {
    connectButton.textContent = 'Connect';
    connectButton.disabled = false;
  }
}
store.subscribe(renderConnectButton);

connectButton.addEventListener('click', async () => {
  if (store.state.connected) {
    roccService.disconnect();
    return;
  }

  connecting = true;
  renderConnectButton(store.state);
  csvLogger.reset();
  downloadButton.hidden = true;

  try {
    await roccService.connect();
  } catch (err) {
    console.error('Connection failed:', err);
    if (err.name !== 'NotFoundError') {
      // NotFoundError = user cancelled the device picker, not worth an alert.
      alert('Connection failed: ' + err.message);
    }
  } finally {
    connecting = false;
    renderConnectButton(store.state);
  }
});

downloadButton.addEventListener('click', () => csvLogger.download());
