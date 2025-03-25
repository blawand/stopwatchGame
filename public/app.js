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
    return this.isRunning ? new Date() - this.startTime : this.stopTime - this.startTime;
  };
}

// ------------------
// Global Variables
// ------------------
let stopWatch = new Timer();
let currentMode = '10';
let isCounting = false;
let isFinished = false;

// ------------------
// Page Initialization
// ------------------
function initPage() {
  document.body.onkeydown = function(e) {
    if (e.keyCode === 32) {
      const tag = document.activeElement.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        onMainButtonClick();
        e.preventDefault();
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const sharedScore = params.get('score');
  const sharedMode = params.get('mode');

  // If a user visited via a share link
  if (sharedScore && sharedMode) {
    alert(`A friend shared a score of ${sharedScore} seconds in the ${sharedMode}s mode!`);
    if (['10', '60', '100'].includes(sharedMode)) {
      switchMode(sharedMode);
    }
  } else if (sharedScore) {
    // If only score is in the query (older links)
    alert(`A friend shared a score of ${sharedScore} seconds!`);
  }

  // Fetch leaderboard once at startup
  fetchLeaderboard();
}

// ------------------
// Switch Mode
// ------------------
function switchMode(mode) {
  currentMode = mode;
  resetTimerDisplay();
  document.getElementById('main-button').value = 'Start';
  document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('selected-mode'));
  document.getElementById(`mode-${mode}`).classList.add('selected-mode');
}

// ------------------
// Main Button Click
// ------------------
function onMainButtonClick() {
  if (!isCounting && !isFinished) {
    stopWatch = new Timer();
    stopWatch.start();
    isCounting = true;
    document.getElementById('seconds').innerText = '??';
    document.getElementById('millis').innerText = '???';
    document.getElementById('leaderboard').style.display = 'none';
    removeFeedback();
    document.getElementById('main-button').value = 'Stop';
  } else if (isCounting && !isFinished) {
    stopWatch.stop();
    isCounting = false;
    isFinished = true;
    showFinalTime();
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('main-button').value = 'Reset';
  } else {
    resetTimerDisplay();
  }
}

// ------------------
// Show Final Time & Feedback
// ------------------
function showFinalTime() {
  const duration = stopWatch.getDuration();
  const seconds = Math.floor(duration / 1000);
  const millis = duration % 1000;

  document.getElementById('seconds').innerText = String(seconds).padStart(2, '0');
  document.getElementById('millis').innerText = String(millis).padStart(3, '0');

  const target = parseInt(currentMode);
  const error = (duration / 1000 - target).toFixed(3);
  const direction = error >= 0 ? 'over' : 'under';
  const feedbackText = `You were ${Math.abs(error)} seconds ${direction} the target of ${target} seconds.`;

  let feedbackEl = document.getElementById('feedback');
  if (!feedbackEl) {
    feedbackEl = document.createElement('p');
    feedbackEl.id = 'feedback';
    document.querySelector('.timer-container').appendChild(feedbackEl);
  }
  feedbackEl.innerText = feedbackText;
}

// ------------------
// Reset Timer
// ------------------
function resetTimerDisplay() {
  isCounting = false;
  isFinished = false;
  stopWatch = new Timer();

  document.getElementById('seconds').innerText = '00';
  document.getElementById('millis').innerText = '000';
  removeFeedback();
  document.getElementById('main-button').value = 'Start';
  document.getElementById('leaderboard').style.display = 'none';
}

function removeFeedback() {
  const el = document.getElementById('feedback');
  if (el) el.remove();
}

// ------------------
// Submit Score
// ------------------
function submitScore() {
  if (!isFinished) {
    alert("Finish the timer before submitting a score!");
    return;
  }
  let playerName = document.getElementById('player-name').value.trim() || "Anonymous";
  const finalSeconds = (stopWatch.getDuration() / 1000).toFixed(3);

  fetch('/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: playerName, mode: currentMode, score: finalSeconds })
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      alert("Score submitted successfully!");
      fetchLeaderboard();
      showShareLink(finalSeconds);
    }
  })
  .catch(console.error);
}

// ------------------
// Show Share Link
// ------------------
function showShareLink(sec) {
  // Construct a friendly message that includes the user’s score and the mode
  const shareMessage = `Check out this Stopwatch Game! Try to beat my score of ${sec}s in the ${currentMode}s mode: `
    + `${window.location.origin}${window.location.pathname}?score=${sec}&mode=${currentMode}`;

  const link = document.getElementById('share-link');
  link.value = shareMessage; // Put the full text into the text field

  document.getElementById('share-link-container').style.display = 'block';
}

function copyShareLink() {
  document.getElementById('share-link').select();
  document.execCommand('copy');
  alert('Link copied!');
}

// ------------------
// Remaining functions (unchanged)
// ------------------
function fetchLeaderboard() { fetch('/leaderboard').then(r => r.json()).then(data => { const tbody = document.querySelector('#leaderboard-table tbody'); tbody.innerHTML=''; data.forEach(e => { const tr=document.createElement('tr'); tr.innerHTML=`<td>${e.name}</td><td>${e.mode}</td><td>${e.score}</td><td>${e.deviation}</td>`; tbody.appendChild(tr); }); }); }
function showShareLink(sec) { const link=document.getElementById('share-link'); link.value=`${window.location.href.split('?')[0]}?score=${sec}`; document.getElementById('share-link-container').style.display='block'; }
function copyShareLink() { document.getElementById('share-link').select(); document.execCommand('copy'); alert('Link copied!'); }