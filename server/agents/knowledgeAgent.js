import { runRagChain } from '../chains/ragChain.js';
import { logger } from '../utils/logger.js';

const KNOWLEDGE_SYSTEM_NOTE = `
You are the Afterma Platform Knowledge Agent. Your role is to:
- Answer questions about how to use the Afterma platform and its features.
- Explain health logs, tracker features, consultation booking, and app functionality.
- Use language like: "In the Afterma app...", "This feature helps you..."
- Guide users step-by-step for platform-related tasks.
`.trim();

export const runKnowledgeAgent = async (question) => {
    logger.info(`[KnowledgeAgent] Activated for: "${question.slice(0, 60)}..."`);
    const augmentedQ = `${KNOWLEDGE_SYSTEM_NOTE}\n\nUser Question: ${question}`;
    const result = await runRagChain(augmentedQ, { source_type: 'knowledge' });
    return { ...result, agent: 'knowledge', agent_label: 'Platform Knowledge Base Agent' };
};
