import { getAIResponse } from '../services/ai.service.js';
import { detectEmergency } from '../utils/triage.js';

/**
 * POST /api/ai
 * Accepts: { question, user_context }
 * Returns: Afterma JSON response schema
 */
export const handleAI = async (req, res) => {
  try {
    const { question, user_context } = req.body;

    // ── Validate ────────────────────────────────────────────────────────────
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        status: 'error',
        error: 'question is required and must be a non-empty string.',
      });
    }

    const trimmed = question.trim();

    // ── Local emergency pre-check (fast, no API call) ──────────────────────
    if (detectEmergency(trimmed)) {
      return res.json({
        status: 'success',
        triage: 'emergency',
        message:
          'This sounds like a medical emergency. Please call 112 or go to the nearest hospital immediately. Do not delay.',
        bullets: [],
        warnings: [
          'Do NOT wait — seek immediate medical care.',
          'If feeling dizzy or very weak, lie down and call for help now.',
          'Indian Emergency: 112 | iCall: 9152987821',
        ],
        quick_replies: [
          'What other symptoms require emergency care?',
          'How can I stay calm while waiting for help?',
        ],
        ui_flags: {
          show_emergency_banner: true,
          highlight: true,
        },
      });
    }

    // ── Get full AI response ────────────────────────────────────────────────
    const response = await getAIResponse(trimmed, user_context || {});
    return res.json(response);

  } catch (err) {
    console.error('[AI Controller Error]', err.message);
    return res.status(500).json({
      status: 'error',
      error: 'AI processing failed. Please try again in a moment.',
    });
  }
};
