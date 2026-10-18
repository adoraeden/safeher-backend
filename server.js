const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env first, then .env.local if present to allow local overrides without conflict
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`SafeHer backend running on http://localhost:${PORT}`);
  console.log(`Accessible over local network on port ${PORT}`);
});