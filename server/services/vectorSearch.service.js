import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { getMongoClient } from '../utils/mongodb.js';
import { getEmbeddings } from '../utils/embeddings.js';
import { logger } from '../utils/logger.js';

const RAG_K = parseInt(process.env.RAG_K || '5', 10);

/**
 * Returns a MongoDBAtlasVectorSearch instance bound to the documents collection.
 *
 * @param {object} [preFilter] - MongoDB pre-filter e.g. { "metadata.source_type": "research" }
 * @returns {Promise<MongoDBAtlasVectorSearch>}
 */
export const getVectorStore = async (preFilter = {}) => {
    const client = await getMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || 'afterma_ai';
    const collectionName = process.env.MONGODB_COLLECTION || 'documents';
    const indexName = process.env.MONGODB_INDEX_NAME || 'vector_index';

    const collection = client.db(dbName).collection(collectionName);

    return new MongoDBAtlasVectorSearch(getEmbeddings(), {
        collection,
        indexName,
        textKey: 'content',
        embeddingKey: 'embedding',
    });
};

/**
 * Perform a semantic similarity search against MongoDB Atlas Vector Search.
 *
 * @param {string} query          - User query to embed and search
 * @param {number} [k]            - Number of results to return
 * @param {object} [metadataFilter] - e.g. { source_type: 'research' }
 * @returns {Promise<Array<{ content: string, metadata: object, similarity: number }>>}
 */
export const searchDocs = async (query, k = RAG_K, metadataFilter = {}) => {
    if (!query?.trim()) return [];

    // Build a MongoDB pre-filter from metadata key-value pairs
    const preFilter = Object.keys(metadataFilter).reduce((acc, key) => {
        acc[`metadata.${key}`] = metadataFilter[key];
        return acc;
    }, {});

    const store = await getVectorStore();

    const results = await store.similaritySearchWithScore(query, k, preFilter);

    if (!results.length) {
        logger.warn(`[VectorSearch] No results for query: "${query.slice(0, 60)}..."`);
        return [];
    }

    logger.info(`[VectorSearch] ${results.length} result(s) — filter: ${JSON.stringify(metadataFilter)}`);

    return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        similarity: score,
    }));
};

/**
 * Format retrieved chunks into a context string for LLM prompts.
 * @param {Array} results - Results from searchDocs()
 * @returns {string}
 */
export const formatContext = (results) => {
    if (!results.length) return '';
    return results
        .map((r, i) => {
            const src = r.metadata?.source || r.metadata?.filename || 'Afterma Knowledge Base';
            const type = r.metadata?.source_type || 'document';
            return `[Source ${i + 1} — ${type}: ${src}]\n${r.content}`;
        })
        .join('\n\n───────────────────────\n\n');
};
