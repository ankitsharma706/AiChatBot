import express from 'express';
import { handleChat } from '../controllers/chat.controller.js';

const router = express.Router();

/**
 * POST /api/chat
 * Body: { question: string }
 */
router.post('/chat', handleChat);

export default router;
