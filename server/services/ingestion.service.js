import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import { getMongoClient } from '../utils/mongodb.js';
import { getEmbeddings } from '../utils/embeddings.js';
import { logger } from '../utils/logger.js';

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
    separators: ['\n\n', '\n', '. ', '? ', '! ', ' ', ''],
});

/**
 * Split a raw text document into semantic chunks with attached metadata.
 *
 * @param {string} text
 * @param {object} metadata  - e.g. { source_type: 'research', source: 'paper.pdf' }
 * @returns {Promise<Array<{ pageContent: string, metadata: object }>>}
 */
export const splitDocument = async (text, metadata = {}) => {
    const docs = await splitter.createDocuments([text], [metadata]);
    logger.info(`[Ingestion] Split "${metadata.source}" → ${docs.length} chunk(s)`);
    return docs;
};

/**
 * Embed and upsert LangChain Document chunks into MongoDB Atlas Vector Search.
 *
 * Uses MongoDBAtlasVectorSearch.addDocuments() which handles:
 *   - Generating embeddings in batches
 *   - Inserting documents with { content, embedding, metadata } fields
 *
 * @param {Array<{ pageContent: string, metadata: object }>} docs
 * @returns {Promise<number>} number of chunks inserted
 */
export const upsertToMongoDB = async (docs) => {
    if (!docs.length) return 0;

    const client = await getMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || 'afterma_ai';
    const collectionName = process.env.MONGODB_COLLECTION || 'documents';
    const indexName = process.env.MONGODB_INDEX_NAME || 'vector_index';

    const collection = client.db(dbName).collection(collectionName);

    const store = new MongoDBAtlasVectorSearch(getEmbeddings(), {
        collection,
        indexName,
        textKey: 'content',
        embeddingKey: 'embedding',
    });

    logger.info(`[Ingestion] Embedding & inserting ${docs.length} chunk(s) into MongoDB...`);

    // addDocuments embeds + inserts in LangChain-compatible format
    const ids = await store.addDocuments(docs);

    logger.info(`[Ingestion] ✅ Inserted ${ids.length} chunk(s) into '${dbName}.${collectionName}'`);
    return ids.length;
};

/**
 * Full pipeline: split → embed → upsert for a raw text string.
 *
 * @param {string} text
 * @param {object} metadata  - e.g. { source_type: 'docs', source: 'faq.md' }
 * @returns {Promise<number>} chunks inserted
 */
export const ingestText = async (text, metadata = {}) => {
    const docs = await splitDocument(text, metadata);
    return upsertToMongoDB(docs);
};
