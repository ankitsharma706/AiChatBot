import express from 'express';

const router = express.Router();

router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Afterma AI Backend',
        version: '2.0.0',
        architecture: 'LangChain + In-Memory Vector Search + Multi-Agent RAG',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        embedding_model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        storage: 'in-memory',
        langsmith_tracing: process.env.LANGCHAIN_TRACING_V2 === 'true' ? 'enabled' : 'disabled',
        timestamp: new Date().toISOString(),
        endpoints: {
            chat: 'POST /api/chat',
        },
    });
});

export default router;
