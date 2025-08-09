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

// ======== STATE ========
let alertCount = 0;
let highTempStart = null;
const HIGH_TEMP_THRESHOLD = 37.8; 
const HIGH_TEMP_DURATION = 60 * 1000; // 1 min for live data

// ======== NAVIGATION ========
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".panel").forEach(panel => panel.classList.remove("active"));
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

// ======== FIREBASE LISTENER ========
db.ref("sensorData").on("value", snapshot => {
  const data = snapshot.val();
  if (!data) return;

  updateMomDashboard(data);
  updateCaregiverDashboard(data);
  checkTemperatureAlert(data.temperature, false); // live data mode
});

// ======== UPDATE UI FUNCTIONS ========
function updateMomDashboard(data) {
  tempDisplay.textContent = `${data.temperature.toFixed(1)} °C`;
  heartRateDisplay.textContent = `${data.heartRate} bpm`;
  stressDisplay.textContent = data.stressLevel;
  lastUpdatedEl.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
  
  if (data.temperature > HIGH_TEMP_THRESHOLD) {
    tempStatus.textContent = "High Temperature";
    tempStatus.classList.add("alert");
  } else {
    tempStatus.textContent = "Normal";
    tempStatus.classList.remove("alert");
  }
}

function updateCaregiverDashboard(data) {
  careTemp.textContent = `${data.temperature.toFixed(1)} °C`;
  careHR.textContent = `${data.heartRate} bpm`;
  careStress.textContent = data.stressLevel;
  careUpdated.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

function checkTemperatureAlert(temp, isSim = false) {
  const now = Date.now();

  // Simulation triggers instantly for easier testing
  if (isSim && temp > HIGH_TEMP_THRESHOLD) {
    showSuggestions();
    pushAlert("Simulation: Temperature above threshold");
    return;
  }

  // Live data requires 1 min
  if (temp > HIGH_TEMP_THRESHOLD) {
    if (!highTempStart) {
      highTempStart = now;
    } else if (now - highTempStart >= HIGH_TEMP_DURATION) {
      showSuggestions();
      pushAlert("Temperature above 37.8°C for 1 min");
      highTempStart = null; 
    }
  } else {
    highTempStart = null;
    hideSuggestions();
  }
}

function showSuggestions() {
  suggestionCard.style.display = "block";
}

function hideSuggestions() {
  suggestionCard.style.display = "none";
}

function pushAlert(message) {
  alertCount++;
  alertBadge.style.display = "inline-block";
  alertBadge.textContent = alertCount;

  const alertItem = document.createElement("div");
  alertItem.className = "card alert";
  alertItem.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
  alertsList.prepend(alertItem);
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
    checkTemperatureAlert(data.temperature, true); //  instant suggestion for sim
  }
}
window.simulateData = simulateData;

// ======== TOOL FUNCTIONS ========
function toggleMusic() {
  const audio = document.getElementById("calmAudio");
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}
window.toggleMusic = toggleMusic;

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
