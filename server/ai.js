/**
 * ai.js — Direct OpenRouter API call. No LangChain.
 * Tries multiple free models in sequence until one works.
 */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const SYSTEM_PROMPT = `You are Afterma Sahayika — a compassionate maternal health assistant for Indian mothers.

RULES:
- Start with "Namaste" on the first message.
- Be warm, empathetic, and culturally respectful.
- If context is given, use it and cite the source (e.g. "According to Afterma guidelines...").
- If no context is given, answer from your own medical and general knowledge.
- You are NOT a doctor — always advise consulting a healthcare professional for clinical decisions.
- For emergencies: direct the user to call 112 or visit the nearest hospital immediately.
- If the question is in Hindi, respond in Hindi.
- Keep answers concise (3–5 sentences) unless more detail is clearly needed.`;

// Models tried in order — first success wins.
// All are confirmed available on OpenRouter free tier.
const MODEL_CHAIN = [
    process.env.OPENROUTER_MODEL || 'mistralai/mistral-small-3.1-24b-instruct:free',
    process.env.OPENROUTER_FALLBACK_MODEL || 'qwen/qwen3-4b:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    'arcee-ai/trinity-mini:free',
];

/**
 * Make one chat completion request to OpenRouter.
 */
async function callOpenRouter(model, userMessage) {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://afterma.app',
            'X-Title': 'Afterma AI Chatbot',
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 1024,
        }),
    });

    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
}

/**
 * Ask the AI — tries each model in MODEL_CHAIN until one succeeds.
 * Skips on 429 (rate limit), 404 (not found), 400 (provider error).
 *
 * @param {string} question
 * @param {string} context  — formatted text from local docs, or empty string
 * @returns {Promise<string>} answer text
 */
export async function askAI(question, context = '') {
    const userMessage = context
        ? `Context from Afterma knowledge base:\n──────────────\n${context}\n──────────────\n\nQuestion: ${question}`
        : question;

    // Deduplicate model list (in case .env values match defaults)
    const models = [...new Set(MODEL_CHAIN)];

    let lastError = '';

    for (const model of models) {
        console.log(`[AI] Trying model: ${model}`);
        try {
            const { ok, status, body } = await callOpenRouter(model, userMessage);

            if (ok) {
                const answer = body.choices?.[0]?.message?.content?.trim() || '';
                if (answer) {
                    console.log(`[AI] ✅ Success with: ${model}`);
                    return answer;
                }
            }

            // Retry-able: 429 rate limit, 400 provider error, 404 not found
            const retryable = [400, 404, 429].includes(status);
            if (!retryable) {
                throw new Error(`OpenRouter ${status}: ${JSON.stringify(body?.error?.message || body)}`);
            }

            lastError = `${model} → ${status}: ${body?.error?.metadata?.raw || body?.error?.message || status}`;
            console.warn(`[AI] Skip (${status}): ${model}`);

        } catch (err) {
            if (!err.message.startsWith('OpenRouter')) {
                // Network error — don't try more models
                throw err;
            }
            lastError = err.message;
            console.warn(`[AI] Skip (error): ${model} — ${err.message}`);
        }
    }

    throw new Error(`All models failed. Last error: ${lastError}`);
}
