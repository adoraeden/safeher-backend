const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

if (!getApps().length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      credential = cert(JSON.parse(jsonStr));
    } catch (err) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err.message);
    }
  }

  if (!credential) {
    const keyPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      credential = cert(require(keyPath));
    }
  }

  if (credential) {
    initializeApp({ credential });
  } else {
    initializeApp();
  }
}

module.exports = { auth: getAuth(), firestore: getFirestore() };