export class DeviceInfoCard {
  constructor(container, store) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><h2>Device Info</h2></div>
        <div class="info-rows">
          <div class="info-row"><span class="muted">FW Version</span><span data-el="fwVersion"></span></div>
          <div class="info-row"><span class="muted">SD Card</span><span data-el="sdCard"></span></div>
          <div class="info-row"><span class="muted">Device UID</span><span data-el="uid"></span></div>
        </div>
      </div>
    `;

    this.refs = {
      fwVersion: container.querySelector('[data-el="fwVersion"]'),
      sdCard: container.querySelector('[data-el="sdCard"]'),
      uid: container.querySelector('[data-el="uid"]'),
    };

    store.subscribe((state) => this._render(state));
  }

  _render(state) {
    const info = state.sysInfo;
    this.refs.fwVersion.textContent = info?.fwVersion ?? 'N/A';
    this.refs.sdCard.textContent = info
      ? info.fileioInitialized
        ? 'Present'
        : 'Not present'
      : 'N/A';
    this.refs.uid.textContent = info?.mcuUid ?? 'N/A';
  }
}
