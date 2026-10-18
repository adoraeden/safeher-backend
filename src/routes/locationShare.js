const express = require('express');
const { firestore } = require('../config/firebaseAdmin');

const router = express.Router();

router.get('/:sessionId', async (req, res) => {
  try {
    const doc = await firestore.collection('location_shares').doc(req.params.sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'This location share does not exist.' });
    }
    const data = doc.data();
    const expiresAt = new Date(data.expiresAt);
    if (!data.active || expiresAt < new Date()) {
      return res.status(410).json({ error: 'This location share has ended.' });
    }
    res.json({
      lat: data.lat,
      lng: data.lng,
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt,
      sharerName: data.sharerName || 'A SafeHer user',
    });
  } catch (err) {
    console.error('Location share error:', err.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;