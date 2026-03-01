import express from 'express';
import { handleAI } from '../controllers/ai.controller.js';

const router = express.Router();

/**
 * POST /api/ai
 * Body: { question: string, user_context?: { condition, days_after_delivery, location } }
 */
router.post('/ai', handleAI);

export default router;
