// ======== UTF-8 SUPPORT ========
document.charset = "UTF-8";

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

const countdownEl = document.getElementById("countdownTimer");

// ======== STATE ========
let alertCount = 0;
let highTempStart = null;
let highHeartStart = null;
let highStressStart = null;
let countdownTimer = null;

const HIGH_TEMP_THRESHOLD = 37.8;
const HIGH_HEART_THRESHOLD = 100;
const HIGH_STRESS_THRESHOLD = 70;
const HIGH_ALERT_DURATION = 60 * 1000; // 1 min

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
  checkAlerts(data.temperature, data.heartRate, data.stressLevel, false);
});

// ======== UPDATE UI FUNCTIONS ========
function updateMomDashboard(data) {
  tempDisplay.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
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
  careTemp.textContent = `${data.temperature.toFixed(1)} \u00B0C`;
  careHR.textContent = `${data.heartRate} bpm`;
  careStress.textContent = data.stressLevel;
  careUpdated.textContent = `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

// ======== ALERT CHECKING ========
function checkAlerts(temp, heart, stress, isSim = false) {
  const now = Date.now();

  handleAlert("Temperature", temp, HIGH_TEMP_THRESHOLD, now, isSim, highTempStart, v => highTempStart = v);
  handleAlert("Heart Rate", heart, HIGH_HEART_THRESHOLD, now, isSim, highHeartStart, v => highHeartStart = v);
  handleAlert("Stress Level", stress, HIGH_STRESS_THRESHOLD, now, isSim, highStressStart, v => highStressStart = v);
}

function handleAlert(type, value, threshold, now, isSim, startTime, setStartTime) {
  if (isSim && value > threshold) {
    showSuggestions();
    pushAlert(`Simulation: ${type} ${value}`);
    return;
  }

  if (!isSim && value > threshold) {
    if (!startTime) {
      setStartTime(now);
      startCountdown(HIGH_ALERT_DURATION, type);
    } else if (now - startTime >= HIGH_ALERT_DURATION) {
      stopCountdown();
      showSuggestions();
      pushAlert(`${type} above ${threshold} for 1 min`);
      setStartTime(null);
    }
  } else {
    setStartTime(null);
    hideSuggestions();
    stopCountdown();
  }
}

// ======== COUNTDOWN FUNCTIONS ========
function startCountdown(duration, type) {
  let remaining = Math.ceil(duration / 1000);
  updateCountdownDisplay(remaining, type);

  stopCountdown();
  countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      stopCountdown();
      updateCountdownDisplay(0, type);
      return;
    }
    updateCountdownDisplay(remaining, type);
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  if (countdownEl) countdownEl.textContent = "";
}

function updateCountdownDisplay(seconds, type) {
  if (!countdownEl) return;
  countdownEl.textContent = seconds > 0 ? `${type} alert in ${seconds}s` : '';
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
    checkAlerts(data.temperature, data.heartRate, data.stressLevel, true);
  }
}
window.simulateData = simulateData;

// ======== TOOL FUNCTIONS ========
function toggleMusic() {
  const audio = document.getElementById("calmAudio");
  if (audio && audio.paused) {
    audio.play().catch(()=>{});
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
