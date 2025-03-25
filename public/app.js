// Timer object
function Timer() {
  this.startTime = null;
  this.stopTime = null;
  this.isRunning = false;

  this.start = function() {
    this.startTime = new Date();
    this.stopTime = null;
    this.isRunning = true;
  };

  this.stop = function() {
    this.stopTime = new Date();
    this.isRunning = false;
  };

  this.getDuration = function() {
    if (!this.startTime) return 0;
    if (this.isRunning) {
      return new Date() - this.startTime;
    } else if (this.stopTime) {
      return this.stopTime - this.startTime;
    }
    return 0;
  };
}

// Global variables
let stopWatch = new Timer();
let updateInterval = null;
let currentMode = '10'; // default mode is 10 seconds
let isCounting = false;
let isFinished = false;

// Initialize page
function initPage() {
  document.body.onkeydown = function(e) {
    if (e.keyCode === 32) { // spacebar
      onMainButtonClick();
    }
  };

  // Check URL parameters for shared score (optional)
  const urlParams = new URLSearchParams(window.location.search);
  const sharedScore = urlParams.get('score');
  if (sharedScore) {
    alert("A friend has shared a score of " + sharedScore + " seconds!");
  }

  fetchLeaderboard();
}

// Switch modes
function switchMode(mode) {
  currentMode = mode;
  resetTimerDisplay();
  document.getElementById('main-button').value = "Start";
}

// Main button handler (Start/Stop/Reset)
function onMainButtonClick() {
  if (!isCounting) {
    clearInterval(updateInterval);
    stopWatch = new Timer();
    stopWatch.start();
    isCounting = true;
    isFinished = false;
    document.getElementById('main-button').value = "Stop";
    updateInterval = setInterval(updateDisplay, 10);
  } else if (isCounting && !isFinished) {
    stopWatch.stop();
    clearInterval(updateInterval);
    isCounting = false;
    isFinished = true;
    document.getElementById('main-button').value = "Reset";
    updateDisplay();
  } else if (isFinished) {
    resetTimerDisplay();
  }
}

function resetTimerDisplay() {
  isCounting = false;
  isFinished = false;
  clearInterval(updateInterval);
  stopWatch = new Timer();
  document.getElementById('seconds').innerText = "00";
  document.getElementById('millis').innerText = "000";
  document.getElementById('main-button').value = "Start";
}

// Update timer display
function updateDisplay() {
  let dur = stopWatch.getDuration();
  let s = Math.floor(dur / 1000);
  let ms = dur % 1000;
  let secStr = s < 10 ? "0" + s : s.toString();
  let msStr = ms < 10 ? "00" + ms : ms < 100 ? "0" + ms : ms.toString();

  document.getElementById('seconds').innerText = secStr;
  document.getElementById('millis').innerText = msStr;

  if (s >= parseInt(currentMode)) {
    stopWatch.stop();
    clearInterval(updateInterval);
    isCounting = false;
    isFinished = true;
    document.getElementById('main-button').value = "Reset";
  }
}

// Submit score to the server
function submitScore() {
  if (!isFinished) {
    alert("You must finish the timer before submitting a score!");
    return;
  }
  let playerName = document.getElementById('player-name').value.trim();
  if (!playerName) playerName = "Anonymous";

  let dur = stopWatch.getDuration();
  let finalSeconds = (dur / 1000).toFixed(3);

  let data = { name: playerName, mode: currentMode, score: finalSeconds };

  fetch('/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      alert("Score submitted successfully!");
      fetchLeaderboard();
      showShareLink(finalSeconds);
    } else {
      alert("There was a problem saving your score.");
    }
  })
  .catch(err => console.log("Error: ", err));
}

// Fetch leaderboard data
function fetchLeaderboard() {
  fetch('/leaderboard')
    .then(response => response.json())
    .then(data => {
      let tbody = document.querySelector('#leaderboard-table tbody');
      tbody.innerHTML = "";
      data.forEach(entry => {
        let tr = document.createElement('tr');
        tr.innerHTML = `<td>${entry.name}</td><td>${entry.mode}</td><td>${entry.score}</td>`;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.log("Error: ", err));
}

// Share link functions
function showShareLink(finalSeconds) {
  const linkContainer = document.getElementById('share-link-container');
  const linkField = document.getElementById('share-link');
  let baseUrl = window.location.href.split('?')[0];
  let shareUrl = baseUrl + '?score=' + finalSeconds;
  linkField.value = shareUrl;
  linkContainer.style.display = 'block';
}

function copyShareLink() {
  const linkField = document.getElementById('share-link');
  linkField.select();
  linkField.setSelectionRange(0, 99999);
  document.execCommand("copy");
  alert("Link copied to clipboard!");
}