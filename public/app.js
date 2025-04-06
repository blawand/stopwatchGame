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

  // Explicitly hide leaderboard and share container on initial load
  document.getElementById("leaderboard").style.display = "none";
  document.getElementById("share-link-container").style.display = "none";

  if (sharedScore && sharedMode) {
    if (["10", "60", "100"].includes(sharedMode)) {
      alert(
        `A friend shared a score of ${sharedScore} seconds in the ${sharedMode}s mode!`
      );
      switchMode(sharedMode); // Apply shared mode
      window.history.replaceState({}, document.title, window.location.pathname); // Clear params
    } else {
      // Clear invalid params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Ensure initial mode is set correctly if params invalid
      switchMode(currentMode); // Set default mode display
    }
  } else {
    // Ensure initial mode is set correctly if no valid params
    switchMode(currentMode); // Set default mode display
  }

  // Removed fetchLeaderboard() call from here
}

function switchMode(mode) {
  if (isCounting) return; // Don't switch modes while timer is running
  currentMode = mode;
  resetTimerDisplay(); // Reset timer display and feedback
  document
    .querySelectorAll(".mode-button")
    .forEach((btn) => btn.classList.remove("selected-mode"));
  document.getElementById(`mode-${mode}`).classList.add("selected-mode");
  document.getElementById("main-button").value = "Start"; // Reset button text
  document.getElementById("leaderboard").style.display = "none"; // Ensure leaderboard is hidden
  document.getElementById("share-link-container").style.display = "none"; // Ensure share link is hidden
}

function onMainButtonClick() {
  if (!isCounting && !isFinished) {
    // --- Start ---
    stopWatch = new Timer(); // Create new timer instance
    stopWatch.start();
    isCounting = true;
    isFinished = false;
    document.getElementById("seconds").innerText = "??"; // Placeholder during run
    document.getElementById("millis").innerText = "???";
    document.getElementById("leaderboard").style.display = "none"; // Hide leaderboard during run
    document.getElementById("share-link-container").style.display = "none";
    removeFeedback(); // Clear previous feedback
    document.getElementById("main-button").value = "Stop"; // Change button text
  } else if (isCounting && !isFinished) {
    // --- Stop ---
    stopWatch.stop();
    isCounting = false;
    isFinished = true;
    showFinalTime(); // Display the final time and feedback
    fetchLeaderboard(); // Fetch and show leaderboard ONLY after stopping
    // fetchLeaderboard will handle making the div visible if scores exist
    document.getElementById("main-button").value = "Reset"; // Change button text
  } else {
    // --- Reset ---
    resetTimerDisplay();
    document.getElementById("main-button").value = "Start"; // Change button text
    document.getElementById("leaderboard").style.display = "none"; // Hide leaderboard on reset
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
  const error = duration / 1000 - target; // Keep sign for direction
  const deviationPercent = ((Math.abs(error) / target) * 100).toFixed(2); // Calculate deviation %
  const direction = error >= 0 ? "over" : "under";
  const feedbackText = `You were ${Math.abs(error).toFixed(
    3
  )} seconds ${direction} (${deviationPercent}%) the target of ${target} seconds.`;

  let feedbackEl = document.getElementById("feedback");
  if (!feedbackEl) {
    feedbackEl = document.createElement("p");
    feedbackEl.id = "feedback";
    // Insert feedback after the timer display
    document
      .querySelector(".timer-display")
      .insertAdjacentElement("afterend", feedbackEl);
  }
  feedbackEl.innerText = feedbackText;
}

function resetTimerDisplay() {
  isCounting = false;
  isFinished = false;
  stopWatch = new Timer(); // Reset timer object

  document.getElementById("seconds").innerText = "00"; // Reset display
  document.getElementById("millis").innerText = "000";
  removeFeedback(); // Remove any existing feedback message
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
    playerName = "Anonymous"; // Default name
  }
  // Client-side name validation (mirroring backend)
  const nameRegex = /^[a-zA-Z0-9 _\-]+$/;
  if (
    playerName !== "Anonymous" &&
    (playerName.length < 1 ||
      playerName.length > 20 ||
      !nameRegex.test(playerName))
  ) {
    alert(
      "Invalid name. Must be 1-20 alphanumeric characters, spaces, underscores, or hyphens."
    );
    return;
  }

  const finalSeconds = (stopWatch.getDuration() / 1000).toFixed(3);
  const honeypotValue = document.getElementById("confirm_email_field").value;

  // Disable button during submission
  const submitButton = document.getElementById("submit-score");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting..."; // Indicate processing

  fetch("/leaderboard", {
    // POST to the same endpoint
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: playerName,
      mode: currentMode,
      score: finalSeconds,
      loadTimestamp: pageLoadTime, // Include page load timestamp
      honeypot: honeypotValue, // Include honeypot value
    }),
  })
    .then((res) => {
      if (!res.ok) {
        // Try to parse error message from backend
        return res.json().then((err) => {
          throw new Error(
            err.message || `Submission failed with status: ${res.status}`
          );
        });
      }
      return res.json(); // Parse success response
    })
    .then((result) => {
      if (result.success) {
        fetchLeaderboard(); // Refresh leaderboard on success
        showShareLink(finalSeconds); // Show share link on success
        document.getElementById("player-name").value = ""; // Clear name input on success
      } else {
        // Should be caught by !res.ok, but handle application-level failure just in case
        throw new Error(result.message || "Submission indicated failure.");
      }
    })
    .catch((error) => {
      console.error("Submission Error:", error);
      alert(`Error submitting score: ${error.message}`); // Show error to user
    })
    .finally(() => {
      // Re-enable button regardless of success or failure
      submitButton.disabled = false;
      submitButton.textContent = "Submit Score";
    });
}

