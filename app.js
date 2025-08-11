// ======== FIREBASE CONFIG ========
const firebaseConfig = {
  apiKey: "AIzaSyDojSgXigZkJLLji5VVkKFFxfoSUPH-s7I",
  authDomain: "embraceaura-4c3ca.firebaseapp.com",
  databaseURL: "https://embraceaura-4c3ca-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "embraceaura-4c3ca",
  appId: "1:295591457751:web:495fdc2a400b5d3a909192"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ======== ELEMENT REFERENCES ========
const tempDisplay = document.getElementById("temperatureDisplay");
const heartRateDisplay = document.getElementById("heartRateDisplay");
const stressDisplay = document.getElementById("stressLevelDisplay");
const lastUpdatedEl = document.getElementById("lastUpdated");

const tempStatus = document.getElementById("tempStatus");
let stressStatus = document.getElementById("stressStatus");
let heartRateStatus = document.getElementById("heartRateStatus");

const suggestionCard = document.getElementById("suggestionCard");

const careTemp = document.getElementById("careTemp");
const careHR = document.getElementById("careHR");
const careStress = document.getElementById("careStress");
const careUpdated = document.getElementById("careUpdated");

// ======== STATE ========
let alertCount = 0;
let highTempStart = null;
let highStressStart = null;
let highHeartRateStart = null;
let countdownTimer = null;

// Simulation state
let simHighTempStart = null;
let simHighStressStart = null;
let simHighHeartRateStart = null;

// 5 minutes threshold
const HIGH_TEMP_THRESHOLD = 37.8;
const HIGH_STRESS_THRESHOLD = 70;
const HIGH_HEARTRATE_THRESHOLD = 100;
const HIGH_ALERT_DURATION = 5 * 60 * 1000; // 5 minutes

// ======== CHART.JS SETUP ========
// Latest reading (from simulation or Firebase)
let latestReading = null;

// Chart buffers and config
const MAX_POINTS = 60; // keep last 60 minutes
const chartLabels = [];
const tempSeries = [];
const hrSeries = [];
const stressSeries = [];

let healthChart = null;
const healthCanvas = document.getElementById('healthChart');

if (healthCanvas && typeof Chart !== 'undefined') {
  const ctx = healthCanvas.getContext('2d');
  healthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: tempSeries,
          borderColor: 'rgb(220,53,69)', // red
          tension: 0.2,
          pointRadius: 2,
          yAxisID: 'y1'
        },
        {
          label: 'Heart Rate (bpm)',
          data: hrSeries,
          borderColor: 'rgb(54,162,235)', // blue
          tension: 0.2,
          pointRadius: 2,
          yAxisID: 'y2'
        },
        {
          label: 'Stress Level',
          data: stressSeries,
          borderColor: 'rgb(40,167,69)', // green
          tension: 0.2,
          pointRadius: 2,
          yAxisID: 'y3'
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          title: { display: true, text: 'Time' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Temperature (°C)' },
          suggestedMin: 35,
          suggestedMax: 40
        },
        y2: {
          type: 'linear',
          display: false,
          position: 'right',
          title: { display: true, text: 'Heart Rate (bpm)' },
          suggestedMin: 40,
          suggestedMax: 140,
          grid: { drawOnChartArea: false }
        },
        y3: {
          type: 'linear',
          display: false,
          position: 'right',
          title: { display: true, text: 'Stress Level' },
          suggestedMin: 0,
          suggestedMax: 100,
          grid: { drawOnChartArea: false }
        }
      },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

// Format time label
function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Add a point to the chart (safe if chart not present)
function updateHealthChart(temp, hr, stress, ts = Date.now()) {
  if (!healthChart) return; // no canvas present or Chart.js not loaded
  const label = formatTimeLabel(ts);

  chartLabels.push(label);
  tempSeries.push(Number(temp.toFixed ? temp.toFixed(1) : (Math.round(temp*10)/10)));
  hrSeries.push(Number(hr));
  stressSeries.push(Number(stress));

  // keep arrays within MAX_POINTS
  while (chartLabels.length > MAX_POINTS) {
    chartLabels.shift();
    tempSeries.shift();
    hrSeries.shift();
    stressSeries.shift();
  }

  healthChart.update('none'); // 'none' disables animation for instant update
}

// Sampler: push the latest reading every minute.
setInterval(() => {
  if (!latestReading) return;
  updateHealthChart(latestReading.temperature, latestReading.heartRate, latestReading.stressLevel, Date.now());
}, 60 * 1000); // 60s

// ======== FIREBASE LISTENER ========
db.ref("Headband/Skin").on("value", snapshot => {
  const skinTemp = snapshot.val(); // Get the skin temperature from Firebase
  if (skinTemp !== null) {
    // Assuming sensor data includes skin (temperature)
    latestReading = {
      temperature: skinTemp,
      heartRate: latestReading?.heartRate || 80, // default heart rate if unavailable
      stressLevel: latestReading?.stressLevel || 20, // default stress level if unavailable
      timestamp: Date.now()
    };

    // Update the temperature UI with live sensor data
    updateMomDashboard(latestReading);
    updateCaregiverDashboard(latestReading);

    // Update chart instantly with live data
    if (healthChart) {
      updateHealthChart(latestReading.temperature, latestReading.heartRate, latestReading.stressLevel, latestReading.timestamp);
    }

    // Check alerts based on the latest sensor data
    checkAlerts(latestReading);
  }
});

// ======== UPDATE UI FUNCTIONS ========
function updateMomDashboard(data) {
  tempDisplay.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  heartRateDisplay.textContent = `${data.heartRate} bpm`;
  stressDisplay.textContent = data.stressLevel;
  lastUpdatedEl.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;

  tempStatus.textContent = data.temperature > HIGH_TEMP_THRESHOLD ? "High Temperature" : "Normal";
  tempStatus.classList.toggle("alert", data.temperature > HIGH_TEMP_THRESHOLD);

  stressStatus.textContent = data.stressLevel > HIGH_STRESS_THRESHOLD ? "High Stress" : "Normal";
  stressStatus.classList.toggle("alert", data.stressLevel > HIGH_STRESS_THRESHOLD);

  heartRateStatus.textContent = data.heartRate > HIGH_HEARTRATE_THRESHOLD ? "High Heart Rate" : "Normal";
  heartRateStatus.classList.toggle("alert", data.heartRate > HIGH_HEARTRATE_THRESHOLD);
}

function updateCaregiverDashboard(data) {
  careTemp.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  careHR.textContent = `${data.heartRate} bpm`;
  careStress.textContent = data.stressLevel;
  careUpdated.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

// ======== ALERT CHECKING ========
function checkAlerts(data, isSim = false) {
  const now = Date.now();
  const { temperature, stressLevel, heartRate } = data;

  let anyAlert = false;

  if (isSim) {
    // Simulated high readings (simulation mode)
    if (temperature > HIGH_TEMP_THRESHOLD) {
      if (!simHighTempStart) simHighTempStart = now;
      else if (now - simHighTempStart >= HIGH_ALERT_DURATION) {
        pushAlert(`Simulation: Temperature ${temperature.toFixed(1)} \u00B0C for 5 min`);
        anyAlert = true;
        simHighTempStart = null;
      }
    } else simHighTempStart = null;

    if (stressLevel > HIGH_STRESS_THRESHOLD) {
      if (!simHighStressStart) simHighStressStart = now;
      else if (now - simHighStressStart >= HIGH_ALERT_DURATION) {
        pushAlert(`Simulation: Stress Level ${stressLevel} for 5 min`);
        anyAlert = true;
        simHighStressStart = null;
      }
    } else simHighStressStart = null;

    if (heartRate > HIGH_HEARTRATE_THRESHOLD) {
      if (!simHighHeartRateStart) simHighHeartRateStart = now;
      else if (now - simHighHeartRateStart >= HIGH_ALERT_DURATION) {
        pushAlert(`Simulation: Heart Rate ${heartRate} bpm for 5 min`);
        anyAlert = true;
        simHighHeartRateStart = null;
      }
    } else simHighHeartRateStart = null;

    if (anyAlert) showSuggestions();
    else hideSuggestions();
    return;
  }

  // Real sensor logic
  if (temperature > HIGH_TEMP_THRESHOLD) {
    if (!highTempStart) highTempStart = now;
    else if (now - highTempStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Temperature above ${HIGH_TEMP_THRESHOLD}\u00B0C for 5 min`);
      anyAlert = true;
      highTempStart = null;
    }
  } else highTempStart = null;

  if (stressLevel > HIGH_STRESS_THRESHOLD) {
    if (!highStressStart) highStressStart = now;
    else if (now - highStressStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Stress level above ${HIGH_STRESS_THRESHOLD} for 5 min`);
      anyAlert = true;
      highStressStart = null;
    }
  } else highStressStart = null;

  if (heartRate > HIGH_HEARTRATE_THRESHOLD) {
    if (!highHeartRateStart) highHeartRateStart = now;
    else if (now - highHeartRateStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Heart rate above ${HIGH_HEARTRATE_THRESHOLD} bpm for 5 min`);
      anyAlert = true;
      highHeartRateStart = null;
    }
  } else highHeartRateStart = null;

  // ======== CAREGIVER BUTTON LOGIC ========
  // Check if any of the readings are still above the threshold for 5 minutes
  if (temperature > HIGH_TEMP_THRESHOLD || stressLevel > HIGH_STRESS_THRESHOLD || heartRate > HIGH_HEARTRATE_THRESHOLD) {
    const highAlertDuration = now - Math.max(highTempStart || 0, highStressStart || 0, highHeartRateStart || 0);
    if (highAlertDuration >= HIGH_ALERT_DURATION) {
      document.getElementById("caregiverButton").style.display = "block"; // Show caregiver button
    } else {
      document.getElementById("caregiverButton").style.display = "none"; // Hide caregiver button
    }
  } else {
    document.getElementById("caregiverButton").style.display = "none"; // Hide caregiver button if none of the readings are above threshold
  }

  // If any alert occurred, show suggestions and start countdown
  if (anyAlert) {
    showSuggestions();
    startCountdown(HIGH_ALERT_DURATION);
  } else {
    hideSuggestions();
    stopCountdown();
  }
}



// ======== COUNTDOWN FUNCTIONS ========
function startCountdown(duration) {
  let remaining = Math.ceil(duration / 1000);
  updateCountdownDisplay(remaining);

  stopCountdown();
  countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      stopCountdown();
      updateCountdownDisplay(0);
      return;
    }
    updateCountdownDisplay(remaining);
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  if (countdownEl) countdownEl.textContent = "";
}

function updateCountdownDisplay(seconds) {
  if (!countdownEl) return;
  countdownEl.textContent = seconds > 0 ? seconds : '';
}

// ======== SUGGESTIONS & ALERTS ========
function showSuggestions() {
  suggestionCard.style.display = "block";
}

function hideSuggestions() {
  suggestionCard.style.display = "none";
}

function pushAlert(message) {
  console.log('Pushing alert:', message);  // Debugging: Check if this is called

  // Ensure alertBadge exists before proceeding
  const alertBadge = document.getElementById("alertBadge");
  if (!alertBadge) {
    console.error('alertBadge not found!');
    return;  // Exit if alertBadge is not found
  }

  // Increment alert count and update the badge
  alertCount++;  
  alertBadge.style.display = "inline-block";  // Ensure the alert count badge is visible
  alertBadge.textContent = alertCount;  // Update the alert count displayed

  // Ensure alertsList is found
  const alertsList = document.getElementById("alertsList");
  if (!alertsList) {
    console.error('alertsList not found!');
    return;  // Exit if alertsList is not found
  }

  // Create a new alert item
  const alertItem = document.createElement("div");
  alertItem.className = "card alert";
  alertItem.textContent = `${new Date().toLocaleTimeString()} — ${message}`;

  // Check if "No alerts yet" message exists and remove it
  const mutedText = alertsList.querySelector(".muted");
  if (mutedText) {
    mutedText.remove();  // Remove the "No alerts yet" text
  }

  // Prepend the new alert item to the alerts list
  alertsList.prepend(alertItem);

  // Always make sure the alerts section is visible when there are alerts
  alertsList.style.display = "block";  

  // Optional: Scroll to the top of the alert list for visibility
  alertsList.scrollTop = 0;
}



// ======== SIMULATION TOOL ========
function simulateData() {
  const data = {
    temperature: parseFloat(simTemp.value) || 37.0,
    heartRate: parseInt(simHeart.value) || 80,
    stressLevel: parseInt(simStress.value) || 20,
    timestamp: Date.now()
  };

  if (simPush.checked) {
    // If pushing to Firebase, the Firebase listener will set latestReading and the chart will update
    db.ref("sensorData").set(data);
  } else {
    // local simulation: update UI and set latestReading so the sampler will add to chart every minute
    updateMomDashboard(data);
    updateCaregiverDashboard(data);
    checkAlerts(data, true); // simulation mode
    latestReading = data;

    // Always add an immediate chart point on local simulate, so user sees it instantly
    if (healthChart) {
      updateHealthChart(data.temperature, data.heartRate, data.stressLevel, data.timestamp);
    }
  }
}
window.simulateData = simulateData;

// ======== NEW: SIMULATE 5 MINUTES PASSED ========
function simulateFiveMinutesPassed() {
  const data = {
    temperature: parseFloat(simTemp.value) || 37.0,
    heartRate: parseInt(simHeart.value) || 80,
    stressLevel: parseInt(simStress.value) || 20,
    timestamp: Date.now() - HIGH_ALERT_DURATION // Pretend this was recorded 5 min ago
  };

  // Force the simulation timers to look as if they started 5 minutes ago
  simHighTempStart = Date.now() - HIGH_ALERT_DURATION;
  simHighStressStart = Date.now() - HIGH_ALERT_DURATION;
  simHighHeartRateStart = Date.now() - HIGH_ALERT_DURATION;

  // Update UI and latestReading (sampler will add next minute; we also add a historical timestamp point)
  updateMomDashboard(data);
  updateCaregiverDashboard(data);
  latestReading = data;

  // Add immediate chart point with the older timestamp so it appears on timeline
  if (healthChart) {
    updateHealthChart(data.temperature, data.heartRate, data.stressLevel, data.timestamp);
  }

  // run the normal simulation alert check which will now pass
  checkAlerts(data, true);
}
window.simulateFiveMinutesPassed = simulateFiveMinutesPassed;

// ======== MUSIC FUNCTIONS ========
function toggleMusic() {
  const audio = document.getElementById("calmAudio");
  const choice = document.getElementById("musicChoice").value;

  if (audio.src.indexOf(choice) === -1) {
    audio.src = choice;
  }

  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}
window.toggleMusic = toggleMusic;

// ======== TOOL FUNCTIONS ========
function startBreathing() {
  alert("Guided breathing started.");
}
window.startBreathing = startBreathing;

function showAffirmation() {
  alert("You are strong, calm, and capable.");
}
window.showAffirmation = showAffirmation;

function callNow() {
  alert("Calling caregiver...");
}
window.callNow = callNow;

function markAllHandled() {
  alertsList.innerHTML = `<div class="muted">All alerts handled.</div>`;
  alertCount = 0;
  alertBadge.style.display = "none";
}
window.markAllHandled = markAllHandled;

function clearAlerts() {
  alertsList.innerHTML = `<div class="muted">No alerts yet.</div>`;
  alertCount = 0;
  alertBadge.style.display = "none";
}
window.clearAlerts = clearAlerts;

// ======== NEW: SUGGESTIONS AFTER 5 MINUTES ========
function checkAlerts(data, isSim = false) {
  const now = Date.now();
  const { temperature, stressLevel, heartRate } = data;

  let anyAlert = false;

  if (temperature > HIGH_TEMP_THRESHOLD || stressLevel > HIGH_STRESS_THRESHOLD || heartRate > HIGH_HEARTRATE_THRESHOLD) {
    const highAlertDuration = now - (highTempStart || highStressStart || highHeartRateStart);
    if (highAlertDuration >= HIGH_ALERT_DURATION) {
      document.getElementById("caregiverButton").style.display = "block"; // Show the caregiver button
    }
  } else {
    document.getElementById("caregiverButton").style.display = "none"; // Hide the caregiver button
  }
}










