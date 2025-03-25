const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const scoresFile = path.join(__dirname, 'scores.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Adjust if needed (e.g. if your static files are in root)

// Ensure scores.json exists
if (!fs.existsSync(scoresFile)) {
  fs.writeFileSync(scoresFile, JSON.stringify([]));
}

// GET /leaderboard
app.get('/leaderboard', (req, res) => {
  let scores = JSON.parse(fs.readFileSync(scoresFile));

  // Group by mode: 10, 60, 100
  let modes = { '10': [], '60': [], '100': [] };

  scores.forEach(sc => {
    if (['10', '60', '100'].includes(sc.mode)) {
      let numericScore = parseFloat(sc.score);
      let target = parseFloat(sc.mode);
      // Percent deviation from target
      let deviation = (Math.abs(numericScore - target) / target) * 100;
      sc.deviation = deviation.toFixed(2);
      modes[sc.mode].push(sc);
    }
  });

  // For each mode, sort by deviation ascending & keep top 20
  Object.keys(modes).forEach(m => {
    modes[m].sort((a, b) => parseFloat(a.deviation) - parseFloat(b.deviation));
    modes[m] = modes[m].slice(0, 20);
  });

  // Combine results (10 first, then 60, then 100)
  let final = [...modes['10'], ...modes['60'], ...modes['100']];

  res.json(final);
});

// POST /leaderboard
app.post('/leaderboard', (req, res) => {
  const { name, mode, score } = req.body;
  if (!name || !mode || !score) {
    return res.status(400).json({ success: false, message: 'Invalid data.' });
  }

  let scores = JSON.parse(fs.readFileSync(scoresFile));
  scores.push({ name, mode, score });
  fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));

  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});