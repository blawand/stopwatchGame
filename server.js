const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config(); // Keep for local dev, Vercel will use its own env vars

const { createClient } = require("@supabase/supabase-js");

console.log("--- Server script started ---"); // Log script start

const app = express();
const PORT = process.env.PORT || 3000;
console.log(`Attempting to run on PORT: ${PORT}`); // Log port

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

console.log("Setting up static file serving from 'public' directory...");
app.use(express.static(path.join(__dirname, "public")));
console.log("Static file serving configured.");

console.log("Attempting to read environment variables for Supabase...");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// More detailed logging for env vars
console.log(
  `SUPABASE_URL read as: ${
    supabaseUrl ? supabaseUrl.substring(0, 20) + "..." : "MISSING"
  }`
); // Log first part of URL or MISSING
console.log(
  `SUPABASE_ANON_KEY read as: ${supabaseKey ? "PRESENT" : "MISSING"}`
); // Just check if key is present

let supabase; // Declare supabase client variable

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "CRITICAL ERROR: Supabase URL and/or Key missing or not read correctly from environment variables."
  );
  // Consider *not* exiting here for debugging, to see if server can listen
  // process.exit(1); // Temporarily comment out exit for debugging
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
    // process.exit(1); // Exit if initialization fails
  }
}

app.get("/", (req, res) => {
  console.log(`[${new Date().toISOString()}] GET / request received`);
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/leaderboard", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] GET /leaderboard request received`
  );
  if (!supabase) {
    console.error("Supabase client not available for /leaderboard GET");
    return res
      .status(500)
      .json({
        success: false,
        message: "Database connection not initialized.",
      });
  }
  try {
    console.log("Fetching scores from Supabase...");
    const { data: scores, error } = await supabase
      .from("scores")
      .select("*")
      .order("deviation", { ascending: true })
      .limit(200);

    if (error) {
      console.error("Supabase fetch error:", error);
      throw error; // Re-throw to be caught by the outer catch block
    }
    console.log(
      `Successfully fetched ${scores ? scores.length : 0} scores from Supabase.`
    );

    // ... (rest of your score processing logic) ...
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
          // Use existing deviation if present, otherwise calculate (should be present now)
          sc.deviation =
            sc.deviation !== undefined
              ? parseFloat(sc.deviation).toFixed(2)
              : ((Math.abs(numericScore - target) / target) * 100).toFixed(2);
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
    // console.log("Processed leaderboard data:", final); // Optional: log processed data
    res.json(final);
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error processing /leaderboard GET:`,
      err
    );
    res
      .status(500)
      .json({ success: false, message: "Error retrieving leaderboard." });
  }
});

app.post("/leaderboard", postLimiter, async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST /leaderboard request received`
  );
  if (!supabase) {
    console.error("Supabase client not available for /leaderboard POST");
    return res
      .status(500)
      .json({
        success: false,
        message: "Database connection not initialized.",
      });
  }
  const { name, mode, score, loadTimestamp, honeypot } = req.body;
  const submissionTime = Date.now();

  // ... (rest of your validation logic) ...
  if (honeypot) {
    console.warn("Honeypot field filled, likely bot detected.");
    return res.status(400).json({ success: false, message: "Bot detected." });
  }

  if (
    typeof loadTimestamp !== "number" ||
    submissionTime - loadTimestamp < MIN_SUBMISSION_TIME_MS
  ) {
    console.warn("Invalid submission time detected.");
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
    console.warn(`Invalid name submitted: ${name}`);
    return res.status(400).json({
      success: false,
      message:
        "Invalid name. Must be 1-20 alphanumeric characters, spaces, underscores, or hyphens.",
    });
  }
  // ... (rest of validation)

  const numericScore = parseFloat(score);
  const target = parseFloat(mode);
  const deviation = ((Math.abs(numericScore - target) / target) * 100).toFixed(
    2
  );

  try {
    console.log(`Attempting to insert score for ${name}...`);
    const { data, error } = await supabase
      .from("scores")
      .insert([{ name: name.trim(), mode, score, deviation }]);

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }

    console.log(`Successfully inserted score for ${name}.`);
    res.json({ success: true });
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Error processing /leaderboard POST:`,
      err
    );
    res.status(500).json({ success: false, message: "Error saving score." });
  }
});

// Ensure app.listen is called *after* all route definitions
app
  .listen(PORT, () => {
    console.log(`--- Server attempting to listen on port ${PORT} ---`);
    console.log(`--- Server successfully listening! Ready for requests. ---`); // Confirmation log
  })
  .on("error", (err) => {
    console.error("--- Server failed to start listening: ---", err); // Log specific listen errors
  });

console.log("--- Server script finished initial execution ---"); // Log end of script run
