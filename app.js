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
// Add these in your HTML with IDs stressStatus and heartRateStatus for this to work
let stressStatus = document.getElementById("stressStatus");
let heartRateStatus = document.getElementById("heartRateStatus");

// If they don’t exist yet, create and insert them next to tempStatus for example:
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

const countdownEl = document.getElementById("momCountdown"); // Using momCountdown from your HTML

// ======== STATE ========
let alertCount = 0;
let highTempStart = null;
let highStressStart = null;
let highHeartRateStart = null;
let countdownTimer = null;

const HIGH_TEMP_THRESHOLD = 37.8; 
const HIGH_STRESS_THRESHOLD = 70;   // Adjust as needed
const HIGH_HEARTRATE_THRESHOLD = 100; // Adjust as needed
const HIGH_ALERT_DURATION = 60 * 1000; // 1 minute duration

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
  checkAlerts(data, false); // live data mode
});

// ======== UPDATE UI FUNCTIONS ========
function updateMomDashboard(data) {
  tempDisplay.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  heartRateDisplay.textContent = `${data.heartRate} bpm`;
  stressDisplay.textContent = data.stressLevel;
  lastUpdatedEl.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;

  // Temperature status
  if (data.temperature > HIGH_TEMP_THRESHOLD) {
    tempStatus.textContent = "High Temperature";
    tempStatus.classList.add("alert");
  } else {
    tempStatus.textContent = "Normal";
    tempStatus.classList.remove("alert");
  }

  // Stress status
  if (data.stressLevel > HIGH_STRESS_THRESHOLD) {
    stressStatus.textContent = "High Stress";
    stressStatus.classList.add("alert");
  } else {
    stressStatus.textContent = "Normal";
    stressStatus.classList.remove("alert");
  }

  // Heart Rate status
  if (data.heartRate > HIGH_HEARTRATE_THRESHOLD) {
    heartRateStatus.textContent = "High Heart Rate";
    heartRateStatus.classList.add("alert");
  } else {
    heartRateStatus.textContent = "Normal";
    heartRateStatus.classList.remove("alert");
  }
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

  // Instant alerts in simulation mode
  if (isSim) {
    if (temperature > HIGH_TEMP_THRESHOLD) {
      pushAlert(`Simulation: Temperature ${temperature.toFixed(1)} \u00B0C`);
      anyAlert = true;
    }
    if (stressLevel > HIGH_STRESS_THRESHOLD) {
      pushAlert(`Simulation: Stress Level ${stressLevel}`);
      anyAlert = true;
    }
    if (heartRate > HIGH_HEARTRATE_THRESHOLD) {
      pushAlert(`Simulation: Heart Rate ${heartRate} bpm`);
      anyAlert = true;
    }
    if (anyAlert) showSuggestions();
    else hideSuggestions();
    return;
  }

  // Live data alerts with duration check
  if (temperature > HIGH_TEMP_THRESHOLD) {
    if (!highTempStart) highTempStart = now;
    else if (now - highTempStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Temperature above ${HIGH_TEMP_THRESHOLD}\u00B0C for 1 min`);
      anyAlert = true;
      highTempStart = null;
    }
  } else {
    highTempStart = null;
  }

  if (stressLevel > HIGH_STRESS_THRESHOLD) {
    if (!highStressStart) highStressStart = now;
    else if (now - highStressStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Stress level above ${HIGH_STRESS_THRESHOLD} for 1 min`);
      anyAlert = true;
      highStressStart = null;
    }
  } else {
    highStressStart = null;
  }

  if (heartRate > HIGH_HEARTRATE_THRESHOLD) {
    if (!highHeartRateStart) highHeartRateStart = now;
    else if (now - highHeartRateStart >= HIGH_ALERT_DURATION) {
      pushAlert(`Heart rate above ${HIGH_HEARTRATE_THRESHOLD} bpm for 1 min`);
      anyAlert = true;
      highHeartRateStart = null;
    }
  } else {
    highHeartRateStart = null;
  }

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

  stopCountdown(); // clear if already running
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
    checkAlerts(data, true); // instant suggestion for simulation
  }
}
window.simulateData = simulateData;

// ======== TOOL FUNCTIONS ========
function toggleMusic() {
  const audio = document.getElementById("calmAudio");
  if (audio && audio.paused) {
    audio.play().catch(() => { }); // ignore play errors
  } else if (audio) {
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
