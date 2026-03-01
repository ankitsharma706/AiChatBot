import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import aiRoute from './routes/ai.route.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

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

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api', aiRoute);

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const hasKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
  res.json({
    status: 'ok',
    service: 'Afterma AI Backend',
    mode: 'OpenRouter Cloud AI',
    model: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free',
    api_key_configured: hasKey,
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── GLOBAL ERROR ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║    Afterma AI Backend — OpenRouter Mode      ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`\n🚀 Server running at  → http://localhost:${PORT}`);
  console.log(`📬 AI endpoint        → POST http://localhost:${PORT}/api/ai`);
  console.log(`❤️  Health check       → GET  http://localhost:${PORT}/health`);

  const hasKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';

  if (hasKey) {
    console.log(`\n✅ OpenRouter API Key configured successfully!`);
    console.log(`   Model in use   → ${process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'}`);
  } else {
    console.log('\n⚠️  OpenRouter API Key NOT FOUND. You need one to continue.');
    console.log('   1. Go to https://openrouter.ai/keys to get a free API key');
    console.log('   2. Paste the key into your \'.env\' file as OPENROUTER_API_KEY');
    console.log('   3. Restart this server');
  }
  console.log('\n─────────────────────────────────────────────\n');
});
