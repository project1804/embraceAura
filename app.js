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
// Listener for SkinTemp (Temperature)
db.ref("SkinTemp").on("value", snapshot => {
  const skinTemp = snapshot.val(); // Get the skin temperature from Firebase
  if (skinTemp !== null) {
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

// Listener for BPM (Heart Rate)
db.ref("BPM").on("value", snapshot => {
  const heartRate = snapshot.val(); // Get the heart rate from Firebase
  if (heartRate !== null) {
    latestReading = {
      temperature: latestReading?.temperature || 36.7, // default skin temp if unavailable
      heartRate: heartRate,
      stressLevel: latestReading?.stressLevel || 20, // default stress level if unavailable
      timestamp: Date.now()
    };

    // Update the heart rate UI with live sensor data
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
// Update the Mom's Dashboard
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

// Update the Caregiver's Dashboard
function updateCaregiverDashboard(data) {
  careTemp.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  careHR.textContent = `${data.heartRate} bpm`;
  careStress.textContent = data.stressLevel;
  careUpdated.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

// ======== ALERT CHECKING ========
// Check for abnormal readings and trigger alerts
function checkAlerts(data) {
  const now = Date.now();
  const { temperature, stressLevel, heartRate } = data;

  let anyAlert = false;

  // Check if stress level is above the threshold
  if (stressLevel > HIGH_STRESS_THRESHOLD) {
    if (!highStressStart) {
      highStressStart = now; // Start timer if first abnormal reading
    } else if (now - highStressStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Stress level above ${HIGH_STRESS_THRESHOLD} for 5 min`);
      anyAlert = true;
    }
  } else {
    highStressStart = null;
  }

  // Check if temperature is above the threshold
  if (temperature > HIGH_TEMP_THRESHOLD) {
    if (!highTempStart) {
      highTempStart = now;
    } else if (now - highTempStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Temperature above ${HIGH_TEMP_THRESHOLD}\u00B0C for 5 min`);
      anyAlert = true;
    }
  } else {
    highTempStart = null;
  }

  // Check if heart rate is above the threshold
  if (heartRate > HIGH_HEARTRATE_THRESHOLD) {
    if (!highHeartRateStart) {
      highHeartRateStart = now;
    } else if (now - highHeartRateStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Heart rate above ${HIGH_HEARTRATE_THRESHOLD} bpm for 5 min`);
      anyAlert = true;
    }
  } else {
    highHeartRateStart = null;
  }

  // If any alert is triggered, show suggestions and start countdown
  if (anyAlert) {
    showSuggestions(); 
    startCountdown(HIGH_ALERT_DURATION);
  } else {
    hideSuggestions();
    stopCountdown();
  }

  // Show caregiver button after 5 minutes of abnormal readings
  if (stressLevel > HIGH_STRESS_THRESHOLD || temperature > HIGH_TEMP_THRESHOLD || heartRate > HIGH_HEARTRATE_THRESHOLD) {
    const highAlertDuration = now - Math.max(highTempStart || 0, highStressStart || 0, highHeartRateStart || 0);
    if (highAlertDuration >= HIGH_ALERT_DURATION) {
      document.getElementById("caregiverButton").style.display = "block"; // Show caregiver button
    }
  } else {
    document.getElementById("caregiverButton").style.display = "none"; // Hide caregiver button
  }
}
// ======== SIMULATION TOOL ========
// Simulate and push the latest data
function simulateData() {
  const data = {
    temperature: parseFloat(simTemp.value) || 37.0,
    heartRate: parseInt(simHeart.value) || 80,
    stressLevel: parseInt(simStress.value) || 20,
    timestamp: Date.now()
  };

  // Update latestReading with simulated data
  latestReading = {
    temperature: data.temperature,
    heartRate: data.heartRate,
    stressLevel: data.stressLevel,
    timestamp: data.timestamp
  };

  // If simPush is checked, push to Firebase
  if (simPush.checked) {
    db.ref("sensorData").set(latestReading);
  } else {
    // Local simulation: update UI and set latestReading
    updateMomDashboard(latestReading);
    updateCaregiverDashboard(latestReading);
    checkAlerts(latestReading, true); // simulation mode
    // Update chart instantly with simulated data
    if (healthChart) {
      updateHealthChart(latestReading.temperature, latestReading.heartRate, latestReading.stressLevel, latestReading.timestamp);
    }
  }
}

// Simulate 5 minutes passed with adjusted data
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

  // Update the UI and latestReading (sampler will add next minute)
  updateMomDashboard(data);
  updateCaregiverDashboard(data);
  latestReading = data;

  // Add immediate chart point with the older timestamp so it appears on timeline
  if (healthChart) {
    updateHealthChart(data.temperature, data.heartRate, data.stressLevel, data.timestamp);
  }

  // Run the normal simulation alert check which will now pass
  checkAlerts(data, true);
}
window.simulateData = simulateData;
window.simulateFiveMinutesPassed = simulateFiveMinutesPassed;

