// ======== IMAGE REFERENCE SETUP (with GIFs and PNG for low stress) ========
const lowHeartGif = 'path_to_your_gifs/slow_heart.gif';
const highHeartGif = 'path_to_your_gifs/fast_heart.gif';
const lowStressPng = 'path_to_your_images/low_stress.png';  // PNG for low stress
const highStressGif = 'path_to_your_gifs/high_stress.gif';
const lowTempGif = 'path_to_your_gifs/cool_temp.gif';
const highTempGif = 'path_to_your_gifs/hot_temp.gif';

// ======== FIREBASE CONFIG ========
const firebaseConfig = {
  apiKey: "AIzaSyDojXgXigZkJLLji5VVkKFFxfoSUPH-s7I",
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

if (!stressStatus) {
  stressStatus = document.createElement("span");
  stressStatus.id = "stressStatus";
  tempStatus.parentElement.insertBefore(stressStatus, tempStatus.nextSibling);
}
if (!heartRateStatus) {
  heartRateStatus = document.createElement("span");
  heartRateStatus.id = "heartRateStatus";
  tempStatus.parentElement.insertBefore(heartRateStatus, stressStatus.nextSibling);
}

const suggestionCard = document.getElementById("suggestionCard");

const careTemp = document.getElementById("careTemp");
const careHR = document.getElementById("careHR");
const careStress = document.getElementById("careStress");
const careUpdated = document.getElementById("careUpdated");

const alertsList = document.getElementById("alertsList");
const alertBadge = document.getElementById("alertBadge");

const simTemp = document.getElementById("simTemp");
const simHeart = document.getElementById("simHeart");
const simStress = document.getElementById("simStress");
const simPush = document.getElementById("simPush");

const countdownEl = document.getElementById("momCountdown");

// ======== STATE ========
let alertCount = 0;
let highTempStart = null;
let highStressStart = null;
let highHeartRateStart = null;
let countdownTimer = null;

// ======== CHART.JS SETUP ========
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

// ======== UPDATE UI WITH IMAGES BASED ON DATA ========
function updateMomDashboard(data) {
  tempDisplay.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  heartRateDisplay.textContent = `${data.heartRate} bpm`;
  stressDisplay.textContent = data.stressLevel;
  lastUpdatedEl.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;

  // Update temperature status with GIF
  if (data.temperature > HIGH_TEMP_THRESHOLD) {
    tempStatus.src = highTempGif;  // GIF for high temperature
  } else {
    tempStatus.src = lowTempGif;  // GIF for low temperature
  }

  // Update stress status with appropriate image
  if (data.stressLevel > HIGH_STRESS_THRESHOLD) {
    stressStatus.src = highStressGif;  // GIF for high stress
  } else {
    stressStatus.src = lowStressPng;  // PNG for low stress
  }

  // Update heart rate status with GIF
  if (data.heartRate > HIGH_HEARTRATE_THRESHOLD) {
    heartRateStatus.src = highHeartGif;  // GIF for high heart rate
  } else {
    heartRateStatus.src = lowHeartGif;  // GIF for normal heart rate
  }
}

// ======== FIREBASE LISTENER ========
db.ref("sensorData").on("value", snapshot => {
  const data = snapshot.val();
  if (!data) return;

  updateMomDashboard(data);
  updateCaregiverDashboard(data);
  latestReading = data;

  if (healthChart) {
    updateHealthChart(data.temperature, data.heartRate, data.stressLevel, data.timestamp || Date.now());
  }

  checkAlerts(data, false);
});

// ======== ALERT CHECKING ========
function checkAlerts(data, isSim = false) {
  const now = Date.now();
  const { temperature, stressLevel, heartRate } = data;

  let anyAlert = false;

  if (isSim) {
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
      pushAlert(`Heart rate above ${HIGH_HEARTRATE_THRESHOLD} bpm for 1 min`);
      anyAlert = true;
      highHeartRateStart = null;
    }
  } else highHeartRateStart = null;

  if (anyAlert) {
    showSuggestions();
    startCountdown(HIGH_ALERT_DURATION);
  } else {
    hideSuggestions();
    stopCountdown();
  }
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
    db.ref("sensorData").set(data);
  } else {
    updateMomDashboard(data);
    updateCaregiverDashboard(data);
    checkAlerts(data, true);
    latestReading = data;

    if (healthChart) {
      updateHealthChart(data.temperature, data.heartRate, data.stressLevel, data.timestamp);
    }
  }
}
window.simulateData = simulateData;
