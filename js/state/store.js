// Minimal observable state container - the web equivalent of the Flutter
// app's HomeViewModel (a ChangeNotifier). No framework/build step needed
// for a page this size: UI modules subscribe and re-render just their own
// piece whenever setState() patches the shared state.

export class Store {
  constructor(initialState) {
    this.state = { ...initialState };
    this._listeners = new Set();
  }

  subscribe(listener) {
    this._listeners.add(listener);
    listener(this.state);
    return () => this._listeners.delete(listener);
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    for (const listener of this._listeners) {
      listener(this.state);
    }
  }
}

export const TargetTempSetState = {
  IDLE: 'idle',
  PENDING: 'pending',
  FAILED: 'failed',
};
