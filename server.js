const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const scoresFile = path.join(__dirname, "scores.json");
const MIN_SUBMISSION_TIME_MS = 2000;
const MAX_NAME_LENGTH = 20;
const MIN_NAME_LENGTH = 1;
const ALLOWED_MODES = ["10", "60", "100"];
const NAME_REGEX = /^[a-zA-Z0-9 _\-]+$/;
const SCORE_REGEX = /^\d+(\.\d{1,3})?$/;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many score submissions, please wait a minute.",
  },
});

app.use(limiter);
app.use(bodyParser.json({ limit: "5kb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync(scoresFile)) {
  try {
    fs.writeFileSync(scoresFile, JSON.stringify([]));
  } catch (err) {
    console.error("Failed to create scores file:", err);
    process.exit(1);
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/leaderboard", (req, res) => {
  try {
    let scoresData = fs.readFileSync(scoresFile);
    let scores = JSON.parse(scoresData);

    let modes = { 10: [], 60: [], 100: [] };

    scores.forEach((sc) => {
      if (
        ALLOWED_MODES.includes(sc.mode) &&
        typeof sc.score === "string" &&
        SCORE_REGEX.test(sc.score)
      ) {
        let numericScore = parseFloat(sc.score);
        let target = parseFloat(sc.mode);
        if (!isNaN(numericScore) && !isNaN(target) && target > 0) {
          let deviation = (Math.abs(numericScore - target) / target) * 100;
          sc.deviation = deviation.toFixed(2);
          modes[sc.mode].push(sc);
        }
      }
    });

    Object.keys(modes).forEach((m) => {
      modes[m].sort(
        (a, b) => parseFloat(a.deviation) - parseFloat(b.deviation)
      );
      modes[m] = modes[m].slice(0, 20);
    });

    let final = [...modes["10"], ...modes["60"], ...modes["100"]];
    res.json(final);
  } catch (err) {
    console.error("Error reading or processing leaderboard:", err);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving leaderboard." });
  }
});

app.post("/leaderboard", postLimiter, (req, res) => {
  const { name, mode, score, loadTimestamp, honeypot } = req.body;
  const submissionTime = Date.now();

  if (honeypot) {
    return res.status(400).json({ success: false, message: "Bot detected." });
  }

  if (
    typeof loadTimestamp !== "number" ||
    submissionTime - loadTimestamp < MIN_SUBMISSION_TIME_MS
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid submission time." });
  }

  if (
    typeof name !== "string" ||
    name.length < MIN_NAME_LENGTH ||
    name.length > MAX_NAME_LENGTH ||
    !NAME_REGEX.test(name)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid name. Must be 1-20 alphanumeric characters, spaces, underscores, or hyphens.",
    });
  }

  if (!ALLOWED_MODES.includes(mode)) {
    return res.status(400).json({ success: false, message: "Invalid mode." });
  }

  if (typeof score !== "string" || !SCORE_REGEX.test(score)) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid score format. Must be a number with up to 3 decimal places.",
    });
  }

  const numericScore = parseFloat(score);
  if (isNaN(numericScore) || numericScore < 0 || numericScore > 1000) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid score value." });
  }

  try {
    let scoresData = fs.readFileSync(scoresFile);
    let scores = JSON.parse(scoresData);

    scores.push({ name: name.trim(), mode, score });

    fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error("Error writing score:", err);
    res.status(500).json({ success: false, message: "Error saving score." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
