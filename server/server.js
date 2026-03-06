import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Client } from 'langsmith';
import chatRoute from './routes/chat.route.js';
import healthRoute from './routes/health.route.js';
import { logger } from './utils/logger.js';

// ─── LangSmith Tracing Setup ──────────────────────────────────────────────────
if (process.env.LANGCHAIN_TRACING_V2 === 'true') {
    try {
        new Client({ apiKey: process.env.LANGCHAIN_API_KEY });
        logger.info('[LangSmith] Tracing enabled ✅');
    } catch (e) {
        logger.warn('[LangSmith] Could not initialize tracer — continuing without tracing.');
    }
}

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
                return cb(null, true);
            }
            cb(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', healthRoute);
app.use('/api', chatRoute);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    logger.error(`[Global Error] ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   🌸  Afterma AI Backend — LangChain + In-Memory RAG        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(`🚀  Server running        → http://localhost:${PORT}`);
    console.log(`💬  Chat API              → POST http://localhost:${PORT}/api/chat`);
    console.log(`❤️   Health check          → GET  http://localhost:${PORT}/health`);
    console.log(`\n🤖  LLM Model             → ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
    console.log(`📐  Embedding Model       → ${process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'}`);
    console.log(`💾  Storage               → In-Memory (local docs)`);
    console.log(`🔍  LangSmith Tracing     → ${process.env.LANGCHAIN_TRACING_V2 === 'true' ? 'enabled' : 'disabled'}`);
    console.log('\n─────────────────────────────────────────────────────────────────\n');

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your_')) {
        logger.warn('⚠️  OPENAI_API_KEY is not set. Copy .env.example → .env and add your key.');
    }
});
