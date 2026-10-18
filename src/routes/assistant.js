const express = require('express');
const verifyFirebaseToken = require('../middleware/verifyFirebaseToken');
const { getAssistantReply } = require('../services/geminiService');

const router = express.Router();

router.post('/', verifyFirebaseToken, async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }

  const t0 = Date.now();

  try {
    const reply = await getAssistantReply(
      message.trim(),
      Array.isArray(history) ? history : []
    );
    const durationMs = Date.now() - t0;
    console.log(`[Assistant] OK — ${durationMs}ms, reply ${reply.length} chars`);
    return res.json({ reply });

  } catch (err) {
    const durationMs = Date.now() - t0;
    const msg = (err?.message || '').toLowerCase();

    // Categorize the error for a user-friendly message and correct HTTP status.
    let status = 502;
    let userMessage = 'The AI assistant is temporarily unavailable. Please try again in a moment.';

    if (msg.includes('gemini_api_key') || msg.includes('not configured')) {
      status = 500;
      userMessage = 'AI assistant is not configured on the server. Please check the backend .env file.';
      console.error(`[Assistant] Config error — ${durationMs}ms:`, err.message);
    } else if (msg.includes('invalid') && msg.includes('key')) {
      status = 500;
      userMessage = 'Invalid Gemini API key. Please check the backend .env file.';
      console.error(`[Assistant] Auth error — ${durationMs}ms:`, err.message);
    } else if (msg.includes('timeout') || msg.includes('etimedout')) {
      status = 504;
      userMessage = 'The AI assistant took too long to respond. Please try again.';
      console.error(`[Assistant] Timeout — ${durationMs}ms:`, err.message);
    } else if (msg.includes('429') || msg.includes('quota')) {
      status = 429;
      userMessage = 'The AI assistant is busy right now. Please wait a moment and try again.';
      console.error(`[Assistant] Rate limited — ${durationMs}ms:`, err.message);
    } else {
      console.error(`[Assistant] Error — ${durationMs}ms:`, err.message || err);
    }

    return res.status(status).json({ error: userMessage });
  }
});

module.exports = router;