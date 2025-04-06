const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

console.log("--- Stopwatch Server script started ---");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
console.log(`Attempting to run Stopwatch Server on PORT: ${PORT}`);

const MIN_SUBMISSION_TIME_MS = 2000;
const MAX_NAME_LENGTH = 20;
const MIN_NAME_LENGTH = 1;
const ALLOWED_MODES = ["10", "60", "100"];
const NAME_REGEX = /^[a-zA-Z0-9 _\-]+$/;
const SCORE_REGEX = /^\d+(\.\d{1,3})?$/;
const STOPWATCH_TABLE = "scores_stopwatch"; // Define table name constant

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

console.log("Setting up static file serving from 'public' directory...");
app.use(express.static(path.join(__dirname, "public")));
console.log("Static file serving configured.");

console.log("Attempting to read environment variables for Supabase...");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log(
  `SUPABASE_URL read as: ${
    supabaseUrl ? supabaseUrl.substring(0, 20) + "..." : "MISSING"
  }`
);
console.log(
  `SUPABASE_ANON_KEY read as: ${supabaseKey ? "PRESENT" : "MISSING"}`
);

let supabase;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "CRITICAL ERROR: Supabase URL and/or Key missing or not read correctly from environment variables."
  );
} else {
  try {
    console.log(
      "Supabase credentials seem present. Initializing Supabase client..."
    );
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client initialized successfully.");
  } catch (initError) {
    console.error(
      "CRITICAL ERROR: Failed to initialize Supabase client:",
      initError
    );
    supabase = null; // Ensure supabase is null on error
  }
}

app.get("/", (req, res) => {
  console.log(`[${new Date().toISOString()}] GET / request received`);
  // Serve the index.html specifically for the stopwatch game
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint remains /leaderboard for simplicity, but logic now targets the specific table
app.get("/leaderboard", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /leaderboard request received for Stopwatch`
  );
  if (!supabase) {
    console.error(
      `Supabase client not available for GET /leaderboard (Stopwatch)`
    );
    return res.status(500).json({
      success: false,
      message: "Database connection not initialized.",
    });
  }
  try {
    console.log(`Fetching scores from Supabase table: ${STOPWATCH_TABLE}...`);
    const { data: scores, error } = await supabase
      .from(STOPWATCH_TABLE) // Use the specific table name
      .select("*")
      .order("deviation", { ascending: true })
      .limit(200); // Limit fetched scores

    if (error) {
      console.error(`Supabase fetch error from ${STOPWATCH_TABLE}:`, error);
      throw error;
    }
    console.log(
      `Successfully fetched ${
        scores ? scores.length : 0
      } scores from ${STOPWATCH_TABLE}.`
    );

    // --- Filtering and Sorting Logic (remains the same, operates on fetched data) ---
    let modes = { 10: [], 60: [], 100: [] };
    if (scores && scores.length > 0) {
      scores.forEach((sc) => {
        // Validate score object structure and types before processing
        if (
          ALLOWED_MODES.includes(sc.mode) &&
          typeof sc.score === "string" && // Ensure score is string
          SCORE_REGEX.test(sc.score) && // Validate score format
          sc.deviation !== null && // Deviation should exist
          !isNaN(parseFloat(sc.deviation)) // Deviation should be a number
        ) {
          // Convert deviation to fixed precision for consistent sorting/display
          // Ensure deviation is treated as a number for comparison
          sc.deviation_numeric = parseFloat(sc.deviation);
          modes[sc.mode].push(sc);
        } else {
          // Log detailed info about skipped scores for debugging
          console.warn(
            `Filtered out invalid score entry from ${STOPWATCH_TABLE}:`,
            sc,
            `Mode valid: ${ALLOWED_MODES.includes(sc.mode)}`,
            `Score type/format valid: ${
              typeof sc.score === "string" && SCORE_REGEX.test(sc.score)
            }`,
            `Deviation valid: ${
              sc.deviation !== null && !isNaN(parseFloat(sc.deviation))
            }`
          );
        }
      });

      // Sort within each mode by numeric deviation
      Object.keys(modes).forEach((m) => {
        modes[m].sort((a, b) => a.deviation_numeric - b.deviation_numeric);
        // Format deviation back to string *after* sorting
        modes[m].forEach(
          (sc) => (sc.deviation = sc.deviation_numeric.toFixed(2))
        );
        modes[m] = modes[m].slice(0, 20); // Limit to top 20 per mode
      });
    }

    // Combine the top scores from each mode
    let final = [...modes["10"], ...modes["60"], ...modes["100"]];
    res.json(final); // Send combined, sorted, and limited scores
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error processing GET /leaderboard (Stopwatch):`,
      err
    );
    res
      .status(500)
      .json({ success: false, message: "Error retrieving leaderboard." });
  }
});

