import { processChat } from '../services/chat.service.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/chat
 * Body: { question: string }
 */
export const handleChat = async (req, res) => {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || !question.trim()) {
            return res.status(400).json({
                status: 'error',
                error: '"question" is required and must be a non-empty string.',
                example: { question: 'What nutrition is recommended in the third trimester?' },
            });
        }

        if (question.trim().length > 1000) {
            return res.status(400).json({
                status: 'error',
                error: 'Question is too long. Please keep it under 1000 characters.',
            });
        }

        const response = await processChat(question.trim());
        return res.json(response);

    } catch (err) {
        logger.error(`[ChatController] Error: ${err.message}`);
        return res.status(500).json({
            status: 'error',
            error: 'Afterma AI could not process your request. Please try again in a moment.',
        });
    }
};
