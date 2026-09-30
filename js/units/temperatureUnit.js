// Display-only temperature unit preference. All telemetry from the device
// travels internally in its native unit (sensor readings as Celsius,
// target temp as Fahrenheit - see roccService.js) - this only controls how
// values are formatted/edited in the UI. Mirrors temperature_unit.dart in
// the Flutter app.

const STORAGE_KEY = 'rocc_temp_unit';

export const TemperatureUnit = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit',
};

export function suffixFor(unit) {
  return unit === TemperatureUnit.FAHRENHEIT ? '°F' : '°C';
}

export function fromCelsius(celsius, unit) {
  return unit === TemperatureUnit.FAHRENHEIT ? (celsius * 9) / 5 + 32 : celsius;
}

export function fromFahrenheit(fahrenheit, unit) {
  return unit === TemperatureUnit.FAHRENHEIT
    ? fahrenheit
    : ((fahrenheit - 32) * 5) / 9;
}

export function loadStoredUnit() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === TemperatureUnit.FAHRENHEIT
      ? TemperatureUnit.FAHRENHEIT
      : TemperatureUnit.CELSIUS;
  } catch {
    return TemperatureUnit.CELSIUS;
  }
}

export function storeUnit(unit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // localStorage unavailable (e.g. private mode) - unit choice just
    // won't survive a reload, not worth surfacing to the user.
  }
}