// Endpoint remains /leaderboard for simplicity, but logic now targets the specific table
app.post("/leaderboard", postLimiter, async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /leaderboard request received for Stopwatch`
  );
  if (!supabase) {
    console.error(
      `Supabase client not available for POST /leaderboard (Stopwatch)`
    );
    return res.status(500).json({
      success: false,
      message: "Database connection not initialized.",
    });
  }
  const { name, mode, score, loadTimestamp, honeypot } = req.body;
  const submissionTime = Date.now();

  // --- Validation Logic (remains the same) ---
  if (honeypot) {
    console.warn("Honeypot field filled (Stopwatch), likely bot detected.");
    return res.status(400).json({ success: false, message: "Bot detected." });
  }

  if (
    typeof loadTimestamp !== "number" ||
    submissionTime - loadTimestamp < MIN_SUBMISSION_TIME_MS
  ) {
    console.warn("Invalid submission time detected (Stopwatch).");
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
    console.warn(`Invalid name submitted (Stopwatch): ${name}`);
    return res.status(400).json({
      success: false,
      message:
        "Invalid name. Must be 1-20 alphanumeric characters, spaces, underscores, or hyphens.",
    });
  }

  if (!ALLOWED_MODES.includes(mode)) {
    console.warn(`Invalid mode submitted (Stopwatch): ${mode}`);
    return res
      .status(400)
      .json({ success: false, message: "Invalid mode selected." });
  }

  if (typeof score !== "string" || !SCORE_REGEX.test(score)) {
    console.warn(`Invalid score format submitted (Stopwatch): ${score}`);
    return res
      .status(400)
      .json({ success: false, message: "Invalid score format." });
  }

  const numericScore = parseFloat(score);
  const target = parseFloat(mode);

  if (isNaN(numericScore) || isNaN(target) || target <= 0) {
    console.warn(
      `Invalid numeric score or target (Stopwatch): score=${numericScore}, target=${target}`
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid score calculation values." });
  }

  const deviationValue = (Math.abs(numericScore - target) / target) * 100;
  if (isNaN(deviationValue)) {
    console.error(
      `Calculated deviation is NaN (Stopwatch): score=${numericScore}, target=${target}`
    );
    return res.status(500).json({
      success: false,
      message: "Internal error calculating score deviation.",
    });
  }
  const deviation = deviationValue.toFixed(2); // Calculate deviation before insert

  try {
    console.log(
      `Attempting to insert score for ${name} into ${STOPWATCH_TABLE}...`
    );
    const { data, error } = await supabase
      .from(STOPWATCH_TABLE) // Use the specific table name
      .insert([{ name: name.trim(), mode, score, deviation }]); // Ensure deviation is included

    if (error) {
      console.error(`Supabase insert error into ${STOPWATCH_TABLE}:`, error);
      throw error;
    }

    console.log(
      `Successfully inserted score for ${name} into ${STOPWATCH_TABLE}.`
    );
    res.json({ success: true }); // Send success response
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error processing POST /leaderboard (Stopwatch):`,
      err
    );
    // Provide specific feedback for duplicate key errors if possible, else generic
    if (err.code === "23505") {
      // Check for unique constraint violation
      res
        .status(409) // Use 409 Conflict status code
        .json({
          success: false,
          message:
            "Database conflict. Score may already exist or could not be saved.",
        });
    } else {
      res.status(500).json({ success: false, message: "Error saving score." });
    }
  }
});

// --- Server Listening ---
app
  .listen(PORT, () => {
    console.log(
      `--- Stopwatch Server attempting to listen on port ${PORT} ---`
    );
    console.log(
      `--- Stopwatch Server successfully listening! Ready for requests. ---`
    );
  })
  .on("error", (err) => {
    console.error("--- Stopwatch Server failed to start listening: ---", err);
  });

console.log("--- Stopwatch Server script finished initial execution ---");
