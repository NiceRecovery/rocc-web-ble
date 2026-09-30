export class ConnectionBadge {
  constructor(container, store) {
    container.innerHTML = `<span class="conn-badge" data-el="badge"></span>`;
    this.refs = { badge: container.querySelector('[data-el="badge"]') };
    store.subscribe((state) => this._render(state));
  }

  _render(state) {
    this.refs.badge.textContent = state.connected ? '● Connected' : '○ Disconnected';
    this.refs.badge.className = `conn-badge ${state.connected ? 'online' : 'offline'}`;
  }
}
