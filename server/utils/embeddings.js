import { OpenAIEmbeddings } from '@langchain/openai';
import 'dotenv/config';

/**
 * Returns a singleton OpenAI embeddings instance.
 * model: text-embedding-3-small → 1536 dimensions, cost-effective.
 */
let _embeddingsInstance = null;

export const getEmbeddings = () => {
    if (!_embeddingsInstance) {
        _embeddingsInstance = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
            batchSize: 512,
        });
    }
    return _embeddingsInstance;
};
