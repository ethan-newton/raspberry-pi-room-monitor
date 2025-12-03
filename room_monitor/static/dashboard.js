/*
  Raspberry Pi Room Monitor Dashboard
  -----------------------------------
  Year: 2025
  Author: Ethan Newton
  Prototype project. Free to use, modify, and distribute.
  No copyright claims. This project is intended to be open-source and freely licensed for personal use.
*/

document.addEventListener('DOMContentLoaded', () => {

  /*
    ========================
    Constants & DOM references
    ========================
  */

  const body = document.body;
  const sidebar = document.querySelector('.sidebar');

  const saveButton = document.querySelector(".save-button");
  const inputs = document.querySelectorAll(".form-section input");
  const form = document.getElementById('sidebar-settings');

  const themeSelect = document.getElementById('theme-select');
  const themeToggle = document.getElementById('theme-toggle');

  const notificationBar = document.getElementById('notification-bar');

  const dateStartInput = document.getElementById('dateStart');
  const dateEndInput   = document.getElementById('dateEnd');
  const applyButton = document.getElementById('apply-dates');

  const reloadButton = document.getElementById('reload-button');

  // Theme saved state
  const savedThemeName = localStorage.getItem('theme-name') || 'default';
  const savedMode = localStorage.getItem('theme-mode') || 'light';

  // Chart & Data State 
  let allData = [];
  let lastDataJson = '';
  let timestamps = []; // will store full "YYYY-MM-DD HH:MM" for tooltips

  /*
    ========================
    Small helpers & utilities
    ========================
  */

  // Format Date as "YYYY-MM-DD" (for input[type=date])
  function toISODate(d) {
    const year  = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0'); // 0-based
    const day   = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Safe fetch wrapper that throws detailed error for non-ok responses
  async function safeFetchJson(url, opts = {}) {
    const res = await fetch(url, { cache: 'no-store', ...opts });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return res.json();
  }

  // Show a small top notification bar
  function showNotification(msg, status = 'success') {
    if (!notificationBar) return;
    notificationBar.textContent = msg;
    notificationBar.style.backgroundColor = (status === 'error') ? '#dc3545' : '#28a745';
    notificationBar.classList.add('show');

    // Push logo down while visible
    const barHeight = notificationBar.offsetHeight;
    sidebar.style.setProperty('--logo-offset', barHeight + 'px');

    setTimeout(() => {
      notificationBar.classList.remove('show');
      sidebar.style.setProperty('--logo-offset', '0px');
    }, 3000);
  }

  /*
    ========================
    Save Button & Form Change Detection
    ========================
  */

  // Remember initial values for inputs to detect changes
  inputs.forEach(input => input.dataset.originalValue = input.value);

  function updateSaveButtonState() {
    if (!saveButton) return;
    const hasChanged = [...inputs].some(i => i.value !== i.dataset.originalValue);
    saveButton.disabled = !hasChanged;
  }

  inputs.forEach(input => input.addEventListener("input", updateSaveButtonState));
  updateSaveButtonState();

  function resetInputsToSavedState() {
    inputs.forEach(input => input.dataset.originalValue = input.value);
    updateSaveButtonState();
  }

  /*
    ========================
    Theme: Named Palettes & Light/Dark Toggle
    ========================
  */

  // Helper to remove classes starting with 'theme-' from body
  function clearThemeClasses() {
    body.classList.forEach(cls => {
      if (cls.startsWith('theme-')) body.classList.remove(cls);
    });
  }

  // Apply a named theme and adds class to <body>
  function applyNamedTheme(name) {
    clearThemeClasses();
    if (name && name !== 'default') {
      body.classList.add(`theme-${name}`);
    }
    localStorage.setItem('theme-name', name);   // No class added for 'default' (CSS :root / body.dark handle default)
  }

  // Set select UI and apply theme immediately
  if (themeSelect) {
    themeSelect.value = savedThemeName;         // Set dropdown
    applyNamedTheme(savedThemeName);            // Apply class to body

    themeSelect.addEventListener('change', () => {
      const selected = themeSelect.value || 'default';
      applyNamedTheme(selected);
      applyChartTheme();                        // Reapply chart theme
    });
  } else {
    applyNamedTheme(savedThemeName);            // If no select present, still apply saved theme
  }

  // Apply saved light/dark mode
  if (savedMode === 'dark') {
    body.classList.add('dark');
    if (themeToggle) themeToggle.checked = true;
  } else {
    body.classList.remove('dark');
    if (themeToggle) themeToggle.checked = false;
  }

  // Toggle handler - flips only the 'dark' class, keeps the named theme intact
  if (themeToggle) {
    themeToggle.addEventListener('change', () => {
      const isDark = themeToggle.checked;
      body.classList.toggle('dark', isDark);
      localStorage.setItem('theme-mode', isDark ? 'dark' : 'light');
    });
  }

  /*
    ========================
    Load / Save Setpoints (min/max)
    ========================
  */

  let originalValues = {};
  const setpointKeys = ["min_temp", "max_temp", "min_hum", "max_hum"];

  async function loadSetpoints() {
    try {
      const data = await safeFetchJson('/api/settings');
      originalValues = {};

      for (const [k, v] of Object.entries(data)) {
        if (form.elements[k]) {
          // Disable autocomplete so browser doesn’t fight JSON values
          form.elements[k].setAttribute("autocomplete", "off");

          // Set value from JSON
          form.elements[k].value = v;

          // Track original values for changes detection
          originalValues[k] = v;
          form.elements[k].dataset.originalValue = v;

          // Reset changed state
          form.elements[k].classList.remove('changed');
        }
      }

      // Reset Save Button state after reload
      updateSaveButtonState();
    } catch (err) {
      console.error('[ERROR] Error loading setpoints:', err);
      showNotification('Failed to load setpoints.', 'error');
    }
  }

  // Change detection only for setpoints
  setpointKeys.forEach(key => {
    if (!form) return;
    const input = form.elements[key];
    if (!input) return;
    input.addEventListener('input', () => {
      input.classList.toggle('changed', input.value != originalValues[key]);
      updateSaveButtonState();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    // Ensure only setpoints are sent
    const setpoints = {};
    setpointKeys.forEach(key => {
      if (payload[key] !== undefined) {
        setpoints[key] = payload[key];
      }
    });

    // Parse and validate
    const minTemp = parseFloat(setpoints.min_temp);
    const maxTemp = parseFloat(setpoints.max_temp);
    const minHum  = parseFloat(setpoints.min_hum);
    const maxHum  = parseFloat(setpoints.max_hum);

    // Range validation
    if (minTemp < -40 || minTemp > 80) {
      showNotification("Minimum Temperature out of range (-40 to 80).", "error");
      return;
    }
    if (maxTemp < -40 || maxTemp > 80) {
      showNotification("Maximum Temperature out of range (-40 to 80).", "error");
      return;
    }
    if (minHum < 0 || minHum > 100) {
      showNotification("Minimum Humidity out of range (0 to 100).", "error");
      return;
    }
    if (maxHum < 0 || maxHum > 100) {
      showNotification("Maximum Humidity out of range (0 to 100).", "error");
      return;
    }

    // Logical validation
    if (minTemp >= maxTemp) {
      showNotification('Minimum Temperature must be less than Maximum Temperature.', 'error');
      return;
    }
    if (minHum >= maxHum) {
      showNotification('Minimum Humidity must be less than Maximum Humidity.', 'error');
      return;
    }

    // Type validation
    if (isNaN(minTemp)) {
      showNotification("Minimum Temperature must be a number.", "error");
      return;
    }
    if (isNaN(maxTemp)) {
      showNotification("Maximum Temperature must be a number.", "error");
      return;
    }
    if (isNaN(minHum)) {
      showNotification("Maximum Temperature must be a number.", "error");
      return;
    }
    if (isNaN(maxHum)) {
      showNotification("Maximum Temperature must be a number.", "error");
      return;
    }

    // Save to backend
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(setpoints)
      });
      const res = await r.json();
      if (!r.ok || !res.ok) {
        throw new Error((res.errors || ['Unknown error']).join(', '));
      }
      
      showNotification('Setpoints saved successfully.', 'success');
      await loadSetpoints();
      await applyChartYLimits();                // Refresh chart limits after saving
      
    } catch (err) {
      showNotification('[ERROR] Error: ' + err.message, 'error');
    }
  });


  /*
    ========================
    Load CSV dates: Read data_log.csv to set date inputs
    - Default to last 7 days if data spans more than 7 days
    - Otherwise use full available range
    - Set min/max attributes to restrict calendar
    ========================
  */

  async function loadCSVDates() {
    try {
      const res = await fetch('/static/data/data_log.csv', { cache: 'no-store' });
      if (!res.ok) throw new Error('[ERROR] CSV not found');

      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) return;

      // Extract timestamps from CSV (YYYY-MM-DD HH:MM)
      const timestamps = lines.slice(1).map(line => line.split(',')[0]);
      timestamps.sort();                    // Chronological order as strings

      // Get earliest and latest timestamps
      const firstTimestamp = timestamps[0];
      const lastTimestamp  = timestamps[timestamps.length - 1];

      // Convert to Date objects (replace space with 'T' for ISO parsing)
      const firstDate = new Date(firstTimestamp.replace(' ', 'T'));
      const lastDate  = new Date(lastTimestamp.replace(' ', 'T'));

      // Calculate range difference
      const diffDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

      // Determine start date to use
      let startDateToUse;
      if (diffDays > 6) {                   // "> 6" means at least 7 full days
        // Default to last 7 days
        const d = new Date(lastDate);
        d.setDate(lastDate.getDate() - 6);
        startDateToUse = d;
      } else {
        // Use full range if less than 7 days of data
        startDateToUse = firstDate;
      }

      // Prevent cached browser values from taking over
      dateStartInput.autocomplete = 'off';
      dateEndInput.autocomplete   = 'off';

      // Assign value
      dateStartInput.value = toISODate(startDateToUse);
      dateEndInput.value   = toISODate(lastDate);

      // Set date limits (full available range)
      dateStartInput.min = toISODate(firstDate);
      dateStartInput.max = toISODate(lastDate);
      dateEndInput.min   = toISODate(firstDate);
      dateEndInput.max   = toISODate(lastDate);

      // Store "original" values for change detection
      dateStartInput.dataset.originalValue = dateStartInput.value;
      dateEndInput.dataset.originalValue   = dateEndInput.value;

      // Initialize Apply button state
      updateApplyButtonState();

    } catch (err) {
      console.error('[ERROR] Error loading CSV dates:', err);
    }
  }

  /*
    ========================
    Chart: Combined Temperature & Humidity
    - Chart creation
    - Theme application helper applyChartTheme(chart)
    ========================
  */

  // Apply theme colors and font to Chart.js defaults
  function applyChartTheme(chart) {
    if (!chart) return;                 // Do nothing if chart not ready
    // Allow calling before chart exists
    const style = getComputedStyle(document.body);
    const colors = {
      text: style.getPropertyValue('--text-color').trim(),
      grid: style.getPropertyValue('--divider-color').trim(),
      bg: style.getPropertyValue('--bg-color').trim(),
      font: style.getPropertyValue('--font-family').trim()
    };

    // Global defaults that affect chart
    Chart.defaults.color = colors.text;                         // axes, labels, legend, etc.
    Chart.defaults.scale.grid.color = colors.grid;              // gridlines
    Chart.defaults.borderColor = colors.grid;                   // axis line
    Chart.defaults.plugins.legend.labels.color = colors.text;   // legend text
    Chart.defaults.font.size = 16;                              // global font size
    Chart.defaults.font.family = colors.font;                   // theme font

    // Tooltip colors and settings
    Chart.defaults.plugins.tooltip.backgroundColor = colors.bg; // tooltip background
    Chart.defaults.plugins.tooltip.titleColor = colors.text;    // tooltip title
    Chart.defaults.plugins.tooltip.bodyColor = colors.text;     // tooltip text
    Chart.defaults.plugins.tooltip.borderColor = colors.grid;   // tooltip border color
    Chart.defaults.plugins.tooltip.borderWidth = 1;             // tooltip border width
    Chart.defaults.plugins.tooltip.padding = 12;                // tooltip border width

    for (const axis of Object.values(chart.options.scales)) {
      if (axis.ticks) axis.ticks.color = colors.text;
      if (axis.title) axis.title.color = colors.text;
      if (axis.grid) axis.grid.color = colors.grid;
    }

    chart.update('none');
  }

  // Create chart
  const combinedCtx = document.getElementById('combinedChart').getContext('2d');
  const combinedChart = new Chart(combinedCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: ' Temperature (°C) ',
          data: [],
          borderColor: 'royalBlue',
          backgroundColor: 'royalBlue',
          yAxisID: 'yTemp',
          borderWidth: 4,
          tension: 0.3,
          pointRadius: 2,               // Change to 3 to see points, 0 to not see them
          fill: false
        },
        {
          label: ' Humidity (%RH) ',
          data: [],
          borderColor: 'limeGreen',
          backgroundColor: 'limeGreen',
          yAxisID: 'yHum',
          borderWidth: 4,
          tension: 0.3,
          pointRadius: 2,               // Change to 3 to see points, 0 to not see them
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            boxWidth: 32,
            boxHeight: 16,
            font: {
              size: 18,
            }
          },
        },
        tooltip: {
          titleFont: {
            size: 18,
          },
          bodyFont: {
            size: 16,
          },
          callbacks: {
            title: function (context) {
              const index = context[0].dataIndex;
              // Safely show full timestamp, fallback to label
              if (Array.isArray(timestamps) && timestamps[index]) {
                // Replace space between date and time with " - "
                return timestamps[index].replace(' ', ' - ');
              }
              return (context[0].label || '').replace(' ', ' - ');
            },
            label: function (context) {
              const datasetLabel = context.dataset.label;
              const value = context.formattedValue;
              return `${datasetLabel}: ${value}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            drawTicks: true,
            drawOnChartArea: true
          },
          ticks: {
            font: { size: 14 },
            maxTicksLimit: Math.ceil(window.innerWidth / 100)
          },
          title: { display: true, text: 'Time (HH:MM)', font: { size: 16 } }
        },
        yTemp: {
          type: 'linear',
          position: 'left',
          ticks: { font: { size: 14 } },
          title: { display: true, text: 'Temperature (°C)', font: { size: 16 } }
        },
        yHum: {
          type: 'linear',
          position: 'right',
          ticks: { font: { size: 14 } },
          title: { display: true, text: 'Humidity (%RH)', font: { size: 16 } },
          grid: { drawOnChartArea: false }          // Avoid double grid lines
        }
      }
    }
  });

  // Apply theme to the chart after creating it
  applyChartTheme(combinedChart);

  /*
    ========================
    Chart Update & Data Flow
    ========================
  */

  // Update the combined chart
  function updateChart(data) {
    const newJson = JSON.stringify(data);
    if (newJson === lastDataJson) return;
    lastDataJson = newJson;

    // Label shown on axis is just time HH:MM
    timestamps = data.map(d => d.timestamp);                  // full "YYYY-MM-DD HH:MM"
    const labels = data.map(d => d.timestamp.split(' ')[1]);

    if (!combinedChart) return;
    combinedChart.data.labels = labels;
    combinedChart.data.datasets[0].data = data.map(d => d.temperature);
    combinedChart.data.datasets[1].data = data.map(d => d.humidity);
    combinedChart.update();
  }

  // Fetch CSV/JSON data for charts
  async function fetchData() {
    try {
      const data = await safeFetchJson('/api/data');
      allData = data;
      filterAndUpdateChart();
    } catch (err) {
      console.error('[ERROR] Error fetching chart data:', err);
    }
  }

  // Filter data and update chart
  function filterAndUpdateChart() {
    if (!allData || allData.length === 0) return;

    const startDateStr = dateStartInput.value;
    const endDateStr = dateEndInput.value;

    // If no dates selected, show all
    if (!startDateStr || !endDateStr) {
      updateChart(allData);
      return;
    }

    const startDate = new Date(`${startDateStr}T00:00:00`);
    const endDate   = new Date(`${endDateStr}T23:59:59`);           // Include the whole day

    const filtered = allData.filter(d => {
      const t = new Date(d.timestamp.replace(' ', 'T'));
      return t >= startDate && t <= endDate;
    });

    updateChart(filtered);
  }


  /*
    ========================
    Apply Button (Date Range)
    ========================
  */

  applyButton.addEventListener('click', () => {
    const startDate = new Date(dateStartInput.value);
    const endDate   = new Date(dateEndInput.value);

    if (!dateStartInput.value || !dateEndInput.value) {
      showNotification('Please select both start and end dates.', 'error');
      return;
    }

    if (startDate > endDate) {
      showNotification('Start date cannot be after end date.', 'error');
      return;
    }

    // Set the new "original" values now that user applied them
    dateStartInput.dataset.originalValue = dateStartInput.value;
    dateEndInput.dataset.originalValue   = dateEndInput.value;

    // Disable the button again after applying
    updateApplyButtonState();

    // If valid, shows notification
    const startStr = startDate.toLocaleDateString(undefined, {
      /* weekday: 'long', */        // restore to show the weekday in notification bar
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const endStr = endDate.toLocaleDateString(undefined, {
      /* weekday: 'long', */        // restore to show the weekday in notification bar
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    showNotification(`Applied date range: ${startStr} to ${endStr}.`, 'success');
    // showNotification(`Applied date range: ${dateStartInput.value} to ${dateEndInput.value}.`, 'success');       // Format YYY-MM-DD

    filterAndUpdateChart();
  });

  // Apply button disabled if no date changed
  let lastAppliedStart = '';
  let lastAppliedEnd = '';

  function updateApplyButtonState() {
    if (!applyButton) return;

    const startOrig = dateStartInput.dataset.originalValue ?? '';
    const endOrig   = dateEndInput.dataset.originalValue ?? '';

    const hasChanged =
      dateStartInput.value !== startOrig ||
      dateEndInput.value   !== endOrig;

    // Enable only if the current values differ from last applied
    applyButton.disabled = !hasChanged;
  }

  // Watch for changes
  dateStartInput.addEventListener('input', updateApplyButtonState);
  dateEndInput.addEventListener('input', updateApplyButtonState);

  // Initial disable
  applyButton.disabled = true;


  /*
    ========================
    Live Sensor Data
    - Fetch /api/current, update UI
    ========================
  */

  async function fetchCurrentData() {
    try {
      const res = await fetch('/api/current', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load current data: ${res.status}`);

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown error");

      const temp = parseFloat(data.temperature);
      const hum  = parseFloat(data.humidity);

      if (!isNaN(temp)) document.getElementById('current-temperature').textContent = `${temp.toFixed(1)}°C`;
      if (!isNaN(hum))  document.getElementById('current-humidity').textContent = `${hum.toFixed(1)}%RH`;

      console.log(`[INFO] Current data updated: ${temp.toFixed(1)}°C, ${hum.toFixed(1)}%RH`);
    } catch (err) {
      console.error("[ERROR] Error fetching current data:", err);
      showNotification("Failed to fetch current sensor data.", "error");            // shows notification bar for error on load data
    }
  }
  
  /*
    ========================
    Reload Button (Manual Refresh)
    - Rotates icon while fetching
    ========================
  */

  if (reloadButton) {
    reloadButton.addEventListener('click', async () => {
      // Prevent double clicks
      if (reloadButton.disabled) return;
      const icon = reloadButton.querySelector('.reload-icon');

      try {
        // Disable button
        reloadButton.disabled = true;

        // Rotate icon once
        if (icon) {
          icon.style.animation = 'spin-continuous 0.8s linear infinite';
        }

        // Fetch current data
        await fetchCurrentData();

        // Show success notification
        showNotification('Current data reloaded successfully.', 'success');
      } catch (err) {
        console.error('[ERROR] Reload failed:', err);
        showNotification('Failed to reload current data.', 'error');
      } finally {
        // Stop rotation and re-enable button
        setTimeout(() => {
          if (icon) icon.style.animation = '';
          reloadButton.disabled = false;
        }, 500);
      }
    });
  }


  /*
    ========================
    Apply Y Limits (Setpoints): fetches /api/settings and applies limits
    ========================
  */

  async function applyChartYLimits() {
    try {
      const data = await safeFetchJson('/api/settings');
      const tempScale = 5;
      const humScale = 2;
      

      // Parse numbers safely
      const minTemp = parseFloat(data.min_temp);
      const maxTemp = parseFloat(data.max_temp);
      const minHum  = parseFloat(data.min_hum);
      const maxHum  = parseFloat(data.max_hum);

      if (!isNaN(minTemp) && !isNaN(maxTemp)) {
        combinedChart.options.scales.yTemp.min = minTemp - humScale;
        combinedChart.options.scales.yTemp.max = maxTemp + humScale;
      }

      if (!isNaN(minTemp) && !isNaN(maxTemp)) {
        combinedChart.options.scales.yHum.min = minHum - tempScale;
        combinedChart.options.scales.yHum.max = maxHum + tempScale;
      }

      // Update chart after modifying limits
      combinedChart.update();

    } catch (err) {
      console.error('[ERROR] Error applying chart limits:', err);
    }
  }


  /*
    ========================
    Mutuation Observer:
    Reapply chart theme when body.class changes
    ========================
  */

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.attributeName === 'class') {
        applyChartTheme(combinedChart);
        break;
      }
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });


  /*
    ========================
    Refresh the page every HH:07 minutes (targetMinute)
    after new data is added to data_log.csv
    ========================
  */

  function scheduleHourlyRefresh() {
    const now = new Date();
    const target = new Date(now);
    const targetMinute = 7;

    // Aim for HH:07 this hour
    target.setMinutes(targetMinute, 0, 0);

    // If we've already passed :07, push to next hour :07
    if (now >= target) {
      target.setHours(now.getHours() + 1, targetMinute, 0, 0);
    }

    const ms = target - now;
    console.log(`[INFO] Auto-refresh scheduled for ${target.toLocaleTimeString()}`);

    setTimeout(() => {
      // Chart reload
      fetchData();
    }, ms);
  }


  /*
    ========================
    Initial Load Sequence
    ========================
  */

  updateSaveButtonState()                           // Update save button to default disabled
  updateApplyButtonState()                          // Update apply button to default disabled
  loadSetpoints();                                  // Setpoints from JSON
  loadCSVDates();                                   // CSV data
  fetchData();                                      // Chart data
  applyChartYLimits();                              // Chart limits, min and max
  fetchCurrentData();                               // Current data
  setInterval(fetchCurrentData, 60000);             // Auto-refresh every 1 minute
  scheduleHourlyRefresh();                          // Refresh the page after new data is added to data_log.csv

});

