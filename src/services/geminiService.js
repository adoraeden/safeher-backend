const { GoogleGenAI } = require('@google/genai');

const SYSTEM_PROMPT = `You are the SafeHer AI Safety Assistant, built into a personal safety app.
You give calm, practical safety guidance to people who may be scared, stressed, or in an uncertain situation.

Rules you must always follow:
- You are not law enforcement, a doctor, a lawyer, or any other authority, and must never imply otherwise.
- You cannot see the user's location, contact emergency services, or dispatch help yourself.
- If someone describes an immediate, life-threatening emergency, your first and clearest instruction must be to contact real local emergency services (911/112) or use the app's SOS button. Never claim you have already contacted anyone on their behalf.
- Keep responses short, calm, and actionable — the user may be reading this while distracted, scared, or moving.
- For non-emergency situations (feeling uneasy, being followed, planning a safer route, general safety prep), give practical, concrete steps.
- Never ask for or store sensitive personal details beyond what's needed to answer the question.
- If you are unsure whether a situation is a real emergency, err toward recommending real emergency services.`;

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const PER_ATTEMPT_TIMEOUT_MS = 12000; // 12 seconds per call

function isRetryableError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  ) {
    return true;
  }
  const code = err.status || err.statusCode || err.code;
  if (code && RETRYABLE_STATUS_CODES.has(Number(code))) return true;
  for (const sc of RETRYABLE_STATUS_CODES) {
    if (msg.includes(String(sc))) return true;
  }
  return false;
}

function isQuotaOrDemandError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = Number(err.status || err.statusCode || err.code);
  return (
    code === 429 ||
    code === 503 ||
    code === 404 ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('no longer available')
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCleanContents(message, history = []) {
  const contents = [];

  if (Array.isArray(history)) {
    for (const turn of history) {
      if (!turn || !turn.text || typeof turn.text !== 'string' || !turn.text.trim()) {
        continue;
      }
      // Strip error messages from history
      const text = turn.text.trim();
      if (
        text.startsWith("I couldn't respond just now") ||
        turn.isError === true
      ) {
        continue;
      }

      const role = turn.role === 'assistant' ? 'model' : 'user';

      // Gemini requires the conversation to start with user
      if (contents.length === 0 && role !== 'user') continue;

      // Merge consecutive turns from the same role
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n\n${text}`;
      } else {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  const cleanMessage = message.trim();

  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    const existing = contents[contents.length - 1].parts[0].text;
    if (!existing.includes(cleanMessage)) {
      contents[contents.length - 1].parts[0].text += `\n\n${cleanMessage}`;
    }
  } else {
    contents.push({ role: 'user', parts: [{ text: cleanMessage }] });
  }

  return contents;
}

async function getAssistantReply(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'paste_your_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in the backend environment.');
  }

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';

  // Candidate models to attempt: primary first, then fallback if primary hits 429/503/404
  const modelCandidates = [primaryModel];
  if (fallbackModel && fallbackModel !== primaryModel) {
    modelCandidates.push(fallbackModel);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: PER_ATTEMPT_TIMEOUT_MS,
    },
  });

  const contents = buildCleanContents(message, history);

  let lastErr;

  for (let mIdx = 0; mIdx < modelCandidates.length; mIdx++) {
    const currentModel = modelCandidates[mIdx];
    const maxAttemptsForModel = mIdx === 0 ? 2 : 1; // 2 attempts for primary, 1 for fallback

    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      const t0 = Date.now();
      try {
        console.log(`[GeminiService] Request model: ${currentModel} (attempt ${attempt}/${maxAttemptsForModel})`);

        const response = await ai.models.generateContent({
          model: currentModel,
          contents,
          config: { systemInstruction: SYSTEM_PROMPT },
        });

        const replyText =
          response.text ||
          response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!replyText || !replyText.trim()) {
          throw new Error('Gemini returned an empty response.');
        }

        const durationMs = Date.now() - t0;
        console.log(`[GeminiService] Success with ${currentModel} in ${durationMs}ms`);
        return replyText.trim();

      } catch (err) {
        const durationMs = Date.now() - t0;
        const category = isRetryableError(err) ? 'TRANSIENT' : 'PERMANENT';
        console.error(
          `[GeminiService] Model ${currentModel} failed (${category}) in ${durationMs}ms:`,
          err?.status || err?.statusCode || '',
          err?.message ? err.message.slice(0, 120) : err
        );
        lastErr = err;

        // If it's a quota (429) or demand (503) error and we have an alternate model,
        // break immediately to the fallback model instead of waiting out retries on the exhausted model!
        if (isQuotaOrDemandError(err) && mIdx < modelCandidates.length - 1) {
          console.log(`[GeminiService] Switching to fallback model: ${modelCandidates[mIdx + 1]}`);
          break;
        }

        if (attempt < maxAttemptsForModel && isRetryableError(err)) {
          const delay = 800 + Math.floor(Math.random() * 400);
          console.log(`[GeminiService] Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
  }

  throw lastErr;
}

module.exports = { getAssistantReply };