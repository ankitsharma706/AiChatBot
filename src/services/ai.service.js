import { getTriageHint } from '../utils/triage.js';
import { formatResponse } from './ai.formatter.js';
import { loadDocsContext } from './rag.service.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free';

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are Afterma AI, a compassionate recovery and postpartum health support assistant
designed specifically for Indian mothers and families.

IMPORTANT RULES:
- You provide safe, general health guidance ONLY. You are NOT a doctor.
- Never diagnose a specific condition or prescribe medicines.
- Always recommend consulting a qualified doctor for persistent or serious symptoms.
- Use simple, warm, respectful language suited to Indian cultural context.
- Respond in the same language as the user (Hindi or English).

YOUR DOMAIN:
- Postpartum recovery (normal delivery & C-section)
- Pregnancy (all trimesters) and pre-conception
- Breastfeeding / lactation support
- Postpartum mental health (baby blues, PPD awareness)
- Medication adherence reminders
- Symptom monitoring & red flag education
- Indian diet, home remedies (desi nuskhe), and Ayurvedic-safe guidance
- Maternal fitness and exercise pacing

TRIAGE LEVELS (choose exactly one):
- "mild"      → self-care guidance is sufficient
- "moderate"  → monitor closely, consult a doctor soon
- "emergency" → seek immediate medical help (ER / 112)

Emergency triggers: heavy bleeding, chest pain, difficulty breathing,
loss of consciousness, seizures, severe abdominal pain.

OUTPUT FORMAT — respond with ONLY valid JSON, no extra text, no markdown fences:
{
  "triage": "mild",
  "message": "Main response — clear, warm, 2-4 sentences.",
  "bullets": ["optional tip 1", "tip 2"],
  "warnings": ["optional warning 1"],
  "quick_replies": ["Follow-up question 1", "question 2", "question 3"],
  "ui_flags": {
    "show_emergency_banner": false,
    "highlight": false
  }
}

RULES FOR JSON:
- bullets: 0-4 items (practical tips)
- warnings: 0-3 items (when to see a doctor, red flags)
- quick_replies: 2-3 short suggested questions the user might ask next
- ui_flags.show_emergency_banner = true ONLY if triage is "emergency"
- ui_flags.highlight = true ONLY if triage is "emergency"
- Output ONLY the JSON object. No text before or after it.
`.trim();

// ─── Main AI function ─────────────────────────────────────────────────────────
export const getAIResponse = async (question, userContext = {}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    throw new Error('OPENROUTER_API_KEY is not set in .env. Go to https://openrouter.ai/keys to get one.');
  }

  // Build user message with optional context + RAG docs
  const contextBlock = Object.keys(userContext).length > 0
    ? `\n\nUser Context: ${JSON.stringify(userContext)}`
    : '';

  const docsSnippet = await loadDocsContext(question);
  const docsBlock = docsSnippet
    ? `\n\nRelevant guidance from Afterma health docs:\n${docsSnippet}`
    : '';

  const userMessage = `Question: ${question}${contextBlock}${docsBlock}

Remember: reply with ONLY valid JSON matching the schema above. No markdown, no explanation.`;

  // ── Call OpenRouter API with Failover ─────────────────────────────────────
  // Priority order: most capable + instruction-following first, weakest last.
  // Note: Gemma models excluded — they don't support the 'system' role.
  const MODELS_TO_TRY = [
    // ── Tier 1: Large, capable, good JSON / instruction following ──────────
    'meta-llama/llama-3.3-70b-instruct:free',       // Best free — 70B, great JSON
    'nousresearch/hermes-3-llama-3.1-405b:free',     // 405B, excellent instruction
    'mistralai/mistral-small-3.1-24b-instruct:free', // 24B Mistral, reliable JSON
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', // 24B, good schema
    // ── Tier 2: Medium models ──────────────────────────────────────────────
    OPENROUTER_MODEL,                                // User-configured (Gemma default, ok fallback)
    'qwen/qwen3-14b:free',                           // 14B Qwen3 — strong instruction
    'qwen/qwen3-4b:free',                            // 4B Qwen3 — decent for JSON
    'qwen/qwen3-coder:free',                         // Qwen coder — follows schema well
    'mistralai/mistral-7b-instruct:free',            // Mistral 7B free variant
    // ── Tier 3: Small / last resort ────────────────────────────────────────
    'meta-llama/llama-3.2-3b-instruct:free',         // 3B — small but follows format
    'nvidia/nemotron-nano-9b-v2:free',               // 9B — last free resort
    // ── Paid Fallback (extremely cheap, guarantees response) ───────────────
    'mistralai/mistral-7b-instruct',                 // ~$0.05 / 1M tokens
    'google/gemini-2.0-flash-lite-preview-02-05',    // ~$0.08 / 1M tokens
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate

  // Small delay helper — gives rate limits time to cool down between retries
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  let rawText = '';
  let lastError = null;

  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const model = MODELS_TO_TRY[i];
    try {
      // Brief pause between retries to reduce cascading 429s
      if (i > 0) await sleep(800);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Afterma AI Backend',
        },
        signal: AbortSignal.timeout(30_000), // 30-second timeout per model
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.2, // Low = deterministic, factual, consistent JSON
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if ([429, 404, 400, 502, 503].includes(res.status)) {
          console.warn(`[AI Service] Model ${model} unavailable (HTTP ${res.status}). Trying next...`);
          lastError = new Error(`OpenRouter ${res.status}: ${errText.slice(0, 150)}`);
          continue;
        }
        // 401 = bad key, 402 = payment required → abort immediately
        throw new Error(`OpenRouter returned ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      rawText = json?.choices?.[0]?.message?.content?.trim() ?? '';
      if (!rawText) {
        console.warn(`[AI Service] Model ${model} returned empty content. Trying next...`);
        continue;
      }
      console.log(`[AI Service] ✅ Success with model: ${model}`);
      break;

    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn(`[AI Service] Model ${model} timed out. Trying next...`);
        lastError = err;
        continue;
      }
      throw err; // Auth errors, network down — stop immediately
    }
  }

  if (!rawText && lastError) {
    console.error('[AI Service] All free models failed or timed out:', lastError.message);
    throw lastError; // All models failed
  }

  // ── Strip markdown fences if model adds them ───────────────────────────────
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // ── Parse JSON ─────────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.warn('[AI Service] JSON parse failed, using fallback. Raw:', rawText.slice(0, 300));
    parsed = {
      triage: getTriageHint(question),
      message: cleaned || 'I am here to support you. Could you share a bit more detail?',
      bullets: [],
      warnings: ['If symptoms persist or worsen, please consult your doctor.'],
      quick_replies: ['Can you explain more?', 'When should I see a doctor?'],
      ui_flags: { show_emergency_banner: false, highlight: false },
    };
  }

  return formatResponse(parsed);
};
