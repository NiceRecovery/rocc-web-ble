import { createAdvancedStore } from '../../state/advancedStore.js';
import { AdvancedCsvLogger } from '../../logging/advancedCsvLogger.js';
import { AdvancedController } from './advancedController.js';
import { AdvancedConfigForm } from './advancedConfigForm.js';
import { AdvancedRunPanel } from './advancedRunPanel.js';
import { AdvancedSampleTable } from './advancedSampleTable.js';

/**
 * Advanced Mode - mirrors the C# tool's "Custom Test" tab (minus the
 * Keithley/PSU ramp logic, out of scope). Mounted into its own container,
 * toggled from the main header - see main.js.
 */
export class AdvancedModeView {
  constructor(container, store, roccService) {
    this.advancedStore = createAdvancedStore();
    this.csvLogger = new AdvancedCsvLogger();
    this.controller = new AdvancedController(store, this.advancedStore, roccService, this.csvLogger);

    container.innerHTML = `
      <div class="advanced-warning">
        Advanced Mode sends direct low-level overrides (fan PWM, voltage/current setpoints) straight to the
        device, bypassing the app's normal closed-loop controls. Dev units only.
      </div>
      <div id="advConfigForm" class="card-slot"></div>
      <div id="advRunPanel" class="card-slot"></div>
      <div class="button-row">
        <button id="advDownloadButton" class="btn btn-secondary" hidden>Download CSV</button>
      </div>
      <div class="card-grid">
        <div id="advLeftTable" class="card-slot"></div>
        <div id="advRightTable" class="card-slot"></div>
      </div>
    `;

    new AdvancedConfigForm(container.querySelector('#advConfigForm'), store, this.advancedStore);
    new AdvancedRunPanel(container.querySelector('#advRunPanel'), store, this.advancedStore, this.controller);
    new AdvancedSampleTable(container.querySelector('#advLeftTable'), store, this.advancedStore, 'left', 'Left Samples');
    new AdvancedSampleTable(container.querySelector('#advRightTable'), store, this.advancedStore, 'right', 'Right Samples');

    const downloadButton = container.querySelector('#advDownloadButton');
    downloadButton.addEventListener('click', () => this.csvLogger.download(store.state.tempUnit));
    this.advancedStore.subscribe(() => {
      downloadButton.hidden = !this.csvLogger.hasData;
    });
  }
}
