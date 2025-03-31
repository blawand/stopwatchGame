function Timer() {
  this.startTime = null;
  this.stopTime = null;
  this.isRunning = false;

  this.start = function () {
    this.startTime = new Date();
    this.stopTime = null;
    this.isRunning = true;
  };

  this.stop = function () {
    this.stopTime = new Date();
    this.isRunning = false;
  };

  this.getDuration = function () {
    if (!this.startTime) return 0;
    return this.isRunning
      ? new Date() - this.startTime
      : this.stopTime - this.startTime;
  };
}

let stopWatch = new Timer();
let currentMode = "10";
let isCounting = false;
let isFinished = false;
let pageLoadTime = Date.now();

function initPage() {
  document.body.onkeydown = function (e) {
    if (e.key === " " || e.keyCode === 32) {
      const activeTag = document.activeElement.tagName.toLowerCase();
      if (activeTag !== "input" && activeTag !== "textarea") {
        onMainButtonClick();
        e.preventDefault();
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const sharedScore = params.get("score");
  const sharedMode = params.get("mode");

  if (sharedScore && sharedMode) {
    if (["10", "60", "100"].includes(sharedMode)) {
      alert(
        `A friend shared a score of ${sharedScore} seconds in the ${sharedMode}s mode!`
      );
      switchMode(sharedMode);
    } else {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  fetchLeaderboard();
}

function switchMode(mode) {
  if (isCounting) return;
  currentMode = mode;
  resetTimerDisplay();
  document
    .querySelectorAll(".mode-button")
    .forEach((btn) => btn.classList.remove("selected-mode"));
  document.getElementById(`mode-${mode}`).classList.add("selected-mode");
  document.getElementById("main-button").value = "Start";
  document.getElementById("leaderboard").style.display = "none";
  document.getElementById("share-link-container").style.display = "none";
}

function onMainButtonClick() {
  if (!isCounting && !isFinished) {
    stopWatch = new Timer();
    stopWatch.start();
    isCounting = true;
    isFinished = false;
    document.getElementById("seconds").innerText = "??";
    document.getElementById("millis").innerText = "???";
    document.getElementById("leaderboard").style.display = "none";
    document.getElementById("share-link-container").style.display = "none";
    removeFeedback();
    document.getElementById("main-button").value = "Stop";
  } else if (isCounting && !isFinished) {
    stopWatch.stop();
    isCounting = false;
    isFinished = true;
    showFinalTime();
    document.getElementById("leaderboard").style.display = "block";
    document.getElementById("main-button").value = "Reset";
  } else {
    resetTimerDisplay();
    document.getElementById("main-button").value = "Start";
    document.getElementById("leaderboard").style.display = "none";
    document.getElementById("share-link-container").style.display = "none";
  }
}

function showFinalTime() {
  const duration = stopWatch.getDuration();
  const finalSeconds = (duration / 1000).toFixed(3);
  const parts = finalSeconds.split(".");
  document.getElementById("seconds").innerText = parts[0].padStart(2, "0");
  document.getElementById("millis").innerText = parts[1].padEnd(3, "0");

  const target = parseInt(currentMode);
  const error = (duration / 1000 - target).toFixed(3);
  const direction = error >= 0 ? "over" : "under";
  const feedbackText = `You were ${Math.abs(
    error
  )} seconds ${direction} the target of ${target} seconds.`;

  let feedbackEl = document.getElementById("feedback");
  if (!feedbackEl) {
    feedbackEl = document.createElement("p");
    feedbackEl.id = "feedback";
    document.querySelector(".timer-container").appendChild(feedbackEl);
  }
  feedbackEl.innerText = feedbackText;
}

function resetTimerDisplay() {
  isCounting = false;
  isFinished = false;
  stopWatch = new Timer();

  document.getElementById("seconds").innerText = "00";
  document.getElementById("millis").innerText = "000";
  removeFeedback();
}

function removeFeedback() {
  const el = document.getElementById("feedback");
  if (el) el.remove();
}

function submitScore() {
  if (!isFinished) {
    alert("Finish the timer before submitting a score!");
    return;
  }
  let playerName = document.getElementById("player-name").value.trim();
  if (!playerName) {
    playerName = "Anonymous";
  }

  const finalSeconds = (stopWatch.getDuration() / 1000).toFixed(3);
  const honeypotValue = document.getElementById("confirm_email_field").value;

  fetch("/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: playerName,
      mode: currentMode,
      score: finalSeconds,
      loadTimestamp: pageLoadTime,
      honeypot: honeypotValue,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((err) => {
          throw new Error(err.message || "Submission failed");
        });
      }
      return res.json();
    })
    .then((result) => {
      if (result.success) {
        fetchLeaderboard();
        showShareLink(finalSeconds);
      } else {
        throw new Error(result.message || "Submission failed");
      }
    })
    .catch((error) => {
      console.error("Submission Error:", error);
      alert(`Error submitting score: ${error.message}`);
    });
}

function showShareLink(sec) {
  const shareUrl = `${window.location.origin}${
    window.location.pathname
  }?score=${encodeURIComponent(sec)}&mode=${encodeURIComponent(currentMode)}`;
  const shareMessage = `Try to beat my score of ${sec}s in the ${currentMode}s mode! ${shareUrl}`;
  const link = document.getElementById("share-link");
  link.value = shareMessage;
  document.getElementById("share-link-container").style.display = "block";
}

function copyShareLink() {
  const linkInput = document.getElementById("share-link");
  linkInput.select();
  linkInput.setSelectionRange(0, 99999);
  try {
    document.execCommand("copy");
    alert("Share link copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy text: ", err);
    alert("Failed to copy link. Please copy it manually.");
  }
}

function fetchLeaderboard() {
  fetch("/leaderboard")
    .then((r) => {
      if (!r.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      return r.json();
    })
    .then((data) => {
      const leaderboardDiv = document.getElementById("leaderboard");
      leaderboardDiv.innerHTML = "";

      const groups = data.reduce((acc, score) => {
        (acc[score.mode] = acc[score.mode] || []).push(score);
        return acc;
      }, {});

      const modeOrder = ["10", "60", "100"];

      modeOrder.forEach((mode) => {
        if (groups[mode] && groups[mode].length > 0) {
          const modeHeader = document.createElement("h3");
          modeHeader.textContent = `${mode}s Mode High Scores`;
          leaderboardDiv.appendChild(modeHeader);

          const table = document.createElement("table");
          table.className = "leaderboard-table";
          table.innerHTML = `
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Time (s)</th>
                  <th>Error (%)</th>
                </tr>
              </thead>
              <tbody></tbody>
            `;

          const tbody = table.querySelector("tbody");
          groups[mode].forEach((entry) => {
            const tr = document.createElement("tr");
            const nameTd = document.createElement("td");
            nameTd.textContent = entry.name;
            const scoreTd = document.createElement("td");
            scoreTd.textContent = entry.score;
            const deviationTd = document.createElement("td");
            deviationTd.textContent = entry.deviation;

            tr.appendChild(nameTd);
            tr.appendChild(scoreTd);
            tr.appendChild(deviationTd);
            tbody.appendChild(tr);
          });
          leaderboardDiv.appendChild(table);
        }
      });

      if (leaderboardDiv.innerHTML === "") {
        leaderboardDiv.textContent = "No scores yet!";
      }
    })
    .catch((error) => {
      console.error("Error fetching leaderboard:", error);
      const leaderboardDiv = document.getElementById("leaderboard");
      leaderboardDiv.innerHTML = "<p>Could not load leaderboard data.</p>";
    });
}

document.addEventListener("DOMContentLoaded", initPage);
