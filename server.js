const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const scoresFile = path.join(__dirname, 'scores.json');

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public'

// Ensure scores.json exists
if (!fs.existsSync(scoresFile)) {
  fs.writeFileSync(scoresFile, JSON.stringify([]));
}

// GET leaderboard
app.get('/leaderboard', (req, res) => {
  let scores = JSON.parse(fs.readFileSync(scoresFile));
  // Sort scores in ascending order (lower time is better)
  scores.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
  scores = scores.slice(0, 20); // Return top 20 scores
  res.json(scores);
});

// POST a new score
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});