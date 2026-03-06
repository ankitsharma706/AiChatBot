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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Make one chat completion request to OpenRouter.
 * Times out after 30 seconds so a hanging model doesn't block the chain.
 */
async function callOpenRouter(model, userMessage) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
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
    } catch (err) {
        if (err.name === 'AbortError') {
            return { ok: false, status: 408, body: { error: { message: 'Timed out after 30s' } } };
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Ask the AI — tries every model in MODEL_CHAIN until one succeeds.
 * No overall timeout — takes as long as needed to get an answer.
 * Skips a model on: 400, 401, 404, 408 (timeout), 429 (rate limit).
 *
 * @param {string} question
 * @param {string} context  — formatted text from local docs, or empty string
 * @returns {Promise<string>} answer text
 */
export async function askAI(question, context = '') {
    const userMessage = context
        ? `Context from Afterma knowledge base:\n──────────────\n${context}\n──────────────\n\nQuestion: ${question}`
        : question;

    const models = [...new Set(MODEL_CHAIN)];
    let lastError = '';

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        console.log(`[AI] Trying model ${i + 1}/${models.length}: ${model}`);

        try {
            const { ok, status, body } = await callOpenRouter(model, userMessage);

            if (ok) {
                const answer = body.choices?.[0]?.message?.content?.trim() || '';
                if (answer) {
                    console.log(`[AI] ✅ Success with: ${model}`);
                    return answer;
                }
            }

            const skippable = [400, 401, 404, 408, 429].includes(status);
            if (!skippable) {
                throw new Error(`OpenRouter ${status}: ${JSON.stringify(body?.error?.message || body)}`);
            }

            lastError = `${model} → HTTP ${status}: ${body?.error?.metadata?.raw || body?.error?.message || status}`;
            console.warn(`[AI] Skip (${status}): ${model}`);

        } catch (err) {
            if (err.name !== 'Error' || !err.message.startsWith('OpenRouter')) {
                throw err; // Network-level error, stop
            }
            lastError = err.message;
            console.warn(`[AI] Skip (error): ${model} — ${err.message}`);
        }

        // Brief pause before next model to avoid cascading rate limits
        if (i < models.length - 1) await sleep(1000);
    }

    throw new Error(`All models failed. Last: ${lastError}`);
}
