const deviceList = document.getElementById('deviceList');

export function displayDevice(device, onClickCallback) {
    const li = document.createElement('li');
    li.className = 'device';
    li.textContent = `Name: ${device.name || 'Unknown'}, ID: ${device.id}`;
    li.onclick = () => onClickCallback(device);
    deviceList.appendChild(li);
}

export function clearDeviceList() {
    deviceList.innerHTML = '';
}

export function appendLog(message) {
    const log = document.createElement('div');
    log.textContent = message;
    document.body.appendChild(log);
}

export function overwriteLog(message) {
    const opslog = document.getElementById('opsLog');
    opslog.textContent = message;
    document.body.appendChild(opslog);
}

export function renderOpsLogCard(opsLog) {
    let container = document.getElementById('opslog-card');

    // Create the card if it doesn't exist yet
    if (!container) {
        container = document.createElement('div');
        container.id = 'opslog-card';
        container.className = 'opslog-card';
        container.innerHTML = `
        <h2>📘 Operation Parameters</h2>
        <div class="opslog-grid">
          <div class="opslog-section" id="left-section">
            <h3>Left</h3>
            <p id="LeftTherm1"></p>
            <p id="LeftTherm2"></p>
            <p id="LeftSinkTemp"></p>
            <p id="LeftPeltCurrent"></p>
            <p id="LeftPeltVolt"></p>
          </div>
          <div class="opslog-section" id="right-section">
            <h3>Right</h3>
            <p id="RightTherm1"></p>
            <p id="RightTherm2"></p>
            <p id="RightSinkTemp"></p>
            <p id="RightPeltCurrent"></p>
            <p id="RightPeltVolt"></p>
          </div>
          <div class="opslog-section center" id="system-section">
            <h3>System</h3>
            <p id="BattVolt"></p>
            <p id="AmbTemperature"></p>
            <p id="AmbHumidity"></p>
            <p id="DischargeCurrent"></p>
          </div>
        </div>
      `;
        document.body.appendChild(container);
    }

    for (const [key, value] of Object.entries(opsLog)) {
        const element = document.getElementById(key);
        if (element) {
          const formattedValue = typeof value === "number"
            ? value.toFixed(2)
            : value;
          element.textContent = `${key}: ${formattedValue}`;
        }
      }
      
}

