const express = require('express');
const cors = require('cors');
const assistantRoutes = require('./routes/assistant');
const locationShareRoutes = require('./routes/locationShare');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.on('finish', () => {
    console.log(`[RES] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SafeHer backend is running' });
});

app.use('/api/ai/assistant', assistantRoutes);
app.use('/api/location-share', locationShareRoutes);

module.exports = app;