function showShareLink(sec) {
  const shareUrl = `${window.location.origin}${
    window.location.pathname // Use current path
  }?score=${encodeURIComponent(sec)}&mode=${encodeURIComponent(currentMode)}`;
  const shareMessage = `Try to beat my score of ${sec}s in the ${currentMode}s mode! ${shareUrl}`;
  const linkInput = document.getElementById("share-link");
  linkInput.value = shareMessage;
  document.getElementById("share-link-container").style.display = "block"; // Show container
}

function copyShareLink() {
  const linkInput = document.getElementById("share-link");
  linkInput.select(); // Select the text
  linkInput.setSelectionRange(0, 99999); // For mobile devices

  let message = "Could not copy. Please copy manually.";
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(linkInput.value)
        .then(() => {
          alert("Share message copied to clipboard!");
        })
        .catch((clipboardErr) => {
          console.warn("Async clipboard API failed:", clipboardErr);
          // Fallback attempt only if promise fails
          if (document.execCommand("copy")) {
            alert("Share message copied to clipboard!");
          } else {
            throw new Error("Fallback copy failed");
          }
        });
    } else if (document.execCommand("copy")) {
      // Legacy fallback
      alert("Share message copied to clipboard!");
    } else {
      throw new Error("Copy command not supported");
    }
  } catch (err) {
    console.error("Copy link failed:", err);
    alert(message); // Alert failure message
  }
}

function fetchLeaderboard() {
  const leaderboardDiv = document.getElementById("leaderboard"); // Get reference
  leaderboardDiv.innerHTML = `<p>Loading leaderboard...</p>`; // Show loading state
  leaderboardDiv.style.display = "block"; // Make sure div is visible for loading message

  fetch("/leaderboard") // GET from the same endpoint
    .then((r) => {
      if (!r.ok) {
        throw new Error(`Failed to fetch leaderboard (${r.status})`);
      }
      return r.json();
    })
    .then((data) => {
      leaderboardDiv.innerHTML = ""; // Clear previous leaderboard/loading

      // Group scores by mode (data is already sorted by deviation overall)
      const groups = data.reduce((acc, score) => {
        // Basic validation on received score object
        if (
          score &&
          score.mode &&
          score.name &&
          score.score &&
          score.deviation
        ) {
          (acc[score.mode] = acc[score.mode] || []).push(score);
        } else {
          console.warn(
            "Received invalid score object in leaderboard data:",
            score
          );
        }
        return acc;
      }, {});

      const modeOrder = ["10", "60", "100"]; // Desired display order

      let hasScores = false; // Track if any scores are displayed
      modeOrder.forEach((mode) => {
        if (groups[mode] && groups[mode].length > 0) {
          hasScores = true;
          const modeHeader = document.createElement("h3");
          modeHeader.textContent = `${mode}s Mode High Scores`;
          leaderboardDiv.appendChild(modeHeader);

          const table = document.createElement("table");
          table.className = "leaderboard-table";
          table.innerHTML = `
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Time (s)</th>
                  <th>Error (%)</th>
                </tr>
              </thead>
              <tbody></tbody>
            `;

          const tbody = table.querySelector("tbody");
          groups[mode].forEach((entry, index) => {
            // Add index for rank
            const tr = document.createElement("tr");

            // Sanitize output just in case, though backend should handle validation
            const rankTd = document.createElement("td");
            rankTd.textContent = index + 1;
            const nameTd = document.createElement("td");
            nameTd.textContent = entry.name; // Assume names are safe based on backend regex
            const scoreTd = document.createElement("td");
            scoreTd.textContent = parseFloat(entry.score).toFixed(3); // Format score
            const deviationTd = document.createElement("td");
            deviationTd.textContent = parseFloat(entry.deviation).toFixed(2); // Format deviation

            tr.appendChild(rankTd);
            tr.appendChild(nameTd);
            tr.appendChild(scoreTd);
            tr.appendChild(deviationTd);
            tbody.appendChild(tr);
          });
          leaderboardDiv.appendChild(table);
        }
      });

      // Display message if no scores found for any mode
      if (!hasScores) {
        leaderboardDiv.innerHTML = "<p>No scores yet for any mode!</p>"; // Change message slightly
        // Keep the div visible to show the "No scores yet" message
        leaderboardDiv.style.display = "block";
      } else {
        leaderboardDiv.style.display = "block"; // Ensure visible if scores were added
      }
    })
    .catch((error) => {
      console.error("Error fetching leaderboard:", error);
      leaderboardDiv.innerHTML = `<p style="color: red;">Could not load leaderboard data: ${error.message}</p>`;
      leaderboardDiv.style.display = "block"; // Show the error message
    });
}

// Initialize the page when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", initPage);
