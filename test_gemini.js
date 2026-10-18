require('dotenv').config();
const pkg = require('./node_modules/@google/genai/package.json');
console.log('@google/genai version:', pkg.version);

const { getAssistantReply } = require('./src/services/geminiService');

async function run() {
  // Test 1: simple message
  console.log('\n--- Test 1: simple safety message ---');
  try {
    const t = Date.now();
    const r = await getAssistantReply('I feel uneasy walking home alone at night. What should I do?', []);
    console.log('OK in', Date.now()-t, 'ms | reply length:', r.length, '| preview:', r.slice(0, 80));
  } catch(e) { console.error('FAIL:', e.message); }

  // Test 2: with conversation history
  console.log('\n--- Test 2: with history ---');
  try {
    const t = Date.now();
    const hist = [
      { role: 'user', text: 'Someone is following me' },
      { role: 'assistant', text: 'Stay calm. Move to a well-lit area with other people.' }
    ];
    const r = await getAssistantReply('Should I call the police?', hist);
    console.log('OK in', Date.now()-t, 'ms | reply length:', r.length);
  } catch(e) { console.error('FAIL:', e.message); }

  // Test 3: history containing error bubble (must be stripped before sending to Gemini)
  console.log('\n--- Test 3: error bubble in history must be stripped ---');
  try {
    const t = Date.now();
    const hist = [
      { role: 'user', text: 'help' },
      { role: 'assistant', text: "I couldn't respond just now (timeout). If urgent use SOS." }
    ];
    const r = await getAssistantReply('are you there?', hist);
    console.log('OK in', Date.now()-t, 'ms');
  } catch(e) { console.error('FAIL:', e.message); }

  console.log('\nAll tests done.');
}

run().catch(e => console.error('Unhandled:', e));
