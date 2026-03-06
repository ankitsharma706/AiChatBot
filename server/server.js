import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDocs, searchDocs } from './docs.js';

import { askAI } from './ai.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return cb(null, true);
        }
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Afterma AI Backend',
        version: '3.0.0',
        model: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free',
        storage: 'in-memory (local JSON + MD docs)',
        timestamp: new Date().toISOString(),
        endpoints: { ai: 'POST /api/ai' },
    });
});

// ─── Emergency keywords ───────────────────────────────────────────────────────
const EMERGENCY_WORDS = [
    'heavy bleeding', 'chest pain', 'can\'t breathe', 'difficulty breathing',
    'unconscious', 'collapse', 'seizure', 'convulsion', 'severe headache',
    'thoughts of harming', 'suicidal', 'suicide', 'self harm', 'faint', 'fainting',
];
function isEmergency(text) {
    const lower = text.toLowerCase();
    return EMERGENCY_WORDS.some((w) => lower.includes(w));
}

// ─── Intent → source_type mapping ────────────────────────────────────────────
function detectSourceType(question) {
    const q = question.toLowerCase();
    if (/scheme|yojana|government|pmmvy|jsy|subsidy|anganwadi|benefit|apply|eligib/.test(q)) return 'scheme';
    if (/research|study|paper|findings|evidence|clinical|journal|survey/.test(q)) return 'research';
    if (/app|feature|platform|log|tracker|dashboard|account|reminder|consult|book/.test(q)) return 'knowledge';
    return 'health';
}

// ─── POST /api/ai ─────────────────────────────────────────────────────────────
app.post('/api/ai', async (req, res) => {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
        return res.status(400).json({
            status: 'error',
            error: '"question" is required.',
            example: { question: 'What are postpartum recovery tips?' },
        });
    }

    if (question.trim().length > 1000) {
        return res.status(400).json({ status: 'error', error: 'Question too long (max 1000 chars).' });
    }

    const q = question.trim();

    // Emergency fast-path
    if (isEmergency(q)) {
        return res.json({
            status: 'success',
            triage: 'emergency',
            message: 'Namaste. This sounds like a medical emergency. Please call 112 or go to the nearest hospital immediately. Do not delay — your health is the priority.',
            bullets: ['Call Indian Emergency: 112', 'iCall Mental Health: 9152987821'],
            sources: [],
            quick_replies: ['What are other emergency symptoms?'],
        });
    }

    try {
        const source_type = detectSourceType(q);
        const k = parseInt(process.env.RAG_K || '5', 10);

        // Search local docs
        const docs = searchDocs(q, { source_type, k });

        // Build context from matched docs
        const context = docs.length > 0
            ? docs.map((d) => `[${d.source}]\n${d.text}`).join('\n\n---\n\n')
            : '';

        if (docs.length === 0) {
            console.log(`[AI] No local docs matched for "${q.slice(0, 50)}" — using AI knowledge.`);
        } else {
            console.log(`[AI] Found ${docs.length} doc chunk(s) for "${q.slice(0, 50)}"`);
        }

        const answer = await askAI(q, context);

        const sources = [...new Map(docs.map((d) => [d.source, { source: d.source, source_type: d.source_type }])).values()];

        return res.json({
            status: 'success',
            triage: 'mild',
            message: answer,
            sources,
            quick_replies: [
                'What foods are good during recovery?',
                'Are there government schemes for me?',
                'How do I use the Afterma app?',
            ],
        });
    } catch (err) {
        console.error(`[AI] Error: ${err.message}`);
        return res.status(500).json({
            status: 'error',
            error: 'Could not process your request. Please try again in a moment.',
        });
    }
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   🌸  Afterma AI Backend  v3.0  —  OpenRouter + Local Docs  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`🚀  Server     → http://localhost:${PORT}`);
    console.log(`💬  AI API     → POST http://localhost:${PORT}/api/ai`);
    console.log(`❤️   Health     → GET  http://localhost:${PORT}/health`);
    console.log(`🤖  Model      → ${process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'}`);
    console.log('\n─────────────────────────────────────────────────────────────────\n');

    // Pre-load docs at startup
    await getDocs();
});
