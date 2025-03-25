// ------------------
// Simple Timer Class
// ------------------
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

// ------------------
// Global Variables
// ------------------
let stopWatch = new Timer();
let updateInterval = null;
let currentMode = '10'; // Default game mode
let isCounting = false;
let isFinished = false;

// ------------------
// Page Initialization
// ------------------
function initPage() {
  // Only trigger spacebar if not typing
  document.body.onkeydown = function(e) {
    if (e.keyCode === 32) { // space
      const activeTag = document.activeElement.tagName.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        onMainButtonClick();
        e.preventDefault();
      }
    }
  };

  // Check URL params for shared score
  const urlParams = new URLSearchParams(window.location.search);
  const sharedScore = urlParams.get('score');
  if (sharedScore) {
    alert("A friend shared a score of " + sharedScore + " seconds!");
  }

  // Fetch scores from server (though hidden initially)
  fetchLeaderboard();
}

// ------------------
// Switch Mode
// ------------------
function switchMode(mode) {
  currentMode = mode;
  resetTimerDisplay();
  document.getElementById('main-button').value = "Start";

  // Remove highlight from all mode buttons
  const buttons = document.getElementsByClassName('mode-button');
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('selected-mode');
  }

  // Highlight the currently selected mode button
  const currentButton = document.getElementById('mode-' + mode);
  if (currentButton) {
    currentButton.classList.add('selected-mode');
  }
}

// ------------------
// Main Button Click
// ------------------
function onMainButtonClick() {
  // CASE 1: If not started yet (or we previously reset) -> START
  if (!isCounting && !isFinished) {
    clearInterval(updateInterval);
    stopWatch = new Timer();
    stopWatch.start();

    isCounting = true;
    isFinished = false;

    // Placeholder while running
    document.getElementById('seconds').innerText = "??";
    document.getElementById('millis').innerText = "???";

    // Hide leaderboard while playing
    document.getElementById('leaderboard').style.display = 'none';

    // Switch button to STOP
    document.getElementById('main-button').value = "Stop";

    // Start update loop
    updateInterval = setInterval(updateDisplay, 50);

  // CASE 2: If currently counting -> STOP
  } else if (isCounting && !isFinished) {
    stopWatch.stop();
    clearInterval(updateInterval);

    isCounting = false;
    isFinished = true;

    // Reveal final time
    showFinalTime();

    // Show leaderboard
    document.getElementById('leaderboard').style.display = 'block';

    // Switch button to RESET
    document.getElementById('main-button').value = "Reset";

  // CASE 3: If finished -> RESET
  } else if (isFinished) {
    resetTimerDisplay();
  }
}

// Show final time on screen
function showFinalTime() {
  const duration = stopWatch.getDuration();
  let s = Math.floor(duration / 1000);
  let ms = duration % 1000;

  let secStr = s < 10 ? "0" + s : s.toString();
  let msStr = ms < 10 ? "00" + ms : ms < 100 ? "0" + ms : ms.toString();

  document.getElementById('seconds').innerText = secStr;
  document.getElementById('millis').innerText = msStr;
}

// ------------------
// Reset Timer
// ------------------
function resetTimerDisplay() {
  isCounting = false;
  isFinished = false;
  clearInterval(updateInterval);
  stopWatch = new Timer();

  document.getElementById('seconds').innerText = "00";
  document.getElementById('millis').innerText = "000";
  document.getElementById('main-button').value = "Start";
  document.getElementById('leaderboard').style.display = 'none';
}

// ------------------
// Update Display
// (While Counting)
// ------------------
function updateDisplay() {
  // Check if time exceeded the currentMode
  const duration = stopWatch.getDuration();
  let s = Math.floor(duration / 1000);

  if (s >= parseInt(currentMode)) {
    // If we hit the target time, auto-stop
    stopWatch.stop();
    clearInterval(updateInterval);

    isCounting = false;
    isFinished = true;

    // Reveal final time and show leaderboard
    showFinalTime();
    document.getElementById('leaderboard').style.display = 'block';

    document.getElementById('main-button').value = "Reset";
  }
  // If we wanted a ticking placeholder, we could do it here, 
  // but for now we simply keep the `-- // --` unless we stop.
}

// ------------------
// Submit Score
// ------------------
function submitScore() {
  if (!isFinished) {
    alert("Finish the timer before submitting a score!");
    return;
  }
  let playerName = document.getElementById('player-name').value.trim();
  if (!playerName) playerName = "Anonymous";

  const duration = stopWatch.getDuration();
  let finalSeconds = (duration / 1000).toFixed(3);

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
      alert("Problem saving your score.");
    }
  })
  .catch(err => console.error("Error:", err));
}

// ------------------
// Fetch Leaderboard
// (Top 20 per mode,
// sorted by % deviation)
// ------------------
function fetchLeaderboard() {
  fetch('/leaderboard')
    .then(response => response.json())
    .then(data => {
      let tbody = document.querySelector('#leaderboard-table tbody');
      tbody.innerHTML = "";

      data.forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${entry.name}</td>
          <td>${entry.mode}</td>
          <td>${entry.score}</td>
          <td>${entry.deviation}</td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => console.error("Error:", err));
}

// ------------------
// Share Link
// ------------------
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