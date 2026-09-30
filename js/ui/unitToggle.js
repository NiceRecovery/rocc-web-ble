import { TemperatureUnit, storeUnit } from '../units/temperatureUnit.js';

export class UnitToggle {
  constructor(container, store) {
    this.store = store;

    container.innerHTML = `
      <div class="segmented" role="group" aria-label="Temperature unit">
        <button type="button" data-el="celsius" class="segment">&deg;C</button>
        <button type="button" data-el="fahrenheit" class="segment">&deg;F</button>
      </div>
    `;

    this.refs = {
      celsius: container.querySelector('[data-el="celsius"]'),
      fahrenheit: container.querySelector('[data-el="fahrenheit"]'),
    };

    this.refs.celsius.addEventListener('click', () => this._select(TemperatureUnit.CELSIUS));
    this.refs.fahrenheit.addEventListener('click', () => this._select(TemperatureUnit.FAHRENHEIT));

    store.subscribe((state) => this._render(state));
  }

  _select(unit) {
    if (unit === this.store.state.tempUnit) return;
    storeUnit(unit);
    this.store.setState({ tempUnit: unit });
  }

  _render(state) {
    this.refs.celsius.classList.toggle('active', state.tempUnit === TemperatureUnit.CELSIUS);
    this.refs.fahrenheit.classList.toggle('active', state.tempUnit === TemperatureUnit.FAHRENHEIT);
  }
}
