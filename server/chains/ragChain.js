import { ChatOpenAI } from '@langchain/openai';
import { RetrievalQAChain, LLMChain } from 'langchain/chains';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PromptTemplate } from '@langchain/core/prompts';
import { BaseRetriever } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';
import { logger } from '../utils/logger.js';
import { readFile, readdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── OpenRouter LLM (free models) ────────────────────────────────────────────
const getLLM = () =>
    new ChatOpenAI({
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        modelName: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free',
        temperature: 0.2,
        maxTokens: 1024,
        configuration: {
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://afterma.app',
                'X-Title': 'Afterma AI Chatbot',
            },
        },
    });

// ─── QA Prompt (used when local docs match) ─────────────────────────────────
const QA_PROMPT = PromptTemplate.fromTemplate(`
You are Afterma Sahayika — a compassionate, knowledgeable maternal health assistant 
serving Indian mothers and families. You respond in a warm, culturally respectful tone.

CORE RULES:
1. Answer using the provided context first. Supplement with your own medical knowledge if needed.
2. Always cite if using context (e.g., "According to Afterma guidelines...").
3. You are NOT a doctor. For medical decisions, always advise consulting a qualified healthcare professional.
4. Use warm, empathetic language suitable for Indian mothers — begin with "Namaste" when opening.
5. If the question is in Hindi, respond in Hindi. Otherwise, respond in English.
6. Keep responses concise and practical (3–5 sentences max unless detail is needed).

TRIAGE GUIDANCE:
- Mild: Self-care tips sufficient
- Moderate: Suggest consulting a doctor soon
- Emergency: Direct to call 112 or nearest hospital immediately

Context from Afterma Knowledge Base:
─────────────────────────────────────
{context}
─────────────────────────────────────

Question: {question}

Helpful Answer:`.trim());

// ─── AI Fallback Prompt (used when no local docs match) ──────────────────────
const AI_FALLBACK_PROMPT = PromptTemplate.fromTemplate(`
You are Afterma Sahayika — a compassionate, knowledgeable maternal health assistant 
serving Indian mothers and families. You have deep expertise in maternal health, 
postpartum care, Indian government welfare schemes, and women's wellness.

CORE RULES:
1. Answer from your own medical and health knowledge. Be accurate and helpful.
2. You are NOT a doctor. Always advise consulting a healthcare professional for clinical decisions.
3. Use warm, empathetic language suitable for Indian mothers — begin with "Namaste".
4. If the question is in Hindi, respond in Hindi. Otherwise, respond in English.
5. Keep responses concise and practical (3–5 sentences max unless detail is needed).
6. For emergencies, direct to call 112 or nearest hospital immediately.

Question: {question}

Helpful Answer:`.trim());

// ─── Local document directories ───────────────────────────────────────────────
const DOC_DIRS = [
    { path: join(__dirname, '../docs'), source_type: 'docs' },
    { path: join(__dirname, '../knowledgebase'), source_type: 'knowledge' },
    { path: join(__dirname, '../research'), source_type: 'research' },
    { path: join(__dirname, '../gov-schemes'), source_type: 'scheme' },
];

// ─── Singleton document chunks ────────────────────────────────────────────────
let _chunks = null;

const loadChunks = async () => {
    if (_chunks) return _chunks;

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 800, chunkOverlap: 100 });
    const docs = [];

    for (const { path: dir, source_type } of DOC_DIRS) {
        let files;
        try { files = await readdir(dir); }
        catch { logger.warn(`[RAGChain] Skipping missing dir: ${dir}`); continue; }

        for (const file of files) {
            const ext = extname(file).toLowerCase();
            if (!['.md', '.txt', '.json'].includes(ext)) continue;

            let content;
            try { content = await readFile(join(dir, file), 'utf-8'); }
            catch { continue; }

            const text = ext === '.json'
                ? JSON.stringify(JSON.parse(content), null, 2)
                : content;

            const chunks = await splitter.createDocuments(
                [text],
                [{ source: basename(file), source_type }]
            );
            docs.push(...chunks);
        }
    }

    _chunks = docs;
    logger.info(`[RAGChain] Loaded ${_chunks.length} document chunks from local files.`);
    return _chunks;
};

// ─── Keyword-based Retriever (no embeddings needed) ──────────────────────────
class KeywordRetriever extends BaseRetriever {
    lc_namespace = ['custom', 'keyword_retriever'];

    constructor(fields) {
        super(fields);
        this.k = fields?.k ?? 5;
        this.filter = fields?.filter ?? null;
    }

    async _getRelevantDocuments(query) {
        const allChunks = await loadChunks();

        // Apply source_type filter if provided
        const pool = this.filter
            ? allChunks.filter(this.filter)
            : allChunks;

        if (pool.length === 0) return [];

        // Tokenise query into meaningful words (≥3 chars)
        const queryWords = query
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 3);

        // Score each chunk by keyword overlap (TF-style)
        const scored = pool.map((doc) => {
            const text = doc.pageContent.toLowerCase();
            const score = queryWords.reduce((acc, word) => {
                // Count occurrences of the word
                const matches = (text.match(new RegExp(word, 'g')) || []).length;
                return acc + matches;
            }, 0);
            return { doc, score };
        });

        return scored
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, this.k)
            .map(({ doc }) => doc);
    }
}

/**
 * Run a stateless RAG query using OpenRouter LLM + keyword retrieval.
 * No embeddings API, no database.
 *
 * @param {string} question
 * @param {object} [metadataFilter] - e.g. { source_type: 'research' }
 * @returns {Promise<{ answer: string, sources: Array }>}
 */
export const runRagChain = async (question, metadataFilter = {}) => {
    // Ensure docs are loaded
    await loadChunks();

    const k = parseInt(process.env.RAG_K || '5', 10);
    const filter = Object.keys(metadataFilter).length > 0
        ? (doc) => Object.entries(metadataFilter).every(([key, val]) => doc.metadata[key] === val)
        : null;

    const retriever = new KeywordRetriever({ k, filter });
    const llm = getLLM();

    // Retrieve relevant local documents via keyword search
    const docs = await retriever._getRelevantDocuments(question);

    let result;

    if (docs.length > 0) {
        // ── Path A: Answer grounded in local docs ─────────────────────────────
        const context = docs.map((d) => d.pageContent).join('\n\n---\n\n');
        const chain = new LLMChain({ llm, prompt: QA_PROMPT });
        result = await chain.call({ context, question });
        logger.info(`[RAGChain] Answered using ${docs.length} local doc chunk(s).`);
    } else {
        // ── Path B: No local docs — let the AI answer from its own knowledge ──
        logger.info('[RAGChain] No local docs matched — using AI knowledge fallback.');
        const chain = new LLMChain({ llm, prompt: AI_FALLBACK_PROMPT });
        result = await chain.call({ question });
    }

    const rawSources = docs.map((doc) => ({
        source: doc.metadata?.source || 'Afterma Knowledge Base',
        source_type: doc.metadata?.source_type || 'document',
    }));

    return {
        answer: result.text || '',
        sources: rawSources.length > 0
            ? [...new Map(rawSources.map((s) => [s.source, s])).values()]
            : [],
    };
};
