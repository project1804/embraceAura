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

// Simulation state
let simHighTempStart = null;
let simHighStressStart = null;
let simHighHeartRateStart = null;

// 5 minutes threshold
const HIGH_TEMP_THRESHOLD = 37.8;
const HIGH_STRESS_THRESHOLD = 70;
const HIGH_HEARTRATE_THRESHOLD = 100;
const HIGH_ALERT_DURATION = 5 * 60 * 1000; // 5 minutes

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
  checkAlerts(data, false);
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

function checkAlerts(data, isSim = false) {
  const now = Date.now();
  const { temperature, stressLevel, heartRate } = data;

  let anyAlert = false;

  if (isSim) {
    // Simulated high readings timer logic
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

    // Only show suggestions if a simulated alert has actually been triggered
    if (anyAlert) {
      showSuggestions();
    } else {
      hideSuggestions();
    }
    return;
  }

  // ======== REAL SENSOR LOGIC ========
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
    checkAlerts(data, true);
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
  // Force the simulation check to think 5 minutes has elapsed
  simHighTempStart = Date.now() - HIGH_ALERT_DURATION;
  simHighStressStart = Date.now() - HIGH_ALERT_DURATION;
  simHighHeartRateStart = Date.now() - HIGH_ALERT_DURATION;

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

