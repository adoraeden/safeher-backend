const { auth } = require('../config/firebaseAdmin');

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    console.warn(`[Auth] 401: Missing Bearer token on ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.warn(`[Auth] 401: verifyIdToken failed on ${req.originalUrl} (${err.code || err.message})`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = verifyFirebaseToken;